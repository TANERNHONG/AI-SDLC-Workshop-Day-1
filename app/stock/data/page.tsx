'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportType   = 'sales' | 'purchases' | 'pnl';
type ExportFormat = 'json' | 'excel';

// ─── Helper ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Export Section ───────────────────────────────────────────────────────────

function ExportSection() {
  const [exportType,   setExportType]   = useState<ExportType>('sales');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [startDate,    setStartDate]    = useState(daysAgo(30));
  const [endDate,      setEndDate]      = useState(today());
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const handleExport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ type: exportType, format: exportFormat });
      if (startDate) params.set('startDate', startDate);
      if (endDate)   params.set('endDate',   endDate);

      const res = await fetch(`/api/stock/export?${params}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Export failed');
      }

      if (exportFormat === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `${exportType}-export.json`);
      } else {
        const blob = await res.blob();
        triggerDownload(blob, `${exportType}-export.xlsx`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card icon="📤" title="Export Data">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Data type */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Data Type
          </label>
          <div className="flex gap-2">
            {(['sales', 'purchases', 'pnl'] as ExportType[]).map(t => (
              <button key={t} onClick={() => setExportType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  exportType === t
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400'
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Format
          </label>
          <div className="flex gap-2">
            {(['excel', 'json'] as ExportFormat[]).map(f => (
              <button key={f} onClick={() => setExportFormat(f)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  exportFormat === f
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400'
                }`}>
                {f === 'excel' ? '📊 Excel (.xlsx)' : '{ } JSON'}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            From
          </label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            To
          </label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <button onClick={handleExport} disabled={loading}
        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors">
        {loading ? 'Exporting…' : `Export ${exportType.charAt(0).toUpperCase() + exportType.slice(1)} as ${exportFormat.toUpperCase()}`}
      </button>
    </Card>
  );
}

// ─── Download Template Section ────────────────────────────────────────────────

function TemplateSection() {
  const downloadTemplate = (type: 'sales' | 'purchases') => {
    const a = document.createElement('a');
    a.href = `/api/stock/import?template=${type}`;
    a.download = `${type}-import-template.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card icon="📋" title="Download Import Template">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Download a pre-formatted Excel template, fill in your data, and import it below. Do not rename the column headers.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TemplateCard
          title="Sales Template"
          description="Invoice date, channel, product SKU, qty, price, discount, tax, notes"
          columns={['sale_date', 'channel', 'product_sku', 'quantity', 'unit_price', 'discount', 'tax', 'notes']}
          onDownload={() => downloadTemplate('sales')}
        />
        <TemplateCard
          title="Purchases Template"
          description="Purchase date, supplier name, product SKU, qty, cost, discount, tax, notes"
          columns={['purchase_date', 'supplier_name', 'product_sku', 'quantity', 'unit_cost', 'discount', 'tax', 'invoice_ref', 'notes']}
          onDownload={() => downloadTemplate('purchases')}
        />
      </div>
    </Card>
  );
}

function TemplateCard({ title, description, columns, onDownload }: {
  title: string;
  description: string;
  columns: string[];
  onDownload: () => void;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      <div>
        <p className="font-semibold text-gray-900 dark:text-white text-sm">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {columns.map(col => (
          <span key={col} className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-mono">
            {col}
          </span>
        ))}
      </div>
      <button onClick={onDownload}
        className="w-full py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors">
        ⬇ Download Template
      </button>
    </div>
  );
}

// ─── Import Section ───────────────────────────────────────────────────────────

function ImportSection() {
  const [importType, setImportType] = useState<'sales' | 'purchases'>('sales');
  const [file,       setFile]       = useState<File | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<{ success?: boolean; message?: string; imported?: number; error?: string; details?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/stock/import?type=${importType}`, { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card icon="📥" title="Import Data">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Upload a filled Excel (.xlsx) or JSON (.json) file. Only rows that pass validation will be imported. Use the templates above for correct column names.
      </p>

      {/* Type toggle */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Import Type
        </label>
        <div className="flex gap-2 w-fit">
          {(['sales', 'purchases'] as const).map(t => (
            <button key={t} onClick={() => { setImportType(t); reset(); }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                importType === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400'
              }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* File picker */}
      <div
        className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.json"
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">📄 {file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB — click to change</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-2xl">📂</p>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Click to select file</p>
            <p className="text-xs text-gray-400">.xlsx, .xls, or .json</p>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${
          result.success
            ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          <p className="font-semibold">{result.success ? '✅ ' + result.message : '❌ ' + result.error}</p>
          {result.details && result.details.length > 0 && (
            <ul className="mt-2 space-y-0.5 list-disc list-inside text-xs">
              {result.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={handleImport} disabled={!file || loading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors">
          {loading ? 'Importing…' : `Import ${importType.charAt(0).toUpperCase() + importType.slice(1)}`}
        </button>
        {file && (
          <button onClick={reset}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Clear
          </button>
        )}
      </div>
    </Card>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DataPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Export your data to Excel or JSON, import records from a template file, or evaluate new product lines in Market Analysis.
          </p>
        </div>

        <Link
          href="/stock/data/market-analysis"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Open Market Analysis
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/stock/data/market-analysis"
          className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:hover:bg-indigo-900"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">📈</span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Market Analysis</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Create reusable criteria, compare market and product tables, map relationships, and assess predicted ROI before expanding a product line.
              </p>
            </div>
          </div>
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Import & Export</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Use the tools below for operational data exchange, while Market Analysis is reserved for opportunity sizing and product-line evaluation.
          </p>
        </div>
      </div>

      <ExportSection />
      <TemplateSection />
      <ImportSection />
    </div>
  );
}
