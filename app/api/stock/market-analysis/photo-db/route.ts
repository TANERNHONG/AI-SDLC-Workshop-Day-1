import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

/**
 * List folders and image files inside the photo_db directory.
 *
 * GET /api/stock/market-analysis/photo-db              → list top-level folders
 * GET /api/stock/market-analysis/photo-db?folder=Cards  → list files in Cards/
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const photoDbRoot = path.join(process.cwd(), 'photo_db');

  if (!fs.existsSync(photoDbRoot))
    return NextResponse.json({ error: 'photo_db directory not found' }, { status: 404 });

  const folder = request.nextUrl.searchParams.get('folder');

  if (!folder) {
    // List top-level folders
    const entries = fs.readdirSync(photoDbRoot, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name);
    return NextResponse.json({ folders });
  }

  // Sanitize: prevent path traversal
  const safeName = path.basename(folder);
  const targetDir = path.join(photoDbRoot, safeName);

  if (!targetDir.startsWith(photoDbRoot))
    return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory())
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
  const files = entries
    .filter(e => e.isFile() && imageExts.has(path.extname(e.name).toLowerCase()))
    .map(e => e.name);

  return NextResponse.json({ folder: safeName, files });
}
