export interface MarketAnalysisTableColumn {
  id: string;
  name: string;
}

export interface MarketAnalysisTableRow {
  id: string;
  values: Record<string, string>;
}

export interface MarketAnalysisTable {
  columns: MarketAnalysisTableColumn[];
  rows: MarketAnalysisTableRow[];
}

export interface MarketAnalysisMapping {
  id: string;
  marketColumnId: string;
  productColumnId: string;
  relation: string | null;
}

export interface MarketAnalysisCriteria {
  id: number;
  name: string;
  description: string | null;
  market_product_table: MarketAnalysisTable;
  product_table: MarketAnalysisTable;
  mapping_table: MarketAnalysisMapping[];
  viability_notes: string | null;
  predicted_roi_pct: number | null;
  created_at: string;
  updated_at: string;
}

export const MARKET_ANALYSIS_DECISIONS = ['promising', 'review', 'not-viable'] as const;

export type MarketAnalysisDecision = (typeof MARKET_ANALYSIS_DECISIONS)[number];

export interface MarketAnalysisRecord {
  id: number;
  name: string;
  criteria_id: number;
  criteria_name: string;
  description: string | null;
  viability_status: MarketAnalysisDecision;
  predicted_roi_pct: number | null;
  summary: string | null;
  combination_table: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export function createEmptyMarketTable(): MarketAnalysisTable {
  return {
    columns: [],
    rows: [],
  };
}