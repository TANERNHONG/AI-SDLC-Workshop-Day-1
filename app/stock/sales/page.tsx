'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Product, SaleWithItems } from '@/lib/stockdb';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Channel Badge ─────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS = [
  { value: 'direct',    label: 'Direct',    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'carousell', label: 'Carousell', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { value: 'shopee',    label: 'Shopee',    color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { value: 'lazada',    label: 'Lazada',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'telegram',  label: 'Telegram',  color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
];

function ChannelBadge({ channel }: { channel: string }) {
  const opt = CHANNEL_OPTIONS.find(o => o.value === channel) ?? CHANNEL_OPTIONS[0];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    partial_refund: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    refunded:       'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    void:           'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  };
  const labels: Record<string, string> = {
    completed: 'Completed',
    partial_refund: 'Partial Refund',
    refunded: 'Refunded',
    void: 'Void',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── New Sale Modal ─────────────────────────────────────────────────────────────

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}

function NewSaleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [shippingCharged, setShippingCharged] = useState('0');
  const [shippingActual, setShippingActual] = useState('0');
  const [buyerName, setBuyerName] = useState('');
  const [buyerUsername, setBuyerUsername] = useState('');
  const [paynowRef, setPaynowRef] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [channel, setChannel] = useState('direct');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/stock/products').then(r => r.json()).then(setProducts);
    searchRef.current?.focus();
  }, []);

  const filteredProducts = products.filter((p) =>
    search === '' ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1, unit_price: product.price }];
    });
    setSearch('');
  };

  const updateCartItem = (productId: number, field: 'quantity' | 'unit_price', value: number) => {
    setCart((prev) =>
      prev.map((c) => c.product.id === productId ? { ...c, [field]: value } : c)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const subtotal = cart.reduce((a, c) => a + c.unit_price * c.quantity, 0);
  const discountAmt = parseFloat(discount) || 0;
  const taxAmt = parseFloat(tax) || 0;
  const shippingChargedAmt = parseFloat(shippingCharged) || 0;
  const shippingActualAmt = parseFloat(shippingActual) || 0;
  const shippingProfit = shippingChargedAmt - shippingActualAmt;
  const total = subtotal - discountAmt + taxAmt + shippingChargedAmt;

  const handleSubmit = async () => {
    if (cart.length === 0) { setError('Add at least one product'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/stock/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((c) => ({
            product_id: c.product.id,
            quantity: c.quantity,
            unit_price: c.unit_price,
          })),
          discount: discountAmt,
          tax: taxAmt,
          shipping_charged: shippingChargedAmt,
          shipping_actual: shippingActualAmt,
          notes: additionalNotes.trim() || undefined,
          buyer_name: buyerName.trim() || undefined,
          buyer_username: buyerUsername.trim() || undefined,
          paynow_ref: paynowRef.trim() || undefined,
          channel,
          sale_date: saleDate + ' 00:00:00',
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to create sale');
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Sale</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Product Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Add Products
            </label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or SKU…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            {search && (
              <div className="mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No products found</p>
                ) : (
                  filteredProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-left transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{fmtCurrency(p.price)}</p>
                        <p className={`text-xs ${p.stock_quantity <= 5 ? 'text-red-500' : 'text-gray-400'}`}>
                          {p.stock_quantity} in stock
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-10 text-center">
              <p className="text-gray-400 text-sm">Search and add products above</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-medium">Product</th>
                    <th className="text-center px-3 py-2.5 font-medium w-28">Qty</th>
                    <th className="text-right px-3 py-2.5 font-medium w-28">Unit Price</th>
                    <th className="text-right px-3 py-2.5 font-medium w-24">Line Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {cart.map((item) => (
                    <tr key={item.product.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{item.product.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.product.sku}</p>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateCartItem(item.product.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-center px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updateCartItem(item.product.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                        {fmtCurrency(item.unit_price * item.quantity)}
                      </td>
                      <td className="pr-3 py-3">
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals + Notes */}
          {cart.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Sale Date
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Sales Channel
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setChannel(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          channel === opt.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Buyer Info (optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Name of buyer"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={buyerUsername}
                      onChange={(e) => setBuyerUsername(e.target.value)}
                      placeholder="Username of buyer (e.g. @handle)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={paynowRef}
                      onChange={(e) => setPaynowRef(e.target.value)}
                      placeholder="PayNow Ref"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <textarea
                      rows={2}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Additional notes…"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Discount ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Tax ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tax}
                        onChange={(e) => setTax(e.target.value)}
                        className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Shipping Charged ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={shippingCharged}
                        onChange={(e) => setShippingCharged(e.target.value)}
                        className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Actual Shipping ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={shippingActual}
                        onChange={(e) => setShippingActual(e.target.value)}
                        className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmtCurrency(subtotal)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="tabular-nums">-{fmtCurrency(discountAmt)}</span>
                    </div>
                  )}
                  {taxAmt > 0 && (
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Tax / GST</span>
                      <span className="tabular-nums">+{fmtCurrency(taxAmt)}</span>
                    </div>
                  )}
                  {shippingChargedAmt > 0 && (
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Shipping (charged)</span>
                      <span className="tabular-nums">+{fmtCurrency(shippingChargedAmt)}</span>
                    </div>
                  )}
                  {(shippingChargedAmt > 0 || shippingActualAmt > 0) && (
                    <div className={`flex justify-between text-xs ${shippingProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      <span>Shipping P/L ({fmtCurrency(shippingChargedAmt)} − {fmtCurrency(shippingActualAmt)})</span>
                      <span className="tabular-nums">{shippingProfit >= 0 ? '+' : ''}{fmtCurrency(shippingProfit)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span>Total</span>
                    <span className="tabular-nums text-indigo-600 dark:text-indigo-400">{fmtCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || cart.length === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
          >
            {saving ? 'Processing…' : `Complete Sale • ${fmtCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Sale Modal ───────────────────────────────────────────────────────────

function EditSaleModal({ sale, onClose, onSaved }: { sale: SaleWithItems; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState(sale.notes ?? '');
  const [buyerName, setBuyerName] = useState(sale.buyer_name ?? '');
  const [buyerUsername, setBuyerUsername] = useState(sale.buyer_username ?? '');
  const [paynowRef, setPaynowRef] = useState(sale.paynow_ref ?? '');
  const [status, setStatus] = useState(sale.status);
  const [channel, setChannel] = useState(sale.channel ?? 'direct');
  const [shippingCharged, setShippingCharged] = useState(String(sale.shipping_charged ?? 0));
  const [shippingActual, setShippingActual] = useState(String(sale.shipping_actual ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const [refundQtys, setRefundQtys] = useState<Record<number, number>>({});

  const isFullyRefunded = sale.status === 'refunded' || sale.status === 'void';
  const canPartialRefund = sale.status === 'completed' || sale.status === 'partial_refund';

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/stock/sales/${sale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null, status, channel, buyer_name: buyerName.trim() || null, buyer_username: buyerUsername.trim() || null, paynow_ref: paynowRef.trim() || null, shipping_charged: parseFloat(shippingCharged) || 0, shipping_actual: parseFloat(shippingActual) || 0 }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const handlePartialRefund = async () => {
    const refunds = Object.entries(refundQtys)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ sale_item_id: Number(itemId), refund_qty: qty }));

    if (refunds.length === 0) { setError('Select at least one item to refund'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/stock/sales/${sale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refunds }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const totalRefundAmount = Object.entries(refundQtys).reduce((sum, [itemId, qty]) => {
    const item = sale.items.find(i => i.id === Number(itemId));
    return sum + (item ? item.unit_price * qty : 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg z-10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Sale</h2>
            <p className="text-xs text-gray-400">{sale.invoice_number}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Items summary with refund info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Line Items</span>
              {canPartialRefund && !showRefund && (
                <button
                  onClick={() => setShowRefund(true)}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Partial Refund
                </button>
              )}
              {showRefund && (
                <button
                  onClick={() => { setShowRefund(false); setRefundQtys({}); }}
                  className="text-xs font-semibold text-gray-400 hover:underline"
                >
                  Cancel Refund
                </button>
              )}
            </div>
            {sale.items.map((item) => {
              const refunded = item.refunded_quantity ?? 0;
              const refundable = item.quantity - refunded;
              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-600 dark:text-gray-300">{item.product_name}</span>
                      <span className="text-gray-400 ml-1">× {item.quantity}</span>
                      {refunded > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 text-xs ml-1.5">
                          ({refunded} refunded)
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white tabular-nums ml-3">
                      {fmtCurrency(item.line_total)}
                    </span>
                  </div>

                  {/* Partial refund controls */}
                  {showRefund && refundable > 0 && (
                    <div className="flex items-center gap-2 ml-2 pb-1">
                      <label className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        Refund qty:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={refundable}
                        value={refundQtys[item.id] ?? 0}
                        onChange={(e) => setRefundQtys(prev => ({
                          ...prev,
                          [item.id]: Math.min(Math.max(0, parseInt(e.target.value) || 0), refundable)
                        }))}
                        className="w-16 text-center px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 tabular-nums"
                      />
                      <span className="text-xs text-gray-400">/ {refundable} available</span>
                    </div>
                  )}
                  {showRefund && refundable === 0 && (
                    <p className="text-xs text-gray-400 ml-2 italic">Fully refunded</p>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <span>Total</span>
              <span className="tabular-nums text-indigo-600 dark:text-indigo-400">{fmtCurrency(sale.total)}</span>
            </div>
          </div>

          {/* Refund summary banner */}
          {showRefund && totalRefundAmount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Refund Amount</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Stock will be restored for refunded items</p>
              </div>
              <span className="text-lg font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                {fmtCurrency(totalRefundAmount)}
              </span>
            </div>
          )}

          {!showRefund && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Status
                </label>
                <div className="flex gap-2">
                  {(['completed', 'refunded', 'void'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        status === s
                          ? s === 'completed'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : s === 'refunded'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-red-600 text-white border-red-600'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                {(status === 'refunded' || status === 'void') && (sale.status === 'completed' || sale.status === 'partial_refund') && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                    ⚠️ All remaining stock quantities will be restored when saving.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Sales Channel
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChannel(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        channel === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Shipping Costs
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Charged $</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={shippingCharged}
                        onChange={(e) => setShippingCharged(e.target.value)}
                        className="w-full pl-20 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Actual $</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={shippingActual}
                        onChange={(e) => setShippingActual(e.target.value)}
                        className="w-full pl-16 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
                {(() => {
                  const sc = parseFloat(shippingCharged) || 0;
                  const sa = parseFloat(shippingActual) || 0;
                  const sp = sc - sa;
                  if (sc > 0 || sa > 0) return (
                    <p className={`text-xs mt-1 ${sp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      Shipping P/L: {sp >= 0 ? '+' : ''}{fmtCurrency(sp)}
                    </p>
                  );
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Buyer Info (optional)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Name of buyer"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={buyerUsername}
                    onChange={(e) => setBuyerUsername(e.target.value)}
                    placeholder="Username of buyer (e.g. @handle)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={paynowRef}
                    onChange={(e) => setPaynowRef(e.target.value)}
                    placeholder="PayNow Ref"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes…"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          {showRefund ? (
            <button
              onClick={handlePartialRefund}
              disabled={saving || totalRefundAmount === 0}
              className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
            >
              {saving ? 'Processing…' : `Refund ${fmtCurrency(totalRefundAmount)}`}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteSaleDialog({ sale, onClose, onDeleted }: { sale: SaleWithItems; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    await fetch(`/api/stock/sales/${sale.id}`, { method: 'DELETE' });
    onDeleted();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Sale?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <strong>{sale.invoice_number}</strong> will be permanently removed. Stock will be restored if the sale was completed.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={confirm} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Sales Page ───────────────────────────────────────────────────────────

function SalesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editSale, setEditSale] = useState<SaleWithItems | null>(null);
  const [deleteSale, setDeleteSale] = useState<SaleWithItems | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/stock/sales?${params}`);
    const data: SaleWithItems[] = await res.json();
    setSales(data);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // Handle ?action=new or ?id=X
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowNewModal(true);
      router.replace('/stock/sales');
    }
  }, [searchParams, router]);

  const filtered = sales.filter((s) =>
    search === '' ||
    s.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.notes ?? '').toLowerCase().includes(search.toLowerCase()) ||
    s.items.some((i) => i.product_name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalRevenue = filtered.filter((s) => s.status === 'completed').reduce((a, s) => a + s.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.filter((s) => s.status === 'completed').length} completed · {fmtCurrency(totalRevenue)} total
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Sale
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, product or notes…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
          />
        </div>
        <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0">
          {[
            { label: 'All', value: '' },
            { label: 'Completed', value: 'completed' },
            { label: 'Partial', value: 'partial_refund' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Void', value: 'void' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === opt.value
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-16 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-2xl">🧾</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">{search ? 'No matching sales' : 'No sales yet'}</p>
          {!search && (
            <button onClick={() => setShowNewModal(true)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              Create your first sale →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3.5 font-medium">Invoice</th>
                <th className="text-left px-3 py-3.5 font-medium hidden sm:table-cell">Date & Time</th>
                <th className="text-left px-3 py-3.5 font-medium hidden lg:table-cell">Items</th>
                <th className="text-left px-3 py-3.5 font-medium hidden md:table-cell">Channel</th>
                <th className="text-right px-3 py-3.5 font-medium hidden sm:table-cell">Subtotal</th>
                <th className="text-right px-3 py-3.5 font-medium">Total</th>
                <th className="text-left px-3 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{sale.invoice_number}</p>
                    {sale.buyer_name && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sale.buyer_name}{sale.buyer_username ? <span className="text-gray-400 ml-1">· {sale.buyer_username}</span> : null}</p>}
                    {!sale.buyer_name && sale.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{sale.notes}</p>}
                  </td>
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400 text-xs hidden sm:table-cell">
                    {fmtDate(sale.sale_date)}
                  </td>
                  <td className="px-3 py-4 hidden lg:table-cell">
                    <div className="space-y-0.5">
                      {sale.items.slice(0, 2).map((item) => (
                        <p key={item.id} className="text-xs text-gray-500 dark:text-gray-400">
                          {item.product_name} × {item.quantity}
                          {(item.refunded_quantity ?? 0) > 0 && (
                            <span className="text-amber-500 ml-1">(-{item.refunded_quantity})</span>
                          )}
                        </p>
                      ))}
                      {sale.items.length > 2 && (
                        <p className="text-xs text-gray-300 dark:text-gray-600">+{sale.items.length - 2} more</p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 hidden md:table-cell">
                    <ChannelBadge channel={sale.channel ?? 'direct'} />
                  </td>
                  <td className="px-3 py-4 text-right text-gray-500 dark:text-gray-400 tabular-nums hidden sm:table-cell">
                    {fmtCurrency(sale.subtotal)}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-gray-900 dark:text-white tabular-nums">
                    {fmtCurrency(sale.total)}
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge status={sale.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditSale(sale)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                        title="Edit sale"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteSale(sale)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="Delete sale"
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
      )}

      {/* Modals */}
      {showNewModal && (
        <NewSaleModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); fetchSales(); }}
        />
      )}
      {editSale && (
        <EditSaleModal
          sale={editSale}
          onClose={() => setEditSale(null)}
          onSaved={() => { setEditSale(null); fetchSales(); }}
        />
      )}
      {deleteSale && (
        <DeleteSaleDialog
          sale={deleteSale}
          onClose={() => setDeleteSale(null)}
          onDeleted={() => { setDeleteSale(null); fetchSales(); }}
        />
      )}
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm p-8">Loading…</div>}>
      <SalesContent />
    </Suspense>
  );
}
