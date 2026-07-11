import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiStreamEvent } from '../../../core/models/ai.model';
import { Order } from '../../../core/models/order.model';
import { CLOCK } from '../../../core/tokens/clock.token';
import { MOCK_CONFIG, defaultMockConfig } from '../../../core/tokens/mock-config.token';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantStore } from './ai-assistant.store';

function makeOrder(): Order {
  return {
    id: 'o1',
    reference: '#A-1',
    channel: 'walk-in',
    status: 'received',
    priority: 'normal',
    items: [],
    total: 10,
    createdAt: '2026-07-10T12:00:00Z',
    updatedAt: '2026-07-10T12:00:00Z',
    version: 1,
  };
}

describe('AiAssistantStore state machine (§7.2)', () => {
  // Each element is a fresh subject created per SUBSCRIPTION, mirroring the real
  // service's cold observable (so an RxJS `retry` re-runs the producer).
  let streams: Subject<AiStreamEvent>[];
  let stream: ReturnType<typeof vi.fn>;
  let store: AiAssistantStore;

  function suggestion(): { status: string; content: string; retryCount: number } | undefined {
    let snapshot: { status: string; content: string; retryCount: number } | undefined;
    store
      .selectSuggestions('o1')
      .subscribe((s) => (snapshot = s[0]))
      .unsubscribe();
    return snapshot;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    streams = [];
    stream = vi.fn(
      () =>
        new Observable<AiStreamEvent>((subscriber) => {
          const s = new Subject<AiStreamEvent>();
          streams.push(s);
          const inner = s.subscribe(subscriber);
          return () => inner.unsubscribe();
        }),
    );

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AiAssistantStore,
        { provide: AiAssistantService, useValue: { stream } },
        // Fast, deterministic retry policy for the test.
        {
          provide: MOCK_CONFIG,
          useValue: {
            ...defaultMockConfig,
            retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 20, factor: 2, jitter: 0 },
          },
        },
        { provide: CLOCK, useValue: { now: () => new Date('2026-07-10T12:00:00Z') } },
      ],
    });
    store = TestBed.inject(AiAssistantStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accumulates streamed chunks then transitions to success', () => {
    store.requestSuggestion({ order: makeOrder(), type: 'upsell' });
    expect(suggestion()?.status).toBe('loading');

    streams[0]!.next({ type: 'chunk', delta: 'Add ' });
    expect(suggestion()?.status).toBe('streaming');
    expect(suggestion()?.content).toBe('Add ');

    streams[0]!.next({ type: 'chunk', delta: 'fries.' });
    expect(suggestion()?.content).toBe('Add fries.');

    streams[0]!.next({ type: 'done' });
    streams[0]!.complete();
    expect(suggestion()?.status).toBe('success');
  });

  it('retries with backoff on error, then succeeds', () => {
    store.requestSuggestion({ order: makeOrder(), type: 'upsell' });

    // First attempt fails.
    streams[0]!.error(new Error('boom'));
    // Backoff delay elapses → a retry subscribes a new (cold) stream.
    vi.advanceTimersByTime(50);
    expect(streams.length).toBe(2);
    expect(suggestion()?.retryCount).toBe(1);
    expect(suggestion()?.status).toBe('loading');

    // Retry succeeds.
    streams[1]!.next({ type: 'chunk', delta: 'ok' });
    streams[1]!.next({ type: 'done' });
    streams[1]!.complete();
    expect(suggestion()?.status).toBe('success');
    expect(suggestion()?.content).toBe('ok');
  });

  it('ends in error after exhausting retries', () => {
    store.requestSuggestion({ order: makeOrder(), type: 'upsell' });
    // Fail every attempt; advance past each backoff.
    for (let i = 0; i < 5; i++) {
      const s = streams[streams.length - 1]!;
      s.error(new Error('boom'));
      vi.advanceTimersByTime(50);
    }
    expect(suggestion()?.status).toBe('error');
  });

  it('ignores a repeat request for the same order/type while streaming (exhaustMap)', () => {
    store.requestSuggestion({ order: makeOrder(), type: 'upsell' });
    store.requestSuggestion({ order: makeOrder(), type: 'upsell' });
    expect(streams.length).toBe(1);
  });
});
