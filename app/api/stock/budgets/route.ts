import { NextRequest, NextResponse } from 'next/server';
import { budgetDB } from '@/lib/stockdb';

export async function GET() {
  try {
    const budgets = budgetDB.list(true);
    // Return with computed item summaries
    const result = budgets.map(b => {
      const full = budgetDB.getWithItems(b.id);
      return full ?? b;
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Budget name is required' }, { status: 400 });
    }
    if (!body.start_date || !body.end_date) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }
    if (typeof body.total_budget !== 'number' || body.total_budget < 0) {
      return NextResponse.json({ error: 'Valid budget amount is required' }, { status: 400 });
    }
    const budget = budgetDB.create({
      name: body.name.trim(),
      total_budget: body.total_budget,
      start_date: body.start_date,
      end_date: body.end_date,
      notes: body.notes?.trim() || null,
    });
    return NextResponse.json(budgetDB.getWithItems(budget.id), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}
