import { NextRequest, NextResponse } from 'next/server';
import { releaseEventDB } from '@/lib/stockdb';

export async function GET() {
  try {
    const events = releaseEventDB.list();
    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch release events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, release_date, description, game_series, product_ids } = body;

    if (!name || !release_date) {
      return NextResponse.json({ error: 'name and release_date are required' }, { status: 400 });
    }

    const event = releaseEventDB.create({
      name: String(name).trim(),
      release_date: String(release_date),
      description: description ? String(description).trim() : null,
      game_series: game_series ? String(game_series).trim() : null,
    });

    if (Array.isArray(product_ids) && product_ids.length > 0) {
      releaseEventDB.setProducts(event.id, product_ids.map(Number));
    }

    const full = releaseEventDB.getById(event.id);
    return NextResponse.json(full, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create release event' }, { status: 500 });
  }
}
