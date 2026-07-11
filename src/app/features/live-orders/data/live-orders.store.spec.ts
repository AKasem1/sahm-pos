import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOCK } from '../../../core/tokens/clock.token';
import { MOCK_CONFIG, defaultMockConfig } from '../../../core/tokens/mock-config.token';
import { Order } from '../../../core/models/order.model';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { ConnectionService } from '../../../core/services/connection.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { OrderApiService } from './order-api.service';
import { LiveOrdersStore, OrderView } from './live-orders.store';

function makeOrder(overrides: Partial<Order> = {}): Order {
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
    ...overrides,
  };
}

describe('LiveOrdersStore', () => {
  let events$: Subject<RealtimeEvent>;
  let api: {
    getOrders: ReturnType<typeof vi.fn>;
    getOrder: ReturnType<typeof vi.fn>;
    advanceStatus: ReturnType<typeof vi.fn>;
    cancelOrder: ReturnType<typeof vi.fn>;
  };
  let connection: { isOnline: () => boolean; online$: Subject<boolean> };
  let queue: { results$: Subject<never>; enqueue: ReturnType<typeof vi.fn> };
  let store: LiveOrdersStore;

  function currentOrders(): OrderView[] {
    let snapshot: OrderView[] = [];
    store.orders$.subscribe((o) => (snapshot = o)).unsubscribe();
    return snapshot;
  }

  beforeEach(() => {
    events$ = new Subject<RealtimeEvent>();
    api = {
      getOrders: vi.fn().mockReturnValue(of([])),
      getOrder: vi.fn(),
      advanceStatus: vi.fn(),
      cancelOrder: vi.fn(),
    };
    connection = { isOnline: () => true, online$: new Subject<boolean>() };
    queue = { results$: new Subject<never>(), enqueue: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        LiveOrdersStore,
        { provide: OrderApiService, useValue: api },
        { provide: RealtimeService, useValue: { events$, connect: vi.fn() } },
        { provide: ConnectionService, useValue: connection },
        { provide: OfflineQueueService, useValue: queue },
        { provide: MOCK_CONFIG, useValue: defaultMockConfig },
        { provide: CLOCK, useValue: { now: () => new Date('2026-07-10T12:30:00Z') } },
      ],
    });
    store = TestBed.inject(LiveOrdersStore);
  });

  it('loads orders into the board', () => {
    api.getOrders.mockReturnValue(of([makeOrder()]));
    store.loadOrders();
    expect(currentOrders()).toHaveLength(1);
  });

  describe('reconciliation (§7.1)', () => {
    beforeEach(() => {
      api.getOrders.mockReturnValue(of([makeOrder({ version: 2, status: 'preparing' })]));
      store.loadOrders();
      store.listenRealtime();
    });

    it('drops a stale socket event (lower version)', () => {
      events$.next({
        kind: 'order-update',
        orderId: 'o1',
        status: 'received',
        version: 1,
        updatedAt: '2026-07-10T12:01:00Z',
        order: makeOrder({ version: 1, status: 'received' }),
      });
      expect(currentOrders()[0]!.status).toBe('preparing'); // unchanged
    });

    it('applies a newer socket event (higher version)', () => {
      events$.next({
        kind: 'order-update',
        orderId: 'o1',
        status: 'ready',
        version: 3,
        updatedAt: '2026-07-10T12:05:00Z',
        order: makeOrder({ version: 3, status: 'ready' }),
      });
      expect(currentOrders()[0]!.status).toBe('ready');
    });
  });

  describe('optimistic updates + rollback (§8)', () => {
    beforeEach(() => {
      api.getOrders.mockReturnValue(of([makeOrder({ status: 'received', version: 1 })]));
      store.loadOrders();
    });

    it('applies optimistically then confirms with the server response', () => {
      api.advanceStatus.mockReturnValue(
        of(makeOrder({ status: 'preparing', version: 2 })),
      );
      store.advanceStatus(currentOrders()[0]!);
      expect(currentOrders()[0]!.status).toBe('preparing');
      expect(api.advanceStatus).toHaveBeenCalledOnce();
    });

    it('rolls back to the snapshot when the server rejects', () => {
      api.advanceStatus.mockReturnValue(throwError(() => ({ status: 500 })));
      store.advanceStatus(currentOrders()[0]!);
      expect(currentOrders()[0]!.status).toBe('received'); // reverted
    });

    it('queues the action instead of calling the API while offline (§7.5)', () => {
      connection.isOnline = () => false;
      store.advanceStatus(currentOrders()[0]!);
      expect(api.advanceStatus).not.toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalledOnce();
      expect(currentOrders()[0]!.status).toBe('preparing'); // optimistic kept
    });
  });
});
