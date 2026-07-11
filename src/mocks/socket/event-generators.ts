import { KitchenLoadLevel } from '../../app/core/models/kitchen.model';

/**
 * Pure helpers that decide the *next* simulated socket event (§9.2). Kept
 * separate from the RealtimeService so the progression logic is unit-testable
 * and deterministic when seeded.
 */

const LEVELS: readonly KitchenLoadLevel[] = ['low', 'medium', 'high', 'critical'];

/**
 * Random-walk the kitchen load one step up or down, biased slightly toward the
 * middle so the demo oscillates instead of pinning at an extreme.
 */
export function nextKitchenLevel(current: KitchenLoadLevel, roll: number): KitchenLoadLevel {
  const idx = LEVELS.indexOf(current);
  const goUp = roll > 0.5;
  let next = goUp ? idx + 1 : idx - 1;
  next = Math.max(0, Math.min(LEVELS.length - 1, next));
  return LEVELS[next]!;
}

/** Add symmetric jitter (± `jitterMs`) to a base interval. */
export function jitteredInterval(baseMs: number, jitterMs: number, rand: () => number): number {
  return Math.max(250, Math.round(baseMs + (rand() * 2 - 1) * jitterMs));
}
