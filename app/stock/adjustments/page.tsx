'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Product = {
  id: number; name: string; sku: string; stock_quantity: number; is_active: boolean;
};
type StockEvent = {
  id: number; product_id: number; product_name: string; product_sku: string;
  event_type: string; quantity: number; notes: string | null;
  event_date: string; created_at: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = ['Damage', 'Exchange', 'Incorrect Size', 'Inventory Count', 'Other'] as const;

const EVENT_BADGE: Record<string, string> = {
  Damage:           'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Exchange:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Incorrect Size': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Inventory Count':'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Other:            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── EventModal ────────────────────────────────────────────────────────────────
function EventModal({
  event,
  products,
  onClose,
  onSave,
}: {
  event: StockEvent | null;       // null = new, object = editing
  products: Product[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !event;

  const [form, setForm] = useState({
    product_id: event?.product_id?.toString() ?? '',
    event_type: event?.event_type ?? 'Damage',
    customType: '',
    direction: event ? (event.quantity >= 0 ? 'add' : 'remove') : 'remove',
    quantity: event ? Math.abs(event.quantity).toString() : '1',
    notes: event?.notes ?? '',
    event_date: event?.event_date?.slice(0, 10) ?? todayISO(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // When event_type is "Other" in edit mode, populate customType
  useEffect(() => {
    if (event && !EVENT_TYPES.includes(event.event_type as typeof EVENT_TYPES[number])) {
      setForm(f => ({ ...f, event_type: 'Other', customType: event.event_type }));
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const product_id = Number(form.product_id);
    if (!product_id) { setError('Please select a product.'); return; }

    const qty = parseInt(form.quantity);
    if (!qty || qty <= 0) { setError('Quantity must be a positive number.'); return; }

    const finalType = form.event_type === 'Other' && form.customType.trim()
      ? form.customType.trim()
      : form.event_type;
    const signedQty = form.direction === 'remove' ? -qty : qty;

    setSaving(true);
    try {
      const url = isNew ? '/api/stock/stock-events' : `/api/stock/stock-events/${event.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id,
          event_type: finalType,
          quantity: signedQty,
          notes: form.notes.trim() || null,
          event_date: form.event_date,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSave();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-lg"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isNew ? 'New Stock Adjustment' : 'Edit Stock Adjustment'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Product */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Product *
            </label>
            <select
              value={form.product_id}
              onChange={e => setForm({ ...form, product_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">Select a product…</option>
              {products.filter(p => p.is_active).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Reason *
            </label>
            <select
              value={form.event_type}
              onChange={e => setForm({ ...form, event_type: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {form.event_type === 'Other' && (
              <input
                value={form.customType}
                onChange={e => setForm({ ...form, customType: e.target.value })}
                placeholder="Enter custom reason…"
                className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            )}
          </div>

          {/* Direction + Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Direction
              </label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, direction: 'remove' })}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    form.direction === 'remove'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  − Remove
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, direction: 'add' })}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    form.direction === 'add'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  + Add
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all tabular-nums"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={form.event_date}
              onChange={e => setForm({ ...form, event_date: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional details about this adjustment…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold text-white shadow-sm transition-all hover:shadow">
              {saving ? 'Saving…' : isNew ? 'Create Adjustment' : 'Update Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────
function DeleteConfirmModal({
  event,
  onClose,
  onConfirm,
}: {
  event: StockEvent;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/stock/stock-events/${event.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onConfirm();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-sm p-6 space-y-4"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Adjustment?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {event.event_type} — {event.product_name} ({event.quantity > 0 ? '+' : ''}{event.quantity})
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This will permanently remove this stock adjustment. The product&apos;s computed stock will be updated accordingly.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm font-semibold text-white shadow-sm transition-all">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StockAdjustmentsPage() {
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modal state: undefined = closed, null = new, object = editing
  const [modalEvent, setModalEvent] = useState<StockEvent | null | undefined>(undefined);
  const [deleteEvent, setDeleteEvent] = useState<StockEvent | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterProduct) params.set('product_id', filterProduct);
      const res = await fetch(`/api/stock/stock-events?${params}`);
      if (res.ok) setEvents(await res.json());
    } catch { /* ignore */ }
  }, [filterProduct]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/stock/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.products ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchEvents(), fetchProducts()]).then(() => setLoading(false));
  }, [fetchEvents, fetchProducts]);

  // Apply client-side filters
  const filtered = events.filter(ev => {
    if (filterType && ev.event_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        ev.product_name.toLowerCase().includes(q) ||
        ev.product_sku.toLowerCase().includes(q) ||
        ev.event_type.toLowerCase().includes(q) ||
        (ev.notes ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const totalAdded = events.reduce((s, e) => s + (e.quantity > 0 ? e.quantity : 0), 0);
  const totalRemoved = events.reduce((s, e) => s + (e.quantity < 0 ? Math.abs(e.quantity) : 0), 0);
  const uniqueProducts = new Set(events.map(e => e.product_id)).size;

  const handleSave = () => {
    setModalEvent(undefined);
    fetchEvents();
    fetchProducts();
  };

  const handleDelete = () => {
    setDeleteEvent(null);
    fetchEvents();
    fetchProducts();
  };

  const getBadgeClass = (type: string) =>
    EVENT_BADGE[type] ?? EVENT_BADGE.Other;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Adjustments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manual stock corrections for damages, exchanges, and inventory counts
          </p>
        </div>
        <button
          onClick={() => setModalEvent(null)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Adjustment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Added</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">+{totalAdded}</p>
          <p className="text-xs text-gray-400 mt-0.5">units added via adjustments</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Removed</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">−{totalRemoved}</p>
          <p className="text-xs text-gray-400 mt-0.5">units removed via adjustments</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Products Affected</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{uniqueProducts}</p>
          <p className="text-xs text-gray-400 mt-0.5">products with adjustments</p>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, SKU, or notes…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
          />
        </div>
        {/* Product filter */}
        <select
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
        >
          <option value="">All Products</option>
          {products.filter(p => p.is_active).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {/* Type filter */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
        >
          <option value="">All Reasons</option>
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400 text-sm">
          Loading adjustments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-16 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-2xl">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No adjustments found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {events.length === 0 ? 'Add your first stock adjustment to track inventory corrections.' : 'Try adjusting your filters.'}
          </p>
          {events.length === 0 && (
            <button onClick={() => setModalEvent(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow mt-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Adjustment
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reason</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Qty Change</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {filtered.map(ev => (
                  <tr key={ev.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {fmtDate(ev.event_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{ev.product_name}</div>
                      <div className="text-xs text-gray-400">{ev.product_sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getBadgeClass(ev.event_type)}`}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap ${
                      ev.quantity > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {ev.quantity > 0 ? '+' : ''}{ev.quantity}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                      {ev.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModalEvent(ev)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteEvent(ev)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Table footer */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
            Showing {filtered.length} of {events.length} adjustment{events.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Modals */}
      {modalEvent !== undefined && (
        <EventModal event={modalEvent} products={products} onClose={() => setModalEvent(undefined)} onSave={handleSave} />
      )}
      {deleteEvent && (
        <DeleteConfirmModal event={deleteEvent} onClose={() => setDeleteEvent(null)} onConfirm={handleDelete} />
      )}
    </div>
  );
}
