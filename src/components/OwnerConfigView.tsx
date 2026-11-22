import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { AvailabilityState, BusinessConfig, MenuItem } from '../types/business';

interface OwnerConfigViewProps {
  config: BusinessConfig;
  menu: MenuItem[];
  onSaveOwnerChanges: (nextConfig: BusinessConfig, nextMenu: MenuItem[]) => void;
}

export const OwnerConfigView: React.FC<OwnerConfigViewProps> = ({
  config,
  menu,
  onSaveOwnerChanges,
}) => {
  const [draftConfig, setDraftConfig] = useState<BusinessConfig>(config);
  const [draftMenu, setDraftMenu] = useState<MenuItem[]>(menu);
  const [savedByPerson, setSavedByPerson] = useState(config.lastSavedBy || '');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraftConfig(config);
    setDraftMenu(menu);
  }, [config, menu]);

  const unverifiedItemsCount =
    draftMenu.filter((m) => !m.priceVerified || m.price === null || m.availability === 'unknown')
      .length +
    (!draftConfig.openingHours.trim() || !draftConfig.openingHoursVerified ? 1 : 0) +
    (!draftConfig.deliveryAreaVerified ? 1 : 0) +
    (!draftConfig.deliveryFeeVerified ? 1 : 0) +
    (!draftConfig.orderCutoffVerified ? 1 : 0) +
    (!draftConfig.minHomeVerified ? 1 : 0) +
    (!draftConfig.bulkPolicyVerified ? 1 : 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    if (!savedByPerson.trim()) {
      setSaveError('Please enter the name of the owner or team member saving these changes.');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const updatedConfig: BusinessConfig = {
      ...draftConfig,
      lastSavedAt: timestamp,
      lastSavedBy: savedByPerson.trim(),
    };

    onSaveOwnerChanges(updatedConfig, draftMenu);
    setSaveMessage(`Saved by ${savedByPerson.trim()} at ${timestamp}. Customer menu & rules updated.`);
  };

  const updateMenuField = <K extends keyof MenuItem>(
    itemId: string,
    field: K,
    value: MenuItem[K]
  ) => {
    setDraftMenu((prev) =>
      prev.map((m) => (m.id === itemId ? { ...m, [field]: value } : m))
    );
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900">
            Owner Configuration & Daily Availability
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Changes only take effect when saved by a person. Unverified items remain marked as trial assumptions.
          </p>
        </div>

        <div className="text-xs font-medium bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3.5 py-2.5 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-800" />
          <span className="tabular-nums">
            {unverifiedItemsCount} rule/price item{unverifiedItemsCount === 1 ? '' : 's'} not yet configured or locally verified
          </span>
        </div>
      </section>

      {/* Business Rules & Policies */}
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-5">
        <h2 className="text-lg font-semibold text-zinc-900 border-b border-stone-100 pb-2.5">
          Business Rules & Policies (Trial Assumptions)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Opening Hours */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="cfg-hours" className="text-sm font-medium text-zinc-900">
                Opening hours
              </label>
              <span className={`text-xs font-medium ${draftConfig.openingHours.trim() && draftConfig.openingHoursVerified ? 'text-emerald-800' : 'text-amber-800'}`}>
                {!draftConfig.openingHours.trim()
                  ? 'Not configured'
                  : draftConfig.openingHoursVerified
                    ? 'Verified locally'
                    : 'Configured · Unverified'}
              </span>
            </div>
            <input
              id="cfg-hours"
              type="text"
              value={draftConfig.openingHours}
              onChange={(e) => setDraftConfig({ ...draftConfig, openingHours: e.target.value })}
              placeholder="NOT PROVIDED — e.g. 8:00 AM – 6:30 PM"
              className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.openingHoursVerified}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, openingHoursVerified: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-800"
              />
              Owner verified opening hours locally
            </label>
          </div>

          {/* Order Cutoff */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="cfg-cutoff" className="text-sm font-medium text-zinc-900">
                Order cutoff
              </label>
              <span className={`text-xs font-medium ${draftConfig.orderCutoffVerified ? 'text-emerald-800' : 'text-amber-800'}`}>
                {draftConfig.orderCutoffVerified ? 'Verified locally' : 'Trial assumption'}
              </span>
            </div>
            <input
              id="cfg-cutoff"
              type="text"
              value={draftConfig.orderCutoff}
              onChange={(e) => setDraftConfig({ ...draftConfig, orderCutoff: e.target.value })}
              className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.orderCutoffVerified}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, orderCutoffVerified: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-800"
              />
              Owner verified cutoff timing
            </label>
          </div>

          {/* Delivery Area & Fee */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="cfg-radius" className="text-sm font-medium text-zinc-900">
                Delivery radius (km) & Delivery fee (₹)
              </label>
              <span className={`text-xs font-medium ${draftConfig.deliveryAreaVerified && draftConfig.deliveryFeeVerified ? 'text-emerald-800' : 'text-amber-800'}`}>
                {draftConfig.deliveryFee === null ? 'Fee not configured' : draftConfig.deliveryFeeVerified ? 'Verified locally' : 'Trial assumption'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cfg-radius" className="block text-[11px] text-zinc-500 mb-1">
                  Approx. radius (km)
                </label>
                <input
                  id="cfg-radius"
                  type="number"
                  min={1}
                  max={25}
                  value={draftConfig.deliveryRadiusKm}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      deliveryRadiusKm: Math.max(1, Number(e.target.value) || 3),
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
                />
              </div>
              <div>
                <label htmlFor="cfg-fee" className="block text-[11px] text-zinc-500 mb-1">
                  Delivery fee ₹ (blank = TBC)
                </label>
                <input
                  id="cfg-fee"
                  type="number"
                  min={0}
                  value={draftConfig.deliveryFee ?? ''}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      deliveryFee: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Not configured"
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.deliveryAreaVerified}
                  onChange={(e) =>
                    setDraftConfig({ ...draftConfig, deliveryAreaVerified: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-800"
                />
                Delivery area verified
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.deliveryFeeVerified}
                  onChange={(e) =>
                    setDraftConfig({ ...draftConfig, deliveryFeeVerified: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-800"
                />
                Delivery fee verified
              </label>
            </div>
          </div>

          {/* Minimum Home Order */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-900">Minimum home order</span>
              <span className={`text-xs font-medium ${draftConfig.minHomeVerified ? 'text-emerald-800' : 'text-amber-800'}`}>
                {draftConfig.minHomeVerified ? 'Verified locally' : 'Trial assumption'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cfg-min-pcs" className="block text-[11px] text-zinc-500 mb-1">
                  Min pieces
                </label>
                <input
                  id="cfg-min-pcs"
                  type="number"
                  min={1}
                  value={draftConfig.minHomePieces}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      minHomePieces: Math.max(1, Number(e.target.value) || 10),
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
                />
              </div>
              <div>
                <label htmlFor="cfg-min-amt" className="block text-[11px] text-zinc-500 mb-1">
                  OR Min amount (₹)
                </label>
                <input
                  id="cfg-min-amt"
                  type="number"
                  min={0}
                  value={draftConfig.minHomeAmount}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      minHomeAmount: Math.max(0, Number(e.target.value) || 100),
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={draftConfig.minHomeVerified}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, minHomeVerified: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-800"
              />
              Owner verified minimum order rule
            </label>
          </div>

          {/* Bulk Booking Policy */}
          <div className="space-y-2 md:col-span-2 pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-900">
                Bulk / Event booking lead time & deposit policy
              </span>
              <span className={`text-xs font-medium ${draftConfig.bulkPolicyVerified ? 'text-emerald-800' : 'text-amber-800'}`}>
                {draftConfig.bulkPolicyVerified ? 'Verified locally' : 'Trial assumption'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="cfg-bulk-lead" className="block text-[11px] text-zinc-500 mb-1">
                  Lead time
                </label>
                <input
                  id="cfg-bulk-lead"
                  type="text"
                  value={draftConfig.bulkLeadTime}
                  onChange={(e) => setDraftConfig({ ...draftConfig, bulkLeadTime: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
                />
              </div>
              <div>
                <label htmlFor="cfg-bulk-min" className="block text-[11px] text-zinc-500 mb-1">
                  Bulk min pieces
                </label>
                <input
                  id="cfg-bulk-min"
                  type="number"
                  min={10}
                  value={draftConfig.bulkMinPieces}
                  onChange={(e) =>
                    setDraftConfig({ ...draftConfig, bulkMinPieces: Number(e.target.value) || 50 })
                  }
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
                />
              </div>
              <div>
                <label htmlFor="cfg-bulk-adv" className="block text-[11px] text-zinc-500 mb-1">
                  Advance requested (%)
                </label>
                <input
                  id="cfg-bulk-adv"
                  type="number"
                  min={0}
                  max={100}
                  value={draftConfig.bulkAdvancePercent}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      bulkAdvancePercent: Number(e.target.value) || 50,
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50 focus:bg-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.bulkPolicyVerified}
                  onChange={(e) =>
                    setDraftConfig({ ...draftConfig, bulkPolicyVerified: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-800"
                />
                Owner verified bulk policy
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.bulkAdvanceCollectionEnabled}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      bulkAdvanceCollectionEnabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-emerald-800"
                />
                Enable advance policy wording (prototype never collects payment)
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.allergenDisclaimerVerified}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      allergenDisclaimerVerified: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-emerald-800"
                />
                Allergen, ingredient &amp; food-safety details verified locally (otherwise assistant routes questions to team)
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Menu Availability, Stock Limits & Prices */}
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Daily Menu Availability, Stock Limits & Prices
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Set availability to &ldquo;Unknown / Not entered&rdquo; if today&apos;s batch isn&apos;t confirmed yet — the assistant will route requests to the team instead of guessing.
          </p>
        </div>

        <div className="divide-y divide-stone-200">
          {draftMenu.map((item) => (
            <div key={item.id} className="py-4 first:pt-1 last:pb-1 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              <div className="lg:col-span-4">
                <p className="text-sm font-semibold text-zinc-900">
                  {item.nameEn} · {item.nameMl}
                </p>
                <p className="text-xs text-zinc-600">{item.roleNoteEn}</p>
              </div>

              <div className="lg:col-span-3">
                <label htmlFor={`avail-${item.id}`} className="block text-[11px] text-zinc-500 mb-1">
                  Today&apos;s availability
                </label>
                <select
                  id={`avail-${item.id}`}
                  value={item.availability}
                  onChange={(e) =>
                    updateMenuField(item.id, 'availability', e.target.value as AvailabilityState)
                  }
                  className="w-full min-h-[44px] px-3 py-2 text-xs font-medium border border-stone-200 rounded-xl bg-stone-50"
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="unknown">Unknown / Not entered</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label htmlFor={`price-${item.id}`} className="block text-[11px] text-zinc-500 mb-1">
                  Price ₹ / {item.unitEn}
                </label>
                <input
                  id={`price-${item.id}`}
                  type="number"
                  min={0}
                  value={item.price ?? ''}
                  onChange={(e) =>
                    updateMenuField(
                      item.id,
                      'price',
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                  placeholder="TBC"
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50"
                />
              </div>

              <div className="lg:col-span-1">
                <label htmlFor={`stock-${item.id}`} className="block text-[11px] text-zinc-500 mb-1">
                  Limit
                </label>
                <input
                  id={`stock-${item.id}`}
                  type="number"
                  min={0}
                  value={item.remainingStock ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    updateMenuField(item.id, 'remainingStock', val);
                  }}
                  className="w-full min-h-[44px] px-2.5 py-2 text-sm font-mono tabular-nums border border-stone-200 rounded-xl bg-stone-50"
                />
              </div>

              <div className="lg:col-span-2 flex items-center lg:justify-end pt-2 lg:pt-4">
                <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.priceVerified}
                    onChange={(e) => updateMenuField(item.id, 'priceVerified', e.target.checked)}
                    className="w-4 h-4 accent-emerald-800"
                  />
                  Price verified
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Explicit Person Save Bar */}
      <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <div className="flex-1 max-w-sm">
            <label htmlFor="cfg-saved-by" className="block text-xs font-medium text-zinc-700 mb-1">
              Person saving these changes (required) *
            </label>
            <input
              id="cfg-saved-by"
              type="text"
              value={savedByPerson}
              onChange={(e) => setSavedByPerson(e.target.value)}
              placeholder="e.g. Owner / Coordinator name"
              className="w-full min-h-[44px] px-3 py-2 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <button
            type="submit"
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Owner Changes
          </button>
        </div>

        {draftConfig.lastSavedAt && (
          <p className="text-xs text-zinc-500 font-mono tabular-nums">
            Last saved at {draftConfig.lastSavedAt} by {draftConfig.lastSavedBy}
          </p>
        )}

        {saveError && (
          <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            {saveError}
          </p>
        )}

        {saveMessage && (
          <p role="status" className="text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {saveMessage}
          </p>
        )}
      </section>
    </form>
  );
};
