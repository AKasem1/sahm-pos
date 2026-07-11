import { InjectionToken } from '@angular/core';

/**
 * Injectable clock. Everything that reads "now" (age, priority derivation,
 * backoff jitter timestamps) goes through this so tests can pin time and assert
 * deterministic priority transitions (§7.3, Appendix A).
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => systemClock,
});
