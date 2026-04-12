import { NextRequest, NextResponse } from 'next/server';
import { budgetDB } from '@/lib/stockdb';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const budget = budgetDB.getWithItems(Number(id));
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(budget);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const budget = budgetDB.update(Number(id), {
      name: body.name?.trim(),
      total_budget: body.total_budget,
      start_date: body.start_date,
      end_date: body.end_date,
      notes: body.notes?.trim() ?? undefined,
      is_active: body.is_active,
    });
    if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(budgetDB.getWithItems(budget.id));
  } catch {
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    budgetDB.delete(Number(id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
