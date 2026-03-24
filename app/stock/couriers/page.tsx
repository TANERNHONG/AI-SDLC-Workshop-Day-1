'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Courier, CourierRateTable, CourierBulkSaving, CourierSurcharge, CourierAdditionalService } from '@/lib/stockdb';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
}

function SortArrow({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: 'asc' | 'desc' }) {
  if (col !== sortBy) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>;
  return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

function useSort(defaultCol: string, defaultDir: 'asc' | 'desc' = 'asc') {
  const [sortBy, setSortBy] = useState<string>(defaultCol);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);
  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  return { sortBy, sortDir, toggleSort };
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type SubTab = 'rates' | 'bulk' | 'surcharges' | 'services';

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selected, setSelected] = useState<Courier | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('rates');
  const [loading, setLoading] = useState(true);

  // New courier form
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchCouriers = useCallback(async () => {
    const res = await fetch('/api/stock/couriers');
    if (res.ok) {
      const data = await res.json();
      setCouriers(data);
      if (!selected && data.length > 0) setSelected(data[0]);
      else if (selected) {
        const updated = data.find((c: Courier) => c.id === selected.id);
        if (updated) setSelected(updated);
      }
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => { fetchCouriers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddCourier = async () => {
    if (!newName.trim()) return;
    const res = await fetch('/api/stock/couriers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      setNewName('');
      setShowAdd(false);
      await fetchCouriers();
      setSelected(created);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading couriers…</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courier Management</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          + Add Courier
        </button>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">Courier Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. FedEx"
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <button onClick={handleAddCourier} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">Save</button>
          <button onClick={() => { setShowAdd(false); setNewName(''); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Cancel</button>
        </div>
      )}

      {/* Courier selector */}
      <div className="flex gap-2 flex-wrap">
        {couriers.map(c => (
          <button key={c.id} onClick={() => { setSelected(c); setSubTab('rates'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${selected?.id === c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-indigo-400'}`}>
            {c.name}
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Sub-tab nav + delete */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            {([['rates', 'Rate Tables'], ['bulk', 'Bulk Savings'], ['surcharges', 'Surcharges'], ['services', 'Services']] as [SubTab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setSubTab(key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition ${subTab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center pr-3">
              <button onClick={async () => {
                if (!confirm(`Delete courier "${selected.name}"? This will also remove all its rate tables, bulk savings, surcharges, and services.`)) return;
                const res = await fetch(`/api/stock/couriers/${selected.id}`, { method: 'DELETE' });
                if (res.ok) {
                  setSelected(null);
                  fetchCouriers();
                }
              }} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition">
                Delete Courier
              </button>
            </div>
          </div>

          <div className="p-5">
            {subTab === 'rates' && <RateTablesPanel courierId={selected.id} />}
            {subTab === 'bulk' && <BulkSavingsPanel courierId={selected.id} />}
            {subTab === 'surcharges' && <SurchargesPanel courierId={selected.id} />}
            {subTab === 'services' && <AdditionalServicesPanel courierId={selected.id} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rate Tables Panel ─────────────────────────────────────────────────────────

function RateTablesPanel({ courierId }: { courierId: number }) {
  const [rows, setRows] = useState<CourierRateTable[]>([]);
  const [form, setForm] = useState({ max_weight_kg: '', max_length_cm: '', max_width_cm: '', max_height_cm: '', price: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const { sortBy, sortDir, toggleSort } = useSort('max_weight_kg');

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/stock/couriers/${courierId}/rate-tables`);
    if (res.ok) setRows(await res.json());
  }, [courierId]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSave = async () => {
    if (!form.max_weight_kg || !form.price) return;
    const payload = { max_weight_kg: +form.max_weight_kg, max_length_cm: +(form.max_length_cm || 0), max_width_cm: +(form.max_width_cm || 0), max_height_cm: +(form.max_height_cm || 0), price: +form.price };
    if (editId) {
      await fetch(`/api/stock/couriers/${courierId}/rate-tables`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: editId, ...payload }),
      });
    } else {
      await fetch(`/api/stock/couriers/${courierId}/rate-tables`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setForm({ max_weight_kg: '', max_length_cm: '', max_width_cm: '', max_height_cm: '', price: '' });
    setEditId(null);
    fetch_();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/stock/couriers/${courierId}/rate-tables?entry_id=${id}`, { method: 'DELETE' });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Define weight and dimension tiers with base prices. Dimensions are maximum allowed per side (L, W, H).</p>
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1">Max Weight (kg)</label>
          <input type="number" step="0.1" value={form.max_weight_kg} onChange={e => setForm(f => ({ ...f, max_weight_kg: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-28 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Max L (cm)</label>
          <input type="number" step="0.1" value={form.max_length_cm} onChange={e => setForm(f => ({ ...f, max_length_cm: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Max W (cm)</label>
          <input type="number" step="0.1" value={form.max_width_cm} onChange={e => setForm(f => ({ ...f, max_width_cm: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Max H (cm)</label>
          <input type="number" step="0.1" value={form.max_height_cm} onChange={e => setForm(f => ({ ...f, max_height_cm: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Price (SGD)</label>
          <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-28 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">{editId ? 'Update' : 'Add'}</button>
        {editId && <button onClick={() => { setEditId(null); setForm({ max_weight_kg: '', max_length_cm: '', max_width_cm: '', max_height_cm: '', price: '' }); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Cancel</button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b dark:border-gray-700 text-left text-gray-500">
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('max_weight_kg')}>Weight (kg)<SortArrow col="max_weight_kg" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('max_length_cm')}>Max L (cm)<SortArrow col="max_length_cm" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('max_width_cm')}>Max W (cm)<SortArrow col="max_width_cm" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('max_height_cm')}>Max H (cm)<SortArrow col="max_height_cm" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('price')}>Price<SortArrow col="price" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 w-24"></th>
        </tr></thead>
        <tbody>
          {[...rows].sort((a, b) => {
            const av = (a as any)[sortBy] ?? 0, bv = (b as any)[sortBy] ?? 0;
            const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
            return sortDir === 'asc' ? cmp : -cmp;
          }).map(r => (
            <tr key={r.id} className="border-b dark:border-gray-800">
              <td className="py-2 px-3">≤ {r.max_weight_kg}</td>
              <td className="py-2 px-3">≤ {r.max_length_cm}</td>
              <td className="py-2 px-3">≤ {r.max_width_cm}</td>
              <td className="py-2 px-3">≤ {r.max_height_cm}</td>
              <td className="py-2 px-3">{fmtCurrency(r.price)}</td>
              <td className="py-2 px-3 flex gap-2">
                <button onClick={() => { setEditId(r.id); setForm({ max_weight_kg: String(r.max_weight_kg), max_length_cm: String(r.max_length_cm), max_width_cm: String(r.max_width_cm), max_height_cm: String(r.max_height_cm), price: String(r.price) }); }}
                  className="text-indigo-600 hover:underline text-xs">Edit</button>
                <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">No rate tiers yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Bulk Savings Panel ────────────────────────────────────────────────────────

function BulkSavingsPanel({ courierId }: { courierId: number }) {
  const [rows, setRows] = useState<CourierBulkSaving[]>([]);
  const [form, setForm] = useState({ min_orders: '', max_orders: '', discount_pct: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const { sortBy, sortDir, toggleSort } = useSort('min_orders');

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/stock/couriers/${courierId}/bulk-savings`);
    if (res.ok) setRows(await res.json());
  }, [courierId]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSave = async () => {
    if (!form.min_orders || !form.discount_pct) return;
    const payload: any = { min_orders: +form.min_orders, discount_pct: +form.discount_pct, max_orders: form.max_orders ? +form.max_orders : null };
    if (editId) {
      await fetch(`/api/stock/couriers/${courierId}/bulk-savings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: editId, ...payload }),
      });
    } else {
      await fetch(`/api/stock/couriers/${courierId}/bulk-savings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setForm({ min_orders: '', max_orders: '', discount_pct: '' });
    setEditId(null);
    fetch_();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/stock/couriers/${courierId}/bulk-savings?entry_id=${id}`, { method: 'DELETE' });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Tiered discounts based on monthly shipping order count.</p>
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1">Min Orders</label>
          <input type="number" value={form.min_orders} onChange={e => setForm(f => ({ ...f, min_orders: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Max Orders</label>
          <input type="number" value={form.max_orders} onChange={e => setForm(f => ({ ...f, max_orders: e.target.value }))} placeholder="∞"
            className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Discount %</label>
          <input type="number" step="0.1" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-24 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">{editId ? 'Update' : 'Add'}</button>
        {editId && <button onClick={() => { setEditId(null); setForm({ min_orders: '', max_orders: '', discount_pct: '' }); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Cancel</button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b dark:border-gray-700 text-left text-gray-500">
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('min_orders')}>Min Orders<SortArrow col="min_orders" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('max_orders')}>Max Orders<SortArrow col="max_orders" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('discount_pct')}>Discount<SortArrow col="discount_pct" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 w-24"></th>
        </tr></thead>
        <tbody>
          {[...rows].sort((a, b) => {
            const av = (a as any)[sortBy] ?? 0, bv = (b as any)[sortBy] ?? 0;
            const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
            return sortDir === 'asc' ? cmp : -cmp;
          }).map(r => (
            <tr key={r.id} className="border-b dark:border-gray-800">
              <td className="py-2 px-3">{r.min_orders}</td>
              <td className="py-2 px-3">{r.max_orders ?? '∞'}</td>
              <td className="py-2 px-3">{r.discount_pct}%</td>
              <td className="py-2 px-3 flex gap-2">
                <button onClick={() => { setEditId(r.id); setForm({ min_orders: String(r.min_orders), max_orders: r.max_orders != null ? String(r.max_orders) : '', discount_pct: String(r.discount_pct) }); }}
                  className="text-indigo-600 hover:underline text-xs">Edit</button>
                <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No bulk savings tiers</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Surcharges Panel ──────────────────────────────────────────────────────────

function SurchargesPanel({ courierId }: { courierId: number }) {
  const [rows, setRows] = useState<CourierSurcharge[]>([]);
  const [form, setForm] = useState({ item_name: '', price: '', description: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const { sortBy, sortDir, toggleSort } = useSort('item_name');

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/stock/couriers/${courierId}/surcharges`);
    if (res.ok) setRows(await res.json());
  }, [courierId]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSave = async () => {
    if (!form.item_name.trim() || !form.price) return;
    const payload = { item_name: form.item_name.trim(), price: +form.price, description: form.description.trim() };
    if (editId) {
      await fetch(`/api/stock/couriers/${courierId}/surcharges`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: editId, ...payload }),
      });
    } else {
      await fetch(`/api/stock/couriers/${courierId}/surcharges`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setForm({ item_name: '', price: '', description: '' });
    setEditId(null);
    fetch_();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/stock/couriers/${courierId}/surcharges?entry_id=${id}`, { method: 'DELETE' });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Add-on charges (area, night delivery, waiting time, etc.)</p>
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1">Item Name</label>
          <input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-40 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Price (SGD)</label>
          <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-28 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium mb-1">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">{editId ? 'Update' : 'Add'}</button>
        {editId && <button onClick={() => { setEditId(null); setForm({ item_name: '', price: '', description: '' }); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Cancel</button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b dark:border-gray-700 text-left text-gray-500">
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('item_name')}>Item<SortArrow col="item_name" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('price')}>Price<SortArrow col="price" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('description')}>Description<SortArrow col="description" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 w-24"></th>
        </tr></thead>
        <tbody>
          {[...rows].sort((a, b) => {
            const av = (a as any)[sortBy] ?? '', bv = (b as any)[sortBy] ?? '';
            const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
            return sortDir === 'asc' ? cmp : -cmp;
          }).map(r => (
            <tr key={r.id} className="border-b dark:border-gray-800">
              <td className="py-2 px-3">{r.item_name}</td>
              <td className="py-2 px-3">{fmtCurrency(r.price)}</td>
              <td className="py-2 px-3 text-gray-500">{r.description || '—'}</td>
              <td className="py-2 px-3 flex gap-2">
                <button onClick={() => { setEditId(r.id); setForm({ item_name: r.item_name, price: String(r.price), description: r.description ?? '' }); }}
                  className="text-indigo-600 hover:underline text-xs">Edit</button>
                <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No surcharges</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ── Additional Services Panel ─────────────────────────────────────────────────

function AdditionalServicesPanel({ courierId }: { courierId: number }) {
  const [rows, setRows] = useState<CourierAdditionalService[]>([]);
  const [form, setForm] = useState({ service_name: '', price: '', description: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const { sortBy, sortDir, toggleSort } = useSort('service_name');

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/stock/couriers/${courierId}/additional-services`);
    if (res.ok) setRows(await res.json());
  }, [courierId]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSave = async () => {
    if (!form.service_name.trim() || !form.price) return;
    const payload = { service_name: form.service_name.trim(), price: +form.price, description: form.description.trim() };
    if (editId) {
      await fetch(`/api/stock/couriers/${courierId}/additional-services`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: editId, ...payload }),
      });
    } else {
      await fetch(`/api/stock/couriers/${courierId}/additional-services`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setForm({ service_name: '', price: '', description: '' });
    setEditId(null);
    fetch_();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/stock/couriers/${courierId}/additional-services?entry_id=${id}`, { method: 'DELETE' });
    fetch_();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Optional value-added services offered by this courier.</p>
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-medium mb-1">Service Name</label>
          <input value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-40 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Price (SGD)</label>
          <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-28 dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-medium mb-1">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700" />
        </div>
        <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">{editId ? 'Update' : 'Add'}</button>
        {editId && <button onClick={() => { setEditId(null); setForm({ service_name: '', price: '', description: '' }); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Cancel</button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b dark:border-gray-700 text-left text-gray-500">
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('service_name')}>Service<SortArrow col="service_name" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('price')}>Price<SortArrow col="price" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('description')}>Description<SortArrow col="description" sortBy={sortBy} sortDir={sortDir} /></th>
          <th className="py-2 px-3 w-24"></th>
        </tr></thead>
        <tbody>
          {[...rows].sort((a, b) => {
            const av = (a as any)[sortBy] ?? '', bv = (b as any)[sortBy] ?? '';
            const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
            return sortDir === 'asc' ? cmp : -cmp;
          }).map(r => (
            <tr key={r.id} className="border-b dark:border-gray-800">
              <td className="py-2 px-3">{r.service_name}</td>
              <td className="py-2 px-3">{fmtCurrency(r.price)}</td>
              <td className="py-2 px-3 text-gray-500">{r.description || '—'}</td>
              <td className="py-2 px-3 flex gap-2">
                <button onClick={() => { setEditId(r.id); setForm({ service_name: r.service_name, price: String(r.price), description: r.description ?? '' }); }}
                  className="text-indigo-600 hover:underline text-xs">Edit</button>
                <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Del</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No additional services</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
