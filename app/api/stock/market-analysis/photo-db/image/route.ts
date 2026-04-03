import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

/**
 * Serve an image from photo_db.
 *
 * GET /api/stock/market-analysis/photo-db/image?folder=Cards&file=610499_in_600x600.jpg
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const folder = request.nextUrl.searchParams.get('folder');
  const file = request.nextUrl.searchParams.get('file');

  if (!folder || !file)
    return NextResponse.json({ error: 'Missing "folder" and "file" query parameters' }, { status: 400 });

  // Sanitize: only allow basenames — no path traversal
  const safeFolder = path.basename(folder);
  const safeFile = path.basename(file);

  const photoDbRoot = path.join(process.cwd(), 'photo_db');
  const filePath = path.join(photoDbRoot, safeFolder, safeFile);

  // Verify resolved path stays inside photo_db
  if (!filePath.startsWith(photoDbRoot))
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
    return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const ext = path.extname(safeFile).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
