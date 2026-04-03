import { NextRequest, NextResponse } from 'next/server';
import { marketAnalysisDB } from '@/lib/stockdb';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const analysis = marketAnalysisDB.getAnalysisById(Number(id));
  if (!analysis) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(analysis);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();

    if (body.criteria_id != null) {
      const criteria = marketAnalysisDB.getCriteriaById(Number(body.criteria_id));
      if (!criteria) {
        return NextResponse.json({ error: 'criteria_id is invalid' }, { status: 400 });
      }
    }

    const analysis = marketAnalysisDB.updateAnalysis(Number(id), {
      ...body,
      name: body.name != null ? String(body.name).trim() : undefined,
      criteria_id: body.criteria_id != null ? Number(body.criteria_id) : undefined,
      description: body.description != null ? String(body.description).trim() : undefined,
      predicted_roi_pct: body.predicted_roi_pct != null && body.predicted_roi_pct !== '' ? Number(body.predicted_roi_pct) : body.predicted_roi_pct === null ? null : undefined,
      summary: body.summary != null ? String(body.summary).trim() : undefined,
      combination_table: body.combination_table && typeof body.combination_table === 'object' ? body.combination_table : undefined,
    });

    if (!analysis) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json({ error: 'Failed to update analysis' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    marketAnalysisDB.deleteAnalysis(Number(id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete analysis' }, { status: 500 });
  }
}