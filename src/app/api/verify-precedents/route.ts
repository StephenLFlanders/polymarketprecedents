import { NextRequest, NextResponse } from 'next/server';

export interface PrecedentInput {
  q: string;
  outcome: string;
  lesson: string;
}

export interface PrecedentResult extends PrecedentInput {
  url: string | null;
}

function scoreMatch(query: string, candidate: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return 0;
  const c = candidate.toLowerCase();
  return words.filter(w => c.includes(w)).length / words.length;
}

async function searchMarketsForSlug(query: string, closed = false): Promise<string | null> {
  const params = new URLSearchParams({ search: query, limit: '10' });
  if (closed) params.set('closed', 'true');
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    let bestSlug: string | null = null;
    let bestScore = 0;
    for (const m of data) {
      const score = scoreMatch(query, String(m.question ?? ''));
      if (score > bestScore) { bestScore = score; bestSlug = m.slug ? String(m.slug) : null; }
    }
    return bestScore >= 0.5 ? bestSlug : null;
  } catch {
    return null;
  }
}

async function searchEventsForSlug(query: string, closed = false): Promise<string | null> {
  const params = new URLSearchParams({ search: query, limit: '10' });
  if (closed) params.set('closed', 'true');
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/events?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    let bestSlug: string | null = null;
    let bestScore = 0;
    for (const e of data) {
      // Score against event title and against each child market question
      const titleScore = scoreMatch(query, String(e.title ?? ''));
      const marketScore = Array.isArray(e.markets)
        ? Math.max(0, ...e.markets.map((m: Record<string, unknown>) => scoreMatch(query, String(m.question ?? ''))))
        : 0;
      const score = Math.max(titleScore, marketScore);
      if (score > bestScore) { bestScore = score; bestSlug = e.slug ? String(e.slug) : null; }
    }
    return bestScore >= 0.5 ? bestSlug : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { precedents } = await req.json() as { precedents: PrecedentInput[] };

  if (!Array.isArray(precedents) || precedents.length === 0) {
    return NextResponse.json([]);
  }

  const results: PrecedentResult[] = await Promise.all(
    precedents.map(async (p) => {
      const slug =
        (await searchMarketsForSlug(p.q)) ??
        (await searchMarketsForSlug(p.q, true)) ??
        (await searchEventsForSlug(p.q)) ??
        (await searchEventsForSlug(p.q, true));
      return {
        ...p,
        url: slug ? `https://polymarket.com/event/${slug}` : null,
      };
    })
  );

  return NextResponse.json(results);
}
