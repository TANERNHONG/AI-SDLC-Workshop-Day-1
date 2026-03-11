import { NextRequest, NextResponse } from 'next/server';
import { courierDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weight = Number(searchParams.get('weight_kg') || 0);
  const length = Number(searchParams.get('length_cm') || 0);
  const width = Number(searchParams.get('width_cm') || 0);
  const height = Number(searchParams.get('height_cm') || 0);

  if (weight <= 0 || length <= 0 || width <= 0 || height <= 0) {
    return NextResponse.json({ error: 'weight_kg, length_cm, width_cm, and height_cm must be > 0' }, { status: 400 });
  }

  try {
    const quotes = courierDB.getQuotes(weight, length, width, height);
    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json({ error: 'Failed to compute quotes' }, { status: 500 });
  }
}
