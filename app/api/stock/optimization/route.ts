import { NextRequest, NextResponse } from 'next/server';
import { optimizationDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const result = optimizationDB.run({
      monthlyBudget: Number(searchParams.get('budget')) || undefined,
      leadTimeDays: Number(searchParams.get('leadTime')) || undefined,
      serviceLevel: Number(searchParams.get('serviceLevel')) || undefined,
      holdingCostPct: Number(searchParams.get('holdingCost')) || undefined,
      lookbackDays: Number(searchParams.get('lookback')) || undefined,
      releaseBoostMultiplier: Number(searchParams.get('releaseBoost')) || undefined,
      planningHorizonDays: Number(searchParams.get('horizon')) || undefined,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Optimization failed' }, { status: 500 });
  }
}
