import { NextRequest, NextResponse } from 'next/server';
import { saleDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const type = searchParams.get('type') ?? 'daily'; // 'daily' | 'products'

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  try {
    if (type === 'products') {
      const data = saleDB.getProductSummary(startDate, endDate);
      return NextResponse.json(data);
    }
    const data = saleDB.getDailySummary(startDate, endDate);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
