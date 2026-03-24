import { NextResponse } from 'next/server';
import { saleDB } from '@/lib/stockdb';

export async function GET() {
  try {
    const data = saleDB.getProductDailySparkline(30);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sparkline data' }, { status: 500 });
  }
}
