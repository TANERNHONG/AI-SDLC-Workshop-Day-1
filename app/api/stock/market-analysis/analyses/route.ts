import { NextRequest, NextResponse } from 'next/server';
import { marketAnalysisDB } from '@/lib/stockdb';

export async function GET() {
  try {
    return NextResponse.json(marketAnalysisDB.listAnalyses());
  } catch {
    return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, criteria_id, description, viability_status, predicted_roi_pct, summary, combination_table } = body;

    if (criteria_id != null) {
      const criteria = marketAnalysisDB.getCriteriaById(Number(criteria_id));
      if (!criteria) {
        return NextResponse.json({ error: 'criteria_id is invalid' }, { status: 400 });
      }
    }

    const analysis = marketAnalysisDB.createAnalysis({
      name: name ? String(name).trim() : null,
      criteria_id: criteria_id != null ? Number(criteria_id) : null,
      description: description ? String(description).trim() : null,
      viability_status,
      predicted_roi_pct: predicted_roi_pct != null && predicted_roi_pct !== '' ? Number(predicted_roi_pct) : null,
      summary: summary ? String(summary).trim() : null,
      combination_table: combination_table && typeof combination_table === 'object' ? combination_table : undefined,
    });

    return NextResponse.json(analysis, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create analysis' }, { status: 500 });
  }
}