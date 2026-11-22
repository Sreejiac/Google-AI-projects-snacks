import React, { useState } from 'react';
import { CheckCircle2, Play, ShieldAlert, Wrench, XCircle } from 'lucide-react';
import {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_MENU_ITEMS,
  EMPTY_ORDER_DRAFT,
} from '../data/defaultBusinessData';
import { BusinessConfig, MenuItem, SubmittedOrder } from '../types/business';
import { processCustomerMessage } from '../utils/orderRules';

interface TestSuiteAndSetupViewProps {
  config: BusinessConfig;
  menu: MenuItem[];
  orders: SubmittedOrder[];
  integrations: {
    geminiNluConfigured: boolean;
    whatsappCloudApiConfigured: boolean;
    googleSheetsWebhookConfigured: boolean;
  };
  onRunInCustomerChat: (messages: string[]) => void;
}

interface SampleTestResult {
  id: number;
  title: string;
  inputSummary: string;
  passed: boolean;
  actualOutput: string;
  expectedNote: string;
  sampleInputs: string[];
}

export const TestSuiteAndSetupView: React.FC<TestSuiteAndSetupViewProps> = ({
  config,
  menu,
  orders,
  integrations,
  onRunInCustomerChat,
}) => {
  const [results, setResults] = useState<SampleTestResult[] | null>(null);

  const runAllSevenTests = () => {
    const out: SampleTestResult[] = [];

    // 1. Malayalam order
    {
      const t1 = processCustomerMessage(
        '10 ഉണ്ണിയപ്പം വേണം നാളെ വൈകിട്ട്.',
        EMPTY_ORDER_DRAFT,
        menu,
        config,
        orders
      );
      const t2 = processCustomerMessage(
        'രമേശ്, 9876543210, ഡെലിവറി, പനങ്കയം സ്കൂളിന് സമീപം',
        t1.updatedDraft,
        menu,
        config,
        orders
      );
      const passed =
        t1.language === 'ml' &&
        t2.language === 'ml' &&
        t2.calculation.subtotal === 80 &&
        t2.canSubmitReview &&
        !/confirmed/i.test(t2.replyText.replace(/not confirmed/gi, ''));
      out.push({
        id: 1,
        title: '1. Malayalam order',
        inputSummary: '“10 ഉണ്ണിയപ്പം വേണം നാളെ വൈകിട്ട്.” + contact & delivery details',
        passed,
        actualOutput: t2.replyText,
        expectedNote:
          'Responds in Malayalam, collects contact & delivery address, shows itemized ₹80 total (or configured trial price), stays pending team review.',
        sampleInputs: [
          '10 ഉണ്ണിയപ്പം വേണം നാളെ വൈകിട്ട്.',
          'രമേശ്, 9876543210, ഡെലിവറി, പനങ്കയം സ്കൂളിന് സമീപം',
        ],
      });
    }

    // 2. Unavailable item (use default or current unavailable item)
    {
      const unavailableItem =
        menu.find((m) => m.availability === 'unavailable') ||
        DEFAULT_MENU_ITEMS.find((m) => m.id === 'neyyappam')!;
      const testMenu = menu.map((m) =>
        m.id === unavailableItem.id ? { ...m, availability: 'unavailable' as const } : m
      );
      const res = processCustomerMessage(
        `I want 10 ${unavailableItem.nameEn}`,
        EMPTY_ORDER_DRAFT,
        testMenu,
        config,
        orders
      );
      const passed =
        res.calculation.lines.length === 0 &&
        res.handoffSuggested &&
        /unavailable/i.test(res.replyText);
      out.push({
        id: 2,
        title: '2. Unavailable item',
        inputSummary: `Customer asks for "${unavailableItem.nameEn}" when marked unavailable`,
        passed,
        actualOutput: res.replyText,
        expectedNote:
          'Explains item is unavailable, does not substitute without permission, offers human handoff or asks for another available item.',
        sampleInputs: [`I want 10 ${unavailableItem.nameEn}`],
      });
    }

    // 3. Bulk booking
    {
      const t1 = processCustomerMessage(
        'I need 100 pieces for an event tomorrow',
        EMPTY_ORDER_DRAFT,
        menu,
        config,
        orders
      );
      const passed =
        t1.updatedDraft.orderCategory === 'bulk_event' &&
        t1.handoffSuggested &&
        /50%/.test(t1.replyText);
      out.push({
        id: 3,
        title: '3. Bulk booking (100 pieces)',
        inputSummary: '“I need 100 pieces for an event tomorrow”',
        passed,
        actualOutput: t1.replyText,
        expectedNote:
          'Collects event time, snack mix, contact, pickup/delivery; explains team review & trial 50% advance without collecting payment or confirming.',
        sampleInputs: ['I need 100 pieces for an event tomorrow'],
      });
    }

    // 4. Outside delivery area
    {
      const res = processCustomerMessage(
        '12 Ullivada, Rahul, 9895012345, tomorrow 5 PM, delivery to Edakkara 6 km away near bus stand',
        EMPTY_ORDER_DRAFT,
        menu,
        config,
        orders
      );
      const passed =
        res.updatedDraft.outsideDeliveryAreaFlag &&
        res.handoffSuggested &&
        /Pickup/i.test(res.replyText);
      out.push({
        id: 4,
        title: '4. Outside ~3 km delivery area',
        inputSummary: 'Delivery to Edakkara (6 km away)',
        passed,
        actualOutput: res.replyText,
        expectedNote:
          'Does not promise delivery or auto-reject; records address for team verification and offers Pickup.',
        sampleInputs: [
          '12 Ullivada, Rahul, 9895012345, tomorrow 5 PM, delivery to Edakkara 6 km away near bus stand',
        ],
      });
    }

    // 5. Missing price or opening hours
    {
      const testConfig = { ...DEFAULT_BUSINESS_CONFIG, openingHours: '' };
      const testMenu = DEFAULT_MENU_ITEMS.map((m) =>
        m.id === 'unniyappam' ? { ...m, price: null, availability: 'unknown' as const } : m
      );
      const res = processCustomerMessage(
        '10 Unniyappam, Maya, 9847099887, tomorrow 4 PM, pickup',
        EMPTY_ORDER_DRAFT,
        testMenu,
        testConfig,
        orders
      );
      const passed =
        res.calculation.hasMissingPrice &&
        res.calculation.subtotal === null &&
        res.handoffSuggested &&
        /team/i.test(res.replyText);
      out.push({
        id: 5,
        title: '5. Missing price or opening hours',
        inputSummary: 'Unniyappam price missing + opening hours blank',
        passed,
        actualOutput: res.replyText,
        expectedNote:
          'Never guesses missing price or opening hours; routes to team check and creates review request.',
        sampleInputs: ['10 Unniyappam, Maya, 9847099887, tomorrow 4 PM, pickup'],
      });
    }

    // 6. Customer changes an order
    {
      const t1 = processCustomerMessage(
        '10 Unniyappam, Ravi, 9847001122, tomorrow 5 PM, pickup',
        EMPTY_ORDER_DRAFT,
        menu,
        config,
        orders
      );
      const t2 = processCustomerMessage(
        'Change unniyappam to 15',
        t1.updatedDraft,
        menu,
        config,
        orders
      );
      const passed =
        t2.calculation.totalPieces === 15 &&
        t2.calculation.subtotal === 15 * (menu.find((m) => m.id === 'unniyappam')?.price ?? 8);
      out.push({
        id: 6,
        title: '6. Customer changes an order',
        inputSummary: '10 Unniyappam → “Change unniyappam to 15”',
        passed,
        actualOutput: t2.replyText,
        expectedNote:
          'Updates draft quantity to 15, recalculates from structured menu price, shows revised summary before submission.',
        sampleInputs: [
          '10 Unniyappam, Ravi, 9847001122, tomorrow 5 PM, pickup',
          'Change unniyappam to 15',
        ],
      });
    }

    // 7. Customer asks if order is confirmed
    {
      const res = processCustomerMessage(
        'Is my order confirmed?',
        EMPTY_ORDER_DRAFT,
        menu,
        config,
        orders
      );
      const passed = /Submitted for review|Accepted by team|Draft|Declined/i.test(res.replyText);
      out.push({
        id: 7,
        title: '7. Customer asks if order is confirmed',
        inputSummary: '“Is my order confirmed?”',
        passed,
        actualOutput: res.replyText,
        expectedNote:
          'Accurately reports actual queue status (e.g. Submitted for review — not confirmed yet).',
        sampleInputs: ['Is my order confirmed?'],
      });
    }

    setResults(out);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">
            Sample Conversation Tests & Setup Note
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Verify all 7 required customer scenarios against the live rules engine, or load any case directly into the chat assistant.
          </p>
        </div>

        <button
          type="button"
          onClick={runAllSevenTests}
          className="min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shrink-0"
        >
          <Play className="w-4 h-4" />
          Run All 7 Sample Tests
        </button>
      </section>

      {/* Test Results */}
      {results ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold text-zinc-900 tabular-nums">
            Test Suite Summary: {results.filter((r) => r.passed).length} / {results.length} passed
          </p>
          <div className="grid grid-cols-1 gap-4">
            {results.map((r) => (
              <article
                key={r.id}
                className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {r.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-800 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-700 shrink-0" />
                    )}
                    <h2 className="text-base font-semibold text-zinc-900">{r.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRunInCustomerChat(r.sampleInputs)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-emerald-50 text-xs font-semibold text-zinc-900 cursor-pointer"
                  >
                    Load in Customer Chat
                  </button>
                </div>
                <p className="text-xs text-zinc-600">
                  <strong className="text-zinc-900">Input:</strong> {r.inputSummary}
                </p>
                <p className="text-xs text-zinc-600">
                  <strong className="text-zinc-900">Expected:</strong> {r.expectedNote}
                </p>
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-zinc-800 whitespace-pre-line">
                  <strong className="block text-zinc-600 mb-1">Assistant Output:</strong>
                  {r.actualOutput}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="bg-white border border-stone-200 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-zinc-700">
            Click <strong>Run All 7 Sample Tests</strong> above to execute the bilingual Malayalam order, unavailable item, bulk booking, outside-area delivery, missing rules, order edit, and status-check scenarios.
          </p>
        </section>
      )}

      {/* Setup Note: What Owner Must Verify + Real Integrations Needed */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-800" />
            <h2 className="text-base font-semibold text-zinc-900">
              What the Owner Must Verify Locally Before Launch
            </h2>
          </div>
          <ul className="space-y-2 text-xs text-zinc-700 leading-relaxed list-disc pl-4">
            <li>
              <strong>Opening hours:</strong> Currently unconfigured — enter real daily operating & pickup hours in Owner Controls.
            </li>
            <li>
              <strong>Trial prices & margins:</strong> Verify Unniyappam (₹8), Ullivada (₹10), Neyyappam (₹10, Week 2), Pazham Pori (₹12), and Pakkavada 100g (₹35) against local ingredient and oil costs.
            </li>
            <li>
              <strong>Delivery boundary & fee:</strong> Confirm exact Panankayam / Pathar landmarks within ~3 km and decide whether to charge a delivery fee (left unconfigured so the assistant never guesses).
            </li>
            <li>
              <strong>Cutoffs, minimums & bulk advance:</strong> Confirm evening-before cutoff, 10 pcs / ₹100 minimum home order, and 50% advance collection terms for 50–300 piece events.
            </li>
            <li>
              <strong>Food safety, allergens & Pakkavada rule:</strong> Keep Pakkavada restricted to home sales only, and verify allergen/oil/FSSAI statements before enabling any safety reassurance.
            </li>
          </ul>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-800" />
            <h2 className="text-base font-semibold text-zinc-900">
              Setup Note & Real Integrations Needed
            </h2>
          </div>
          <ul className="space-y-2 text-xs text-zinc-700 leading-relaxed">
            <li className="flex items-start justify-between gap-2 pb-2 border-b border-stone-100">
              <div>
                <strong className="text-zinc-900">1. WhatsApp Business Cloud API</strong>
                <p>Prototype simulates chat in-browser and sends zero real WhatsApp messages. Production requires Meta Phone Number ID, Access Token, and Webhook verification.</p>
              </div>
              <span className="font-mono text-[11px] text-amber-800 shrink-0">
                {integrations.whatsappCloudApiConfigured ? 'Connected' : 'Not connected'}
              </span>
            </li>
            <li className="flex items-start justify-between gap-2 pb-2 border-b border-stone-100">
              <div>
                <strong className="text-zinc-900">2. Google Sheets / Persistent Database</strong>
                <p>Orders currently persist in browser storage and Express prototype memory (<span className="font-mono">/api/orders</span>). Production requires a Google Sheets Service Account or PostgreSQL/Firestore backend.</p>
              </div>
              <span className="font-mono text-[11px] text-amber-800 shrink-0">
                {integrations.googleSheetsWebhookConfigured ? 'Connected' : 'Demo queue'}
              </span>
            </li>
            <li className="flex items-start justify-between gap-2">
              <div>
                <strong className="text-zinc-900">3. Optional Gemini NLU (<span className="font-mono">GEMINI_API_KEY</span>)</strong>
                <p>Deterministic Malayalam/English rules run without any key. Supplying a server-side <span className="font-mono">GEMINI_API_KEY</span> enables <span className="font-mono">/api/nlu-extract</span> for complex free-form Manglish/Malayalam phrasing while keeping pricing and review rules deterministic.</p>
              </div>
              <span className={`font-mono text-[11px] shrink-0 ${integrations.geminiNluConfigured ? 'text-emerald-800' : 'text-zinc-600'}`}>
                {integrations.geminiNluConfigured ? 'Configured' : 'Optional / Not set'}
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};
