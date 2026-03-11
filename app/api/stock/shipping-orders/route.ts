import { NextRequest, NextResponse } from 'next/server';
import { shippingOrderDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  try {
    const orders = shippingOrderDB.list({ status });
    return NextResponse.json(orders);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch shipping orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.sale_id) {
      return NextResponse.json({ error: 'sale_id is required' }, { status: 400 });
    }
    // Check if sale already has a shipping order
    const existing = shippingOrderDB.getBySaleId(Number(body.sale_id));
    if (existing) {
      return NextResponse.json({ error: 'This sale already has a shipping order' }, { status: 409 });
    }
    const order = shippingOrderDB.create({
      sale_id: Number(body.sale_id),
      status: body.status,
      notes: body.notes?.trim() || undefined,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to create shipping order' }, { status: 500 });
  }
}
