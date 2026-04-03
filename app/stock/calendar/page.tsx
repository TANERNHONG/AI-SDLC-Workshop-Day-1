'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Product, ReleaseEventWithProducts, PurchaseWithItems, OptimizationResult, ProductOptimization } from '@/lib/stockdb';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ── Event Modal ───────────────────────────────────────────────────────────────

function EventModal({
  event,
  products,
  onClose,
  onSave,
}: {
  event: ReleaseEventWithProducts | null;
  products: Product[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = event === null;
  const [form, setForm] = useState({
    name: event?.name ?? '',
    release_date: event?.release_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    description: event?.description ?? '',
    game_series: event?.game_series ?? '',
  });
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>(
    event?.products?.map(p => p.id) ?? []
  );
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const filteredProducts = products.filter(p =>
    p.is_active && (
      productSearch === '' ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
    )
  );

  const toggleProduct = (id: number) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url = isNew ? '/api/stock/release-events' : `/api/stock/release-events/${event!.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          release_date: form.release_date,
          description: form.description.trim() || null,
          game_series: form.game_series.trim() || null,
          product_ids: selectedProductIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Save failed');
      }
      onSave();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isNew ? 'Add Release Event' : 'Edit Release Event'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Event Name *
            </label>
            <input
              ref={nameRef}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Pokémon Prismatic Evolutions"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Release Date *
              </label>
              <input
                required
                type="date"
                value={form.release_date}
                onChange={(e) => setForm({ ...form, release_date: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Game / Series
              </label>
              <input
                value={form.game_series}
                onChange={(e) => setForm({ ...form, game_series: e.target.value })}
                placeholder="e.g. Pokémon TCG"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional notes about this release…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Product selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Linked Products ({selectedProductIds.length})
            </label>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all mb-2"
            />
            <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">No products found</p>
              ) : (
                filteredProducts.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit as any} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors">
            {saving ? 'Saving…' : isNew ? 'Add Event' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteDialog({ event, onClose, onDeleted }: { event: ReleaseEventWithProducts; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    await fetch(`/api/stock/release-events/${event.id}`, { method: 'DELETE' });
    onDeleted();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Release Event?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <strong>{event.name}</strong> will be permanently deleted.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={confirm} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Series Badge Colors ───────────────────────────────────────────────────────

const SERIES_COLORS: Record<string, string> = {
  'Pokémon TCG': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  'Yu-Gi-Oh!':   'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  'One Piece':    'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  'Magic: The Gathering': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'Digimon':      'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  'Dragon Ball':  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'Lorcana':      'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
};

function SeriesBadge({ series }: { series: string | null }) {
  if (!series) return null;
  const color = SERIES_COLORS[series] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {series}
    </span>
  );
}

// ── Risk badge colors ─────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  high:     'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  medium:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  low:      'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  none:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};
const TYPE_COLORS: Record<string, string> = {
  evergreen:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  rare:         'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  discontinued: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

// ── Profit Optimizer Panel ────────────────────────────────────────────────────

function ProfitOptimizer() {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showSizeGroups, setShowSizeGroups] = useState(false);
  const [params, setParams] = useState({
    budget: 1000,
    leadTime: 28,
    serviceLevel: 0.95,
    holdingCost: 5,
    lookback: 90,
    releaseBoost: 1.5,
    horizon: 30,
  });

  const runOptimizer = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        budget: String(params.budget),
        leadTime: String(params.leadTime),
        serviceLevel: String(params.serviceLevel),
        holdingCost: String(params.holdingCost),
        lookback: String(params.lookback),
        releaseBoost: String(params.releaseBoost),
        horizon: String(params.horizon),
      });
      const res = await fetch(`/api/stock/optimization?${qs}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setResult(data);
      setExpanded(true);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const actionableProducts = result?.products.filter(p => p.recommended_order_qty > 0) ?? [];
  const totalExpectedProfit = actionableProducts.reduce((s, p) => s + p.expected_profit, 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-lg">⚡</div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Profit Optimizer</h3>
            <p className="text-xs text-gray-400">Budget-constrained order recommendations</p>
          </div>
        </div>
        <button
          onClick={runOptimizer}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
        >
          {loading ? 'Running…' : result ? 'Re-run' : 'Run Optimizer'}
        </button>
      </div>

      {/* Parameters (collapsible) */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Budget (SGD)</label>
            <input type="number" min={0} step={100} value={params.budget} onChange={e => setParams({...params, budget: +e.target.value})}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Lead Time (days)</label>
            <input type="number" min={1} max={90} value={params.leadTime} onChange={e => setParams({...params, leadTime: +e.target.value})}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Service Level</label>
            <select value={params.serviceLevel} onChange={e => setParams({...params, serviceLevel: +e.target.value})}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent">
              <option value={0.90}>90%</option>
              <option value={0.95}>95%</option>
              <option value={0.99}>99%</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Holding Cost %</label>
            <input type="number" min={0} max={50} step={1} value={params.holdingCost} onChange={e => setParams({...params, holdingCost: +e.target.value})}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Lookback (days)</label>
            <input type="number" min={7} max={365} value={params.lookback} onChange={e => setParams({...params, lookback: +e.target.value})}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Release Boost</label>
            <input type="number" min={1} max={5} step={0.1} value={params.releaseBoost} onChange={e => setParams({...params, releaseBoost: +e.target.value})}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Horizon (days)</label>
            <input type="number" min={7} max={90} value={params.horizon} onChange={e => setParams({...params, horizon: +e.target.value})}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="px-5 py-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 px-4 py-3">
              <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide">Budget Used</p>
              <p className="text-lg font-bold text-violet-700 dark:text-violet-300">${result.total_allocated.toFixed(2)}</p>
              <p className="text-xs text-violet-400">of ${result.total_budget.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Expected Profit</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">${totalExpectedProfit.toFixed(2)}</p>
              <p className="text-xs text-emerald-400">{result.total_allocated > 0 ? ((totalExpectedProfit / result.total_allocated) * 100).toFixed(0) : 0}% ROI</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Products to Order</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{actionableProducts.length}</p>
              <p className="text-xs text-amber-400">of {result.products.length} active</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Stockout Risks</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">
                {result.products.filter(p => p.stockout_risk === 'critical' || p.stockout_risk === 'high').length}
              </p>
              <p className="text-xs text-red-400">critical + high</p>
            </div>
          </div>

          {/* Size group summary toggle */}
          <div>
            <button onClick={() => setShowSizeGroups(!showSizeGroups)}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">
              {showSizeGroups ? '▼' : '▶'} Size Group Analysis ({result.size_group_summary.length} groups)
            </button>
            {showSizeGroups && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                      <th className="pb-2 pr-4 font-semibold">Size Group</th>
                      <th className="pb-2 pr-4 font-semibold text-right">Products</th>
                      <th className="pb-2 pr-4 font-semibold text-right">Pooled SS</th>
                      <th className="pb-2 pr-4 font-semibold text-right">Order Qty</th>
                      <th className="pb-2 font-semibold text-right">Order Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {result.size_group_summary.map(sg => (
                      <tr key={sg.size_group} className="text-gray-700 dark:text-gray-300">
                        <td className="py-2 pr-4 font-mono font-medium">{sg.size_group}</td>
                        <td className="py-2 pr-4 text-right">{sg.product_count}</td>
                        <td className="py-2 pr-4 text-right">{sg.pooled_safety_stock}</td>
                        <td className="py-2 pr-4 text-right">{sg.total_recommended}</td>
                        <td className="py-2 text-right font-medium">${sg.total_cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expand/collapse product table */}
          <button onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            {expanded ? '▼ Hide' : '▶ Show'} Product Recommendations
          </button>

          {expanded && (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-2 pl-5 pr-3 font-semibold">Product</th>
                    <th className="pb-2 px-2 font-semibold">Type</th>
                    <th className="pb-2 px-2 font-semibold">Risk</th>
                    <th className="pb-2 px-2 font-semibold text-right">Stock</th>
                    <th className="pb-2 px-2 font-semibold text-right">μ/day</th>
                    <th className="pb-2 px-2 font-semibold text-right">σ/day</th>
                    <th className="pb-2 px-2 font-semibold text-right">CV</th>
                    <th className="pb-2 px-2 font-semibold text-right">SS</th>
                    <th className="pb-2 px-2 font-semibold text-right">ROP</th>
                    <th className="pb-2 px-2 font-semibold text-right">Order</th>
                    <th className="pb-2 px-2 font-semibold text-right">Cost</th>
                    <th className="pb-2 px-2 font-semibold text-right">Exp. Profit</th>
                    <th className="pb-2 px-2 font-semibold text-right">Score</th>
                    <th className="pb-2 pr-5 font-semibold">Release</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {result.products.map(p => (
                    <tr key={p.product_id} className={`text-gray-700 dark:text-gray-300 ${p.recommended_order_qty > 0 ? '' : 'opacity-40'}`}>
                      <td className="py-2 pl-5 pr-3">
                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-[180px]" title={p.product_name}>{p.product_name}</div>
                        <div className="text-gray-400 font-mono">{p.sku}</div>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_COLORS[p.product_type]}`}>
                          {p.product_type}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${RISK_COLORS[p.stockout_risk]}`}>
                          {p.stockout_risk}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {p.current_stock}
                        {p.pending_stock > 0 && <span className="text-emerald-500 ml-0.5">(+{p.pending_stock})</span>}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{p.demand_mean.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono">{p.demand_stddev.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono">{p.demand_cv.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right font-mono">{p.safety_stock}</td>
                      <td className="py-2 px-2 text-right font-mono">{p.reorder_point}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold">{p.recommended_order_qty > 0 ? p.recommended_order_qty : '—'}</td>
                      <td className="py-2 px-2 text-right font-mono">{p.order_cost > 0 ? `$${p.order_cost.toFixed(2)}` : '—'}</td>
                      <td className="py-2 px-2 text-right font-mono">
                        {p.expected_profit > 0
                          ? <span className="text-emerald-600 dark:text-emerald-400">${p.expected_profit.toFixed(2)}</span>
                          : p.expected_profit < 0
                          ? <span className="text-red-600 dark:text-red-400">-${Math.abs(p.expected_profit).toFixed(2)}</span>
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{p.priority_score > 0 ? p.priority_score.toFixed(2) : '—'}</td>
                      <td className="py-2 pr-5 text-right">
                        {p.has_upcoming_release && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            🚀 {p.days_to_release}d
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function ReleaseCalendarPage() {
  const [events, setEvents] = useState<ReleaseEventWithProducts[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalEvent, setModalEvent] = useState<ReleaseEventWithProducts | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ReleaseEventWithProducts | null>(null);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [evRes, prRes, puRes] = await Promise.all([
      fetch('/api/stock/release-events'),
      fetch('/api/stock/products'),
      fetch('/api/stock/purchases'),
    ]);
    const evData = await evRes.json();
    const prData = await prRes.json();
    const puData = await puRes.json();
    setEvents(evData);
    setProducts(prData);
    setPurchases(puData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = () => {
    setModalEvent(undefined);
    fetchData();
  };

  // Calendar helpers
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const eventsByDate = new Map<string, ReleaseEventWithProducts[]>();
  events.forEach(ev => {
    const key = ev.release_date.slice(0, 10);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(ev);
  });

  // Purchase delivery bars: for each purchase with delivery_days, compute the range of dates
  type PurchaseBar = { purchase: PurchaseWithItems; startDate: string; endDate: string; isStart: boolean; isEnd: boolean; label: string; };
  const purchaseBarsByDate = new Map<string, PurchaseBar[]>();
  purchases.forEach(p => {
    if (p.status === 'cancelled') return;
    if (!p.delivery_days || p.delivery_days <= 0) return;
    const start = new Date(p.purchase_date);
    if (isNaN(start.getTime())) return;
    const end = new Date(start);
    end.setDate(end.getDate() + p.delivery_days);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    // Iterate each day in range
    const cur = new Date(start);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      if (!purchaseBarsByDate.has(key)) purchaseBarsByDate.set(key, []);
      purchaseBarsByDate.get(key)!.push({
        purchase: p,
        startDate: startStr,
        endDate: endStr,
        isStart: key === startStr,
        isEnd: key === endStr,
        label: p.invoice_ref || `PO#${p.id}`,
      });
      cur.setDate(cur.getDate() + 1);
    }
  });

  // Stock suggestions: for each release event within fresh window (release_date + 10 days from today),
  // check linked products with stock < 20 and suggest purchasing
  type Suggestion = { event: ReleaseEventWithProducts; product: Product; deficit: number; };
  const suggestions: Suggestion[] = [];
  const todayDate = new Date(todayStr);
  events.forEach(ev => {
    const releaseDate = new Date(ev.release_date.slice(0, 10));
    const freshDeadline = new Date(releaseDate);
    freshDeadline.setDate(freshDeadline.getDate() + 10);
    // Only show suggestions if we haven't passed the fresh window
    if (todayDate > freshDeadline) return;
    // Only show for upcoming or very recent releases
    ev.products.forEach(ep => {
      const product = products.find(p => p.id === ep.id);
      if (!product) return;
      if (product.stock_quantity < 20) {
        suggestions.push({ event: ev, product, deficit: 20 - product.stock_quantity });
      }
    });
  });

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };
  const goToday = () => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); };

  // Sort for list view
  const sortedEvents = [...events].sort((a, b) => a.release_date.localeCompare(b.release_date));
  const upcomingEvents = sortedEvents.filter(e => e.release_date >= todayStr);
  const pastEvents = sortedEvents.filter(e => e.release_date < todayStr).reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Release Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {events.length} release event{events.length !== 1 ? 's' : ''} · {upcomingEvents.length} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setModalEvent(null)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Event
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400 text-sm">
          Loading release events…
        </div>
      ) : <>
        {/* Stock Purchase Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Purchase Suggestions</h3>
              <span className="text-xs text-amber-600 dark:text-amber-400">({suggestions.length} item{suggestions.length !== 1 ? 's' : ''} need restocking)</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((s, i) => (
                <div key={`${s.event.id}-${s.product.id}-${i}`} className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.product.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.product.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400">{s.product.stock_quantity} in stock</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">need ~{s.deficit} more</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    For: <span className="font-medium text-gray-700 dark:text-gray-300">{s.event.name}</span>
                    <span className="ml-1">({fmtDate(s.event.release_date)})</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profit Optimizer */}
        <ProfitOptimizer />

        {view === 'calendar' ? (
        /* ── Calendar View ── */
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Calendar Nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {MONTH_NAMES[calMonth]} {calYear}
              </h2>
              <button onClick={goToday} className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Today
              </button>
            </div>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const dayPurchaseBars = purchaseBarsByDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={day}
                  className={`min-h-[100px] border-b border-r border-gray-50 dark:border-gray-800 p-1.5 ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center' : 'text-gray-500 dark:text-gray-400 pl-1'}`}>
                    {day}
                  </div>
                  {dayEvents.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setModalEvent(ev)}
                      className="w-full text-left px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors mb-0.5 truncate"
                    >
                      {ev.name}
                    </button>
                  ))}
                  {dayPurchaseBars.map((bar, bi) => (
                    <div
                      key={`pb-${bar.purchase.id}-${bi}`}
                      className={`w-full text-xs px-1 py-0.5 mb-0.5 truncate font-medium ${
                        bar.isStart && bar.isEnd
                          ? 'rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : bar.isStart
                          ? 'rounded-l bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : bar.isEnd
                          ? 'rounded-r bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      }`}
                      title={`${bar.label}: ${bar.startDate} → ${bar.endDate} (${bar.purchase.delivery_days}d)`}
                    >
                      {bar.isStart ? `📦 ${bar.label}` : bar.isEnd ? `✓ ETA` : ''}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── List View ── */
        <div className="space-y-6">
          {/* Upcoming */}
          {upcomingEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Upcoming ({upcomingEvents.length})
              </h3>
              <div className="space-y-3">
                {upcomingEvents.map(ev => {
                  const daysUntil = Math.ceil((new Date(ev.release_date).getTime() - today.getTime()) / 86400000);
                  return (
                    <div key={ev.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">{ev.name}</h4>
                            <SeriesBadge series={ev.game_series} />
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {fmtDate(ev.release_date)}
                            <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-medium">
                              {daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
                            </span>
                          </p>
                          {ev.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ev.description}</p>
                          )}
                          {ev.products.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {ev.products.map(p => (
                                <span key={p.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setModalEvent(ev)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ev)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past */}
          {pastEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Past ({pastEvents.length})
              </h3>
              <div className="space-y-3">
                {pastEvents.map(ev => (
                  <div key={ev.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 opacity-60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-gray-900 dark:text-white">{ev.name}</h4>
                          <SeriesBadge series={ev.game_series} />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{fmtDate(ev.release_date)}</p>
                        {ev.products.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {ev.products.map(p => (
                              <span key={p.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setModalEvent(ev)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteTarget(ev)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-2xl">📅</div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No release events yet</p>
              <button onClick={() => setModalEvent(null)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Add your first release event →
              </button>
            </div>
          )}
        </div>
      )}
      </>}

      {/* Modals */}
      {modalEvent !== undefined && (
        <EventModal event={modalEvent} products={products} onClose={() => setModalEvent(undefined)} onSave={handleSave} />
      )}
      {deleteTarget && (
        <DeleteDialog event={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); fetchData(); }} />
      )}
    </div>
  );
}
