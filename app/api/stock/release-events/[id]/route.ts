import { NextRequest, NextResponse } from 'next/server';
import { releaseEventDB } from '@/lib/stockdb';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = releaseEventDB.getById(Number(id));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { product_ids, ...data } = body;

    const event = releaseEventDB.update(Number(id), data);
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (Array.isArray(product_ids)) {
      releaseEventDB.setProducts(event.id, product_ids.map(Number));
    }

    const full = releaseEventDB.getById(event.id);
    return NextResponse.json(full);
  } catch {
    return NextResponse.json({ error: 'Failed to update release event' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    releaseEventDB.delete(Number(id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete release event' }, { status: 500 });
  }
}
