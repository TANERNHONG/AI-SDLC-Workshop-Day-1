import { NextRequest, NextResponse } from 'next/server';
import { courierDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courier = courierDB.getById(Number(id));
  if (!courier) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(courier);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const courier = courierDB.update(Number(id), {
      name: body.name?.trim(),
      slug: body.slug?.trim(),
      is_active: body.is_active,
    });
    if (!courier) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(courier);
  } catch {
    return NextResponse.json({ error: 'Failed to update courier' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    courierDB.delete(Number(id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete courier' }, { status: 500 });
  }
}
