export interface MarketData {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: string[];
  category: string;
  slug: string;
  active: boolean;
  closed: boolean;
  volume: string;
  liquidity: string;
  startDate: string;
  endDate: string | null;
  resolvedBy: string | null;
  resolution: string | null;
}

function extractSlug(input: string): string {
  const trimmed = input.trim();

  if (trimmed.includes('polymarket.com')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1];
    } catch {
      // Fall through
    }
  }

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').filter(Boolean);
    return parts[parts.length - 1];
  }

  return trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export async function fetchMarketBySlug(slug: string): Promise<MarketData | null> {
  const url = `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return normalizeMarket(data[0]);
}

export async function searchMarkets(query: string, limit = 5): Promise<MarketData[]> {
  const url = `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(query)}&limit=${limit}&active=true`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeMarket);
}

export async function resolveMarketQuery(query: string): Promise<MarketData> {
  const trimmed = query.trim();
  const isUrl = trimmed.includes('polymarket.com') || trimmed.includes('/');
  const slug = extractSlug(trimmed);

  // Always try the extracted slug first
  const bySlug = await fetchMarketBySlug(slug);
  if (bySlug) return bySlug;

  // If input was a URL/slug, don't fall back to fuzzy search — the market likely doesn't exist
  if (isUrl) {
    throw new Error(`Market not found for slug "${slug}". The market may have been removed or the URL may be incorrect.`);
  }

  // For free-text queries, try search
  const results = await searchMarkets(trimmed, 5);
  // Only return a search result if the question roughly matches the query
  const queryWords = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const match = results.find(m => {
    const q = m.question.toLowerCase();
    return queryWords.some(w => q.includes(w));
  });
  if (match) return match;

  throw new Error(`No market found for: "${trimmed}". Try pasting the full Polymarket URL.`);
}

function normalizeMarket(raw: Record<string, unknown>): MarketData {
  return {
    id: String(raw.id ?? ''),
    conditionId: String(raw.conditionId ?? raw.condition_id ?? raw.id ?? ''),
    question: String(raw.question ?? ''),
    description: String(raw.description ?? raw.rules ?? ''),
    outcomes: Array.isArray(raw.outcomes) ? raw.outcomes.map(String) : ['Yes', 'No'],
    outcomePrices: Array.isArray(raw.outcomePrices) ? raw.outcomePrices.map(String) : [],
    category: String(raw.category ?? raw.tags ?? ''),
    slug: String(raw.slug ?? ''),
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
