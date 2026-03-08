'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { SaleWithItems, DailySalesSummary } from '@/lib/stockdb';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    refunded:  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    void:      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Calendar Component ────────────────────────────────────────────────────────

function SalesCalendar({
  year,
  month,
  dailySales,
  onSelectDay,
}: {
  year: number;
  month: number;
  dailySales: DailySalesSummary[];
  onSelectDay: (date: string) => void;
}) {
  const salesMap = new Map(dailySales.map((d) => [d.date, d]));
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month); // 0 = Sunday

  const today = new Date().toISOString().slice(0, 10);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const maxTotal = Math.max(...dailySales.map((d) => d.total), 1);

  function heatColor(total: number): string {
    const intensity = total / maxTotal;
    if (intensity === 0) return '';
    if (intensity < 0.25) return 'bg-indigo-100 dark:bg-indigo-950';
    if (intensity < 0.5)  return 'bg-indigo-200 dark:bg-indigo-900';
    if (intensity < 0.75) return 'bg-indigo-400 dark:bg-indigo-700';
    return 'bg-indigo-600 dark:bg-indigo-500';
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const data = salesMap.get(dateStr);
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              onClick={() => data && onSelectDay(dateStr)}
              title={data ? `${fmtCurrency(data.total)} — ${data.order_count} order${data.order_count !== 1 ? 's' : ''}` : undefined}
              className={`
                relative aspect-square rounded-lg flex flex-col items-center justify-center
                text-sm font-medium transition-all duration-150
                ${data ? `${heatColor(data.total)} cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:ring-offset-1` : 'text-gray-400 dark:text-gray-600 cursor-default'}
                ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1 text-indigo-700 dark:text-indigo-300 font-bold' : ''}
                ${data && !isToday ? (data.total / maxTotal > 0.5 ? 'text-white' : 'text-indigo-800 dark:text-indigo-200') : ''}
              `}
            >
              <span>{day}</span>
              {data && (
                <span className="text-[9px] leading-tight opacity-80">
                  {data.order_count}×
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-xs text-gray-400">Low</span>
        {['bg-indigo-100', 'bg-indigo-200', 'bg-indigo-400', 'bg-indigo-600'].map((c) => (
          <div key={c} className={`w-3 h-3 rounded ${c}`} />
        ))}
        <span className="text-xs text-gray-400">High</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StockDashboard() {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [dailySales, setDailySales] = useState<DailySalesSummary[]>([]);
  const [recentSales, setRecentSales] = useState<SaleWithItems[]>([]);
  const [stats, setStats] = useState({ revenue: 0, orders: 0, avgOrder: 0, products: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayModalSales, setDayModalSales] = useState<SaleWithItems[]>([]);

  const firstOfMonth = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
  const lastOfMonth = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(getDaysInMonth(calYear, calMonth)).padStart(2, '0')}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [analyticsRes, salesRes, productsRes] = await Promise.all([
      fetch(`/api/stock/analytics?type=daily&startDate=${firstOfMonth}&endDate=${lastOfMonth}`),
      fetch(`/api/stock/sales?startDate=${firstOfMonth}&endDate=${lastOfMonth}`),
      fetch('/api/stock/products'),
    ]);
    const analytics: DailySalesSummary[] = await analyticsRes.json();
    const sales: SaleWithItems[] = await salesRes.json();
    const products: any[] = await productsRes.json();

    const completed = sales.filter((s) => s.status === 'completed');
    const totalRev = completed.reduce((a, s) => a + s.total, 0);
    setDailySales(analytics);
    setRecentSales(sales.slice(0, 20));
    setStats({
      revenue: totalRev,
      orders: completed.length,
      avgOrder: completed.length > 0 ? totalRev / completed.length : 0,
      products: products.length,
    });
    setLoading(false);
  }, [firstOfMonth, lastOfMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelectDay = (date: string) => {
    setSelectedDay(date);
    const daySales = recentSales.filter((s) => s.sale_date.startsWith(date));
    setDayModalSales(daySales);
  };

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Overview for {monthLabel}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/stock/products?action=new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 shadow-sm transition-all hover:shadow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Link>
          <Link
            href="/stock/sales?action=new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow-indigo-200 dark:hover:shadow-indigo-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Sale
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Monthly Revenue',
            value: loading ? '—' : fmtCurrency(stats.revenue),
            icon: '💰',
            color: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400',
          },
          {
            label: 'Orders',
            value: loading ? '—' : stats.orders.toString(),
            icon: '🧾',
            color: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Avg. Order',
            value: loading ? '—' : fmtCurrency(stats.avgOrder),
            icon: '📊',
            color: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Active Products',
            value: loading ? '—' : stats.products.toString(),
            icon: '📦',
            color: 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${card.color}`}>
              {card.icon}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar + Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Calendar */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Sales Calendar</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const d = new Date(calYear, calMonth - 1);
                  setCalYear(d.getFullYear());
                  setCalMonth(d.getMonth());
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[120px] text-center">
                {monthLabel}
              </span>
              <button
                onClick={() => {
                  const d = new Date(calYear, calMonth + 1);
                  setCalYear(d.getFullYear());
                  setCalMonth(d.getMonth());
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : (
            <SalesCalendar
              year={calYear}
              month={calMonth}
              dailySales={dailySales}
              onSelectDay={handleSelectDay}
            />
          )}
        </div>

        {/* Recent Sales Table */}
        <div className="xl:col-span-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Recent Sales</h2>
            <Link href="/stock/sales" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : recentSales.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-400">
              <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
              <p className="text-sm">No sales this month</p>
              <Link href="/stock/sales?action=new" className="text-xs text-indigo-500 hover:underline">Create your first sale →</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-5 py-3 font-medium">Invoice</th>
                    <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">Date</th>
                    <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Items</th>
                    <th className="text-right px-3 py-3 font-medium">Total</th>
                    <th className="text-left px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link href={`/stock/sales?id=${sale.id}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                          {sale.invoice_number}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {fmtDate(sale.sale_date)}
                      </td>
                      <td className="px-3 py-3.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                        {fmtCurrency(sale.total)}
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusBadge status={sale.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDay(null)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Sales on {fmtDate(selectedDay)}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {dayModalSales.length === 0 ? (
              <p className="text-gray-400 text-sm">No sales data for this day in current view.</p>
            ) : (
              <div className="space-y-3">
                {dayModalSales.map((sale) => (
                  <div key={sale.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{sale.invoice_number}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white tabular-nums">{fmtCurrency(sale.total)}</p>
                        <StatusBadge status={sale.status} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between text-sm font-semibold text-gray-900 dark:text-white">
                  <span>Day Total</span>
                  <span className="tabular-nums">
                    {fmtCurrency(dayModalSales.filter(s => s.status === 'completed').reduce((a, s) => a + s.total, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
