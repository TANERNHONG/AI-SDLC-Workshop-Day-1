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

  // ── HTML Report Generator ──────────────────────────────────────────────────

  const generateReport = () => {
    const { startDate, endDate } = getDateRange(selectedRange);
    const labels   = JSON.stringify(lineDisplayData.map(d => d.date));
    const revenues = JSON.stringify(lineDisplayData.map(d => d.total));
    const orders   = JSON.stringify(lineDisplayData.map(d => d.order_count));
    const barNames = JSON.stringify(productData.map(p => p.product_name));
    const barRevs  = JSON.stringify(productData.map(p => p.total_revenue));

    const productRows = productData.map((p, i) => `
      <tr class="${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
        <td class="px-4 py-2">${p.product_name}</td>
        <td class="px-4 py-2 text-right">${p.total_quantity}</td>
        <td class="px-4 py-2 text-right font-semibold text-indigo-700">${fmtCurrency(p.total_revenue)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StockCheck Analytics Report — ${selectedRange} Days</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; background: #f9fafb; padding: 32px; }
    .header { margin-bottom: 32px; }
    .header h1 { font-size: 28px; font-weight: 800; color: #111827; }
    .header p  { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    .card-label { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-value { font-size: 26px; font-weight: 800; color: #111827; margin-top: 6px; }
    .card-sub   { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .section h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
    .chart-wrap { position: relative; height: 280px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    th:not(:first-child) { text-align: right; }
    td { padding: 8px 16px; border-bottom: 1px solid #f3f4f6; }
    td:not(:first-child) { text-align: right; }
    .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 32px; }
    @media print { body { background: white; padding: 20px; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 StockCheck Analytics Report</h1>
    <p>Period: ${startDate} to ${endDate} (${selectedRange} days) · Generated on ${new Date().toLocaleString('en-SG')}</p>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Total Revenue</div>
      <div class="card-value">${fmtCurrency(totalRevenue)}</div>
      <div class="card-sub">Last ${selectedRange} days</div>
    </div>
    <div class="card">
      <div class="card-label">Total Orders</div>
      <div class="card-value">${totalOrders}</div>
      <div class="card-sub">Last ${selectedRange} days</div>
    </div>
    <div class="card">
      <div class="card-label">Peak Day Revenue</div>
      <div class="card-value">${peakDay ? fmtCurrency(peakDay.total) : '—'}</div>
      <div class="card-sub">${peakDay ? new Date(peakDay.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
    </div>
  </div>

  <div class="section">
    <h2>Daily Revenue Trend</h2>
    <div class="chart-wrap"><canvas id="lineChart"></canvas></div>
  </div>

  <div class="section">
    <h2>Top Products by Revenue</h2>
    <div class="chart-wrap"><canvas id="barChart"></canvas></div>
  </div>

  <div class="section">
    <h2>Top Products Table</h2>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Units Sold</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${productRows}
      </tbody>
    </table>
  </div>

  <div class="footer">StockCheck v1.2 · Report generated ${new Date().toLocaleString('en-SG')}</div>

  <script>
    new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: {
        labels: ${labels},
        datasets: [{
          label: 'Revenue (SGD)',
          data: ${revenues},
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
        }, {
          label: 'Orders',
          data: ${orders},
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          borderDash: [5, 3],
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
          y: { grid: { color: '#f3f4f6' }, ticks: { callback: v => '$' + Number(v).toLocaleString(), font: { size: 11 } } }
        }
      }
    });
    new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels: ${barNames},
        datasets: [{
          label: 'Revenue (SGD)',
          data: ${barRevs},
          backgroundColor: '#6366f1',
          borderRadius: 6,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: v => '$' + Number(v).toLocaleString(), font: { size: 11 } } },
          y: { ticks: { font: { size: 11 } } }
        }
      }
    });
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Sales performance overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {/* Generate Report */}
          <button
            onClick={generateReport}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate Report
          </button>
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
