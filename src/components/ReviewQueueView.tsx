import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, XCircle } from 'lucide-react';
import { OrderStatus, SubmittedOrder, TeamDecision } from '../types/business';
import { TEAM_DECISION_MESSAGES } from '../utils/orderRules';

interface ReviewQueueViewProps {
  orders: SubmittedOrder[];
  onUpdateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    decision: TeamDecision,
    teamNotes: string,
    reviewedBy: string
  ) => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  orders,
  onUpdateOrderStatus,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editingReviewer, setEditingReviewer] = useState<Record<string, string>>({});

  const filteredOrders =
    statusFilter === 'ALL' ? orders : orders.filter((o) => o.status === statusFilter);

  const counts = {
    ALL: orders.length,
    'Submitted for review': orders.filter((o) => o.status === 'Submitted for review').length,
    'Accepted by team': orders.filter((o) => o.status === 'Accepted by team').length,
    'Declined or needs follow-up': orders.filter((o) => o.status === 'Declined or needs follow-up')
      .length,
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">
            Team Order Review Queue
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Prototype review sheet · Orders stay &ldquo;Submitted for review&rdquo; until a team member explicitly accepts or marks follow-up.
          </p>
        </div>

        <div className="text-xs text-zinc-700 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 max-w-md">
          <strong className="font-semibold text-zinc-900">Prototype Queue & API Endpoint:</strong>{' '}
          Initial rows marked &ldquo;Demo prototype data&rdquo; are sample entries. Synced via{' '}
          <span className="font-mono">/api/orders</span>; ready for Google Sheets / PostgreSQL webhook integration.
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-stone-200/60 rounded-xl">
        {(
          [
            'ALL',
            'Submitted for review',
            'Accepted by team',
            'Declined or needs follow-up',
          ] as const
        ).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
              statusFilter === tab
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {tab === 'ALL' ? 'All Requests' : tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Queue Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-zinc-600">No orders in this status filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const noteValue = editingNotes[order.orderId] ?? order.teamNotes;
            const reviewerValue = editingReviewer[order.orderId] ?? order.reviewedBy;

            return (
              <article
                key={order.orderId}
                className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4"
              >
                {/* Header Row: Unboxed metadata + clear status text with icon */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-stone-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-zinc-900 tabular-nums">
                        {order.orderId}
                      </span>
                      <span className="text-zinc-400" aria-hidden="true">·</span>
                      <span className="text-base font-semibold text-zinc-900">
                        {order.customerName}
                      </span>
                      <span className="text-zinc-400" aria-hidden="true">·</span>
                      <span className="text-xs font-medium text-zinc-600">
                        {order.language === 'ml' ? 'Malayalam' : 'English'}
                      </span>
                      {order.isDemoData && (
                        <>
                          <span className="text-zinc-400" aria-hidden="true">·</span>
                          <span className="text-xs text-zinc-500">Demo prototype data</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 mt-1 font-mono tabular-nums">
                      Submitted {order.submittedAt} · Contact: {order.contact}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                    {order.status === 'Submitted for review' && (
                      <span className="text-amber-800 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        Submitted for review (Not confirmed)
                      </span>
                    )}
                    {order.status === 'Accepted by team' && (
                      <span className="text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Accepted by team
                      </span>
                    )}
                    {order.status === 'Declined or needs follow-up' && (
                      <span className="text-red-700 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        {order.teamDecision === 'rejected'
                          ? 'Rejected by team'
                          : 'Declined or needs follow-up'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {/* Items & Totals */}
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-zinc-500">Items & Totals</h3>
                    {order.items.length === 0 ? (
                      <p className="text-xs text-zinc-600">No snack lines — enquiry / handoff only</p>
                    ) : (
                      <ul className="space-y-1">
                        {order.items.map((it) => (
                          <li key={it.itemId} className="flex justify-between text-xs text-zinc-800">
                            <span>
                              {it.quantity} × {it.nameEn}
                            </span>
                            <span className="font-mono tabular-nums">
                              {it.lineTotal !== null ? `₹${it.lineTotal}` : 'TBC'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="pt-1.5 border-t border-stone-100 text-xs space-y-0.5 font-mono tabular-nums">
                      <div className="flex justify-between text-zinc-600">
                        <span>Subtotal</span>
                        <span>{order.subtotal !== null ? `₹${order.subtotal}` : 'TBC'}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Delivery fee</span>
                        <span>
                          {order.fulfillment !== 'delivery'
                            ? 'Pickup'
                            : order.deliveryFee !== null
                              ? `₹${order.deliveryFee}`
                              : 'Not configured'}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-zinc-900">
                        <span>Total</span>
                        <span>{order.total !== null ? `₹${order.total}` : 'Pending review'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fulfillment & Event Info */}
                  <div className="space-y-1.5 text-xs text-zinc-700">
                    <h3 className="text-xs font-semibold text-zinc-500">Timing & Fulfillment</h3>
                    <p>
                      <strong className="text-zinc-900">Requested:</strong> {order.requestedDateTime}
                    </p>
                    <p>
                      <strong className="text-zinc-900">Mode:</strong>{' '}
                      {order.fulfillment === 'delivery'
                        ? 'Delivery'
                        : order.fulfillment === 'pickup'
                          ? 'Pickup'
                          : 'Not chosen yet'}
                    </p>
                    {order.fulfillment === 'delivery' && (
                      <p>
                        <strong className="text-zinc-900">Address:</strong>{' '}
                        {order.deliveryAddress || 'Missing'} · Landmark:{' '}
                        {order.landmark || 'Missing'}
                      </p>
                    )}
                    <p>
                      <strong className="text-zinc-900">Order type:</strong>{' '}
                      {order.orderCategory === 'bulk_event' ? 'Bulk / Event' : 'Regular home order'}
                    </p>
                    <p>
                      <strong className="text-zinc-900">Advance status:</strong>{' '}
                      {order.bulkAdvanceStatus}
                    </p>
                  </div>

                  {/* Missing Details & Handoff Flags */}
                  <div className="space-y-1.5 text-xs">
                    <h3 className="text-xs font-semibold text-zinc-500">
                      Handoff & Missing Details
                    </h3>
                    {order.handoffReason ? (
                      <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-800" />
                        <span>{order.handoffReason}</span>
                      </p>
                    ) : (
                      <p className="text-zinc-600">No handoff escalation flagged.</p>
                    )}
                    {order.missingDetails.length > 0 && (
                      <p className="text-zinc-700">
                        <strong className="text-zinc-900">To verify:</strong>{' '}
                        {order.missingDetails.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Team Review Controls */}
                <div className="pt-3 border-t border-stone-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label
                      htmlFor={`notes-${order.orderId}`}
                      className="block text-xs font-medium text-zinc-700 mb-1"
                    >
                      Team notes
                    </label>
                    <input
                      id={`notes-${order.orderId}`}
                      type="text"
                      value={noteValue}
                      onChange={(e) =>
                        setEditingNotes((prev) => ({ ...prev, [order.orderId]: e.target.value }))
                      }
                      placeholder="Availability check, frying time, or follow-up note"
                      className="w-full min-h-[44px] px-3 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label
                      htmlFor={`reviewer-${order.orderId}`}
                      className="block text-xs font-medium text-zinc-700 mb-1"
                    >
                      Reviewed by (person)
                    </label>
                    <input
                      id={`reviewer-${order.orderId}`}
                      type="text"
                      value={reviewerValue}
                      onChange={(e) =>
                        setEditingReviewer((prev) => ({
                          ...prev,
                          [order.orderId]: e.target.value,
                        }))
                      }
                      placeholder="e.g. Amina / Razia"
                      className="w-full min-h-[44px] px-3 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div className="md:col-span-12 lg:col-span-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateOrderStatus(
                          order.orderId,
                          'Accepted by team',
                          'accepted',
                          noteValue,
                          reviewerValue || 'Team Member'
                        )
                      }
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Accept by Team
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateOrderStatus(
                          order.orderId,
                          'Declined or needs follow-up',
                          'needs_followup',
                          noteValue,
                          reviewerValue || 'Team Member'
                        )
                      }
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      Needs Follow-up
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateOrderStatus(
                          order.orderId,
                          'Declined or needs follow-up',
                          'rejected',
                          noteValue,
                          reviewerValue || 'Team Member'
                        )
                      }
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-900 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject the Order
                    </button>
                  </div>
                </div>

                {(order.status === 'Accepted by team' ||
                  order.status === 'Declined or needs follow-up') && (
                  <p
                    className={`text-xs border rounded-xl px-3.5 py-2.5 flex items-center gap-2 ${
                      order.status === 'Accepted by team'
                        ? 'text-emerald-900 bg-emerald-50 border-emerald-200'
                        : order.teamDecision === 'rejected'
                          ? 'text-red-900 bg-red-50 border-red-200'
                          : 'text-amber-950 bg-amber-50 border-amber-200'
                    }`}
                  >
                    {order.status === 'Accepted by team' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" />
                    ) : (
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${
                          order.teamDecision === 'rejected' ? 'text-red-700' : 'text-amber-800'
                        }`}
                      />
                    )}
                    <span>
                      Delivered to customer chat (prototype WhatsApp preview):{' '}
                      <strong>
                        &ldquo;
                        {order.status === 'Accepted by team'
                          ? TEAM_DECISION_MESSAGES.accepted
                          : order.teamDecision === 'rejected'
                            ? TEAM_DECISION_MESSAGES.rejected
                            : TEAM_DECISION_MESSAGES.needs_followup}
                        &rdquo;
                      </strong>
                    </span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
