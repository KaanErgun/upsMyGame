import { TAU, PI } from './constants';

export function normalizeAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}

export function angleDelta(from: number, to: number): number {
  const d = ((to - from) % TAU + TAU) % TAU;
  return d > PI ? d - TAU : d;
}

export function absAngleDelta(a: number, b: number): number {
  return Math.abs(angleDelta(a, b));
}

export function lerpAngle(from: number, to: number, t: number): number {
  const delta = angleDelta(from, to);
  return normalizeAngle(from + delta * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function screenToAngle(
  sx: number,
  sy: number,
  cx: number,
  cy: number
): number {
  const dx = sx - cx;
  const dy = -(sy - cy);
  return normalizeAngle(Math.atan2(dy, dx));
}
