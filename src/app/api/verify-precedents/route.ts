import { NextRequest, NextResponse } from 'next/server';
import { searchEvents, scoreMatch } from '@/lib/polymarket';

export interface PrecedentInput {
  q: string;
  outcome: string;
  lesson: string;
}

export interface PrecedentResult extends PrecedentInput {
  url: string | null;
}

// Any 4-digit number in the query (years, mostly) must appear somewhere in the
// candidate's text — prevents linking e.g. a 2024 market for a 2020 precedent.
function requiredTermsPresent(query: string, candidateText: string): boolean {
  const numbers = query.match(/\b\d{4}\b/g) ?? [];
  return numbers.every(n => candidateText.includes(n));
}

interface Candidate {
  url: string;
  score: number;
  text: string;
}

async function findPrecedentUrl(question: string): Promise<string | null> {
  // Precedents are usually resolved markets, but the default search is biased
  // toward active ones — query both and dedupe by event slug.
  const [general, resolved] = await Promise.all([
    searchEvents(question),
    searchEvents(question, 'resolved'),
  ]);
  const seen = new Set<string>();
  const events = [...general, ...resolved].filter(e =>
    seen.has(e.slug) ? false : (seen.add(e.slug), true)
  );

  let best: Candidate | null = null;
  for (const e of events) {
    let candidate: Candidate = {
      url: `https://polymarket.com/event/${e.slug}`,
      score: scoreMatch(question, e.title),
      text: `${e.title} ${e.slug}`,
    };
    // A market question inside the event may match better than the event title;
    // if so, deep-link that market
    for (const m of e.markets) {
      const score = scoreMatch(question, m.question);
      if (score > candidate.score) {
        candidate = {
          url:
            m.slug && m.slug !== e.slug
              ? `https://polymarket.com/event/${e.slug}/${m.slug}`
              : `https://polymarket.com/event/${e.slug}`,
          score,
          text: `${m.question} ${e.title} ${e.slug} ${m.slug}`,
        };
      }
    }
    if (!requiredTermsPresent(question, candidate.text)) continue;
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best && best.score >= 0.5 ? best.url : null;
}

export async function POST(req: NextRequest) {
  const { precedents } = await req.json() as { precedents: PrecedentInput[] };

  if (!Array.isArray(precedents) || precedents.length === 0) {
    return NextResponse.json([]);
  }

  const results: PrecedentResult[] = await Promise.all(
    precedents.map(async (p) => ({ ...p, url: await findPrecedentUrl(p.q) }))
  );

  return NextResponse.json(results);
}
