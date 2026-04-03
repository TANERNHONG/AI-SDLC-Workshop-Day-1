import { NextRequest, NextResponse } from 'next/server';
import { marketAnalysisDB } from '@/lib/stockdb';

export async function GET() {
  try {
    return NextResponse.json(marketAnalysisDB.listCriteria());
  } catch {
    return NextResponse.json({ error: 'Failed to fetch criteria' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, market_product_table, product_table, mapping_table, viability_notes, predicted_roi_pct } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const criteria = marketAnalysisDB.createCriteria({
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      market_product_table,
      product_table,
      mapping_table,
      viability_notes: viability_notes ? String(viability_notes).trim() : null,
      predicted_roi_pct: predicted_roi_pct != null && predicted_roi_pct !== '' ? Number(predicted_roi_pct) : null,
    });

    return NextResponse.json(criteria, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create criteria' }, { status: 500 });
  }
}