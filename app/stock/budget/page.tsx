'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Product = {
  id: number; name: string; sku: string; cost: number;
  cost_currency: string; cost_exchange_rate: number;
  price: number; stock_quantity: number; category: string | null; is_active: boolean;
};
type Supplier = {
  id: number; name: string; is_active: boolean;
};
type BudgetItem = {
  id: number; budget_id: number; product_id: number;
  product_name: string; product_sku: string;
  supplier_id: number | null; supplier_name: string | null;
  quantity: number; unit_cost: number; predicted_sell_price: number;
  line_total: number; predicted_revenue: number; predicted_roi_pct: number;
  position: number;
};
type BudgetWithItems = {
  id: number; name: string; total_budget: number;
  start_date: string; end_date: string; notes: string | null;
  is_active: boolean; created_at: string; updated_at: string;
  items: BudgetItem[];
  total_spent: number; remaining: number;
  total_predicted_revenue: number; overall_roi_pct: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: number) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(v);
const fmtDate = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ── Input helper ─────────────────────────────────────────────────────────────
const Input = ({ label, value, onChange, ...rest }: {
  label: string; value: string;
  onChange: (v: string) => void;
  [k: string]: unknown;
}) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
    <input
      {...rest as React.InputHTMLAttributes<HTMLInputElement>}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
);

// ── Product Picker (Drag & Select) ──────────────────────────────────────────
function ProductPicker({ products, onAdd }: {
  products: Product[];
  onAdd: (p: Product) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = products.filter(p =>
    p.is_active && (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleDragStart = (e: React.DragEvent, p: Product) => {
    e.dataTransfer.setData('application/json', JSON.stringify(p));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Products</h3>
        <input
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {filtered.length === 0 && (
          <p className="p-4 text-xs text-gray-400 text-center">No products found</p>
        )}
        {filtered.map(p => (
          <div
            key={p.id}
            draggable
            onDragStart={e => handleDragStart(e, p)}
            onClick={() => onAdd(p)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-grab active:cursor-grabbing transition-colors group"
            title="Drag or click to add"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</div>
              <div className="text-xs text-gray-400">{p.sku}{p.category ? ` · ${p.category}` : ''}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-gray-500">
                {p.cost_currency !== 'SGD'
                  ? `${p.cost_currency} ${p.cost.toFixed(2)} → ${fmt$(p.cost * p.cost_exchange_rate)}`
                  : fmt$(p.cost)}
              </div>
              <div className="text-xs text-gray-400">sell {fmt$(p.price)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Budget Item Row ──────────────────────────────────────────────────────────
function BudgetItemRow({ item, suppliers, onUpdate, onRemove, dragHandlers }: {
  item: BudgetItem;
  suppliers: Supplier[];
  onUpdate: (data: Partial<BudgetItem>) => void;
  onRemove: () => void;
  dragHandlers: {
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
}) {
  const roiColor = item.predicted_roi_pct >= 50 ? 'text-emerald-600 dark:text-emerald-400'
    : item.predicted_roi_pct >= 20 ? 'text-blue-600 dark:text-blue-400'
    : item.predicted_roi_pct >= 0 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <tr
      draggable
      {...dragHandlers}
      className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-grab active:cursor-grabbing"
    >
      {/* Drag handle */}
      <td className="pl-3 pr-1 py-2">
        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </td>

      {/* Product */}
      <td className="px-3 py-2">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.product_name}</div>
        <div className="text-xs text-gray-400">{item.product_sku}</div>
      </td>

      {/* Supplier */}
      <td className="px-3 py-2">
        <select
          value={item.supplier_id ?? ''}
          onChange={e => {
            const sid = e.target.value ? Number(e.target.value) : null;
            const sname = sid ? suppliers.find(s => s.id === sid)?.name ?? null : null;
            onUpdate({ supplier_id: sid, supplier_name: sname } as any);
          }}
          className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">No supplier</option>
          {suppliers.filter(s => s.is_active).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </td>

      {/* Quantity */}
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={e => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) } as any)}
          className="w-20 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </td>

      {/* Unit Cost */}
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.01}
          value={item.unit_cost}
          onChange={e => onUpdate({ unit_cost: parseFloat(e.target.value) || 0 } as any)}
          className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </td>

      {/* Sell Price */}
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.01}
          value={item.predicted_sell_price}
          onChange={e => onUpdate({ predicted_sell_price: parseFloat(e.target.value) || 0 } as any)}
          className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </td>

      {/* Line Total */}
      <td className="px-3 py-2 text-sm text-right font-medium text-gray-700 dark:text-gray-300">
        {fmt$(item.line_total)}
      </td>

      {/* Predicted Revenue */}
      <td className="px-3 py-2 text-sm text-right text-gray-600 dark:text-gray-400 hidden lg:table-cell">
        {fmt$(item.predicted_revenue)}
      </td>

      {/* ROI */}
      <td className={`px-3 py-2 text-sm text-right font-semibold ${roiColor}`}>
        {item.predicted_roi_pct.toFixed(1)}%
      </td>

      {/* Remove */}
      <td className="px-2 py-2">
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

// ── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ budget, onClose, onSave }: {
  budget: BudgetWithItems | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: budget?.name ?? '',
    total_budget: String(budget?.total_budget ?? ''),
    start_date: budget?.start_date ?? todayISO(),
    end_date: budget?.end_date ?? monthFromNow(),
    notes: budget?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Budget name is required'); return; }
    if (!form.total_budget || parseFloat(form.total_budget) < 0) { setError('Valid budget amount is required'); return; }
    if (!form.start_date || !form.end_date) { setError('Dates are required'); return; }
    if (form.start_date > form.end_date) { setError('End date must be after start date'); return; }
    setSaving(true); setError('');
    try {
      const url = budget ? `/api/stock/budgets/${budget.id}` : '/api/stock/budgets';
      const res = await fetch(url, {
        method: budget ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          total_budget: parseFloat(form.total_budget),
          start_date: form.start_date,
          end_date: form.end_date,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Save failed'); return; }
      onSave(); onClose();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold">{budget ? 'Edit Budget' : 'New Budget Cycle'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          <Input label="Budget Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. April 2026 Restock" />

          <Input label="Total Budget (SGD)" type="number" min="0" step="0.01" value={form.total_budget} onChange={v => setForm(f => ({ ...f, total_budget: v }))} placeholder="1000.00" />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} />
            <Input label="End Date" type="date" value={form.end_date} onChange={v => setForm(f => ({ ...f, end_date: v }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : budget ? 'Update' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation ──────────────────────────────────────────────────────
function DeleteDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-2">Delete Budget</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete <strong>{name}</strong>? This will remove all items and cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function BudgetPage() {
  const [budgets, setBudgets] = useState<BudgetWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetWithItems | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetWithItems | null>(null);
  const [dragItemIdx, setDragItemIdx] = useState<number | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const selectedBudget = budgets.find(b => b.id === selectedBudgetId) ?? null;

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, pRes, sRes] = await Promise.all([
        fetch('/api/stock/budgets'),
        fetch('/api/stock/products'),
        fetch('/api/stock/suppliers'),
      ]);
      const [bData, pData, sData] = await Promise.all([bRes.json(), pRes.json(), sRes.json()]);
      setBudgets(bData);
      setProducts(pData);
      setSuppliers(sData);
      if (!selectedBudgetId && bData.length > 0) setSelectedBudgetId(bData[0].id);
    } catch (err) { console.error('Fetch error', err); }
    finally { setLoading(false); }
  }, [selectedBudgetId]);

  const refreshBudget = useCallback(async () => {
    if (!selectedBudgetId) return;
    try {
      const res = await fetch(`/api/stock/budgets/${selectedBudgetId}`);
      if (!res.ok) return;
      const data = await res.json();
      setBudgets(prev => prev.map(b => b.id === selectedBudgetId ? data : b));
    } catch (err) { console.error(err); }
  }, [selectedBudgetId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Add product to budget ────────────────────────────────────────────────
  const addProduct = useCallback(async (p: Product) => {
    if (!selectedBudgetId) return;
    try {
      const res = await fetch(`/api/stock/budgets/${selectedBudgetId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: p.id,
          product_name: p.name,
          product_sku: p.sku,
          quantity: 1,
          unit_cost: Math.round(p.cost * p.cost_exchange_rate * 100) / 100,
          predicted_sell_price: p.price,
        }),
      });
      if (res.ok) refreshBudget();
    } catch (err) { console.error(err); }
  }, [selectedBudgetId, refreshBudget]);

  // ── Update item ──────────────────────────────────────────────────────────
  const updateItem = useCallback(async (itemId: number, data: Record<string, unknown>) => {
    if (!selectedBudgetId) return;
    try {
      await fetch(`/api/stock/budgets/${selectedBudgetId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, ...data }),
      });
      refreshBudget();
    } catch (err) { console.error(err); }
  }, [selectedBudgetId, refreshBudget]);

  // ── Remove item ──────────────────────────────────────────────────────────
  const removeItem = useCallback(async (itemId: number) => {
    if (!selectedBudgetId) return;
    try {
      await fetch(`/api/stock/budgets/${selectedBudgetId}/items?itemId=${itemId}`, { method: 'DELETE' });
      refreshBudget();
    } catch (err) { console.error(err); }
  }, [selectedBudgetId, refreshBudget]);

  // ── Delete budget ────────────────────────────────────────────────────────
  const deleteBudget = useCallback(async (id: number) => {
    try {
      await fetch(`/api/stock/budgets/${id}`, { method: 'DELETE' });
      setBudgets(prev => prev.filter(b => b.id !== id));
      if (selectedBudgetId === id) {
        const remaining = budgets.filter(b => b.id !== id);
        setSelectedBudgetId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) { console.error(err); }
    setDeleteTarget(null);
  }, [selectedBudgetId, budgets]);

  // ── Drag & drop for product picker onto the items area ─────────────────
  const handleDropZone = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-indigo-400');
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const p = JSON.parse(data) as Product;
        addProduct(p);
      }
    } catch { /* not a product drop */ }
  }, [addProduct]);

  const handleDragOverZone = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('ring-2', 'ring-indigo-400');
  }, []);

  const handleDragLeaveZone = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-indigo-400');
  }, []);

  // ── Drag & drop for reordering items ───────────────────────────────────
  const handleItemDragStart = useCallback((idx: number) => (e: React.DragEvent) => {
    setDragItemIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleItemDrop = useCallback((targetIdx: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (dragItemIdx === null || dragItemIdx === targetIdx || !selectedBudget) return;
    const items = [...selectedBudget.items];
    const [moved] = items.splice(dragItemIdx, 1);
    items.splice(targetIdx, 0, moved);
    // Optimistic: update local
    const reordered = items.map((it, i) => ({ ...it, position: i }));
    setBudgets(prev => prev.map(b => b.id === selectedBudget.id ? { ...b, items: reordered } : b));
    // Persist
    try {
      await fetch(`/api/stock/budgets/${selectedBudget.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: true, item_ids: reordered.map(i => i.id) }),
      });
    } catch (err) { console.error(err); }
    setDragItemIdx(null);
  }, [dragItemIdx, selectedBudget]);

  const handleItemDragEnd = useCallback(() => setDragItemIdx(null), []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budget Planning</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Allocate budgets, plan expenses, and forecast ROI</p>
        </div>
        <button
          onClick={() => { setEditBudget(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Budget
        </button>
      </div>

      {/* ── Budget Selector ─────────────────────────────────────────── */}
      {budgets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {budgets.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBudgetId(b.id)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                selectedBudgetId === b.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="font-medium">{b.name}</div>
              <div className="text-xs opacity-75">{fmtDate(b.start_date)} – {fmtDate(b.end_date)}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── No budgets state ────────────────────────────────────────── */}
      {budgets.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <svg className="mx-auto w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-2">No budget cycles yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Create a budget to start planning your expenses</p>
          <button
            onClick={() => { setEditBudget(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Budget
          </button>
        </div>
      )}

      {/* ── Selected Budget Details ─────────────────────────────────── */}
      {selectedBudget && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Budget</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{fmt$(selectedBudget.total_budget)}</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Spent</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{fmt$(selectedBudget.total_spent)}</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Remaining</div>
              <div className={`text-lg font-bold ${selectedBudget.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt$(selectedBudget.remaining)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hidden lg:block">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Predicted Revenue</div>
              <div className="text-lg font-bold text-blue-600">{fmt$(selectedBudget.total_predicted_revenue)}</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hidden lg:block">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Overall ROI</div>
              <div className={`text-lg font-bold ${selectedBudget.overall_roi_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {selectedBudget.overall_roi_pct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Budget Progress Bar */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Budget Utilisation</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {selectedBudget.total_budget > 0
                    ? ((selectedBudget.total_spent / selectedBudget.total_budget) * 100).toFixed(1)
                    : '0'}%
                </span>
                <button
                  onClick={() => { setEditBudget(selectedBudget); setShowModal(true); }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
                  title="Edit budget"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteTarget(selectedBudget)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                  title="Delete budget"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  selectedBudget.total_spent > selectedBudget.total_budget
                    ? 'bg-red-500'
                    : selectedBudget.total_spent > selectedBudget.total_budget * 0.8
                      ? 'bg-amber-500'
                      : 'bg-indigo-500'
                }`}
                style={{
                  width: `${Math.min(100, selectedBudget.total_budget > 0 ? (selectedBudget.total_spent / selectedBudget.total_budget) * 100 : 0)}%`
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{fmtDate(selectedBudget.start_date)}</span>
              <span>{fmtDate(selectedBudget.end_date)}</span>
            </div>
          </div>

          {/* ── Main Content: Product Picker + Items Table ──────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
            {/* Product Picker */}
            <div className="xl:sticky xl:top-4 xl:self-start">
              <ProductPicker products={products} onAdd={addProduct} />
            </div>

            {/* Items Table (Drop Zone) */}
            <div
              ref={dropZoneRef}
              onDrop={handleDropZone}
              onDragOver={handleDragOverZone}
              onDragLeave={handleDragLeaveZone}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-all"
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Budget Items ({selectedBudget.items.length})
                </h3>
                <span className="text-xs text-gray-400">Drag products here or click to add</span>
              </div>

              {selectedBudget.items.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="mx-auto w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm text-gray-400">Drag products from the left panel or click them to add expenses</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="pl-3 pr-1 py-2 w-8"></th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Cost</th>
                        <th className="px-3 py-2 text-right">Sell Price</th>
                        <th className="px-3 py-2 text-right">Total Cost</th>
                        <th className="px-3 py-2 text-right hidden lg:table-cell">Revenue</th>
                        <th className="px-3 py-2 text-right">ROI</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {selectedBudget.items.map((item, idx) => (
                        <BudgetItemRow
                          key={item.id}
                          item={item}
                          suppliers={suppliers}
                          onUpdate={data => updateItem(item.id, data)}
                          onRemove={() => removeItem(item.id)}
                          dragHandlers={{
                            onDragStart: handleItemDragStart(idx),
                            onDragOver: handleItemDragOver,
                            onDrop: handleItemDrop(idx),
                            onDragEnd: handleItemDragEnd,
                          }}
                        />
                      ))}
                    </tbody>
                    {/* Totals Row */}
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold text-sm">
                        <td colSpan={6} className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">Totals</td>
                        <td className="px-3 py-3 text-right text-gray-900 dark:text-white">{fmt$(selectedBudget.total_spent)}</td>
                        <td className="px-3 py-3 text-right text-blue-600 hidden lg:table-cell">{fmt$(selectedBudget.total_predicted_revenue)}</td>
                        <td className={`px-3 py-3 text-right ${selectedBudget.overall_roi_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {selectedBudget.overall_roi_pct.toFixed(1)}%
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Over-budget warning */}
          {selectedBudget.remaining < 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-400">
                <strong>Over budget</strong> by {fmt$(Math.abs(selectedBudget.remaining))}. Consider removing items or increasing the budget.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showModal && (
        <BudgetModal
          budget={editBudget}
          onClose={() => setShowModal(false)}
          onSave={fetchAll}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          onConfirm={() => deleteBudget(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
