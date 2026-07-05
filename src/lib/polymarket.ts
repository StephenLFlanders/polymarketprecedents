export interface MarketData {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: string[];
  category: string;
  slug: string;
  eventSlug: string | null;
  active: boolean;
  closed: boolean;
  volume: string;
  liquidity: string;
  startDate: string;
  endDate: string | null;
  resolvedBy: string | null;
  resolution: string | null;
}

export interface EventSearchResult {
  slug: string;
  title: string;
  markets: Array<{ question: string; slug: string }>;
}

// polymarket.com pages live at /event/{eventSlug}, with individual markets of a
// multi-market event at /event/{eventSlug}/{marketSlug}. A market slug alone is
// NOT a valid event path (404 whenever the two slugs differ), but
// /market/{marketSlug} redirects to the correct event page.
export function getMarketUrl(market: Pick<MarketData, 'slug' | 'eventSlug'>): string {
  if (market.eventSlug) {
    return market.eventSlug === market.slug
      ? `https://polymarket.com/event/${market.eventSlug}`
      : `https://polymarket.com/event/${market.eventSlug}/${market.slug}`;
  }
  return `https://polymarket.com/market/${market.slug}`;
}

// A pasted URL can be /event/{eventSlug} or /event/{eventSlug}/{marketSlug}.
// Return the path segments that could identify the market, most specific first.
export function extractSlugCandidates(input: string): string[] {
  const trimmed = input.trim();
  let parts: string[] = [];

  if (trimmed.includes('polymarket.com')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed);
      parts = url.pathname.split('/').filter(Boolean);
    } catch {
      // Fall through
    }
  }

  if (parts.length === 0 && trimmed.includes('/')) {
    parts = trimmed.split('/').filter(Boolean);
  }

  if (parts.length === 0) {
    return [trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')];
  }

  const segments = parts.filter(p => !['event', 'market', 'markets', 'sports'].includes(p));
  return segments.slice(-2).reverse();
}

export async function fetchMarketBySlug(slug: string): Promise<MarketData | null> {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return normalizeMarket(data[0]);
}

export async function fetchMarketsFromEventSlug(slug: string): Promise<MarketData[] | null> {
  const url = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const event = data[0] as Record<string, unknown>;
  const markets = Array.isArray(event.markets) ? event.markets : [];
  if (markets.length === 0) return null;
  const eventSlug = String(event.slug ?? slug);
  return markets.map(m => normalizeMarket(m as Record<string, unknown>, eventSlug));
}

// The gamma /markets and /events endpoints do NOT support a `search` param —
// it is silently ignored and they return an arbitrary default listing.
// Real text search goes through /public-search (what polymarket.com itself uses).
export async function searchEvents(
  query: string,
  status?: 'active' | 'resolved'
): Promise<EventSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit_per_type: '10' });
  if (status) params.set('events_status', status);
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/public-search?${params}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    return events
      .map((e: Record<string, unknown>) => ({
        slug: String(e.slug ?? ''),
        title: String(e.title ?? ''),
        markets: Array.isArray(e.markets)
          ? e.markets.map((m: Record<string, unknown>) => ({
              question: String(m.question ?? ''),
              slug: String(m.slug ?? ''),
            }))
          : [],
      }))
      .filter((e: EventSearchResult) => e.slug);
  } catch {
    return [];
  }
}

// Fraction of the query's meaningful words that appear in the candidate text.
export function scoreMatch(query: string, candidate: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return 0;
  const c = candidate.toLowerCase();
  return words.filter(w => c.includes(w)).length / words.length;
}

// Gamma returns outcomes/outcomePrices as JSON-encoded strings, e.g.
// "[\"Yes\", \"No\"]" — handle both that and plain arrays.
function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Not JSON
    }
  }
  return [];
}

function normalizeMarket(raw: Record<string, unknown>, eventSlug?: string): MarketData {
  const events = Array.isArray(raw.events) ? (raw.events as Array<Record<string, unknown>>) : [];
  const parentSlug = eventSlug ?? (events.length > 0 ? String(events[0]?.slug ?? '') : '');
  const outcomes = parseJsonArray(raw.outcomes);

  return {
    id: String(raw.id ?? ''),
    conditionId: String(raw.conditionId ?? raw.condition_id ?? raw.id ?? ''),
    question: String(raw.question ?? ''),
    description: String(raw.description ?? raw.rules ?? ''),
    outcomes: outcomes.length > 0 ? outcomes : ['Yes', 'No'],
    outcomePrices: parseJsonArray(raw.outcomePrices),
    category: String(raw.category ?? raw.tags ?? ''),
    slug: String(raw.slug ?? ''),
    eventSlug: parentSlug || null,
    active: Boolean(raw.active),
    closed: Boolean(raw.closed),
    volume: String(raw.volume ?? '0'),
    liquidity: String(raw.liquidity ?? '0'),
    startDate: String(raw.startDate ?? raw.start_date ?? ''),
    endDate: raw.endDate ? String(raw.endDate) : raw.end_date ? String(raw.end_date) : null,
    resolvedBy: raw.resolvedBy ? String(raw.resolvedBy) : null,
    resolution: raw.resolution ? String(raw.resolution) : null,
  };
}
