'use client';

import { useState, FormEvent } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface Props {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const EXAMPLES = [
  'microstrategy-sells-bitcoin-by-may-31',
  'https://polymarket.com/event/will-the-fed-cut-rates-in-september',
  'will trump be indicted',
];

export default function MarketSearch({ onSearch, isLoading }: Props) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch(query.trim());
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste a Polymarket URL or market slug..."
            disabled={isLoading}
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-12 pr-36 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all text-base disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze'
            )}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-gray-600">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuery(ex);
              onSearch(ex);
            }}
            disabled={isLoading}
            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors disabled:opacity-50 truncate max-w-[200px]"
          >
            {ex.replace('https://polymarket.com/event/', '')}
          </button>
        ))}
      </div>
    </div>
  );
}
