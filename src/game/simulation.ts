import {
  FIXED_DT,
  SHIELD_RADIUS,
  CORE_RADIUS,
  SPAWN_RADIUS,
  PLAYER_ANGULAR_SPEED,
  PLAYER_SHIELD_ARC,
  PLAYER_MAX_HEALTH,
  TIMING_ZONE_PERFECT,
  TIMING_ZONE_GOOD,
  SCORE_PERFECT,
  SCORE_GOOD,
  SCORE_SCRAPE,
  SCORE_BLAST_KILL,
  SCORE_RICOCHET_KILL,
  SURVIVAL_BONUS_INTERVAL_TICKS,
  SURVIVAL_BONUS_BASE,
  SPAWN_MIN_ANGLE_GAP,
  SPAWN_MAX_ATTEMPTS,
  RADIAL_TOLERANCE,
  TAU,
  MIN_TELEGRAPH_TICKS,
  ENERGY_MAX,
  ENERGY_START,
  ENERGY_REGEN_PER_TICK,
  ENERGY_PERFECT_BONUS,
  ENERGY_GOOD_BONUS,
  ENERGY_SCRAPE_BONUS,
  ENERGY_COMBO_5_BONUS,
  ENERGY_COMBO_10_BONUS,
  ENERGY_COMBO_20_BONUS,
  BLAST_COST,
  BLAST_SPEED,
  BLAST_ANGULAR_WIDTH,
  BLAST_COOLDOWN_TICKS,
  BLAST_MAX_RADIUS,
  SLAM_COST,
  SLAM_CHARGE_TICKS,
  SLAM_ACTIVE_TICKS,
  SLAM_ARC,
  SLAM_COOLDOWN_TICKS,
  SLAM_SLOW_FACTOR,
  STUN_DURATION_TICKS,
  RICOCHET_SPEED_MULT,
  RICOCHET_MAX_TICKS,
  RICOCHET_COLLISION_RADIUS,
  COYOTE_FRAMES,
  WEAPON_XP_THRESHOLDS,
  WEAPON_MAX_LEVEL,
  SHIELD_XP_PERFECT,
  SHIELD_XP_GOOD,
  SHIELD_XP_SCRAPE,
  BLAST_XP_PER_KILL,
  SLAM_XP_PER_HIT,
  PULSE_XP_PER_AFFECTED,
  SHIELD_ARC_MULT,
  SHIELD_COYOTE_BONUS,
  BLAST_COOLDOWN_MULT,
  BLAST_COST_MULT,
  SLAM_ARC_MULT,
  SLAM_COOLDOWN_MULT,
  PULSE_UNLOCK_COMBINED_LEVEL,
  PULSE_COST,
  PULSE_COOLDOWN_TICKS,
  PULSE_ACTIVE_TICKS,
  PULSE_SLOW_PER_LEVEL,
  PULSE_COOLDOWN_LEVEL_MULT,
} from './constants';
import { normalizeAngle, angleDelta, absAngleDelta } from './math';
import { SeededRng } from './rng';
import type {
  ThreatEntity,
  BlastEntity,
  PlayerState,
  ScoreState,
  DifficultyState,
  WeaponState,
  GameEventType,
  InputCommand,
  RenderSnapshot,
} from './types';
import { ThreatKind, ThreatLifeState, DeflectQuality, DifficultyPhase } from './types';

const PHASE_PARAMS: Record<DifficultyPhase, {
  spawnInterval: number;
  maxConcurrent: number;
  speedMult: number;
}> = {
  [DifficultyPhase.Tutorial]: { spawnInterval: 160, maxConcurrent: 1, speedMult: 0.55 },
  [DifficultyPhase.Pressure]: { spawnInterval: 110, maxConcurrent: 2, speedMult: 0.8 },
  [DifficultyPhase.Escalation]: { spawnInterval: 70, maxConcurrent: 3, speedMult: 0.95 },
  [DifficultyPhase.Chaos]: { spawnInterval: 48, maxConcurrent: 4, speedMult: 1.15 },
};

const THREAT_CONFIGS: Record<ThreatKind, {
  speed: number;
  collisionRadius: number;
  wobbleAmp: number;
  angularVel: number;
}> = {
  [ThreatKind.Standard]: { speed: 2.0, collisionRadius: 0.12, wobbleAmp: 0, angularVel: 0 },
  [ThreatKind.Fast]: { speed: 3.5, collisionRadius: 0.10, wobbleAmp: 0, angularVel: 0 },
  [ThreatKind.Narrow]: { speed: 2.0, collisionRadius: 0.06, wobbleAmp: 0, angularVel: 0 },
  [ThreatKind.Wobble]: { speed: 1.8, collisionRadius: 0.12, wobbleAmp: 0.3, angularVel: 0 },
  [ThreatKind.Splitter]: { speed: 1.6, collisionRadius: 0.14, wobbleAmp: 0, angularVel: 0 },
  [ThreatKind.Shielded]: { speed: 1.4, collisionRadius: 0.14, wobbleAmp: 0, angularVel: 0 },
};

let nextEntityId = 1;

function createPlayer(): PlayerState {
  return {
    angle: Math.PI / 2,
    targetAngle: Math.PI / 2,
    angularSpeed: PLAYER_ANGULAR_SPEED,
    shieldArc: PLAYER_SHIELD_ARC,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    energy: ENERGY_START,
    maxEnergy: ENERGY_MAX,
    blastCooldownTick: 0,
    slamCooldownTick: 0,
    slamCharging: false,
    slamChargeTick: 0,
    slamActiveTicks: 0,
  };
}

function createScore(): ScoreState {
  return {
    total: 0,
    combo: 0,
    multiplier: 1,
    survivalTicks: 0,
    perfectCount: 0,
    goodCount: 0,
    scrapeCount: 0,
    missCount: 0,
    maxCombo: 0,
    blastKills: 0,
    ricochetKills: 0,
    slamsUsed: 0,
  };
}

function createDifficulty(): DifficultyState {
  return {
    phase: DifficultyPhase.Tutorial,
    elapsedTicks: 0,
    pressureLevel: 0,
    spawnIntervalTicks: PHASE_PARAMS[DifficultyPhase.Tutorial].spawnInterval,
    maxConcurrentThreats: PHASE_PARAMS[DifficultyPhase.Tutorial].maxConcurrent,
    speedMultiplier: PHASE_PARAMS[DifficultyPhase.Tutorial].speedMult,
    consecutiveMisses: 0,
    lastSpawnTick: -999,
    recentSpawnAngles: [],
  };
}

function comboToMultiplier(combo: number): number {
  if (combo < 5) return 1.0;
  if (combo < 10) return 1.5;
  if (combo < 20) return 2.0;
  if (combo < 35) return 3.0;
  return 4.0;
}

function createWeapons(): WeaponState {
  return {
    shieldLevel: 1,
    shieldXp: 0,
    blastLevel: 1,
    blastXp: 0,
    slamLevel: 1,
    slamXp: 0,
    pulseLevel: 0,
    pulseXp: 0,
    pulseUnlocked: false,
    pulseCooldownTick: 0,
    pulseActiveTicks: 0,
  };
}

function weaponXpForLevel(level: number): number {
  if (level <= 1 || level > WEAPON_MAX_LEVEL) return Infinity;
  return WEAPON_XP_THRESHOLDS[level - 1];
}

function computeDeflectQuality(delta: number): DeflectQuality {
  if (delta <= TIMING_ZONE_PERFECT) return DeflectQuality.Perfect;
  if (delta <= TIMING_ZONE_GOOD) return DeflectQuality.Good;
  return DeflectQuality.Scrape;
}

function computePhase(elapsedTicks: number): DifficultyPhase {
  const secs = elapsedTicks * FIXED_DT;
  if (secs < 25) return DifficultyPhase.Tutorial;
  if (secs < 70) return DifficultyPhase.Pressure;
  if (secs < 140) return DifficultyPhase.Escalation;
  return DifficultyPhase.Chaos;
}

function pickThreatKind(rng: SeededRng, phase: DifficultyPhase): ThreatKind {
  const roll = rng.nextFloat();
  switch (phase) {
    case DifficultyPhase.Tutorial:
      return ThreatKind.Standard;
    case DifficultyPhase.Pressure:
      if (roll < 0.75) return ThreatKind.Standard;
      return ThreatKind.Fast;
    case DifficultyPhase.Escalation:
      if (roll < 0.30) return ThreatKind.Standard;
      if (roll < 0.50) return ThreatKind.Fast;
      if (roll < 0.62) return ThreatKind.Narrow;
      if (roll < 0.74) return ThreatKind.Wobble;
      if (roll < 0.86) return ThreatKind.Splitter;
      return ThreatKind.Shielded;
    case DifficultyPhase.Chaos:
      if (roll < 0.20) return ThreatKind.Standard;
      if (roll < 0.35) return ThreatKind.Fast;
      if (roll < 0.48) return ThreatKind.Narrow;
      if (roll < 0.62) return ThreatKind.Wobble;
      if (roll < 0.78) return ThreatKind.Splitter;
      return ThreatKind.Shielded;
  }
}

export class SimulationEngine {
  tick = 0;
  player: PlayerState;
  threats: ThreatEntity[] = [];
  blasts: BlastEntity[] = [];
  score: ScoreState;
  difficulty: DifficultyState;
  weapons: WeaponState;
  rng: SeededRng;
  events: GameEventType[] = [];

  constructor(seed: number) {
    this.rng = new SeededRng(seed);
    this.player = createPlayer();
    this.score = createScore();
    this.difficulty = createDifficulty();
    this.weapons = createWeapons();
    nextEntityId = 1;
  }

  step(input: InputCommand): RenderSnapshot {
    this.events = [];

    this.applyInput(input);
    this.updatePlayer();
    this.updateEnergy();
    this.updatePulse();
    this.spawnSystem();
    this.updateBlasts();
    this.updateThreats();
    this.resolveBlastCollisions();
    this.resolveShieldCollisions();
    this.resolveRicochetCollisions();
    this.updateScore();
    this.updateDifficulty();
    this.checkPulseUnlock();
    this.cleanupEntities();

    this.tick++;
    this.score.survivalTicks = this.tick;

    return {
      tick: this.tick,
      player: { ...this.player },
      threats: this.threats.map(t => ({ ...t })),
      blasts: this.blasts.map(b => ({ ...b })),
      score: { ...this.score },
      difficulty: { ...this.difficulty },
      weapons: { ...this.weapons },
      events: [...this.events],
    };
  }

  private applyInput(input: InputCommand) {
    if (input.type === 'setAngle') {
      this.player.targetAngle = normalizeAngle(input.value);
    } else if (input.type === 'rotate') {
      this.player.targetAngle = normalizeAngle(
        this.player.angle + input.value * this.player.angularSpeed
      );
    }

    if (input.actions.blastFired) {
      this.tryFireBlast();
    }
    if (input.actions.slamStarted && !this.player.slamCharging && this.player.slamActiveTicks <= 0) {
      if (this.tick >= this.player.slamCooldownTick && this.player.energy >= SLAM_COST) {
        this.player.slamCharging = true;
        this.player.slamChargeTick = this.tick;
      } else if (this.player.energy < SLAM_COST) {
        this.events.push({ type: 'energyDenied' });
      }
    }
    if (input.actions.slamReleased && this.player.slamCharging) {
      this.tryActivateSlam();
    }
    if (input.actions.pulseFired) {
      this.tryFirePulse();
    }
  }

  private tryFireBlast() {
    const cdTicks = Math.floor(BLAST_COOLDOWN_TICKS * BLAST_COOLDOWN_MULT[this.weapons.blastLevel]);
    if (this.tick < this.player.blastCooldownTick) return;
    const cost = Math.floor(BLAST_COST * BLAST_COST_MULT[this.weapons.blastLevel]);
    if (this.player.energy < cost) {
      this.events.push({ type: 'energyDenied' });
      return;
    }

    this.player.energy -= cost;
    this.player.blastCooldownTick = this.tick + cdTicks;

    const blast: BlastEntity = {
      id: nextEntityId++,
      angle: this.player.angle,
      radius: SHIELD_RADIUS + 5,
      speed: BLAST_SPEED,
      active: true,
      spawnTick: this.tick,
    };
    this.blasts.push(blast);

    // Level 5: twin blast
    if (this.weapons.blastLevel >= 5) {
      const offset = 0.12;
      const twin: BlastEntity = {
        id: nextEntityId++,
        angle: normalizeAngle(this.player.angle + offset),
        radius: SHIELD_RADIUS + 5,
        speed: BLAST_SPEED,
        active: true,
        spawnTick: this.tick,
      };
      this.blasts.push(twin);
    }

    this.events.push({ type: 'blastFired', angle: this.player.angle });
  }

  private tryActivateSlam() {
    this.player.slamCharging = false;
    const chargeTime = this.tick - this.player.slamChargeTick;
    if (chargeTime < SLAM_CHARGE_TICKS) return;

    this.player.energy -= SLAM_COST;
    this.player.slamActiveTicks = SLAM_ACTIVE_TICKS;
    const cdTicks = Math.floor(SLAM_COOLDOWN_TICKS * SLAM_COOLDOWN_MULT[this.weapons.slamLevel]);
    this.player.slamCooldownTick = this.tick + cdTicks;
    this.score.slamsUsed++;
    this.events.push({ type: 'slamActivated', angle: this.player.angle });
  }

  private updatePlayer() {
    let speed = this.player.angularSpeed;
    if (this.player.slamCharging) {
      speed *= SLAM_SLOW_FACTOR;
    }

    const delta = angleDelta(this.player.angle, this.player.targetAngle);
    if (Math.abs(delta) <= speed) {
      this.player.angle = this.player.targetAngle;
    } else {
      this.player.angle = normalizeAngle(
        this.player.angle + Math.sign(delta) * speed
      );
    }

    if (this.player.slamActiveTicks > 0) {
      this.player.slamActiveTicks--;
    }
  }

  private updateEnergy() {
    if (this.player.energy < ENERGY_MAX) {
      this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_REGEN_PER_TICK);
    }
  }

  private tryFirePulse() {
    if (!this.weapons.pulseUnlocked) return;
    if (this.weapons.pulseActiveTicks > 0) return;
    const cdTicks = Math.floor(PULSE_COOLDOWN_TICKS * PULSE_COOLDOWN_LEVEL_MULT[this.weapons.pulseLevel]);
    if (this.tick < this.weapons.pulseCooldownTick) return;
    if (this.player.energy < PULSE_COST) {
      this.events.push({ type: 'energyDenied' });
      return;
    }

    this.player.energy -= PULSE_COST;
    this.weapons.pulseActiveTicks = PULSE_ACTIVE_TICKS;
    this.weapons.pulseCooldownTick = this.tick + cdTicks;

    // Count affected threats for XP
    let affected = 0;
    for (const t of this.threats) {
      if (t.lifeState === ThreatLifeState.Approaching || t.lifeState === ThreatLifeState.Stunned) {
        affected++;
      }
    }
    if (affected > 0) {
      this.addWeaponXp('pulse', affected * PULSE_XP_PER_AFFECTED);
    }

    this.events.push({ type: 'pulseFired', angle: this.player.angle });
  }

  private updatePulse() {
    if (this.weapons.pulseActiveTicks > 0) {
      this.weapons.pulseActiveTicks--;
    }
  }

  private getPulseSlowFactor(): number {
    if (this.weapons.pulseActiveTicks <= 0) return 1.0;
    return PULSE_SLOW_PER_LEVEL[this.weapons.pulseLevel] || 0.5;
  }

  private addWeaponXp(weapon: 'shield' | 'blast' | 'slam' | 'pulse', amount: number) {
    const levelKey = `${weapon}Level` as keyof WeaponState;
    const xpKey = `${weapon}Xp` as keyof WeaponState;
    let level = this.weapons[levelKey] as number;
    let xp = (this.weapons[xpKey] as number) + amount;

    if (weapon === 'pulse' && !this.weapons.pulseUnlocked) return;
    if (level >= WEAPON_MAX_LEVEL) return;

    const threshold = weaponXpForLevel(level + 1);
    if (xp >= threshold) {
      xp -= threshold;
      level++;
      (this.weapons as unknown as Record<string, number | boolean>)[levelKey as string] = level;
      (this.weapons as unknown as Record<string, number | boolean>)[xpKey as string] = xp;

      // Heal 1 HP on level up
      if (this.player.health < this.player.maxHealth) {
        this.player.health++;
        this.events.push({ type: 'playerHealed', newHealth: this.player.health });
      }

      this.events.push({ type: 'weaponLevelUp', weapon, newLevel: level });

      // Check for further level ups with remaining XP
      if (level < WEAPON_MAX_LEVEL && xp >= weaponXpForLevel(level + 1)) {
        this.addWeaponXp(weapon, 0);
      }
    } else {
      (this.weapons as unknown as Record<string, number | boolean>)[xpKey as string] = xp;
    }
  }

  private checkPulseUnlock() {
    if (this.weapons.pulseUnlocked) return;
    const combined = this.weapons.shieldLevel + this.weapons.blastLevel + this.weapons.slamLevel;
    if (combined >= PULSE_UNLOCK_COMBINED_LEVEL) {
      this.weapons.pulseUnlocked = true;
      this.weapons.pulseLevel = 1;
      this.events.push({ type: 'pulseUnlocked' });
    }
  }

  private updateBlasts() {
    for (const b of this.blasts) {
      if (!b.active) continue;
      b.radius += b.speed;
      if (b.radius > BLAST_MAX_RADIUS) {
        b.active = false;
      }
    }
  }

  private spawnSystem() {
    this.difficulty.elapsedTicks = this.tick;
    const activeThreats = this.threats.filter(
      t => t.lifeState === ThreatLifeState.Approaching || t.lifeState === ThreatLifeState.Stunned
    ).length;

    if (activeThreats >= this.difficulty.maxConcurrentThreats) return;

    const ticksSinceLast = this.tick - this.difficulty.lastSpawnTick;
    let interval = this.difficulty.spawnIntervalTicks;
    if (this.difficulty.consecutiveMisses >= 2) {
      interval = Math.floor(interval * 1.4);
    }
    if (ticksSinceLast < interval) return;

    const kind = pickThreatKind(this.rng, this.difficulty.phase);
    const angle = this.pickSpawnAngle();
    const config = THREAT_CONFIGS[kind];
    const speed = config.speed * this.difficulty.speedMultiplier;

    const threat: ThreatEntity = {
      id: nextEntityId++,
      kind,
      spawnTick: this.tick,
      radius: SPAWN_RADIUS,
      angle,
      radialVelocity: speed,
      angularVelocity: config.angularVel,
      wobblePhase: this.rng.nextFloat() * TAU,
      wobbleAmplitude: config.wobbleAmp,
      collisionRadius: config.collisionRadius,
      lifeState: ThreatLifeState.Approaching,
      telegraphTicks: MIN_TELEGRAPH_TICKS,
      isTelegraph: false,
      hasShield: kind === ThreatKind.Shielded,
      stunTicksRemaining: 0,
      ricochetSourceAngle: 0,
    };

    this.threats.push(threat);
    this.difficulty.lastSpawnTick = this.tick;
    this.difficulty.recentSpawnAngles.push(angle);
    if (this.difficulty.recentSpawnAngles.length > 4) {
      this.difficulty.recentSpawnAngles.shift();
    }

    this.events.push({ type: 'threatSpawned', threatId: threat.id, kind, angle });
  }

  private pickSpawnAngle(): number {
    for (let i = 0; i < SPAWN_MAX_ATTEMPTS; i++) {
      const candidate = this.rng.nextFloat() * TAU;
      let acceptable = true;
      for (const recent of this.difficulty.recentSpawnAngles) {
        if (absAngleDelta(candidate, recent) < SPAWN_MIN_ANGLE_GAP) {
          acceptable = false;
          break;
        }
      }
      if (acceptable) return candidate;
    }
    return this.findLeastCrowdedAngle();
  }

  private findLeastCrowdedAngle(): number {
    if (this.difficulty.recentSpawnAngles.length === 0) {
      return this.rng.nextFloat() * TAU;
    }
    const sorted = [...this.difficulty.recentSpawnAngles].sort((a, b) => a - b);
    sorted.push(sorted[0] + TAU);
    let bestAngle = 0;
    let bestGap = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1] - sorted[i];
      if (gap > bestGap) {
        bestGap = gap;
        bestAngle = normalizeAngle(sorted[i] + gap / 2);
      }
    }
    return bestAngle;
  }

  private updateThreats() {
    const pulseSlow = this.getPulseSlowFactor();

    for (const t of this.threats) {
      if (t.lifeState === ThreatLifeState.Stunned) {
        t.stunTicksRemaining--;
        if (t.stunTicksRemaining <= 0) {
          t.lifeState = ThreatLifeState.Approaching;
          t.radialVelocity *= 0.7;
          t.wobbleAmplitude = 0;
        }
        t.radius -= t.radialVelocity * 0.3 * pulseSlow;
        continue;
      }

      if (t.lifeState === ThreatLifeState.Ricocheting) {
        t.radius += t.radialVelocity;
        if (t.radius > SPAWN_RADIUS + 30 || (this.tick - t.spawnTick) > RICOCHET_MAX_TICKS) {
          t.lifeState = ThreatLifeState.Deflected;
        }
        continue;
      }

      if (t.lifeState !== ThreatLifeState.Approaching) continue;

      t.radius -= t.radialVelocity * pulseSlow;
      if (t.wobbleAmplitude > 0) {
        t.wobblePhase += 0.1;
        t.angle = normalizeAngle(
          t.angle + Math.sin(t.wobblePhase) * t.wobbleAmplitude * 0.02 * pulseSlow
        );
      }
      if (t.angularVelocity !== 0) {
        t.angle = normalizeAngle(t.angle + t.angularVelocity * pulseSlow);
      }
    }
  }

  private resolveBlastCollisions() {
    const isPiercing = this.weapons.blastLevel >= 3;

    for (const b of this.blasts) {
      if (!b.active) continue;

      for (const t of this.threats) {
        if (t.lifeState !== ThreatLifeState.Approaching && t.lifeState !== ThreatLifeState.Stunned) continue;
        if (t.kind === ThreatKind.Fast) continue;

        const radialDist = Math.abs(b.radius - t.radius);
        if (radialDist > 20) continue;

        const angDelta = absAngleDelta(b.angle, t.angle);
        if (angDelta > BLAST_ANGULAR_WIDTH + t.collisionRadius) continue;

        if (t.hasShield) {
          t.hasShield = false;
          this.events.push({ type: 'shieldBroken', threatId: t.id, angle: t.angle });
          if (!isPiercing) {
            b.active = false;
            break;
          }
          continue;
        }

        if (t.kind === ThreatKind.Wobble && t.lifeState !== ThreatLifeState.Stunned) {
          t.lifeState = ThreatLifeState.Stunned;
          t.stunTicksRemaining = STUN_DURATION_TICKS;
          this.events.push({ type: 'threatStunned', threatId: t.id, angle: t.angle });
          if (!isPiercing) {
            b.active = false;
            break;
          }
          continue;
        }

        t.lifeState = ThreatLifeState.Deflected;
        const points = Math.floor(SCORE_BLAST_KILL * this.score.multiplier);
        this.score.total += points;
        this.score.blastKills++;
        this.difficulty.consecutiveMisses = 0;
        this.addWeaponXp('blast', BLAST_XP_PER_KILL);
        this.events.push({ type: 'blastHit', threatId: t.id, angle: t.angle, kind: t.kind });
        if (!isPiercing) {
          b.active = false;
          break;
        }
      }
    }
  }

  private resolveShieldCollisions() {
    const isSlamActive = this.player.slamActiveTicks > 0;
    const shieldArc = this.player.shieldArc * SHIELD_ARC_MULT[this.weapons.shieldLevel];
    const slamArc = SLAM_ARC * SLAM_ARC_MULT[this.weapons.slamLevel];
    const effectiveArc = isSlamActive ? slamArc : shieldArc;
    const coyote = COYOTE_FRAMES + SHIELD_COYOTE_BONUS[this.weapons.shieldLevel];
    const radialTolerance = RADIAL_TOLERANCE + coyote;

    for (const t of this.threats) {
      if (t.lifeState !== ThreatLifeState.Approaching) continue;

      if (t.radius <= CORE_RADIUS) {
        t.lifeState = ThreatLifeState.Missed;
        const damage = 1;
        this.player.health -= damage;
        this.difficulty.consecutiveMisses++;
        const oldCombo = this.score.combo;
        this.score.combo = 0;
        this.score.multiplier = 1;
        this.score.missCount++;

        this.events.push({ type: 'threatMissed', threatId: t.id, angle: t.angle, damage });
        if (oldCombo > 0) {
          this.events.push({ type: 'comboChanged', oldCombo, newCombo: 0, multiplier: 1 });
        }
        this.events.push({ type: 'playerDamaged', damage, remainingHealth: this.player.health });
        if (this.player.health <= 0) {
          this.events.push({ type: 'playerDied', finalScore: this.score.total, survivalTicks: this.tick });
        }
        continue;
      }

      if (t.radius > SHIELD_RADIUS + radialTolerance) continue;
      if (t.radius < SHIELD_RADIUS - radialTolerance * 2) continue;
      if (t.hasShield) continue;

      const delta = absAngleDelta(this.player.angle, t.angle);
      const halfArc = effectiveArc / 2 + t.collisionRadius;

      if (delta <= halfArc) {
        const quality = isSlamActive
          ? (delta <= TIMING_ZONE_PERFECT ? DeflectQuality.Perfect : DeflectQuality.Good)
          : computeDeflectQuality(delta);

        this.difficulty.consecutiveMisses = 0;
        const oldCombo = this.score.combo;
        this.score.combo++;
        if (this.score.combo > this.score.maxCombo) {
          this.score.maxCombo = this.score.combo;
        }
        this.score.multiplier = comboToMultiplier(this.score.combo);

        let baseScore: number;
        switch (quality) {
          case DeflectQuality.Perfect:
            baseScore = SCORE_PERFECT;
            this.score.perfectCount++;
            this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_PERFECT_BONUS);
            this.addWeaponXp('shield', SHIELD_XP_PERFECT);
            break;
          case DeflectQuality.Good:
            baseScore = SCORE_GOOD;
            this.score.goodCount++;
            this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_GOOD_BONUS);
            this.addWeaponXp('shield', SHIELD_XP_GOOD);
            break;
          default:
            baseScore = SCORE_SCRAPE;
            this.score.scrapeCount++;
            this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_SCRAPE_BONUS);
            this.addWeaponXp('shield', SHIELD_XP_SCRAPE);
        }

        if (isSlamActive) {
          this.addWeaponXp('slam', SLAM_XP_PER_HIT);
        }

        if (this.score.combo === 5) this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_COMBO_5_BONUS);
        if (this.score.combo === 10) this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_COMBO_10_BONUS);
        if (this.score.combo === 20) this.player.energy = Math.min(ENERGY_MAX, this.player.energy + ENERGY_COMBO_20_BONUS);

        const pressureBonus = 1.0 + this.difficulty.pressureLevel * 0.5;
        const points = Math.floor(baseScore * this.score.multiplier * pressureBonus);
        this.score.total += points;

        if (quality === DeflectQuality.Perfect && !isSlamActive) {
          t.lifeState = ThreatLifeState.Ricocheting;
          t.radialVelocity = t.radialVelocity * RICOCHET_SPEED_MULT;
          t.ricochetSourceAngle = t.angle;
          t.spawnTick = this.tick;
          t.collisionRadius = RICOCHET_COLLISION_RADIUS;
        } else {
          t.lifeState = ThreatLifeState.Deflected;
        }

        this.events.push({
          type: 'threatDeflected',
          threatId: t.id,
          quality,
          angle: t.angle,
          kind: t.kind,
        });

        if (this.score.combo !== oldCombo) {
          this.events.push({
            type: 'comboChanged',
            oldCombo,
            newCombo: this.score.combo,
            multiplier: this.score.multiplier,
          });
        }

        if (t.kind === ThreatKind.Splitter && t.lifeState === ThreatLifeState.Deflected && t.radius > CORE_RADIUS + 30) {
          this.spawnSplitThreats(t);
        }
      }
    }
  }

  private resolveRicochetCollisions() {
    for (const ricochet of this.threats) {
      if (ricochet.lifeState !== ThreatLifeState.Ricocheting) continue;

      for (const target of this.threats) {
        if (target === ricochet) continue;
        if (target.lifeState !== ThreatLifeState.Approaching && target.lifeState !== ThreatLifeState.Stunned) continue;

        const radialDist = Math.abs(ricochet.radius - target.radius);
        if (radialDist > 25) continue;

        const angDelta = absAngleDelta(ricochet.angle, target.angle);
        if (angDelta > ricochet.collisionRadius + target.collisionRadius) continue;

        target.lifeState = ThreatLifeState.Deflected;
        ricochet.lifeState = ThreatLifeState.Deflected;

        const points = Math.floor(SCORE_RICOCHET_KILL * this.score.multiplier);
        this.score.total += points;
        this.score.ricochetKills++;
        this.score.combo++;
        if (this.score.combo > this.score.maxCombo) {
          this.score.maxCombo = this.score.combo;
        }
        this.score.multiplier = comboToMultiplier(this.score.combo);

        this.events.push({ type: 'ricochetKill', threatId: target.id, angle: target.angle });
        break;
      }
    }
  }

  private spawnSplitThreats(parent: ThreatEntity) {
    const offset = 0.3;
    for (const dir of [-1, 1]) {
      const splitThreat: ThreatEntity = {
        id: nextEntityId++,
        kind: ThreatKind.Standard,
        spawnTick: this.tick,
        radius: parent.radius + 20,
        angle: normalizeAngle(parent.angle + offset * dir),
        radialVelocity: parent.radialVelocity * 0.7,
        angularVelocity: 0,
        wobblePhase: 0,
        wobbleAmplitude: 0,
        collisionRadius: 0.10,
        lifeState: ThreatLifeState.Approaching,
        telegraphTicks: 0,
        isTelegraph: false,
        hasShield: false,
        stunTicksRemaining: 0,
        ricochetSourceAngle: 0,
      };
      this.threats.push(splitThreat);
    }
  }

  private updateScore() {
    if (this.tick > 0 && this.tick % SURVIVAL_BONUS_INTERVAL_TICKS === 0) {
      const bonus = Math.floor(this.score.multiplier * SURVIVAL_BONUS_BASE);
      this.score.total += bonus;
      this.events.push({ type: 'survivalBonus', points: bonus });
    }
  }

  private updateDifficulty() {
    const newPhase = computePhase(this.tick);
    if (newPhase !== this.difficulty.phase) {
      this.difficulty.phase = newPhase;
      const params = PHASE_PARAMS[newPhase];
      this.difficulty.spawnIntervalTicks = params.spawnInterval;
      this.difficulty.maxConcurrentThreats = params.maxConcurrent;
      this.difficulty.speedMultiplier = params.speedMult;
      this.events.push({ type: 'difficultyPhaseChanged', newPhase });
    }

    const phaseSecs = this.difficulty.elapsedTicks * FIXED_DT;
    let phaseStart: number;
    switch (this.difficulty.phase) {
      case DifficultyPhase.Tutorial: phaseStart = 0; break;
      case DifficultyPhase.Pressure: phaseStart = 25; break;
      case DifficultyPhase.Escalation: phaseStart = 70; break;
      case DifficultyPhase.Chaos: phaseStart = 140; break;
    }
    const phaseLength = this.difficulty.phase === DifficultyPhase.Chaos ? 180 : 45;
    this.difficulty.pressureLevel = Math.min(1, (phaseSecs - phaseStart) / phaseLength);
  }

  private cleanupEntities() {
    this.threats = this.threats.filter(t => {
      if (t.lifeState === ThreatLifeState.Approaching) return true;
      if (t.lifeState === ThreatLifeState.Stunned) return true;
      if (t.lifeState === ThreatLifeState.Ricocheting) return true;
      return this.tick - t.spawnTick < 30;
    });
    this.blasts = this.blasts.filter(b => b.active);
  }

  isDead(): boolean {
    return this.player.health <= 0;
  }
}
