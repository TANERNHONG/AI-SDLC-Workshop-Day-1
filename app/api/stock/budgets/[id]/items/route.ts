import { NextRequest, NextResponse } from 'next/server';
import { budgetDB } from '@/lib/stockdb';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const budgetId = Number(id);
    const budget = budgetDB.getById(budgetId);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

    const body = await req.json();
    if (!body.product_id || !body.product_name || !body.product_sku) {
      return NextResponse.json({ error: 'Product details are required' }, { status: 400 });
    }

    const item = budgetDB.addItem({
      budget_id: budgetId,
      product_id: body.product_id,
      product_name: body.product_name,
      product_sku: body.product_sku,
      supplier_id: body.supplier_id ?? null,
      supplier_name: body.supplier_name ?? null,
      quantity: body.quantity ?? 1,
      unit_cost: body.unit_cost ?? 0,
      predicted_sell_price: body.predicted_sell_price ?? 0,
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add budget item' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Reorder items
    if (body.reorder && Array.isArray(body.item_ids)) {
      budgetDB.reorderItems(Number(id), body.item_ids);
      return NextResponse.json({ ok: true });
    }

    // Update a single item
    if (!body.item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const item = budgetDB.updateItem(body.item_id, {
      supplier_id: body.supplier_id,
      supplier_name: body.supplier_name,
      quantity: body.quantity,
      unit_cost: body.unit_cost,
      predicted_sell_price: body.predicted_sell_price,
      position: body.position,
    });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: 'Failed to update budget item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _budgetId } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'itemId query param is required' }, { status: 400 });
    budgetDB.removeItem(Number(itemId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to remove budget item' }, { status: 500 });
  }
}
