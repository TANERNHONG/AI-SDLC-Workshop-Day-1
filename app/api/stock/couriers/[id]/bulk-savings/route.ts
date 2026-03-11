import { NextRequest, NextResponse } from 'next/server';
import { courierDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(courierDB.getBulkSavings(Number(id)));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bulk savings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    if (body.min_orders == null || body.discount_pct == null) {
      return NextResponse.json({ error: 'min_orders and discount_pct are required' }, { status: 400 });
    }
    const entry = courierDB.addBulkSaving({
      courier_id: Number(id),
      min_orders: Number(body.min_orders),
      max_orders: body.max_orders != null ? Number(body.max_orders) : null,
      discount_pct: Number(body.discount_pct),
    });
    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add bulk saving entry' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });
    const entry = courierDB.updateBulkSaving(Number(body.entry_id), {
      min_orders: body.min_orders != null ? Number(body.min_orders) : undefined,
      max_orders: body.max_orders !== undefined ? (body.max_orders != null ? Number(body.max_orders) : null) : undefined,
      discount_pct: body.discount_pct != null ? Number(body.discount_pct) : undefined,
    });
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to update bulk saving entry' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entry_id');
    if (!entryId) return NextResponse.json({ error: 'entry_id query param required' }, { status: 400 });
    courierDB.deleteBulkSaving(Number(entryId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete bulk saving entry' }, { status: 500 });
  }
}
