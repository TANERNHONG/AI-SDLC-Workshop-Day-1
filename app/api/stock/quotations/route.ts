import { NextRequest, NextResponse } from 'next/server';
import { quotationDB } from '@/lib/stockdb';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const supplier_id = url.searchParams.get('supplier_id');
    const product_id = url.searchParams.get('product_id');
    const activeOnly = url.searchParams.get('activeOnly') !== 'false';

    const quotations = quotationDB.list({
      supplier_id: supplier_id ? Number(supplier_id) : undefined,
      product_id: product_id ? Number(product_id) : undefined,
      activeOnly,
    });
    return NextResponse.json(quotations);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.supplier_id || !body.product_id || body.unit_price == null) {
      return NextResponse.json({ error: 'supplier_id, product_id, and unit_price are required' }, { status: 400 });
    }
    if (Number(body.unit_price) < 0) {
      return NextResponse.json({ error: 'unit_price must be non-negative' }, { status: 400 });
    }
    if (body.moq != null && Number(body.moq) < 1) {
      return NextResponse.json({ error: 'moq must be at least 1' }, { status: 400 });
    }
    const quotation = quotationDB.create({
      supplier_id: Number(body.supplier_id),
      product_id: Number(body.product_id),
      unit_price: Number(body.unit_price),
      currency: body.currency || 'SGD',
      exchange_rate: Number(body.exchange_rate) || 1,
      moq: Number(body.moq) || 1,
      lead_time_days: body.lead_time_days != null ? Number(body.lead_time_days) : null,
      valid_from: body.valid_from || null,
      valid_until: body.valid_until || null,
      notes: body.notes?.trim() || null,
    });
    return NextResponse.json(quotation, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 });
  }
}
