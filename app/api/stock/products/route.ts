import { NextRequest, NextResponse } from 'next/server';
import { productDB } from '@/lib/stockdb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  try {
    const products = productDB.list(includeInactive);
    return NextResponse.json(products);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sku, description, price, cost, cost_currency, cost_exchange_rate, stock_quantity, category, image_url, length_cm, width_cm, height_cm, thickness_length_mm, thickness_width_mm, thickness_height_mm, is_hypothetical } = body;

    if (!name || !sku || price == null) {
      return NextResponse.json({ error: 'name, sku, and price are required' }, { status: 400 });
    }

    const product = productDB.create({
      name: String(name).trim(),
      sku: String(sku).trim().toUpperCase(),
      description: description ? String(description).trim() : null,
      price: Number(price),
      cost: Number(cost ?? 0),
      cost_currency: cost_currency ? String(cost_currency) : 'SGD',
      cost_exchange_rate: Number(cost_exchange_rate ?? 1),
      stock_quantity: Number(stock_quantity ?? 0),
      category: category ? String(category).trim() : null,
      image_url: image_url ? String(image_url).trim() : null,
      length_cm: length_cm != null ? Number(length_cm) : null,
      width_cm: width_cm != null ? Number(width_cm) : null,
      height_cm: height_cm != null ? Number(height_cm) : null,
      thickness_length_mm: thickness_length_mm != null ? Number(thickness_length_mm) : null,
      thickness_width_mm: thickness_width_mm != null ? Number(thickness_width_mm) : null,
      thickness_height_mm: thickness_height_mm != null ? Number(thickness_height_mm) : null,
      is_hypothetical: Boolean(is_hypothetical),
      is_active: true,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'A product with that SKU already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
