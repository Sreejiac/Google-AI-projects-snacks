import { useEffect, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  FlaskConical,
  MessageCircle,
  Settings,
} from 'lucide-react';
import {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_DEMO_ORDERS,
  DEFAULT_MENU_ITEMS,
  DEFAULT_TRIAL_METRICS,
  EMPTY_ORDER_DRAFT,
} from './data/defaultBusinessData';
import {
  BusinessConfig,
  ChatMessage,
  DailyTrialMetric,
  Language,
  MenuItem,
  OrderDraft,
  OrderStatus,
  SubmittedOrder,
  TeamDecision,
} from './types/business';
import { CustomerOrderView } from './components/CustomerOrderView';
import { ReviewQueueView } from './components/ReviewQueueView';
import { OwnerConfigView } from './components/OwnerConfigView';
import { TrialMetricsView } from './components/TrialMetricsView';
import { TestSuiteAndSetupView } from './components/TestSuiteAndSetupView';
import {
  buildTeamOrderUpdateMessage,
  processCustomerMessage,
  TEAM_DECISION_MESSAGES,
} from './utils/orderRules';

type AppTab = 'order' | 'queue' | 'owner' | 'metrics' | 'tests';

const STORAGE_KEY = 'panankayam_snacks_prototype_v1';

function createInitialMessages(lang: Language): ChatMessage[] {
  return [
    {
      id: 'welcome-1',
      sender: 'assistant',
      language: lang,
      timestamp: '10:30',
      text:
        lang === 'ml'
          ? 'നമസ്കാരം! സ്വാഗതം. പാത്താർ / പനങ്കയത്തെ മൂന്ന് സ്ത്രീകളുടെ വീട്ടുകളിൽ നിന്ന് ചൂടുള്ള നാടൻ പലഹാരങ്ങൾ.'
          : 'Fresh home-made Kerala snacks from Panankayam / Pathar (679334). Tap an option or type in Malayalam/English.',
    },
  ];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('order');
  const [uiLang, setUiLang] = useState<Language>('ml');

  const [config, setConfig] = useState<BusinessConfig>(DEFAULT_BUSINESS_CONFIG);
  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU_ITEMS);
  const [orders, setOrders] = useState<SubmittedOrder[]>(DEFAULT_DEMO_ORDERS);
  const [metrics, setMetrics] = useState<DailyTrialMetric[]>(DEFAULT_TRIAL_METRICS);
  const [draft, setDraft] = useState<OrderDraft>({ ...EMPTY_ORDER_DRAFT, language: 'ml' });
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages('ml'));
  const [teamUpdateNotice, setTeamUpdateNotice] = useState<{
    orderId: string;
    decision: TeamDecision;
    message: string;
    teamNotes: string;
  } | null>(null);

  const [integrations, setIntegrations] = useState({
    geminiNluConfigured: false,
    whatsappCloudApiConfigured: false,
    googleSheetsWebhookConfigured: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.config) setConfig(parsed.config);
        if (Array.isArray(parsed.menu)) setMenu(parsed.menu);
        if (Array.isArray(parsed.orders)) setOrders(parsed.orders);
        if (Array.isArray(parsed.metrics)) setMetrics(parsed.metrics);
      }
    } catch {
      // Ignore malformed storage
    }

    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.integrations) {
          setIntegrations(data.integrations);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ config, menu, orders, metrics })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [config, menu, orders, metrics]);

  const handleToggleLang = () => {
    const nextLang: Language = uiLang === 'en' ? 'ml' : 'en';
    setUiLang(nextLang);
    setDraft((prev) => ({ ...prev, language: nextLang }));
    if (messages.length <= 1) {
      setMessages(createInitialMessages(nextLang));
    }
  };

  const handleSubmitOrder = (newOrder: SubmittedOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
    }).catch(() => {});
  };

  const handleUpdateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    decision: TeamDecision,
    teamNotes: string,
    reviewedBy: string
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === orderId
          ? { ...o, status, teamDecision: decision, teamNotes, reviewedBy }
          : o
      )
    );

    const deliveredMsg: ChatMessage = {
      id: `team-${decision}-${orderId}-${Date.now()}`,
      sender: 'assistant',
      language: uiLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: buildTeamOrderUpdateMessage(orderId, decision, teamNotes, uiLang),
    };
    setMessages((prev) => [...prev, deliveredMsg]);
    setTeamUpdateNotice({
      orderId,
      decision,
      message: TEAM_DECISION_MESSAGES[decision],
      teamNotes,
    });

    fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, teamDecision: decision, teamNotes, reviewedBy }),
    }).catch(() => {});
  };

  const handleSaveOwnerChanges = (nextConfig: BusinessConfig, nextMenu: MenuItem[]) => {
    setConfig(nextConfig);
    setMenu(nextMenu);
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: nextConfig, menu: nextMenu }),
    }).catch(() => {});
  };

  const handleUpdateMetrics = (nextMetrics: DailyTrialMetric[]) => {
    setMetrics(nextMetrics);
    fetch('/api/metrics', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics: nextMetrics }),
    }).catch(() => {});
  };

  const handleRunInCustomerChat = (sampleInputs: string[]) => {
    let runningDraft = { ...EMPTY_ORDER_DRAFT };
    const newMsgs: ChatMessage[] = [...createInitialMessages(uiLang)];

    for (let i = 0; i < sampleInputs.length; i += 1) {
      const text = sampleInputs[i];
      const res = processCustomerMessage(text, runningDraft, menu, config, orders);
      runningDraft = res.updatedDraft;
      newMsgs.push({
        id: `sample-c-${Date.now()}-${i}`,
        sender: 'customer',
        text,
        language: res.language,
        timestamp: 'Sample',
      });
      newMsgs.push({
        id: `sample-a-${Date.now()}-${i}`,
        sender: 'assistant',
        text: res.replyText,
        language: res.language,
        timestamp: 'Sample',
        handoffSuggested: res.handoffSuggested,
        handoffReason: res.handoffReason,
        showSummaryCard: res.showSummaryCard,
        canSubmitReview: res.canSubmitReview,
        quickReplies: res.quickReplies,
      });
    }

    setDraft(runningDraft);
    setMessages(newMsgs);
    setActiveTab('order');
  };

  const pendingReviewCount = orders.filter((o) => o.status === 'Submitted for review').length;

  const navItems: { id: AppTab; label: string; shortLabel: string; icon: typeof MessageCircle }[] = [
    { id: 'order', label: 'Order Assistant', shortLabel: 'Order', icon: MessageCircle },
    {
      id: 'queue',
      label: `Review Queue (${pendingReviewCount})`,
      shortLabel: `Queue (${pendingReviewCount})`,
      icon: ClipboardList,
    },
    { id: 'owner', label: 'Owner Controls', shortLabel: 'Owner', icon: Settings },
    { id: 'metrics', label: '7-Day Trial', shortLabel: 'Trial', icon: BarChart3 },
    { id: 'tests', label: 'Tests & Setup', shortLabel: 'Tests', icon: FlaskConical },
  ];

  // On mobile, when on the primary Order front page, CustomerOrderView renders the full-bleed WhatsApp header & bottom composer
  const isMobileOrderFrontPage = activeTab === 'order';

  return (
    <div className={`min-h-screen bg-stone-50 text-zinc-900 ${isMobileOrderFrontPage ? 'pb-0 md:pb-10' : 'pb-20 md:pb-10'}`}>
      {/* Desktop Top Bar (always visible >= md); Mobile Top Bar shown on team/admin tabs */}
      <header
        className={`${
          isMobileOrderFrontPage ? 'hidden md:block' : 'block'
        } sticky top-0 z-30 h-[52px] md:h-16 bg-white/95 backdrop-blur-md border-b border-stone-200`}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('order');
            }}
            className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 font-display"
          >
            Panankayam Snacks
          </a>

          <nav aria-label="Primary sections" className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-emerald-800 text-zinc-900'
                      : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:border-stone-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleToggleLang}
            className="min-h-[38px] md:min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {uiLang === 'en' ? 'മലയാളം' : 'English'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        className={
          isMobileOrderFrontPage
            ? 'max-w-7xl mx-auto md:px-6 md:py-6'
            : 'max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7'
        }
      >
        {activeTab === 'order' && (
          <CustomerOrderView
            config={config}
            menu={menu}
            orders={orders}
            draft={draft}
            setDraft={setDraft}
            messages={messages}
            setMessages={setMessages}
            uiLang={uiLang}
            onToggleLang={handleToggleLang}
            onSubmitOrder={handleSubmitOrder}
            onResetDraft={() => setDraft({ ...EMPTY_ORDER_DRAFT, language: uiLang })}
            onClearChat={() => {
              setMessages(createInitialMessages(uiLang));
              setDraft({ ...EMPTY_ORDER_DRAFT, language: uiLang });
              setTeamUpdateNotice(null);
            }}
            teamUpdateNotice={teamUpdateNotice}
            onDismissTeamUpdateNotice={() => setTeamUpdateNotice(null)}
            onNavigateTab={(t) => setActiveTab(t)}
            pendingReviewCount={pendingReviewCount}
          />
        )}

        {activeTab === 'queue' && (
          <ReviewQueueView
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        )}

        {activeTab === 'owner' && (
          <OwnerConfigView
            config={config}
            menu={menu}
            onSaveOwnerChanges={handleSaveOwnerChanges}
          />
        )}

        {activeTab === 'metrics' && (
          <TrialMetricsView
            metrics={metrics}
            orders={orders}
            onUpdateMetrics={handleUpdateMetrics}
          />
        )}

        {activeTab === 'tests' && (
          <TestSuiteAndSetupView
            config={config}
            menu={menu}
            orders={orders}
            integrations={integrations}
            onRunInCustomerChat={handleRunInCustomerChat}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar shown on Team/Admin views so navigation stays effortless while keeping Order front page faithful to reference */}
      {!isMobileOrderFrontPage && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 backdrop-blur-md border-t border-stone-200 grid grid-cols-5 items-center"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-emerald-800 font-semibold' : 'text-zinc-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-[68px]">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
