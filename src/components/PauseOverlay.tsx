import { Play, Home, Volume2, VolumeX } from 'lucide-react';

interface PauseOverlayProps {
  onResume: () => void;
  onMenu: () => void;
  onMuteToggle: () => void;
  isMuted: boolean;
}

export default function PauseOverlay({ onResume, onMenu, onMuteToggle, isMuted }: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-3xl font-bold text-white tracking-wider">PAUSED</h2>
        <div className="flex flex-col gap-3 w-48">
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-2 py-3 bg-sky-500/10 border border-sky-400/30 rounded-xl
                       text-sky-100 font-medium hover:bg-sky-500/20 transition-all"
          >
            <Play size={18} />
            RESUME
          </button>
          <button
            onClick={onMuteToggle}
            className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-slate-600/30 rounded-xl
                       text-slate-300 hover:bg-white/10 transition-all"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            {isMuted ? 'UNMUTE' : 'MUTE'}
          </button>
          <button
            onClick={onMenu}
            className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-slate-600/30 rounded-xl
                       text-slate-300 hover:bg-white/10 transition-all"
          >
            <Home size={18} />
            MENU
          </button>
        </div>
      </div>
    </div>
  );
}
