import { NextRequest, NextResponse } from 'next/server';
import { purchaseDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = purchaseDB.getById(Number(id));
  if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(purchase);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.status) {
      purchaseDB.updateStatus(Number(id), body.status as 'received' | 'pending' | 'cancelled');
    }
    const purchase = purchaseDB.getById(Number(id));
    if (!purchase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(purchase);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update purchase';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    purchaseDB.delete(Number(id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete purchase' }, { status: 500 });
  }
}
