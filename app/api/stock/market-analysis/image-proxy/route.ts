import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Proxy that fetches a remote image and returns it, avoiding CORS issues
 * when loading third-party images into an HTML Canvas for pixel analysis.
 *
 * GET /api/stock/market-analysis/image-proxy?url=<encodedUrl>
 */
export async function GET(request: NextRequest) {
  /* ── Auth ── */
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  /* ── Validate param ── */
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl)
    return NextResponse.json({ error: 'Missing "url" query parameter' }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol))
    return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 });

  /* ── Basic SSRF protection – block private / loopback addresses ── */
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  )
    return NextResponse.json({ error: 'Private / internal URLs are not allowed' }, { status: 400 });

  /* ── Fetch remote image ── */
  try {
    const upstream = await fetch(rawUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'image/*' },
      redirect: 'follow',
    });

    if (!upstream.ok)
      return NextResponse.json(
        { error: `Upstream responded with ${upstream.status}` },
        { status: 502 },
      );

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/'))
      return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 });

    const buf = await upstream.arrayBuffer();

    /* Cap at 10 MB */
    if (buf.byteLength > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'Image exceeds 10 MB limit' }, { status: 400 });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image from upstream' }, { status: 502 });
  }
}
