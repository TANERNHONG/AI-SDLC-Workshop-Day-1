'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type {
  DailySalesSummary,
  ProductSalesSummary,
  ProductMarginSummary,
  CategoryRevenueSummary,
  BurnRateROP,
} from '@/lib/stockdb';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
}

function SortArrow({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: 'asc' | 'desc' }) {
  if (col !== sortBy) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
  return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
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

function truncate(name: string, max = 22) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

function YAxisTick({ x, y, payload }: any) {
  const display = truncate(payload.value, 22);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={0} y={0} dy={4} textAnchor="end" fontSize={11} fill="#6b7280">
        {display}
      </text>
    </g>
  );
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
            {p.dataKey === 'margin_pct'
              ? `${Number(p.value).toFixed(1)}%`
              : ['total', 'revenue', 'gross_profit'].includes(p.dataKey)
              ? fmtCurrency(p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{title}</h2>
      <p className="text-xs text-gray-400 mb-5">{subtitle}</p>
      {loading ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">Loading chart…</div>
      ) : empty ? (
        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No sales data yet</div>
      ) : (
        children
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [selectedRange, setSelectedRange] = useState(30);
  const [dailyData, setDailyData] = useState<DailySalesSummary[]>([]);
  const [revenueData, setRevenueData] = useState<ProductSalesSummary[]>([]);
  const [marginData, setMarginData] = useState<ProductMarginSummary[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryRevenueSummary[]>([]);
  const [burnRateData, setBurnRateData] = useState<BurnRateROP[]>([]);
  const [leadTime, setLeadTime] = useState(7);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('days_of_stock_left');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sortedBurnRate = [...burnRateData].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'product_name': cmp = a.product_name.localeCompare(b.product_name); break;
      case 'current_stock': cmp = a.current_stock - b.current_stock; break;
      case 'total_sold': cmp = a.total_sold - b.total_sold; break;
      case 'active_days': cmp = (a.period_days - a.stockout_days) - (b.period_days - b.stockout_days); break;
      case 'adjusted_burn_rate': cmp = a.adjusted_burn_rate - b.adjusted_burn_rate; break;
      case 'reorder_point': cmp = a.reorder_point - b.reorder_point; break;
      case 'days_of_stock_left': cmp = a.days_of_stock_left - b.days_of_stock_left; break;
      case 'needs_reorder': cmp = (a.needs_reorder ? 1 : 0) - (b.needs_reorder ? 1 : 0); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange(selectedRange);
    const [dailyRes, productRes, marginRes, categoryRes, burnRateRes] = await Promise.all([
      fetch(`/api/stock/analytics?type=daily&startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/stock/analytics?type=products&startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/stock/analytics?type=margins&startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/stock/analytics?type=categories&startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/stock/analytics?type=burnrate&startDate=${startDate}&endDate=${endDate}&leadTime=${leadTime}`),
    ]);
    const [daily, products, margins, categories, burnRate] = await Promise.all([
      dailyRes.json(),
      productRes.json(),
      marginRes.json(),
      categoryRes.json(),
      burnRateRes.json(),
    ]) as [DailySalesSummary[], ProductSalesSummary[], ProductMarginSummary[], CategoryRevenueSummary[], BurnRateROP[]];

    setDailyData(fillDailyGaps(daily, startDate, endDate));
    setRevenueData(products.slice(0, 10));
    setMarginData(margins.slice(0, 10));
    setCategoryData(categories.slice(0, 10));
    setBurnRateData(burnRate);
    setLoading(false);
  }, [selectedRange, leadTime]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { startDate, endDate } = getDateRange(selectedRange);
  const totalRevenue = dailyData.reduce((a, d) => a + d.total, 0);
  const totalOrders  = dailyData.reduce((a, d) => a + d.order_count, 0);
  const peakDay      = dailyData.reduce<DailySalesSummary | null>((a, d) => d.total > (a?.total ?? 0) ? d : a, null);

  const lineDisplayData = dailyData.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }),
  }));

  const revenueChartData = revenueData.map((p) => ({
    name: p.product_name,
    revenue: p.total_revenue,
  }));

  const unitsChartData = [...revenueData]
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .map((p) => ({
      name: p.product_name,
      units: p.total_quantity,
    }));

  const marginChartData = marginData.map((p) => ({
    name: p.product_name,
    margin_pct: parseFloat(p.margin_pct.toFixed(1)),
    gross_profit: p.gross_profit,
  }));

  const categoryChartData = categoryData.map((c) => ({
    name: c.category,
    revenue: c.total_revenue,
    products: c.product_count,
  }));

  // ─── HTML Report Generator ────────────────────────────────────────────────

  const generateReport = () => {
    const labels   = JSON.stringify(lineDisplayData.map(d => d.date));
    const revenues = JSON.stringify(lineDisplayData.map(d => d.total));
    const orders   = JSON.stringify(lineDisplayData.map(d => d.order_count));

    const revenueRows = revenueData.map((p, i) => `
      <tr class="${i % 2 === 0 ? 'even' : ''}">
        <td>${i + 1}</td><td>${p.product_name}</td>
        <td class="num">${p.total_quantity}</td>
        <td class="num money">${fmtCurrency(p.total_revenue)}</td>
      </tr>`).join('');

    const marginRows = marginData.map((p, i) => `
      <tr class="${i % 2 === 0 ? 'even' : ''}">
        <td>${i + 1}</td><td>${p.product_name}</td>
        <td class="num money">${fmtCurrency(p.total_revenue)}</td>
        <td class="num money">${fmtCurrency(p.gross_profit)}</td>
        <td class="num margin">${p.margin_pct.toFixed(1)}%</td>
      </tr>`).join('');

    const unitsRows = [...revenueData]
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .map((p, i) => `
      <tr class="${i % 2 === 0 ? 'even' : ''}">
        <td>${i + 1}</td><td>${p.product_name}</td>
        <td class="num">${p.total_quantity}</td>
        <td class="num money">${fmtCurrency(p.total_revenue)}</td>
      </tr>`).join('');

    const categoryRows = categoryData.map((c, i) => `
      <tr class="${i % 2 === 0 ? 'even' : ''}">
        <td>${i + 1}</td><td>${c.category}</td>
        <td class="num">${c.product_count}</td>
        <td class="num">${c.total_quantity}</td>
        <td class="num money">${fmtCurrency(c.total_revenue)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>StockCheck Analytics Report — ${selectedRange} Days</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;background:#f9fafb;padding:32px}
    h1{font-size:26px;font-weight:800;color:#111827}
    .sub{font-size:13px;color:#6b7280;margin-top:4px;margin-bottom:28px}
    .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
    .clabel{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
    .cval{font-size:24px;font-weight:800;color:#111827;margin-top:6px}
    .csub{font-size:11px;color:#9ca3af;margin-top:3px}
    .section{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:24px}
    .section h2{font-size:15px;font-weight:700;margin-bottom:16px}
    .chart-wrap{position:relative;height:260px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:9px 14px;font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb}
    td{padding:8px 14px;border-bottom:1px solid #f3f4f6}
    .num{text-align:right}.money{font-weight:600;color:#4f46e5}.margin{font-weight:600;color:#7c3aed}
    tr.even td{background:#f9fafb}
    .footer{text-align:center;font-size:12px;color:#9ca3af;margin-top:28px}
    @media print{body{background:#fff;padding:16px}.section{page-break-inside:avoid}}
  </style>
</head>
<body>
  <h1>📊 StockCheck Analytics Report</h1>
  <p class="sub">Period: ${startDate} → ${endDate} (${selectedRange} days) · Generated ${new Date().toLocaleString('en-SG')}</p>
  <div class="cards">
    <div class="card"><div class="clabel">Total Revenue</div><div class="cval">${fmtCurrency(totalRevenue)}</div><div class="csub">Last ${selectedRange} days</div></div>
    <div class="card"><div class="clabel">Total Orders</div><div class="cval">${totalOrders}</div><div class="csub">Last ${selectedRange} days</div></div>
    <div class="card"><div class="clabel">Peak Day</div><div class="cval">${peakDay ? fmtCurrency(peakDay.total) : '—'}</div><div class="csub">${peakDay ? new Date(peakDay.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div></div>
  </div>
  <div class="section"><h2>Daily Revenue Trend</h2><div class="chart-wrap"><canvas id="lineChart"></canvas></div></div>
  <div class="section"><h2>Top 10 Products by Revenue</h2>
    <table><thead><tr><th>#</th><th>Product</th><th class="num">Units Sold</th><th class="num">Revenue</th></tr></thead>
    <tbody>${revenueRows}</tbody></table></div>
  <div class="section"><h2>Top 10 Products by Units Sold</h2>
    <table><thead><tr><th>#</th><th>Product</th><th class="num">Units Sold</th><th class="num">Revenue</th></tr></thead>
    <tbody>${unitsRows}</tbody></table></div>
  <div class="section"><h2>Top 10 Products by Highest Margin</h2>
    <table><thead><tr><th>#</th><th>Product</th><th class="num">Revenue</th><th class="num">Gross Profit</th><th class="num">Margin %</th></tr></thead>
    <tbody>${marginRows}</tbody></table></div>
  <div class="section"><h2>Top Categories by Revenue</h2>
    <table><thead><tr><th>#</th><th>Category</th><th class="num"># Products</th><th class="num">Units Sold</th><th class="num">Revenue</th></tr></thead>
    <tbody>${categoryRows}</tbody></table></div>
  <div class="footer">StockCheck · Report generated ${new Date().toLocaleString('en-SG')}</div>
  <script>
    new Chart(document.getElementById('lineChart'),{type:'line',data:{labels:${labels},datasets:[{label:'Revenue (SGD)',data:${revenues},borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,0.08)',borderWidth:2.5,pointRadius:0,tension:.3,fill:true},{label:'Orders',data:${orders},borderColor:'#10b981',backgroundColor:'transparent',borderWidth:2,pointRadius:0,tension:.3,borderDash:[5,3]}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,font:{size:11}}},y:{grid:{color:'#f3f4f6'},ticks:{callback:v=>'$'+Number(v).toLocaleString(),font:{size:11}}}}}});
  </script>
</body></html>`;

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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Sales &amp; product performance insights</p>
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

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: loading ? '—' : fmtCurrency(totalRevenue), sub: `Last ${selectedRange} days` },
          { label: 'Total Orders',  value: loading ? '—' : totalOrders.toString(),    sub: `Last ${selectedRange} days` },
          {
            label: 'Peak Day',
            value: loading ? '—' : peakDay
              ? new Date(peakDay.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
              : 'N/A',
            sub: peakDay ? fmtCurrency(peakDay.total) : '',
          },
        ].map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily Revenue Trend */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Daily Revenue Trend</h2>
        <p className="text-xs text-gray-400 mb-5">Revenue &amp; order volume · last {selectedRange} days</p>
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
                tickFormatter={(v) => `$${Number(v).toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
              <Line type="monotone" dataKey="total" name="Revenue" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="order_count" name="Orders" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 3" activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Product Analysis — 2×2 grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 1 — Top 10 by Highest Margin */}
        <ChartCard
          title="Top 10 by Highest Margin"
          subtitle={`Best gross-margin % products · last ${selectedRange} days`}
          loading={loading}
          empty={marginChartData.length === 0}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={marginChartData} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis
                type="number"
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis type="category" dataKey="name" tick={<YAxisTick />} tickLine={false} axisLine={false} width={140} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="margin_pct" name="Margin %" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2 — Top 10 by Revenue */}
        <ChartCard
          title="Top 10 by Revenue"
          subtitle={`Highest grossing products · last ${selectedRange} days`}
          loading={loading}
          empty={revenueChartData.length === 0}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis
                type="number"
                tickFormatter={(v) => `$${Number(v).toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis type="category" dataKey="name" tick={<YAxisTick />} tickLine={false} axisLine={false} width={140} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3 — Top 10 by Units Sold */}
        <ChartCard
          title="Top 10 by Units Sold"
          subtitle={`Most popular products · last ${selectedRange} days`}
          loading={loading}
          empty={unitsChartData.length === 0}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={unitsChartData} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis type="category" dataKey="name" tick={<YAxisTick />} tickLine={false} axisLine={false} width={140} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="units" name="Units Sold" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 4 — Top 10 Categories by Revenue */}
        <ChartCard
          title="Top Categories by Revenue"
          subtitle={`Highest revenue product categories · last ${selectedRange} days`}
          loading={loading}
          empty={categoryChartData.length === 0}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" className="dark:stroke-gray-800" />
              <XAxis
                type="number"
                tickFormatter={(v) => `$${Number(v).toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis type="category" dataKey="name" tick={<YAxisTick />} tickLine={false} axisLine={false} width={140} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#f59e0b" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ─── Burn Rate & Reorder Point Alert ─────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Reorder Point Alerts</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Stockout-adjusted burn rate &amp; ROP · last {selectedRange} days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="leadTime" className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Lead time
            </label>
            <select
              id="leadTime"
              value={leadTime}
              onChange={(e) => setLeadTime(Number(e.target.value))}
              className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {[3, 5, 7, 10, 14, 21, 30].map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : burnRateData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No sales data to compute burn rates</div>
        ) : (
          <>
            {/* Alert banner */}
            {burnRateData.some((p) => p.needs_reorder) && (
              <div className="mb-4 flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    {burnRateData.filter((p) => p.needs_reorder).length} product{burnRateData.filter((p) => p.needs_reorder).length > 1 ? 's' : ''} below reorder point
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                    Stock is at or below the level needed to cover {leadTime}-day lead time based on adjusted demand.
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('product_name')}>Product<SortArrow col="product_name" sortBy={sortBy} sortDir={sortDir} /></th>
                    <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('current_stock')}>Stock<SortArrow col="current_stock" sortBy={sortBy} sortDir={sortDir} /></th>
                    <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('total_sold')}>Sold<SortArrow col="total_sold" sortBy={sortBy} sortDir={sortDir} /></th>
                    <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('active_days')}>
                      <span title="Total days minus estimated stockout days">Active Days</span><SortArrow col="active_days" sortBy={sortBy} sortDir={sortDir} />
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('adjusted_burn_rate')}>
                      <span title="Units/day adjusted for stockout days">Adj. Burn</span><SortArrow col="adjusted_burn_rate" sortBy={sortBy} sortDir={sortDir} />
                    </th>
                    <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('reorder_point')}>ROP<SortArrow col="reorder_point" sortBy={sortBy} sortDir={sortDir} /></th>
                    <th className="text-right py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('days_of_stock_left')}>Days Left<SortArrow col="days_of_stock_left" sortBy={sortBy} sortDir={sortDir} /></th>
                    <th className="text-center py-2.5 px-3 font-semibold cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('needs_reorder')}>Status<SortArrow col="needs_reorder" sortBy={sortBy} sortDir={sortDir} /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBurnRate.map((p) => {
                    const activeDays = p.period_days - p.stockout_days;
                    const daysLeft = p.days_of_stock_left === -1 ? '∞' : p.days_of_stock_left.toFixed(1);
                    const urgent = p.needs_reorder && p.current_stock <= 0;
                    const warning = p.needs_reorder && p.current_stock > 0;
                    return (
                      <tr
                        key={p.product_id}
                        className={`border-b border-gray-50 dark:border-gray-800/50 transition-colors ${
                          urgent ? 'bg-red-50/60 dark:bg-red-950/20' : warning ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={p.product_name}>
                          {p.product_name}
                        </td>
                        <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                          p.current_stock <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {p.current_stock}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                          {p.total_sold}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                          {activeDays}<span className="text-gray-400 dark:text-gray-500">/{p.period_days}</span>
                          {p.stockout_days > 0 && (
                            <span className="ml-1 text-[10px] text-orange-500" title={`${p.stockout_days} stockout days excluded`}>
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium text-indigo-600 dark:text-indigo-400">
                          {p.adjusted_burn_rate}
                          {p.naive_burn_rate !== p.adjusted_burn_rate && (
                            <span className="ml-1 text-[10px] text-gray-400" title={`Naive: ${p.naive_burn_rate}/day`}>
                              ({p.naive_burn_rate})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">
                          {p.reorder_point}
                        </td>
                        <td className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                          p.days_of_stock_left === -1
                            ? 'text-gray-400'
                            : p.days_of_stock_left <= leadTime
                            ? 'text-red-600 dark:text-red-400'
                            : p.days_of_stock_left <= leadTime * 2
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {daysLeft}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {urgent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                              STOCKOUT
                            </span>
                          ) : warning ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                              REORDER
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
              Adj. Burn = units/day excluding stockout days · ROP = Adj. Burn × {leadTime}d lead time · Naive rate in parentheses when different
            </p>
          </>
        )}
      </div>
    </div>
  );
}
