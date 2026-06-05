'use client';

import { useState } from 'react';
import MarketSearch from '@/components/MarketSearch';
import MarketAnalysis from '@/components/MarketAnalysis';
import { MarketData } from '@/lib/polymarket';

export default function Home() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setMarket(null);
    setAnalysis('');
    setIsStreaming(false);

    try {
      const marketRes = await fetch(`/api/market?q=${encodeURIComponent(query)}`);
      if (!marketRes.ok) {
        const err = await marketRes.json();
        throw new Error(err.error || 'Market not found');
      }
      const marketData: MarketData = await marketRes.json();
      setMarket(marketData);
      setIsLoading(false);

      setIsStreaming(true);
      const analysisRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: marketData }),
      });

      if (!analysisRes.ok || !analysisRes.body) {
        throw new Error('Failed to start analysis');
      }

      const reader = analysisRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          const data = event.slice(6);
          if (data === '[DONE]') {
            setIsStreaming(false);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) setAnalysis(prev => prev + parsed.text);
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
      setIsStreaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
            Powered by AI
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Polymarket{' '}
            <span className="text-emerald-400">Precedents</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto">
            Understand exactly how a market resolves before you trade.
            See the rules, edge cases, and historical precedents — like smart traders do.
          </p>
          <p className="text-gray-600 text-sm mt-3">
            Inspired by the MicroStrategy Bitcoin case: they <em>did</em> sell — but NO won.
          </p>
        </div>

        <MarketSearch onSearch={handleSearch} isLoading={isLoading || isStreaming} />

        {error && (
          <div className="mt-6 p-4 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <MarketAnalysis
          market={market}
          analysis={analysis}
          isStreaming={isStreaming}
          isLoading={isLoading}
        />

        {!market && !isLoading && (
          <div className="mt-16 text-center text-gray-700 text-sm">
            <p>Paste any Polymarket URL or market slug above to get started.</p>
          </div>
        )}
      </div>
    </main>
  );
}
