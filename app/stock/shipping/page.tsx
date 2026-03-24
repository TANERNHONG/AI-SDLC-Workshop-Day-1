'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ShippingOrderWithPackages, Package as Pkg, Courier, CourierQuote } from '@/lib/stockdb';
import type { SaleWithItems } from '@/lib/stockdb';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'not_prepared', label: 'Not Prepared', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'packed',       label: 'Packed',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'shipped',      label: 'Shipped',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'received',     label: 'Received',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { value: 'cancelled',    label: 'Cancelled',    color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
];

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status) ?? STATUS_OPTIONS[0];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>{opt.label}</span>;
}

function SortArrow({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: 'asc' | 'desc' }) {
  if (col !== sortBy) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
  return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

export default function ShippingPage() {
  const [orders, setOrders] = useState<ShippingOrderWithPackages[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  // New shipping order
  const [showCreate, setShowCreate] = useState(false);
  const [newSaleId, setNewSaleId] = useState('');

  // Expanded order (for package management)
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const fetchOrders = useCallback(async () => {
    const params = filterStatus !== 'all' ? `?status=${filterStatus}` : '';
    const res = await fetch(`/api/stock/shipping-orders${params}`);
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, [filterStatus]);

  const fetchSales = useCallback(async () => {
    const res = await fetch('/api/stock/sales');
    if (res.ok) setSales(await res.json());
  }, []);

  const fetchCouriers = useCallback(async () => {
    const res = await fetch('/api/stock/couriers');
    if (res.ok) setCouriers(await res.json());
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchSales(); fetchCouriers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sales that don't have a shipping order yet
  const availableSales = sales.filter(s => s.status === 'completed' && !orders.some(o => o.sale_id === s.id));

  const handleCreateOrder = async () => {
    if (!newSaleId) return;
    const res = await fetch('/api/stock/shipping-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: Number(newSaleId) }),
    });
    if (res.ok) {
      const created = await res.json();
      setShowCreate(false);
      setNewSaleId('');
      await fetchOrders();
      setExpandedId(created.id);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    await fetch(`/api/stock/shipping-orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchOrders();
  };

  const handleDeleteOrder = async (id: number) => {
    if (!confirm('Delete this shipping order and all its packages?')) return;
    await fetch(`/api/stock/shipping-orders/${id}`, { method: 'DELETE' });
    if (expandedId === id) setExpandedId(null);
    fetchOrders();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading shipping orders…</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shipping Orders</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          + New Shipping Order
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">Link to Sale</label>
            <select value={newSaleId} onChange={e => setNewSaleId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700">
              <option value="">Select a sale…</option>
              {availableSales.map(s => (
                <option key={s.id} value={s.id}>{s.invoice_number} — {fmtCurrency(s.total)} ({fmtDate(s.sale_date)})</option>
              ))}
            </select>
          </div>
          <button onClick={handleCreateOrder} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">Create</button>
          <button onClick={() => { setShowCreate(false); setNewSaleId(''); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Cancel</button>
        </div>
      )}

      {/* Sort & Status filter */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="flex gap-2 flex-wrap">
          {[{ value: 'all', label: 'All' }, ...STATUS_OPTIONS].map(opt => (
            <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${filterStatus === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-indigo-400'}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
          <span>Sort:</span>
          {(['id', 'status', 'packages'] as const).map(col => (
            <button key={col} onClick={() => toggleSort(col)}
              className={`px-2 py-1 rounded text-xs font-medium transition ${sortBy === col ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {col === 'id' ? 'Order #' : col === 'packages' ? 'Packages' : 'Status'}
              <SortArrow col={col} sortBy={sortBy} sortDir={sortDir} />
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        {[...orders].sort((a, b) => {
          let cmp = 0;
          switch (sortBy) {
            case 'id': cmp = a.id - b.id; break;
            case 'status': cmp = a.status.localeCompare(b.status); break;
            case 'packages': cmp = a.packages.length - b.packages.length; break;
          }
          return sortDir === 'asc' ? cmp : -cmp;
        }).map(order => (
          <div key={order.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono font-medium">{order.invoice_number ?? `SO-${order.id}`}</span>
                <StatusBadge status={order.status} />
                <span className="text-xs text-gray-500">{order.packages.length} package{order.packages.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-3">
                <select value={order.status} onClick={e => e.stopPropagation()}
                  onChange={e => handleUpdateStatus(order.id, e.target.value)}
                  className="border rounded-lg px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-700">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={e => { e.stopPropagation(); handleDeleteOrder(order.id); }}
                  className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                <svg className={`w-4 h-4 transition-transform ${expandedId === order.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded package area */}
            {expandedId === order.id && (
              <PackageManager orderId={order.id} packages={order.packages} couriers={couriers} onRefresh={fetchOrders} />
            )}
          </div>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-12 text-gray-400">No shipping orders found.</div>
        )}
      </div>
    </div>
  );
}

// ── Package Manager ───────────────────────────────────────────────────────────

function PackageManager({ orderId, packages, couriers, onRefresh }: {
  orderId: number;
  packages: Pkg[];
  couriers: Courier[];
  onRefresh: () => void;
}) {
  const [form, setForm] = useState({ length_cm: '', width_cm: '', height_cm: '', weight_kg: '', courier_id: '', notes: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [quotes, setQuotes] = useState<CourierQuote[]>([]);
  const [showQuotes, setShowQuotes] = useState(false);

  const fetchQuotes = async () => {
    if (!form.length_cm || !form.width_cm || !form.height_cm || !form.weight_kg) return;
    const p = new URLSearchParams({
      length_cm: form.length_cm, width_cm: form.width_cm,
      height_cm: form.height_cm, weight_kg: form.weight_kg,
    });
    const res = await fetch(`/api/stock/couriers/recommend?${p}`);
    if (res.ok) {
      setQuotes(await res.json());
      setShowQuotes(true);
    }
  };

  const handleSave = async () => {
    const payload: any = {
      length_cm: +form.length_cm || 0, width_cm: +form.width_cm || 0,
      height_cm: +form.height_cm || 0, weight_kg: +form.weight_kg || 0,
      courier_id: form.courier_id ? +form.courier_id : null,
      notes: form.notes.trim() || null,
    };
    if (editId) {
      await fetch(`/api/stock/shipping-orders/${orderId}/packages/${editId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/stock/shipping-orders/${orderId}/packages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/stock/shipping-orders/${orderId}/packages/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const resetForm = () => {
    setForm({ length_cm: '', width_cm: '', height_cm: '', weight_kg: '', courier_id: '', notes: '' });
    setEditId(null);
    setShowQuotes(false);
    setQuotes([]);
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Packages</h3>
      </div>

      {/* Add / Edit form */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium mb-1">Length (cm)</label>
            <input type="number" step="0.1" value={form.length_cm} onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Width (cm)</label>
            <input type="number" step="0.1" value={form.width_cm} onChange={e => setForm(f => ({ ...f, width_cm: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Height (cm)</label>
            <input type="number" step="0.1" value={form.height_cm} onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Weight (kg)</label>
            <input type="number" step="0.01" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Courier (optional)</label>
            <select value={form.courier_id} onChange={e => setForm(f => ({ ...f, courier_id: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm w-36 dark:bg-gray-800 dark:border-gray-700">
              <option value="">Auto-select</option>
              {couriers.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Notes</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700" placeholder="Optional notes…" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            {editId ? 'Update Package' : 'Add Package'}
          </button>
          <button onClick={fetchQuotes} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">
            Compare Couriers
          </button>
          {editId && <button onClick={resetForm} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Cancel</button>}
        </div>

        {/* Quotes comparison */}
        {showQuotes && quotes.length > 0 && (
          <div className="mt-3 border rounded-lg overflow-hidden dark:border-gray-700">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-100 dark:bg-gray-800 text-left text-gray-500">
                <th className="py-2 px-3">Courier</th><th className="py-2 px-3">Base Price</th><th className="py-2 px-3">Bulk Discount</th><th className="py-2 px-3">Final Price</th><th className="py-2 px-3">Fits?</th><th className="py-2 px-3"></th>
              </tr></thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.courier_id} className={`border-t dark:border-gray-700 ${!q.fits ? 'opacity-40' : ''}`}>
                    <td className="py-2 px-3 font-medium">{q.courier_name}</td>
                    <td className="py-2 px-3">{q.fits ? fmtCurrency(q.base_price) : '—'}</td>
                    <td className="py-2 px-3">{q.bulk_discount_pct > 0 ? `${q.bulk_discount_pct}%` : '—'}</td>
                    <td className="py-2 px-3 font-semibold">{q.fits ? fmtCurrency(q.discounted_price) : 'N/A'}</td>
                    <td className="py-2 px-3">{q.fits ? '✓' : '✗'}</td>
                    <td className="py-2 px-3">
                      {q.fits && (
                        <button onClick={() => { setForm(f => ({ ...f, courier_id: String(q.courier_id) })); setShowQuotes(false); }}
                          className="text-indigo-600 hover:underline text-xs">Select</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Existing packages */}
      {packages.length > 0 ? (
        <table className="w-full text-sm">
          <thead><tr className="border-b dark:border-gray-700 text-left text-gray-500">
            <th className="py-2 px-3">#</th><th className="py-2 px-3">Dimensions (cm)</th><th className="py-2 px-3">Weight</th>
            <th className="py-2 px-3">Courier</th><th className="py-2 px-3">Est. Cost</th><th className="py-2 px-3">Notes</th><th className="py-2 px-3 w-24"></th>
          </tr></thead>
          <tbody>
            {packages.map((p, i) => (
              <tr key={p.id} className="border-b dark:border-gray-800">
                <td className="py-2 px-3">{i + 1}</td>
                <td className="py-2 px-3">{p.length_cm} × {p.width_cm} × {p.height_cm}</td>
                <td className="py-2 px-3">{p.weight_kg} kg</td>
                <td className="py-2 px-3">{p.courier_name ?? <span className="text-gray-400">None</span>}</td>
                <td className="py-2 px-3">{p.estimated_cost != null ? fmtCurrency(p.estimated_cost) : '—'}</td>
                <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]">{p.notes ?? ''}</td>
                <td className="py-2 px-3 flex gap-2">
                  <button onClick={() => {
                    setEditId(p.id);
                    setForm({
                      length_cm: String(p.length_cm), width_cm: String(p.width_cm),
                      height_cm: String(p.height_cm), weight_kg: String(p.weight_kg),
                      courier_id: p.courier_id ? String(p.courier_id) : '',
                      notes: p.notes ?? '',
                    });
                  }} className="text-indigo-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">No packages yet — add one above.</p>
      )}
    </div>
  );
}
