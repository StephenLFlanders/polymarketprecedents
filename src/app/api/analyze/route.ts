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

Provide a comprehensive analysis with exactly these sections:

## Plain English Summary
What is this market actually asking? Explain it clearly for someone who knows nothing about the topic. One concise paragraph.

## Resolution Criteria Breakdown
Dissect the resolution rules carefully. Identify:
- The primary condition(s) that trigger YES
- The exact timeframe requirement and how it's measured
- The source of truth (how will Polymarket verify? what counts as official?)
- Any ambiguous or loose language that creates uncertainty

## ✅ YES — What Qualifies
Bullet list of exactly what needs to happen for YES. Be exhaustive. Include:
- The primary requirement
- Edge cases that would still count as YES
- Timing: announcement date? event date? filing date? reporting date? What's the relevant trigger?
- Required documentation or sources

## ❌ NO — What Qualifies
Bullet list of what causes NO. This is critical. Include:
- Straightforward failure conditions
- **Surprising edge cases** — things that LOOK like YES but resolve NO
- Timing traps: things that happen before the deadline but aren't announced/reported until after
- Partial completion scenarios
- Missing documentation scenarios

## ⚠️ Key Gotchas & Traps
This is the most valuable section. What would trip up a trader who read the rules casually? Focus on:
- **Announcement vs. Event Date**: Does the market resolve based on when something was publicly announced/disclosed, or when it actually occurred?
- **Source of Truth**: What specific source does Polymarket use? Official filing? Specific news outlet? Press release? Tweet?
- **Deadline Interpretation**: How strictly is "by [date]" interpreted?
- **Partial vs. Full Completion**: Is there a threshold? Does any amount count?
- **Retroactive vs. Prospective**: Can past actions count, or only future ones?
- **Wording Traps**: Specific words in the resolution criteria that have non-obvious meanings in Polymarket context

## 📚 Historical Precedents
Reference specific similar markets and how they resolved. Include:
- Markets with similar structure (same company/entity, same type of action, similar timeframe language)
- Cases where "announcement date" ≠ "event date" and how Polymarket handled it
- UMA dispute resolutions for analogous situations
- Cases where strict source requirements were enforced
- The MicroStrategy bitcoin precedent specifically if this market involves corporate crypto sales or similar actions
- Be specific: name actual markets, outcomes, and the reasoning used

## 💡 Smart Trader Edge
What is the information edge here? What should a sharp trader be monitoring that casual traders overlook? What's the single most important thing to watch?

Write like a seasoned prediction market trader explaining this to a colleague. Be specific, concrete, and prioritize identifying the non-obvious resolution risks that determine the real edge in this market.`;
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
