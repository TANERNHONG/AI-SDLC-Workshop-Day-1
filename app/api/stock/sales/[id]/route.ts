import { NextRequest, NextResponse } from 'next/server';
import { saleDB } from '@/lib/stockdb';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sale = saleDB.getById(Number(id));
  if (!sale) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(sale);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { status, notes, discount, tax, sale_date, channel, refunds, buyer_name, buyer_username, paynow_ref, shipping_charged, shipping_actual } = body;

    // Handle partial refunds
    if (Array.isArray(refunds) && refunds.length > 0) {
      const updated = saleDB.refundItems(Number(id), refunds);
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(updated);
    }

    if (status) {
      saleDB.updateStatus(Number(id), status);
    }

    const updated = saleDB.update(Number(id), { notes, discount, tax, sale_date, channel, buyer_name, buyer_username, paynow_ref, shipping_charged, shipping_actual });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to update sale' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const sale = saleDB.getById(Number(id));
    if (!sale) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    saleDB.delete(Number(id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to delete sale' }, { status: 500 });
  }
}
