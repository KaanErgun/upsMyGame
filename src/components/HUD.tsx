import { Heart, Zap, Volume2, VolumeX, Crosshair, Shield, Waves } from 'lucide-react';
import type { WeaponState } from '../game/types';

interface HUDProps {
  score: number;
  combo: number;
  multiplier: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  weapons: WeaponState | null;
  onMuteToggle: () => void;
  isMuted: boolean;
  onPause: () => void;
}

export default function HUD({
  score,
  combo,
  multiplier,
  health,
  maxHealth,
  energy,
  maxEnergy,
  weapons,
  onMuteToggle,
  isMuted,
  onPause,
}: HUDProps) {
  const energyRatio = energy / maxEnergy;
  const energyColor = energyRatio > 0.6 ? 'bg-sky-400' : energyRatio > 0.3 ? 'bg-yellow-400' : 'bg-red-400';
  const energyGlow = energyRatio > 0.6 ? 'shadow-[0_0_8px_rgba(56,189,248,0.4)]' : energyRatio > 0.3 ? 'shadow-[0_0_8px_rgba(250,204,21,0.3)]' : 'shadow-[0_0_8px_rgba(239,68,68,0.4)]';

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <div className="text-3xl sm:text-4xl font-bold text-white tracking-wider tabular-nums"
             style={{ textShadow: '0 0 20px rgba(56, 189, 248, 0.5)' }}>
          {score.toLocaleString()}
        </div>
        {combo > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <Zap size={16} className={`${
              combo >= 20 ? 'text-cyan-400' :
              combo >= 10 ? 'text-green-400' :
              combo >= 5 ? 'text-sky-400' : 'text-slate-400'
            }`} />
            <span className={`text-sm font-semibold ${
              combo >= 20 ? 'text-cyan-400' :
              combo >= 10 ? 'text-green-400' :
              combo >= 5 ? 'text-sky-400' : 'text-slate-400'
            }`}>
              {combo}x COMBO
            </span>
            {multiplier > 1 && (
              <span className="text-xs text-slate-500 ml-1">
                ({multiplier.toFixed(1)}x)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3">
        <button
          onClick={onMuteToggle}
          className="pointer-events-auto p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          {isMuted ? (
            <VolumeX size={18} className="text-slate-500" />
          ) : (
            <Volume2 size={18} className="text-slate-400" />
          )}
        </button>
        <button
          onClick={onPause}
          className="pointer-events-auto p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex gap-0.5">
            <div className="w-1 h-4 bg-slate-400 rounded-sm" />
            <div className="w-1 h-4 bg-slate-400 rounded-sm" />
          </div>
        </button>
      </div>

      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 space-y-3">
        <div className="flex items-center gap-2">
          <Heart size={18} className={`${
            health <= 2 ? 'text-red-500 animate-pulse' : 'text-sky-400'
          }`} />
          <div className="flex gap-1">
            {Array.from({ length: maxHealth }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < health
                    ? health <= 2
                      ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                      : 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.4)]'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Zap size={16} className={`${
            energyRatio > 0.6 ? 'text-sky-400' : energyRatio > 0.3 ? 'text-yellow-400' : 'text-red-400'
          }`} />
          <div className="w-24 h-2 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-150 ${energyColor} ${energyGlow}`}
              style={{ width: `${energyRatio * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 tabular-nums w-8">
            {Math.floor(energy)}
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <Crosshair size={10} className="text-orange-400/60" />
          <span>LMB / SPACE - Blast</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <Shield size={10} className="text-purple-400/60" />
          <span>RMB / SHIFT - Slam</span>
        </div>
        {weapons?.pulseUnlocked && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <Waves size={10} className="text-purple-300/60" />
            <span>MMB / Q - Pulse</span>
          </div>
        )}
        <p className="text-[10px] text-slate-700 mt-1">
          MOUSE or A/D to rotate
        </p>
      </div>

      {weapons && (
        <div className="absolute top-14 left-4 sm:top-16 sm:left-6 space-y-1.5">
          <WeaponPip label="SHD" level={weapons.shieldLevel} color="sky" />
          <WeaponPip label="BLT" level={weapons.blastLevel} color="orange" />
          <WeaponPip label="SLM" level={weapons.slamLevel} color="purple" />
          {weapons.pulseUnlocked && (
            <WeaponPip label="PLS" level={weapons.pulseLevel} color="violet" />
          )}
        </div>
      )}
    </div>
  );
}

function WeaponPip({ label, level, color }: { label: string; level: number; color: string }) {
  const colorMap: Record<string, { text: string; filled: string; empty: string }> = {
    sky: { text: 'text-sky-400', filled: 'bg-sky-400', empty: 'bg-slate-700' },
    orange: { text: 'text-orange-400', filled: 'bg-orange-400', empty: 'bg-slate-700' },
    purple: { text: 'text-purple-400', filled: 'bg-purple-400', empty: 'bg-slate-700' },
    violet: { text: 'text-violet-300', filled: 'bg-violet-300', empty: 'bg-slate-700' },
  };
  const c = colorMap[color] || colorMap.sky;

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[9px] font-bold ${c.text} w-6`}>{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i < level ? c.filled : c.empty}`}
          />
        ))}
      </div>
    </div>
  );
}
