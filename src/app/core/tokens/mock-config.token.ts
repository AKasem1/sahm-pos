import { InjectionToken } from '@angular/core';

/**
 * Central knobs for the mock backend (§9). Exposing latency + error injection
 * through a DI token means the live demo and the tests can flip failure modes
 * on demand without editing handler code.
 */
export interface MockConfig {
  /** Base artificial latency (ms) applied to REST handlers. */
  readonly restLatencyMs: number;
  /** Random jitter (ms) added on top of `restLatencyMs`. */
  readonly restJitterMs: number;
  /** Probability [0..1] that a REST mutation handler injects a 500. */
  readonly restErrorRate: number;

  /** AI: min/max delay before the first streamed chunk. */
  readonly aiFirstChunkMinMs: number;
  readonly aiFirstChunkMaxMs: number;
  /** AI: delay between streamed chunks. */
  readonly aiChunkMinMs: number;
  readonly aiChunkMaxMs: number;
  /** AI: probability [0..1] a suggestion request fails (to exercise retry). */
  readonly aiErrorRate: number;
  /** AI: hard timeout for a suggestion request. */
  readonly aiTimeoutMs: number;

  /** Retry policy shared by AI + offline sync. */
  readonly retry: RetryPolicy;

  /** Realtime cadence for the fake socket. */
  readonly socketOrderIntervalMs: number;
  readonly socketKitchenIntervalMs: number;
  readonly socketJitterMs: number;

  /** Polling fallback cadence. */
  readonly pollingIntervalMs: number;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** Multiplier applied per attempt (exponential base). */
  readonly factor: number;
  /** Full-jitter fraction [0..1]. */
  readonly jitter: number;
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 400,
  maxDelayMs: 8000,
  factor: 2,
  jitter: 0.5,
};

export const defaultMockConfig: MockConfig = {
  restLatencyMs: 250,
  restJitterMs: 350,
  restErrorRate: 0.08,

  aiFirstChunkMinMs: 400,
  aiFirstChunkMaxMs: 1200,
  aiChunkMinMs: 150,
  aiChunkMaxMs: 400,
  aiErrorRate: 0.25,
  aiTimeoutMs: 12000,

  retry: defaultRetryPolicy,

  socketOrderIntervalMs: 3500,
  socketKitchenIntervalMs: 6000,
  socketJitterMs: 2500,

  pollingIntervalMs: 15000,
};

export const MOCK_CONFIG = new InjectionToken<MockConfig>('MOCK_CONFIG', {
  providedIn: 'root',
  factory: () => defaultMockConfig,
});
