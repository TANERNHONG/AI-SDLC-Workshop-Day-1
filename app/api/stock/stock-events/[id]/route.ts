import { NextRequest, NextResponse } from 'next/server';
import { stockEventDB } from '@/lib/stockdb';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const event = stockEventDB.update(Number(id), body);
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: 'Failed to update stock event' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    stockEventDB.delete(Number(id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete stock event' }, { status: 500 });
  }
}
