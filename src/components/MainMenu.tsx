import { useState, useEffect } from 'react';
import { Play, Trophy, Volume2, VolumeX, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MainMenuProps {
  onPlay: () => void;
  onShowLeaderboard: () => void;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export default function MainMenu({ onPlay, onShowLeaderboard, isMuted, onMuteToggle }: MainMenuProps) {
  const [topScore, setTopScore] = useState<number | null>(null);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    setAnimIn(true);
    loadTopScore();
  }, []);

  async function loadTopScore() {
    if (!supabase) return;
    const { data } = await supabase
      .from('leaderboard')
      .select('score')
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setTopScore(data.score);
  }

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
      animIn ? 'opacity-100' : 'opacity-0'
    }`}>
      <div className="absolute inset-0 bg-gradient-radial from-slate-900/50 via-[#060a14] to-[#020408]" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        <div className="text-center">
          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500"
              style={{ textShadow: '0 0 60px rgba(56, 189, 248, 0.15)' }}>
            ORBIT
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-[0.3em] text-sky-400/80 -mt-1">
            DEFLECT
          </h2>
          <p className="text-sm text-slate-500 mt-3 max-w-xs mx-auto leading-relaxed">
            Defend the core. Deflect incoming threats. How long can you survive?
          </p>
        </div>

        <button
          onClick={onPlay}
          className="group relative flex items-center gap-3 px-10 py-4 bg-sky-500/10 border border-sky-400/30 rounded-2xl
                     hover:bg-sky-500/20 hover:border-sky-400/50 transition-all duration-300 hover:scale-105"
        >
          <Play size={22} className="text-sky-400 group-hover:text-white transition-colors" />
          <span className="text-lg font-semibold text-sky-100 tracking-wide">
            PLAY
          </span>
          <ChevronRight size={18} className="text-sky-400/50 group-hover:translate-x-1 transition-transform" />
          <div className="absolute inset-0 rounded-2xl bg-sky-400/5 blur-xl group-hover:bg-sky-400/10 transition-all" />
        </button>

        <button
          onClick={onShowLeaderboard}
          className="flex items-center gap-2 px-6 py-2.5 text-slate-400 hover:text-white transition-colors"
        >
          <Trophy size={16} />
          <span className="text-sm font-medium tracking-wide">LEADERBOARD</span>
        </button>

        {topScore !== null && (
          <div className="text-center">
            <p className="text-xs text-slate-600 tracking-wider">TOP SCORE</p>
            <p className="text-lg font-bold text-slate-400 tabular-nums">
              {topScore.toLocaleString()}
            </p>
          </div>
        )}

        <button
          onClick={onMuteToggle}
          className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          {isMuted ? (
            <VolumeX size={18} className="text-slate-500" />
          ) : (
            <Volume2 size={18} className="text-slate-400" />
          )}
        </button>

        <div className="absolute bottom-8 text-center">
          <p className="text-[11px] text-slate-700 tracking-wider">
            MOUSE to aim / A D or ARROWS to rotate
          </p>
        </div>
      </div>
    </div>
  );
}
