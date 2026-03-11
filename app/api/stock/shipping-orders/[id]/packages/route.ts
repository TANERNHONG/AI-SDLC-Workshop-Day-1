import { NextRequest, NextResponse } from 'next/server';
import { shippingOrderDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = shippingOrderDB.getById(Number(id));
  if (!order) return NextResponse.json({ error: 'Shipping order not found' }, { status: 404 });
  return NextResponse.json(order.packages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const order = shippingOrderDB.getById(Number(id));
    if (!order) return NextResponse.json({ error: 'Shipping order not found' }, { status: 404 });

    const body = await req.json();
    const pkg = shippingOrderDB.addPackage({
      shipping_order_id: Number(id),
      length_cm: Number(body.length_cm) || 0,
      width_cm: Number(body.width_cm) || 0,
      height_cm: Number(body.height_cm) || 0,
      weight_kg: Number(body.weight_kg) || 0,
      courier_id: body.courier_id ? Number(body.courier_id) : undefined,
      notes: body.notes?.trim() || undefined,
    });
    return NextResponse.json(pkg, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to add package' }, { status: 500 });
  }
}
