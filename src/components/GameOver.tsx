import { useState, useEffect } from 'react';
import { RotateCcw, Trophy, Home, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RenderSnapshot } from '../game/types';
import { FIXED_DT } from '../game/constants';

interface GameOverProps {
  snapshot: RenderSnapshot;
  onRestart: () => void;
  onMenu: () => void;
  onShowLeaderboard: () => void;
}

export default function GameOver({ snapshot, onRestart, onMenu, onShowLeaderboard }: GameOverProps) {
  const [animIn, setAnimIn] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const score = snapshot.score;
  const survivalSecs = Math.floor(score.survivalTicks * FIXED_DT);
  const mins = Math.floor(survivalSecs / 60);
  const secs = survivalSecs % 60;

  useEffect(() => {
    requestAnimationFrame(() => setAnimIn(true));
    checkHighScore();
  }, []);

  async function checkHighScore() {
    if (!supabase) return;
    const { data } = await supabase
      .from('leaderboard')
      .select('score')
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data || score.total > data.score) {
      setIsNewHighScore(true);
    }
  }

  async function submitScore() {
    if (!playerName.trim() || submitting || !supabase) return;
    setSubmitting(true);
    await supabase.from('leaderboard').insert({
      player_name: playerName.trim().slice(0, 20),
      score: score.total,
      survival_seconds: survivalSecs,
      max_combo: score.maxCombo,
      perfect_count: score.perfectCount,
      good_count: score.goodCount,
      scrape_count: score.scrapeCount,
      miss_count: score.missCount,
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  const totalDeflects = score.perfectCount + score.goodCount + score.scrapeCount;
  const accuracy = totalDeflects + score.missCount > 0
    ? Math.round((totalDeflects / (totalDeflects + score.missCount)) * 100)
    : 0;

  return (
    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
      animIn ? 'opacity-100' : 'opacity-0'
    }`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className={`relative z-10 w-full max-w-sm mx-4 bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 sm:p-8 transform transition-all duration-500 ${
        animIn ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
      }`}>
        {isNewHighScore && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full">
            <span className="text-xs font-bold text-amber-400 tracking-wider">NEW HIGH SCORE</span>
          </div>
        )}

        <h2 className="text-center text-2xl font-bold text-white mb-1">GAME OVER</h2>

        <div className="text-center mb-6">
          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tabular-nums">
            {score.total.toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatBox label="SURVIVAL" value={`${mins}:${secs.toString().padStart(2, '0')}`} />
          <StatBox label="MAX COMBO" value={`${score.maxCombo}x`} />
          <StatBox label="ACCURACY" value={`${accuracy}%`} />
          <StatBox label="DEFLECTS" value={`${totalDeflects}`} />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <MiniStat label="BLAST KILLS" value={score.blastKills} color="text-orange-400" />
          <MiniStat label="RICOCHETS" value={score.ricochetKills} color="text-cyan-400" />
          <MiniStat label="SLAMS" value={score.slamsUsed} color="text-purple-400" />
        </div>

        <div className="flex justify-between text-xs text-slate-500 mb-6 px-1">
          <span className="text-cyan-400">{score.perfectCount} perfect</span>
          <span className="text-green-400">{score.goodCount} good</span>
          <span className="text-yellow-400">{score.scrapeCount} scrape</span>
          <span className="text-red-400">{score.missCount} miss</span>
        </div>

        {!submitted ? (
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Your name..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitScore()}
                maxLength={20}
                className="flex-1 px-3 py-2 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white text-sm
                           placeholder-slate-500 focus:outline-none focus:border-sky-400/50 transition-colors"
              />
              <button
                onClick={submitScore}
                disabled={!playerName.trim() || submitting}
                className="px-4 py-2 bg-sky-500/20 border border-sky-400/30 rounded-lg text-sky-300 text-sm font-medium
                           hover:bg-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                SAVE
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-green-400/80 mb-4">Score saved to leaderboard</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onRestart}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-sky-500/10 border border-sky-400/30 rounded-xl
                       text-sky-100 font-medium hover:bg-sky-500/20 transition-all"
          >
            <RotateCcw size={16} />
            RETRY
          </button>
          <button
            onClick={onShowLeaderboard}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-slate-600/30 rounded-xl
                       text-slate-300 hover:bg-white/10 transition-all"
          >
            <Trophy size={16} />
          </button>
          <button
            onClick={onMenu}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-white/5 border border-slate-600/30 rounded-xl
                       text-slate-300 hover:bg-white/10 transition-all"
          >
            <Home size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <p className="text-[10px] text-slate-500 tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-2 text-center">
      <p className="text-[9px] text-slate-500 tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
