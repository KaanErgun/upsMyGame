import { DeflectQuality, DifficultyPhase } from './types';
import type { GameEventType } from './types';

class SynthOscillator {
  private audioCtx: AudioContext;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
  }

  play(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, detune = 0) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', volume = 0.08) {
    for (const f of freqs) {
      this.play(f, duration, type, volume);
    }
  }

  playNoise(duration: number, volume = 0.1) {
    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  playSweep(startFreq: number, endFreq: number, duration: number, type: OscillatorType = 'sine', volume = 0.1) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
}

export class AudioSystem {
  private audioCtx: AudioContext | null = null;
  private synth: SynthOscillator | null = null;
  private initialized = false;
  private muted = false;

  init() {
    if (this.initialized) return;
    try {
      this.audioCtx = new AudioContext();
      this.synth = new SynthOscillator(this.audioCtx);
      this.initialized = true;
    } catch {
      console.warn('Audio not available');
    }
  }

  resume() {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  processEvents(events: GameEventType[]) {
    if (!this.synth || !this.initialized || this.muted) return;

    for (const ev of events) {
      switch (ev.type) {
        case 'threatDeflected':
          this.playDeflect(ev.quality);
          break;
        case 'threatMissed':
          this.playMiss();
          break;
        case 'playerDamaged':
          this.playDamage();
          break;
        case 'playerDied':
          this.playDeath();
          break;
        case 'comboChanged':
          if (ev.newCombo > ev.oldCombo && ev.newCombo % 5 === 0) {
            this.playComboMilestone(ev.newCombo);
          }
          if (ev.newCombo === 0 && ev.oldCombo >= 5) {
            this.playComboBreak();
          }
          break;
        case 'difficultyPhaseChanged':
          this.playPhaseChange(ev.newPhase);
          break;
        case 'survivalBonus':
          this.playSurvivalBonus();
          break;
        case 'blastFired':
          this.playBlastFire();
          break;
        case 'blastHit':
          this.playBlastHit();
          break;
        case 'slamActivated':
          this.playSlamRelease();
          break;
        case 'shieldBroken':
          this.playShieldBreak();
          break;
        case 'threatStunned':
          this.playStun();
          break;
        case 'ricochetKill':
          this.playRicochetKill();
          break;
        case 'energyDenied':
          this.playEnergyDenied();
          break;
        case 'weaponLevelUp':
          this.playLevelUp();
          break;
        case 'pulseUnlocked':
          this.playPulseUnlocked();
          break;
        case 'pulseFired':
          this.playPulseFire();
          break;
        case 'playerHealed':
          this.playHeal();
          break;
      }
    }
  }

  private playDeflect(quality: DeflectQuality) {
    if (!this.synth) return;
    switch (quality) {
      case DeflectQuality.Perfect:
        this.synth.playChord([880, 1318, 1760], 0.3, 'sine', 0.1);
        break;
      case DeflectQuality.Good:
        this.synth.playChord([660, 880], 0.2, 'sine', 0.08);
        break;
      case DeflectQuality.Scrape:
        this.synth.play(440, 0.15, 'triangle', 0.06);
        break;
    }
  }

  private playMiss() {
    if (!this.synth) return;
    this.synth.play(150, 0.3, 'sawtooth', 0.1);
    this.synth.play(120, 0.4, 'sine', 0.08);
  }

  private playDamage() {
    if (!this.synth) return;
    this.synth.playNoise(0.15, 0.15);
    this.synth.play(100, 0.3, 'square', 0.08);
  }

  private playDeath() {
    if (!this.synth) return;
    this.synth.play(200, 0.8, 'sawtooth', 0.12);
    this.synth.play(150, 1.0, 'sine', 0.1);
    this.synth.play(100, 1.2, 'sine', 0.08);
    this.synth.playNoise(0.5, 0.12);
  }

  private playComboMilestone(combo: number) {
    if (!this.synth) return;
    const baseFreq = 600 + combo * 20;
    this.synth.playChord([baseFreq, baseFreq * 1.25, baseFreq * 1.5], 0.4, 'sine', 0.06);
  }

  private playComboBreak() {
    if (!this.synth) return;
    this.synth.play(300, 0.3, 'triangle', 0.08);
    this.synth.play(200, 0.4, 'triangle', 0.06);
  }

  private playPhaseChange(_phase: DifficultyPhase) {
    if (!this.synth) return;
    this.synth.playChord([523, 659, 784], 0.5, 'sine', 0.06);
    this.synth.play(1047, 0.3, 'sine', 0.04);
  }

  private playSurvivalBonus() {
    if (!this.synth) return;
    this.synth.play(800, 0.15, 'sine', 0.05);
    setTimeout(() => this.synth?.play(1000, 0.15, 'sine', 0.05), 80);
  }

  private playBlastFire() {
    if (!this.synth) return;
    this.synth.playSweep(600, 1200, 0.15, 'sawtooth', 0.1);
    this.synth.playNoise(0.08, 0.08);
  }

  private playBlastHit() {
    if (!this.synth) return;
    this.synth.playSweep(800, 200, 0.2, 'square', 0.08);
    this.synth.playNoise(0.12, 0.1);
    this.synth.play(400, 0.15, 'sine', 0.06);
  }

  private playSlamRelease() {
    if (!this.synth) return;
    this.synth.playSweep(200, 80, 0.3, 'sawtooth', 0.12);
    this.synth.playNoise(0.2, 0.12);
    this.synth.play(100, 0.4, 'sine', 0.1);
    setTimeout(() => {
      this.synth?.play(150, 0.2, 'square', 0.06);
    }, 50);
  }

  private playShieldBreak() {
    if (!this.synth) return;
    this.synth.playSweep(1000, 300, 0.25, 'square', 0.08);
    this.synth.playNoise(0.15, 0.1);
    this.synth.play(500, 0.1, 'triangle', 0.06);
    setTimeout(() => this.synth?.play(350, 0.15, 'triangle', 0.05), 60);
  }

  private playStun() {
    if (!this.synth) return;
    this.synth.playSweep(1200, 600, 0.2, 'sine', 0.06);
    this.synth.play(800, 0.1, 'triangle', 0.04);
  }

  private playRicochetKill() {
    if (!this.synth) return;
    this.synth.playChord([1000, 1250, 1500], 0.25, 'sine', 0.08);
    this.synth.play(1800, 0.1, 'sine', 0.05);
  }

  private playEnergyDenied() {
    if (!this.synth) return;
    this.synth.play(200, 0.15, 'square', 0.06);
    setTimeout(() => this.synth?.play(150, 0.15, 'square', 0.06), 80);
  }

  private playLevelUp() {
    if (!this.synth) return;
    this.synth.playChord([523, 659, 784, 1047], 0.5, 'sine', 0.08);
    setTimeout(() => this.synth?.play(1319, 0.3, 'sine', 0.06), 150);
  }

  private playPulseUnlocked() {
    if (!this.synth) return;
    this.synth.playChord([392, 523, 659, 784, 1047], 0.7, 'sine', 0.06);
    setTimeout(() => this.synth?.playChord([1047, 1319, 1568], 0.4, 'sine', 0.05), 200);
  }

  private playPulseFire() {
    if (!this.synth) return;
    this.synth.playSweep(300, 100, 0.4, 'sine', 0.1);
    this.synth.playSweep(600, 200, 0.3, 'triangle', 0.06);
    this.synth.playNoise(0.15, 0.08);
  }

  private playHeal() {
    if (!this.synth) return;
    this.synth.play(660, 0.2, 'sine', 0.06);
    setTimeout(() => this.synth?.play(880, 0.2, 'sine', 0.06), 100);
  }
}
