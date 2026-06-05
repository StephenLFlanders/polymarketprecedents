'use client';

import { MarketData } from '@/lib/polymarket';
import MarkdownRenderer from './MarkdownRenderer';
import { TrendingUp, Clock, ExternalLink, Loader2 } from 'lucide-react';

interface Props {
  market: MarketData | null;
  analysis: string;
  isStreaming: boolean;
  isLoading: boolean;
}

function formatVolume(v: string): string {
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPrice(p: string): string {
  const n = parseFloat(p);
  if (isNaN(n)) return p;
  return `${Math.round(n * 100)}¢`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function MarketAnalysis({ market, analysis, isStreaming, isLoading }: Props) {
  if (isLoading && !market) {
    return (
      <div className="mt-8 flex items-center justify-center gap-3 text-gray-500 py-12">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Finding market...</span>
      </div>
    );
  }

  if (!market) return null;

  const yesPrice = market.outcomePrices[0] ? parseFloat(market.outcomePrices[0]) : null;
  const noPrice = market.outcomePrices[1] ? parseFloat(market.outcomePrices[1]) : null;

  return (
    <div className="mt-8 space-y-4">
      <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {market.closed ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium">Resolved</span>
              ) : market.active ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-medium border border-emerald-800/50">Active</span>
              ) : null}
              {market.category && (
                <span className="text-xs text-gray-600">{market.category}</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white leading-tight mb-3">
              {market.question}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              {market.volume && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Volume: <span className="text-gray-300">{formatVolume(market.volume)}</span></span>
                </div>
              )}
              {market.endDate && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Closes: <span className="text-gray-300">{formatDate(market.endDate)}</span></span>
                </div>
              )}
              {market.slug && (
                <a
                  href={`https://polymarket.com/event/${market.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-gray-500 hover:text-emerald-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View on Polymarket</span>
                </a>
              )}
            </div>
          </div>

          {(yesPrice !== null || noPrice !== null) && (
            <div className="flex gap-3 flex-shrink-0">
              {yesPrice !== null && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{formatPrice(market.outcomePrices[0])}</div>
                  <div className="text-xs text-gray-600 mt-0.5">YES</div>
                </div>
              )}
              {noPrice !== null && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{formatPrice(market.outcomePrices[1])}</div>
                  <div className="text-xs text-gray-600 mt-0.5">NO</div>
                </div>
              )}
            </div>
          )}
        </div>

        {market.description && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Resolution Criteria</div>
            <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
              {market.description.replace(/\n+/g, ' ').trim()}
            </p>
          </div>
        )}
      </div>

      {(analysis || isStreaming) && (
        <div className="bg-[#141414] border border-white/[0.08] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">AI Analysis</h3>
            {isStreaming && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Analyzing...
              </div>
            )}
          </div>

          {analysis ? (
            <MarkdownRenderer content={analysis} />
          ) : (
            <div className="flex items-center gap-3 text-gray-600 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Generating analysis...</span>
            </div>
          )}

          {isStreaming && analysis && (
            <span className="inline-block w-0.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      )}
    </div>
  );
}
