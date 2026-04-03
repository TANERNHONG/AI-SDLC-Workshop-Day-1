'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  MARKET_ANALYSIS_DECISIONS,
  createEmptyMarketTable,
  type MarketAnalysisCriteria,
  type MarketAnalysisDecision,
  type MarketAnalysisMapping,
  type MarketAnalysisRecord,
  type MarketAnalysisTable,
} from '@/lib/market-analysis-types';

type CriteriaDraft = Omit<MarketAnalysisCriteria, 'id' | 'created_at' | 'updated_at'> & { id?: number };
type AnalysisDraft = Omit<MarketAnalysisRecord, 'id' | 'criteria_name' | 'created_at' | 'updated_at'> & { id?: number };

function createLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneTable(table: MarketAnalysisTable): MarketAnalysisTable {
  return {
    columns: table.columns.map((column) => ({ ...column })),
    rows: table.rows.map((row) => ({ id: row.id, values: { ...row.values } })),
  };
}

function cloneCriteria(criteria: MarketAnalysisCriteria): CriteriaDraft {
  return {
    id: criteria.id,
    name: criteria.name,
    description: criteria.description,
    market_product_table: cloneTable(criteria.market_product_table),
    product_table: cloneTable(criteria.product_table),
    mapping_table: criteria.mapping_table.map((mapping) => ({ ...mapping })),
    viability_notes: criteria.viability_notes,
    predicted_roi_pct: criteria.predicted_roi_pct,
  };
}

function cloneAnalysis(analysis: MarketAnalysisRecord): AnalysisDraft {
  return {
    id: analysis.id,
    name: analysis.name,
    criteria_id: analysis.criteria_id,
    description: analysis.description,
    viability_status: analysis.viability_status,
    predicted_roi_pct: analysis.predicted_roi_pct,
    summary: analysis.summary,
    combination_table: { ...analysis.combination_table },
  };
}

function createCriteriaDraft(): CriteriaDraft {
  return {
    name: '',
    description: '',
    market_product_table: createEmptyMarketTable(),
    product_table: createEmptyMarketTable(),
    mapping_table: [],
    viability_notes: '',
    predicted_roi_pct: null,
  };
}

function createAnalysisDraft(criteriaId?: number): AnalysisDraft {
  return {
    name: '',
    criteria_id: criteriaId ?? 0,
    description: '',
    viability_status: 'review',
    predicted_roi_pct: null,
    summary: '',
    combination_table: {},
  };
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl border p-6 shadow-sm" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      <div className="mb-5 space-y-1">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {description && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function GridEditor({
  label,
  description,
  table,
  onChange,
}: {
  label: string;
  description: string;
  table: MarketAnalysisTable;
  onChange: (next: MarketAnalysisTable) => void;
}) {
  function addColumn() {
    const id = createLocalId();
    const columns = [...table.columns, { id, name: `Column ${table.columns.length + 1}` }];
    const rows = table.rows.map((row) => ({
      ...row,
      values: {
        ...row.values,
        [id]: '',
      },
    }));
    onChange({ columns, rows });
  }

  function updateColumnName(columnId: string, name: string) {
    onChange({
      columns: table.columns.map((column) => column.id === columnId ? { ...column, name } : column),
      rows: table.rows,
    });
  }

  function deleteColumn(columnId: string) {
    onChange({
      columns: table.columns.filter((column) => column.id !== columnId),
      rows: table.rows.map((row) => {
        const nextValues = { ...row.values };
        delete nextValues[columnId];
        return { ...row, values: nextValues };
      }),
    });
  }

  function addRow() {
    const rowId = createLocalId();
    const values = Object.fromEntries(table.columns.map((column) => [column.id, '']));
    onChange({
      columns: table.columns,
      rows: [...table.rows, { id: rowId, values }],
    });
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    onChange({
      columns: table.columns,
      rows: table.rows.map((row) => row.id === rowId ? { ...row, values: { ...row.values, [columnId]: value } } : row),
    });
  }

  function deleteRow(rowId: string) {
    onChange({
      columns: table.columns,
      rows: table.rows.filter((row) => row.id !== rowId),
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--panel-bg)' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        </div>
        <button
          type="button"
          onClick={addColumn}
          className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
        >
          + Add Column
        </button>
      </div>

      {table.columns.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-4 py-8 text-center" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Start by adding columns, then insert rows to capture market or product observations.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-color)' }}>
          <table className="min-w-full border-collapse text-sm">
            <thead style={{ background: 'var(--card-bg)' }}>
              <tr>
                {table.columns.map((column) => (
                  <th key={column.id} className="border-b px-3 py-3 text-left align-top" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-start gap-2">
                      <input
                        value={column.name}
                        onChange={(event) => updateColumnName(column.id, event.target.value)}
                        className="min-w-32 flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
                      />
                      <button
                        type="button"
                        onClick={() => deleteColumn(column.id)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
                        style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
                      >
                        Remove
                      </button>
                    </div>
                  </th>
                ))}
                <th className="border-b px-3 py-3 text-right" style={{ borderColor: 'var(--border-color)' }}>Rows</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.id}>
                  {table.columns.map((column) => (
                    <td key={`${row.id}-${column.id}`} className="border-b px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
                      <input
                        value={row.values[column.id] ?? ''}
                        onChange={(event) => updateCell(row.id, column.id, event.target.value)}
                        className="w-full rounded-lg border px-2 py-1.5 text-xs"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-body)' }}
                      />
                    </td>
                  ))}
                  <td className="border-b px-3 py-2 text-right" style={{ borderColor: 'var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
                      style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        disabled={table.columns.length === 0}
        className="rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
      >
        + Add Row
      </button>
    </div>
  );
}

function MappingEditor({
  mappings,
  marketColumns,
  productColumns,
  onChange,
}: {
  mappings: MarketAnalysisMapping[];
  marketColumns: MarketAnalysisTable['columns'];
  productColumns: MarketAnalysisTable['columns'];
  onChange: (next: MarketAnalysisMapping[]) => void;
}) {
  function addMapping() {
    onChange([
      ...mappings,
      {
        id: createLocalId(),
        marketColumnId: marketColumns[0]?.id ?? '',
        productColumnId: productColumns[0]?.id ?? '',
        relation: '',
      },
    ]);
  }

  function updateMapping(id: string, key: keyof MarketAnalysisMapping, value: string) {
    onChange(mappings.map((mapping) => mapping.id === id ? { ...mapping, [key]: key === 'relation' ? value : value } : mapping));
  }

  function removeMapping(id: string) {
    onChange(mappings.filter((mapping) => mapping.id !== id));
  }

  return (
    <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--panel-bg)' }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mapping Table</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Link columns between the Market Product Table and Product Table so you can compare signals and identify opportunities.
          </p>
        </div>
        <button
          type="button"
          onClick={addMapping}
          disabled={marketColumns.length === 0 || productColumns.length === 0}
          className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
        >
          + Add Mapping
        </button>
      </div>

      {(marketColumns.length === 0 || productColumns.length === 0) ? (
        <div className="rounded-2xl border border-dashed px-4 py-6 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          Add columns to both tables before defining mappings.
        </div>
      ) : mappings.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-4 py-6 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          No mappings yet. Add a mapping to connect comparable fields across both tables.
        </div>
      ) : (
        <div className="space-y-3">
          {mappings.map((mapping) => (
            <div key={mapping.id} className="grid gap-3 rounded-2xl border p-3 lg:grid-cols-[1fr_1fr_1fr_auto]" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}>
              <select
                value={mapping.marketColumnId}
                onChange={(event) => updateMapping(mapping.id, 'marketColumnId', event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
              >
                {marketColumns.map((column) => (
                  <option key={column.id} value={column.id}>{column.name}</option>
                ))}
              </select>

              <select
                value={mapping.productColumnId}
                onChange={(event) => updateMapping(mapping.id, 'productColumnId', event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
              >
                {productColumns.map((column) => (
                  <option key={column.id} value={column.id}>{column.name}</option>
                ))}
              </select>

              <input
                value={mapping.relation ?? ''}
                onChange={(event) => updateMapping(mapping.id, 'relation', event.target.value)}
                placeholder="Relationship or note"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-body)' }}
              />

              <button
                type="button"
                onClick={() => removeMapping(mapping.id)}
                className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CombinationTable({
  marketTable,
  productTable,
  combinationTable,
  onChange,
}: {
  marketTable: MarketAnalysisTable;
  productTable: MarketAnalysisTable;
  combinationTable: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  function getRowLabel(table: MarketAnalysisTable, row: typeof table.rows[number], index: number) {
    const firstCol = table.columns[0];
    const val = firstCol ? row.values[firstCol.id] : null;
    return val && val.trim() ? val.trim() : `Row ${index + 1}`;
  }

  function cellKey(marketRowId: string, productRowId: string) {
    return `${marketRowId}:${productRowId}`;
  }

  function updateCell(marketRowId: string, productRowId: string, value: string) {
    const key = cellKey(marketRowId, productRowId);
    const next = { ...combinationTable };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    onChange(next);
  }

  if (marketTable.rows.length === 0 || productTable.rows.length === 0) {
    return (
      <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--panel-bg)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Combination Table</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            The linked criteria needs rows in both the Market Product Table and the Product Table before the combination table can be used.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          {marketTable.rows.length === 0 && productTable.rows.length === 0
            ? 'Both tables are empty.'
            : marketTable.rows.length === 0
              ? 'Market Product Table has no rows.'
              : 'Product Table has no rows.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--panel-bg)' }}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Combination Table</h3>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Relate each market product row to each internal product row. Enter a note, score, or leave blank for unrelated pairs.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-color)' }}>
        <table className="min-w-full border-collapse text-xs">
          <thead style={{ background: 'var(--card-bg)' }}>
            <tr>
              <th
                className="sticky left-0 z-10 border-b border-r px-3 py-2.5 text-left text-xs font-semibold"
                style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-muted)' }}
              >
                Market ↓ / Product →
              </th>
              {productTable.rows.map((pRow, pi) => (
                <th
                  key={pRow.id}
                  className="border-b px-3 py-2.5 text-center font-semibold"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', minWidth: '120px' }}
                >
                  {getRowLabel(productTable, pRow, pi)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marketTable.rows.map((mRow, mi) => (
              <tr key={mRow.id}>
                <td
                  className="sticky left-0 z-10 border-b border-r px-3 py-2 text-left font-semibold whitespace-nowrap"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                >
                  {getRowLabel(marketTable, mRow, mi)}
                </td>
                {productTable.rows.map((pRow) => {
                  const key = cellKey(mRow.id, pRow.id);
                  return (
                    <td key={key} className="border-b px-2 py-1.5" style={{ borderColor: 'var(--border-color)' }}>
                      <input
                        value={combinationTable[key] ?? ''}
                        onChange={(e) => updateCell(mRow.id, pRow.id, e.target.value)}
                        placeholder="—"
                        className="w-full rounded-lg border px-2 py-1.5 text-center text-xs"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-body)' }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getViabilityInsight(predictedRoiPct: number | null, mappingCount: number) {
  if (predictedRoiPct == null) {
    return {
      label: 'Incomplete',
      description: 'Add a predicted ROI to start evaluating whether the product line is worth entering.',
      tone: 'var(--text-secondary)',
      background: 'var(--hover-bg)',
    };
  }

  if (mappingCount === 0) {
    return {
      label: 'Needs mapping',
      description: 'ROI is present, but the two tables are not yet linked. Add mappings before trusting the result.',
      tone: '#b45309',
      background: '#fef3c7',
    };
  }

  if (predictedRoiPct >= 25) {
    return {
      label: 'Promising',
      description: 'This product line looks commercially viable based on the current mapping and ROI target.',
      tone: '#065f46',
      background: '#d1fae5',
    };
  }

  if (predictedRoiPct >= 10) {
    return {
      label: 'Review',
      description: 'The line may be viable, but you should validate price, demand, or sourcing assumptions.',
      tone: '#92400e',
      background: '#fef3c7',
    };
  }

  return {
    label: 'High risk',
    description: 'Current assumptions suggest the product line is unlikely to be viable without changes to cost, pricing, or demand.',
    tone: '#991b1b',
    background: '#fee2e2',
  };
}

export default function MarketAnalysisPage() {
  const [criteriaList, setCriteriaList] = useState<MarketAnalysisCriteria[]>([]);
  const [analysisList, setAnalysisList] = useState<MarketAnalysisRecord[]>([]);
  const [criteriaDraft, setCriteriaDraft] = useState<CriteriaDraft>(createCriteriaDraft());
  const [analysisDraft, setAnalysisDraft] = useState<AnalysisDraft>(createAnalysisDraft());
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [analysisSaving, setAnalysisSaving] = useState(false);
  const [criteriaNotice, setCriteriaNotice] = useState('');
  const [analysisNotice, setAnalysisNotice] = useState('');

  async function loadData(options?: { criteriaId?: number | null; analysisId?: number | null }) {
    setLoading(true);
    setPageError('');
    try {
      const [criteriaResponse, analysesResponse] = await Promise.all([
        fetch('/api/stock/market-analysis/criteria'),
        fetch('/api/stock/market-analysis/analyses'),
      ]);

      if (!criteriaResponse.ok || !analysesResponse.ok) {
        throw new Error('Failed to load Market Analysis data');
      }

      const nextCriteriaList = await criteriaResponse.json() as MarketAnalysisCriteria[];
      const nextAnalysisList = await analysesResponse.json() as MarketAnalysisRecord[];
      setCriteriaList(nextCriteriaList);
      setAnalysisList(nextAnalysisList);

      const selectedCriteria = options?.criteriaId === null
        ? null
        : nextCriteriaList.find((item) => item.id === options?.criteriaId)
          ?? nextCriteriaList[0]
          ?? null;
      setCriteriaDraft(selectedCriteria ? cloneCriteria(selectedCriteria) : createCriteriaDraft());

      const selectedAnalysis = options?.analysisId === null
        ? null
        : nextAnalysisList.find((item) => item.id === options?.analysisId)
          ?? nextAnalysisList[0]
          ?? null;
      setAnalysisDraft(selectedAnalysis ? cloneAnalysis(selectedAnalysis) : createAnalysisDraft(selectedCriteria?.id));
    } catch (error: any) {
      setPageError(error?.message ?? 'Failed to load Market Analysis');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const criteriaInsight = getViabilityInsight(criteriaDraft.predicted_roi_pct, criteriaDraft.mapping_table.length);
  const linkedCriteria = criteriaList.find((criteria) => criteria.id === analysisDraft.criteria_id);
  const analysisInsight = getViabilityInsight(
    analysisDraft.predicted_roi_pct ?? linkedCriteria?.predicted_roi_pct ?? null,
    linkedCriteria?.mapping_table.length ?? 0,
  );

  async function saveCriteria() {
    setCriteriaSaving(true);
    setCriteriaNotice('');
    setPageError('');
    try {
      const response = await fetch(
        criteriaDraft.id ? `/api/stock/market-analysis/criteria/${criteriaDraft.id}` : '/api/stock/market-analysis/criteria',
        {
          method: criteriaDraft.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(criteriaDraft),
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save criteria');
      }

      setCriteriaNotice(criteriaDraft.id ? 'Criteria updated.' : 'Criteria created.');
      await loadData({ criteriaId: payload.id, analysisId: analysisDraft.id ?? undefined });
    } catch (error: any) {
      setPageError(error?.message ?? 'Failed to save criteria');
    } finally {
      setCriteriaSaving(false);
    }
  }

  async function deleteCriteria(id?: number) {
    if (!id) return;
    setPageError('');
    setCriteriaNotice('');
    try {
      const response = await fetch(`/api/stock/market-analysis/criteria/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to delete criteria');
      }
      setCriteriaNotice('Criteria deleted.');
      await loadData({ criteriaId: null, analysisId: analysisDraft.id ?? undefined });
    } catch (error: any) {
      setPageError(error?.message ?? 'Failed to delete criteria');
    }
  }

  async function saveAnalysis() {
    setAnalysisSaving(true);
    setAnalysisNotice('');
    setPageError('');
    try {
      const response = await fetch(
        analysisDraft.id ? `/api/stock/market-analysis/analyses/${analysisDraft.id}` : '/api/stock/market-analysis/analyses',
        {
          method: analysisDraft.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analysisDraft),
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save analysis');
      }

      setAnalysisNotice(analysisDraft.id ? 'Analysis updated.' : 'Analysis created.');
      await loadData({ criteriaId: criteriaDraft.id ?? undefined, analysisId: payload.id });
    } catch (error: any) {
      setPageError(error?.message ?? 'Failed to save analysis');
    } finally {
      setAnalysisSaving(false);
    }
  }

  async function deleteAnalysis(id?: number) {
    if (!id) return;
    setPageError('');
    setAnalysisNotice('');
    try {
      const response = await fetch(`/api/stock/market-analysis/analyses/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to delete analysis');
      }
      setAnalysisNotice('Analysis deleted.');
      await loadData({ criteriaId: criteriaDraft.id ?? undefined, analysisId: null });
    } catch (error: any) {
      setPageError(error?.message ?? 'Failed to delete analysis');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/stock/data" className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>
            Data
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Market Analysis
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: 'var(--text-body)' }}>
            Build reusable criteria, compare market and internal product tables, map relationships, and decide whether a product line is commercially viable before you commit to it.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCriteriaDraft(createCriteriaDraft())}
            className="rounded-2xl px-4 py-3 text-sm font-semibold transition-colors"
            style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
          >
            New Criteria
          </button>
          <button
            type="button"
            onClick={() => setAnalysisDraft(createAnalysisDraft(criteriaDraft.id ?? criteriaList[0]?.id))}
            disabled={criteriaList.length === 0}
            className="rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--accent-primary)', color: '#ffffff' }}
          >
            New Analysis
          </button>
        </div>
      </div>

      {pageError && (
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' }}>
          {pageError}
        </div>
      )}

      {loading ? (
        <Panel title="Loading" description="Fetching your Market Analysis workspace.">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading criteria and analyses…</p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6">
            <Panel title="Criteria Library" description="Criteria define the comparison structure used by one or more analyses.">
              <div className="space-y-3">
                {criteriaList.length === 0 ? (
                  <p className="rounded-2xl border border-dashed px-4 py-6 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    No criteria yet. Create one to define your market and product comparison tables.
                  </p>
                ) : criteriaList.map((criteria) => (
                  <button
                    key={criteria.id}
                    type="button"
                    onClick={() => setCriteriaDraft(cloneCriteria(criteria))}
                    className="w-full rounded-2xl border p-4 text-left transition-all"
                    style={{
                      borderColor: criteriaDraft.id === criteria.id ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: criteriaDraft.id === criteria.id ? 'var(--badge-active)' : 'var(--card-bg)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{criteria.name}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {criteria.mapping_table.length} mappings · {criteria.predicted_roi_pct != null ? `${criteria.predicted_roi_pct}% ROI` : 'No ROI yet'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title={criteriaDraft.id ? 'Edit Criteria' : 'Create Criteria'} description="Define the structure and commercial assumptions for a market comparison.">
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                      Name
                    </label>
                    <input
                      value={criteriaDraft.name}
                      onChange={(event) => setCriteriaDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Starter Deck ROI screen"
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                      Predicted ROI (%)
                    </label>
                    <input
                      type="number"
                      value={criteriaDraft.predicted_roi_pct ?? ''}
                      onChange={(event) => setCriteriaDraft((current) => ({
                        ...current,
                        predicted_roi_pct: event.target.value === '' ? null : Number(event.target.value),
                      }))}
                      placeholder="25"
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                    Description
                  </label>
                  <textarea
                    value={criteriaDraft.description ?? ''}
                    onChange={(event) => setCriteriaDraft((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    placeholder="Describe the market, assumptions, and success conditions for this criteria set."
                    className="w-full rounded-2xl border px-4 py-3 text-sm"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-body)' }}
                  />
                </div>

                <GridEditor
                  label="Market Product Table"
                  description="Capture external market signals such as competitors, price bands, demand indicators, and release timings."
                  table={criteriaDraft.market_product_table}
                  onChange={(next) => setCriteriaDraft((current) => ({ ...current, market_product_table: next }))}
                />

                <GridEditor
                  label="Product Table"
                  description="Capture your internal product assumptions such as SKU, landed cost, target selling price, and channel fit."
                  table={criteriaDraft.product_table}
                  onChange={(next) => setCriteriaDraft((current) => ({ ...current, product_table: next }))}
                />

                <MappingEditor
                  mappings={criteriaDraft.mapping_table}
                  marketColumns={criteriaDraft.market_product_table.columns}
                  productColumns={criteriaDraft.product_table.columns}
                  onChange={(next) => setCriteriaDraft((current) => ({ ...current, mapping_table: next }))}
                />

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                      Viability Notes
                    </label>
                    <textarea
                      value={criteriaDraft.viability_notes ?? ''}
                      onChange={(event) => setCriteriaDraft((current) => ({ ...current, viability_notes: event.target.value }))}
                      rows={4}
                      placeholder="Summarise what would make this line viable or what risks must be solved first."
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-body)' }}
                    />
                  </div>

                  <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', background: criteriaInsight.background }}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: criteriaInsight.tone }}>
                      Viability Check
                    </p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: criteriaInsight.tone }}>
                      {criteriaInsight.label}
                    </p>
                    <p className="mt-2 text-sm leading-6" style={{ color: criteriaInsight.tone }}>
                      {criteriaInsight.description}
                    </p>
                  </div>
                </div>

                {criteriaNotice && (
                  <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: '#d1fae5', borderColor: '#a7f3d0', color: '#065f46' }}>
                    {criteriaNotice}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveCriteria}
                    disabled={criteriaSaving || !criteriaDraft.name.trim()}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                  >
                    {criteriaSaving ? 'Saving…' : criteriaDraft.id ? 'Save Criteria' : 'Create Criteria'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCriteriaDraft(createCriteriaDraft())}
                    className="rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    Clear
                  </button>

                  {criteriaDraft.id && (
                    <button
                      type="button"
                      onClick={() => deleteCriteria(criteriaDraft.id)}
                      className="rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors"
                      style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fef2f2' }}
                    >
                      Delete Criteria
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6">
            <Panel title="Analyses" description="Analyses are execution-ready evaluations linked to a chosen criteria set.">
              <div className="space-y-3">
                {analysisList.length === 0 ? (
                  <p className="rounded-2xl border border-dashed px-4 py-6 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    No analyses yet. Create one when you are ready to evaluate a product line using a criteria set.
                  </p>
                ) : analysisList.map((analysis) => (
                  <button
                    key={analysis.id}
                    type="button"
                    onClick={() => setAnalysisDraft(cloneAnalysis(analysis))}
                    className="w-full rounded-2xl border p-4 text-left transition-all"
                    style={{
                      borderColor: analysisDraft.id === analysis.id ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: analysisDraft.id === analysis.id ? 'var(--badge-active)' : 'var(--card-bg)',
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{analysis.name}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {analysis.criteria_name} · {analysis.predicted_roi_pct != null ? `${analysis.predicted_roi_pct}% ROI` : 'No ROI yet'}
                    </p>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title={analysisDraft.id ? 'Edit Analysis' : 'Create Analysis'} description="Use a saved criteria set to evaluate the viability of a potential product line.">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
                    Criteria
                  </label>
                  <select
                    value={analysisDraft.criteria_id || ''}
                    onChange={(event) => {
                      const nextCriteriaId = Number(event.target.value);
                      const nextCriteria = criteriaList.find((criteria) => criteria.id === nextCriteriaId);
                      setAnalysisDraft((current) => ({
                        ...current,
                        criteria_id: nextCriteriaId,
                        name: nextCriteria?.name ?? current.name,
                        predicted_roi_pct: nextCriteria?.predicted_roi_pct ?? current.predicted_roi_pct,
                      }));
                    }}
                    className="w-full rounded-2xl border px-4 py-3 text-sm"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
                    disabled={criteriaList.length === 0}
                  >
                    {criteriaList.length === 0 ? (
                      <option value="">Create a criteria first</option>
                    ) : criteriaList.map((criteria) => (
                      <option key={criteria.id} value={criteria.id}>{criteria.name}</option>
                    ))}
                  </select>
                </div>

                {linkedCriteria && (
                  <CombinationTable
                    marketTable={linkedCriteria.market_product_table}
                    productTable={linkedCriteria.product_table}
                    combinationTable={analysisDraft.combination_table}
                    onChange={(next) => setAnalysisDraft((current) => ({ ...current, combination_table: next }))}
                  />
                )}

                {linkedCriteria && (
                  <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--panel-bg)' }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>
                        Based on Criteria
                      </p>
                      <p className="mt-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{linkedCriteria.name}</p>
                      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-body)' }}>
                        {linkedCriteria.description || 'No description added yet.'}
                      </p>
                      <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {linkedCriteria.market_product_table.columns.length} market columns · {linkedCriteria.product_table.columns.length} product columns · {linkedCriteria.mapping_table.length} mappings
                      </p>
                    </div>

                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)', background: analysisInsight.background }}>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: analysisInsight.tone }}>
                        Viability Prompt
                      </p>
                      <p className="mt-2 text-lg font-semibold" style={{ color: analysisInsight.tone }}>
                        {analysisInsight.label}
                      </p>
                      <p className="mt-2 text-sm leading-6" style={{ color: analysisInsight.tone }}>
                        {analysisInsight.description}
                      </p>
                    </div>
                  </div>
                )}

                {analysisNotice && (
                  <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: '#d1fae5', borderColor: '#a7f3d0', color: '#065f46' }}>
                    {analysisNotice}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveAnalysis}
                    disabled={analysisSaving}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                  >
                    {analysisSaving ? 'Saving…' : analysisDraft.id ? 'Save Analysis' : 'Create Analysis'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnalysisDraft(createAnalysisDraft(criteriaDraft.id ?? criteriaList[0]?.id))}
                    className="rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    Clear
                  </button>

                  {analysisDraft.id && (
                    <button
                      type="button"
                      onClick={() => deleteAnalysis(analysisDraft.id)}
                      className="rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors"
                      style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fef2f2' }}
                    >
                      Delete Analysis
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}