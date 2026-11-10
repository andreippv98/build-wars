import type { SlotCategory } from "@/lib/models/envelope";

/**
 * Every timing and direction of the scene's motion in one place. Directions are unit vectors in
 * the model standard's axes (+Z points out of the motherboard toward the viewer), so nothing
 * here knows a product.
 */

export const ENTER_SECONDS = 0.45;
export const LEAVE_SECONDS = 0.25;
export const GHOST_FADE_SECONDS = 0.15;
export const DIM_OPACITY = 0.25;
export const GHOST_OPACITY = 0.45;

export const CAMERA_SECONDS = 0.6;
export const CAMERA_SECONDS_LOW_DETAIL = 0.3;
/** How long the camera rests on a newly added part before easing back. */
export const CAMERA_HOLD_SECONDS = 0.5;
/** Distance factor of the "toward the new part" move (below 1 = closer). */
export const CAMERA_NUDGE = 0.8;
/** Extra room around a framed slot. */
export const CAMERA_PADDING = 1.35;

export const FAN_RADIANS_PER_SECOND = 4 * Math.PI;

export const GLOW_PERIOD_SECONDS = 1.5;
export const GLOW_MIN = 0.05;
export const GLOW_MAX = 0.28;
/** Glow strength under reduced motion (no pulse). */
export const GLOW_STATIC = 0.18;

/**
 * How a part of each category slides in: it starts `distance` mm away toward `from` and travels
 * to its slot. `back` > 0 overshoots a little past the slot and settles (the "click" of RAM).
 */
export const ENTER: Record<
  SlotCategory,
  { from: readonly [number, number, number]; distance: number; back: number }
> = {
  motherboard: { from: [0, 0, 1], distance: 80, back: 0 },
  cpu_cooler: { from: [0, 0, 1], distance: 90, back: 0 },
  gpu: { from: [0, 0, 1], distance: 110, back: 0 },
  ram: { from: [0, 0, 1], distance: 70, back: 1.7 },
  psu: { from: [0, 0, 1], distance: 100, back: 0 },
};

/** Ease-out with an optional overshoot (`back` 0 = cubic ease-out). 0 at t=0, 1 at t=1. */
export function easeOut(t: number, back = 0): number {
  const u = t - 1;
  return 1 + (back + 1) * u * u * u + back * u * u;
}

/** Smooth start and stop, for the camera. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
