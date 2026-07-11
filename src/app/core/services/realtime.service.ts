import { Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  Subject,
  Subscription,
  timer,
} from 'rxjs';
import { KitchenLoad } from '../models/kitchen.model';
import { RealtimeEvent } from '../models/realtime.model';
import { MOCK_CONFIG } from '../tokens/mock-config.token';
import { ConnectionService } from './connection.service';
import { mockDb } from '../../../mocks/msw/db';
import { makeKitchenLoad } from '../../../mocks/data/kitchen';
import {
  jitteredInterval,
  nextKitchenLevel,
} from '../../../mocks/socket/event-generators';

/**
 * RealtimeService — the custom RxJS "fake socket" (§9.2, §13-Q5).
 *
 * Emits `OrderUpdateEvent` and `KitchenLoadEvent` on a single multiplexed
 * `events$` stream, driven by self-rescheduling `timer`s with jitter. We chose a
 * hand-rolled socket over MSW's WebSocket support precisely so we can script
 * races, disconnects and reconnects on demand for the walkthrough.
 *
 * `disconnect()` / `reconnect()` let the demo drop the connection; on reconnect
 * we flip ConnectionService to `reconnecting` briefly, then resume — which is
 * what triggers the store to re-fetch and reconcile.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly config = inject(MOCK_CONFIG);
  private readonly connection = inject(ConnectionService);

  private readonly subject = new Subject<RealtimeEvent>();
  readonly events$: Observable<RealtimeEvent> = this.subject.asObservable();

  private orderSub: Subscription | null = null;
  private kitchenSub: Subscription | null = null;
  private tick = 0;

  private readonly _connected = signal(false);
  readonly connected = this._connected.asReadonly();

  /** Begin emitting events. Idempotent. */
  connect(): void {
    if (this._connected()) {
      return;
    }
    this._connected.set(true);
    this.scheduleOrderTick();
    this.scheduleKitchenTick();
  }

  /** Simulate a dropped connection (stops emissions). */
  disconnect(): void {
    this._connected.set(false);
    this.orderSub?.unsubscribe();
    this.kitchenSub?.unsubscribe();
    this.orderSub = null;
    this.kitchenSub = null;
    this.connection.setReconnecting(false);
  }

  /**
   * Simulate recovery: show `reconnecting` for a beat, then resume. Consumers
   * react to the reconnecting→online transition by re-fetching (§7.1).
   */
  reconnect(delayMs = 1200): void {
    if (this._connected()) {
      return;
    }
    this.connection.setReconnecting(true);
    timer(delayMs).subscribe(() => {
      this.connection.setReconnecting(false);
      this.connect();
    });
  }

  private scheduleOrderTick(): void {
    const interval = jitteredInterval(
      this.config.socketOrderIntervalMs,
      this.config.socketJitterMs,
      Math.random,
    );
    this.orderSub = timer(interval).subscribe(() => {
      this.emitOrderProgression();
      if (this._connected()) {
        this.scheduleOrderTick();
      }
    });
  }

  private scheduleKitchenTick(): void {
    const interval = jitteredInterval(
      this.config.socketKitchenIntervalMs,
      this.config.socketJitterMs,
      Math.random,
    );
    this.kitchenSub = timer(interval).subscribe(() => {
      this.emitKitchenChange();
      if (this._connected()) {
        this.scheduleKitchenTick();
      }
    });
  }

  private emitOrderProgression(): void {
    this.tick += 1;
    const order = mockDb.progressRandomOrder(this.tick * 7 + 3);
    if (order) {
      this.subject.next({
        kind: 'order-update',
        orderId: order.id,
        status: order.status,
        version: order.version,
        updatedAt: order.updatedAt,
        order,
      });
    }
  }

  private emitKitchenChange(): void {
    const current = mockDb.getKitchen();
    const level = nextKitchenLevel(current.level, Math.random());
    const load: KitchenLoad = makeKitchenLoad(level, new Date().toISOString());
    mockDb.setKitchen(load);
    this.subject.next({ kind: 'kitchen-load', load });
  }
}
