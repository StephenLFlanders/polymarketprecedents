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
  const params = new URLSearchParams({ search: query, limit: '5' });
  if (closed) params.set('closed', 'true');
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?${params}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    // Pick best match: prefer questions containing any key word from query
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const best = data.find((m: Record<string, unknown>) =>
      queryWords.some(w => String(m.question ?? '').toLowerCase().includes(w))
    ) ?? data[0];
    return best?.slug ? String(best.slug) : null;
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
