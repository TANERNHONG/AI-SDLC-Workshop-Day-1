import { NextRequest, NextResponse } from 'next/server';
import { courierDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(courierDB.getAdditionalServices(Number(id)));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch additional services' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    if (!body.service_name?.trim() || body.price == null) {
      return NextResponse.json({ error: 'service_name and price are required' }, { status: 400 });
    }
    const entry = courierDB.addAdditionalService({
      courier_id: Number(id),
      service_name: body.service_name.trim(),
      price: Number(body.price),
      description: body.description?.trim() || undefined,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add additional service' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });
    const entry = courierDB.updateAdditionalService(Number(body.entry_id), {
      service_name: body.service_name?.trim(),
      price: body.price != null ? Number(body.price) : undefined,
      description: body.description?.trim(),
    });
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: 'Failed to update additional service' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get('entry_id');
    if (!entryId) return NextResponse.json({ error: 'entry_id query param required' }, { status: 400 });
    courierDB.deleteAdditionalService(Number(entryId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete additional service' }, { status: 500 });
  }
}
