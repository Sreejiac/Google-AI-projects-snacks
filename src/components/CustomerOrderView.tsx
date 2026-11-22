import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Minus,
  MoreVertical,
  Paperclip,
  PhoneCall,
  Plus,
  RotateCcw,
  Send,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import {
  BusinessConfig,
  ChatMessage,
  Language,
  MenuItem,
  OrderDraft,
  SubmittedOrder,
  TeamDecision,
} from '../types/business';
import {
  calculateOrderTotals,
  createSubmittedOrderFromDraft,
  processCustomerMessage,
} from '../utils/orderRules';
import { PanankayamBridgeBanner } from './PanankayamBridgeBanner';

interface CustomerOrderViewProps {
  config: BusinessConfig;
  menu: MenuItem[];
  orders: SubmittedOrder[];
  draft: OrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<OrderDraft>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  uiLang: Language;
  onToggleLang: () => void;
  onSubmitOrder: (order: SubmittedOrder) => void;
  onResetDraft: () => void;
  onClearChat: () => void;
  teamUpdateNotice: {
    orderId: string;
    decision: TeamDecision;
    message: string;
    teamNotes: string;
  } | null;
  onDismissTeamUpdateNotice: () => void;
  onNavigateTab: (tab: 'queue' | 'owner' | 'metrics' | 'tests') => void;
  pendingReviewCount: number;
}

const MENU_ROW_SUBTITLES: Record<string, string> = {
  unniyappam: 'Unniyappam · 1-2 ദിവസം കേടാവില്ല',
  ullivada: 'Ullivada · വൈകുന്നേരം സ്പെഷ്യൽ',
  neyyappam: 'Neyyappam · നെയ്യപ്പം സ്പെഷ്യൽ',
  pazham_pori: 'Pazhampori · വീട്ടിലേക്കും പരിപാടികൾക്കും',
  pakkavada: 'Pakkavada · നേരിട്ട് ഓർഡർ മാത്രം',
};

export const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({
  config,
  menu,
  orders,
  draft,
  setDraft,
  messages,
  setMessages,
  uiLang,
  onToggleLang,
  onSubmitOrder,
  onResetDraft,
  onClearChat,
  teamUpdateNotice,
  onDismissTeamUpdateNotice,
  onNavigateTab,
  pendingReviewCount,
}) => {
  const [inputText, setInputText] = useState('');
  const [lastSubmittedNotice, setLastSubmittedNotice] = useState<{
    orderId: string;
    messageEn: string;
    messageMl: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'order'>('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const calc = useMemo(
    () => calculateOrderTotals(draft.items, menu, config, draft.fulfillment, draft),
    [draft, menu, config]
  );

  const latestSubmittedOrder = orders.find((o) => !o.isDemoData) || orders[0] || null;
  const visibleMenuRows = menu.filter((m) => m.availability !== 'unavailable');
  const unavailableMenuRows = menu.filter((m) => m.availability === 'unavailable');

  // Conversation messages after the static initial welcome card
  const dynamicMessages = messages.filter((m) => m.id !== 'welcome-1');

  const handleClearChatClick = () => {
    setInputText('');
    setLastSubmittedNotice(null);
    setFormError(null);
    setMobileMenuOpen(false);
    onClearChat();
  };

  const handleSendMessage = (overrideText?: string) => {
    const raw = (overrideText ?? inputText).trim();
    if (!raw) return;

    setLastSubmittedNotice(null);
    setFormError(null);

    const customerMsg: ChatMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text: raw,
      language: /[\u0D00-\u0D7F]/.test(raw) ? 'ml' : uiLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const result = processCustomerMessage(raw, draft, menu, config, orders, uiLang);
    setDraft(result.updatedDraft);

    const assistantMsg: ChatMessage = {
      id: `asst-${Date.now() + 1}`,
      sender: 'assistant',
      text: result.replyText,
      language: result.language,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      handoffSuggested: result.handoffSuggested,
      handoffReason: result.handoffReason,
      showSummaryCard: result.showSummaryCard,
      canSubmitReview: result.canSubmitReview,
      quickReplies: result.quickReplies,
    };

    setMessages((prev) => [...prev, customerMsg, assistantMsg]);
    if (!overrideText) setInputText('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  const setMenuQuantity = (item: MenuItem, rawNextQty: number) => {
    if (item.availability === 'unavailable') {
      handleSendMessage(
        uiLang === 'ml' ? `${item.nameMl} ലഭ്യമാണോ?` : `Is ${item.nameEn} available?`
      );
      return;
    }
    setLastSubmittedNotice(null);
    setFormError(null);

    const nextQty = Math.max(0, Math.min(500, Math.floor(Number.isNaN(rawNextQty) ? 0 : rawNextQty)));

    setDraft((prev) => {
      const existing = prev.items.find((i) => i.itemId === item.id);
      const nextItems =
        nextQty === 0
          ? prev.items.filter((i) => i.itemId !== item.id)
          : existing
            ? prev.items.map((i) => (i.itemId === item.id ? { ...i, quantity: nextQty } : i))
            : [...prev.items, { itemId: item.id, quantity: nextQty }];

      const totalPieces = nextItems.reduce((acc, i) => acc + i.quantity, 0);
      const nextHandoffs = [...prev.handoffReasons];
      if (item.availability === 'unknown' && nextQty > 0) {
        const reason = `Availability of ${item.nameEn} not entered today — please check with team`;
        if (!nextHandoffs.includes(reason)) nextHandoffs.push(reason);
      }

      return {
        ...prev,
        items: nextItems,
        orderCategory: totalPieces >= config.bulkMinPieces ? 'bulk_event' : prev.orderCategory,
        handoffReasons: nextHandoffs,
        summaryReviewed: false,
      };
    });
  };

  const adjustMenuQuantity = (item: MenuItem, delta: number) => {
    const existing = draft.items.find((i) => i.itemId === item.id);
    const currentQty = existing ? existing.quantity : 0;
    setMenuQuantity(item, currentQty + delta);
  };

  const handleSubmitForReview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const isHandoffOnly = draft.handoffReasons.length > 0 && calc.lines.length === 0;
    if (!draft.customerName.trim() || !draft.contact.trim()) {
      setFormError(
        uiLang === 'ml'
          ? 'ദയവായി നിങ്ങളുടെ പേരും ഫോൺ/വാട്സ്ആപ്പ് നമ്പറും നൽകുക.'
          : 'Please enter your name and phone or preferred contact method.'
      );
      return;
    }

    if (!isHandoffOnly && calc.lines.length === 0) {
      setFormError(
        uiLang === 'ml'
          ? 'കുറഞ്ഞത് ഒരു പലഹാരമെങ്കിലും തിരഞ്ഞെടുക്കുക.'
          : 'Please select at least one snack item or add a question for the team.'
      );
      return;
    }

    if (!isHandoffOnly && !draft.requestedDateTime.trim()) {
      setFormError(
        uiLang === 'ml'
          ? 'വേണ്ട ദിവസവും സമയവും രേഖപ്പെടുത്തുക.'
          : 'Please enter your requested date and time.'
      );
      return;
    }

    if (!isHandoffOnly && !draft.fulfillment) {
      setFormError(
        uiLang === 'ml'
          ? 'പിക്കപ്പ് ആണോ ഡെലിവറി ആണോ എന്ന് തിരഞ്ഞെടുക്കുക.'
          : 'Please choose Pickup or Delivery.'
      );
      return;
    }

    if (
      !isHandoffOnly &&
      draft.fulfillment === 'delivery' &&
      (!draft.deliveryAddress.trim() || !draft.landmark.trim())
    ) {
      setFormError(
        uiLang === 'ml'
          ? 'ഡെലിവറി വിലാസവും അടുത്തുള്ള അടയാളവും (Landmark) നൽകുക.'
          : 'Please enter both the delivery address and a nearby landmark.'
      );
      return;
    }

    const { order, confirmationNoticeEn, confirmationNoticeMl } = createSubmittedOrderFromDraft(
      draft,
      calc,
      config,
      orders
    );

    onSubmitOrder(order);
    setLastSubmittedNotice({
      orderId: order.orderId,
      messageEn: confirmationNoticeEn,
      messageMl: confirmationNoticeMl,
    });

    const systemMsg: ChatMessage = {
      id: `sys-${Date.now()}`,
      sender: 'assistant',
      text:
        uiLang === 'ml' || draft.language === 'ml'
          ? `ഓർഡർ ഐഡി ${order.orderId}: ${confirmationNoticeMl}`
          : `Order ID ${order.orderId}: ${confirmationNoticeEn}`,
      language: uiLang === 'ml' ? 'ml' : draft.language,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, systemMsg]);
    onResetDraft();
    setMobilePanel('chat');
  };

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
      {/* LEFT COLUMN (Full mobile front page matching WhatsApp Kerala reference) */}
      <section
        aria-label="Panankayam Homemade Snacks Chat Front Page"
        className={`${
          mobilePanel === 'chat' ? 'flex' : 'hidden lg:flex'
        } lg:col-span-7 flex-col bg-[#144B41] lg:rounded-2xl lg:overflow-hidden lg:border lg:border-[#0B4D3E] min-h-[calc(100dvh)] lg:min-h-[760px]`}
      >
        {/* Mobile WhatsApp Business Header (matches attached reference; hidden on desktop where main top bar sits) */}
        <div className="md:hidden sticky top-0 z-30 bg-[#0B4D3E] text-white px-2.5 py-2 flex items-center justify-between gap-1.5 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label="Toggle Menu & Summary"
              onClick={() => setMobilePanel('order')}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#E4B45A] text-[#0B4D3E] flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[13px] font-semibold leading-tight truncate">
                {config.businessName}
              </h1>
              <p className="text-[10.5px] text-emerald-100/90 leading-tight truncate">
                Business account · നാടൻ പലഹാരങ്ങൾ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 relative">
            <button
              type="button"
              aria-label="Talk to a person"
              onClick={() =>
                handleSendMessage(
                  uiLang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person'
                )
              }
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Open team views and language menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {mobileMenuOpen && (
              <div className="absolute right-0 top-11 w-52 bg-white text-zinc-900 rounded-xl shadow-lg border border-stone-200 py-1.5 z-50">
                <button
                  type="button"
                  onClick={handleClearChatClick}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-stone-100 flex items-center justify-between cursor-pointer text-amber-900"
                >
                  <span>{uiLang === 'ml' ? 'ചാറ്റ് മായ്ക്കുക' : 'Clear chat'}</span>
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <div className="my-1 border-t border-stone-100" />
                <button
                  type="button"
                  onClick={() => {
                    onToggleLang();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-stone-100 flex items-center justify-between cursor-pointer"
                >
                  <span>Language</span>
                  <span className="font-semibold text-emerald-800">
                    {uiLang === 'en' ? 'മലയാളം' : 'English'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobilePanel('order');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-stone-100 cursor-pointer"
                >
                  Photo Menu &amp; Order Form ({calc.totalPieces})
                </button>
                <div className="my-1 border-t border-stone-100" />
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('queue');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-stone-100 cursor-pointer"
                >
                  Review Queue ({pendingReviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('owner');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-stone-100 cursor-pointer"
                >
                  Owner Controls
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('metrics');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-stone-100 cursor-pointer"
                >
                  7-Day Trial Metrics
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('tests');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-medium hover:bg-stone-100 cursor-pointer"
                >
                  Sample Tests &amp; Setup
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Compact Business Subheader inside the dark-teal chat panel */}
        <div className="hidden md:flex bg-[#0B4D3E] text-white px-4 py-3 items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#E4B45A] text-[#0B4D3E] flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">
                {config.businessName}
              </h1>
              <p className="text-xs text-emerald-100/90 leading-tight truncate">
                Business account · നാടൻ പലഹാരങ്ങൾ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {latestSubmittedOrder && (
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    uiLang === 'ml' ? 'ഓർഡർ കൺഫേം ആയോ?' : 'Is my order confirmed?'
                  )
                }
                className="text-xs text-emerald-100 hover:text-white underline whitespace-nowrap cursor-pointer"
              >
                Status ({latestSubmittedOrder.orderId})
              </button>
            )}
            <button
              type="button"
              aria-label="Talk to a person"
              onClick={() =>
                handleSendMessage(
                  uiLang === 'ml' ? 'ടീമിനോട് സംസാരിക്കണം' : 'Talk to a person'
                )
              }
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scenic Panankayam Bridge Hero Illustration */}
        <PanankayamBridgeBanner serviceAreaLabel="പനങ്കയം പാലത്തിനരികെ · 679334" />

        {/* Chat Stream Container */}
        <div className="flex-1 px-3 py-2.5 space-y-2.5 overflow-y-auto">
          {/* Team Order Decision Banner (Accepted / Needs Follow-up / Rejected) */}
          {teamUpdateNotice && (
            <div
              role="status"
              className={`border rounded-2xl p-3.5 flex items-start justify-between gap-2.5 text-xs shadow-xs ${
                teamUpdateNotice.decision === 'accepted'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : teamUpdateNotice.decision === 'rejected'
                    ? 'bg-red-50 border-red-300 text-red-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {teamUpdateNotice.decision === 'accepted' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      teamUpdateNotice.decision === 'rejected'
                        ? 'text-red-700'
                        : 'text-amber-800'
                    }`}
                  />
                )}
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {teamUpdateNotice.orderId} ·{' '}
                    {teamUpdateNotice.decision === 'accepted'
                      ? uiLang === 'ml'
                        ? 'ടീം സ്വീകരിച്ചു (Accepted)'
                        : 'Accepted by team'
                      : teamUpdateNotice.decision === 'rejected'
                        ? uiLang === 'ml'
                          ? 'ഓർഡർ നിരസിച്ചു (Rejected)'
                          : 'Order rejected'
                        : uiLang === 'ml'
                          ? 'പരിശോധനയിലാണ് (Under Review)'
                          : 'Under review / Needs follow-up'}
                  </p>
                  <p className="font-medium">{teamUpdateNotice.message}</p>
                  {teamUpdateNotice.teamNotes && (
                    <p className="opacity-85">Note: {teamUpdateNotice.teamNotes}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissTeamUpdateNotice}
                aria-label="Dismiss team order update notice"
                className="text-[11px] font-medium hover:underline shrink-0 cursor-pointer"
              >
                OK
              </button>
            </div>
          )}

          {/* Submission Confirmation / Non-Confirmation Alert */}
          {lastSubmittedNotice && (
            <div
              role="status"
              className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-950"
            >
              <AlertCircle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {uiLang === 'ml'
                    ? `${lastSubmittedNotice.orderId} · ടീം പരിശോധനയ്ക്ക് സമർപ്പിച്ചു (ഇതുവരെ കൺഫേം ചെയ്തിട്ടില്ല)`
                    : `${lastSubmittedNotice.orderId} · Submitted for review (Not confirmed yet)`}
                </p>
                <p>{uiLang === 'ml' ? lastSubmittedNotice.messageMl : lastSubmittedNotice.messageEn}</p>
              </div>
            </div>
          )}

          {/* Bubble 1: Welcome Message (matches attached screenshot) */}
          <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-xs max-w-[95%]">
            <h2 className="text-[14.5px] font-bold text-[#1B4332] leading-snug">
              നമസ്കാരം! സ്വാഗതം
            </h2>
            <p className="mt-0.5 text-[12.5px] sm:text-[13.5px] text-zinc-800 leading-snug">
              പാത്താർ / പനങ്കയത്തെ മൂന്ന് സ്ത്രീകളുടെ വീട്ടുകളിൽ നിന്ന് ചൂടുള്ള നാടൻ പലഹാരങ്ങൾ. താഴെ ഒന്ന് തിരഞ്ഞെടുക്കൂ.
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-[11.5px] text-zinc-500">
                Fresh home-made Kerala snacks. Tap an option below.
              </p>
              <span className="text-[10px] text-amber-800/75 font-mono tabular-nums shrink-0">
                10:30
              </span>
            </div>
          </div>

          {/* Bubble 2: Today's Snacks Menu Card (matches attached screenshot) */}
          <div className="bg-white rounded-2xl px-3.5 py-2.5 shadow-xs max-w-[95%]">
            <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
              <h2 className="text-[13.5px] font-bold text-zinc-900">ഇന്നത്തെ പലഹാരങ്ങൾ</h2>
              <span className="text-[11px] text-zinc-400">Today</span>
            </div>

            <div className="divide-y divide-stone-100">
              {visibleMenuRows.map((item) => {
                const qty = draft.items.find((i) => i.itemId === item.id)?.quantity ?? 0;
                const shortName = item.nameMl.replace(/\s*\(100.*\)/, item.id === 'pakkavada' ? ' (100 ഗ്രാം)' : '');
                const subtitle =
                  item.availability === 'unknown'
                    ? `${item.nameEn} · ടീമിനോട് ചോദിക്കുക`
                    : MENU_ROW_SUBTITLES[item.id] || item.roleNoteMl;

                return (
                  <div
                    key={item.id}
                    className="py-1.5 sm:py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] sm:text-sm font-semibold text-zinc-900 flex items-center gap-2 leading-tight">
                        <span className="truncate">{shortName}</span>
                        <span className="text-[12.5px] font-semibold font-mono tabular-nums text-[#C97A16] shrink-0">
                          {item.price !== null ? `₹${item.price}` : 'TBC'}
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">{subtitle}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Remove ${item.nameEn} from menu`}
                        onClick={() => adjustMenuQuantity(item, -1)}
                        disabled={qty === 0}
                        className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-zinc-800 hover:bg-stone-100 disabled:opacity-35 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        inputMode="numeric"
                        aria-label={`Quantity for ${item.nameEn}`}
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                          setMenuQuantity(item, val);
                        }}
                        className="w-10 h-7 text-center text-xs font-semibold font-mono tabular-nums text-zinc-900 bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                      <button
                        type="button"
                        aria-label={`Add ${item.nameEn} from menu`}
                        onClick={() => adjustMenuQuantity(item, 1)}
                        className="w-7 h-7 rounded-lg bg-[#0B4D3E] hover:bg-emerald-900 text-white flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {unavailableMenuRows.length > 0 && (
              <div className="mt-1 pt-1.5 border-t border-stone-100 flex items-center justify-between text-[10.5px] text-zinc-500">
                <span>
                  Week 2 / unavailable: {unavailableMenuRows.map((u) => u.nameMl).join(', ')}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage(
                      uiLang === 'ml'
                        ? `${unavailableMenuRows[0].nameMl} ലഭ്യമാണോ?`
                        : `Is ${unavailableMenuRows[0].nameEn} available?`
                    )
                  }
                  className="text-emerald-800 font-medium hover:underline cursor-pointer"
                >
                  Ask
                </button>
              </div>
            )}
          </div>

          {/* 2x2 Quick Action Buttons (matches attached screenshot) */}
          <div className="grid grid-cols-2 gap-2 max-w-[95%]">
            <button
              type="button"
              onClick={() => {
                if (calc.totalPieces > 0) {
                  setMobilePanel('order');
                } else {
                  handleSendMessage(uiLang === 'ml' ? 'ഓർഡർ ചെയ്യാം' : 'Place an order');
                }
              }}
              className="min-h-[48px] px-3 py-2 bg-white hover:bg-stone-50 rounded-xl shadow-xs text-center flex flex-col items-center justify-center transition-colors cursor-pointer"
            >
              <span className="text-[13px] font-semibold text-zinc-900 leading-tight">
                ഓർഡർ ചെയ്യാം
              </span>
              <span className="text-[11px] text-zinc-500 leading-tight">Order now</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleSendMessage(uiLang === 'ml' ? 'ഇന്നത്തെ മെനു കാണുക' : 'See today’s menu');
                setMobilePanel('order');
              }}
              className="min-h-[48px] px-3 py-2 bg-white hover:bg-stone-50 rounded-xl shadow-xs text-center flex flex-col items-center justify-center transition-colors cursor-pointer"
            >
              <span className="text-[13px] font-semibold text-zinc-900 leading-tight">
                മുഴുവൻ മെനു
              </span>
              <span className="text-[11px] text-zinc-500 leading-tight">Full menu</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  uiLang === 'ml' ? 'പരിപാടിക്ക് ബൾക്ക് ഓർഡർ വേണം' : 'Book for an event'
                )
              }
              className="min-h-[48px] px-3 py-2 bg-white hover:bg-stone-50 rounded-xl shadow-xs text-center flex flex-col items-center justify-center transition-colors cursor-pointer"
            >
              <span className="text-[13px] font-semibold text-zinc-900 leading-tight">
                പരിപാടി ഓർഡർ
              </span>
              <span className="text-[11px] text-zinc-500 leading-tight">Events &amp; bulk</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSendMessage(uiLang === 'ml' ? 'ലൊക്കേഷൻ' : 'Panankayam 679334')
              }
              className="min-h-[48px] px-3 py-2 bg-white hover:bg-stone-50 rounded-xl shadow-xs text-center flex flex-col items-center justify-center transition-colors cursor-pointer"
            >
              <span className="text-[13px] font-semibold text-zinc-900 leading-tight">
                ലൊക്കേഷൻ
              </span>
              <span className="text-[11px] text-zinc-500 leading-tight">Panankayam 679334</span>
            </button>
          </div>

          {/* Active Draft Banner inside chat when items selected on mobile */}
          {calc.totalPieces > 0 && (
            <div className="lg:hidden bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 max-w-[95%]">
              <div className="text-xs text-emerald-950 whitespace-nowrap">
                <strong className="font-semibold font-mono tabular-nums">
                  {uiLang === 'ml'
                    ? `${calc.totalPieces} എണ്ണം`
                    : `${calc.totalPieces} items`}
                </strong>{' '}
                ·{' '}
                <span className="font-mono tabular-nums font-semibold">
                  {calc.subtotal !== null
                    ? `₹${calc.subtotal}`
                    : uiLang === 'ml'
                      ? 'വില TBC'
                      : 'TBC'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobilePanel('order')}
                className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {uiLang === 'ml' ? 'പരിശോധിച്ച് സമർപ്പിക്കുക' : 'Review & Submit'}
              </button>
            </div>
          )}

          {/* Live Dynamic Chat Turns */}
          {dynamicMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'customer' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] whitespace-pre-line leading-relaxed shadow-xs ${
                  msg.sender === 'customer'
                    ? 'bg-[#D9FDD3] text-zinc-900 rounded-tr-sm'
                    : 'bg-white text-zinc-900 rounded-tl-sm'
                }`}
              >
                {msg.text}
                <span className="block text-right text-[10px] text-zinc-500 mt-1 font-mono tabular-nums">
                  {msg.timestamp}
                </span>
              </div>

              {msg.handoffSuggested && msg.handoffReason && (
                <p className="mt-1 text-[11px] text-amber-200 font-medium px-1">
                  {uiLang === 'ml'
                    ? 'ടീം പരിശോധന ആവശ്യമാണ് — ജീവനക്കാർ ബന്ധപ്പെടും.'
                    : `Team handoff: ${msg.handoffReason}`}
                </p>
              )}

              {msg.canSubmitReview && (
                <button
                  type="button"
                  onClick={() => setMobilePanel('order')}
                  className="lg:hidden mt-2 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-100 text-amber-950 text-xs font-semibold cursor-pointer"
                >
                  {uiLang === 'ml'
                    ? 'ഓർഡർ സംഗ്രഹം പരിശോധിച്ച് സമർപ്പിക്കുക'
                    : 'Open Order Summary to Submit'}
                </button>
              )}

              {msg.quickReplies && msg.quickReplies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.quickReplies.map((qr) => (
                    <button
                      key={qr.label}
                      type="button"
                      onClick={() => handleSendMessage(qr.value)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-xl bg-white text-emerald-950 hover:bg-stone-100 shadow-xs cursor-pointer"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Bottom Chat Input Bar: input pill + Clear chat on the left of Send button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="sticky bottom-0 z-20 px-3 py-2.5 bg-[#144B41] flex items-center gap-2 border-t border-white/10"
        >
          <div className="flex-1 min-w-0 bg-white rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-xs">
            <label htmlFor="customer-chat-input" className="sr-only">
              Type your snack order in Malayalam or English
            </label>
            <input
              id="customer-chat-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="സന്ദേശം ടൈപ്പ് ചെയ്യൂ..."
              className="flex-1 min-w-0 min-h-[36px] text-sm text-zinc-900 placeholder:text-zinc-500 bg-transparent focus:outline-none"
            />
            <button
              type="button"
              aria-label="Open order summary and menu"
              onClick={() => setMobilePanel('order')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-800 relative shrink-0 cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
              {calc.totalPieces > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-800 text-white text-[9px] font-mono tabular-nums flex items-center justify-center">
                  {calc.totalPieces}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleClearChatClick}
            aria-label={uiLang === 'ml' ? 'ചാറ്റ് മായ്ക്കുക' : 'Clear chat'}
            title={uiLang === 'ml' ? 'ചാറ്റ് മായ്ക്കുക' : 'Clear chat'}
            className="min-h-[44px] px-2.5 sm:px-3 py-2 rounded-full bg-white/12 hover:bg-white/22 border border-white/15 text-emerald-50 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">{uiLang === 'ml' ? 'മായ്ക്കുക' : 'Clear'}</span>
            <span className="hidden sm:inline">{uiLang === 'ml' ? 'ചാറ്റ് മായ്ക്കുക' : 'Clear chat'}</span>
          </button>

          <button
            type="submit"
            aria-label="Send message"
            className="w-11 h-11 rounded-full bg-[#C2602D] hover:bg-[#A95023] text-white flex items-center justify-center shadow-sm shrink-0 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>

      {/* RIGHT COLUMN (Desktop sidebar + Mobile expandable Photo Menu & 7-Field Order Request Form) */}
      <aside
        aria-label="Order Draft, Photo Menu & Itemized Summary"
        className={`${
          mobilePanel === 'order' ? 'block' : 'hidden lg:block'
        } lg:col-span-5 space-y-5 px-4 py-4 lg:p-0`}
      >
        {/* Mobile Back to Chat Header inside Order Sheet */}
        <div className="lg:hidden flex items-center justify-between pb-3 border-b border-stone-200">
          <button
            type="button"
            onClick={() => setMobilePanel('chat')}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-zinc-900 flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Chat
          </button>
          <span className="text-xs font-medium text-zinc-600 tabular-nums">
            {calc.totalPieces} selected
          </span>
        </div>

        {/* Opening Hours & Trial Assumption Strip */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-start gap-2.5 text-xs text-zinc-700">
          <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            {config.openingHours.trim() ? (
              <span>
                <strong className="text-zinc-900">Opening hours:</strong> {config.openingHours}
                {!config.openingHoursVerified && ' · Unverified trial setting'}
              </span>
            ) : (
              <span>
                <strong className="text-amber-800">Opening hours not configured yet.</strong>{' '}
                Orders are submitted for team review — never auto-confirmed.
              </span>
            )}
            <p className="mt-1 text-zinc-500">
              Cutoff: {config.orderCutoff} · Min home order: {config.minHomePieces} pcs or ₹{config.minHomeAmount} (Trial)
            </p>
          </div>
        </div>

        {/* Photo Menu Steppers */}
        <section className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-800" />
              <span>Photo Menu &amp; Quantity</span>
            </h2>
            <span className="text-xs text-zinc-500">Trial prices</span>
          </div>

          <div className="divide-y divide-stone-100">
            {menu.map((item) => {
              const draftQty = draft.items.find((i) => i.itemId === item.id)?.quantity ?? 0;
              const isUnavailable = item.availability === 'unavailable';
              return (
                <div key={item.id} className="py-3 first:pt-1 last:pb-1 flex items-center gap-3">
                  <img
                    src={item.imageUrl}
                    alt={`${item.nameEn} (${item.nameMl})`}
                    referrerPolicy="no-referrer"
                    className={`w-16 h-12 rounded-lg object-cover bg-stone-100 shrink-0 ${
                      isUnavailable ? 'opacity-50 grayscale' : ''
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {uiLang === 'ml' ? item.nameMl : item.nameEn}
                    </p>
                    <p className="text-xs text-zinc-600 font-mono tabular-nums">
                      {item.price !== null ? `₹${item.price}/${item.unitEn}` : 'Price TBC'} ·{' '}
                      <span className={isUnavailable ? 'text-zinc-500' : 'text-emerald-800'}>
                        {item.availability === 'available'
                          ? 'Available'
                          : isUnavailable
                            ? 'Unavailable'
                            : 'Check team'}
                      </span>
                    </p>
                  </div>

                  {isUnavailable ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleSendMessage(
                          uiLang === 'ml'
                            ? `${item.nameMl} ലഭ്യമാണോ?`
                            : `Is ${item.nameEn} available?`
                        );
                        setMobilePanel('chat');
                      }}
                      className="min-h-[40px] px-2.5 py-1 text-[11px] font-medium rounded-lg border border-stone-200 text-zinc-700 hover:bg-stone-50 shrink-0 cursor-pointer"
                    >
                      Ask team
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.nameEn}`}
                        onClick={() => adjustMenuQuantity(item, -1)}
                        disabled={draftQty === 0}
                        className="min-h-[40px] min-w-[40px] rounded-lg border border-stone-200 flex items-center justify-center text-zinc-800 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        inputMode="numeric"
                        aria-label={`Photo menu quantity for ${item.nameEn}`}
                        value={draftQty === 0 ? '' : draftQty}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                          setMenuQuantity(item, val);
                        }}
                        className="w-12 h-10 text-center text-sm font-semibold font-mono tabular-nums text-zinc-900 bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${item.nameEn}`}
                        onClick={() => adjustMenuQuantity(item, 1)}
                        className="min-h-[40px] min-w-[40px] rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Itemized Summary & 7-Field Order Submission Form */}
        <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                {uiLang === 'ml' ? 'ഓർഡർ സംഗ്രഹം' : 'Order Request Summary'}
              </h2>
              <p className="text-xs text-zinc-600">
                Status: Draft · Reviewed by team before confirmation
              </p>
            </div>
            {calc.lines.length > 0 && (
              <button
                type="button"
                onClick={onResetDraft}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {calc.lines.length > 0 && (
            <div className="space-y-2 text-sm">
              {calc.lines.map((line) => (
                <div
                  key={line.itemId}
                  className="flex justify-between py-1 border-b border-stone-100"
                >
                  <span className="text-zinc-800">
                    {line.quantity} × {uiLang === 'ml' ? line.nameMl : line.nameEn}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-900">
                    {line.lineTotal !== null ? `₹${line.lineTotal}` : 'TBC'}
                  </span>
                </div>
              ))}
              <div className="pt-1 space-y-1 text-xs text-zinc-600 font-mono tabular-nums">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{calc.subtotal !== null ? `₹${calc.subtotal}` : 'Team check'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery fee</span>
                  <span>
                    {draft.fulfillment !== 'delivery'
                      ? 'Pickup (₹0)'
                      : calc.deliveryFee !== null
                        ? `₹${calc.deliveryFee}`
                        : 'Not configured'}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-zinc-900 pt-1.5 border-t border-stone-200">
                  <span>Estimated Total</span>
                  <span>{calc.total !== null ? `₹${calc.total}` : 'Pending review'}</span>
                </div>
              </div>
            </div>
          )}

          {calc.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              {calc.warnings.map((w, idx) => (
                <p key={idx} className="text-xs text-amber-900">
                  • {w}
                </p>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmitForReview} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="order-name" className="block text-xs font-medium text-zinc-700 mb-1">
                  1. Customer name *
                </label>
                <input
                  id="order-name"
                  type="text"
                  value={draft.customerName}
                  onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
                  placeholder="e.g. Ramesh / രമേശ്"
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
              <div>
                <label htmlFor="order-contact" className="block text-xs font-medium text-zinc-700 mb-1">
                  2. Phone / WhatsApp *
                </label>
                <input
                  id="order-contact"
                  type="text"
                  value={draft.contact}
                  onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div>
              <label htmlFor="order-datetime" className="block text-xs font-medium text-zinc-700 mb-1">
                4. Requested date &amp; time *
              </label>
              <input
                id="order-datetime"
                type="text"
                value={draft.requestedDateTime}
                onChange={(e) => setDraft({ ...draft, requestedDateTime: e.target.value })}
                placeholder="e.g. Tomorrow 4:30 PM"
                className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-zinc-700 mb-1.5">
                5. Pickup or Delivery *
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, fulfillment: 'pickup', outsideDeliveryAreaFlag: false })
                  }
                  className={`min-h-[44px] px-3 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                    draft.fulfillment === 'pickup'
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-stone-50 text-zinc-800 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, fulfillment: 'delivery' })}
                  className={`min-h-[44px] px-3 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                    draft.fulfillment === 'delivery'
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-stone-50 text-zinc-800 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  Delivery (~{config.deliveryRadiusKm} km)
                </button>
              </div>
            </div>

            {draft.fulfillment === 'delivery' && (
              <div className="space-y-3 pt-1">
                <div>
                  <label htmlFor="order-address" className="block text-xs font-medium text-zinc-700 mb-1">
                    6a. Delivery address *
                  </label>
                  <input
                    id="order-address"
                    type="text"
                    value={draft.deliveryAddress}
                    onChange={(e) => setDraft({ ...draft, deliveryAddress: e.target.value })}
                    placeholder="House name / Road in Panankayam or Pathar"
                    className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label htmlFor="order-landmark" className="block text-xs font-medium text-zinc-700 mb-1">
                    6b. Nearby landmark *
                  </label>
                  <input
                    id="order-landmark"
                    type="text"
                    value={draft.landmark}
                    onChange={(e) => setDraft({ ...draft, landmark: e.target.value })}
                    placeholder="e.g. Near Pathar LP School"
                    className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>
            )}

            <div>
              <span className="block text-xs font-medium text-zinc-700 mb-1.5">
                7. Order type
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, orderCategory: 'regular' })}
                  className={`min-h-[44px] px-3 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                    draft.orderCategory === 'regular'
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-stone-50 text-zinc-800 border-stone-200'
                  }`}
                >
                  Regular Home Order
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, orderCategory: 'bulk_event' })}
                  className={`min-h-[44px] px-3 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                    draft.orderCategory === 'bulk_event'
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-stone-50 text-zinc-800 border-stone-200'
                  }`}
                >
                  Bulk / Event ({config.bulkMinPieces}–{config.bulkMaxPieces})
                </button>
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {uiLang === 'ml' ? 'ടീം പരിശോധനയ്ക്ക് സമർപ്പിക്കുക' : 'Submit for Team Review'}
              </span>
            </button>

            <p className="text-[11px] text-zinc-500 text-center">
              Prototype notice: Does not send WhatsApp messages, take payments, or auto-confirm orders.
            </p>
          </form>
        </section>
      </aside>
    </div>
  );
};
