import { NextRequest, NextResponse } from 'next/server';
import { courierDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(courierDB.getRateTables(Number(id)));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rate tables' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    if (body.max_weight_kg == null || body.price == null) {
      return NextResponse.json({ error: 'max_weight_kg and price are required' }, { status: 400 });
    }
    const entry = courierDB.addRateTable({
      courier_id: Number(id),
      max_weight_kg: Number(body.max_weight_kg),
      max_length_cm: Number(body.max_length_cm ?? 0),
      max_width_cm: Number(body.max_width_cm ?? 0),
      max_height_cm: Number(body.max_height_cm ?? 0),
      price: Number(body.price),
    });
    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add rate table entry' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });
    const entry = courierDB.updateRateTable(Number(body.entry_id), {
      max_weight_kg: body.max_weight_kg != null ? Number(body.max_weight_kg) : undefined,
      max_length_cm: body.max_length_cm != null ? Number(body.max_length_cm) : undefined,
      max_width_cm: body.max_width_cm != null ? Number(body.max_width_cm) : undefined,
      max_height_cm: body.max_height_cm != null ? Number(body.max_height_cm) : undefined,
      price: body.price != null ? Number(body.price) : undefined,
    });
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to update rate table entry' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entry_id');
    if (!entryId) return NextResponse.json({ error: 'entry_id query param required' }, { status: 400 });
    courierDB.deleteRateTable(Number(entryId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete rate table entry' }, { status: 500 });
  }
}
