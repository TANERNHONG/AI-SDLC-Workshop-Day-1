'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Supplier = {
  id: number; name: string; contact_person: string | null;
  email: string | null; phone: string | null; address: string | null;
  notes: string | null; is_active: boolean;
};
type Product = {
  id: number; name: string; sku: string; cost: number;
  price: number; stock_quantity: number; category: string | null; is_active: boolean;
};
type CartItem = { product_id: number; product_name: string; product_sku: string; quantity: number; unit_cost: number; };
type PurchaseItem = { id: number; product_id: number; product_name: string; product_sku: string; quantity: number; unit_cost: number; line_total: number; };
type Purchase = {
  id: number; supplier_id: number; supplier_name: string;
  purchase_date: string; invoice_ref: string;
  subtotal: number; discount: number; tax: number; shipping_cost: number;
  currency: string; exchange_rate: number; total_cost: number;
  status: 'received' | 'pending' | 'cancelled'; notes: string | null;
  items: PurchaseItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: number) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(v);
const fmtDate = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_BADGE: Record<string, string> = {
  received:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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

// ── SupplierModal ─────────────────────────────────────────────────────────────
function SupplierModal({ supplier, onClose, onSave }: {
  supplier: Supplier | null; onClose: () => void; onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contact_person: supplier?.contact_person ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
    is_active: supplier?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    setSaving(true); setError('');
    try {
      const url = supplier ? `/api/stock/suppliers/${supplier.id}` : '/api/stock/suppliers';
      const res = await fetch(url, {
        method: supplier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError((await res.json()).error || 'Save failed'); return; }
      onSave(); onClose();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
          <Input label="Name *" value={form.name} onChange={set('name')} placeholder="ABC Supplies Pte Ltd" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact Person" value={form.contact_person} onChange={set('contact_person')} placeholder="John Tan" />
            <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+65 9123 4567" />
          </div>
          <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="orders@supplier.com" />
          <Input label="Address" value={form.address} onChange={set('address')} placeholder="123 Industrial Rd, Singapore" />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Payment terms, lead times…" />
          </div>
          {supplier && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              Active supplier
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : supplier ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Currency helpers ──────────────────────────────────────────────────────────
const CURRENCY_OPTIONS = [
  { code: 'SGD', symbol: 'S$', label: 'SGD — Singapore Dollar' },
  { code: 'USD', symbol: 'US$', label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound' },
  { code: 'MYR', symbol: 'RM', label: 'MYR — Malaysian Ringgit' },
  { code: 'CNY', symbol: '¥', label: 'CNY — Chinese Yuan' },
  { code: 'JPY', symbol: '¥', label: 'JPY — Japanese Yen' },
  { code: 'KRW', symbol: '₩', label: 'KRW — Korean Won' },
  { code: 'THB', symbol: '฿', label: 'THB — Thai Baht' },
  { code: 'TWD', symbol: 'NT$', label: 'TWD — Taiwan Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar' },
  { code: 'IDR', symbol: 'Rp', label: 'IDR — Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', label: 'PHP — Philippine Peso' },
  { code: 'VND', symbol: '₫', label: 'VND — Vietnamese Dong' },
];
const currSymbol = (code: string) => CURRENCY_OPTIONS.find(c => c.code === code)?.symbol ?? code;

// ── % / $ Toggle Button ──────────────────────────────────────────────────────
function PctToggle({ isPercent, onToggle }: { isPercent: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} title="Toggle $ / %"
      className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-500 hover:text-indigo-600 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors tabular-nums min-w-[30px]">
      {isPercent ? '%' : '$'}
    </button>
  );
}

// ── NewPurchaseModal ──────────────────────────────────────────────────────────
function NewPurchaseModal({ suppliers, products, onClose, onSave }: {
  suppliers: Supplier[]; products: Product[]; onClose: () => void; onSave: () => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [invoiceRef, setInvoiceRef] = useState('');
  const [status, setStatus] = useState<'received' | 'pending'>('received');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [discountIsPct, setDiscountIsPct] = useState(false);
  const [tax, setTax] = useState('0');
  const [taxIsPct, setTaxIsPct] = useState(false);
  const [shippingCost, setShippingCost] = useState('0');
  const [currency, setCurrency] = useState('SGD');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeProducts = products.filter(p => p.is_active);
  const filteredProducts = activeProducts.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const p = products.find(p => p.id === Number(id));
    if (p) setUnitCost(String(p.cost || ''));
  };

  const addToCart = () => {
    if (!selectedProductId) { setError('Select a product'); return; }
    const product = products.find(p => p.id === Number(selectedProductId));
    if (!product) return;
    const q = Math.max(1, Number(qty) || 1);
    const cost = Math.max(0, Number(unitCost) || 0);
    const existing = cart.findIndex(c => c.product_id === product.id);
    if (existing >= 0) {
      setCart(c => c.map((item, i) => i === existing ? { ...item, quantity: item.quantity + q, unit_cost: cost } : item));
    } else {
      setCart(c => [...c, { product_id: product.id, product_name: product.name, product_sku: product.sku, quantity: q, unit_cost: cost }]);
    }
    setSelectedProductId(''); setProductSearch(''); setQty('1'); setUnitCost(''); setError('');
  };

  const subtotal = cart.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
  const discountAmt = discountIsPct ? subtotal * ((Number(discount) || 0) / 100) : (Number(discount) || 0);
  const taxAmt = taxIsPct ? subtotal * ((Number(tax) || 0) / 100) : (Number(tax) || 0);
  const shippingAmt = Number(shippingCost) || 0;
  const rate = Number(exchangeRate) || 1;
  const foreignTotal = subtotal - discountAmt + taxAmt + shippingAmt;
  const sgdTotal = foreignTotal * rate;
  const isForeign = currency !== 'SGD';
  const sym = currSymbol(currency);

  const handleSubmit = async () => {
    if (!supplierId) { setError('Please select a supplier'); return; }
    if (cart.length === 0) { setError('Add at least one item'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/stock/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          items: cart,
          discount: discountAmt,
          tax: taxAmt,
          shipping_cost: shippingAmt,
          currency,
          exchange_rate: rate,
          notes, purchase_date: purchaseDate,
          invoice_ref: invoiceRef || undefined,
          status,
        }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
      onSave(); onClose();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg font-semibold">New Purchase Order</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select supplier…</option>
                {suppliers.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Invoice Ref (optional)</label>
              <input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as 'received' | 'pending')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="received">Received (updates stock now)</option>
                <option value="pending">Pending (no stock change yet)</option>
              </select>
            </div>
          </div>

          {/* Currency + Exchange Rate */}
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-sky-700 dark:text-sky-300">Currency & Conversion</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice Currency</label>
                <select value={currency} onChange={e => { setCurrency(e.target.value); if (e.target.value === 'SGD') setExchangeRate('1'); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                  {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Exchange Rate {isForeign && <span className="text-sky-600 dark:text-sky-400">(1 {currency} = ? SGD)</span>}
                </label>
                <input type="number" step="0.0001" min="0" value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  disabled={!isForeign}
                  placeholder="1.0000"
                  className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${!isForeign ? 'opacity-50 cursor-not-allowed' : ''}`} />
              </div>
            </div>
            {isForeign && (
              <p className="text-xs text-sky-600 dark:text-sky-400">
                All item prices, discount, tax & shipping are in <strong>{currency}</strong>. The final total is converted to SGD at the rate above.
              </p>
            )}
          </div>

          {/* Product add row */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Items</p>
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Search Product</label>
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Name or SKU…"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Product</label>
                <select value={selectedProductId} onChange={e => handleSelectProduct(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select…</option>
                  {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Qty</label>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Unit Cost ({sym})</label>
                <input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <button onClick={addToCart} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit Cost ({sym})</th>
                    <th className="px-4 py-2 text-right">Total ({sym})</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {cart.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                        <p className="text-xs text-gray-400">{item.product_sku}</p>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" min="1" value={item.quantity}
                          onChange={e => setCart(c => c.map((ci, i) => i === idx ? { ...ci, quantity: Math.max(1, Number(e.target.value) || 1) } : ci))}
                          className="w-16 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" min="0" step="0.01" value={item.unit_cost}
                          onChange={e => setCart(c => c.map((ci, i) => i === idx ? { ...ci, unit_cost: Number(e.target.value) || 0 } : ci))}
                          className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{sym}{(item.unit_cost * item.quantity).toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => setCart(c => c.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="flex flex-col items-end gap-1.5 text-sm">
            <div className="flex gap-6">
              <span className="text-gray-500">Subtotal ({sym})</span>
              <span className="font-medium w-28 text-right tabular-nums">{sym}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">Discount</span>
              <PctToggle isPercent={discountIsPct} onToggle={() => setDiscountIsPct(p => !p)} />
              <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}
                className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
              {discountIsPct && <span className="text-xs text-gray-400 w-20 text-right tabular-nums">= {sym}{discountAmt.toFixed(2)}</span>}
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">Tax</span>
              <PctToggle isPercent={taxIsPct} onToggle={() => setTaxIsPct(p => !p)} />
              <input type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)}
                className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
              {taxIsPct && <span className="text-xs text-gray-400 w-20 text-right tabular-nums">= {sym}{taxAmt.toFixed(2)}</span>}
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">Shipping ({sym})</span>
              <input type="number" min="0" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)}
                className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
            </div>
            {isForeign && (
              <>
                <div className="flex gap-6 border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                  <span className="text-gray-500">Total ({currency})</span>
                  <span className="font-medium w-28 text-right tabular-nums">{sym}{foreignTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-6 text-xs text-gray-400">
                  <span>× {rate} exchange rate</span>
                </div>
              </>
            )}
            <div className={`flex gap-6 ${isForeign ? '' : 'border-t border-gray-200 dark:border-gray-700 pt-2 mt-1'}`}>
              <span className="font-semibold text-gray-800 dark:text-white">Total Cost (SGD)</span>
              <span className="font-bold text-lg text-indigo-600 w-28 text-right tabular-nums">{fmt$(sgdTotal)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery notes, batch numbers…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || cart.length === 0}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors">
            {saving ? 'Creating…' : `Create PO • ${fmt$(sgdTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditPurchaseModal ─────────────────────────────────────────────────────────
function EditPurchaseModal({ purchase, products, onClose, onSave }: {
  purchase: Purchase; products: Product[]; onClose: () => void; onSave: () => void;
}) {
  const [status, setStatus] = useState(purchase.status);
  const [notes, setNotes] = useState(purchase.notes ?? '');
  const [discount, setDiscount] = useState(String(purchase.discount));
  const [discountIsPct, setDiscountIsPct] = useState(false);
  const [tax, setTax] = useState(String(purchase.tax));
  const [taxIsPct, setTaxIsPct] = useState(false);
  const [shippingCost, setShippingCost] = useState(String(purchase.shipping_cost ?? 0));
  const [currency, setCurrency] = useState(purchase.currency ?? 'SGD');
  const [exchangeRate, setExchangeRate] = useState(String(purchase.exchange_rate ?? 1));
  const [cart, setCart] = useState<CartItem[]>(
    purchase.items.map(i => ({ product_id: i.product_id, product_name: i.product_name, product_sku: i.product_sku, quantity: i.quantity, unit_cost: i.unit_cost }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add-item state
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');

  const activeProducts = products.filter(p => p.is_active);
  const filteredProducts = activeProducts.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const p = products.find(p => p.id === Number(id));
    if (p) setUnitCost(String(p.cost || ''));
  };

  const addToCart = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === Number(selectedProductId));
    if (!product) return;
    const q = Math.max(1, Number(qty) || 1);
    const cost = Math.max(0, Number(unitCost) || 0);
    const existing = cart.findIndex(c => c.product_id === product.id);
    if (existing >= 0) {
      setCart(c => c.map((item, i) => i === existing ? { ...item, quantity: item.quantity + q, unit_cost: cost } : item));
    } else {
      setCart(c => [...c, { product_id: product.id, product_name: product.name, product_sku: product.sku, quantity: q, unit_cost: cost }]);
    }
    setSelectedProductId(''); setProductSearch(''); setQty('1'); setUnitCost('');
  };

  const subtotal = cart.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
  const discountAmt = discountIsPct ? subtotal * ((Number(discount) || 0) / 100) : (Number(discount) || 0);
  const taxAmt = taxIsPct ? subtotal * ((Number(tax) || 0) / 100) : (Number(tax) || 0);
  const shippingAmt = Number(shippingCost) || 0;
  const rate = Number(exchangeRate) || 1;
  const foreignTotal = subtotal - discountAmt + taxAmt + shippingAmt;
  const sgdTotal = foreignTotal * rate;
  const isForeign = currency !== 'SGD';
  const sym = currSymbol(currency);

  const willRestoreStock = purchase.status === 'received' && status === 'cancelled';
  const willAddStock = purchase.status === 'pending' && status === 'received';

  const handleSave = async () => {
    if (cart.length === 0) { setError('At least one item is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/stock/purchases/${purchase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          discount: discountAmt,
          tax: taxAmt,
          shipping_cost: shippingAmt,
          currency,
          exchange_rate: rate,
          notes: notes.trim() || null,
          status,
        }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
      onSave(); onClose();
    } catch { setError('Network error'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Edit Purchase</h2>
            <p className="text-xs text-gray-400">{purchase.invoice_ref} · {purchase.supplier_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          {/* Line Items — editable */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Line Items</p>
            {cart.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right w-20">Qty</th>
                      <th className="px-3 py-2 text-right w-28">Unit Cost</th>
                      <th className="px-3 py-2 text-right w-24">Total</th>
                      <th className="px-1 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {cart.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <select value={item.product_id}
                            onChange={e => {
                              const p = products.find(pr => pr.id === Number(e.target.value));
                              if (p) setCart(c => c.map((ci, i) => i === idx ? { ...ci, product_id: p.id, product_name: p.name, product_sku: p.sku } : ci));
                            }}
                            className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                            {activeProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" min="1" value={item.quantity}
                            onChange={e => setCart(c => c.map((ci, i) => i === idx ? { ...ci, quantity: Math.max(1, Number(e.target.value) || 1) } : ci))}
                            className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" min="0" step="0.01" value={item.unit_cost}
                            onChange={e => setCart(c => c.map((ci, i) => i === idx ? { ...ci, unit_cost: Number(e.target.value) || 0 } : ci))}
                            className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">{sym}{(item.unit_cost * item.quantity).toFixed(2)}</td>
                        <td className="px-1 py-2">
                          <button onClick={() => setCart(c => c.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Inline add row */}
            <div className="grid grid-cols-12 gap-2 items-end bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="col-span-4">
                <label className="block text-xs text-gray-500 mb-1">Add Product</label>
                <select value={selectedProductId} onChange={e => handleSelectProduct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                  <option value="">Select…</option>
                  {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Qty</label>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Unit Cost ({sym})</label>
                <input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00"
                  className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm" />
              </div>
              <div className="col-span-3">
                <button onClick={addToCart} disabled={!selectedProductId}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
                  + Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Currency & rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Currency</label>
              <select value={currency} onChange={e => { setCurrency(e.target.value); if (e.target.value === 'SGD') setExchangeRate('1'); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {CURRENCY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Exchange Rate {isForeign && <span className="text-sky-600 dark:text-sky-400">(1 {currency} = ? SGD)</span>}
              </label>
              <input type="number" step="0.0001" min="0" value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value)}
                disabled={!isForeign}
                className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${!isForeign ? 'opacity-50 cursor-not-allowed' : ''}`} />
            </div>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1.5 text-sm">
            <div className="flex gap-6">
              <span className="text-gray-500">Subtotal ({sym})</span>
              <span className="font-medium w-28 text-right tabular-nums">{sym}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">Discount</span>
              <PctToggle isPercent={discountIsPct} onToggle={() => setDiscountIsPct(p => !p)} />
              <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}
                className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
              {discountIsPct && <span className="text-xs text-gray-400 w-20 text-right tabular-nums">= {sym}{discountAmt.toFixed(2)}</span>}
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">Tax</span>
              <PctToggle isPercent={taxIsPct} onToggle={() => setTaxIsPct(p => !p)} />
              <input type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)}
                className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
              {taxIsPct && <span className="text-xs text-gray-400 w-20 text-right tabular-nums">= {sym}{taxAmt.toFixed(2)}</span>}
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">Shipping ({sym})</span>
              <input type="number" min="0" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)}
                className="w-24 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-right text-sm" />
            </div>
            {isForeign && (
              <>
                <div className="flex gap-6 border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                  <span className="text-gray-500">Total ({currency})</span>
                  <span className="font-medium w-28 text-right tabular-nums">{sym}{foreignTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-6 text-xs text-gray-400"><span>× {rate} exchange rate</span></div>
              </>
            )}
            <div className={`flex gap-6 ${isForeign ? '' : 'border-t border-gray-200 dark:border-gray-700 pt-2 mt-1'}`}>
              <span className="font-semibold text-gray-800 dark:text-white">Total Cost (SGD)</span>
              <span className="font-bold text-lg text-indigo-600 w-28 text-right tabular-nums">{fmt$(sgdTotal)}</span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as Purchase['status'])}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="received">Received</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {willRestoreStock && (
            <div className="flex gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              Stock will be <strong>reduced</strong> by the quantities in this purchase order.
            </div>
          )}
          {willAddStock && (
            <div className="flex gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              Stock will be <strong>added</strong> and product cost prices updated.
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery notes, batch numbers…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving || cart.length === 0}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : `Save Changes • ${fmt$(sgdTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeletePurchaseDialog ──────────────────────────────────────────────────────
function DeletePurchaseDialog({ purchase, onClose, onDeleted }: {
  purchase: Purchase; onClose: () => void; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/stock/purchases/${purchase.id}`, { method: 'DELETE' });
    onDeleted(); onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Purchase?</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          PO <span className="font-medium text-gray-800 dark:text-white">{purchase.invoice_ref}</span> ({fmt$(purchase.total_cost)}) will be permanently deleted.
          {purchase.status === 'received' && <span className="block mt-1 text-amber-600 dark:text-amber-400">Stock quantities will be reversed.</span>}
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function PurchasesContent() {
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes, prRes] = await Promise.all([
      fetch('/api/stock/purchases'),
      fetch('/api/stock/suppliers'),
      fetch('/api/stock/products?includeInactive=false'),
    ]);
    const [pData, sData, prData] = await Promise.all([pRes.json(), sRes.json(), prRes.json()]);
    setPurchases(pData); setSuppliers(sData); setProducts(prData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredPurchases = purchases.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (supplierFilter !== 'all' && String(p.supplier_id) !== supplierFilter) return false;
    if (search && !p.invoice_ref?.toLowerCase().includes(search.toLowerCase()) &&
        !p.supplier_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSpend = purchases.filter(p => p.status === 'received').reduce((s, p) => s + p.total_cost, 0);
  const receivedCount = purchases.filter(p => p.status === 'received').length;
  const pendingCount = purchases.filter(p => p.status === 'pending').length;

  const activeSuppliers = suppliers.filter(s => s.is_active);

  const TABS = ['all', 'received', 'pending', 'cancelled'] as const;

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchases</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track stock purchases and manage suppliers</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={() => { setEditingSupplier(null); setShowSupplierModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900 rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
            Add Supplier
          </button>
          <button onClick={() => setShowNewPurchase(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Purchase
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Spend (Received)', value: fmt$(totalSpend), color: 'indigo' },
          { label: 'Received Orders', value: String(receivedCount), color: 'emerald' },
          { label: 'Pending Orders', value: String(pendingCount), color: 'amber' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-2xl font-bold text-${card.color}-600 dark:text-${card.color}-400`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-1">
        {([['purchases', 'Purchase Orders'], ['suppliers', 'Suppliers']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Purchase Orders tab */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO# or supplier…"
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56" />
            <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All suppliers</option>
              {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5">
              {TABS.map(t => (
                <button key={t} onClick={() => setStatusFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${statusFilter === t
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                <p className="font-medium">No purchase orders found</p>
                <p className="text-sm mt-1">Click &ldquo;New Purchase&rdquo; to record a purchase</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left">PO Ref</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Supplier</th>
                      <th className="px-5 py-3 text-right">Items</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {filteredPurchases.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs font-medium text-gray-700 dark:text-gray-300">{p.invoice_ref}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{fmtDate(p.purchase_date)}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{p.supplier_name}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-400">{p.items.length}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-white">{fmt$(p.total_cost)}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditingPurchase(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={() => setDeletingPurchase(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suppliers tab */}
      {activeTab === 'suppliers' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {suppliers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
              <p className="font-medium">No suppliers yet</p>
              <p className="text-sm mt-1">Click &ldquo;Add Supplier&rdquo; to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Supplier</th>
                    <th className="px-5 py-3 text-left">Contact</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Phone</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {suppliers.map(s => (
                    <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                        {s.address && <p className="text-xs text-gray-400">{s.address}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{s.contact_person ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{s.email ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{s.phone ?? '—'}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => { setEditingSupplier(s); setShowSupplierModal(true); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => { setShowSupplierModal(false); setEditingSupplier(null); }}
          onSave={fetchData}
        />
      )}
      {showNewPurchase && (
        <NewPurchaseModal
          suppliers={suppliers}
          products={products}
          onClose={() => setShowNewPurchase(false)}
          onSave={fetchData}
        />
      )}
      {editingPurchase && (
        <EditPurchaseModal
          purchase={editingPurchase}
          products={products}
          onClose={() => setEditingPurchase(null)}
          onSave={fetchData}
        />
      )}
      {deletingPurchase && (
        <DeletePurchaseDialog
          purchase={deletingPurchase}
          onClose={() => setDeletingPurchase(null)}
          onDeleted={fetchData}
        />
      )}
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>}>
      <PurchasesContent />
    </Suspense>
  );
}
