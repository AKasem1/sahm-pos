import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Subject, filter, firstValueFrom } from 'rxjs';
import { API } from '../api-routes';
import {
  AdvanceStatusPayload,
  CancelOrderPayload,
  QueuedAction,
} from '../models/offline.model';
import { Order } from '../models/order.model';
import { MOCK_CONFIG } from '../tokens/mock-config.token';
import { actionDedupeKey } from '../utils/id';
import { ConnectionService } from './connection.service';

const STORAGE_KEY = 'sahm.offline.queue.v1';

/** Outcome of replaying a single queued action, broadcast for reconciliation. */
export type ReplayResult =
  | { readonly kind: 'acked'; readonly action: QueuedAction; readonly order: Order }
  | { readonly kind: 'conflict'; readonly action: QueuedAction }
  | { readonly kind: 'dropped'; readonly action: QueuedAction; readonly reason: string };

/**
 * OfflineQueueService (Layer 1, §5 / §7.5).
 *
 * App-wide, root-provided owner of the durable action queue. Responsibilities:
 *  - persist `QueuedAction[]` to IndexedDB (survives reload) via idb-keyval;
 *  - dedupe on enqueue by a deterministic key (collapse identical actions);
 *  - replay in FIFO order on reconnect, guarded by the client idempotency key;
 *  - resolve conflicts (server version newer → re-fetch + reconcile upstream);
 *  - broadcast per-action outcomes on `results$` so stores can reconcile.
 *
 * It talks to the REST endpoints directly (via `API` route builders) so it stays
 * in `core` without importing any feature. Replay orchestration lives here, not
 * in a component, honouring "business logic never sits in a component" (§6).
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(ConnectionService);
  private readonly config = inject(MOCK_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _actions = signal<QueuedAction[]>([]);
  private readonly _replaying = signal(false);
  private readonly _lastSyncAt = signal<string | null>(null);
  private readonly _hydrated = signal(false);

  /** Public read-only views for the UI (banner + pending list). */
  readonly actions = this._actions.asReadonly();
  readonly pendingCount = computed(
    () => this._actions().filter((a) => a.syncState !== 'failed').length,
  );
  readonly failedCount = computed(
    () => this._actions().filter((a) => a.syncState === 'failed').length,
  );
  readonly totalCount = computed(() => this._actions().length);
  readonly isReplaying = this._replaying.asReadonly();
  readonly lastSyncAt = this._lastSyncAt.asReadonly();

  private readonly results = new Subject<ReplayResult>();
  /** Reconciliation feed consumed by LiveOrdersStore. */
  readonly results$ = this.results.asObservable();

  constructor() {
    void this.hydrate();

    // Persist on every queue mutation (after hydration to avoid clobbering).
    effect(() => {
      const actions = this._actions();
      if (this._hydrated()) {
        void idbSet(STORAGE_KEY, actions);
      }
    });

    // Replay whenever we transition offline → online.
    this.connection.online$
      .pipe(
        filter((online) => online),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => void this.replay());
  }

  private async hydrate(): Promise<void> {
    try {
      const stored = await idbGet<QueuedAction[]>(STORAGE_KEY);
      if (stored?.length) {
        // Reset any mid-flight `syncing` state left over from a crash/reload.
        this._actions.set(stored.map((a) => ({ ...a, syncState: 'pending' })));
      }
    } catch {
      // IndexedDB unavailable (e.g. private mode) — degrade to in-memory only.
    } finally {
      this._hydrated.set(true);
      if (this.connection.isOnline() && this._actions().length) {
        void this.replay();
      }
    }
  }

  /**
   * Enqueue an action. Deduped by effect key: re-advancing the same order to the
   * same status collapses to a single queued action (§7.5 duplicate prevention).
   * Returns the action actually stored (existing or new).
   */
  enqueue(
    partial: Pick<QueuedAction, 'id' | 'type' | 'payload' | 'createdAt'>,
  ): QueuedAction {
    const key = actionDedupeKey(partial.type, partial.payload as unknown as Record<string, unknown>);
    const existing = this._actions().find(
      (a) => actionDedupeKey(a.type, a.payload as unknown as Record<string, unknown>) === key,
    );
    if (existing) {
      return existing;
    }
    const action: QueuedAction = { ...partial, attempts: 0, syncState: 'pending' };
    this._actions.update((list) => [...list, action]);
    return action;
  }

  /** Manually retry all failed actions (from the pending-queue UI). */
  retryFailed(): void {
    this._actions.update((list) =>
      list.map((a) => (a.syncState === 'failed' ? { ...a, syncState: 'pending' } : a)),
    );
    void this.replay();
  }

  /** Discard a queued action the user chooses not to sync. */
  discard(id: string): void {
    this._actions.update((list) => list.filter((a) => a.id !== id));
  }

  /**
   * Replay the queue in FIFO order. Guarded so only one replay runs at a time.
   * Each action carries its idempotency key in an `Idempotency-Key` header so a
   * retry that the server already applied is a safe no-op.
   */
  async replay(): Promise<void> {
    if (this._replaying() || !this.connection.isOnline()) {
      return;
    }
    const queued = this._actions().filter((a) => a.syncState === 'pending');
    if (!queued.length) {
      return;
    }

    this._replaying.set(true);
    try {
      for (const action of queued) {
        // Re-check connectivity between actions — we may have dropped again.
        if (!this.connection.isOnline()) {
          break;
        }
        await this.replayOne(action);
      }
      this._lastSyncAt.set(new Date().toISOString());
    } finally {
      this._replaying.set(false);
    }
  }

  private async replayOne(action: QueuedAction): Promise<void> {
    this.patch(action.id, { syncState: 'syncing', attempts: action.attempts + 1 });
    const headers = new HttpHeaders({ 'Idempotency-Key': action.id });

    try {
      const order = await firstValueFrom(this.execute(action, headers));
      // Success → remove from queue and broadcast for reconciliation.
      this.remove(action.id);
      this.results.next({ kind: 'acked', action, order });
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      if (status === 409) {
        // Conflict: server state moved on. Drop the optimistic action and let
        // the store re-fetch + reconcile (§7.5).
        this.remove(action.id);
        this.results.next({ kind: 'conflict', action });
        return;
      }
      const exhausted = action.attempts + 1 >= this.config.retry.maxAttempts;
      this.patch(action.id, {
        syncState: exhausted ? 'failed' : 'pending',
        lastError: describeError(err),
      });
    }
  }

  private execute(action: QueuedAction, headers: HttpHeaders) {
    switch (action.type) {
      case 'ADVANCE_STATUS': {
        const p = action.payload as AdvanceStatusPayload;
        return this.http.post<Order>(
          API.orderStatus(p.orderId),
          { status: p.toStatus, fromVersion: p.fromVersion },
          { headers },
        );
      }
      case 'CANCEL_ORDER': {
        const p = action.payload as CancelOrderPayload;
        return this.http.post<Order>(
          API.orderCancel(p.orderId),
          { fromVersion: p.fromVersion },
          { headers },
        );
      }
      case 'ACCEPT_SUGGESTION': {
        // No server mutation in the mock; treated as acked immediately upstream.
        const p = action.payload as { orderId: string };
        return this.http.get<Order>(`${API.orders()}/${p.orderId}`, { headers });
      }
    }
  }

  private patch(id: string, patch: Partial<QueuedAction>): void {
    this._actions.update((list) =>
      list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }

  private remove(id: string): void {
    this._actions.update((list) => list.filter((a) => a.id !== id));
  }
}

function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return `HTTP ${err.status}`;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}
