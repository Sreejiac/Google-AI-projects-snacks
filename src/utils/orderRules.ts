import {
  BusinessConfig,
  FulfillmentType,
  Language,
  MenuItem,
  OrderCalculation,
  OrderDraft,
  OrderLineItem,
  SubmittedOrder,
  TeamDecision,
} from '../types/business';

export function detectLanguage(text: string, fallback: Language = 'en'): Language {
  const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
  if (hasMalayalam) return 'ml';
  const manglishHints =
    /\b(venam|mathi|aakku|und|undo|undoo|unda|kittumo|kittuo|kittuvo|ariyaan|chetta|chechi|naale|innu|vaikittu|vaikitt|ravile|uchakku|rathri|panankayam|pathar|ethra|ethraya|vila|ennam|entha|enthokke|evide|evideya|eppo|eppozha|aayo|enthaayi|enthayi|thurakkum|samayam|sthalam|ullath|labhyamano|aano|samsarikkanam|tharumo|parayoo)\b/i;
  if (manglishHints.test(text)) return 'ml';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return fallback;
}

export function calculateOrderTotals(
  draftItems: { itemId: string; quantity: number }[],
  menu: MenuItem[],
  config: BusinessConfig,
  fulfillment: FulfillmentType | null,
  draftContext?: Pick<OrderDraft, 'outsideDeliveryAreaFlag' | 'requestedDateTime' | 'customerName' | 'contact' | 'deliveryAddress' | 'landmark' | 'orderCategory'>
): OrderCalculation {
  const lines: OrderLineItem[] = [];
  let totalPieces = 0;
  let subtotalSum = 0;
  let hasMissingPrice = false;
  let hasUnverifiedPrice = false;
  let hasUnavailableOrUnknownItem = false;
  const warnings: string[] = [];

  for (const entry of draftItems) {
    if (entry.quantity <= 0) continue;
    const item = menu.find((m) => m.id === entry.itemId);
    if (!item) continue;

    totalPieces += entry.quantity;
    if (!item.priceVerified) hasUnverifiedPrice = true;

    if (item.availability === 'unavailable') {
      hasUnavailableOrUnknownItem = true;
      warnings.push(`${item.nameEn} is currently marked unavailable.`);
    } else if (item.availability === 'unknown') {
      hasUnavailableOrUnknownItem = true;
      warnings.push(`${item.nameEn} availability has not been entered today — team check required.`);
    }

    if (item.remainingStock !== null && item.availability === 'available' && entry.quantity > item.remainingStock) {
      warnings.push(
        `Requested ${entry.quantity} ${item.nameEn} exceeds remaining daily stock (${item.remainingStock}) — team review required.`
      );
    }

    if (item.orderAheadOnly) {
      warnings.push(`${item.nameEn} is order-ahead only and fried close to delivery.`);
    }

    let lineTotal: number | null = null;
    if (item.price === null || Number.isNaN(item.price)) {
      hasMissingPrice = true;
      warnings.push(`Price for ${item.nameEn} is not configured — team must verify.`);
    } else {
      lineTotal = item.price * entry.quantity;
      subtotalSum += lineTotal;
    }

    lines.push({
      itemId: item.id,
      nameEn: item.nameEn,
      nameMl: item.nameMl,
      unitEn: item.unitEn,
      quantity: entry.quantity,
      unitPrice: item.price,
      lineTotal,
      availabilityAtOrder: item.availability,
    });
  }

  const subtotal = hasMissingPrice ? null : subtotalSum;
  const deliveryFee =
    fulfillment === 'delivery' && config.deliveryFee !== null ? config.deliveryFee : null;

  if (fulfillment === 'delivery' && config.deliveryFee === null) {
    warnings.push('Delivery fee is not configured yet — team will check and confirm.');
  }

  if (!config.openingHours.trim()) {
    warnings.push('Opening hours are not configured yet — team must verify timing.');
  }

  const total =
    subtotal === null ? null : subtotal + (deliveryFee !== null ? deliveryFee : 0);

  const meetsMinimumHomeOrder =
    totalPieces >= config.minHomePieces || (subtotal !== null && subtotal >= config.minHomeAmount);

  const isBulkOrder =
    draftContext?.orderCategory === 'bulk_event' || totalPieces >= config.bulkMinPieces;

  if (lines.length > 0 && !isBulkOrder && !meetsMinimumHomeOrder) {
    warnings.push(
      `Below trial minimum home order (${config.minHomePieces} pieces or ₹${config.minHomeAmount}) — team review required.`
    );
  }

  if (isBulkOrder && totalPieces > config.bulkMaxPieces) {
    warnings.push(
      `Quantity (${totalPieces}) exceeds standard bulk guideline (${config.bulkMinPieces}–${config.bulkMaxPieces} pieces) — team review required.`
    );
  }

  const missingFields: string[] = [];
  if (lines.length === 0) missingFields.push('Snack and quantity');
  if (!draftContext?.customerName?.trim()) missingFields.push('Customer name');
  if (!draftContext?.contact?.trim()) missingFields.push('Phone or contact method');
  if (!draftContext?.requestedDateTime?.trim()) missingFields.push('Requested date and time');
  if (!fulfillment) missingFields.push('Pickup or delivery');
  if (fulfillment === 'delivery') {
    if (!draftContext?.deliveryAddress?.trim()) missingFields.push('Delivery address');
    if (!draftContext?.landmark?.trim()) missingFields.push('Nearby landmark');
  }

  return {
    lines,
    totalPieces,
    subtotal,
    deliveryFee,
    total,
    hasMissingPrice,
    hasUnverifiedPrice,
    hasUnavailableOrUnknownItem,
    meetsMinimumHomeOrder,
    isBulkOrder,
    missingFields,
    warnings,
  };
}

export function detectOutsideDeliveryArea(text: string, radiusKm: number): boolean {
  const distMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:km|k\.m\.|കി\.?മീ|കിലോമീറ്റർ)/i);
  if (distMatch) {
    const km = parseFloat(distMatch[1]);
    if (!Number.isNaN(km) && km > radiusKm) return true;
  }

  const outsidePatterns = [
    /\b(outside|beyond|far from|out of)\b.*\b(3\s*km|area|radius|delivery)\b/i,
    /\b(nilambur|edakkara|chungathara|karulai|vazhikkadavu|wandoor|manjeri|kalikavu|moothedam|perinthalmanna|malappuram)\b/i,
    /(നിലമ്പൂർ|എടക്കര|ചുങ്കത്തറ|കരുളായി|വഴിക്കടവ്|വണ്ടൂർ|മഞ്ചേരി|കാളികാവ്|പുറത്താണ്|ദൂരെയാണ്)/,
  ];

  return outsidePatterns.some((re) => re.test(text));
}

const EXTRA_ITEM_ALIASES: Record<string, string[]> = {
  unniyappam: ['unniyappam', 'unniappam', 'unniyappm', 'unni', 'ഉണ്ണിയപ്പം', 'ഉണ്ണിയപ്പ', 'ഉണ്ണി'],
  ullivada: [
    'ullivada',
    'ulli vada',
    'ulivada',
    'ullivoda',
    'ulli',
    'onion fritter',
    'onion vada',
    'ഉള്ളിവട',
    'ഉള്ളി വട',
    'വട',
  ],
  neyyappam: ['neyyappam', 'neyappam', 'neyyappm', 'neyyapp', 'നെയ്യപ്പം', 'നെയ്യപ്പ'],
  pazham_pori: [
    'pazham pori',
    'pazhampori',
    'pazampori',
    'pazhampory',
    'banana fry',
    'ethakka appam',
    'ethakkappam',
    'പഴംപൊരി',
    'പഴം പൊരി',
    'ഏത്തക്ക അപ്പം',
    'ഏത്തക്കാപ്പം',
  ],
  pakkavada: [
    'pakkavada',
    'pakavada',
    'pakkavoda',
    'pakoda',
    'ribbon murukku',
    'പക്കവട',
    'പക്കാവട',
    'പക്കോട',
  ],
};

function getItemAliases(item: MenuItem): string[] {
  const extra = EXTRA_ITEM_ALIASES[item.id] ?? [];
  return Array.from(new Set([...item.aliases, ...extra]));
}

function buildAliasPattern(alias: string): string {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/[\u0D00-\u0D7F]/.test(alias)) {
    return `(?<![\\u0D00-\\u0D7F])${escaped}`;
  }
  return `\\b${escaped}s?\\b`;
}

function matchesItemAlias(text: string, alias: string): boolean {
  const re = new RegExp(buildAliasPattern(alias), 'i');
  return re.test(text);
}

function parseQuantityItems(text: string, menu: MenuItem[]): { itemId: string; quantity: number }[] {
  const found: { itemId: string; quantity: number }[] = [];

  for (const item of menu) {
    const aliases = getItemAliases(item);
    const aliasGroup = aliases.map(buildAliasPattern).join('|');

    const beforeQty = new RegExp(
      `(\\d+)\\s*(?:pcs|pieces?|packs?|pack|ennam|nos?|pkts?|packets?|എണ്ണം|പായ്ക്ക്)?\\s*(?:of\\s+)?(?:${aliasGroup})`,
      'i'
    );
    const afterQty = new RegExp(`(?:${aliasGroup})\\s*(?:-|to|:|=|x)?\\s*(\\d+)`, 'i');

    const m1 = text.match(beforeQty);
    const m2 = text.match(afterQty);

    if (m1) {
      const qty = parseInt(m1[1], 10);
      if (qty > 0) found.push({ itemId: item.id, quantity: qty });
    } else if (m2) {
      const qty = parseInt(m2[1], 10);
      if (qty > 0) found.push({ itemId: item.id, quantity: qty });
    } else {
      const mentionsName = aliases.some((alias) => matchesItemAlias(text, alias));
      if (mentionsName) {
        const standaloneNum = text.match(/\b(\d{1,3})\b/);
        const mentionedCount = menu.filter((m) =>
          getItemAliases(m).some((a) => matchesItemAlias(text, a))
        ).length;
        if (standaloneNum && mentionedCount === 1) {
          const qty = parseInt(standaloneNum[1], 10);
          if (qty > 0 && qty < 1000) {
            found.push({ itemId: item.id, quantity: qty });
          }
        } else {
          found.push({ itemId: item.id, quantity: 0 });
        }
      }
    }
  }

  return found;
}

function extractPhoneOrContact(text: string): string | null {
  const phoneMatch = text.match(/(?:\+91[\s-]?)?([6-9]\d{4}[\s-]?\d{5}|\d{10})/);
  if (phoneMatch) return phoneMatch[0].trim();
  const whatsappMatch = text.match(/whatsapp\s*[:\-]?\s*([+\d\s-]{8,15})/i);
  if (whatsappMatch) return `WhatsApp ${whatsappMatch[1].trim()}`;
  return null;
}

function extractDateTime(text: string): string | null {
  const patterns = [
    /(നാളെ\s*(?:രാവിലെ|ഉച്ചയ്ക്ക്|വൈകിട്ട്|രാത്രി)?(?:\s*\d{1,2}(?::\d{2})?\s*(?:മണിക്ക്|am|pm)?)?)/i,
    /(ഇന്ന്\s*(?:രാവിലെ|ഉച്ചയ്ക്ക്|വൈകിട്ട്|രാത്രി)?(?:\s*\d{1,2}(?::\d{2})?\s*(?:മണിക്ക്|am|pm)?)?)/i,
    /\b((?:naale|innu|matte\s*naal|mattannal)(?:\s+(?:ravile|uchakku|vaikittu|vaikitt|rathri|morning|afternoon|evening|night))?(?:\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|mani|manikku)?)?)\b/i,
    /((?:today|tomorrow|day after tomorrow|tonight|this evening|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^,.]*?(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening|night)?)/i,
    /(\d{1,2}[:.]\d{2}\s*(?:am|pm)|\d{1,2}\s*(?:am|pm))/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      return m[1].trim();
    }
  }
  return null;
}

function extractName(text: string, allowStandalone: boolean = false): string | null {
  const labeled = text.match(/(?:name|പേര്)\s*[:\-is]+\s*([^\n,0-9]{2,40})/i);
  if (labeled) return labeled[1].trim();

  const segments = text.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  // If there's only one plain segment with no commas, only treat it as a name when we're actively collecting order info
  if (segments.length <= 1 && !allowStandalone) {
    return null;
  }

  for (const seg of segments) {
    const words = seg.split(/\s+/).filter(Boolean);
    if (
      seg.length >= 2 &&
      seg.length <= 28 &&
      words.length <= 3 &&
      !/\d/.test(seg) &&
      !/[?？!]/.test(seg) &&
      !/(ആണോ|ഉണ്ടോ|വേണോ|വേണം|മതിയോ|കഴിയുമോ|പറ്റുമോ|കിട്ടുമോ|കിട്ടുവോ|തരുമോ|തരൂ|പറയൂ|ചെയ്യാം|ചെയ്യണം|എത്ര|എത്രയാ|എവിടെ|എവിടെയാ|എപ്പോൾ|എന്താണ്|എന്തൊക്കെ|എങ്ങനെ|ആണ്|അല്ല|ഉണ്ട്|ഇല്ല|വില|റേറ്റ്|സമയം|ചാർജ്|മിനിമം|സുഖമാണോ)$/.test(seg) &&
      !/\b(und|undo|undoo|unda|kittumo|kittuo|kittuvo|aano|aayo|ethra|ethraya|vila|evide|evideya|eppo|eppozha|entha|enthokke|thurakkum|samayam|sthalam|venam|mathi|tharumo|parayoo|ennam|naale|innu|vaikittu|vaikitt|ravile|uchakku|rathri)\b/i.test(seg) &&
      !/(delivery|pickup|പിക്കപ്പ്|ഡെലിവറി|near|opp\.?|opposite|beside|behind|landmark|address|location|school|college|mosque|masjid|temple|church|bridge|junction|bus\s*stop|stand|hospital|post\s*office|madrasa|anganwadi|panchayat|road|street|colony|nagar|house|veedu|സമീപം|അടുത്ത്|അടുത്തായി|അരികെ|അരികിൽ|എതിരെ|മുൻവശം|മുന്നിൽ|പിന്നിൽ|പിറകിൽ|ചേർന്ന്|അടയാളം|വിലാസം|റോഡ്|സ്കൂൾ|സ്കൂളിന്|പാലം|പാലത്തിന്|പള്ളി|മസ്ജിദ്|അമ്പലം|ക്ഷേത്രം|മദ്രസ|അംഗൻവാടി|വായനശാല|പഞ്ചായത്ത്|ആശുപത്രി|കട|സ്റ്റോപ്പ്|കവല|ജംഗ്ഷൻ|unniyappam|ullivada|neyyappam|pazham|pakkavada|ഉണ്ണിയപ്പം|ഉള്ളിവട|നെയ്യപ്പം|പഴംപൊരി|പക്കവട|tomorrow|today|നാളെ|ഇന്ന്|evening|morning|വൈകിട്ട്|രാവിലെ|order|book|event|bulk|menu|person|talk|human|available|confirm|status|panankayam|pathar|hello|hi|hey|hai|namaskaram|thanks|thank you|thx|okay|ok|yes|no|price|rate|cost|how|what|when|where|open|hours|timing|fee|minimum|ഓർഡർ|ചെയ്യാം|മുഴുവൻ|മെനു|പരിപാടി|ബൾക്ക്|ലൊക്കേഷൻ|ടീമിനോട്|സംസാരിക്ക|ലഭ്യമാണോ|കൺഫേം|ഹായ്|ഹലോ|നമസ്കാരം|നന്ദി|ശരി|ഓക്കേ|വേണം|മതി|അതെ|അല്ല|വില|എത്ര|എവിടെ|എപ്പോൾ|എന്താണ്|എന്തൊക്കെ|സമയം|തുറക്കുമോ)/i.test(seg)
    ) {
      return seg;
    }
  }
  return null;
}

const LANDMARK_EN_NOUNS =
  /\b(school|college|mosque|masjid|temple|church|bridge|junction|bus\s*stop|bus\s*stand|stand|hospital|clinic|bank|post\s*office|library|store|shop|petrol\s*pump|pump|madrasa|anganwadi|panchayat|ground|gate|tower)\b/i;
const LANDMARK_ML_KEYWORDS =
  /(സമീപം|അടുത്ത്|നടുത്ത്|ക്കടുത്ത്|അടുത്തായി|നടുത്തായി|അരികെ|നരികെ|ക്കരികെ|അരികിൽ|നരികിൽ|ക്കരികിൽ|എതിരെ|മുൻവശം|മുന്നിൽ|പിന്നിൽ|പിറകിൽ|ചേർന്ന്|അടയാളം|കവല|ജംഗ്ഷൻ|സ്റ്റോപ്പ്|പാലം|പാലത്തിന്|സ്കൂൾ|സ്കൂളിന്|പള്ളി|മസ്ജിദ്|അമ്പലം|ക്ഷേത്രം|മദ്രസ|അംഗൻവാടി|വായനശാല|പഞ്ചായത്ത്|ആശുപത്രി|പോസ്റ്റ് ഓഫീസ്|കട|വളവ്)/;

function extractAddressAndLandmark(
  text: string,
  context?: {
    fulfillment: FulfillmentType | null;
    hasAddress: boolean;
    hasLandmark: boolean;
    hasCustomerName: boolean;
  }
): { address: string | null; landmark: string | null } {
  let address: string | null = null;
  let landmark: string | null = null;

  const explicitLandmarkMatch = text.match(/(?:landmark|അടയാളം)\s*[:\-]\s*([^\n,]{2,60})/i);
  const landmarkEnMatch = text.match(/(?:near|opp\.?|opposite|beside|behind|next to|close to|in front of|landmark)\s*[:\-]?\s*([^,\n.]{2,60})/i);
  const landmarkMlMatch = text.match(/([^,\n.]{2,60}(?:സമീപം|അടുത്ത്|നടുത്ത്|ക്കടുത്ത്|അടുത്തായി|നടുത്തായി|അരികെ|നരികെ|ക്കരികെ|അരികിൽ|നരികിൽ|ക്കരികിൽ|എതിരെ|മുൻവശം|മുന്നിൽ|പിന്നിൽ|പിറകിൽ|ചേർന്ന്))/);

  if (explicitLandmarkMatch) {
    landmark = explicitLandmarkMatch[1].trim();
  } else if (landmarkEnMatch) {
    landmark = landmarkEnMatch[0].trim();
  } else if (landmarkMlMatch) {
    landmark = landmarkMlMatch[1].trim();
  } else {
    const segments = text.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    const nounSeg = segments.find(
      (s) => LANDMARK_EN_NOUNS.test(s) || LANDMARK_ML_KEYWORDS.test(s)
    );
    if (nounSeg) {
      landmark = nounSeg;
    }
  }

  const addrMatch = text.match(/(?:address|location|വിലാസം)\s*[:\-]\s*([^\n]+)/i);
  if (addrMatch) {
    address = addrMatch[1].trim();
  } else {
    const segments = text.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    const placeSegs = segments.filter((s) =>
      /(road|nagar|colony|junction|angadi|house|veedu|school|masjid|temple|church|bridge|stop|stand|panchayat|pathar|panankayam|nilambur|edakkara|chungathara|km|റോഡ്|സ്കൂൾ|സ്കൂളിന്|സമീപം|അടുത്ത്|നടുത്ത്|ക്കടുത്ത്|അരികെ|നരികെ|ക്കരികെ|അരികിൽ|നരികിൽ|എതിരെ|മുന്നിൽ|പിന്നിൽ|പാലം|പാലത്തിന്|പാലത്തിനരികെ|പള്ളി|മസ്ജിദ്|അമ്പലം|ക്ഷേത്രം|മദ്രസ|വായനശാല|വീട്|നഗർ|പനങ്കയം|പാത്താർ|കവല|ജംഗ്ഷൻ)/i.test(s)
    );
    if (placeSegs.length > 0) {
      address = placeSegs.join(', ');
    }
  }

  // Contextual fallback when delivery address or landmark is missing and user sends a local place/shop name
  const cleanedPlace = text
    .replace(/(?:\+91[\s-]?)?(?:[6-9]\d{4}[\s-]?\d{5}|\d{10})/g, '')
    .replace(/\b(delivery|pickup|home delivery)\b/gi, '')
    .replace(/(ഡെലിവറി|പിക്കപ്പ്|അടയാളം\s*[:\-]?|വിലാസം\s*[:\-]?)/g, '')
    .trim()
    .replace(/^[,.\-:\s]+|[,.\-:\s]+$/g, '');
  const isGreetingOrCommand =
    /^(hi|hello|hey|ok|okay|yes|no|ഹലോ|നമസ്കാരം|ശരി|മതി|വേണ്ട|അതെ|അല്ല|ഇല്ല)$/i.test(cleanedPlace);
  const hasOnlyTime = Boolean(extractDateTime(cleanedPlace)) && cleanedPlace.length < 24;

  if (
    !address &&
    context?.fulfillment === 'delivery' &&
    !context.hasAddress &&
    context.hasCustomerName &&
    cleanedPlace.length >= 2 &&
    cleanedPlace.length <= 100 &&
    !isGreetingOrCommand &&
    !hasOnlyTime
  ) {
    address = cleanedPlace;
    const parts = cleanedPlace.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!landmark && parts.length >= 2) {
      landmark = parts[parts.length - 1];
    }
  }

  // Contextual fallback: when delivery address is already provided and only landmark is still missing,
  // accept the user's descriptive reply (even if it's a local shop/house/place name without "near"/"സമീപം").
  if (!landmark && context?.fulfillment === 'delivery' && context.hasAddress && !context.hasLandmark) {
    if (cleanedPlace.length >= 2 && cleanedPlace.length <= 80 && !isGreetingOrCommand && !hasOnlyTime) {
      landmark = cleanedPlace;
    }
  }

  // If user gave a landmark phrase when delivery address wasn't filled yet, also use it as address if address is still null
  if (landmark && !address && context?.fulfillment === 'delivery' && !context.hasAddress) {
    address = landmark;
  }

  return { address, landmark };
}

export interface AssistantTurnResult {
  replyText: string;
  language: Language;
  updatedDraft: OrderDraft;
  calculation: OrderCalculation;
  handoffSuggested: boolean;
  handoffReason: string | null;
  showSummaryCard: boolean;
  canSubmitReview: boolean;
  quickReplies: { label: string; value: string }[];
}

export function formatItemizedSummaryText(
  draft: OrderDraft,
  calc: OrderCalculation,
  config: BusinessConfig,
  lang: Language
): string {
  const linesText = calc.lines
    .map((l) => {
      const name = lang === 'ml' ? l.nameMl : l.nameEn;
      const priceLabel =
        l.unitPrice !== null && l.lineTotal !== null
          ? `₹${l.unitPrice} × ${l.quantity} = ₹${l.lineTotal}`
          : lang === 'ml'
            ? `${l.quantity} എണ്ണം (വില ടീം പരിശോധിക്കും)`
            : `${l.quantity} (price needs team check)`;
      return `• ${name}: ${priceLabel}`;
    })
    .join('\n');

  const subtotalLine =
    calc.subtotal !== null
      ? `${lang === 'ml' ? 'ആകെ തുക' : 'Subtotal'}: ₹${calc.subtotal}`
      : `${lang === 'ml' ? 'ആകെ തുക' : 'Subtotal'}: ${lang === 'ml' ? 'ടീം സ്ഥിരീകരിക്കേണ്ടതുണ്ട്' : 'Needs team verification'}`;

  const deliveryLine =
    draft.fulfillment === 'delivery'
      ? config.deliveryFee !== null
        ? `${lang === 'ml' ? 'ഡെലിവറി ചാർജ്' : 'Delivery fee'}: ₹${config.deliveryFee}`
        : `${lang === 'ml' ? 'ഡെലിവറി ചാർജ്' : 'Delivery fee'}: ${lang === 'ml' ? 'നിശ്ചയിച്ചിട്ടില്ല (ടീം പരിശോധിക്കും)' : 'Not configured — team will check'}`
      : `${lang === 'ml' ? 'രീതി' : 'Fulfillment'}: ${lang === 'ml' ? 'നേരിട്ട് പിക്കപ്പ്' : 'Pickup'}`;

  const totalLine =
    calc.total !== null
      ? `${lang === 'ml' ? 'കണക്കാക്കിയ ആകെ തുക' : 'Estimated Total'}: ₹${calc.total}`
      : `${lang === 'ml' ? 'ആകെ തുക' : 'Total'}: ${lang === 'ml' ? 'ടീം പരിശോധിച്ച ശേഷം അറിയിക്കും' : 'Pending team pricing check'}`;

  const trialNote =
    lang === 'ml'
      ? 'ശ്രദ്ധിക്കുക: ഇവ പ്രാരംഭ നിരക്കുകളും നിയമങ്ങളുമാണ്. ഓർഡർ കൺഫേം ആകുന്നതിന് മുമ്പ് ടീം ലഭ്യത പരിശോധിക്കും.'
      : 'Note: Listed prices and rules are trial assumptions. This request is not confirmed until reviewed by the team.';

  return `${linesText}\n\n${subtotalLine}\n${deliveryLine}\n${totalLine}\n\n${trialNote}`;
}

export function processCustomerMessage(
  rawInput: string,
  currentDraft: OrderDraft,
  menu: MenuItem[],
  config: BusinessConfig,
  orders: SubmittedOrder[],
  preferredLanguage?: Language
): AssistantTurnResult {
  const input = rawInput.trim();
  const lang: Language =
    preferredLanguage === 'ml'
      ? 'ml'
      : detectLanguage(input, currentDraft.language);
  const draft: OrderDraft = {
    ...currentDraft,
    language: lang,
    items: currentDraft.items.map((i) => ({ ...i })),
    handoffReasons: [...currentDraft.handoffReasons],
  };

  const lower = input.toLowerCase();
  let handoffReason: string | null = null;
  let handoffSuggested = false;

  // 1. Check status query ("Is my order confirmed?", "Order confirm aayo?")
  if (
    /(confirm|confirmed|status|accepted|booked|ready|aayo|enthaayi|enthayi|കൺഫേം|സ്ഥിരീകരി|സ്റ്റാറ്റസ്|ആയോ|എന്തായി|അംഗീകരിച്ചോ)/i.test(input) &&
    !/(place|submit|want|വേണം|book for)/i.test(input) &&
    parseQuantityItems(input, menu).length === 0
  ) {
    const latestOrder = orders[0];
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    if (!latestOrder) {
      const text =
        lang === 'ml'
          ? 'ഇതുവരെ സമർപ്പിച്ച ഓർഡറുകളൊന്നും ഇല്ല. ഇപ്പോൾ കാണുന്നത് കരട് (Draft) മാത്രമാണ് — ടീം പരിശോധനയ്ക്കായി സമർപ്പിച്ചാലേ അവലോകനം ചെയ്യൂ.'
          : 'You do not have a submitted order request yet. Any items currently selected are only a Draft and have not been sent to the team.';
      return {
        replyText: text,
        language: lang,
        updatedDraft: draft,
        calculation: calc,
        handoffSuggested: false,
        handoffReason: null,
        showSummaryCard: calc.lines.length > 0,
        canSubmitReview: false,
        quickReplies: [
          { label: lang === 'ml' ? 'മെനു കാണുക' : 'See today’s menu', value: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu' },
          { label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person', value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person' },
        ],
      };
    }

    let statusReply = '';
    if (latestOrder.status === 'Submitted for review') {
      statusReply =
        lang === 'ml'
          ? `നിങ്ങളുടെ ഓർഡർ (${latestOrder.orderId}) ഇപ്പോൾ "Submitted for review" (ടീം പരിശോധനയ്ക്ക് സമർപ്പിച്ചു) എന്ന നിലയിലാണ്. ഇത് ഇതുവരെ കൺഫേം ചെയ്തിട്ടില്ല. ലഭ്യത പരിശോധിച്ച ശേഷം ടീം അംഗം നിങ്ങളെ അറിയിക്കും.`
          : `Order ${latestOrder.orderId} is currently "${latestOrder.status}". It is not confirmed yet — a team member must check availability and accept it first.`;
    } else if (latestOrder.status === 'Accepted by team') {
      statusReply = buildTeamOrderUpdateMessage(
        latestOrder.orderId,
        'accepted',
        latestOrder.teamNotes,
        lang
      );
    } else if (latestOrder.status === 'Declined or needs follow-up') {
      const dec: TeamDecision =
        latestOrder.teamDecision === 'rejected' ? 'rejected' : 'needs_followup';
      statusReply = buildTeamOrderUpdateMessage(
        latestOrder.orderId,
        dec,
        latestOrder.teamNotes,
        lang
      );
    } else {
      statusReply =
        lang === 'ml'
          ? `ഓർഡർ ${latestOrder.orderId} നിലവിൽ "${latestOrder.status}" എന്ന നിലയിലാണ്.`
          : `Order ${latestOrder.orderId} is currently "${latestOrder.status}".`;
    }

    return {
      replyText: statusReply,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: latestOrder.status === 'Declined or needs follow-up',
      handoffReason: latestOrder.handoffReason,
      showSummaryCard: false,
      canSubmitReview: false,
      quickReplies: [
        { label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person', value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person' },
        { label: lang === 'ml' ? 'പുതിയ ഓർഡർ' : 'Place an order', value: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order' },
      ],
    };
  }

  // 2. Check explicit human handoff / allergy / discount / shop supply / complaint
  if (/(talk to a person|human|speak to someone|call me|call cheyyamo|samsarikkanam|your (?:phone|contact) number|owner|person|ഒരാളോട്|ടീമിനോട് സംസാരി|ആളോട്|വിളിക്കാമോ|നമ്പർ തരുമോ)/i.test(input)) {
    handoffSuggested = true;
    handoffReason = 'Customer requested to talk to a person';
    if (!draft.handoffReasons.includes(handoffReason)) draft.handoffReasons.push(handoffReason);
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    return {
      replyText:
        lang === 'ml'
          ? 'തീർച്ചയായും! ഞാൻ നിങ്ങളുടെ ചോദ്യവും വിവരങ്ങളും ടീമിന് കൈമാറാം. ദയവായി നിങ്ങളുടെ പേരും ഫോൺ നമ്പറും നൽകാമോ? ടീമിൽ നിന്ന് ഒരാൾ നേരിട്ട് ബന്ധപ്പെടുന്നതാണ്.'
          : 'Of course — I can route your request straight to our team. Please share your name, phone number, and what you need help with so a team member can follow up.',
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: true,
      handoffReason,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: Boolean(draft.customerName && draft.contact),
      quickReplies: [
        { label: lang === 'ml' ? 'മെനു കാണുക' : 'See today’s menu', value: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu' },
      ],
    };
  }

  if (/(allerg|peanut|nut|gluten|dairy|milk|egg|oil|freshness|fssai|licen|safety|ingredient|അലർജി|എണ്ണ|ചേരുവ)/i.test(input)) {
    handoffSuggested = true;
    handoffReason = 'Ingredient, allergen, or food-safety question — requires team verification';
    if (!draft.handoffReasons.includes(handoffReason)) draft.handoffReasons.push(handoffReason);
    draft.specialNotes = [draft.specialNotes, input].filter(Boolean).join(' | ');
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    return {
      replyText:
        lang === 'ml'
          ? 'ചേരുവകൾ, അലർജി, ഭക്ഷ്യസുരക്ഷ എന്നിവയെക്കുറിച്ച് ഞങ്ങൾക്ക് സ്വയം ഉറപ്പ് നൽകാൻ കഴിയില്ല. നിങ്ങളുടെ ചോദ്യം ഞാൻ കുറിച്ചെടുത്തിട്ടുണ്ട് — ടീം നേരിട്ട് പരിശോധിച്ച് മറുപടി നൽകും. ദയവായി പേരും ഫോൺ നമ്പറും നൽകുക.'
          : 'I cannot make allergen, ingredient, or food-safety guarantees automatically. I have noted your question for the team to verify directly. Please share your name and contact number so we can send this for human review.',
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: true,
      handoffReason,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: Boolean(draft.customerName && draft.contact),
      quickReplies: [],
    };
  }

  if (/(discount|special price|less price|cheap|bargain|refund|complaint|damaged|custom item|വില കുറ|ഡിസ്കൗണ്ട്|പരാതി)/i.test(input)) {
    handoffSuggested = true;
    handoffReason = 'Special price, custom request, or complaint — human review required';
    if (!draft.handoffReasons.includes(handoffReason)) draft.handoffReasons.push(handoffReason);
    draft.specialNotes = [draft.specialNotes, input].filter(Boolean).join(' | ');
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    return {
      replyText:
        lang === 'ml'
          ? 'പ്രത്യേക വില, ഡിസ്കൗണ്ട്, അല്ലെങ്കിൽ കസ്റ്റം അഭ്യർത്ഥനകൾ ടീം നേരിട്ട് പരിശോധിക്കേണ്ടതാണ്. നിങ്ങളുടെ വിവരങ്ങൾ ടീമിന് കൈമാറാം — ദയവായി പേരും ഫോൺ നമ്പറും പങ്കിടുക.'
          : 'Special pricing, discounts, custom items, or complaints need direct team review. I have noted your request — please share your name and contact number so a person can follow up.',
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: true,
      handoffReason,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: Boolean(draft.customerName && draft.contact),
      quickReplies: [],
    };
  }

  if (/(shop supply|for my shop|for a shop|tea shop|bakery|wholesale|കടയിലേ|കടക്ക്)/i.test(input)) {
    const mentionsPakkavada = menu
      .find((m) => m.id === 'pakkavada')
      ?.aliases.some((a) => lower.includes(a.toLowerCase()) || input.includes(a));
    handoffSuggested = true;
    handoffReason = mentionsPakkavada
      ? 'Shop supply inquiry mentioning Pakkavada (home sales only)'
      : 'Shop supply inquiry — requires team review';
    if (!draft.handoffReasons.includes(handoffReason)) draft.handoffReasons.push(handoffReason);
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    return {
      replyText:
        lang === 'ml'
          ? 'പക്കവട വീടുകളിലേക്കുള്ള വിൽപ്പനയ്ക്ക് മാത്രമാണ് (കടകൾക്ക് നൽകുന്നില്ല). ഉണ്ണിയപ്പം, ഉള്ളിവട തുടങ്ങിയവ കടകളിലേക്ക് നൽകുന്നതിനെക്കുറിച്ച് ടീം നേരിട്ട് സംസാരിക്കുന്നതാണ്. ദയവായി നിങ്ങളുടെ പേരും ഫോൺ നമ്പറും നൽകുക.'
          : 'Please note that Pakkavada is for home sales only and is not offered for shop supply. For shop supply enquiries on other snacks, please share your name and contact so our team can review and respond.',
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: true,
      handoffReason,
      showSummaryCard: false,
      canSubmitReview: Boolean(draft.customerName && draft.contact),
      quickReplies: [],
    };
  }

  const mentionedItemsPreCheck = parseQuantityItems(input, menu);

  // 3. See today's menu quick action & general "What snacks do you have?" enquiries in Malayalam/Manglish
  if (
    /^(see today.?s menu|menu|മെനു)$/i.test(input) ||
    /(show menu|today'?s menu|ഇന്നത്തെ മെനു)/i.test(input) ||
    (mentionedItemsPreCheck.length === 0 &&
      /(innu\s*(?:enthokke|entha|enthanu)|enthokke\s*(?:und|undo|ullath|snacks|items)|(?:entha|enthanu|ippo\s*entha)\s*(?:ullath|kittuka|kittum)|innathe\s*(?:snacks|special|palaharam)|what.*(?:snacks|available|items|do you have)|available\s*(?:today|now)|ഇന്ന്\s*(?:എന്തൊക്കെ|എന്താ|എന്താണ്)|എന്തൊക്കെ\s*(?:ഉണ്ട്|ഉണ്ടോ|ഉള്ളത്|പലഹാര)|എന്തൊക്കെയാ\s*ഉള്ളത്|എന്താണ്\s*ഉള്ളത്|ഇന്നത്തെ\s*(?:സ്പെഷ്യൽ|പലഹാര))/i.test(input))
  ) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    const menuLines = menu
      .map((m) => {
        const name = lang === 'ml' ? m.nameMl : m.nameEn;
        const priceStr =
          m.price !== null
            ? `₹${m.price}/${lang === 'ml' ? m.unitMl : m.unitEn}`
            : lang === 'ml'
              ? 'വില ടീം പരിശോധിക്കും'
              : 'Price TBC';
        const statusStr =
          m.availability === 'available'
            ? lang === 'ml' ? 'ലഭ്യം' : 'Available'
            : m.availability === 'unavailable'
              ? lang === 'ml' ? 'ഇപ്പോൾ ലഭ്യമല്ല' : 'Currently unavailable'
              : lang === 'ml' ? 'ടീമിനോട് ചോദിക്കുക' : 'Please check with team';
        return `• ${name} — ${priceStr} (${statusStr})`;
      })
      .join('\n');

    const hoursNote = config.openingHours.trim()
      ? `${lang === 'ml' ? 'പ്രവർത്തന സമയം' : 'Opening hours'}: ${config.openingHours}`
      : lang === 'ml'
        ? 'പ്രവർത്തന സമയം ഉടമ ഇതുവരെ നൽകിയിട്ടില്ല — ഓർഡർ സമർപ്പിക്കുമ്പോൾ ടീം പരിശോധിക്കും.'
        : 'Opening hours are not configured yet — our team will check timing on review.';

    return {
      replyText:
        (lang === 'ml'
          ? `ഇന്നത്തെ പരീക്ഷണ മെനു (പ്രാരംഭ നിരക്കുകൾ):\n${menuLines}\n\n${hoursNote}\n\nഏത് പലഹാരമാണ് വേണ്ടതെന്നും എത്ര എണ്ണമാണെന്നും പറയൂ.`
          : `Today’s trial menu (prices marked as trial assumptions):\n${menuLines}\n\n${hoursNote}\n\nTell me which snack and quantity you would like to request.`),
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        {
          label: lang === 'ml' ? '10 ഉണ്ണിയപ്പം നാളെ വൈകിട്ട്' : '10 Unniyappam tomorrow evening',
          value: lang === 'ml' ? '10 ഉണ്ണിയപ്പം വേണം നാളെ വൈകിട്ട്.' : '10 Unniyappam tomorrow evening',
        },
        {
          label: lang === 'ml' ? 'ഇവന്റ് / ബൾക്ക് ബുക്കിംഗ്' : 'Book for an event',
          value: lang === 'ml' ? 'പരിപാടിക്ക് ബൾക്ക് ഓർഡർ വേണം' : 'Book for an event',
        },
      ],
    };
  }

  // 3b. Location / Service Area quick action & Malayalam/Manglish "Where are you?" enquiries
  if (
    /^(location|ലൊക്കേഷൻ|panankayam 679334)$/i.test(input) ||
    /(where are you|delivery area|service area|(?:evide|evideya|evideyanu)\s*(?:sthalam|shop|kada|location|pickup)|(?:sthalam|shop|kada|pickup|location|ningal|ningalude)\s*(?:evide|evideya|evideyanu)|ലൊക്കേഷൻ|എവിടെയാണ്|സ്ഥലം\s*എവിടെ|കട\s*എവിടെ)/i.test(input)
  ) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    const hoursText = config.openingHours.trim()
      ? `${lang === 'ml' ? 'പ്രവർത്തന സമയം' : 'Opening hours'}: ${config.openingHours}`
      : lang === 'ml'
        ? 'പ്രവർത്തന സമയം ഉടമ ഇതുവരെ നൽകിയിട്ടില്ല — ഓർഡർ സമർപ്പിക്കുമ്പോൾ ടീം പരിശോധിക്കും.'
        : 'Opening hours are not configured yet — our team will confirm timing on review.';
    return {
      replyText:
        lang === 'ml'
          ? `സ്ഥലം: ${config.serviceArea}.\nഡെലിവറി: ഏകദേശം ${config.deliveryRadiusKm} കി.മീ. ചുറ്റളവിൽ (പരീക്ഷണ നിയമം — വിലാസവും ഡെലിവറിയും ടീം പരിശോധിച്ചേ സ്ഥിരീകരിക്കൂ).\n${hoursText}`
          : `Service area: ${config.serviceArea}.\nDelivery: Starting with an approximate ${config.deliveryRadiusKm} km trial radius — our team checks every address and delivery eligibility.\n${hoursText}`,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        { label: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order', value: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order' },
        { label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person', value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person' },
      ],
    };
  }

  // 3c. Greetings & simple acknowledgements (respond naturally instead of dumping missing fields)
  if (/^(hi+|hello+|hey+|hai+|namaskaram|good\s*(?:morning|afternoon|evening)|ഹായ്+|ഹലോ+|നമസ്കാരം|സുഖമാണോ)[!.\s,?]*$/i.test(input)) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    return {
      replyText:
        lang === 'ml'
          ? calc.lines.length > 0
            ? 'നമസ്കാരം! നിങ്ങളുടെ ഓർഡർ പൂർത്തിയാക്കാൻ ബാക്കി വിവരങ്ങൾ കൂടി പങ്കിടാമോ?'
            : 'നമസ്കാരം! പനങ്കയം ഹോംമെയ്ഡ് സ്നാക്സിലേക്ക് സ്വാഗതം. ഇന്നത്തെ പലഹാരങ്ങൾ കാണണോ അതോ ഓർഡർ നൽകണോ?'
          : calc.lines.length > 0
            ? 'Hello! Whenever you are ready, please share the remaining details to finish your order request.'
            : 'Hello! Welcome to Panankayam Homemade Snacks. Would you like to see today’s menu or start an order?',
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        { label: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu', value: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu' },
        { label: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order', value: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order' },
      ],
    };
  }

  if (/^(thanks|thank you|thx|ok|okay|fine|great|cool|bye|നന്ദി|ശരി|ഓക്കേ|നല്ലത്|ശരിയെന്നാൽ)[!.\s]*$/i.test(input)) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    return {
      replyText:
        lang === 'ml'
          ? calc.lines.length > 0 && calc.missingFields.length > 0
            ? 'ശരി! ബാക്കി വിവരങ്ങൾ ലഭിച്ചാലുടൻ ഓർഡർ സംഗ്രഹം തയ്യാറാക്കാം.'
            : 'സന്തോഷം! മറ്റെന്തെങ്കിലും ആവശ്യമുണ്ടെങ്കിൽ ചോദിക്കൂ.'
          : calc.lines.length > 0 && calc.missingFields.length > 0
            ? 'Got it! Just share the next detail whenever you are ready.'
            : 'You’re welcome! Let me know if you need anything else.',
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: calc.lines.length === 0
        ? [{ label: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu', value: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu' }]
        : [],
    };
  }

  // 3d. Specific questions: Opening hours, delivery/minimum rules, or snack prices (when no order qty is given)
  if (
    /(opening\s*hours|open\s*time|what time.*open|when.*open|timing|eppo\s*(?:thurakkum|open|kittum)|eppozha?\s*(?:open|thurakk)|samayam\s*(?:entha|eppo)|പ്രവർത്തന സമയം|എപ്പോൾ.*(?:തുറ|കിട്ടും)|തുറക്കുമോ|എത്ര മണി|സമയം എപ്പോഴാണ്|സമയം എന്താണ്)/i.test(input) &&
    mentionedItemsPreCheck.every((m) => m.quantity === 0)
  ) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    const hoursMsg = config.openingHours.trim()
      ? lang === 'ml'
        ? `പ്രവർത്തന സമയം: ${config.openingHours}${!config.openingHoursVerified ? ' (പരീക്ഷണ സമയം — ടീം സ്ഥിരീകരിക്കും)' : ''}.`
        : `Opening hours: ${config.openingHours}${!config.openingHoursVerified ? ' (trial setting — team will verify)' : ''}.`
      : lang === 'ml'
        ? 'പ്രവർത്തന സമയം ഉടമ ഇതുവരെ നൽകിയിട്ടില്ല. നിങ്ങൾക്ക് പലഹാരം വേണ്ട സമയവും ദിവസവും അറിയിച്ചാൽ ടീം പരിശോധിച്ച് മറുപടി നൽകും.'
        : 'Opening hours have not been configured by the owner yet. If you share your preferred date and time, our team will check availability.';
    return {
      replyText: hoursMsg,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        { label: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order', value: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order' },
        { label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person', value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person' },
      ],
    };
  }

  if (
    /(delivery\s*(?:fee|charge|undo|undoo|unda|und|kittumo|kittuo|available)|home\s*delivery\s*(?:undo|kittumo)|deliver\s*cheyyumo|minimum\s*order|min\s*order|cutoff|cut-off|ഡെലിവറി\s*(?:ചാർജ്|ഫീസ്|ഉണ്ടോ|കിട്ടുമോ|ചെയ്യുമോ)|മിനിമം ഓർഡർ|കുറഞ്ഞത് എത്ര|വീട്ടിൽ കൊണ്ടുവരുമോ)/i.test(input) &&
    mentionedItemsPreCheck.every((m) => m.quantity === 0)
  ) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    const feeTextMl = config.deliveryFee !== null ? `₹${config.deliveryFee}` : 'ഇതുവരെ നിശ്ചയിച്ചിട്ടില്ല (ടീം അറിയിക്കും)';
    const feeTextEn = config.deliveryFee !== null ? `₹${config.deliveryFee}` : 'not configured yet (team will check)';
    return {
      replyText:
        lang === 'ml'
          ? `പരീക്ഷണ നിയമങ്ങൾ:\n• ഡെലിവറി: ഏകദേശം ${config.deliveryRadiusKm} കി.മീ. ചുറ്റളവിൽ (${config.serviceArea}). ഡെലിവറി ചാർജ്: ${feeTextMl}.\n• കുറഞ്ഞ ഹോം ഓർഡർ: ${config.minHomePieces} എണ്ണം അല്ലെങ്കിൽ ₹${config.minHomeAmount}.\n• കട്ടോഫ്: തലേദിവസം വൈകിട്ട്.`
          : `Trial guidelines:\n• Delivery: ~${config.deliveryRadiusKm} km radius (${config.serviceArea}). Delivery fee: ${feeTextEn}.\n• Minimum home order: ${config.minHomePieces} pieces or ₹${config.minHomeAmount}.\n• Cutoff: Evening before.`,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        { label: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order', value: lang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order' },
      ],
    };
  }

  // Price / availability inquiry without quantity (e.g., "ഉണ്ണിയപ്പം വില എത്ര?", "Ullivada undo?", "Neyyappam kittumo?")
  const mentionedItemsNoQty = mentionedItemsPreCheck;
  const hasEnquiryIntent =
    /(price|rate|cost|how much|available|availability|stock|fresh|undo|undoo|unda|und|kittumo|kittuo|kittuvo|labhyamano|ethra|ethraya|vila|വില|എത്ര|എത്രയാ|റേറ്റ്|ഉണ്ടോ|ഉണ്ട്|ലഭ്യമാണോ|ലഭ്യം|കിട്ടുമോ|കിട്ടുവോ|റെഡിയാണോ|ബാക്കിയുണ്ടോ)/i.test(input) ||
    (mentionedItemsNoQty.length > 0 && /[?？]/.test(input));
  if (
    hasEnquiryIntent &&
    mentionedItemsNoQty.every((m) => m.quantity === 0)
  ) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    if (mentionedItemsNoQty.length > 0) {
      const itemDetails = mentionedItemsNoQty
        .map((m) => menu.find((x) => x.id === m.itemId))
        .filter((x): x is MenuItem => Boolean(x))
        .map((item) => {
          const name = lang === 'ml' ? item.nameMl : item.nameEn;
          const priceStr =
            item.price !== null
              ? `₹${item.price}/${lang === 'ml' ? item.unitMl : item.unitEn}`
              : lang === 'ml'
                ? 'വില ടീം പരിശോധിക്കും'
                : 'Price TBC';
          const availStr =
            item.availability === 'available'
              ? lang === 'ml'
                ? item.orderAheadOnly
                  ? 'ലഭ്യമാണ് · മുൻകൂർ ഓർഡർ മാത്രം'
                  : 'ലഭ്യമാണ്'
                : item.orderAheadOnly
                  ? 'Available · order-ahead only'
                  : 'Available'
              : item.availability === 'unavailable'
                ? lang === 'ml' ? 'ഇപ്പോൾ ലഭ്യമല്ല' : 'Currently unavailable'
                : lang === 'ml' ? 'ലഭ്യത ടീമിനോട് ചോദിക്കണം' : 'Please check availability with team';
          return `• ${name}: ${priceStr} (${availStr})`;
        })
        .join('\n');
      const hasUnavail = mentionedItemsNoQty.some((m) => menu.find((x) => x.id === m.itemId)?.availability !== 'available');
      const firstItem = menu.find((x) => x.id === mentionedItemsNoQty[0].itemId);
      const quickQty = firstItem?.id === 'pakkavada' ? 3 : 10;
      return {
        replyText:
          lang === 'ml'
            ? `${itemDetails}\n\n${hasUnavail ? 'വേണമെങ്കിൽ ലഭ്യമായ മറ്റൊരു പലഹാരം തിരഞ്ഞെടുക്കാം അല്ലെങ്കിൽ ടീമിനോട് സംസാരിക്കാം.' : 'എത്ര എണ്ണമാണ് വേണ്ടതെന്ന് പറയൂ?'}`
            : `${itemDetails}\n\n${hasUnavail ? 'You can choose another available snack or ask our team.' : 'How many would you like to order?'}`,
        language: lang,
        updatedDraft: draft,
        calculation: calc,
        handoffSuggested: hasUnavail,
        handoffReason: hasUnavail ? 'Asked about unavailable or unverified snack item' : null,
        showSummaryCard: calc.lines.length > 0,
        canSubmitReview: false,
        quickReplies: hasUnavail
          ? [
              { label: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu', value: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu' },
              { label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person', value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person' },
            ]
          : [
              {
                label: lang === 'ml' ? `${quickQty} ${firstItem?.unitMl || 'എണ്ണം'} വേണം` : `${quickQty} ${firstItem?.unitEn || 'pieces'}`,
                value: lang === 'ml' ? `${quickQty} ${firstItem?.nameMl || 'ഉണ്ണിയപ്പം'} വേണം` : `${quickQty} ${firstItem?.nameEn || 'Unniyappam'}`,
              },
            ],
      };
    }

    const activePrices = menu
      .filter((m) => m.availability !== 'unavailable')
      .map((m) => `• ${lang === 'ml' ? m.nameMl : m.nameEn}: ${m.price !== null ? `₹${m.price}/${lang === 'ml' ? m.unitMl : m.unitEn}` : 'TBC'}`)
      .join('\n');
    return {
      replyText:
        lang === 'ml'
          ? `ഇന്നത്തെ പ്രാരംഭ നിരക്കുകൾ:\n${activePrices}\n\nഏത് പലഹാരമാണ് വേണ്ടതെന്ന് പറയൂ?`
          : `Today’s trial prices:\n${activePrices}\n\nWhich snack would you like?`,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        { label: lang === 'ml' ? '10 ഉണ്ണിയപ്പം' : '10 Unniyappam', value: lang === 'ml' ? '10 ഉണ്ണിയപ്പം വേണം' : '10 Unniyappam' },
        { label: lang === 'ml' ? '10 ഉള്ളിവട' : '10 Ullivada', value: lang === 'ml' ? '10 ഉള്ളിവട വേണം' : '10 Ullivada' },
      ],
    };
  }

  // 3e. Explicit "Place an order" / "ഓർഡർ ചെയ്യാം" starter (ask step-by-step instead of dumping all 5 fields)
  if (/^(place an order|order now|start order|ഓർഡർ ചെയ്യാം|ഓർഡർ നൽകാം|ഓർഡർ)$/i.test(input)) {
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    if (calc.lines.length === 0) {
      return {
        replyText:
          lang === 'ml'
            ? 'തീർച്ചയായും! ഏത് പലഹാരമാണ് വേണ്ടതെന്നും എത്ര എണ്ണമാണെന്നും പറയൂ? (ഉദാ: 10 ഉണ്ണിയപ്പം നാളെ വൈകിട്ട്)'
            : 'Sure! Which snack and how many pieces would you like to order? (e.g., 10 Unniyappam tomorrow evening)',
        language: lang,
        updatedDraft: draft,
        calculation: calc,
        handoffSuggested: false,
        handoffReason: null,
        showSummaryCard: false,
        canSubmitReview: false,
        quickReplies: [
          { label: lang === 'ml' ? '10 ഉണ്ണിയപ്പം' : '10 Unniyappam', value: lang === 'ml' ? '10 ഉണ്ണിയപ്പം വേണം' : '10 Unniyappam' },
          { label: lang === 'ml' ? '10 ഉള്ളിവട' : '10 Ullivada', value: lang === 'ml' ? '10 ഉള്ളിവട വേണം' : '10 Ullivada' },
          { label: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu', value: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu' },
        ],
      };
    }
  }

  // 4. Bulk / Event booking intent
  if (/(book for an event|event|bulk|function|party|wedding|ചടങ്ങ്|ബൾക്ക്|ഇവന്റ്)/i.test(input)) {
    draft.orderCategory = 'bulk_event';
  }

  // 5. Removal / change intent
  const isReplaceOrChange = /(change|update|make it|instead|replace|modify|ആക്കൂ|മാറ്റ|പകരം)/i.test(input);
  const isRemove = /(remove|cancel|delete|വേണ്ട|ഒഴിവാക്ക)/i.test(input);

  const parsedItems = parseQuantityItems(input, menu);
  const unavailableMessages: string[] = [];
  const unknownMessages: string[] = [];

  if (parsedItems.length > 0) {
    for (const pi of parsedItems) {
      const menuItem = menu.find((m) => m.id === pi.itemId);
      if (!menuItem) continue;

      if (isRemove && pi.quantity === 0) {
        draft.items = draft.items.filter((i) => i.itemId !== pi.itemId);
        continue;
      }

      if (menuItem.availability === 'unavailable') {
        unavailableMessages.push(lang === 'ml' ? menuItem.nameMl : menuItem.nameEn);
        continue;
      }

      if (menuItem.availability === 'unknown') {
        unknownMessages.push(lang === 'ml' ? menuItem.nameMl : menuItem.nameEn);
        handoffSuggested = true;
        handoffReason = `Availability of ${menuItem.nameEn} not entered — team check required`;
        if (!draft.handoffReasons.includes(handoffReason)) draft.handoffReasons.push(handoffReason);
      }

      if (pi.quantity > 0) {
        if (pi.quantity >= config.bulkMinPieces) {
          draft.orderCategory = 'bulk_event';
        }
        const existing = draft.items.find((i) => i.itemId === pi.itemId);
        if (existing) {
          existing.quantity = pi.quantity;
        } else if (isReplaceOrChange && draft.items.length === 1 && parsedItems.length === 1) {
          draft.items = [{ itemId: pi.itemId, quantity: pi.quantity }];
        } else {
          draft.items.push({ itemId: pi.itemId, quantity: pi.quantity });
        }
        draft.summaryReviewed = false;
      }
    }
  } else if (isReplaceOrChange) {
    const qtyOnly = input.match(/\b(\d{1,3})\b/);
    if (qtyOnly && draft.items.length === 1) {
      const newQty = parseInt(qtyOnly[1], 10);
      if (newQty > 0) {
        draft.items[0].quantity = newQty;
        if (newQty >= config.bulkMinPieces) draft.orderCategory = 'bulk_event';
        draft.summaryReviewed = false;
      }
    }
  } else {
    // Check if generic bulk quantity like "100 pieces for an event tomorrow" without specifying snack
    const genericPiecesMatch = input.match(/\b(\d{2,3})\s*(?:pieces|pcs|എണ്ണം)\b/i);
    if (genericPiecesMatch) {
      const qty = parseInt(genericPiecesMatch[1], 10);
      if (qty >= config.bulkMinPieces) {
        draft.orderCategory = 'bulk_event';
        draft.specialNotes = [draft.specialNotes, `Requested ${qty} pieces (snack mix TBC)`]
          .filter(Boolean)
          .join(' | ');
      }
    }
  }

  // If user asked ONLY for unavailable item(s)
  if (unavailableMessages.length > 0 && parsedItems.every((p) => {
    const m = menu.find((x) => x.id === p.itemId);
    return m?.availability === 'unavailable';
  })) {
    const availableNames = menu
      .filter((m) => m.availability === 'available')
      .map((m) => `${lang === 'ml' ? m.nameMl : m.nameEn} (₹${m.price ?? '?'})`)
      .join(', ');
    handoffSuggested = true;
    handoffReason = `Requested unavailable item: ${unavailableMessages.join(', ')}`;
    if (!draft.handoffReasons.includes(handoffReason)) draft.handoffReasons.push(handoffReason);
    const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);
    return {
      replyText:
        lang === 'ml'
          ? `${unavailableMessages.join(', ')} ഇപ്പോൾ ലഭ്യമല്ല (ഉടമ ഇത് ലഭ്യമല്ല എന്ന് അടയാളപ്പെടുത്തിയിരിക്കുന്നു). ഞാൻ സ്വന്തമായി പകരം മറ്റൊന്ന് ചേർക്കില്ല. നിലവിൽ ലഭ്യമായവ: ${availableNames}. ഇതിൽ ഏതെങ്കിലും വേണോ, അതോ ടീമിനോട് സംസാരിക്കണോ?`
          : `${unavailableMessages.join(', ')} is currently marked unavailable, so I won’t substitute anything without your permission. Available items today: ${availableNames}. Would you like to choose another available item or talk to our team?`,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: true,
      handoffReason,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        {
          label: lang === 'ml' ? 'ഉണ്ണിയപ്പം ചേർക്കുക' : 'Choose Unniyappam instead',
          value: lang === 'ml' ? '10 ഉണ്ണിയപ്പം വേണം' : '10 Unniyappam',
        },
        {
          label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person',
          value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person',
        },
      ],
    };
  }

  // 6. Extract fulfillment, contact, name, date/time, address/landmark
  const prevFulfillment = draft.fulfillment;
  const prevContact = draft.contact;
  const prevTime = draft.requestedDateTime;
  const prevName = draft.customerName;
  const prevAddress = draft.deliveryAddress;
  const prevLandmark = draft.landmark;
  const prevItemsSig = JSON.stringify(currentDraft.items);

  if (/(delivery|deliver|home delivery|ഡെലിവറി|വീട്ടിൽ)/i.test(input)) {
    draft.fulfillment = 'delivery';
    draft.summaryReviewed = false;
  } else if (/(pickup|pick up|collect|take away|പിക്കപ്പ്|നേരിട്ട്|എടുത്തോളാം)/i.test(input)) {
    draft.fulfillment = 'pickup';
    draft.outsideDeliveryAreaFlag = false;
    draft.summaryReviewed = false;
  }

  const foundContact = extractPhoneOrContact(input);
  if (foundContact) {
    draft.contact = foundContact;
    draft.summaryReviewed = false;
  }

  const foundTime = extractDateTime(input);
  if (foundTime) {
    draft.requestedDateTime = foundTime;
    draft.summaryReviewed = false;
  }

  const canAcceptStandaloneName =
    draft.items.length > 0 ||
    Boolean(draft.contact) ||
    Boolean(draft.requestedDateTime) ||
    Boolean(draft.fulfillment);
  const foundName = extractName(input, canAcceptStandaloneName);
  if (foundName && !draft.customerName) {
    draft.customerName = foundName;
  }

  const isQuestionText =
    /[?？]/.test(input) ||
    /(ആണോ|ഉണ്ടോ|വേണോ|മതിയോ|കഴിയുമോ|പറ്റുമോ|കിട്ടുമോ|കിട്ടുവോ|തരുമോ|എത്ര|എത്രയാ|എവിടെ|എവിടെയാ|എപ്പോൾ|എന്താണ്|എന്തൊക്കെ|എങ്ങനെ)[!.\s]*$/.test(input) ||
    /\b(undo|undoo|unda|kittumo|kittuo|kittuvo|aano|aayo|ethra|ethraya|evide|evideya|eppo|eppozha|entha|enthokke)\b[!.\s]*$/i.test(input);
  const hasExplicitAddressLabel = /(?:address|location|വിലാസം|landmark|അടയാളം)\s*[:\-]/i.test(input);

  if (!isQuestionText && (draft.fulfillment === 'delivery' || hasExplicitAddressLabel)) {
    const { address, landmark } = extractAddressAndLandmark(input, {
      fulfillment: draft.fulfillment,
      hasAddress: Boolean(draft.deliveryAddress.trim()),
      hasLandmark: Boolean(draft.landmark.trim()),
      hasCustomerName: Boolean(draft.customerName.trim()),
    });
    if (address && (!draft.deliveryAddress.trim() || /(?:address|location|വിലാസം)\s*[:\-]/i.test(input))) {
      draft.deliveryAddress = address;
      draft.summaryReviewed = false;
    }
    if (landmark) {
      draft.landmark = landmark;
      draft.summaryReviewed = false;
    }
  }

  if (detectOutsideDeliveryArea(input, config.deliveryRadiusKm)) {
    draft.fulfillment = 'delivery';
    draft.outsideDeliveryAreaFlag = true;
    if (!draft.deliveryAddress) draft.deliveryAddress = input;
    handoffSuggested = true;
    handoffReason = `Address may be outside approximate ${config.deliveryRadiusKm} km delivery radius — team check needed`;
    if (!draft.handoffReasons.includes(handoffReason)) draft.handoffReasons.push(handoffReason);
  }

  const itemsChanged = JSON.stringify(draft.items) !== prevItemsSig;
  const addedFulfillment = draft.fulfillment !== prevFulfillment;
  const addedContact = draft.contact !== prevContact;
  const addedTime = draft.requestedDateTime !== prevTime;
  const addedName = draft.customerName !== prevName;
  const addedAddress = draft.deliveryAddress !== prevAddress;
  const addedLandmark = draft.landmark !== prevLandmark;
  const didUpdateOrderDraft =
    itemsChanged ||
    addedFulfillment ||
    addedContact ||
    addedTime ||
    addedName ||
    addedAddress ||
    addedLandmark ||
    draft.orderCategory !== currentDraft.orderCategory;

  // 7. Recompute calculation & build helpful response matched to the input
  const calc = calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft);

  if (unknownMessages.length > 0) {
    handoffSuggested = true;
  }

  if (!config.openingHours.trim()) {
    const r = 'Opening hours not configured — team must verify';
    if (!draft.handoffReasons.includes(r)) draft.handoffReasons.push(r);
  }

  if (calc.hasMissingPrice) {
    const r = 'Item price missing — team must verify';
    if (!draft.handoffReasons.includes(r)) draft.handoffReasons.push(r);
    handoffSuggested = true;
  }

  const mlFieldMap: Record<string, string> = {
    'Snack and quantity': 'ഏത് പലഹാരവും എത്ര എണ്ണവും',
    'Customer name': 'നിങ്ങളുടെ പേര്',
    'Phone or contact method': 'ഫോൺ നമ്പർ / വാട്സ്ആപ്പ് നമ്പർ',
    'Requested date and time': 'വേണ്ട ദിവസവും സമയവും',
    'Pickup or delivery': 'പിക്കപ്പ് ആണോ ഡെലിവറി ആണോ',
    'Delivery address': 'ഡെലിവറി വിലാസം',
    'Nearby landmark': 'അടുത്തുള്ള അടയാളം',
  };

  // Special handling for bulk / event flow
  if (draft.orderCategory === 'bulk_event' && calc.lines.length === 0) {
    const text =
      lang === 'ml'
        ? `ഇവന്റ് / ബൾക്ക് ബുക്കിംഗിന് (${config.bulkMinPieces}–${config.bulkMaxPieces} എണ്ണം, 1–2 ദിവസം മുമ്പ്) ടീം പരിശോധന ആവശ്യമാണ്. പരീക്ഷണ നിയമപ്രകാരം 50% അഡ്വാൻസ് ആവശ്യപ്പെടാറുണ്ട് (ഇവിടെ പണമടവ് ശേഖരിക്കില്ല). ദയവായി ഏതൊക്കെ പലഹാരങ്ങൾ എത്ര എണ്ണം വേണം, പരിപാടിയുടെ സമയം, പേര്, ഫോൺ നമ്പർ, പിക്കപ്പ്/ഡെലിവറി വിവരങ്ങൾ എന്നിവ അറിയിക്കൂ.`
        : `Bulk/event bookings (${config.bulkMinPieces}–${config.bulkMaxPieces} pieces, ${config.bulkLeadTime}) require team review, and our trial rule requests a ${config.bulkAdvancePercent}% advance (we do not calculate or collect payment here). Please share your snack mix & quantities, event date/time, name, phone number, and pickup or delivery preference.`;
    return {
      replyText: text,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: true,
      handoffReason: 'Bulk/event booking requires team review',
      showSummaryCard: false,
      canSubmitReview: false,
      quickReplies: [
        {
          label: lang === 'ml' ? 'നാളെ വൈകിട്ട് 4-ന് 100 ഉണ്ണിയപ്പം' : '100 Unniyappam tomorrow 4 PM',
          value: lang === 'ml' ? 'നാളെ വൈകിട്ട് 4-ന് 100 ഉണ്ണിയപ്പം' : '100 Unniyappam tomorrow 4 PM',
        },
      ],
    };
  }

  // Outside delivery area message
  if (draft.outsideDeliveryAreaFlag) {
    const missingAfterOutside = calc.missingFields.filter((f) => f !== 'Delivery address');
    const missingLocalized =
      lang === 'ml'
        ? missingAfterOutside.map((f) => mlFieldMap[f] || f)
        : missingAfterOutside;
    const extraAsk =
      missingLocalized.length > 0
        ? lang === 'ml'
          ? ` കൂടാതെ ഈ വിവരങ്ങൾ കൂടി നൽകാമോ: ${missingLocalized.join(', ')}.`
          : ` Please also share: ${missingLocalized.join(', ')}.`
        : '';
    return {
      replyText:
        lang === 'ml'
          ? `ഈ വിലാസം ഏകദേശം ${config.deliveryRadiusKm} കി.മീ. ഡെലിവറി പരിധിക്ക് പുറത്താണോ എന്ന് ടീം പരിശോധിക്കേണ്ടതുണ്ട് — അതിനാൽ ഡെലിവറി ഉറപ്പുനൽകാനോ നിരസിക്കാനോ ഇപ്പോൾ കഴിയില്ല. ഞാൻ വിലാസം കുറിച്ചെടുത്തിട്ടുണ്ട്, ടീമിന് കൈമാറാം. വേണമെങ്കിൽ നേരിട്ട് പിക്കപ്പ് തിരഞ്ഞെടുക്കാം.${extraAsk}`
          : `This address appears it may be outside our approximate ${config.deliveryRadiusKm} km trial delivery area, so I cannot promise delivery or reject it automatically. I have recorded the address for our team to check — or you can switch to Pickup.${extraAsk}`,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: true,
      handoffReason: handoffReason || `Outside ${config.deliveryRadiusKm} km trial delivery estimate`,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: calc.lines.length > 0 && Boolean(draft.customerName && draft.contact),
      quickReplies: [
        { label: lang === 'ml' ? 'പിക്കപ്പ് മതി' : 'Switch to Pickup', value: lang === 'ml' ? 'പിക്കപ്പ്' : 'Pickup' },
        { label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person', value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person' },
      ],
    };
  }

  // If the customer's input didn't match any order detail or known intent, respond helpfully to that input instead of repeating the missing-fields dump
  if (!didUpdateOrderDraft && unavailableMessages.length === 0) {
    return {
      replyText:
        lang === 'ml'
          ? calc.lines.length > 0 && calc.missingFields.length > 0
            ? `ക്ഷമിക്കണം, അത് വ്യക്തമായില്ല. നിങ്ങളുടെ ഓർഡർ പൂർത്തിയാക്കാൻ "${mlFieldMap[calc.missingFields[0]] || calc.missingFields[0]}" നൽകാമോ, അതോ ടീമിനോട് സംസാരിക്കണോ?`
            : 'ക്ഷമിക്കണം, നിങ്ങൾ ഉദ്ദേശിച്ചത് വ്യക്തമായില്ല. ഇന്നത്തെ മെനു കാണാനോ പലഹാരങ്ങൾ ഓർഡർ ചെയ്യാനോ താഴെ കാണുന്ന ഓപ്ഷനുകൾ തിരഞ്ഞെടുക്കാം.'
          : calc.lines.length > 0 && calc.missingFields.length > 0
            ? `Sorry, I didn’t catch that. Could you share your ${calc.missingFields[0].toLowerCase()}, or would you like to talk to our team?`
            : 'Sorry, I didn’t quite understand that. You can check today’s menu, start an order, or talk directly to our team below.',
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: false,
      handoffReason: null,
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies: [
        { label: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu', value: lang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu' },
        { label: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കുക' : 'Talk to a person', value: lang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person' },
      ],
    };
  }

  // Check missing details to collect — acknowledge ONLY what was just given and ask naturally for the next step(s)
  if (calc.missingFields.length > 0) {
    const ackPartsMl: string[] = [];
    const ackPartsEn: string[] = [];

    if (itemsChanged && calc.lines.length > 0) {
      ackPartsMl.push(calc.lines.map((l) => `${l.quantity} ${l.nameMl}`).join(', '));
      ackPartsEn.push(calc.lines.map((l) => `${l.quantity} × ${l.nameEn}`).join(', '));
    }
    if (addedTime && draft.requestedDateTime) {
      ackPartsMl.push(`സമയം: ${draft.requestedDateTime}`);
      ackPartsEn.push(`Time: ${draft.requestedDateTime}`);
    }
    if (addedFulfillment && draft.fulfillment) {
      ackPartsMl.push(draft.fulfillment === 'delivery' ? 'ഡെലിവറി' : 'നേരിട്ട് പിക്കപ്പ്');
      ackPartsEn.push(draft.fulfillment === 'delivery' ? 'Delivery' : 'Pickup');
    }
    if (addedName && draft.customerName) {
      ackPartsMl.push(`പേര്: ${draft.customerName}`);
      ackPartsEn.push(`Name: ${draft.customerName}`);
    }
    if (addedContact && draft.contact) {
      ackPartsMl.push(`ഫോൺ: ${draft.contact}`);
      ackPartsEn.push(`Phone: ${draft.contact}`);
    }
    if (addedAddress && draft.deliveryAddress) {
      ackPartsMl.push(`വിലാസം: ${draft.deliveryAddress}`);
      ackPartsEn.push(`Address: ${draft.deliveryAddress}`);
    }

    const ackLine =
      ackPartsMl.length > 0
        ? lang === 'ml'
          ? `ശരി, ${ackPartsMl.join(' · ')} ചേർത്തു.\n`
          : `Noted: ${ackPartsEn.join(' · ')}.\n`
        : '';

    const prefixWarning =
      unavailableMessages.length > 0
        ? lang === 'ml'
          ? `(ശ്രദ്ധിക്കുക: ${unavailableMessages.join(', ')} ഇപ്പോൾ ലഭ്യമല്ല, അതിനാൽ ചേർത്തിട്ടില്ല.)\n`
          : `(Note: ${unavailableMessages.join(', ')} is currently unavailable, so it was not added.)\n`
        : '';

    // Pick only the next natural question(s) instead of repeating the whole checklist
    let nextQuestionMl = '';
    let nextQuestionEn = '';
    if (calc.lines.length === 0) {
      nextQuestionMl = 'ഏത് പലഹാരമാണ് വേണ്ടതെന്നും എത്ര എണ്ണമാണെന്നും പറയൂ?';
      nextQuestionEn = 'Which snack and quantity would you like?';
    } else if (calc.missingFields.length === 1) {
      const onlyField = calc.missingFields[0];
      nextQuestionMl = `ഇനി ${mlFieldMap[onlyField] || onlyField} കൂടി നൽകാമോ?`;
      nextQuestionEn = `Could you share your ${onlyField.toLowerCase()}?`;
    } else if (!draft.requestedDateTime || !draft.fulfillment) {
      const stepFields = calc.missingFields.filter((f) =>
        ['Requested date and time', 'Pickup or delivery'].includes(f)
      );
      const mlStep = stepFields.map((f) => mlFieldMap[f] || f);
      const remainingOthers = calc.missingFields.filter((f) => !stepFields.includes(f));
      if (itemsChanged && remainingOthers.length > 0) {
        const allMl = calc.missingFields.map((f) => mlFieldMap[f] || f);
        nextQuestionMl = `ഓർഡർ അയക്കാൻ ${allMl.join(', ')} നൽകാമോ?`;
        nextQuestionEn = `Could you share: ${calc.missingFields.join(', ')}?`;
      } else {
        nextQuestionMl = `ദയവായി ${mlStep.join(', ')} അറിയിക്കൂ.`;
        nextQuestionEn = `Please share: ${stepFields.join(', ')}.`;
      }
    } else if (!draft.customerName || !draft.contact) {
      const contactFields = calc.missingFields.filter((f) =>
        ['Customer name', 'Phone or contact method'].includes(f)
      );
      const mlContact = contactFields.map((f) => mlFieldMap[f] || f);
      nextQuestionMl = `ഇനി ${mlContact.join(', ')} കൂടി നൽകാമോ?`;
      nextQuestionEn = `Could you share your ${contactFields.join(' and ').toLowerCase()}?`;
    } else {
      const mlRem = calc.missingFields.map((f) => mlFieldMap[f] || f);
      nextQuestionMl = `ദയവായി ${mlRem.join(', ')} കൂടി നൽകാമോ?`;
      nextQuestionEn = `Could you please share: ${calc.missingFields.join(', ')}?`;
    }

    const bulkNote =
      calc.isBulkOrder && itemsChanged
        ? lang === 'ml'
          ? `\nഇത് ബൾക്ക് ഓർഡറായതിനാൽ ടീം പരിശോധന ആവശ്യമാണ് (പരീക്ഷണ നിയമം: ${config.bulkAdvancePercent}% അഡ്വാൻസ് ആവശ്യപ്പെടാറുണ്ട് — പണം ഇവിടെ ശേഖരിക്കില്ല).`
          : `\nBecause this is a bulk/event order, team review is required (trial rule requests ${config.bulkAdvancePercent}% advance; not calculated or collected here).`
        : '';

    const hoursCaution =
      !config.openingHours.trim() && itemsChanged
        ? lang === 'ml'
          ? '\n(പ്രവർത്തന സമയം ഉടമ ഇതുവരെ നൽകിയിട്ടില്ലാത്തതിനാൽ ടീം സമയം പരിശോധിക്കും.)'
          : '\n(Opening hours are not configured yet, so the team will verify timing.)'
        : '';

    const replyText =
      lang === 'ml'
        ? `${prefixWarning}${ackLine}${nextQuestionMl}${bulkNote}${hoursCaution}`
        : `${prefixWarning}${ackLine}${nextQuestionEn}${bulkNote}${hoursCaution}`;

    return {
      replyText,
      language: lang,
      updatedDraft: draft,
      calculation: calc,
      handoffSuggested: handoffSuggested || calc.hasMissingPrice || calc.hasUnavailableOrUnknownItem,
      handoffReason:
        handoffReason ||
        (calc.hasMissingPrice ? 'Missing item price — team check needed' : null),
      showSummaryCard: calc.lines.length > 0,
      canSubmitReview: false,
      quickReplies:
        !draft.fulfillment && calc.lines.length > 0
          ? [
              { label: lang === 'ml' ? 'നേരിട്ട് പിക്കപ്പ്' : 'Pickup', value: lang === 'ml' ? 'നേരിട്ട് പിക്കപ്പ്' : 'Pickup' },
              { label: lang === 'ml' ? 'ഡെലിവറി' : 'Delivery', value: lang === 'ml' ? 'ഡെലിവറി' : 'Delivery' },
            ]
          : calc.lines.length === 0
            ? [
                { label: lang === 'ml' ? '10 ഉണ്ണിയപ്പം' : '10 Unniyappam', value: lang === 'ml' ? '10 ഉണ്ണിയപ്പം വേണം' : '10 Unniyappam' },
                { label: lang === 'ml' ? '10 ഉള്ളിവട' : '10 Ullivada', value: lang === 'ml' ? '10 ഉള്ളിവട വേണം' : '10 Ullivada' },
              ]
            : [],
    };
  }

  // All 7 fields collected — present itemized summary for customer review before submission!
  const summaryText = formatItemizedSummaryText(draft, calc, config, lang);
  const intro =
    lang === 'ml'
      ? 'നിങ്ങളുടെ ഓർഡർ സംഗ്രഹം താഴെ കൊടുക്കുന്നു. ദയവായി പരിശോധിച്ച് "ടീം പരിശോധനയ്ക്ക് സമർപ്പിക്കുക" അമർത്തുക:'
      : 'Here is your itemized order summary. Please review it and tap "Submit for Team Review" when ready:';

  const bulkDisclaimer =
    calc.isBulkOrder
      ? lang === 'ml'
        ? `\n\nബൾക്ക് ബുക്കിംഗ് കുറിപ്പ്: ഇതിന് ടീം അനുമതി ആവശ്യമാണ് (${config.bulkLeadTime}). പരീക്ഷണ നിയമം ${config.bulkAdvancePercent}% അഡ്വാൻസ് ആവശ്യപ്പെടുന്നു; ഇവിടെ പണം ശേഖരിക്കുകയോ ബുക്കിംഗ് സ്ഥിരീകരിക്കുകയോ ചെയ്യുന്നില്ല.`
        : `\n\nBulk Booking Note: Requires team review (${config.bulkLeadTime}). Trial rule requests ${config.bulkAdvancePercent}% advance; advance is not collected or confirmed here.`
      : '';

  return {
    replyText: `${intro}\n\n${summaryText}${bulkDisclaimer}`,
    language: lang,
    updatedDraft: draft,
    calculation: calc,
    handoffSuggested: handoffSuggested || calc.warnings.length > 0,
    handoffReason: handoffReason || (calc.warnings.length > 0 ? calc.warnings[0] : null),
    showSummaryCard: true,
    canSubmitReview: true,
    quickReplies: [],
  };
}

export function createSubmittedOrderFromDraft(
  draft: OrderDraft,
  calc: OrderCalculation,
  config: BusinessConfig,
  existingOrders: SubmittedOrder[],
  nowIso: string = new Date().toISOString().slice(0, 16).replace('T', ' ')
): { order: SubmittedOrder; confirmationNoticeEn: string; confirmationNoticeMl: string } {
  const nextNum = 101 + existingOrders.length;
  const orderId = `PKS-${nextNum}`;

  const missingDetails = [...calc.missingFields];
  if (!config.openingHours.trim()) missingDetails.push('Opening hours not configured');
  if (draft.fulfillment === 'delivery' && config.deliveryFee === null) {
    missingDetails.push('Delivery fee not configured');
  }
  if (calc.hasMissingPrice) missingDetails.push('Missing item price');
  if (draft.outsideDeliveryAreaFlag) missingDetails.push('Outside ~3 km trial delivery radius');

  const combinedHandoff = Array.from(
    new Set([
      ...draft.handoffReasons,
      ...(calc.hasUnavailableOrUnknownItem ? ['Item availability requires team check'] : []),
      ...(calc.isBulkOrder ? ['Bulk/event booking requires team review'] : []),
    ])
  );

  const bulkAdvanceStatus = calc.isBulkOrder
    ? config.bulkPolicyVerified && config.bulkAdvanceCollectionEnabled
      ? `${config.bulkAdvancePercent}% advance policy verified — team to coordinate`
      : `Trial rule requests ${config.bulkAdvancePercent}% advance — not collected or confirmed`
    : 'Not applicable (regular order)';

  const order: SubmittedOrder = {
    orderId,
    submittedAt: nowIso,
    customerName: draft.customerName.trim() || 'Guest (Needs contact follow-up)',
    contact: draft.contact.trim() || 'Not provided',
    language: draft.language,
    items: calc.lines,
    totalPieces: calc.totalPieces,
    subtotal: calc.subtotal,
    deliveryFee: calc.deliveryFee,
    total: calc.total,
    requestedDateTime: draft.requestedDateTime.trim() || 'Not specified',
    fulfillment: draft.fulfillment,
    deliveryAddress: draft.deliveryAddress.trim(),
    landmark: draft.landmark.trim(),
    orderCategory: calc.isBulkOrder ? 'bulk_event' : 'regular',
    bulkAdvanceStatus,
    missingDetails,
    handoffReason: combinedHandoff.length > 0 ? combinedHandoff.join('; ') : null,
    status: 'Submitted for review',
    teamNotes: draft.specialNotes ? `Customer note: ${draft.specialNotes}` : '',
    reviewedBy: '',
    isDemoData: false,
  };

  return {
    order,
    confirmationNoticeEn:
      'Your order request has been sent to the team. It is not confirmed yet. We’ll confirm after checking availability.',
    confirmationNoticeMl:
      'നിങ്ങളുടെ ഓർഡർ അഭ്യർത്ഥന ടീമിന് അയച്ചിട്ടുണ്ട്. ഇത് ഇതുവരെ കൺഫേം ചെയ്തിട്ടില്ല. ലഭ്യത പരിശോധിച്ച ശേഷം ഞങ്ങൾ സ്ഥിരീകരിക്കുന്നതാണ്.',
  };
}

export const TEAM_DECISION_MESSAGES: Record<TeamDecision, string> = {
  accepted: 'Your order has been accepted our staff will contact you soon',
  needs_followup: 'Your order is under review - we confirm the order status shortly',
  rejected: 'Your order has been rejected due to unavailability of selected items',
};

const TEAM_DECISION_MESSAGES_ML: Record<TeamDecision, string> = {
  accepted: 'നിങ്ങളുടെ ഓർഡർ സ്വീകരിച്ചിരിക്കുന്നു, ഞങ്ങളുടെ ജീവനക്കാർ ഉടൻ ബന്ധപ്പെടുന്നതാണ്.',
  needs_followup: 'നിങ്ങളുടെ ഓർഡർ പരിശോധനയിലാണ് — ഓർഡർ നില ഉടൻ സ്ഥിരീകരിക്കുന്നതാണ്.',
  rejected: 'തിരഞ്ഞെടുത്ത പലഹാരങ്ങൾ ലഭ്യമല്ലാത്തതിനാൽ നിങ്ങളുടെ ഓർഡർ നിരസിച്ചിരിക്കുന്നു.',
};

export const TEAM_ACCEPTED_CUSTOMER_MESSAGE = TEAM_DECISION_MESSAGES.accepted;

export function buildTeamOrderUpdateMessage(
  orderId: string,
  decision: TeamDecision,
  teamNotes?: string,
  lang: Language = 'ml'
): string {
  const enMsg = TEAM_DECISION_MESSAGES[decision];
  const mlMsg = TEAM_DECISION_MESSAGES_ML[decision];
  const noteLine = teamNotes?.trim()
    ? lang === 'ml'
      ? `\nടീം കുറിപ്പ്: ${teamNotes.trim()}`
      : `\nTeam note: ${teamNotes.trim()}`
    : '';
  return lang === 'ml'
    ? `ഓർഡർ ${orderId}: ${enMsg}\n(${mlMsg})${noteLine}`
    : `Order ${orderId}: ${enMsg}${noteLine}`;
}

export function buildTeamAcceptedCustomerMessage(
  orderId: string,
  teamNotes?: string,
  lang: Language = 'ml'
): string {
  return buildTeamOrderUpdateMessage(orderId, 'accepted', teamNotes, lang);
}

