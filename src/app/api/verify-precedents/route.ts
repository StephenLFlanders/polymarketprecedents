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

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function monthsIn(text: string): string[] {
  return MONTHS.filter(m => new RegExp(`\\b${m}\\b`).test(text));
}

// Recurring markets (weekly tweet counts, monthly Fed meetings) differ only by
// date, and a strong keyword match on the wrong instance is still the wrong
// market. Reject candidates whose years, month names, or day numbers conflict
// with the question's. A date part absent on either side never conflicts —
// Polymarket titles routinely omit years.
function datesCompatible(question: string, candidateText: string): boolean {
  const q = question.toLowerCase();
  const c = candidateText.toLowerCase();

  const qYears = q.match(/\b(?:19|20)\d{2}\b/g);
  const cYears = c.match(/\b(?:19|20)\d{2}\b/g);
  if (qYears && cYears && !qYears.some(y => cYears.includes(y))) return false;

  const qMonths = monthsIn(q);
  const cMonths = monthsIn(c);
  if (qMonths.length > 0 && cMonths.length > 0 && !qMonths.some(m => cMonths.includes(m))) {
    return false;
  }

  const qDays = q.match(/\b\d{1,2}\b/g);
  const cDays = c.match(/\b\d{1,2}\b/g);
  if (qDays && cDays && !qDays.some(d => cDays.includes(d))) return false;

  return true;
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
  // Two search queries: the model's short hint, plus one built from the
  // question itself with its day numbers kept — for recurring markets the
  // dates are what surface the right week's event instead of the current one.
  const days = question.match(/\b\d{1,2}\b/g) ?? [];
  const keywordQuery = [...tokenize(question).slice(0, 6), ...days.slice(0, 2)].join(' ');
  const queries = Array.from(
    new Set([searchHint?.trim(), keywordQuery].filter((s): s is string => Boolean(s)))
  );
  if (queries.length === 0) {
    return { url: null, debug: { query: '', eventsFound: 0, bestScore: 0, bestUrl: null } };
  }

  const batches = await Promise.all(queries.map(searchBoth));
  const seenAcross = new Set<string>();
  const events = batches.flat().filter(e =>
    seenAcross.has(e.slug) ? false : (seenAcross.add(e.slug), true)
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
    if (!datesCompatible(question, candidate.text)) continue;
    if (!best || candidate.score > best.score) best = candidate;
  }

  const url = best && best.score >= 0.5 ? best.url : null;
  const debug = {
    query: queries.join(' | '),
    eventsFound: events.length,
    bestScore: best ? Math.round(best.score * 100) / 100 : 0,
    bestUrl: best?.url ?? null,
  };
  console.log(
    `precedent lookup: "${debug.query}" → ${events.length} events, best score ${debug.bestScore} (${debug.bestUrl ?? 'none'}) → ${url ? 'linked' : 'no link'}`
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
