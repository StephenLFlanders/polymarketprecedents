import { NextRequest, NextResponse } from 'next/server';
import { searchEvents, scoreMatch, tokenize, EventSearchResult } from '@/lib/polymarket';

export interface PrecedentInput {
  q: string;
  outcome: string;
  lesson: string;
  search?: string;
}

export interface PrecedentResult extends PrecedentInput {
  url: string | null;
  // Diagnostic trail, visible in the browser Network tab — not rendered
  debug?: {
    query: string;
    eventsFound: number;
    bestScore: number;
    bestUrl: string | null;
  };
}

// Reject only on a genuine year conflict (e.g. a 2020 market offered for a
// 2024 precedent). Polymarket titles and slugs routinely omit the year
// entirely — a candidate that names no year cannot conflict.
function yearsCompatible(query: string, candidateText: string): boolean {
  const qYears = query.match(/\b(?:19|20)\d{2}\b/g);
  if (!qYears) return true;
  const cYears = candidateText.match(/\b(?:19|20)\d{2}\b/g);
  if (!cYears) return true;
  return qYears.some(y => cYears.includes(y));
}

interface Candidate {
  url: string;
  score: number;
  text: string;
}

// Search both default (active-biased) and resolved events, deduped by slug.
async function searchBoth(query: string): Promise<EventSearchResult[]> {
  const [general, resolved] = await Promise.all([
    searchEvents(query),
    searchEvents(query, 'resolved'),
  ]);
  const seen = new Set<string>();
  return [...general, ...resolved].filter(e =>
    seen.has(e.slug) ? false : (seen.add(e.slug), true)
  );
}

async function findPrecedentUrl(
  question: string,
  searchHint?: string
): Promise<{ url: string | null; debug: NonNullable<PrecedentResult['debug']> }> {
  // Search with the model's short search query when available — full questions
  // match poorly as search input. Fallback: the question's distinctive words,
  // numbers excluded since titles often drop dates.
  const keywords = tokenize(question).filter(w => !/^\d+$/.test(w)).slice(0, 5).join(' ');
  const query = searchHint?.trim() || keywords;
  if (!query) return { url: null, debug: { query: '', eventsFound: 0, bestScore: 0, bestUrl: null } };

  let events = await searchBoth(query);
  if (events.length === 0 && keywords && keywords !== query) {
    events = await searchBoth(keywords);
  }

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
    if (!yearsCompatible(question, candidate.text)) continue;
    if (!best || candidate.score > best.score) best = candidate;
  }

  const url = best && best.score >= 0.5 ? best.url : null;
  const debug = {
    query,
    eventsFound: events.length,
    bestScore: best ? Math.round(best.score * 100) / 100 : 0,
    bestUrl: best?.url ?? null,
  };
  console.log(
    `precedent lookup: "${query}" → ${events.length} events, best score ${debug.bestScore} (${debug.bestUrl ?? 'none'}) → ${url ? 'linked' : 'no link'}`
  );
  return { url, debug };
}

export async function POST(req: NextRequest) {
  const { precedents } = await req.json() as { precedents: PrecedentInput[] };

  if (!Array.isArray(precedents) || precedents.length === 0) {
    return NextResponse.json([]);
  }

  const results: PrecedentResult[] = await Promise.all(
    precedents.map(async (p) => {
      const { url, debug } = await findPrecedentUrl(p.q, p.search);
      return { ...p, url, debug };
    })
  );

  return NextResponse.json(results);
}
