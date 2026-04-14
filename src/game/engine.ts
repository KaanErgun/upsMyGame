import { FIXED_DT, MAX_STEPS_PER_FRAME } from './constants';
import { SimulationEngine } from './simulation';
import { GameRenderer } from './renderer';
import { AudioSystem } from './audio';
import { screenToAngle } from './math';
import type { InputCommand, RenderSnapshot, ActionState, WeaponState } from './types';
import { GamePhase } from './types';

export interface GameCallbacks {
  onScoreUpdate: (score: number, combo: number, multiplier: number) => void;
  onHealthUpdate: (health: number, maxHealth: number) => void;
  onEnergyUpdate: (energy: number, maxEnergy: number) => void;
  onGameOver: (snapshot: RenderSnapshot) => void;
  onPhaseChange: (phase: string) => void;
  onWeaponsUpdate: (weapons: WeaponState) => void;
}

export class GameEngine {
  private simulation: SimulationEngine | null = null;
  private renderer: GameRenderer;
  private audio: AudioSystem;
  private callbacks: GameCallbacks;

  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private paused = false;

  private currentAngleInput: { type: 'setAngle' | 'rotate' | 'none'; value: number } = { type: 'none', value: 0 };
  private pendingActions: ActionState = { blastFired: false, slamStarted: false, slamReleased: false, pulseFired: false };
  private keysDown = new Set<string>();
  private latestSnapshot: RenderSnapshot | null = null;
  private gamePhase: GamePhase = GamePhase.Menu;

  private mouseHandler: ((e: MouseEvent) => void) | null = null;
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
  private touchHandler: ((e: TouchEvent) => void) | null = null;
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private contextMenuHandler: ((e: Event) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.renderer = new GameRenderer(canvas);
    this.audio = new AudioSystem();
    this.callbacks = callbacks;
    this.setupInput(canvas);
  }

  start(seed?: number) {
    this.audio.init();
    this.audio.resume();
    const gameSeed = seed ?? Math.floor(Math.random() * 2147483647);
    this.simulation = new SimulationEngine(gameSeed);
    this.accumulator = 0;
    this.lastTime = performance.now() / 1000;
    this.running = true;
    this.paused = false;
    this.gamePhase = GamePhase.InGame;
    this.renderer.resize();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now() / 1000;
    }
  }

  resize() {
    this.renderer.resize();
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  isMuted(): boolean {
    return this.audio.isMuted();
  }

  getLatestSnapshot(): RenderSnapshot | null {
    return this.latestSnapshot;
  }

  destroy() {
    this.stop();
    if (this.mouseHandler) window.removeEventListener('mousemove', this.mouseHandler);
    if (this.mouseDownHandler) window.removeEventListener('mousedown', this.mouseDownHandler);
    if (this.mouseUpHandler) window.removeEventListener('mouseup', this.mouseUpHandler);
    if (this.touchHandler) window.removeEventListener('touchmove', this.touchHandler);
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
    if (this.contextMenuHandler) window.removeEventListener('contextmenu', this.contextMenuHandler);
  }

  private setupInput(canvas: HTMLCanvasElement) {
    this.mouseHandler = (e: MouseEvent) => {
      if (this.paused || this.gamePhase !== GamePhase.InGame) return;
      const rect = canvas.getBoundingClientRect();
      const cx = this.renderer.getCenterX();
      const cy = this.renderer.getCenterY();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const angle = screenToAngle(mx, my, cx, cy);
      this.currentAngleInput = { type: 'setAngle', value: angle };
    };

    this.mouseDownHandler = (e: MouseEvent) => {
      if (this.paused || this.gamePhase !== GamePhase.InGame) return;
      if (e.button === 0) {
        this.pendingActions.blastFired = true;
      }
      if (e.button === 1) {
        e.preventDefault();
        this.pendingActions.pulseFired = true;
      }
      if (e.button === 2) {
        this.pendingActions.slamStarted = true;
      }
    };

    this.mouseUpHandler = (e: MouseEvent) => {
      if (this.paused || this.gamePhase !== GamePhase.InGame) return;
      if (e.button === 2) {
        this.pendingActions.slamReleased = true;
      }
    };

    this.touchHandler = (e: TouchEvent) => {
      if (this.paused || this.gamePhase !== GamePhase.InGame) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const cx = this.renderer.getCenterX();
      const cy = this.renderer.getCenterY();
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      const angle = screenToAngle(mx, my, cx, cy);
      this.currentAngleInput = { type: 'setAngle', value: angle };
    };

    this.keyDownHandler = (e: KeyboardEvent) => {
      this.keysDown.add(e.code);
      if (this.paused || this.gamePhase !== GamePhase.InGame) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.pendingActions.blastFired = true;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        this.pendingActions.slamStarted = true;
      }
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        e.preventDefault();
        this.pendingActions.pulseFired = true;
      }
    };

    this.keyUpHandler = (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
      if (this.paused || this.gamePhase !== GamePhase.InGame) return;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.pendingActions.slamReleased = true;
      }
    };

    this.contextMenuHandler = (e: Event) => {
      if (this.gamePhase === GamePhase.InGame) {
        e.preventDefault();
      }
    };

    window.addEventListener('mousemove', this.mouseHandler);
    window.addEventListener('mousedown', this.mouseDownHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
    window.addEventListener('touchmove', this.touchHandler, { passive: false });
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    window.addEventListener('contextmenu', this.contextMenuHandler);
  }

  private getInput(): InputCommand {
    const actions: ActionState = { ...this.pendingActions };
    this.pendingActions = { blastFired: false, slamStarted: false, slamReleased: false, pulseFired: false };

    if (this.currentAngleInput.type === 'setAngle') {
      return { type: 'setAngle', value: this.currentAngleInput.value, actions };
    }

    const left = this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyA');
    const right = this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD');
    if (left && !right) return { type: 'rotate', value: 1, actions };
    if (right && !left) return { type: 'rotate', value: -1, actions };
    return { type: 'none', value: 0, actions };
  }

  private loop() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => this.loop());

    if (this.paused || !this.simulation) return;

    const now = performance.now() / 1000;
    let frameTime = now - this.lastTime;
    this.lastTime = now;

    if (frameTime > 0.25) frameTime = 0.25;
    this.accumulator += frameTime;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      const input = this.getInput();
      this.latestSnapshot = this.simulation.step(input);
      this.accumulator -= FIXED_DT;
      steps++;

      if (this.latestSnapshot.events.length > 0) {
        this.audio.processEvents(this.latestSnapshot.events);
        this.renderer.processEvents(this.latestSnapshot.events, now);

        for (const ev of this.latestSnapshot.events) {
          if (ev.type === 'playerDied') {
            this.gamePhase = GamePhase.GameOver;
            this.running = false;
            this.callbacks.onGameOver(this.latestSnapshot);
          }
        }
      }

      this.callbacks.onScoreUpdate(
        this.latestSnapshot.score.total,
        this.latestSnapshot.score.combo,
        this.latestSnapshot.score.multiplier,
      );
      this.callbacks.onHealthUpdate(
        this.latestSnapshot.player.health,
        this.latestSnapshot.player.maxHealth,
      );
      this.callbacks.onEnergyUpdate(
        this.latestSnapshot.player.energy,
        this.latestSnapshot.player.maxEnergy,
      );
      this.callbacks.onWeaponsUpdate(this.latestSnapshot.weapons);
    }

    const alpha = this.accumulator / FIXED_DT;
    if (this.latestSnapshot) {
      this.renderer.render(this.latestSnapshot, alpha, now);
    }
  }
}
