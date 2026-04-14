import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Clock, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  survival_seconds: number;
  max_combo: number;
  perfect_count: number;
  created_at: string;
}

interface LeaderboardProps {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    setAnimIn(true);
    loadEntries();
  }, []);

  async function loadEntries() {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(20);
    setEntries(data ?? []);
    setLoading(false);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const medalColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];

  return (
    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
      animIn ? 'opacity-100' : 'opacity-0'
    }`}>
      <div className="absolute inset-0 bg-gradient-radial from-slate-900/50 via-[#060a14] to-[#020408]" />

      <div className={`relative z-10 w-full max-w-lg mx-4 bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden transform transition-all duration-500 ${
        animIn ? 'scale-100' : 'scale-95'
      }`}>
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700/30">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Trophy size={20} className="text-amber-400" />
            LEADERBOARD
          </h2>
          <div className="w-9" />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-slate-500" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500">No scores yet. Be the first!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 px-4 sm:px-6 py-3 hover:bg-white/[0.02] transition-colors ${
                    i < 3 ? 'bg-white/[0.01]' : ''
                  }`}
                >
                  <div className={`w-8 text-center font-bold text-sm ${
                    i < 3 ? medalColors[i] : 'text-slate-600'
                  }`}>
                    {i < 3 ? (
                      <Trophy size={16} className="inline" />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {entry.player_name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock size={10} />
                        {formatTime(entry.survival_seconds)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Zap size={10} />
                        {entry.max_combo}x
                      </span>
                      <span className="text-[11px] text-cyan-500/60">
                        {entry.perfect_count} perfect
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-white tabular-nums">
                      {entry.score.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
