import { NextRequest, NextResponse } from 'next/server';
import { quotationDB } from '@/lib/stockdb';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const product_id = url.searchParams.get('product_id');

    if (product_id) {
      const comparison = quotationDB.compareByProduct(Number(product_id));
      if (!comparison) return NextResponse.json({ error: 'No quotations found for this product' }, { status: 404 });
      return NextResponse.json(comparison);
    }

    const comparisons = quotationDB.compareAll();
    return NextResponse.json(comparisons);
  } catch {
    return NextResponse.json({ error: 'Failed to generate comparison' }, { status: 500 });
  }
}
