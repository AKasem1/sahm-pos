import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvanceStatusPayload } from '../models/offline.model';
import { MOCK_CONFIG, defaultMockConfig } from '../tokens/mock-config.token';
import { ConnectionService } from './connection.service';
import { OfflineQueueService, ReplayResult } from './offline-queue.service';

// idb-keyval writes to IndexedDB, which jsdom lacks — stub it to an in-memory map.
vi.mock('idb-keyval', () => {
  const mem = new Map<string, unknown>();
  return {
    get: vi.fn(async (k: string) => mem.get(k)),
    set: vi.fn(async (k: string, v: unknown) => void mem.set(k, v)),
  };
});

class FakeConnection {
  private online = true;
  isOnline = () => this.online;
  online$ = { pipe: () => ({ subscribe: () => ({ unsubscribe() {} }) }) } as never;
  setOnline(v: boolean) {
    this.online = v;
  }
}

function advancePayload(orderId = 'o1'): AdvanceStatusPayload {
  return { orderId, toStatus: 'preparing', fromVersion: 1 };
}

describe('OfflineQueueService (§7.5)', () => {
  let service: OfflineQueueService;
  let httpMock: HttpTestingController;
  let connection: FakeConnection;

  beforeEach(() => {
    connection = new FakeConnection();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        OfflineQueueService,
        { provide: ConnectionService, useValue: connection },
        { provide: MOCK_CONFIG, useValue: defaultMockConfig },
      ],
    });
    service = TestBed.inject(OfflineQueueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('dedupes identical queued actions by effect key', () => {
    service.enqueue({ id: 'a', type: 'ADVANCE_STATUS', payload: advancePayload(), createdAt: 't' });
    service.enqueue({ id: 'b', type: 'ADVANCE_STATUS', payload: advancePayload(), createdAt: 't' });
    expect(service.totalCount()).toBe(1);
  });

  it('replays a queued action with its idempotency key and clears it on ack', async () => {
    connection.setOnline(false);
    service.enqueue({ id: 'idem-1', type: 'ADVANCE_STATUS', payload: advancePayload(), createdAt: 't' });
    expect(service.pendingCount()).toBe(1);

    connection.setOnline(true);
    const acked = firstValueFrom(
      service.results$.pipe(
        filter((r): r is Extract<ReplayResult, { kind: 'acked' }> => r.kind === 'acked'),
        take(1),
      ),
    );
    const replay = service.replay();

    const req = httpMock.expectOne('/api/orders/o1/status');
    expect(req.request.headers.get('Idempotency-Key')).toBe('idem-1');
    req.flush({ id: 'o1', status: 'preparing', version: 2, reference: '#A-1' });

    await acked;
    await replay;
    expect(service.totalCount()).toBe(0);
  });

  it('resolves a 409 conflict by dropping the action and emitting a conflict result', async () => {
    connection.setOnline(false);
    service.enqueue({ id: 'idem-2', type: 'ADVANCE_STATUS', payload: advancePayload(), createdAt: 't' });
    connection.setOnline(true);

    const conflict = firstValueFrom(
      service.results$.pipe(
        filter((r): r is Extract<ReplayResult, { kind: 'conflict' }> => r.kind === 'conflict'),
        take(1),
      ),
    );
    const replay = service.replay();

    httpMock.expectOne('/api/orders/o1/status').flush(
      { message: 'conflict' },
      { status: 409, statusText: 'Conflict' },
    );

    await conflict;
    await replay;
    expect(service.totalCount()).toBe(0);
  });
});
