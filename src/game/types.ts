export enum ThreatKind {
  Standard = 'standard',
  Fast = 'fast',
  Narrow = 'narrow',
  Wobble = 'wobble',
  Splitter = 'splitter',
  Shielded = 'shielded',
}

export enum ThreatLifeState {
  Approaching = 'approaching',
  Deflected = 'deflected',
  Missed = 'missed',
  Ricocheting = 'ricocheting',
  Stunned = 'stunned',
}

export enum DeflectQuality {
  Perfect = 'perfect',
  Good = 'good',
  Scrape = 'scrape',
}

export enum DifficultyPhase {
  Tutorial = 'tutorial',
  Pressure = 'pressure',
  Escalation = 'escalation',
  Chaos = 'chaos',
}

export enum GamePhase {
  Menu = 'menu',
  PreGame = 'pregame',
  InGame = 'ingame',
  Paused = 'paused',
  GameOver = 'gameover',
}

export interface WeaponState {
  shieldLevel: number;
  shieldXp: number;
  blastLevel: number;
  blastXp: number;
  slamLevel: number;
  slamXp: number;
  pulseLevel: number;
  pulseXp: number;
  pulseUnlocked: boolean;
  pulseCooldownTick: number;
  pulseActiveTicks: number;
}

export interface ThreatEntity {
  id: number;
  kind: ThreatKind;
  spawnTick: number;
  radius: number;
  angle: number;
  radialVelocity: number;
  angularVelocity: number;
  wobblePhase: number;
  wobbleAmplitude: number;
  collisionRadius: number;
  lifeState: ThreatLifeState;
  telegraphTicks: number;
  isTelegraph: boolean;
  hasShield: boolean;
  stunTicksRemaining: number;
  ricochetSourceAngle: number;
}

export interface BlastEntity {
  id: number;
  angle: number;
  radius: number;
  speed: number;
  active: boolean;
  spawnTick: number;
}

export interface PlayerState {
  angle: number;
  targetAngle: number;
  angularSpeed: number;
  shieldArc: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  blastCooldownTick: number;
  slamCooldownTick: number;
  slamCharging: boolean;
  slamChargeTick: number;
  slamActiveTicks: number;
}

export interface ScoreState {
  total: number;
  combo: number;
  multiplier: number;
  survivalTicks: number;
  perfectCount: number;
  goodCount: number;
  scrapeCount: number;
  missCount: number;
  maxCombo: number;
  blastKills: number;
  ricochetKills: number;
  slamsUsed: number;
}

export interface DifficultyState {
  phase: DifficultyPhase;
  elapsedTicks: number;
  pressureLevel: number;
  spawnIntervalTicks: number;
  maxConcurrentThreats: number;
  speedMultiplier: number;
  consecutiveMisses: number;
  lastSpawnTick: number;
  recentSpawnAngles: number[];
}

export type GameEventType =
  | { type: 'threatDeflected'; threatId: number; quality: DeflectQuality; angle: number; kind: ThreatKind }
  | { type: 'threatMissed'; threatId: number; angle: number; damage: number }
  | { type: 'comboChanged'; oldCombo: number; newCombo: number; multiplier: number }
  | { type: 'playerDamaged'; damage: number; remainingHealth: number }
  | { type: 'playerDied'; finalScore: number; survivalTicks: number }
  | { type: 'difficultyPhaseChanged'; newPhase: DifficultyPhase }
  | { type: 'threatSpawned'; threatId: number; kind: ThreatKind; angle: number }
  | { type: 'survivalBonus'; points: number }
  | { type: 'blastFired'; angle: number }
  | { type: 'blastHit'; threatId: number; angle: number; kind: ThreatKind }
  | { type: 'slamActivated'; angle: number }
  | { type: 'ricochetKill'; threatId: number; angle: number }
  | { type: 'threatStunned'; threatId: number; angle: number }
  | { type: 'shieldBroken'; threatId: number; angle: number }
  | { type: 'energyDenied' }
  | { type: 'weaponLevelUp'; weapon: 'shield' | 'blast' | 'slam' | 'pulse'; newLevel: number }
  | { type: 'pulseUnlocked' }
  | { type: 'pulseFired'; angle: number }
  | { type: 'playerHealed'; newHealth: number };

export interface ActionState {
  blastFired: boolean;
  slamStarted: boolean;
  slamReleased: boolean;
  pulseFired: boolean;
}

export interface InputCommand {
  type: 'setAngle' | 'rotate' | 'none';
  value: number;
  actions: ActionState;
}

export interface RenderSnapshot {
  tick: number;
  player: PlayerState;
  threats: ThreatEntity[];
  blasts: BlastEntity[];
  score: ScoreState;
  difficulty: DifficultyState;
  weapons: WeaponState;
  events: GameEventType[];
}
