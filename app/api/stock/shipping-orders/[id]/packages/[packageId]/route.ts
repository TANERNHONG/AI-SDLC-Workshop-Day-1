import { NextRequest, NextResponse } from 'next/server';
import { shippingOrderDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; packageId: string }> }) {
  const { packageId } = await params;
  const pkg = shippingOrderDB.getPackage(Number(packageId));
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(pkg);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; packageId: string }> }) {
  try {
    const { packageId } = await params;
    const body = await req.json();
    const pkg = shippingOrderDB.updatePackage(Number(packageId), {
      length_cm: body.length_cm != null ? Number(body.length_cm) : undefined,
      width_cm: body.width_cm != null ? Number(body.width_cm) : undefined,
      height_cm: body.height_cm != null ? Number(body.height_cm) : undefined,
      weight_kg: body.weight_kg != null ? Number(body.weight_kg) : undefined,
      courier_id: body.courier_id !== undefined ? (body.courier_id ? Number(body.courier_id) : null) : undefined,
      notes: body.notes,
    });
    if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(pkg);
  } catch {
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; packageId: string }> }) {
  try {
    const { packageId } = await params;
    shippingOrderDB.deletePackage(Number(packageId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
  }
}
