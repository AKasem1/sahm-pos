import { describe, expect, it } from 'vitest';
import { RetryPolicy } from '../tokens/mock-config.token';
import { backoffDelay, backoffSchedule } from './backoff';

const policy: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 100,
  maxDelayMs: 2000,
  factor: 2,
  jitter: 0.5,
};

describe('backoffDelay', () => {
  it('grows exponentially before jitter (rand=0 → no shrink)', () => {
    expect(backoffDelay(1, policy, () => 0)).toBe(100);
    expect(backoffDelay(2, policy, () => 0)).toBe(200);
    expect(backoffDelay(3, policy, () => 0)).toBe(400);
    expect(backoffDelay(4, policy, () => 0)).toBe(800);
  });

  it('caps at maxDelayMs', () => {
    expect(backoffDelay(10, policy, () => 0)).toBe(2000);
  });

  it('applies full jitter (rand=1 shrinks by jitter fraction)', () => {
    // capped 400 with jitter 0.5 and rand 1 → 400 - 200 = 200
    expect(backoffDelay(3, policy, () => 1)).toBe(200);
  });

  it('never returns a negative delay', () => {
    expect(backoffDelay(1, policy, () => 1)).toBeGreaterThanOrEqual(0);
  });
});

describe('backoffSchedule', () => {
  it('produces one delay per attempt using the jitter midpoint', () => {
    const schedule = backoffSchedule(policy);
    expect(schedule).toHaveLength(policy.maxAttempts);
    // attempt 1: 100 - (100*0.5*0.5) = 75
    expect(schedule[0]).toBe(75);
  });
});
