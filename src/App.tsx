import { useState, useRef, useCallback, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import MainMenu from './components/MainMenu';
import GameOver from './components/GameOver';
import Leaderboard from './components/Leaderboard';
import PauseOverlay from './components/PauseOverlay';
import Countdown from './components/Countdown';
import type { GameEngine } from './game/engine';
import type { RenderSnapshot, WeaponState } from './game/types';
import { ENERGY_START, ENERGY_MAX } from './game/constants';

type Screen = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'leaderboard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [health, setHealth] = useState(5);
  const [maxHealth, setMaxHealth] = useState(5);
  const [energy, setEnergy] = useState(ENERGY_START);
  const [maxEnergy, setMaxEnergy] = useState(ENERGY_MAX);
  const [isMuted, setIsMuted] = useState(false);
  const [gameOverSnapshot, setGameOverSnapshot] = useState<RenderSnapshot | null>(null);
  const [weapons, setWeapons] = useState<WeaponState | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const prevScreenRef = useRef<Screen>('menu');

  const handleScoreUpdate = useCallback((s: number, c: number, m: number) => {
    setScore(s);
    setCombo(c);
    setMultiplier(m);
  }, []);

  const handleHealthUpdate = useCallback((h: number, m: number) => {
    setHealth(h);
    setMaxHealth(m);
  }, []);

  const handleEnergyUpdate = useCallback((e: number, m: number) => {
    setEnergy(e);
    setMaxEnergy(m);
  }, []);

  const handleWeaponsUpdate = useCallback((w: WeaponState) => {
    setWeapons(w);
  }, []);

  const handleGameOver = useCallback((snapshot: RenderSnapshot) => {
    setGameOverSnapshot(snapshot);
    setScreen('gameover');
  }, []);

  const handlePhaseChange = useCallback(() => {}, []);

  const startGame = useCallback(() => {
    setScreen('countdown');
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setScreen('playing');
    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setHealth(5);
    setMaxHealth(5);
    setEnergy(ENERGY_START);
    setMaxEnergy(ENERGY_MAX);
    setWeapons(null);
    engineRef.current?.start();
  }, []);

  const handleRestart = useCallback(() => {
    setScreen('countdown');
    setGameOverSnapshot(null);
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
    setScreen('paused');
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resume();
    setScreen('playing');
  }, []);

  const handleMenu = useCallback(() => {
    engineRef.current?.stop();
    setScreen('menu');
    setGameOverSnapshot(null);
  }, []);

  const handleMuteToggle = useCallback(() => {
    const muted = engineRef.current?.toggleMute() ?? !isMuted;
    setIsMuted(muted);
  }, [isMuted]);

  const handleShowLeaderboard = useCallback(() => {
    prevScreenRef.current = screen === 'gameover' ? 'gameover' : 'menu';
    setScreen('leaderboard');
  }, [screen]);

  const handleLeaderboardBack = useCallback(() => {
    setScreen(prevScreenRef.current);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (screen === 'playing') handlePause();
        else if (screen === 'paused') handleResume();
        else if (screen === 'leaderboard') handleLeaderboardBack();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [screen, handlePause, handleResume, handleLeaderboardBack]);

  const isPlaying = screen === 'playing';

  return (
    <div className="fixed inset-0 bg-[#020408] overflow-hidden select-none">
      <GameCanvas
        onScoreUpdate={handleScoreUpdate}
        onHealthUpdate={handleHealthUpdate}
        onEnergyUpdate={handleEnergyUpdate}
        onGameOver={handleGameOver}
        onPhaseChange={handlePhaseChange}
        onWeaponsUpdate={handleWeaponsUpdate}
        engineRef={engineRef}
        isPlaying={isPlaying}
      />

      {screen === 'menu' && (
        <MainMenu
          onPlay={startGame}
          onShowLeaderboard={handleShowLeaderboard}
          isMuted={isMuted}
          onMuteToggle={handleMuteToggle}
        />
      )}

      {screen === 'countdown' && (
        <Countdown onComplete={handleCountdownComplete} />
      )}

      {isPlaying && (
        <HUD
          score={score}
          combo={combo}
          multiplier={multiplier}
          health={health}
          maxHealth={maxHealth}
          energy={energy}
          maxEnergy={maxEnergy}
          weapons={weapons}
          onMuteToggle={handleMuteToggle}
          isMuted={isMuted}
          onPause={handlePause}
        />
      )}

      {screen === 'paused' && (
        <PauseOverlay
          onResume={handleResume}
          onMenu={handleMenu}
          onMuteToggle={handleMuteToggle}
          isMuted={isMuted}
        />
      )}

      {screen === 'gameover' && gameOverSnapshot && (
        <GameOver
          snapshot={gameOverSnapshot}
          onRestart={handleRestart}
          onMenu={handleMenu}
          onShowLeaderboard={handleShowLeaderboard}
        />
      )}

      {screen === 'leaderboard' && (
        <Leaderboard onBack={handleLeaderboardBack} />
      )}
    </div>
  );
}
