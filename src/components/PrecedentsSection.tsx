'use client';

import { Loader2, ExternalLink } from 'lucide-react';
import { PrecedentResult } from '@/app/api/verify-precedents/route';

interface Props {
  precedents: PrecedentResult[];
  loading: boolean;
}

export default function PrecedentsSection({ precedents, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 text-sm py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Looking up precedent markets...
      </div>
    );
  }

  if (precedents.length === 0) {
    return <p className="text-gray-600 text-sm italic">No directly relevant precedents found.</p>;
  }

  return (
    <div className="space-y-2.5">
      {precedents.map((p, i) => (
        <div key={i} className="border border-white/[0.07] rounded-lg p-4 bg-[#0d0d0d]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-colors leading-snug group"
                >
                  {p.q}
                  <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-gray-300 font-medium text-sm leading-snug">{p.q}</span>
              )}
              <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">{p.lesson}</p>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5 border ${
              p.outcome === 'YES'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                : p.outcome === 'NO'
                ? 'bg-red-950 text-red-400 border-red-800/50'
                : 'bg-gray-800 text-gray-400 border-gray-700'
            }`}>
              {p.outcome}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
