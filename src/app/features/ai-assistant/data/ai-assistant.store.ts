import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { EMPTY, Observable, Subject } from 'rxjs';
import { catchError, exhaustMap, filter, groupBy, mergeMap, takeUntil, tap } from 'rxjs/operators';
import { AiStreamEvent, AiSuggestion, AiSuggestionType } from '../../../core/models/ai.model';
import { Order } from '../../../core/models/order.model';
import { CLOCK } from '../../../core/tokens/clock.token';
import { MOCK_CONFIG } from '../../../core/tokens/mock-config.token';
import { suggestionId } from '../../../core/utils/id';
import { retryWithBackoff } from '../../../core/utils/rx-retry';
import { AiAssistantService } from './ai-assistant.service';

interface AiState {
  /** Suggestions keyed by order id (§5.2). */
  readonly byOrder: Record<string, AiSuggestion[]>;
}

interface Request {
  readonly order: Order;
  readonly type: AiSuggestionType;
}

function keyOf(orderId: string, type: AiSuggestionType): string {
  return `${orderId}:${type}`;
}

/**
 * AiAssistantStore (Layer 2, §7.2). Drives the per-suggestion state machine
 * `idle → loading → streaming → success | error → (retry) → loading …`.
 *
 * Concurrency: requests are grouped by `${orderId}:${type}` and each group uses
 * `exhaustMap`, so a panel cannot double-fire while its own stream is running,
 * yet different orders/types stream independently and concurrently.
 *
 * Cancellation: `cancel()` pushes a key onto `cancel$`; the running stream is
 * torn down via `takeUntil`, and store disposal (route change) cancels all
 * in-flight streams — no leaks, no ghost updates (§7.2).
 */
@Injectable()
export class AiAssistantStore extends ComponentStore<AiState> {
  private readonly ai = inject(AiAssistantService);
  private readonly config = inject(MOCK_CONFIG);
  private readonly clock = inject(CLOCK);

  private readonly cancel$ = new Subject<string>();

  constructor() {
    super({ byOrder: {} });
  }

  selectSuggestions(orderId: string): Observable<AiSuggestion[]> {
    return this.select((s) => s.byOrder[orderId] ?? []);
  }

  // ---- Updaters ---------------------------------------------------------
  private readonly mutate = this.updater<{
    orderId: string;
    type: AiSuggestionType;
    fn: (s: AiSuggestion) => AiSuggestion;
    createIfMissing?: boolean;
  }>((state, { orderId, type, fn, createIfMissing }) => {
    const list = state.byOrder[orderId] ?? [];
    const idx = list.findIndex((s) => s.type === type);
    let nextList: AiSuggestion[];

    if (idx === -1) {
      if (!createIfMissing) {
        return state;
      }
      const seed: AiSuggestion = {
        id: suggestionId(),
        orderId,
        type,
        status: 'idle',
        content: '',
        retryCount: 0,
        updatedAt: this.clock.now().toISOString(),
      };
      nextList = [...list, fn(seed)];
    } else {
      nextList = list.map((s, i) => (i === idx ? fn(s) : s));
    }
    return { ...state, byOrder: { ...state.byOrder, [orderId]: nextList } };
  });

  private stamp(patch: Partial<AiSuggestion>): (s: AiSuggestion) => AiSuggestion {
    return (s) => ({ ...s, ...patch, updatedAt: this.clock.now().toISOString() });
  }

  // ---- Effects ----------------------------------------------------------

  readonly requestSuggestion = this.effect<Request>((req$) =>
    req$.pipe(
      groupBy((req) => keyOf(req.order.id, req.type)),
      mergeMap((group$) =>
        // exhaustMap: ignore repeat clicks for THIS key while a stream runs.
        group$.pipe(exhaustMap((req) => this.runStream(req))),
      ),
    ),
  );

  readonly retrySuggestion = this.effect<Request>((req$) =>
    req$.pipe(mergeMap((req) => this.runStream(req, true))),
  );

  cancel(orderId: string, type: AiSuggestionType): void {
    this.cancel$.next(keyOf(orderId, type));
    this.mutate({
      orderId,
      type,
      fn: this.stamp({ status: 'idle' }),
    });
  }

  private runStream(req: Request, manualRetry = false): Observable<unknown> {
    const { order, type } = req;
    const orderId = order.id;
    const key = keyOf(orderId, type);

    this.mutate({
      orderId,
      type,
      createIfMissing: true,
      fn: this.stamp({
        status: 'loading',
        content: '',
        error: undefined,
        ...(manualRetry ? {} : { retryCount: 0 }),
      }),
    });

    return this.ai.stream(order, type).pipe(
      // Exponential backoff + jitter; each retry resets content and bumps count.
      retryWithBackoff<AiStreamEvent>(this.config.retry, Math.random, () => {
        this.mutate({
          orderId,
          type,
          fn: (s) =>
            this.stamp({ status: 'loading', content: '', retryCount: s.retryCount + 1 })(s),
        });
      }),
      tap((event: AiStreamEvent) => {
        if (event.type === 'chunk') {
          this.mutate({
            orderId,
            type,
            fn: (s) => this.stamp({ status: 'streaming', content: s.content + event.delta })(s),
          });
        } else {
          this.mutate({ orderId, type, fn: this.stamp({ status: 'success' }) });
        }
      }),
      catchError((err: unknown) => {
        this.mutate({
          orderId,
          type,
          fn: this.stamp({ status: 'error', error: describe(err) }),
        });
        return EMPTY;
      }),
      takeUntil(this.cancel$.pipe(filter((k) => k === key))),
    );
  }

  override ngOnDestroy(): void {
    this.cancel$.complete();
    super.ngOnDestroy();
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    return err.name === 'TimeoutError' ? 'Request timed out' : err.message;
  }
  return 'AI request failed';
}
