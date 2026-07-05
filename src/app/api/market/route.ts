import { NextRequest, NextResponse } from 'next/server';
import {
  MarketData,
  extractSlugCandidates,
  fetchMarketBySlug,
  fetchMarketsFromEventSlug,
  searchEvents,
  scoreMatch,
} from '@/lib/polymarket';

function pickFromEvent(markets: MarketData[], preferredSlug?: string): NextResponse {
  // If the pasted URL named a specific market within the event, return that one
  if (preferredSlug) {
    const exact = markets.find(m => m.slug === preferredSlug);
    if (exact) return NextResponse.json(exact);
  }
  if (markets.length === 1) return NextResponse.json(markets[0]);
  const active = markets.filter(m => m.active && !m.closed);
  const choices = active.length > 0 ? active : markets;
  if (choices.length === 1) return NextResponse.json(choices[0]);
  return NextResponse.json({ choices });
}

async function searchBestEventSlug(query: string): Promise<string | null> {
  // Search both default (active-biased) and resolved events, then dedupe
  const [general, resolved] = await Promise.all([
    searchEvents(query),
    searchEvents(query, 'resolved'),
  ]);
  const seen = new Set<string>();
  const events = [...general, ...resolved].filter(e =>
    seen.has(e.slug) ? false : (seen.add(e.slug), true)
  );

  let best: { slug: string; score: number } | null = null;
  for (const e of events) {
    const score = Math.max(
      scoreMatch(query, e.title),
      ...e.markets.map(m => scoreMatch(query, m.question))
    );
    if (!best || score > best.score) best = { slug: e.slug, score };
  }
  return best && best.score >= 0.5 ? best.slug : null;
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

  const looksLikeSlug = q.includes('polymarket.com') || q.includes('/') || !q.trim().includes(' ');
  const candidates = looksLikeSlug ? extractSlugCandidates(q) : [];

  if (looksLikeSlug) {
    // Most specific segment first: try it as a market slug...
    for (const slug of candidates) {
      const market = await fetchMarketBySlug(slug);
      if (market) return NextResponse.json(market);
    }
    // ...then as an event slug (Polymarket URLs are usually event slugs)
    for (const slug of candidates) {
      const markets = await fetchMarketsFromEventSlug(slug);
      if (markets && markets.length > 0) return pickFromEvent(markets, candidates[0]);
    }
  }

  // Free-text input, or a slug that no longer resolves — fall back to search
  const searchQuery = (looksLikeSlug ? candidates[0].replace(/-/g, ' ') : q).trim();
  if (searchQuery) {
    const eventSlug = await searchBestEventSlug(searchQuery);
    if (eventSlug) {
      const markets = await fetchMarketsFromEventSlug(eventSlug);
      if (markets && markets.length > 0) return pickFromEvent(markets);
    }
  }

  return NextResponse.json(
    { error: `No market found for "${q}". Try pasting the full Polymarket URL.` },
    { status: 404 }
  );
}
