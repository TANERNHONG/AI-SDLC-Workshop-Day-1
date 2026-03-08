import { NextRequest, NextResponse } from 'next/server';
import { pnlDB } from '@/lib/stockdb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') ?? '';
    const endDate = searchParams.get('endDate') ?? '';
    const type = searchParams.get('type') ?? 'summary';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    if (type === 'daily')    return NextResponse.json(pnlDB.getDailyPnL(startDate, endDate));
    if (type === 'products') return NextResponse.json(pnlDB.getProductPnL(startDate, endDate));
    return NextResponse.json(pnlDB.getSummary(startDate, endDate));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch PnL data' }, { status: 500 });
  }
}
