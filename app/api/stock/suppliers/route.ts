import { NextRequest, NextResponse } from 'next/server';
import { supplierDB } from '@/lib/stockdb';

export async function GET() {
  try {
    return NextResponse.json(supplierDB.list(true));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }
    const supplier = supplierDB.create({
      name: body.name.trim(),
      contact_person: body.contact_person?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      notes: body.notes?.trim() || null,
      is_active: true,
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
