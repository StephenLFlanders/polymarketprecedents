import { NextRequest, NextResponse } from 'next/server';

export interface PrecedentInput {
  q: string;
  outcome: string;
  lesson: string;
}

export interface PrecedentResult extends PrecedentInput {
  url: string | null;
}

async function searchForSlug(query: string, closed = false): Promise<string | null> {
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

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (queryWords.length === 0) return null;

    // Score each result by what fraction of query words appear in the market question
    let bestSlug: string | null = null;
    let bestScore = 0;

    for (const m of data) {
      const q = String(m.question ?? '').toLowerCase();
      const matched = queryWords.filter(w => q.includes(w)).length;
      const score = matched / queryWords.length;
      if (score > bestScore) {
        bestScore = score;
        bestSlug = m.slug ? String(m.slug) : null;
      }
    }

    // Require at least 50% of words to match — no fallback to unrelated markets
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
      // Search active markets first, then closed/resolved
      const slug = (await searchForSlug(p.q)) ?? (await searchForSlug(p.q, true));
      return {
        ...p,
        url: slug ? `https://polymarket.com/event/${slug}` : null,
      };
    })
  );

  return NextResponse.json(results);
}
