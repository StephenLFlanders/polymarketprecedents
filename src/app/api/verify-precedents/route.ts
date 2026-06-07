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

function requiredTermsPresent(query: string, candidate: string): boolean {
  // Any 4-digit number (years, IDs) in the query must appear in the candidate
  const numbers = query.match(/\b\d{4}\b/g) ?? [];
  const c = candidate.toLowerCase();
  return numbers.every(n => c.includes(n));
}

interface Candidate { slug: string; score: number; }

async function searchMarketsForCandidates(query: string, closed = false): Promise<Candidate[]> {
  const params = new URLSearchParams({ search: query, limit: '10' });
  if (closed) params.set('closed', 'true');
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((m: Record<string, unknown>) => ({
        slug: String(m.slug ?? ''),
        score: scoreMatch(query, String(m.question ?? '')),
      }))
      .filter(c => c.slug && c.score > 0);
  } catch {
    return [];
  }
}

async function searchEventsForCandidates(query: string, closed = false): Promise<Candidate[]> {
  const params = new URLSearchParams({ search: query, limit: '10' });
  if (closed) params.set('closed', 'true');
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/events?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((e: Record<string, unknown>) => {
        const titleScore = scoreMatch(query, String(e.title ?? ''));
        const marketScore = Array.isArray(e.markets)
          ? Math.max(0, ...e.markets.map((m: Record<string, unknown>) =>
              scoreMatch(query, String(m.question ?? ''))))
          : 0;
        return { slug: String(e.slug ?? ''), score: Math.max(titleScore, marketScore) };
      })
      .filter(c => c.slug && c.score > 0);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { precedents } = await req.json() as { precedents: PrecedentInput[] };

  if (!Array.isArray(precedents) || precedents.length === 0) {
    return NextResponse.json([]);
  }

  const results: PrecedentResult[] = await Promise.all(
    precedents.map(async (p) => {
      // Run all four searches in parallel, then pick the highest-scoring result
      const [activeMarkets, closedMarkets, activeEvents, closedEvents] = await Promise.all([
        searchMarketsForCandidates(p.q, false),
        searchMarketsForCandidates(p.q, true),
        searchEventsForCandidates(p.q, false),
        searchEventsForCandidates(p.q, true),
      ]);

      const all = [...activeMarkets, ...closedMarkets, ...activeEvents, ...closedEvents];
      const best = all.reduce<Candidate | null>(
        (prev, c) => (!prev || c.score > prev.score ? c : prev),
        null
      );

      const url = best && best.score >= 0.5 && requiredTermsPresent(p.q, best.slug)
        ? `https://polymarket.com/event/${best.slug}`
        : null;

      return { ...p, url };
    })
  );

  return NextResponse.json(results);
}
