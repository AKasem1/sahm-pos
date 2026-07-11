import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OrderApiService } from '../app/features/live-orders/data/order-api.service';
import { nextStatus } from '../app/core/models/order.model';
import { idempotencyKey } from '../app/core/utils/id';
import { server } from '../mocks/msw/server';
import { mockDb } from '../mocks/msw/db';
import { setMockConfig, resetMockConfig } from '../mocks/msw/handlers';

/**
 * Integration flow (§12) driven through the REAL HTTP path via MSW. This
 * exercises OrderApiService → MSW handlers → in-memory DB end to end, including
 * the optimistic-concurrency (version) contract and idempotent replay.
 */
describe('Orders REST flow (integration via MSW)', () => {
  let api: OrderApiService;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    resetMockConfig();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    // Deterministic, no injected latency/errors for the happy-path assertions.
    mockDb.reset(60, Date.parse('2026-07-10T12:00:00Z'));
    setMockConfig({ restLatencyMs: 0, restJitterMs: 0, restErrorRate: 0 });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withFetch()),
        OrderApiService,
      ],
    });
    api = TestBed.inject(OrderApiService);
  });

  it('fetches the seeded orders', async () => {
    const orders = await firstValueFrom(api.getOrders());
    expect(orders).toHaveLength(60);
  });

  it('advances a status and bumps the version', async () => {
    const orders = await firstValueFrom(api.getOrders());
    const target = orders.find((o) => nextStatus(o.status) !== null)!;
    const to = nextStatus(target.status)!;

    const updated = await firstValueFrom(
      api.advanceStatus(target.id, to, target.version, idempotencyKey()),
    );
    expect(updated.status).toBe(to);
    expect(updated.version).toBe(target.version + 1);
  });

  it('rejects a stale advance with a 409 conflict (optimistic concurrency)', async () => {
    const orders = await firstValueFrom(api.getOrders());
    const target = orders.find((o) => nextStatus(o.status) !== null)!;
    const to = nextStatus(target.status)!;

    // First advance succeeds and bumps the server version.
    await firstValueFrom(api.advanceStatus(target.id, to, target.version, idempotencyKey()));

    // A second advance using the now-stale version must conflict.
    await expect(
      firstValueFrom(api.advanceStatus(target.id, to, target.version, idempotencyKey())),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('is idempotent: replaying the same key does not double-apply', async () => {
    const orders = await firstValueFrom(api.getOrders());
    const target = orders.find((o) => nextStatus(o.status) !== null)!;
    const to = nextStatus(target.status)!;
    const key = idempotencyKey();

    const first = await firstValueFrom(api.advanceStatus(target.id, to, target.version, key));
    const replay = await firstValueFrom(api.advanceStatus(target.id, to, target.version, key));

    // Same key → same result, version applied exactly once.
    expect(replay.version).toBe(first.version);
    expect(replay.status).toBe(to);
  });
});
