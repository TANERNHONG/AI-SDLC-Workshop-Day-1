import { NextRequest, NextResponse } from 'next/server';
import { purchaseDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = purchaseDB.getById(Number(id));
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(purchase);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.discount !== undefined) updateData.discount = Number(body.discount);
    if (body.tax !== undefined) updateData.tax = Number(body.tax);
    if (body.shipping_cost !== undefined) updateData.shipping_cost = Number(body.shipping_cost);
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.exchange_rate !== undefined) updateData.exchange_rate = Number(body.exchange_rate);
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.delivery_days !== undefined) updateData.delivery_days = body.delivery_days != null ? Number(body.delivery_days) : null;
    if (Array.isArray(body.items)) {
      updateData.items = body.items.map((i: { product_id: number; quantity: number; unit_cost: number }) => ({
        product_id: Number(i.product_id),
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
      }));
    }
    const purchase = purchaseDB.update(Number(id), updateData as any);
    if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(purchase);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update purchase';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    purchaseDB.delete(Number(id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete purchase' }, { status: 500 });
  }
}
