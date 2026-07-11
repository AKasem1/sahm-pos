import { RetryPolicy } from '../tokens/mock-config.token';

/**
 * Exponential backoff with full jitter (§8, AI retries + offline sync).
 *
 * `attempt` is 1-based (the delay *before* attempt N). The exponential term is
 * capped at `maxDelayMs`; jitter then randomly shrinks the delay by up to
 * `jitter` fraction to avoid thundering-herd retries.
 *
 * `rand` is injectable purely so tests can make the schedule deterministic.
 */
export function backoffDelay(
  attempt: number,
  policy: RetryPolicy,
  rand: () => number = Math.random,
): number {
  const exp = policy.baseDelayMs * Math.pow(policy.factor, Math.max(0, attempt - 1));
  const capped = Math.min(exp, policy.maxDelayMs);
  const jitterAmount = capped * policy.jitter * rand();
  return Math.round(capped - jitterAmount);
}

/**
 * Produces the full delay schedule for a policy (useful for tests + docs).
 * Uses the midpoint of the jitter window (`rand` = 0.5) for a stable schedule.
 */
export function backoffSchedule(policy: RetryPolicy): number[] {
  return Array.from({ length: policy.maxAttempts }, (_, i) =>
    backoffDelay(i + 1, policy, () => 0.5),
  );
}
