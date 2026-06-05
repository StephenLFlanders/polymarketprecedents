import { NextRequest, NextResponse } from 'next/server';

interface LinkInput {
  text: string;
  slug: string;
}

interface LinkResult {
  text: string;
  slug: string | null;
  verified: boolean;
}

async function verifySlug(slug: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}&limit=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function searchForSlug(query: string): Promise<string | null> {
  for (const extra of ['', '&closed=true']) {
    try {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?search=${encodeURIComponent(query)}&limit=3${extra}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].slug) {
        return data[0].slug as string;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { links } = await req.json() as { links: LinkInput[] };

  if (!Array.isArray(links) || links.length === 0) {
    return NextResponse.json([]);
  }

  const results: LinkResult[] = await Promise.all(
    links.map(async ({ text, slug }) => {
      // 1. Try the slug Claude guessed
      if (await verifySlug(slug)) {
        return { text, slug, verified: true };
      }

      // 2. Search by the link text (market title)
      const byTitle = await searchForSlug(text);
      if (byTitle) return { text, slug: byTitle, verified: true };

      // 3. Search by slug converted to words
      const bySlugWords = await searchForSlug(slug.replace(/-/g, ' '));
      if (bySlugWords) return { text, slug: bySlugWords, verified: true };

      return { text, slug: null, verified: false };
    })
  );

  return NextResponse.json(results);
}
