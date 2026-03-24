import { NextRequest, NextResponse } from 'next/server';
import { purchaseDB } from '@/lib/stockdb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    return NextResponse.json(purchaseDB.list({
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      supplier_id: searchParams.get('supplier_id') ? Number(searchParams.get('supplier_id')) : undefined,
      status: searchParams.get('status') ?? undefined,
    }));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.supplier_id) {
      return NextResponse.json({ error: 'Supplier is required' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }
    const purchase = purchaseDB.create(
      Number(body.supplier_id),
      body.items.map((i: { product_id: number; quantity: number; unit_cost: number }) => ({
        product_id: Number(i.product_id),
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
      })),
      {
        discount: body.discount ? Number(body.discount) : 0,
        tax: body.tax ? Number(body.tax) : 0,
        shipping_cost: body.shipping_cost ? Number(body.shipping_cost) : 0,
        currency: body.currency || 'SGD',
        exchange_rate: body.exchange_rate ? Number(body.exchange_rate) : 1,
        notes: body.notes || undefined,
        purchase_date: body.purchase_date || undefined,
        invoice_ref: body.invoice_ref || undefined,
        status: body.status || 'received',
        delivery_days: body.delivery_days != null ? Number(body.delivery_days) : undefined,
      }
    );
    return NextResponse.json(purchase, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create purchase';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
