import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_DEMO_ORDERS,
  DEFAULT_MENU_ITEMS,
  DEFAULT_TRIAL_METRICS,
  EMPTY_ORDER_DRAFT,
} from '../data/defaultBusinessData';
import {
  calculateOrderTotals,
  createSubmittedOrderFromDraft,
  processCustomerMessage,
} from './orderRules';
import { computeTrialSummary } from './metrics';

test('Sample 1: Malayalam order responds in Malayalam, collects missing fields, computes exact trial price, and submits without confirming', () => {
  const turn1 = processCustomerMessage(
    '10 ഉണ്ണിയപ്പം വേണം നാളെ വൈകിട്ട്.',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.equal(turn1.language, 'ml');
  assert.equal(turn1.calculation.totalPieces, 10);
  assert.equal(turn1.calculation.subtotal, 80);
  assert.equal(turn1.canSubmitReview, false);
  assert.match(turn1.replyText, /ഉണ്ണിയപ്പം/);

  const turn2 = processCustomerMessage(
    'രമേശ്, 9876543210, ഡെലിവറി, പനങ്കയം സ്കൂളിന് സമീപം',
    turn1.updatedDraft,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.equal(turn2.language, 'ml');
  assert.equal(turn2.updatedDraft.customerName, 'രമേശ്');
  assert.equal(turn2.updatedDraft.fulfillment, 'delivery');
  assert.equal(turn2.calculation.subtotal, 80);
  assert.equal(turn2.calculation.deliveryFee, null); // Never invents delivery fee!
  assert.equal(turn2.canSubmitReview, true);
  assert.match(turn2.replyText, /₹80/);

  const submitted = createSubmittedOrderFromDraft(
    turn2.updatedDraft,
    turn2.calculation,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(submitted.order.status, 'Submitted for review');
  assert.match(submitted.confirmationNoticeEn, /not confirmed yet/i);
  assert.match(submitted.confirmationNoticeMl, /ഇതുവരെ കൺഫേം ചെയ്തിട്ടില്ല/);
});

test('Sample 2: Unavailable item (Neyyappam) explains unavailability, does not substitute, and offers handoff or alternatives', () => {
  const res = processCustomerMessage(
    'I want 10 Neyyappam for tomorrow evening',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.equal(res.calculation.lines.length, 0);
  assert.equal(res.handoffSuggested, true);
  assert.match(res.replyText, /unavailable/i);
  assert.match(res.replyText, /won’t substitute/i);
});

test('Sample 3: Bulk booking (100 pieces for event tomorrow) requires team review, mentions 50% trial advance without collecting/confirming', () => {
  const turn1 = processCustomerMessage(
    'I need 100 pieces for an event tomorrow',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.equal(turn1.updatedDraft.orderCategory, 'bulk_event');
  assert.equal(turn1.handoffSuggested, true);
  assert.match(turn1.replyText, /50%/);
  assert.doesNotMatch(turn1.replyText, /\bconfirmed\b/i);

  const turn2 = processCustomerMessage(
    '100 Unniyappam, Name: Anitha, 9847123456, Pickup, tomorrow 10 AM',
    turn1.updatedDraft,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.equal(turn2.calculation.isBulkOrder, true);
  assert.equal(turn2.calculation.subtotal, 800);
  assert.equal(turn2.canSubmitReview, true);
  assert.match(turn2.replyText, /not collected or confirmed/i);
});

test('Sample 4: Outside ~3 km delivery area collects address, routes to team, offers pickup, and never promises or rejects delivery', () => {
  const turn1 = processCustomerMessage(
    '12 Ullivada, Rahul, 9895012345, tomorrow 5 PM, delivery to Edakkara 6 km away near bus stand',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.equal(turn1.updatedDraft.outsideDeliveryAreaFlag, true);
  assert.equal(turn1.handoffSuggested, true);
  assert.match(turn1.replyText, /3 km/);
  assert.match(turn1.replyText, /Pickup/i);
});

test('Sample 5: Missing opening hours or missing price triggers team check instead of guessing', () => {
  const customMenu = DEFAULT_MENU_ITEMS.map((m) =>
    m.id === 'unniyappam' ? { ...m, price: null, availability: 'unknown' as const } : m
  );

  const res = processCustomerMessage(
    '10 Unniyappam, Maya, 9847099887, tomorrow 4 PM, pickup',
    EMPTY_ORDER_DRAFT,
    customMenu,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.equal(res.calculation.hasMissingPrice, true);
  assert.equal(res.calculation.hasUnavailableOrUnknownItem, true);
  assert.equal(res.calculation.subtotal, null);
  assert.equal(res.handoffSuggested, true);
  assert.match(res.replyText, /team/i);
});

test('Sample 6: Customer changes an order updates draft and recalculates from structured data', () => {
  const t1 = processCustomerMessage(
    '10 Unniyappam, Ravi, 9847001122, tomorrow 5 PM, pickup',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(t1.calculation.subtotal, 80);

  const t2 = processCustomerMessage(
    'Change unniyappam to 15',
    t1.updatedDraft,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(t2.calculation.totalPieces, 15);
  assert.equal(t2.calculation.subtotal, 120);
  assert.match(t2.replyText, /₹120/);
});

test('Sample 7: Asking if order is confirmed reports Submitted for review accurately without claiming confirmed', () => {
  const res = processCustomerMessage(
    'Is my order confirmed?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );

  assert.match(res.replyText, /Submitted for review/);
  assert.match(res.replyText, /not confirmed yet/i);
});

test('Pakkavada is restricted from shop supply and allergen queries route to team without guarantees', () => {
  const shopRes = processCustomerMessage(
    'Can I order Pakkavada for my shop supply?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(shopRes.handoffSuggested, true);
  assert.match(shopRes.replyText, /home sales only/i);

  const allergyRes = processCustomerMessage(
    'Do these contain peanuts or sesame? I have an allergy.',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(allergyRes.handoffSuggested, true);
  assert.match(allergyRes.replyText, /cannot make allergen/i);
});

test('Configured delivery fee adds strictly for delivery and never for pickup', () => {
  const configured = { ...DEFAULT_BUSINESS_CONFIG, deliveryFee: 20, openingHours: '8 AM - 6 PM' };
  const deliveryCalc = calculateOrderTotals(
    [{ itemId: 'unniyappam', quantity: 10 }],
    DEFAULT_MENU_ITEMS,
    configured,
    'delivery'
  );
  assert.equal(deliveryCalc.subtotal, 80);
  assert.equal(deliveryCalc.deliveryFee, 20);
  assert.equal(deliveryCalc.total, 100);

  const pickupCalc = calculateOrderTotals(
    [{ itemId: 'unniyappam', quantity: 10 }],
    DEFAULT_MENU_ITEMS,
    configured,
    'pickup'
  );
  assert.equal(pickupCalc.deliveryFee, null);
  assert.equal(pickupCalc.total, 80);
});

test('7-day metrics preserve missing fields and compute net profit per order & direct vs shop difference', () => {
  const summary = computeTrialSummary(DEFAULT_TRIAL_METRICS);
  assert.equal(summary.enteredDaysCount, 2);
  assert.equal(summary.totalDaysCount, 7);
  assert.equal(summary.totalDirectProfitRs, 505);
  assert.equal(summary.totalShopProfitRs, 305);
  assert.equal(summary.directVsShopDiffRs, 200);
  assert.equal(summary.totalTeamAcceptedOrders, 7);
  assert.equal(summary.profitPerAcceptedOrderRs, 72.1);
  assert.ok(summary.missingFieldsCount > 0);
});

test('Malayalam preferredLanguage responds specifically to input (order action, greeting, price question, unclear text) without repeating boilerplate or misparsing customerName', () => {
  const orderAction = processCustomerMessage(
    'Place an order',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(orderAction.language, 'ml');
  assert.equal(orderAction.updatedDraft.customerName, '');
  assert.match(orderAction.replyText, /ഏത് പലഹാരമാണ് വേണ്ടതെന്നും/);
  assert.doesNotMatch(orderAction.replyText, /ഫോൺ നമ്പർ/);

  const eventAction = processCustomerMessage(
    'Book for an event',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(eventAction.language, 'ml');
  assert.equal(eventAction.updatedDraft.customerName, '');
  assert.match(eventAction.replyText, /ഇവന്റ് \/ ബൾക്ക് ബുക്കിംഗിന്/);

  const greetingMsg = processCustomerMessage(
    'ഹലോ',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(greetingMsg.language, 'ml');
  assert.equal(greetingMsg.updatedDraft.customerName, '');
  assert.match(greetingMsg.replyText, /സ്വാഗതം/);
  assert.doesNotMatch(greetingMsg.replyText, /ഫോൺ നമ്പർ/);

  const priceQuery = processCustomerMessage(
    'ഉണ്ണിയപ്പം വില എത്ര?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(priceQuery.language, 'ml');
  assert.equal(priceQuery.updatedDraft.customerName, '');
  assert.match(priceQuery.replyText, /₹8/);
  assert.doesNotMatch(priceQuery.replyText, /ഫോൺ നമ്പർ/);

  const unclearInput = processCustomerMessage(
    'വീട്ടിലുണ്ടാക്കിയതാണോ ഇത്?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(unclearInput.language, 'ml');
  assert.equal(unclearInput.updatedDraft.customerName, '');
  assert.match(unclearInput.replyText, /ക്ഷമിക്കണം/);
  assert.doesNotMatch(unclearInput.replyText, /ദയവായി ബാക്കി വിവരങ്ങൾ കൂടി നൽകാമോ/);
});

test('Landmark extraction accepts Malayalam/English landmarks without "near/സമീപം" and stops re-asking landmark', () => {
  const t1 = processCustomerMessage(
    '10 ഉണ്ണിയപ്പം, അനിൽ, 9876543210, നാളെ വൈകിട്ട്, ഡെലിവറി, പനങ്കയം',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(t1.updatedDraft.deliveryAddress, 'പനങ്കയം');
  assert.equal(t1.updatedDraft.landmark, '');
  assert.equal(t1.canSubmitReview, false);
  assert.match(t1.replyText, /അടുത്തുള്ള അടയാളം/);

  // User replies with just a shop/place landmark without "സമീപം"
  const t2 = processCustomerMessage(
    'അജയ് സ്റ്റോർ',
    t1.updatedDraft,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(t2.updatedDraft.deliveryAddress, 'പനങ്കയം');
  assert.equal(t2.updatedDraft.landmark, 'അജയ് സ്റ്റോർ');
  assert.equal(t2.canSubmitReview, true);
  assert.doesNotMatch(t2.replyText, /അടുത്തുള്ള അടയാളം/);

  // Single-turn Malayalam postposition like പാലത്തിനരികെ
  const singleTurn = processCustomerMessage(
    '10 ഉണ്ണിയപ്പം, സജി, 9847011223, നാളെ രാവിലെ, ഡെലിവറി, പനങ്കയം പാലത്തിനരികെ',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(singleTurn.updatedDraft.customerName, 'സജി');
  assert.equal(singleTurn.updatedDraft.landmark, 'പനങ്കയം പാലത്തിനരികെ');
  assert.equal(singleTurn.canSubmitReview, true);

  // Local place + shop name in follow-up turn without "road" or "near"
  const t3 = processCustomerMessage(
    'വടക്കേത്തൊടി, റേഷൻ കട',
    {
      ...EMPTY_ORDER_DRAFT,
      language: 'ml',
      items: [{ itemId: 'unniyappam', quantity: 10 }],
      customerName: 'രാജു',
      contact: '9876543210',
      requestedDateTime: 'നാളെ വൈകിട്ട്',
      fulfillment: 'delivery',
    },
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.equal(t3.updatedDraft.deliveryAddress, 'വടക്കേത്തൊടി, റേഷൻ കട');
  assert.equal(t3.updatedDraft.landmark, 'റേഷൻ കട');
  assert.equal(t3.canSubmitReview, true);
});

test('Team decisions deliver exact messages for accepted, needs_followup, and rejected orders', () => {
  const acceptedOrders = [
    {
      ...DEFAULT_DEMO_ORDERS[0],
      status: 'Accepted by team' as const,
      teamDecision: 'accepted' as const,
      teamNotes: 'Ready by 5 PM',
    },
  ];
  const acceptedRes = processCustomerMessage(
    'ഓർഡർ കൺഫേം ആയോ?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    acceptedOrders,
    'ml'
  );
  assert.match(acceptedRes.replyText, /Your order has been accepted our staff will contact you soon/);

  const followupOrders = [
    {
      ...DEFAULT_DEMO_ORDERS[0],
      status: 'Declined or needs follow-up' as const,
      teamDecision: 'needs_followup' as const,
    },
  ];
  const followupRes = processCustomerMessage(
    'Is my order confirmed?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    followupOrders,
    'en'
  );
  assert.match(followupRes.replyText, /Your order is under review - we confirm the order status shortly/);

  const rejectedOrders = [
    {
      ...DEFAULT_DEMO_ORDERS[0],
      status: 'Declined or needs follow-up' as const,
      teamDecision: 'rejected' as const,
    },
  ];
  const rejectedRes = processCustomerMessage(
    'Is my order confirmed?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    rejectedOrders,
    'en'
  );
  assert.match(
    rejectedRes.replyText,
    /Your order has been rejected due to unavailability of selected items/
  );
});

test('Understands Malayalam and Manglish enquiries like "Ullivada undo?", Pakkavada boundary matching, menu/delivery/location/timing, and Manglish orders', () => {
  // Even without preferredLanguage='ml', Manglish "Ullivada undo?" detects Malayalam and replies accurately
  const ulliEnq = processCustomerMessage(
    'Ullivada undo?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(ulliEnq.language, 'ml');
  assert.equal(ulliEnq.updatedDraft.customerName, '');
  assert.match(ulliEnq.replyText, /ഉള്ളിവട/);
  assert.match(ulliEnq.replyText, /₹10/);
  assert.match(ulliEnq.replyText, /ലഭ്യമാണ്/);
  assert.doesNotMatch(ulliEnq.replyText, /ക്ഷമിക്കണം/);

  // Pakkavada must NOT falsely match Ullivada via "വട"
  const pakkEnq = processCustomerMessage(
    'പക്കവട ഉണ്ടോ?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS,
    'ml'
  );
  assert.match(pakkEnq.replyText, /പക്കവട/);
  assert.match(pakkEnq.replyText, /₹35/);
  assert.doesNotMatch(pakkEnq.replyText, /ഉള്ളിവട/);

  // Unavailable item in Manglish ("Neyyappam kittumo?")
  const neyEnq = processCustomerMessage(
    'Neyyappam kittumo?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(neyEnq.language, 'ml');
  assert.equal(neyEnq.handoffSuggested, true);
  assert.match(neyEnq.replyText, /നെയ്യപ്പം/);
  assert.match(neyEnq.replyText, /ലഭ്യമല്ല/);

  // General menu enquiry in Manglish ("Innu enthokke snacks und?")
  const menuEnq = processCustomerMessage(
    'Innu enthokke snacks und?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(menuEnq.language, 'ml');
  assert.match(menuEnq.replyText, /ഇന്നത്തെ പരീക്ഷണ മെനു/);
  assert.match(menuEnq.replyText, /ഉണ്ണിയപ്പം/);
  assert.match(menuEnq.replyText, /ഉള്ളിവട/);

  // Delivery, location, and timing enquiries in Manglish
  const deliveryEnq = processCustomerMessage(
    'Delivery undo?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(deliveryEnq.language, 'ml');
  assert.match(deliveryEnq.replyText, /ഡെലിവറി/);
  assert.match(deliveryEnq.replyText, /3 കി\.മീ/);

  const locEnq = processCustomerMessage(
    'Shop evideya?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(locEnq.language, 'ml');
  assert.match(locEnq.replyText, /Panankayam/);

  const timeEnq = processCustomerMessage(
    'Eppo thurakkum?',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(timeEnq.language, 'ml');
  assert.match(timeEnq.replyText, /പ്രവർത്തന സമയം/);

  // Manglish quantity + time parsing
  const manglishOrder = processCustomerMessage(
    '10 ennam ullivada naale vaikittu',
    EMPTY_ORDER_DRAFT,
    DEFAULT_MENU_ITEMS,
    DEFAULT_BUSINESS_CONFIG,
    DEFAULT_DEMO_ORDERS
  );
  assert.equal(manglishOrder.language, 'ml');
  assert.equal(manglishOrder.calculation.totalPieces, 10);
  assert.equal(manglishOrder.calculation.subtotal, 100);
  assert.equal(manglishOrder.updatedDraft.requestedDateTime, 'naale vaikittu');
});

