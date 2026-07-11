# Architecture

Detailed diagrams and data-flow walkthroughs for the Smart Order Workspace.
Diagrams use Mermaid (rendered by GitHub) with ASCII fallbacks in prose.

## 1. Layered overview

```mermaid
flowchart TD
  subgraph Boundary["External boundary (mocked)"]
    REST["MSW REST handlers"]
    SOCK["Fake socket (RealtimeService timers)"]
    AISIM["AI stream simulation"]
  end

  subgraph L1["Layer 1 — RxJS services"]
    OA["OrderApiService"]
    RT["RealtimeService"]
    AA["AiAssistantService"]
    CN["ConnectionService"]
    OQ["OfflineQueueService (core, root)"]
    KA["KitchenLoadService"]
    PC["ProductCatalogService"]
  end

  subgraph L2["Layer 2 — NgRx ComponentStore (per feature)"]
    LOS["LiveOrdersStore"]
    AIS["AiAssistantStore"]
    KLS["KitchenLoadStore"]
    SS["SearchStore"]
  end

  subgraph L3["Layer 3 — Signals in OnPush components"]
    UI["Board / Panels / Search / Sync"]
  end

  REST --> OA & KA & PC
  SOCK --> RT
  AISIM --> AA

  OA --> LOS
  RT --> LOS & KLS
  AA --> AIS
  KA --> KLS
  PC --> SS
  CN --> OQ & LOS
  OQ -->|results$ reconcile| LOS

  LOS & AIS & KLS & SS -->|select → toSignal| UI
  UI -->|intents| LOS & AIS & SS
```

## 2. Order reconciliation (three sources → one truth)

The board's single source of truth is the `LiveOrdersStore` entity map. Three
independent producers feed it; every write passes through `isNewer()`:

```mermaid
sequenceDiagram
  participant Socket
  participant Poll as Polling (timer)
  participant User
  participant Store as LiveOrdersStore
  Note over Store: entities keyed by id, each with version + updatedAt

  Socket->>Store: order-update {id, version:3}
  Store->>Store: isNewer(v3, current v2)? yes → apply
  Poll->>Store: getOrders() → {id, version:2}
  Store->>Store: isNewer(v2, current v3)? no → DROP (stale)
  User->>Store: advanceStatus (optimistic v4)
  Store->>Store: apply immediately (v4)
  Socket-->>Store: late order-update {id, version:3}
  Store->>Store: isNewer(v3, current v4)? no → DROP
```

`isNewer` compares `version` first (authoritative, monotonic) and falls back to
`updatedAt`. This is what prevents flicker and status regressions when a slow
poll or a late socket event races an optimistic change.

## 3. AI suggestion state machine

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> loading: requestSuggestion
  loading --> streaming: first chunk
  loading --> error: fail (after retries)
  loading --> loading: retry (backoff+jitter)
  streaming --> success: done
  streaming --> error: timeout
  error --> loading: retry
  success --> [*]
```

Concurrency: requests are `groupBy(orderId:type)` then `exhaustMap`, so a panel
can't double-fire its own stream while different orders/types stream in parallel.
Cancellation is a `takeUntil(cancel$)` per key, plus whole-store teardown on route
change (ComponentStore `ngOnDestroy`).

## 4. Offline optimistic action + replay

```mermaid
sequenceDiagram
  participant User
  participant Store as LiveOrdersStore
  participant Queue as OfflineQueueService
  participant IDB as IndexedDB
  participant API as REST (MSW)

  User->>Store: advanceStatus (offline)
  Store->>Store: optimistic apply (v+1)
  Store->>Queue: enqueue(action, idempotencyKey)
  Queue->>IDB: persist queue
  Note over Queue: dedupe by effect key
  User-->>User: reconnect (online event)
  Queue->>API: POST /status  (Idempotency-Key: idem-x)
  alt success
    API-->>Queue: 200 order(v+1)
    Queue->>Store: results$ acked → reconcile
    Queue->>IDB: remove action
  else 409 conflict
    API-->>Queue: 409
    Queue->>Store: results$ conflict → re-fetch order
  else transient 5xx
    API-->>Queue: 500 → keep pending, backoff, retry
  end
```

Replay is FIFO and single-flight (guarded), survives reload (rehydrated from
IndexedDB, resetting any mid-flight `syncing` state), and is replay-safe because
the server dedupes on the `Idempotency-Key`.

## 5. Search cancellation pipeline

```
keystrokes ──▶ debounceTime(250) ──▶ distinctUntilChanged ──▶ switchMap(fetch)
                                                                   │
                       new keystroke cancels the in-flight fetch ◀─┘
```

A stale response whose request was superseded is discarded by `switchMap`, so it
can never overwrite fresher results. Results render through a CDK virtual-scroll
viewport, so only the visible rows exist in the DOM.

## 6. Injection tokens

- `MOCK_CONFIG` — latency, error rates, retry policy, socket/poll cadence. One
  place to tune the whole simulation; tests override it for determinism.
- `CLOCK` — injectable "now" so age/priority derivation and relative-time
  formatting are deterministic under test.
