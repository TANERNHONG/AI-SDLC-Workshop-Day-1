import { NextRequest, NextResponse } from 'next/server';
import { quotationDB } from '@/lib/stockdb';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = quotationDB.getById(Number(id));
    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(quotation);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch quotation' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.unit_price != null && Number(body.unit_price) < 0) {
      return NextResponse.json({ error: 'unit_price must be non-negative' }, { status: 400 });
    }
    if (body.moq != null && Number(body.moq) < 1) {
      return NextResponse.json({ error: 'moq must be at least 1' }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    if (body.supplier_id != null) data.supplier_id = Number(body.supplier_id);
    if (body.product_id != null) data.product_id = Number(body.product_id);
    if (body.unit_price != null) data.unit_price = Number(body.unit_price);
    if (body.currency != null) data.currency = body.currency;
    if (body.exchange_rate != null) data.exchange_rate = Number(body.exchange_rate);
    if (body.moq != null) data.moq = Number(body.moq);
    if (body.lead_time_days !== undefined) data.lead_time_days = body.lead_time_days != null ? Number(body.lead_time_days) : null;
    if (body.valid_from !== undefined) data.valid_from = body.valid_from || null;
    if (body.valid_until !== undefined) data.valid_until = body.valid_until || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);

    const quotation = quotationDB.update(Number(id), data);
    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(quotation);
  } catch {
    return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    quotationDB.delete(Number(id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
  }
}
