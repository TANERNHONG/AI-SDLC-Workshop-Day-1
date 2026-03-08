import { NextRequest, NextResponse } from 'next/server';
import { stockEventDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get('product_id');
    const startDate = searchParams.get('startDate') ?? undefined;
    const endDate = searchParams.get('endDate') ?? undefined;
    const events = stockEventDB.list({
      product_id: product_id ? Number(product_id) : undefined,
      startDate,
      endDate,
    });
    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stock events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id, event_type, quantity, notes, event_date } = body;

    if (!product_id || !event_type || quantity == null || quantity === 0) {
      return NextResponse.json(
        { error: 'product_id, event_type, and a non-zero quantity are required' },
        { status: 400 }
      );
    }

    const event = stockEventDB.create({
      product_id: Number(product_id),
      event_type: String(event_type).trim(),
      quantity: Number(quantity),
      notes: notes ? String(notes).trim() : undefined,
      event_date: event_date || undefined,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create stock event' }, { status: 500 });
  }
}
