'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { DailySalesSummary, ProductSalesSummary } from '@/lib/stockdb';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
}

const RANGES = [
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// Fill in missing days with 0
function fillDailyGaps(data: DailySalesSummary[], startDate: string, endDate: string): DailySalesSummary[] {
  const map = new Map(data.map((d) => [d.date, d]));
  const result: DailySalesSummary[] = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    result.push(map.get(key) ?? { date: key, total: 0, order_count: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500 dark:text-gray-400">{p.name}:</span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">
            {p.dataKey === 'total' ? fmtCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [selectedRange, setSelectedRange] = useState(30);
  const [dailyData, setDailyData] = useState<DailySalesSummary[]>([]);
  const [productData, setProductData] = useState<ProductSalesSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange(selectedRange);
    const [dailyRes, productRes] = await Promise.all([
      fetch(`/api/stock/analytics?type=daily&startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/stock/analytics?type=products&startDate=${startDate}&endDate=${endDate}`),
    ]);
    const daily: DailySalesSummary[] = await dailyRes.json();
    const products: ProductSalesSummary[] = await productRes.json();

    setDailyData(fillDailyGaps(daily, startDate, endDate));
    setProductData(products.slice(0, 10)); // top 10
    setLoading(false);
  }, [selectedRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = dailyData.reduce((a, d) => a + d.total, 0);
  const totalOrders  = dailyData.reduce((a, d) => a + d.order_count, 0);
  const peakDay = dailyData.reduce((a, d) => d.total > (a?.total ?? 0) ? d : a, dailyData[0]);

  const lineDisplayData = dailyData.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }),
  }));

  const barDisplayData = productData.map((p) => ({
    name: p.product_name.length > 18 ? p.product_name.slice(0, 16) + '…' : p.product_name,
    revenue: p.total_revenue,
    units: p.total_quantity,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Sales performance overview</p>
        </div>
        {/* Range Selector */}
        <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setSelectedRange(r.days)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedRange === r.days
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: loading ? '—' : fmtCurrency(totalRevenue), sub: `Last ${selectedRange} days` },
          { label: 'Total Orders',  value: loading ? '—' : totalOrders.toString(), sub: `Last ${selectedRange} days` },
          { label: 'Peak Day',
            value: loading ? '—' : (peakDay ? new Date(peakDay.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : 'N/A'),
            sub: peakDay ? fmtCurrency(peakDay.total) : '' },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Line Chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">Daily Revenue</h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading chart…</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lineDisplayData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(lineDisplayData.length / 6)}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Revenue"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#6366f1' }}
              />
              <Line
                type="monotone"
                dataKey="order_count"
                name="Orders"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 3"
                activeDot={{ r: 4, fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar Chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Top Products by Revenue</h2>
        <p className="text-xs text-gray-400 mb-5">Top 10 products — last {selectedRange} days</p>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading chart…</div>
        ) : barDisplayData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No sales data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barDisplayData} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis
                type="number"
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={130}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              />
              <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
              <Bar dataKey="units"   name="Units Sold" fill="#a5b4fc" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
