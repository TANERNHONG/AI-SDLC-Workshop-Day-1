'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Product, ReleaseEventWithProducts } from '@/lib/stockdb';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(n);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDimensions(p: Product): string {
  const dims = [p.length_cm, p.width_cm, p.height_cm].filter(v => v != null);
  const thick = [p.thickness_length_mm, p.thickness_width_mm, p.thickness_height_mm].filter(v => v != null);
  const parts: string[] = [];
  if (dims.length > 0) parts.push(dims.map(v => `${v! * 10}mm`).join(' x '));
  if (thick.length > 0) parts.push(thick.map(v => `${v}mm`).join(' x '));
  return parts.join(', ');
}

function generateSupplierMessage(
  items: Array<{ product: Product; quantity: number }>,
): string {
  if (items.length === 0) return '';
  const lines = items.map(({ product, quantity }) => {
    const dim = fmtDimensions(product);
    return `- ${product.name}${dim ? `: ${dim}` : ''}: ${quantity} pcs`;
  });
  return `Hello friend, I wish to get a quotation for\n\n${lines.join('\n')}\n\nCould you send me a quotation, shipping price and production + delivery time?`;
}

function removeDuplicateWords(category: string, name: string): string {
  const catWords = category.toLowerCase().split(/\s+/);
  const nameWords = name.split(/\s+/);
  const filtered = nameWords.filter(w => !catWords.includes(w.toLowerCase()));
  // Strip leading filler words like "for", "the", "and", "-"
  while (filtered.length > 0 && /^(for|the|and|-)$/i.test(filtered[0])) filtered.shift();
  return filtered.length > 0 ? filtered.join(' ') : name;
}

function generateCustomerMessage(
  products: Product[],
): string {
  if (products.length === 0) return '';
  // Group by category
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const cat = p.category ?? 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }
  const sections: string[] = [];
  for (const [category, prods] of groups) {
    const lines = prods.map(p => {
      const shortName = removeDuplicateWords(category, p.name);
      return `- ${shortName}: ${fmtCurrency(p.price)}`;
    });
    sections.push(`${category} for\n${lines.join('\n')}`);
  }
  return `WTS\n\n${sections.join('\n\n')}`;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<ReleaseEventWithProducts[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab state: 'custom' | 'supplier' | 'customer'
  const [mode, setMode] = useState<'custom' | 'supplier' | 'customer'>('custom');

  // Custom message state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [customMessage, setCustomMessage] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [includeHypothetical, setIncludeHypothetical] = useState(false);

  // Generated messages
  const [supplierMsg, setSupplierMsg] = useState('');
  const [customerMsg, setCustomerMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, eventRes] = await Promise.all([
      fetch('/api/stock/products?includeInactive=false'),
      fetch('/api/stock/release-events'),
    ]);
    const prodData: Product[] = await prodRes.json();
    const eventData: ReleaseEventWithProducts[] = await eventRes.json();
    setProducts(prodData.filter(p => p.is_active));
    setEvents(eventData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute purchase suggestions (same logic as Calendar)
  const suggestions = React.useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const results: Array<{ event: ReleaseEventWithProducts; product: Product; deficit: number }> = [];
    events.forEach(ev => {
      const releaseDate = new Date(ev.release_date.slice(0, 10));
      const freshDeadline = new Date(releaseDate);
      freshDeadline.setDate(freshDeadline.getDate() + 10);
      if (new Date(todayStr) > freshDeadline) return;
      ev.products.forEach(ep => {
        const product = products.find(p => p.id === ep.id);
        if (!product) return;
        if (product.stock_quantity < 20) {
          results.push({ event: ev, product, deficit: 20 - product.stock_quantity });
        }
      });
    });
    return results;
  }, [events, products]);

  // Real (non-hypothetical) products for modes that need them
  const realProducts = React.useMemo(
    () => products.filter(p => !p.is_hypothetical),
    [products],
  );

  // Hypothetical products
  const hypotheticalProducts = React.useMemo(
    () => products.filter(p => p.is_hypothetical),
    [products],
  );

  // Products visible in custom mode depending on toggle
  const customModeProducts = includeHypothetical ? products : realProducts;

  // Available products (stock >= 1) for customer messages (never hypothetical)
  const availableProducts = React.useMemo(
    () => realProducts.filter(p => p.stock_quantity >= 1),
    [realProducts],
  );

  // Auto-generate supplier message
  useEffect(() => {
    if (mode !== 'supplier') return;
    // Deduplicate by product id, summing deficits
    const map = new Map<number, { product: Product; quantity: number }>();
    for (const s of suggestions) {
      const existing = map.get(s.product.id);
      if (existing) {
        existing.quantity += s.deficit;
      } else {
        map.set(s.product.id, { product: s.product, quantity: s.deficit });
      }
    }
    setSupplierMsg(generateSupplierMessage(Array.from(map.values())));
  }, [mode, suggestions]);

  // Auto-generate customer message
  useEffect(() => {
    if (mode !== 'customer') return;
    setCustomerMsg(generateCustomerMessage(availableProducts));
  }, [mode, availableProducts]);

  // Build custom message from selections
  useEffect(() => {
    if (mode !== 'custom') return;
    const items = Array.from(selectedIds)
      .map(id => {
        const product = products.find(p => p.id === id);
        if (!product) return null;
        return { product, quantity: quantities[id] ?? 1 };
      })
      .filter(Boolean) as Array<{ product: Product; quantity: number }>;
    // Use supplier format as base for custom
    setCustomMessage(generateSupplierMessage(items));
  }, [mode, selectedIds, quantities, products]);

  const currentMessage = mode === 'supplier' ? supplierMsg : mode === 'customer' ? customerMsg : customMessage;
  const setCurrentMessage = mode === 'supplier' ? setSupplierMsg : mode === 'customer' ? setCustomerMsg : setCustomMessage;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleProduct = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredProducts = customModeProducts.filter(p =>
    productSearch === '' ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(productSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8 text-sm text-gray-400">Loading…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Generate quotation requests and sales messages
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'custom', label: 'Custom' },
          { key: 'supplier', label: 'Supplier Quote' },
          { key: 'customer', label: 'Customer WTS' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mode === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side: Product selection (Custom mode) or info panel */}
        <div className="space-y-4">
          {mode === 'custom' && (
            <>
              {/* Search + Hypothetical toggle */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                  />
                </div>
                {hypotheticalProducts.length > 0 && (
                  <button
                    onClick={() => setIncludeHypothetical(prev => !prev)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      includeHypothetical
                        ? 'bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Hypothetical ({hypotheticalProducts.length})
                  </button>
                )}
              </div>

              {/* Product list with checkboxes and quantity */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm max-h-[60vh] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No products found</div>
                ) : filteredProducts.map(p => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/20' : ''}`}
                      onClick={() => toggleProduct(p.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleProduct(p.id)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {p.name}
                          {p.is_hypothetical && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                              Hypothetical
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          <span className="font-mono">{p.sku}</span>
                          {p.category && <span className="ml-2">{p.category}</span>}
                          {!p.is_hypothetical && <span className="ml-2">Stock: {p.stock_quantity}</span>}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <label className="text-xs text-gray-400">Qty:</label>
                          <input
                            type="number"
                            min={1}
                            value={quantities[p.id] ?? 1}
                            onChange={e => setQuantities(prev => ({ ...prev, [p.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-16 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {mode === 'supplier' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-bold">Purchase Suggestions</h3>
              </div>
              {suggestions.length === 0 ? (
                <p className="text-sm text-gray-400">No purchase suggestions right now. Suggestions appear when release events are upcoming and linked products have stock &lt; 20.</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    // Deduplicate
                    const map = new Map<number, { product: Product; deficit: number; events: string[] }>();
                    for (const s of suggestions) {
                      const existing = map.get(s.product.id);
                      if (existing) {
                        existing.deficit += s.deficit;
                        if (!existing.events.includes(s.event.name)) existing.events.push(s.event.name);
                      } else {
                        map.set(s.product.id, { product: s.product, deficit: s.deficit, events: [s.event.name] });
                      }
                    }
                    return Array.from(map.values()).map(({ product, deficit, events }) => (
                      <div key={product.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</p>
                          <p className="text-xs text-gray-400">
                            {fmtDimensions(product) || 'No dimensions'}
                            <span className="ml-2">Stock: {product.stock_quantity}</span>
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400">For: {events.join(', ')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">~{deficit}</p>
                          <p className="text-xs text-gray-400">needed</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

          {mode === 'customer' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-sm font-bold">Available Products ({availableProducts.length})</h3>
              </div>
              {availableProducts.length === 0 ? (
                <p className="text-sm text-gray-400">No products with stock available.</p>
              ) : (
                <div className="space-y-1 max-h-[55vh] overflow-y-auto">
                  {availableProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {p.category ?? 'Uncategorized'} · Stock: {p.stock_quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums shrink-0">
                        {fmtCurrency(p.price)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side: Message preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Message Preview
            </h2>
            <button
              onClick={handleCopy}
              disabled={!currentMessage}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                copied
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <textarea
            value={currentMessage}
            onChange={e => setCurrentMessage(e.target.value)}
            placeholder={
              mode === 'custom'
                ? 'Select products on the left to generate a message…'
                : mode === 'supplier'
                ? 'Supplier quotation message will appear here…'
                : 'Customer WTS message will appear here…'
            }
            rows={20}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-mono leading-relaxed placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm resize-y"
          />
          <p className="text-xs text-gray-400">
            You can edit the message above before copying. {mode === 'supplier' && suggestions.length > 0 && `Based on ${suggestions.length} purchase suggestion(s).`}
            {mode === 'customer' && `${availableProducts.length} product(s) with stock ≥ 1.`}
          </p>
        </div>
      </div>
    </div>
  );
}
