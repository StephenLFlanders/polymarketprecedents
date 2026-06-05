'use client';

import { MarketData } from '@/lib/polymarket';
import { Clock, TrendingUp } from 'lucide-react';

interface Props {
  markets: MarketData[];
  onSelect: (market: MarketData) => void;
}

function formatDate(d: string | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

function formatVolume(v: string): string {
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function MarketPicker({ markets, onSelect }: Props) {
  return (
    <div className="mt-8">
      <p className="text-gray-400 text-sm mb-4">
        This event has multiple markets — pick the one you want to analyze:
      </p>
      <div className="space-y-2">
        {markets.map((m) => {
          const yesPrice = m.outcomePrices[0] ? Math.round(parseFloat(m.outcomePrices[0]) * 100) : null;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className="w-full text-left bg-[#141414] border border-white/[0.08] hover:border-emerald-500/30 hover:bg-[#181818] rounded-xl p-4 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm leading-snug group-hover:text-emerald-400 transition-colors">
                    {m.question}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    {m.endDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(m.endDate)}
                      </span>
                    )}
                    {m.volume && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {formatVolume(m.volume)}
                      </span>
                    )}
                    {m.closed && <span className="text-gray-700">Resolved</span>}
                    {m.active && !m.closed && <span className="text-emerald-700">Active</span>}
                  </div>
                </div>
                {yesPrice !== null && (
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-emerald-400">{yesPrice}¢</div>
                    <div className="text-xs text-gray-600">YES</div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
