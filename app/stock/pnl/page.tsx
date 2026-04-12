'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────
type PnLSummary = {
  revenue: number; cogs: number; gross_profit: number;
  gross_margin_pct: number; purchase_spend: number;
  order_count: number; purchase_count: number;
  shipping_profit: number; total_shipping_cost: number;
};
type DailyPnL  = { date: string; revenue: number; cogs: number; gross_profit: number; };
type ProductPnL = {
  product_id: number; product_name: string; total_quantity: number;
  historical_units_ordered: number;
  revenue: number; cogs: number; gross_profit: number; gross_margin_pct: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 2 }).format(v);
const fmtK  = (v: number) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : fmt$(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function SortArrow({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: 'asc' | 'desc' }) {
  if (col !== sortBy) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
  return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end   = new Date();
  const start = new Date();
  if (days > 0) {
    start.setDate(start.getDate() - days + 1);
  } else {
    start.setFullYear(2000, 0, 1); // "All time"
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function fillDailyGaps(data: DailyPnL[], startDate: string, endDate: string): DailyPnL[] {
  const map = new Map(data.map(d => [d.date, d]));
  const result: DailyPnL[] = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    result.push(map.get(key) ?? { date: key, revenue: 0, cogs: 0, gross_profit: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, colorClass, icon }: {
  label: string; value: string; sub?: string; colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide break-words">{label}</p>
        <p className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white mt-0.5 break-all">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 break-words">{sub}</p>}
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 text-sm space-y-1">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map(entry => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
          <span className="font-medium text-gray-900 dark:text-white">{fmt$(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

// ── Margin badge ─────────────────────────────────────────────────────────────
function MarginBadge({ pct }: { pct: number }) {
  const cls = pct >= 30
    ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400'
    : pct >= 15
      ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
      : pct > 0
        ? 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
        : 'text-gray-500 bg-gray-100 dark:bg-gray-800';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{fmtPct(pct)}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PnLPage() {
  const [range, setRange] = useState(365);
  const [summary, setSummary] = useState<PnLSummary | null>(null);
  const [daily, setDaily] = useState<DailyPnL[]>([]);
  const [products, setProducts] = useState<ProductPnL[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('gross_profit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sortedProducts = [...products].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'product_name': cmp = a.product_name.localeCompare(b.product_name); break;
      case 'total_quantity': cmp = a.total_quantity - b.total_quantity; break;
      case 'historical_units_ordered': cmp = a.historical_units_ordered - b.historical_units_ordered; break;
      case 'revenue': cmp = a.revenue - b.revenue; break;
      case 'cogs': cmp = a.cogs - b.cogs; break;
      case 'gross_profit': cmp = a.gross_profit - b.gross_profit; break;
      case 'gross_margin_pct': cmp = a.gross_margin_pct - b.gross_margin_pct; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const { startDate, endDate } = useMemo(() => getDateRange(range), [range]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const base = `/api/stock/pnl?startDate=${startDate}&endDate=${endDate}`;
    const [sumRes, dailyRes, prodRes] = await Promise.all([
      fetch(`${base}&type=summary`),
      fetch(`${base}&type=daily`),
      fetch(`${base}&type=products`),
    ]);
    const [sumData, dailyData, prodData] = await Promise.all([sumRes.json(), dailyRes.json(), prodRes.json()]);
    setSummary(sumData); setDaily(dailyData); setProducts(prodData);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filled = useMemo(() => fillDailyGaps(daily, startDate, endDate), [daily, startDate, endDate]);

  const chartData = filled.map(d => ({
    date: new Date(d.date + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }),
    Revenue: +d.revenue.toFixed(2),
    COGS: +d.cogs.toFixed(2),
    'Gross Profit': +d.gross_profit.toFixed(2),
  }));

  // Tick density: show fewer labels when range is wide
  const tickInterval = range <= 7 ? 0 : range <= 30 ? 4 : range <= 90 ? 13 : range <= 365 ? 29 : 59;

  const peakDay = filled.reduce<DailyPnL | null>(
    (best, d) => !best || d.revenue > best.revenue ? d : best, null
  );

  const hasCogsData = products.some(p => p.cogs > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profit & Loss</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue, cost of goods sold, and gross profit</p>
        </div>
        <div className="sm:ml-auto flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {([7, 30, 90, 180, 365, 0] as const).map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${range === d
                ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {d === 0 ? 'All' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <>
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              All monetary values are displayed in SGD (Singapore Dollars)
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <StatCard
                label="Revenue (SGD)"
                value={fmt$(summary.revenue)}
                sub={`${summary.order_count} completed orders`}
                colorClass="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              />
              <StatCard
                label="COGS (SGD)"
                value={fmt$(summary.cogs)}
                sub={hasCogsData ? 'Cost of goods sold' : 'No cost data yet — add purchases'}
                colorClass="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
              />
              <StatCard
                label="Total Shipping Cost (SGD)"
                value={fmt$(summary.total_shipping_cost ?? 0)}
                sub="Purchase shipping costs"
                colorClass="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a2 2 0 104 0m-4 0a2 2 0 11-4 0"/></svg>}
              />
              <StatCard
                label="Shipping P/L (SGD)"
                value={fmt$(summary.shipping_profit ?? 0)}
                sub={summary.shipping_profit >= 0 ? 'Shipping profit' : 'Shipping loss'}
                colorClass={summary.shipping_profit >= 0
                  ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400'
                  : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>}
              />
              <StatCard
                label="Gross Profit (SGD)"
                value={fmt$(summary.gross_profit)}
                sub={`${fmtPct(summary.gross_margin_pct)} gross margin`}
                colorClass={summary.gross_profit >= 0
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
              />
              <StatCard
                label="Purchase Spend (SGD)"
                value={fmt$(summary.purchase_spend)}
                sub={`${summary.purchase_count} received POs`}
                colorClass="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
              />
            </div>
            </>
          )}

          {/* Peak day banner */}
          {peakDay && peakDay.revenue > 0 && (
            <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-2xl px-5 py-3">
              <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Peak day in this period: <strong>{new Date(peakDay.date + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> with <strong>{fmt$(peakDay.revenue)}</strong> revenue
              </p>
            </div>
          )}

          {/* COGS data notice */}
          {!hasCogsData && summary && summary.revenue > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                COGS shows $0 because no purchases have been recorded yet, or existing sales were created before cost tracking was enabled. Record purchases to see accurate gross profit figures.
              </p>
            </div>
          )}

          {/* Line chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Revenue vs COGS vs Gross Profit <span className="text-xs font-normal text-gray-400">(SGD)</span></h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgb(156 163 175)' }} interval={tickInterval} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: 'rgb(156 163 175)' }} width={56} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue"      stroke="#6366f1" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="COGS"         stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="Gross Profit" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Product PnL table */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Product Profitability</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sorted by gross profit — highest first · All amounts in SGD</p>
            </div>
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No sales in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('product_name')}>Product<SortArrow col="product_name" sortBy={sortBy} sortDir={sortDir} /></th>
                      <th className="px-5 py-3 text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('total_quantity')}>Units Sold<SortArrow col="total_quantity" sortBy={sortBy} sortDir={sortDir} /></th>
                      <th className="px-5 py-3 text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('historical_units_ordered')}>Units Ordered<SortArrow col="historical_units_ordered" sortBy={sortBy} sortDir={sortDir} /></th>
                      <th className="px-5 py-3 text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('revenue')}>Revenue (SGD)<SortArrow col="revenue" sortBy={sortBy} sortDir={sortDir} /></th>
                      <th className="px-5 py-3 text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('cogs')}>COGS (SGD)<SortArrow col="cogs" sortBy={sortBy} sortDir={sortDir} /></th>
                      <th className="px-5 py-3 text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('gross_profit')}>Gross Profit (SGD)<SortArrow col="gross_profit" sortBy={sortBy} sortDir={sortDir} /></th>
                      <th className="px-5 py-3 text-right cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('gross_margin_pct')}>Margin<SortArrow col="gross_margin_pct" sortBy={sortBy} sortDir={sortDir} /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {sortedProducts.map(p => (
                      <tr key={p.product_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{p.product_name}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">{p.total_quantity.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">
                          {p.historical_units_ordered.toLocaleString()}
                          {p.historical_units_ordered > 0 && p.total_quantity > p.historical_units_ordered && (
                            <span className="ml-1 text-xs text-amber-500" title="Units sold exceeds units ordered in this period">⚠</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-white">{fmt$(p.revenue)}</td>
                        <td className="px-5 py-3 text-right text-orange-600 dark:text-orange-400">{fmt$(p.cogs)}</td>
                        <td className={`px-5 py-3 text-right font-semibold ${p.gross_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {fmt$(p.gross_profit)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <MarginBadge pct={p.gross_margin_pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  {products.length > 1 && (() => {
                    const tot = products.reduce((a, p) => ({
                      revenue: a.revenue + p.revenue,
                      cogs: a.cogs + p.cogs,
                      gross_profit: a.gross_profit + p.gross_profit,
                    }), { revenue: 0, cogs: 0, gross_profit: 0 });
                    const margin = tot.revenue > 0 ? (tot.gross_profit / tot.revenue) * 100 : 0;
                    return (
                      <tfoot>
                        <tr className="bg-gray-50 dark:bg-gray-800 font-semibold text-sm">
                          <td className="px-5 py-3 text-gray-700 dark:text-gray-300">Total</td>
                          <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">
                            {products.reduce((s, p) => s + p.total_quantity, 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">
                            {products.reduce((s, p) => s + p.historical_units_ordered, 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{fmt$(tot.revenue)}</td>
                          <td className="px-5 py-3 text-right text-orange-600 dark:text-orange-400">{fmt$(tot.cogs)}</td>
                          <td className={`px-5 py-3 text-right ${tot.gross_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {fmt$(tot.gross_profit)}
                          </td>
                          <td className="px-5 py-3 text-right"><MarginBadge pct={margin} /></td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
