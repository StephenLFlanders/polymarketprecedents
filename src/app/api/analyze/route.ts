import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { MarketData } from '@/lib/polymarket';

const client = new Anthropic();

function buildPrompt(market: MarketData): string {
  const priceInfo = market.outcomePrices.length > 0 && market.outcomes.length > 0
    ? market.outcomes.map((o, i) => `${o}: ${Math.round(parseFloat(market.outcomePrices[i] ?? '0') * 100)}¢`).join(' | ')
    : '';

  return `You are a Polymarket resolution expert with encyclopedic knowledge of how Polymarket resolves prediction markets, including historical precedents, UMA dispute resolutions, and edge cases that have surprised traders.

Analyze the following Polymarket market in detail. A trader is relying on your analysis to understand exactly how this market will resolve.

---
MARKET QUESTION: ${market.question}

RESOLUTION CRITERIA / DESCRIPTION:
${market.description || '(No description provided — analyze based on the question text alone)'}

CATEGORY: ${market.category || 'Unknown'}
OUTCOMES: ${market.outcomes.join(', ')}
${priceInfo ? `CURRENT PRICES: ${priceInfo}` : ''}
${market.endDate ? `END DATE: ${market.endDate}` : ''}
${market.closed ? `STATUS: CLOSED/RESOLVED` : market.active ? 'STATUS: ACTIVE' : 'STATUS: Unknown'}
---

Provide a tight, high-signal analysis with exactly these sections. Be concise — traders want clarity, not length.

## Plain English Summary
1-2 sentences max. What is this market asking and what's the key thing that determines YES vs NO?

## ✅ YES — What Qualifies
Tight bullet list. Primary requirement first, then any non-obvious edge cases. Include the specific timing trigger (announcement date? event date? filing date?).

## ❌ NO — What Qualifies
Tight bullet list. Lead with the most surprising ways this resolves NO — things that look like YES but aren't. Timing traps first.

## ⚠️ Key Gotchas & Traps
2-4 bullets max. Only the non-obvious stuff a casual trader would miss:
- Announcement vs. event date traps
- Source of truth requirements
- Deadline interpretation edge cases
- Wording that means something different than it appears

## 📚 Historical Precedents
List only real, specific Polymarket markets that are directly relevant. For each one, format as a markdown link using your best guess at the Polymarket slug:
[Market question text](https://polymarket.com/event/your-best-guess-at-the-slug)
Then in 1 sentence: how it resolved and what it teaches. If you don't know of directly relevant precedents, say so — don't invent them.

Be specific and concise. Prioritize the non-obvious.`;
}

export async function POST(req: NextRequest) {
  const { market } = await req.json() as { market: MarketData };

  if (!market?.question) {
    return new Response('Missing market data', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          messages: [{ role: 'user', content: buildPrompt(market) }],
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const data = JSON.stringify({ text: chunk.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
