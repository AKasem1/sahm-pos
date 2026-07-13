import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/operators';
import { EMPTY, Observable, timer } from 'rxjs';
import { catchError, exhaustMap, map, switchMap } from 'rxjs/operators';
import { CLOCK } from '../../../core/tokens/clock.token';
import { MOCK_CONFIG } from '../../../core/tokens/mock-config.token';
import { KitchenLoad } from '../../../core/models/kitchen.model';
import {
  Order,
  OrderChannel,
  OrderPriority,
  OrderStatus,
  nextStatus,
} from '../../../core/models/order.model';
import { AdvanceStatusPayload, CancelOrderPayload } from '../../../core/models/offline.model';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { ConnectionService } from '../../../core/services/connection.service';
import { OfflineQueueService, ReplayResult } from '../../../core/services/offline-queue.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { derivePriority, isDelayed } from '../../../core/utils/derive-priority';
import { describeHttpError } from '../../../core/utils/http-error';
import { idempotencyKey } from '../../../core/utils/id';
import { isNewer } from '../../../core/utils/reconcile';
import { initialKitchenLoad } from '../../../../mocks/data/kitchen';
import { OrderApiService } from './order-api.service';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';
export type ChannelFilter = OrderChannel | 'all';

/** Order enriched with store-derived view fields (priority, delay). */
export interface OrderView extends Order {
  readonly derivedPriority: OrderPriority;
  readonly delayed: boolean;
  readonly ageMinutes: number;
}

interface LiveOrdersState {
  readonly entities: Record<string, Order>;
  readonly ids: string[];
  readonly loadStatus: LoadStatus;
  readonly error: string | null;
  readonly channelFilter: ChannelFilter;
  readonly selectedOrderId: string | null;
  readonly kitchenLoad: KitchenLoad;
  /** Ids with an in-flight optimistic mutation (for subtle UI affordance). */
  readonly pendingIds: string[];
}

const initialState: LiveOrdersState = {
  entities: {},
  ids: [],
  loadStatus: 'idle',
  error: null,
  channelFilter: 'all',
  selectedOrderId: null,
  kitchenLoad: initialKitchenLoad(),
  pendingIds: [],
};

/**
 * LiveOrdersStore (Layer 2, §5.2). One ComponentStore for the whole board.
 *
 * It reconciles THREE update sources into a single truth (§7.1):
 *   1. the fake WebSocket (RealtimeService) — primary,
 *   2. polling (a timer-driven re-fetch) — fallback,
 *   3. local optimistic mutations from user actions.
 * Every incoming update is gated by `isNewer(version/updatedAt)` so stale events
 * can never regress the board or clobber an optimistic change.
 *
 * Priority + delay are derived here (pure functions), never in the template.
 */
@Injectable()
export class LiveOrdersStore extends ComponentStore<LiveOrdersState> {
  private readonly api = inject(OrderApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly connection = inject(ConnectionService);
  private readonly queue = inject(OfflineQueueService);
  private readonly config = inject(MOCK_CONFIG);
  private readonly clock = inject(CLOCK);

  constructor() {
    super(initialState);
  }

  // ---- Selectors --------------------------------------------------------
  readonly loadStatus$ = this.select((s) => s.loadStatus);
  readonly error$ = this.select((s) => s.error);
  readonly channelFilter$ = this.select((s) => s.channelFilter);
  readonly selectedOrderId$ = this.select((s) => s.selectedOrderId);
  readonly kitchenLoad$ = this.select((s) => s.kitchenLoad);
  readonly pendingIds$ = this.select((s) => s.pendingIds);

  private readonly rawOrders$ = this.select((s) => s.ids.map((id) => s.entities[id]!));

  /** Orders enriched with derived priority + delay, newest activity first. */
  readonly orders$: Observable<OrderView[]> = this.select(
    this.rawOrders$,
    this.kitchenLoad$,
    this.select((s) => s.pendingIds),
    (orders, load) => {
      const now = this.clock.now();
      return orders
        .map((o) => this.toView(o, load, now))
        .sort((a, b) => this.sortRank(a) - this.sortRank(b));
    },
  );

  readonly filteredOrders$: Observable<OrderView[]> = this.select(
    this.orders$,
    this.channelFilter$,
    (orders, filter) =>
      filter === 'all' ? orders : orders.filter((o) => o.channel === filter),
  );

  readonly ordersByChannel$ = this.select(this.orders$, (orders) => ({
    'walk-in': orders.filter((o) => o.channel === 'walk-in'),
    delivery: orders.filter((o) => o.channel === 'delivery'),
    online: orders.filter((o) => o.channel === 'online'),
  }));

  readonly counts$ = this.select(this.orders$, (orders) => ({
    total: orders.length,
    urgent: orders.filter((o) => o.derivedPriority === 'urgent').length,
    delayed: orders.filter((o) => o.delayed).length,
  }));

  readonly selectedOrder$ = this.select(
    this.orders$,
    this.selectedOrderId$,
    (orders, id) => orders.find((o) => o.id === id) ?? null,
  );

  private toView(order: Order, load: KitchenLoad, now: Date): OrderView {
    return {
      ...order,
      derivedPriority: derivePriority(order, load, now),
      delayed: isDelayed(order, load, now),
      ageMinutes: Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60000),
    };
  }

  /** Sort: urgent first, then delayed, then most recently updated. */
  private sortRank(o: OrderView): number {
    const priorityWeight = o.derivedPriority === 'urgent' ? 0 : o.derivedPriority === 'high' ? 1 : 2;
    const delayWeight = o.delayed ? 0 : 1;
    return priorityWeight * 10 + delayWeight;
  }

  // ---- Updaters ---------------------------------------------------------
  readonly setChannelFilter = this.updater<ChannelFilter>((state, channelFilter) => ({
    ...state,
    channelFilter,
  }));

  readonly selectOrder = this.updater<string | null>((state, selectedOrderId) => ({
    ...state,
    selectedOrderId,
  }));

  private readonly setOrders = this.updater<Order[]>((state, orders) => {
    const entities: Record<string, Order> = {};
    for (const o of orders) {
      entities[o.id] = o;
    }
    return { ...state, entities, ids: orders.map((o) => o.id), loadStatus: 'success', error: null };
  });

  /** Reconcile a single order using version/updatedAt (drops stale). */
  private readonly upsertOrder = this.updater<Order>((state, incoming) => {
    const current = state.entities[incoming.id];
    if (current && !isNewer(incoming, current)) {
      return state; // stale — ignore to avoid flicker/regression
    }
    const isNew = !current;
    return {
      ...state,
      entities: { ...state.entities, [incoming.id]: incoming },
      ids: isNew ? [incoming.id, ...state.ids] : state.ids,
    };
  });

  /** Force-replace an order, bypassing the staleness gate (used for rollback). */
  private readonly replaceOrder = this.updater<Order>((state, order) => ({
    ...state,
    entities: { ...state.entities, [order.id]: order },
    ids: state.ids.includes(order.id) ? state.ids : [order.id, ...state.ids],
  }));

  private readonly setKitchenLoad = this.updater<KitchenLoad>((state, kitchenLoad) => ({
    ...state,
    kitchenLoad,
  }));

  private readonly markPending = this.updater<{ id: string; pending: boolean }>(
    (state, { id, pending }) => ({
      ...state,
      pendingIds: pending
        ? [...new Set([...state.pendingIds, id])]
        : state.pendingIds.filter((x) => x !== id),
    }),
  );

  private readonly setLoading = this.updater((state) => ({
    ...state,
    loadStatus: 'loading' as const,
    error: null,
  }));

  private readonly setError = this.updater<string>((state, error) => ({
    ...state,
    loadStatus: state.ids.length ? 'success' : 'error',
    error,
  }));

  // ---- Effects ----------------------------------------------------------

  /** Initial load + refresh. `switchMap` cancels a superseded fetch. */
  readonly loadOrders = this.effect<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() => {
        this.setLoading();
        return this.api.getOrders().pipe(
          tapResponse(
            (orders) => this.setOrders(orders),
            (err: unknown) => this.setError(describeHttpError(err)),
          ),
        );
      }),
    ),
  );

  /** Subscribe to the fake socket; reconcile order + kitchen events (§7.1). */
  readonly listenRealtime = this.effect<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() =>
        this.realtime.events$.pipe(
          map((event: RealtimeEvent) => {
            if (event.kind === 'order-update' && event.order) {
              this.upsertOrder(event.order);
            } else if (event.kind === 'kitchen-load') {
              this.setKitchenLoad(event.load);
            }
          }),
        ),
      ),
    ),
  );

  /** Polling fallback: re-fetch on an interval and reconcile each order. */
  readonly startPolling = this.effect<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() =>
        timer(this.config.pollingIntervalMs, this.config.pollingIntervalMs).pipe(
          switchMap(() =>
            this.connection.isOnline() ? this.api.getOrders() : EMPTY,
          ),
          map((orders) => orders.forEach((o) => this.upsertOrder(o))),
          catchError(() => EMPTY), // polling failures are non-fatal
        ),
      ),
    ),
  );

  /** Reconcile the board after the offline queue replays actions (§7.5). */
  readonly listenReplay = this.effect<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() =>
        this.queue.results$.pipe(
          switchMap((result: ReplayResult) => {
            if (result.kind === 'acked') {
              this.upsertOrder(result.order);
              return EMPTY;
            }
            if (result.kind === 'conflict') {
              const orderId = (result.action.payload as { orderId: string }).orderId;
              return this.api.getOrder(orderId).pipe(
                tapResponse(
                  (order) => this.upsertOrder(order),
                  () => void 0,
                ),
              );
            }
            return EMPTY;
          }),
        ),
      ),
    ),
  );

  /**
   * Advance an order's status. Optimistic-first: apply immediately, then either
   * call the API (online) or enqueue for replay (offline). On API error we roll
   * back to the snapshot unless a newer update already superseded it.
   * `exhaustMap` per invocation prevents a double-fire from rapid clicks.
   */
  readonly advanceStatus = this.effect<OrderView>((order$) =>
    order$.pipe(
      exhaustMap((order) => {
        const to = nextStatus(order.status);
        if (!to) {
          return EMPTY;
        }
        const snapshot = this.get().entities[order.id];
        const key = idempotencyKey();
        const optimistic: Order = {
          ...order,
          status: to,
          version: order.version + 1,
          updatedAt: this.clock.now().toISOString(),
        };
        this.upsertOrder(optimistic);
        this.markPending({ id: order.id, pending: true });

        if (!this.connection.isOnline()) {
          const payload: AdvanceStatusPayload = {
            orderId: order.id,
            toStatus: to,
            fromVersion: order.version,
          };
          this.queue.enqueue({
            id: key,
            type: 'ADVANCE_STATUS',
            payload,
            createdAt: this.clock.now().toISOString(),
          });
          this.markPending({ id: order.id, pending: false });
          return EMPTY;
        }

        return this.api.advanceStatus(order.id, to, order.version, key).pipe(
          tapResponse(
            (server) => {
              this.upsertOrder(server);
              this.markPending({ id: order.id, pending: false });
            },
            (err: unknown) => this.rollback(order.id, snapshot, err),
          ),
        );
      }),
    ),
  );

  /** Cancel an order (optimistic + offline-aware, mirrors advanceStatus). */
  readonly cancelOrder = this.effect<OrderView>((order$) =>
    order$.pipe(
      exhaustMap((order) => {
        if (order.status === 'cancelled' || order.status === 'completed') {
          return EMPTY;
        }
        const snapshot = this.get().entities[order.id];
        const key = idempotencyKey();
        const optimistic: Order = {
          ...order,
          status: 'cancelled' as OrderStatus,
          version: order.version + 1,
          updatedAt: this.clock.now().toISOString(),
        };
        this.upsertOrder(optimistic);
        this.markPending({ id: order.id, pending: true });

        if (!this.connection.isOnline()) {
          const payload: CancelOrderPayload = { orderId: order.id, fromVersion: order.version };
          this.queue.enqueue({
            id: key,
            type: 'CANCEL_ORDER',
            payload,
            createdAt: this.clock.now().toISOString(),
          });
          this.markPending({ id: order.id, pending: false });
          return EMPTY;
        }

        return this.api.cancelOrder(order.id, order.version, key).pipe(
          tapResponse(
            (server) => {
              this.upsertOrder(server);
              this.markPending({ id: order.id, pending: false });
            },
            (err: unknown) => this.rollback(order.id, snapshot, err),
          ),
        );
      }),
    ),
  );

  private rollback(id: string, snapshot: Order | undefined, err: unknown): void {
    this.markPending({ id, pending: false });
    if (!snapshot) {
      return;
    }
    // Only roll back if our optimistic value is still the latest (nothing newer
    // arrived in the meantime); otherwise respect the newer truth.
    const current = this.get().entities[id];
    if (current && current.version > snapshot.version + 1) {
      return;
    }
    this.replaceOrder(snapshot);
    this.setError(`Action failed (${describeHttpError(err)}) — reverted.`);
  }

  /** Convenience bootstrap for the page component. */
  init(): void {
    this.realtime.connect();
    this.loadOrders();
    this.listenRealtime();
    this.startPolling();
    this.listenReplay();
  }
}
