import { NextRequest, NextResponse } from 'next/server';
import { resolveMarketQuery, fetchMarketsFromEventSlug } from '@/lib/polymarket';

function extractSlug(q: string): string {
  if (q.includes('polymarket.com')) {
    try {
      const url = new URL(q.startsWith('http') ? q : 'https://' + q);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1];
    } catch { /* fall through */ }
  }
  if (q.includes('/')) return q.split('/').filter(Boolean).pop() ?? q;
  return q;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  const isUrl = q.includes('://') || q.startsWith('www.');
  if (isUrl && !q.includes('polymarket.com')) {
    return NextResponse.json(
      { error: 'This is not a Polymarket link. Please paste a polymarket.com URL or market slug.' },
      { status: 400 }
    );
  }

  try {
    const market = await resolveMarketQuery(q);
    return NextResponse.json(market);
  } catch {
    // resolveMarketQuery failed — try the events API
    const slug = extractSlug(q);
    const eventMarkets = await fetchMarketsFromEventSlug(slug);

    if (!eventMarkets || eventMarkets.length === 0) {
      return NextResponse.json(
        { error: `Market not found for "${slug}". The market may have been removed or the URL may be incorrect.` },
        { status: 404 }
      );
    }

    // Single market in event — return it directly
    if (eventMarkets.length === 1) {
      return NextResponse.json(eventMarkets[0]);
    }

    // Multiple markets — only show active ones for the picker
    const active = eventMarkets.filter(m => m.active && !m.closed);
    const choices = active.length > 0 ? active : eventMarkets;
    if (choices.length === 1) return NextResponse.json(choices[0]);
    return NextResponse.json({ choices });
  }
}
