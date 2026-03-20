import { NextRequest, NextResponse } from 'next/server';
import { saleDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const type = searchParams.get('type') ?? 'daily'; // 'daily' | 'products' | 'burnrate'

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  try {
    if (type === 'products') {
      return NextResponse.json(saleDB.getProductSummary(startDate, endDate));
    }
    if (type === 'margins') {
      return NextResponse.json(saleDB.getProductMarginSummary(startDate, endDate));
    }
    if (type === 'categories') {
      return NextResponse.json(saleDB.getCategoryRevenueSummary(startDate, endDate));
    }
    if (type === 'burnrate') {
      const leadTime = Math.max(1, Math.min(90, Number(searchParams.get('leadTime')) || 7));
      return NextResponse.json(saleDB.getBurnRateAndROP(startDate, endDate, leadTime));
    }
    return NextResponse.json(saleDB.getDailySummary(startDate, endDate));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
