import { NextRequest, NextResponse } from 'next/server';
import { courierDB } from '@/lib/stockdb';

export async function GET() {
  try {
    return NextResponse.json(courierDB.list(true));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch couriers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Courier name is required' }, { status: 400 });
    }
    const slug = body.slug?.trim() || body.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const courier = courierDB.create({ name: body.name.trim(), slug });
    return NextResponse.json(courier, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Courier with this name or slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create courier' }, { status: 500 });
  }
}
