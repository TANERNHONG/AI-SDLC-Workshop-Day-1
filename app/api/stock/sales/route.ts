import { NextRequest, NextResponse } from 'next/server';
import { saleDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') ?? undefined;
  const endDate = searchParams.get('endDate') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  try {
    const sales = saleDB.list({ startDate, endDate, status });
    return NextResponse.json(sales);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, discount, tax, notes, sale_date } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        return NextResponse.json(
          { error: 'Each item needs product_id, quantity, and unit_price' },
          { status: 400 }
        );
      }
    }

    const sale = saleDB.create(items, { discount, tax, notes, sale_date });
    return NextResponse.json(sale, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to create sale' }, { status: 500 });
  }
}
