import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import { DailyTrialMetric, SubmittedOrder } from '../types/business';
import { computeTrialSummary } from '../utils/metrics';

interface TrialMetricsViewProps {
  metrics: DailyTrialMetric[];
  orders: SubmittedOrder[];
  onUpdateMetrics: (nextMetrics: DailyTrialMetric[]) => void;
}

export const TrialMetricsView: React.FC<TrialMetricsViewProps> = ({
  metrics,
  orders,
  onUpdateMetrics,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const summary = computeTrialSummary(metrics);
  const activeDay = metrics.find((d) => d.dayIndex === selectedDay) || metrics[0];

  const liveQueueSubmitted = orders.filter((o) => !o.isDemoData).length;
  const liveQueueAccepted = orders.filter(
    (o) => !o.isDemoData && o.status === 'Accepted by team'
  ).length;

  const updateDayField = (
    dayIndex: number,
    field: keyof DailyTrialMetric,
    rawValue: string
  ) => {
    setSaveNotice(null);
    const next = metrics.map((d) => {
      if (d.dayIndex !== dayIndex) return d;
      if (field === 'ownerNotes' || field === 'dateLabel') {
        return { ...d, [field]: rawValue, isDemoData: false };
      }
      const numVal = rawValue.trim() === '' ? null : Number(rawValue);
      return {
        ...d,
        [field]: numVal !== null && Number.isNaN(numVal) ? null : numVal,
        isDemoData: false,
      };
    });
    onUpdateMetrics(next);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">
            Seven-Day Trial Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Focused on net profit per order, direct vs. shop comparison, and paid work / earnings per woman — not message volume alone.
          </p>
        </div>

        <div className="text-xs text-zinc-700 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 max-w-md">
          <strong className="text-zinc-900">Data Transparency:</strong> Days 1–2 show sample demo baseline figures; Days 3–7 remain blank until entered by the team. Missing fields are never fabricated.
        </div>
      </section>

      {/* Primary KPI Strip: Net Profit & Paid Work Per Woman First */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>Profit per accepted order</span>
            <TrendingUp className="w-4 h-4 text-emerald-800" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {summary.profitPerAcceptedOrderRs !== null
              ? `₹${summary.profitPerAcceptedOrderRs}`
              : 'Missing data'}
          </p>
          <p className="text-xs text-zinc-500">
            Based on {summary.enteredDaysCount}/{summary.totalDaysCount} entered days
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>Est. earnings per woman / day</span>
            <Users className="w-4 h-4 text-emerald-800" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {summary.avgEarningsPerWomanRs !== null
              ? `₹${summary.avgEarningsPerWomanRs}`
              : 'Missing data'}
          </p>
          <p className="text-xs text-zinc-500 tabular-nums">
            Total paid hours logged:{' '}
            {summary.totalWomenPaidHours !== null ? `${summary.totalWomenPaidHours} hrs` : 'Missing'}
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1">
          <p className="text-xs font-medium text-zinc-600">Direct vs. Shop Profit</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {summary.totalDirectProfitRs !== null ? `₹${summary.totalDirectProfitRs}` : 'Missing'}
            <span className="text-sm font-normal text-zinc-500">
              {' '}
              vs {summary.totalShopProfitRs !== null ? `₹${summary.totalShopProfitRs}` : 'Missing'}
            </span>
          </p>
          <p className="text-xs text-zinc-500 tabular-nums">
            {summary.directVsShopDiffRs !== null
              ? `Difference on entered days: ${summary.directVsShopDiffRs >= 0 ? '+' : ''}₹${summary.directVsShopDiffRs}`
              : 'Enter both profit lines to compare'}
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-1">
          <p className="text-xs font-medium text-zinc-600">Orders, Waste & Delivery Cost</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {summary.totalTeamAcceptedOrders ?? 0}
            <span className="text-sm font-normal text-zinc-500">
              {' '}
              accepted · {summary.totalWastePieces ?? '—'} waste pcs
            </span>
          </p>
          <p className="text-xs text-zinc-500 tabular-nums">
            Live session queue: {liveQueueSubmitted} submitted, {liveQueueAccepted} accepted · Delivery cost:{' '}
            {summary.totalDeliveryCostRs !== null ? `₹${summary.totalDeliveryCostRs}` : 'Missing'}
          </p>
        </div>
      </section>

      {/* Missing Data Alert */}
      {summary.missingFieldsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-800 shrink-0" />
          <span className="tabular-nums">
            {summary.missingFieldsCount} daily metric fields across the 7-day log are currently blank (&ldquo;Missing&rdquo;). No trial success is claimed until all 7 days of real data are entered.
          </span>
        </div>
      )}

      {/* 7-Day Table */}
      <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Daily Log (Days 1–7)</h2>
          <span className="text-xs text-zinc-500">Tap any day row to edit below</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-zinc-600">
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Day</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Enquiries</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Submitted</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Accepted</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Repeat</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Avg Order</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Waste</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Del. Cost</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Direct Profit</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Shop Profit</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Paid Hrs</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">₹/Woman</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-mono tabular-nums">
              {metrics.map((day) => {
                const isSelected = day.dayIndex === selectedDay;
                const fmt = (v: number | null, prefix = '') =>
                  v === null ? <span className="text-zinc-400 font-sans">Missing</span> : `${prefix}${v}`;
                return (
                  <tr
                    key={day.dayIndex}
                    onClick={() => setSelectedDay(day.dayIndex)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-50/70' : 'hover:bg-stone-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans font-medium text-zinc-900 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedDay(day.dayIndex)}
                        className="text-left hover:underline cursor-pointer"
                      >
                        {day.dateLabel}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.enquiries)}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.submittedRequests)}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.teamAcceptedOrders)}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.repeatCustomers)}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.averageOrderSizeRs, '₹')}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.wasteUnsoldPieces)}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.deliveryCostRs, '₹')}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-900">
                      {fmt(day.directProfitRs, '₹')}
                    </td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.shopProfitRs, '₹')}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(day.womenPaidHours)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-zinc-900">
                      {fmt(day.estimatedEarningsPerWomanRs, '₹')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Owner Daily Metric Entry Editor */}
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Edit {activeDay.dateLabel} Metrics
            </h2>
            <p className="text-xs text-zinc-600">
              Leave blank if not yet recorded — blank fields stay marked as Missing.
            </p>
          </div>
          <div className="flex gap-1">
            {metrics.map((d) => (
              <button
                key={d.dayIndex}
                type="button"
                onClick={() => setSelectedDay(d.dayIndex)}
                className={`min-h-[40px] min-w-[40px] px-2.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer ${
                  d.dayIndex === selectedDay
                    ? 'bg-emerald-800 text-white'
                    : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
                }`}
              >
                D{d.dayIndex}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {(
            [
              ['enquiries', 'Enquiries'],
              ['submittedRequests', 'Submitted requests'],
              ['teamAcceptedOrders', 'Team-accepted orders'],
              ['repeatCustomers', 'Repeat customers'],
              ['averageOrderSizeRs', 'Avg order size (₹)'],
              ['wasteUnsoldPieces', 'Waste / unsold (pcs)'],
              ['deliveryCostRs', 'Delivery cost (₹)'],
              ['directProfitRs', 'Direct-order profit (₹)'],
              ['shopProfitRs', 'Shop-order profit (₹)'],
              ['womenPaidHours', 'Women paid hours'],
              ['womenCount', 'Women working (count)'],
              ['estimatedEarningsPerWomanRs', 'Est. earnings / woman (₹)'],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label
                htmlFor={`metric-${activeDay.dayIndex}-${field}`}
                className="block font-medium text-zinc-700 mb-1"
              >
                {label}
              </label>
              <input
                id={`metric-${activeDay.dayIndex}-${field}`}
                type="number"
                step="any"
                value={activeDay[field] ?? ''}
                onChange={(e) => updateDayField(activeDay.dayIndex, field, e.target.value)}
                placeholder="Missing"
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between pt-2">
          <div className="flex-1">
            <label
              htmlFor={`metric-notes-${activeDay.dayIndex}`}
              className="block text-xs font-medium text-zinc-700 mb-1"
            >
              Day {activeDay.dayIndex} owner notes
            </label>
            <input
              id={`metric-notes-${activeDay.dayIndex}`}
              type="text"
              value={activeDay.ownerNotes}
              onChange={(e) => updateDayField(activeDay.dayIndex, 'ownerNotes', e.target.value)}
              placeholder="Production notes, batch feedback, delivery issues..."
              className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
            />
          </div>
          <button
            type="button"
            onClick={() => setSaveNotice(`Day ${activeDay.dayIndex} figures saved to prototype log.`)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold cursor-pointer shrink-0"
          >
            Confirm Day {activeDay.dayIndex} Entry
          </button>
        </div>

        {saveNotice && (
          <p role="status" className="text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {saveNotice}
          </p>
        )}
      </section>
    </div>
  );
};
