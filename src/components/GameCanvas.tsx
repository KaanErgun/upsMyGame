import { useRef, useEffect } from 'react';
import { GameEngine } from '../game/engine';
import type { GameCallbacks } from '../game/engine';
import type { RenderSnapshot, WeaponState } from '../game/types';

interface GameCanvasProps {
  onScoreUpdate: (score: number, combo: number, multiplier: number) => void;
  onHealthUpdate: (health: number, maxHealth: number) => void;
  onEnergyUpdate: (energy: number, maxEnergy: number) => void;
  onGameOver: (snapshot: RenderSnapshot) => void;
  onPhaseChange: (phase: string) => void;
  onWeaponsUpdate: (weapons: WeaponState) => void;
  engineRef: React.MutableRefObject<GameEngine | null>;
  isPlaying: boolean;
}

export default function GameCanvas({
  onScoreUpdate,
  onHealthUpdate,
  onEnergyUpdate,
  onGameOver,
  onPhaseChange,
  onWeaponsUpdate,
  engineRef,
  isPlaying,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacksRef = useRef<GameCallbacks>({
    onScoreUpdate,
    onHealthUpdate,
    onEnergyUpdate,
    onGameOver,
    onPhaseChange,
    onWeaponsUpdate,
  });

  useEffect(() => {
    callbacksRef.current = {
      onScoreUpdate,
      onHealthUpdate,
      onEnergyUpdate,
      onGameOver,
      onPhaseChange,
      onWeaponsUpdate,
    };
  }, [onScoreUpdate, onHealthUpdate, onEnergyUpdate, onGameOver, onPhaseChange, onWeaponsUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const proxyCallbacks: GameCallbacks = {
      onScoreUpdate: (s, c, m) => callbacksRef.current.onScoreUpdate(s, c, m),
      onHealthUpdate: (h, m) => callbacksRef.current.onHealthUpdate(h, m),
      onEnergyUpdate: (e, m) => callbacksRef.current.onEnergyUpdate(e, m),
      onGameOver: (snap) => callbacksRef.current.onGameOver(snap),
      onPhaseChange: (p) => callbacksRef.current.onPhaseChange(p),
      onWeaponsUpdate: (w) => callbacksRef.current.onWeaponsUpdate(w),
    };

    const engine = new GameEngine(canvas, proxyCallbacks);
    engineRef.current = engine;

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      engine.destroy();
      window.removeEventListener('resize', handleResize);
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: isPlaying ? 'none' : 'default' }}
    />
  );
}
