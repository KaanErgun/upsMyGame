import {
  SHIELD_RADIUS,
  CORE_RADIUS,
  ARENA_RADIUS,
  TAU,
  PI,
  BLAST_COOLDOWN_TICKS,
  SLAM_COOLDOWN_TICKS,
  SLAM_CHARGE_TICKS,
  SLAM_ARC,
  FIXED_TIMESTEP_HZ,
  BLAST_COOLDOWN_MULT,
  SLAM_COOLDOWN_MULT,
  SLAM_ARC_MULT,
  SHIELD_ARC_MULT,
  WEAPON_XP_THRESHOLDS,
  WEAPON_MAX_LEVEL,
} from './constants';
import { lerpAngle, lerp, normalizeAngle } from './math';
import type { RenderSnapshot, ThreatEntity, GameEventType } from './types';
import { ThreatKind, ThreatLifeState, DeflectQuality } from './types';

interface VFX {
  type: string;
  x: number;
  y: number;
  angle: number;
  startTime: number;
  duration: number;
  intensity: number;
  quality?: DeflectQuality;
  kind?: ThreatKind;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  startTime: number;
  color: string;
}

const THREAT_COLORS: Record<ThreatKind, { fill: string; stroke: string; glow: string }> = {
  [ThreatKind.Standard]: { fill: '#ef4444', stroke: '#fca5a5', glow: '#ef4444' },
  [ThreatKind.Fast]: { fill: '#f97316', stroke: '#fdba74', glow: '#f97316' },
  [ThreatKind.Narrow]: { fill: '#eab308', stroke: '#fde047', glow: '#eab308' },
  [ThreatKind.Wobble]: { fill: '#06b6d4', stroke: '#67e8f9', glow: '#06b6d4' },
  [ThreatKind.Splitter]: { fill: '#ec4899', stroke: '#f9a8d4', glow: '#ec4899' },
  [ThreatKind.Shielded]: { fill: '#a855f7', stroke: '#c084fc', glow: '#a855f7' },
};

const QUALITY_COLORS: Record<DeflectQuality, string> = {
  [DeflectQuality.Perfect]: '#22d3ee',
  [DeflectQuality.Good]: '#4ade80',
  [DeflectQuality.Scrape]: '#facc15',
};

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cx = 0;
  private cy = 0;
  private scale = 1;
  private vfxList: VFX[] = [];
  private floatingTexts: FloatingText[] = [];
  private prevSnapshot: RenderSnapshot | null = null;
  private shakeX = 0;
  private shakeY = 0;
  private shakeDecay = 0;
  private pulsePhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cx = rect.width / 2;
    this.cy = rect.height / 2;
    this.scale = Math.min(rect.width, rect.height) / 750;
  }

  processEvents(events: GameEventType[], now: number) {
    for (const ev of events) {
      if (ev.type === 'threatDeflected') {
        const r = SHIELD_RADIUS * this.scale;
        const x = this.cx + Math.cos(ev.angle) * r;
        const y = this.cy - Math.sin(ev.angle) * r;
        this.vfxList.push({
          type: 'shockwave', x, y, angle: ev.angle, startTime: now, duration: 0.4,
          intensity: ev.quality === DeflectQuality.Perfect ? 1.0 : ev.quality === DeflectQuality.Good ? 0.7 : 0.4,
          quality: ev.quality, kind: ev.kind,
        });
        this.vfxList.push({
          type: 'flash', x, y, angle: ev.angle, startTime: now, duration: 0.2, intensity: 1, quality: ev.quality,
        });
        const scoreText = ev.quality === DeflectQuality.Perfect ? 'PERFECT!' :
                         ev.quality === DeflectQuality.Good ? 'GOOD' : 'SCRAPE';
        this.floatingTexts.push({ text: scoreText, x, y: y - 20, startTime: now, color: QUALITY_COLORS[ev.quality] });
      }
      if (ev.type === 'playerDamaged') {
        this.shakeDecay = 0.3;
      }
      if (ev.type === 'playerDied') {
        this.shakeDecay = 1.0;
      }
      if (ev.type === 'threatMissed') {
        const r = CORE_RADIUS * this.scale;
        const x = this.cx + Math.cos(ev.angle) * r;
        const y = this.cy - Math.sin(ev.angle) * r;
        this.vfxList.push({ type: 'miss', x, y, angle: ev.angle, startTime: now, duration: 0.5, intensity: 1 });
      }
      if (ev.type === 'blastFired') {
        this.vfxList.push({
          type: 'blastMuzzle', x: this.cx, y: this.cy, angle: ev.angle,
          startTime: now, duration: 0.25, intensity: 1,
        });
      }
      if (ev.type === 'blastHit') {
        const r = SHIELD_RADIUS * this.scale * 1.5;
        const x = this.cx + Math.cos(ev.angle) * r;
        const y = this.cy - Math.sin(ev.angle) * r;
        this.vfxList.push({ type: 'blastImpact', x, y, angle: ev.angle, startTime: now, duration: 0.35, intensity: 1 });
        this.floatingTexts.push({ text: 'BLAST!', x, y: y - 20, startTime: now, color: '#fb923c' });
      }
      if (ev.type === 'slamActivated') {
        this.vfxList.push({
          type: 'slamWave', x: this.cx, y: this.cy, angle: ev.angle,
          startTime: now, duration: 0.4, intensity: 1,
        });
        this.shakeDecay = 0.15;
      }
      if (ev.type === 'shieldBroken') {
        const r = SHIELD_RADIUS * this.scale * 0.8;
        const x = this.cx + Math.cos(ev.angle) * r;
        const y = this.cy - Math.sin(ev.angle) * r;
        this.vfxList.push({ type: 'shieldBreak', x, y, angle: ev.angle, startTime: now, duration: 0.5, intensity: 1 });
        this.floatingTexts.push({ text: 'SHIELD BREAK!', x, y: y - 20, startTime: now, color: '#c084fc' });
      }
      if (ev.type === 'threatStunned') {
        const r = SHIELD_RADIUS * this.scale * 0.8;
        const x = this.cx + Math.cos(ev.angle) * r;
        const y = this.cy - Math.sin(ev.angle) * r;
        this.vfxList.push({ type: 'stunEffect', x, y, angle: ev.angle, startTime: now, duration: 0.4, intensity: 1 });
      }
      if (ev.type === 'ricochetKill') {
        const r = SHIELD_RADIUS * this.scale;
        const x = this.cx + Math.cos(ev.angle) * r;
        const y = this.cy - Math.sin(ev.angle) * r;
        this.vfxList.push({ type: 'ricochetExplosion', x, y, angle: ev.angle, startTime: now, duration: 0.4, intensity: 1 });
        this.floatingTexts.push({ text: 'RICOCHET!', x, y: y - 20, startTime: now, color: '#22d3ee' });
      }
      if (ev.type === 'energyDenied') {
        this.vfxList.push({
          type: 'energyDenied', x: this.cx, y: this.cy, angle: 0,
          startTime: now, duration: 0.3, intensity: 1,
        });
      }
      if (ev.type === 'pulseFired') {
        this.vfxList.push({
          type: 'pulseWave', x: this.cx, y: this.cy, angle: 0,
          startTime: now, duration: 0.8, intensity: 1,
        });
      }
      if (ev.type === 'weaponLevelUp') {
        this.vfxList.push({
          type: 'levelUp', x: this.cx, y: this.cy, angle: 0,
          startTime: now, duration: 1.0, intensity: 1,
        });
        const weaponLabel = ev.weapon.toUpperCase();
        this.floatingTexts.push({
          text: `${weaponLabel} LV${ev.newLevel}!`,
          x: this.cx,
          y: this.cy - ARENA_RADIUS * this.scale * 0.5,
          startTime: now,
          color: '#a78bfa',
        });
      }
      if (ev.type === 'pulseUnlocked') {
        this.vfxList.push({
          type: 'levelUp', x: this.cx, y: this.cy, angle: 0,
          startTime: now, duration: 1.2, intensity: 1.5,
        });
        this.floatingTexts.push({
          text: 'PULSE UNLOCKED!',
          x: this.cx,
          y: this.cy - ARENA_RADIUS * this.scale * 0.6,
          startTime: now,
          color: '#c084fc',
        });
      }
      if (ev.type === 'playerHealed') {
        this.vfxList.push({
          type: 'heal', x: this.cx, y: this.cy, angle: 0,
          startTime: now, duration: 0.6, intensity: 1,
        });
        this.floatingTexts.push({
          text: '+1 HP',
          x: this.cx - 60 * this.scale,
          y: this.cy + ARENA_RADIUS * this.scale * 0.3,
          startTime: now,
          color: '#4ade80',
        });
      }
    }
  }

  render(snapshot: RenderSnapshot, alpha: number, now: number) {
    const ctx = this.ctx;
    const s = this.scale;
    const w = this.canvas.getBoundingClientRect().width;
    const h = this.canvas.getBoundingClientRect().height;

    this.updateShake(now);
    this.pulsePhase += 0.02;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this.drawBackground(w, h);
    this.drawArena(s, snapshot);
    this.drawEnergyRing(s, snapshot, alpha);
    this.drawThreatTrails(s, snapshot);
    this.drawThreats(s, snapshot, alpha, now);
    this.drawTelegraphs(s, snapshot);
    this.drawBlasts(s, snapshot, alpha, now);
    this.drawShield(s, snapshot, alpha);
    this.drawCore(s, snapshot);
    this.drawCooldownIndicators(s, snapshot, alpha);
    this.drawPulseOverlay(s, snapshot, now);
    this.drawWeaponLevels(s, snapshot);
    this.drawVFX(now);
    this.drawFloatingTexts(now);

    ctx.restore();

    this.prevSnapshot = snapshot;
    this.cleanupVFX(now);
  }

  private drawBackground(w: number, h: number) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, '#0a0e1a');
    gradient.addColorStop(0.5, '#060a14');
    gradient.addColorStop(1, '#020408');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const s = this.scale;
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.15)';
    ctx.lineWidth = 1;
    for (let r = 50; r <= ARENA_RADIUS + 50; r += 50) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r * s, 0, TAU);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(a) * (ARENA_RADIUS + 50) * s, this.cy - Math.sin(a) * (ARENA_RADIUS + 50) * s);
      ctx.stroke();
    }
  }

  private drawArena(s: number, snapshot: RenderSnapshot) {
    const ctx = this.ctx;
    const dangerPulse = Math.sin(this.pulsePhase * 2) * 0.3 + 0.7;
    const healthRatio = snapshot.player.health / snapshot.player.maxHealth;

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, SHIELD_RADIUS * s, 0, TAU);
    const ringAlpha = healthRatio < 0.4 ? 0.15 + (1 - healthRatio) * 0.1 * dangerPulse : 0.08;
    ctx.strokeStyle = healthRatio < 0.4
      ? `rgba(239, 68, 68, ${ringAlpha})`
      : `rgba(56, 189, 248, ${ringAlpha})`;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
  }

  private drawEnergyRing(s: number, snapshot: RenderSnapshot, alpha: number) {
    const ctx = this.ctx;
    const energyRatio = snapshot.player.energy / snapshot.player.maxEnergy;
    if (energyRatio <= 0) return;

    let playerAngle = snapshot.player.angle;
    if (this.prevSnapshot) {
      playerAngle = lerpAngle(this.prevSnapshot.player.angle, snapshot.player.angle, alpha);
    }

    const energyArc = TAU * energyRatio;
    const startAngle = -(playerAngle + energyArc / 2);
    const endAngle = -(playerAngle - energyArc / 2);
    const ringRadius = (SHIELD_RADIUS - 14) * s;

    let r: number, g: number, b: number;
    if (energyRatio > 0.6) {
      r = 56; g = 189; b = 248;
    } else if (energyRatio > 0.3) {
      r = 250; g = 204; b = 21;
    } else {
      r = 239; g = 68; b = 68;
    }

    const pulse = 0.4 + Math.sin(this.pulsePhase * 2) * 0.1;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, ringRadius, startAngle, endAngle);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pulse})`;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, ringRadius, startAngle, endAngle);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pulse * 0.3})`;
    ctx.lineWidth = 6 * s;
    ctx.stroke();
  }

  private drawThreatTrails(s: number, snapshot: RenderSnapshot) {
    const ctx = this.ctx;
    for (const t of snapshot.threats) {
      if (t.lifeState === ThreatLifeState.Ricocheting) {
        this.drawRicochetTrail(ctx, t, s);
        continue;
      }
      if (t.lifeState !== ThreatLifeState.Approaching) continue;
      const colors = THREAT_COLORS[t.kind];
      const approachNorm = 1 - (t.radius / (ARENA_RADIUS + 50));

      for (let i = 1; i <= 5; i++) {
        const trailR = t.radius + i * 8;
        if (trailR > ARENA_RADIUS + 50) continue;
        const trailAlpha = (1 - i / 6) * 0.3 * approachNorm;
        const x = this.cx + Math.cos(t.angle) * trailR * s;
        const y = this.cy - Math.sin(t.angle) * trailR * s;
        ctx.beginPath();
        ctx.arc(x, y, (4 - i * 0.5) * s, 0, TAU);
        ctx.fillStyle = colors.fill + Math.floor(trailAlpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }
    }
  }

  private drawRicochetTrail(ctx: CanvasRenderingContext2D, t: ThreatEntity, s: number) {
    for (let i = 1; i <= 6; i++) {
      const trailR = t.radius - i * 6;
      if (trailR < SHIELD_RADIUS) continue;
      const trailAlpha = (1 - i / 7) * 0.5;
      const x = this.cx + Math.cos(t.angle) * trailR * s;
      const y = this.cy - Math.sin(t.angle) * trailR * s;
      ctx.beginPath();
      ctx.arc(x, y, (3 - i * 0.3) * s, 0, TAU);
      ctx.fillStyle = `rgba(34, 211, 238, ${trailAlpha})`;
      ctx.fill();
    }
  }

  private drawThreats(s: number, snapshot: RenderSnapshot, alpha: number, now: number) {
    const ctx = this.ctx;

    for (const t of snapshot.threats) {
      if (t.lifeState === ThreatLifeState.Deflected) {
        this.drawDeflectedThreat(ctx, t, s, now);
        continue;
      }
      if (t.lifeState === ThreatLifeState.Ricocheting) {
        this.drawRicochetingThreat(ctx, t, s, alpha);
        continue;
      }
      if (t.lifeState === ThreatLifeState.Stunned) {
        this.drawStunnedThreat(ctx, t, s, alpha, now);
        continue;
      }
      if (t.lifeState !== ThreatLifeState.Approaching) continue;

      let drawRadius = t.radius;
      let drawAngle = t.angle;
      if (this.prevSnapshot) {
        const prevT = this.prevSnapshot.threats.find(pt => pt.id === t.id);
        if (prevT) {
          drawRadius = lerp(prevT.radius, t.radius, alpha);
          drawAngle = lerpAngle(prevT.angle, t.angle, alpha);
        }
      }

      const x = this.cx + Math.cos(drawAngle) * drawRadius * s;
      const y = this.cy - Math.sin(drawAngle) * drawRadius * s;
      const colors = THREAT_COLORS[t.kind];
      const approachNorm = 1 - (drawRadius / (ARENA_RADIUS + 50));
      const size = (6 + approachNorm * 4) * s;

      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 15 * s * (0.6 + approachNorm * 0.4);

      this.drawThreatShape(ctx, t.kind, x, y, size, drawAngle, now);

      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
      ctx.restore();

      if (t.hasShield) {
        this.drawShieldOverlay(ctx, x, y, size, s, now);
      }

      if (drawRadius < SHIELD_RADIUS * 1.5) {
        const warningAlpha = (1 - (drawRadius - SHIELD_RADIUS) / (SHIELD_RADIUS * 0.5)) * 0.6;
        if (warningAlpha > 0) {
          ctx.beginPath();
          ctx.arc(x, y, size + 4 * s, 0, TAU);
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(warningAlpha, 0.5)})`;
          ctx.lineWidth = 1 * s;
          ctx.setLineDash([3 * s, 3 * s]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  private drawThreatShape(
    ctx: CanvasRenderingContext2D, kind: ThreatKind,
    x: number, y: number, size: number, drawAngle: number, now: number
  ) {
    ctx.beginPath();
    if (kind === ThreatKind.Fast) {
      const angle = Math.atan2(-(y - this.cy), x - this.cx);
      ctx.moveTo(x + Math.cos(angle) * size * 1.5, y - Math.sin(angle) * size * 1.5);
      ctx.lineTo(x + Math.cos(angle + 2.4) * size, y - Math.sin(angle + 2.4) * size);
      ctx.lineTo(x + Math.cos(angle - 2.4) * size, y - Math.sin(angle - 2.4) * size);
      ctx.closePath();
    } else if (kind === ThreatKind.Narrow) {
      ctx.ellipse(x, y, size * 0.5, size * 1.2, -drawAngle, 0, TAU);
    } else if (kind === ThreatKind.Splitter) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + now * 2;
        const px = x + Math.cos(a) * size;
        const py = y + Math.sin(a) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (kind === ThreatKind.Shielded) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + now * 0.5;
        const px = x + Math.cos(a) * size;
        const py = y + Math.sin(a) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(x, y, size, 0, TAU);
    }
  }

  private drawShieldOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, s: number, now: number) {
    const pulse = Math.sin(now * 4) * 0.15 + 0.85;
    const overlaySize = size * 1.5 * pulse;

    ctx.save();
    ctx.strokeStyle = `rgba(168, 85, 247, 0.7)`;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = x + Math.cos(a) * overlaySize;
      const py = y + Math.sin(a) * overlaySize;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = `rgba(168, 85, 247, 0.2)`;
    ctx.lineWidth = 4 * s;
    ctx.stroke();
    ctx.restore();
  }

  private drawStunnedThreat(ctx: CanvasRenderingContext2D, t: ThreatEntity, s: number, alpha: number, now: number) {
    let drawRadius = t.radius;
    let drawAngle = t.angle;
    if (this.prevSnapshot) {
      const prevT = this.prevSnapshot.threats.find(pt => pt.id === t.id);
      if (prevT) {
        drawRadius = lerp(prevT.radius, t.radius, alpha);
        drawAngle = lerpAngle(prevT.angle, t.angle, alpha);
      }
    }

    const x = this.cx + Math.cos(drawAngle) * drawRadius * s;
    const y = this.cy - Math.sin(drawAngle) * drawRadius * s;
    const size = 8 * s;

    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(now * 10) * 0.2;
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 10 * s;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = '#164e63';
    ctx.fill();
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    const starCount = 3;
    for (let i = 0; i < starCount; i++) {
      const orbit = now * 5 + (i / starCount) * TAU;
      const sx = x + Math.cos(orbit) * size * 1.4;
      const sy = y + Math.sin(orbit) * size * 1.4;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 * s, 0, TAU);
      ctx.fillStyle = '#fde047';
      ctx.fill();
    }

    ctx.restore();
  }

  private drawRicochetingThreat(ctx: CanvasRenderingContext2D, t: ThreatEntity, s: number, alpha: number) {
    let drawRadius = t.radius;
    let drawAngle = t.angle;
    if (this.prevSnapshot) {
      const prevT = this.prevSnapshot.threats.find(pt => pt.id === t.id);
      if (prevT) {
        drawRadius = lerp(prevT.radius, t.radius, alpha);
        drawAngle = lerpAngle(prevT.angle, t.angle, alpha);
      }
    }

    const x = this.cx + Math.cos(drawAngle) * drawRadius * s;
    const y = this.cy - Math.sin(drawAngle) * drawRadius * s;
    const size = 7 * s;

    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 20 * s;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, size * 1.8, 0, TAU);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.restore();
  }

  private drawDeflectedThreat(ctx: CanvasRenderingContext2D, t: ThreatEntity, s: number, now: number) {
    const colors = THREAT_COLORS[t.kind];
    const age = (now - t.spawnTick / 60) * 3;
    if (age > 1) return;
    const fadeAlpha = 1 - age;
    const expandRadius = t.radius + age * 40;
    const x = this.cx + Math.cos(t.angle) * expandRadius * s;
    const y = this.cy - Math.sin(t.angle) * expandRadius * s;
    ctx.globalAlpha = fadeAlpha * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, (6 + age * 10) * s, 0, TAU);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawTelegraphs(s: number, snapshot: RenderSnapshot) {
    const ctx = this.ctx;
    for (const t of snapshot.threats) {
      if (t.lifeState !== ThreatLifeState.Approaching) continue;
      if (t.radius < ARENA_RADIUS * 0.7) continue;

      const approachNorm = t.radius / (ARENA_RADIUS + 50);
      const telegraphAlpha = approachNorm * 0.4;

      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      const farX = this.cx + Math.cos(t.angle) * (ARENA_RADIUS + 60) * s;
      const farY = this.cy - Math.sin(t.angle) * (ARENA_RADIUS + 60) * s;
      ctx.lineTo(farX, farY);

      const colors = THREAT_COLORS[t.kind];
      ctx.strokeStyle = colors.fill + Math.floor(telegraphAlpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([6 * s, 8 * s]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawBlasts(s: number, snapshot: RenderSnapshot, alpha: number, _now: number) {
    const ctx = this.ctx;
    for (const b of snapshot.blasts) {
      if (!b.active) continue;

      let drawRadius = b.radius;
      if (this.prevSnapshot) {
        const prevB = this.prevSnapshot.blasts.find(pb => pb.id === b.id);
        if (prevB) {
          drawRadius = lerp(prevB.radius, b.radius, alpha);
        }
      }

      const age = (snapshot.tick - b.spawnTick) / FIXED_TIMESTEP_HZ;
      const fadeAlpha = Math.max(0, 1 - age * 1.5);

      ctx.save();
      ctx.shadowColor = '#fb923c';
      ctx.shadowBlur = 15 * s;

      const innerR = (drawRadius - 8) * s;
      const outerR = (drawRadius + 8) * s;
      const halfWidth = 0.08 + fadeAlpha * 0.04;

      const startAngle = -(b.angle + halfWidth);
      const endAngle = -(b.angle - halfWidth);

      ctx.beginPath();
      ctx.arc(this.cx, this.cy, outerR, startAngle, endAngle);
      ctx.arc(this.cx, this.cy, innerR, endAngle, startAngle, true);
      ctx.closePath();

      const gradient = ctx.createRadialGradient(this.cx, this.cy, innerR, this.cx, this.cy, outerR);
      gradient.addColorStop(0, `rgba(251, 146, 60, ${fadeAlpha * 0.3})`);
      gradient.addColorStop(0.5, `rgba(251, 146, 60, ${fadeAlpha * 0.9})`);
      gradient.addColorStop(1, `rgba(251, 146, 60, ${fadeAlpha * 0.3})`);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.cx, this.cy, drawRadius * s, startAngle, endAngle);
      ctx.strokeStyle = `rgba(255, 255, 255, ${fadeAlpha * 0.8})`;
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawShield(s: number, snapshot: RenderSnapshot, alpha: number) {
    const ctx = this.ctx;
    let playerAngle = snapshot.player.angle;
    if (this.prevSnapshot) {
      playerAngle = lerpAngle(this.prevSnapshot.player.angle, snapshot.player.angle, alpha);
    }

    const isSlamActive = snapshot.player.slamActiveTicks > 0;
    const isCharging = snapshot.player.slamCharging;
    const shieldArcLevel = SHIELD_ARC_MULT[snapshot.weapons?.shieldLevel ?? 1] ?? 1;
    const slamArcLevel = SLAM_ARC_MULT[snapshot.weapons?.slamLevel ?? 1] ?? 1;
    let effectiveArc = snapshot.player.shieldArc * shieldArcLevel;

    if (isSlamActive) {
      effectiveArc = SLAM_ARC * slamArcLevel;
    } else if (isCharging) {
      const chargeTick = snapshot.tick - snapshot.player.slamChargeTick;
      const chargeRatio = Math.min(chargeTick / SLAM_CHARGE_TICKS, 1);
      effectiveArc = lerp(snapshot.player.shieldArc * shieldArcLevel, SLAM_ARC * slamArcLevel, chargeRatio * 0.5);
    }

    const halfArc = effectiveArc / 2;
    const startAngle = -(playerAngle + halfArc);
    const endAngle = -(playerAngle - halfArc);

    const comboLevel = snapshot.score.combo;
    let shieldColor: string;
    let glowIntensity: number;

    if (isSlamActive) {
      shieldColor = '#fb923c';
      glowIntensity = 30;
    } else if (isCharging) {
      const pulse = Math.sin(this.pulsePhase * 8) * 0.3 + 0.7;
      shieldColor = `rgba(251, 146, 60, ${pulse})`;
      glowIntensity = 20;
    } else if (comboLevel >= 20) {
      shieldColor = '#22d3ee';
      glowIntensity = 25;
    } else if (comboLevel >= 10) {
      shieldColor = '#4ade80';
      glowIntensity = 18;
    } else if (comboLevel >= 5) {
      shieldColor = '#38bdf8';
      glowIntensity = 12;
    } else {
      shieldColor = '#e2e8f0';
      glowIntensity = 6;
    }

    ctx.save();
    ctx.shadowColor = isSlamActive ? '#fb923c' : shieldColor;
    ctx.shadowBlur = glowIntensity * s;

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, SHIELD_RADIUS * s, startAngle, endAngle);
    ctx.strokeStyle = shieldColor;
    ctx.lineWidth = isSlamActive ? 10 * s : 6 * s;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, SHIELD_RADIUS * s, startAngle, endAngle);
    ctx.strokeStyle = isSlamActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    ctx.restore();

    if (comboLevel >= 5 && !isSlamActive) {
      const auraRadius = SHIELD_RADIUS * s + 8 * s + Math.sin(this.pulsePhase * 3) * 3 * s;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, auraRadius, startAngle, endAngle);
      const auraAlpha = Math.min(comboLevel / 40, 0.4);
      ctx.strokeStyle = shieldColor + Math.floor(auraAlpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 3 * s;
      ctx.stroke();
    }
  }

  private drawCooldownIndicators(s: number, snapshot: RenderSnapshot, alpha: number) {
    const ctx = this.ctx;
    let playerAngle = snapshot.player.angle;
    if (this.prevSnapshot) {
      playerAngle = lerpAngle(this.prevSnapshot.player.angle, snapshot.player.angle, alpha);
    }

    const blastCdTicks = Math.floor(BLAST_COOLDOWN_TICKS * (BLAST_COOLDOWN_MULT[snapshot.weapons?.blastLevel ?? 1] ?? 1));
    const blastCdRemaining = Math.max(0, snapshot.player.blastCooldownTick - snapshot.tick);
    if (blastCdRemaining > 0) {
      const ratio = blastCdRemaining / blastCdTicks;
      const indicatorAngle = normalizeAngle(playerAngle + PI * 0.6);
      const indicatorR = (SHIELD_RADIUS + 22) * s;
      const ix = this.cx + Math.cos(indicatorAngle) * indicatorR;
      const iy = this.cy - Math.sin(indicatorAngle) * indicatorR;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ix, iy, 8 * s, -PI / 2, -PI / 2 + TAU * (1 - ratio));
      ctx.strokeStyle = `rgba(251, 146, 60, 0.6)`;
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ix, iy, 8 * s, 0, TAU);
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.15)';
      ctx.lineWidth = 1 * s;
      ctx.stroke();
      ctx.restore();
    }

    const slamCdTicks = Math.floor(SLAM_COOLDOWN_TICKS * (SLAM_COOLDOWN_MULT[snapshot.weapons?.slamLevel ?? 1] ?? 1));
    const slamCdRemaining = Math.max(0, snapshot.player.slamCooldownTick - snapshot.tick);
    if (slamCdRemaining > 0) {
      const ratio = slamCdRemaining / slamCdTicks;
      const indicatorAngle = normalizeAngle(playerAngle - PI * 0.6);
      const indicatorR = (SHIELD_RADIUS + 22) * s;
      const ix = this.cx + Math.cos(indicatorAngle) * indicatorR;
      const iy = this.cy - Math.sin(indicatorAngle) * indicatorR;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ix, iy, 8 * s, -PI / 2, -PI / 2 + TAU * (1 - ratio));
      ctx.strokeStyle = `rgba(168, 85, 247, 0.6)`;
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ix, iy, 8 * s, 0, TAU);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.lineWidth = 1 * s;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawCore(s: number, snapshot: RenderSnapshot) {
    const ctx = this.ctx;
    const healthRatio = snapshot.player.health / snapshot.player.maxHealth;
    const pulse = 1 + Math.sin(this.pulsePhase * 1.5) * 0.05;

    const gradient = ctx.createRadialGradient(
      this.cx, this.cy, 0,
      this.cx, this.cy, CORE_RADIUS * s * pulse
    );

    if (healthRatio > 0.6) {
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
      gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.3)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
    } else if (healthRatio > 0.3) {
      gradient.addColorStop(0, 'rgba(250, 204, 21, 0.9)');
      gradient.addColorStop(0.6, 'rgba(250, 204, 21, 0.3)');
      gradient.addColorStop(1, 'rgba(250, 204, 21, 0.05)');
    } else {
      const dangerPulse = Math.sin(this.pulsePhase * 4) * 0.3 + 0.7;
      gradient.addColorStop(0, `rgba(239, 68, 68, ${0.9 * dangerPulse})`);
      gradient.addColorStop(0.6, `rgba(239, 68, 68, ${0.3 * dangerPulse})`);
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
    }

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, CORE_RADIUS * s * pulse, 0, TAU);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, CORE_RADIUS * 0.4 * s, 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
  }

  private drawVFX(now: number) {
    const ctx = this.ctx;
    for (const vfx of this.vfxList) {
      const age = now - vfx.startTime;
      const progress = age / vfx.duration;
      if (progress > 1) continue;

      if (vfx.type === 'shockwave') {
        const radius = 10 + progress * 60 * this.scale * vfx.intensity;
        const alpha = (1 - progress) * 0.6;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, radius, 0, TAU);
        const color = vfx.quality ? QUALITY_COLORS[vfx.quality] : '#ffffff';
        ctx.strokeStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = (3 - progress * 2) * this.scale;
        ctx.stroke();
      }

      if (vfx.type === 'flash') {
        const alpha = (1 - progress) * 0.8;
        const radius = 15 * this.scale * (1 + progress * 0.5);
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, radius, 0, TAU);
        const color = vfx.quality ? QUALITY_COLORS[vfx.quality] : '#ffffff';
        ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }

      if (vfx.type === 'miss') {
        const alpha = (1 - progress) * 0.7;
        const radius = 8 + progress * 30 * this.scale;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, radius, 0, TAU);
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 2 * this.scale;
        ctx.stroke();

        ctx.beginPath();
        const crossSize = 6 * this.scale;
        ctx.moveTo(vfx.x - crossSize, vfx.y - crossSize);
        ctx.lineTo(vfx.x + crossSize, vfx.y + crossSize);
        ctx.moveTo(vfx.x + crossSize, vfx.y - crossSize);
        ctx.lineTo(vfx.x - crossSize, vfx.y + crossSize);
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 2 * this.scale;
        ctx.stroke();
      }

      if (vfx.type === 'blastMuzzle') {
        const r = (SHIELD_RADIUS + 5 + progress * 30) * this.scale;
        const alpha = (1 - progress) * 0.7;
        const halfW = 0.15 * (1 - progress * 0.5);
        const startA = -(vfx.angle + halfW);
        const endA = -(vfx.angle - halfW);

        ctx.save();
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 20 * this.scale;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, r, startA, endA);
        ctx.strokeStyle = `rgba(255, 200, 100, ${alpha})`;
        ctx.lineWidth = 4 * this.scale;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      if (vfx.type === 'blastImpact') {
        const alpha = (1 - progress) * 0.8;
        const radius = 10 + progress * 40 * this.scale;
        ctx.save();
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 15 * this.scale;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, radius, 0, TAU);
        ctx.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
        ctx.lineWidth = (3 - progress * 2) * this.scale;
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + progress * 2;
          const pLen = (15 + progress * 25) * this.scale;
          const px = vfx.x + Math.cos(a) * pLen;
          const py = vfx.y + Math.sin(a) * pLen;
          ctx.beginPath();
          ctx.arc(px, py, 2 * this.scale * (1 - progress), 0, TAU);
          ctx.fillStyle = `rgba(251, 146, 60, ${alpha})`;
          ctx.fill();
        }
        ctx.restore();
      }

      if (vfx.type === 'slamWave') {
        const alpha = (1 - progress) * 0.6;
        const waveR = (SHIELD_RADIUS - 5 + progress * 40) * this.scale;
        const halfArc = SLAM_ARC / 2;
        const startA = -(vfx.angle + halfArc);
        const endA = -(vfx.angle - halfArc);

        ctx.save();
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 25 * this.scale;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, waveR, startA, endA);
        ctx.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
        ctx.lineWidth = (8 - progress * 6) * this.scale;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.cx, this.cy, waveR + 5 * this.scale, startA, endA);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
        ctx.lineWidth = 2 * this.scale;
        ctx.stroke();
        ctx.restore();
      }

      if (vfx.type === 'shieldBreak') {
        const alpha = (1 - progress) * 0.9;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + progress * 3;
          const dist = (10 + progress * 40) * this.scale;
          const px = vfx.x + Math.cos(a) * dist;
          const py = vfx.y + Math.sin(a) * dist;
          const pSize = (4 - progress * 3) * this.scale;
          ctx.beginPath();
          ctx.moveTo(px - pSize, py);
          ctx.lineTo(px, py - pSize);
          ctx.lineTo(px + pSize, py);
          ctx.lineTo(px, py + pSize);
          ctx.closePath();
          ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
          ctx.fill();
        }
      }

      if (vfx.type === 'stunEffect') {
        const alpha = (1 - progress) * 0.7;
        const radius = 8 + progress * 25 * this.scale;
        ctx.save();
        ctx.setLineDash([4 * this.scale, 4 * this.scale]);
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, radius, 0, TAU);
        ctx.strokeStyle = `rgba(103, 232, 249, ${alpha})`;
        ctx.lineWidth = 2 * this.scale;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (vfx.type === 'ricochetExplosion') {
        const alpha = (1 - progress) * 0.8;
        const radius = 8 + progress * 35 * this.scale;
        ctx.save();
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 15 * this.scale;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, radius, 0, TAU);
        ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
        ctx.lineWidth = 2 * this.scale;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, radius * 0.6, 0, TAU);
        ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.3})`;
        ctx.fill();
        ctx.restore();
      }

      if (vfx.type === 'energyDenied') {
        const alpha = (1 - progress) * 0.5;
        const energyR = (SHIELD_RADIUS - 14) * this.scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, energyR, 0, TAU);
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 3 * this.scale;
        ctx.stroke();
        ctx.restore();
      }

      if (vfx.type === 'pulseWave') {
        const alpha = (1 - progress) * 0.5;
        const radius = CORE_RADIUS * this.scale + progress * (ARENA_RADIUS + 40) * this.scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, radius, 0, TAU);
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
        ctx.lineWidth = (6 - progress * 4) * this.scale;
        ctx.stroke();
        // Inner wave
        const innerR = radius * 0.7;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, innerR, 0, TAU);
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.5})`;
        ctx.lineWidth = 3 * this.scale;
        ctx.stroke();
        ctx.restore();
      }

      if (vfx.type === 'levelUp') {
        const alpha = (1 - progress) * 0.8;
        const radius = SHIELD_RADIUS * this.scale * (0.5 + progress * 1.5);
        ctx.save();
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 20 * this.scale;
        // Rising ring
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, radius, 0, TAU);
        ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
        ctx.lineWidth = (4 - progress * 3) * this.scale;
        ctx.stroke();
        // Sparkle particles
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + progress * 4;
          const dist = radius * (0.8 + progress * 0.4);
          const px = this.cx + Math.cos(a) * dist;
          const py = this.cy + Math.sin(a) * dist;
          ctx.beginPath();
          ctx.arc(px, py, (3 - progress * 2) * this.scale, 0, TAU);
          ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
          ctx.fill();
        }
        ctx.restore();
      }

      if (vfx.type === 'heal') {
        const alpha = (1 - progress) * 0.7;
        const radius = CORE_RADIUS * this.scale * (1 + progress * 0.5);
        ctx.save();
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 15 * this.scale;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, radius, 0, TAU);
        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.lineWidth = 3 * this.scale;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawFloatingTexts(now: number) {
    const ctx = this.ctx;
    for (const ft of this.floatingTexts) {
      const age = now - ft.startTime;
      if (age > 1) continue;
      const alpha = 1 - age;
      const yOffset = age * 40;
      ctx.save();
      ctx.font = `bold ${14 * this.scale}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fillText(ft.text, ft.x, ft.y - yOffset);
      ctx.restore();
    }
    this.floatingTexts = this.floatingTexts.filter(ft => now - ft.startTime < 1);
  }

  private updateShake(_now: number) {
    if (this.shakeDecay > 0) {
      const intensity = this.shakeDecay * 8;
      this.shakeX = (Math.random() - 0.5) * intensity;
      this.shakeY = (Math.random() - 0.5) * intensity;
      this.shakeDecay -= 0.016;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  private cleanupVFX(now: number) {
    this.vfxList = this.vfxList.filter(v => now - v.startTime < v.duration + 0.1);
  }

  private drawPulseOverlay(s: number, snapshot: RenderSnapshot, now: number) {
    if (!snapshot.weapons || snapshot.weapons.pulseActiveTicks <= 0) return;
    const ctx = this.ctx;

    const pulse = Math.sin(now * 6) * 0.1 + 0.2;
    const waveRadius = ARENA_RADIUS * s * 1.1;

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, waveRadius, 0, TAU);
    ctx.strokeStyle = `rgba(192, 132, 252, ${pulse})`;
    ctx.lineWidth = 4 * s;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, SHIELD_RADIUS * s, 0, TAU);
    const grad = ctx.createRadialGradient(
      this.cx, this.cy, CORE_RADIUS * s,
      this.cx, this.cy, ARENA_RADIUS * s
    );
    grad.addColorStop(0, 'rgba(192, 132, 252, 0.0)');
    grad.addColorStop(0.5, `rgba(192, 132, 252, ${pulse * 0.15})`);
    grad.addColorStop(1, 'rgba(192, 132, 252, 0.0)');
    ctx.fillStyle = grad;
    ctx.arc(this.cx, this.cy, ARENA_RADIUS * s, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawWeaponLevels(s: number, snapshot: RenderSnapshot) {
    if (!snapshot.weapons) return;
    const ctx = this.ctx;
    const w = snapshot.weapons;

    const weapons: { label: string; level: number; xp: number; color: string; unlocked: boolean }[] = [
      { label: 'SHD', level: w.shieldLevel, xp: w.shieldXp, color: '#38bdf8', unlocked: true },
      { label: 'BLT', level: w.blastLevel, xp: w.blastXp, color: '#fb923c', unlocked: true },
      { label: 'SLM', level: w.slamLevel, xp: w.slamXp, color: '#a855f7', unlocked: true },
      { label: 'PLS', level: w.pulseLevel, xp: w.pulseXp, color: '#c084fc', unlocked: w.pulseUnlocked },
    ];

    const startX = this.cx - (weapons.length * 40 * s) / 2;
    const baseY = this.cy + (ARENA_RADIUS + 40) * s;

    ctx.save();
    for (let i = 0; i < weapons.length; i++) {
      const wp = weapons[i];
      const x = startX + i * 40 * s;

      if (!wp.unlocked) {
        ctx.globalAlpha = 0.25;
      }

      // Label
      ctx.font = `bold ${8 * s}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = wp.color;
      ctx.fillText(wp.label, x, baseY);

      // Level pips
      for (let lv = 1; lv <= 5; lv++) {
        const pipX = x - 8 * s + (lv - 1) * 4 * s;
        const pipY = baseY + 6 * s;
        ctx.beginPath();
        ctx.arc(pipX, pipY, 1.5 * s, 0, TAU);
        ctx.fillStyle = lv <= wp.level ? wp.color : 'rgba(100,116,139,0.3)';
        ctx.fill();
      }

      // XP bar (tiny)
      if (wp.level < WEAPON_MAX_LEVEL && wp.unlocked) {
        const threshold = WEAPON_XP_THRESHOLDS[wp.level] || 1;
        const ratio = Math.min(wp.xp / threshold, 1);
        const barW = 28 * s;
        const barH = 2 * s;
        const barX = x - barW / 2;
        const barY = baseY + 10 * s;

        ctx.fillStyle = 'rgba(100,116,139,0.2)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = wp.color + '80';
        ctx.fillRect(barX, barY, barW * ratio, barH);
      }

      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  getCenterX(): number { return this.cx; }
  getCenterY(): number { return this.cy; }
}
