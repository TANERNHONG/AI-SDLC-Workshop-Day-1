import { NextRequest, NextResponse } from 'next/server';
import { marketAnalysisDB } from '@/lib/stockdb';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const criteria = marketAnalysisDB.getCriteriaById(Number(id));
  if (!criteria) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(criteria);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const criteria = marketAnalysisDB.updateCriteria(Number(id), {
      ...body,
      name: body.name != null ? String(body.name).trim() : undefined,
      description: body.description != null ? String(body.description).trim() : undefined,
      viability_notes: body.viability_notes != null ? String(body.viability_notes).trim() : undefined,
      predicted_roi_pct: body.predicted_roi_pct != null && body.predicted_roi_pct !== '' ? Number(body.predicted_roi_pct) : body.predicted_roi_pct === null ? null : undefined,
    });

    if (!criteria) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(criteria);
  } catch {
    return NextResponse.json({ error: 'Failed to update criteria' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    marketAnalysisDB.deleteCriteria(Number(id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete criteria' }, { status: 500 });
  }
}