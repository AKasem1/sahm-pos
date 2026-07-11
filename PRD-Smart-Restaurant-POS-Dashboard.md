# PRD — Smart Restaurant POS Dashboard ("Smart Order Workspace")

**Project:** Sahm Food — Smart Order Workspace
**Type:** Frontend engineering challenge (Angular)
**Author:** Abdelrahman
**Status:** Draft for review → hand-off to Claude Code
**Last updated:** July 10, 2026

---

## 0. How to read this document

This PRD is written to be **executable by an AI coding agent** while remaining **reviewable by a human first**. It makes concrete architectural decisions rather than leaving them open, because the challenge is graded on engineering *reasoning* — so every non-obvious choice includes a short justification you can reuse in the walkthrough video.

Sections you should skim first for discussion:

- **§3 Tech Stack & Key Decisions** — the foundational choices.
- **§5 State Management Architecture** — the three-layer model you specified.
- **§13 Open Questions / Decisions to Confirm** — things I need your call on before build.

Everything else is detail Claude Code can follow directly.

---

## 1. Overview

Sahm Food runs hundreds of restaurants where cashiers operate a browser-based POS. This project builds the **frontend architecture** for a new "Smart Order Workspace" — a real-time, AI-assisted operations dashboard used simultaneously by cashiers, branch managers, kitchen staff, and support.

The emphasis is explicitly **not** a finished product. It is a demonstration of frontend architecture that handles:

- Continuous live updates from multiple systems (polling + simulated WebSocket).
- Asynchronous, failure-prone AI responses (with streaming, retries, timeouts).
- Complex, performant UI interactions (search, keyboard nav, large datasets).
- Resilience to connection loss (optimistic actions, offline queue, safe recovery).
- Scalable, maintainable, well-typed, well-tested code.

### Success criteria (what "good" looks like)

1. The UI never blocks or freezes under a stream of concurrent updates.
2. Every async surface has explicit `loading / success / error / empty / retry` states.
3. Business logic lives in stores/services, **never** inside components.
4. Change detection is efficient by construction (zoneless + OnPush + signals).
5. Tests meaningfully cover state transitions, search, retries, and offline sync.
6. A reviewer can navigate the folder structure and immediately understand it.

### Explicit non-goals

- Real backend, real authentication, real payments.
- Pixel-perfect visual design (clean and accessible is enough).
- Full CRUD for menu/inventory management.
- Multi-language/RTL (unless we decide to add it — see §13).

---

## 2. Users & Core Use Cases

| Persona | Primary need in the workspace |
|---|---|
| **Cashier** | Create/track orders, act on AI suggestions (upsell, missing info), fast product search. |
| **Branch Manager** | See kitchen load, order priorities, delayed orders, overall throughput. |
| **Kitchen Staff** | See incoming/preparing orders and load pressure; statuses advance as work completes. |
| **Customer Support** | Inspect an order's timeline, delivery risk, and AI warnings. |

For this challenge we build a **single unified workspace** (not separate role apps), but the architecture is structured so role-specific views could be split out later (see §11 Scalability).

---

## 3. Tech Stack & Key Decisions

| Concern | Decision | Why (one-liner for the walkthrough) |
|---|---|---|
| Framework | **Angular 22** (latest stable, June 2026) | Signal-first era; OnPush-by-default; stable zoneless. |
| Components | **Standalone components** only (no NgModules) | Modern default; simpler dependency boundaries + lazy loading. |
| Change detection | **Zoneless** (`provideZonelessChangeDetection`) + **OnPush** everywhere | Directly demonstrates "efficient change detection / no unnecessary renders." |
| Language | **TypeScript strict mode** (all strict flags on) | Typing quality is an explicit grading criterion. |
| Reactivity | **RxJS 7+** for streams/orchestration, **Signals** for view state | Right tool per layer (see §5). |
| Feature state | **NgRx ComponentStore** (per feature) | Local, encapsulated, disposable state with effects — your chosen approach. |
| Routing | Angular Router with **lazy-loaded feature routes** | Demonstrates lazy loading + code splitting. |
| HTTP mocking | **MSW (Mock Service Worker)** for REST | Realistic network layer; reusable in tests. |
| Realtime mocking | **Custom RxJS "fake socket" service** (Subject + timers) | Full control over event timing, races, reconnection. |
| Testing | **Vitest** (Angular 22 default) + **Angular Testing Library** + MSW | Fast, modern; matches current Angular tooling. |
| Styling | Tailwind CSS (or Angular Material — see §13) | Fast, consistent, accessible primitives. |
| Lint/format | ESLint (angular-eslint) + Prettier | Table stakes for maintainability. |

### 3.1 Why ComponentStore over the alternatives (for your video)

The challenge says "your choice matters less than your reasoning." Prepared justification:

- **vs. global NgRx Store/Effects:** This workspace is a set of loosely coupled feature surfaces (orders, AI, kitchen, search, offline). A single global store with actions/reducers/effects would add ceremony and a global action bus we don't need. ComponentStore gives **feature-scoped, self-disposing** state that maps cleanly onto our feature folders.
- **vs. plain services + Subjects:** ComponentStore gives us a disciplined `state / selectors / updaters / effects` shape, automatic teardown, and testability — without hand-rolling `BehaviorSubject` plumbing and manual unsubscription.
- **vs. @ngrx/signals SignalStore:** SignalStore is the newer signal-native option and a legitimate alternative. We deliberately keep **RxJS-based ComponentStore effects** as the orchestration backbone because our hardest problems (streaming AI, retries with backoff, request cancellation, race handling, offline replay) are fundamentally **stream-composition** problems where RxJS operators are the strongest fit. Signals are still used heavily for the view layer (§5). *(Mention SignalStore as the alternative you considered — that scores points.)*

> **Note for discussion:** If you'd rather showcase the newest APIs, we can swap ComponentStore → `@ngrx/signals` SignalStore and use `rxMethod` for the async orchestration. Flagged in §13.

---

## 4. Domain Model (canonical types)

These types live in a shared `core/models` layer and are the contract for mocks, stores, and UI.

```ts
type OrderChannel = 'walk-in' | 'delivery' | 'online';

type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'completed'
  | 'cancelled';

type OrderPriority = 'normal' | 'high' | 'urgent';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
  allergens?: string[];
}

interface Order {
  id: string;
  reference: string;            // human-friendly, e.g. #A-1042
  channel: OrderChannel;
  status: OrderStatus;
  priority: OrderPriority;       // derived from kitchen load + age (see §7)
  items: OrderItem[];
  total: number;
  customer?: { name?: string; phone?: string };
  delivery?: {
    address?: string;
    etaMinutes?: number;
    risk?: 'none' | 'low' | 'high';
  };
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
  version: number;               // for race/conflict handling (see §8)
}

type AiSuggestionType =
  | 'upsell'
  | 'allergy_warning'
  | 'missing_info'
  | 'delivery_risk'
  | 'kitchen_overload';

type AiRequestStatus =
  | 'idle'
  | 'loading'
  | 'streaming'
  | 'success'
  | 'error';

interface AiSuggestion {
  id: string;
  orderId: string;
  type: AiSuggestionType;
  status: AiRequestStatus;
  content: string;               // accumulates during streaming
  retryCount: number;
  error?: string;
}

type KitchenLoadLevel = 'low' | 'medium' | 'high' | 'critical';

interface KitchenLoad {
  level: KitchenLoadLevel;
  activeOrders: number;
  avgPrepMinutes: number;
  capacityPct: number;           // 0..100
  updatedAt: string;
}

interface QueuedAction {
  id: string;                    // client-generated (idempotency key)
  type: 'ADVANCE_STATUS' | 'CANCEL_ORDER' | 'ACCEPT_SUGGESTION' | string;
  payload: unknown;
  createdAt: string;
  attempts: number;
}
```

---

## 5. State Management Architecture (the three-layer model)

This is the heart of the submission. Three layers with strict responsibilities:

### Layer 1 — Services with RxJS (data + side effects + orchestration)

Own everything that touches the outside world or composes async streams. They expose **Observables** and hold **no view state**.

- `OrderApiService` — REST via `HttpClient` (MSW-mocked): fetch orders, advance status, cancel.
- `RealtimeService` (fake socket) — emits `OrderUpdateEvent` and `KitchenLoadEvent` via an RxJS `Subject`, driven by timers; supports simulated disconnect/reconnect.
- `PollingService` — interval-based refresh as a fallback/parallel source; reconciled with socket events.
- `AiAssistantService` — simulates async + **streaming** suggestions (partial emissions), configurable latency, random failures, **retry with backoff**, and **timeouts**.
- `ConnectionService` — online/offline signal + observable (`navigator.onLine` + heartbeat).
- `OfflineQueueService` — persists `QueuedAction[]` (IndexedDB via `idb-keyval`, or localStorage), replays on reconnect, dedupes by idempotency key.

**Key RxJS operators mapped to responsibilities:**

| Problem | Operator(s) |
|---|---|
| Search request cancellation | `debounceTime` → `distinctUntilChanged` → `switchMap` |
| AI stream that must not overlap per order | `exhaustMap` (ignore new while streaming) or `switchMap` (cancel + restart) |
| Status advance ordering (no races) | `concatMap` |
| Retry with backoff | `retry({ count, delay })` / custom `retryWhen` with exponential backoff + jitter |
| Timeout | `timeout(ms)` + `catchError` |
| Merge polling + socket into one truth | `merge` + reconcile by `version`/`updatedAt` |
| Caching / share work | `shareReplay({ bufferSize: 1, refCount: true })` |
| Teardown / leak prevention | `takeUntilDestroyed()` + ComponentStore auto-dispose |

### Layer 2 — NgRx ComponentStore (feature state)

One store per feature. Holds canonical async state, exposes selectors, runs effects that call Layer-1 services. Handles optimistic updates + rollback.

- `LiveOrdersStore` — orders entity map, active filters, selected order id, connection status.
- `AiAssistantStore` — `Record<orderId, AiSuggestion[]>`, per-suggestion status machine.
- `KitchenLoadStore` — current load + short history for trend.
- `SearchStore` — query, results, recent searches, highlighted index. *(Some of this can live in signals — see §6.)*
- `SyncStore` — pending queue view, online status, last-sync info.

**Bridging to the view:** selectors are Observables; components convert them with `toSignal(store.select(...))` for zoneless-friendly, glitch-free template reactivity.

### Layer 3 — Signals (local UI state + template reactivity)

Component-local, ephemeral view state that never belongs in a store:

- Form inputs, toggles, expanded/collapsed panels, active tab, hover/focus.
- Derived view models via `computed()`.
- `toSignal()` outputs from store selectors, consumed directly in templates.
- Local keyboard-navigation index for the search dropdown (fast, no store round-trip).

### 5.1 Data flow (one diagram in words)

```
[MSW REST]  [Fake Socket]  [AI sim]      ← external boundary
     │            │            │
     ▼            ▼            ▼
        RxJS Services (Layer 1)           ← Observables, orchestration, retries
     │            │            │
     ▼            ▼            ▼
   ComponentStore effects (Layer 2)       ← updaters + optimistic + rollback
     │
     ▼  select() → toSignal()
   Signals in components (Layer 3)         ← computed view models
     │
     ▼
   OnPush template (zoneless render)
```

---

## 6. Folder Structure

Feature-based, with clear `core / shared / features` boundaries.

```
src/
  app/
    core/                      # app-wide singletons, no UI
      models/                  # domain types (§4)
      services/                # ConnectionService, OfflineQueueService, RealtimeService
      interceptors/            # http error/retry interceptor, offline interceptor
      tokens/                  # InjectionTokens (config, clock, socket factory)
      utils/                   # backoff(), idempotencyKey(), reconcile()
    shared/                    # reusable, dumb, reusable UI + pipes/directives
      ui/                      # Button, Badge, Skeleton, EmptyState, ErrorState, Spinner
      directives/              # AutoFocus, ClickOutside
      pipes/                   # HighlightMatchPipe, RelativeTimePipe
      a11y/                    # focus-trap, live-region helpers
    features/
      live-orders/
        data/                  # LiveOrdersStore, order-api.service, mappers
        ui/                    # OrdersBoard, OrderCard, StatusPipeline, ChannelFilter
        live-orders.routes.ts
      ai-assistant/
        data/                  # AiAssistantStore, ai-assistant.service
        ui/                    # AiPanel, SuggestionCard, StreamingText, RetryButton
      kitchen-load/
        data/                  # KitchenLoadStore
        ui/                    # LoadGauge, LoadTrend
      product-search/
        data/                  # SearchStore, product-catalog.service
        ui/                    # SearchBox, ResultsList, ResultItem, RecentSearches
      offline-sync/
        data/                  # SyncStore
        ui/                    # OfflineBanner, PendingQueueList
    layout/                    # Shell, TopBar, ConnectionIndicator
    app.config.ts              # providers: zoneless, router, http, MSW bootstrap
    app.routes.ts              # top-level lazy routes
  mocks/
    msw/                       # handlers, browser worker, server (tests)
    data/                      # seed datasets (orders, products, kitchen)
    socket/                    # fake socket event generators
  testing/                     # test utils, render helpers, store harnesses
```

**Boundary rules (enforced by lint where possible):**
- `features/*` may import from `core` and `shared`, never from another feature's internals.
- `shared/ui` components are **presentational only** (inputs/outputs, no store/service injection).
- Business logic never sits in a component — it lives in `data/` (store or service).

---

## 7. Feature Specifications

### 7.1 Live Orders Workspace

**Goal:** a responsive board of orders across channels whose statuses advance in real time.

Requirements:
- Columns or grouped views by **channel** (walk-in / delivery / online) with a channel filter.
- Each order shows: reference, channel, status pipeline, priority badge, age, total.
- **Status pipeline** UI: `received → preparing → ready → delivered → completed` (+ cancelled).
- Updates arrive from **three sources** that must be reconciled into one truth:
  1. Simulated **WebSocket** events (primary).
  2. **Polling** refresh (secondary/fallback).
  3. Local **optimistic** updates from user actions.
- Reconciliation rule: an incoming update wins only if its `version` (or `updatedAt`) is newer than what's in the store; stale events are dropped (prevents flicker/regressions).
- **Performance:** `@for` with `track order.id`; OnPush; new/updated cards must not re-render the whole board. Support large lists (hundreds of orders) smoothly — consider CDK virtual scroll if a single column grows large.
- States: loading (skeleton cards), empty (no orders for filter), error (retry), reconnecting banner.

### 7.2 AI Order Assistant

**Goal:** per-order recommendation panel that gracefully survives slow/failed/streaming AI.

Requirements:
- Suggestion types: `upsell`, `allergy_warning`, `missing_info`, `delivery_risk`, `kitchen_overload`.
- Each suggestion runs a **state machine:** `idle → loading → streaming → success` **or** `→ error → (retry) → loading …`.
- **Streaming simulation:** content arrives in partial chunks (e.g. token-ish appends every ~150–400ms); the UI shows a live-updating text + a caret/typing indicator.
- **Failure simulation:** a configurable % of requests fail; UI shows an error state with a **Retry** button. Retries use exponential backoff with a cap and a max attempt count.
- **Timeout:** requests exceeding N seconds transition to error.
- **Concurrency:** multiple orders may request suggestions at once; each order's stream is independent and cancellable. Use `exhaustMap`/`switchMap` per order so a panel can't double-fire.
- **Cancellation:** navigating away or closing a panel cancels its in-flight stream (no leaks, no ghost updates).
- Accessibility: streaming region is an `aria-live="polite"` region; retry is keyboard reachable.

### 7.3 Kitchen Load Monitor

**Goal:** live workload gauge that influences order priorities and AI suggestions.

Requirements:
- Show current load level (`low/medium/high/critical`), capacity %, active orders, avg prep time.
- Load changes arrive via the fake socket on an interval + jitter.
- **Derived effects when load changes:**
  - Order **priority** recomputes (e.g. `urgent` when load ≥ high *and* order age > threshold, or delivery ETA at risk).
  - Some orders flip to a **delayed** indicator.
  - `kitchen_overload` AI suggestions may appear/refresh.
- Priority derivation is a **pure function** in `core/utils` (unit-tested), consumed by `LiveOrdersStore` — not computed in the template.
- Reacts without any page refresh; a small trend sparkline is a nice-to-have.

### 7.4 Advanced Product Search

**Goal:** fast, keyboard-first search over a large product dataset.

Requirements:
- **Instant filtering** with **debounce** (~200–300ms) and `distinctUntilChanged`.
- **Request cancellation** via `switchMap` (if search hits a mock endpoint) — stale responses never overwrite fresh ones.
- **Category filters** (chips) combine with the text query.
- **Keyboard navigation:** ↑/↓ to move, Enter to select, Esc to close; full ARIA combobox semantics (`role="combobox"`, `aria-activedescendant`, `aria-expanded`).
- **Recent searches** persisted locally; shown when the box is focused and empty.
- **Highlighted matches** in results (a `HighlightMatchPipe`, XSS-safe).
- **Performance:** dataset of thousands of items stays smooth — virtualize the results list; precompute a search index if needed; never re-render the whole list per keystroke.
- States: loading, empty ("no matches"), recent-searches (empty query), error.

### 7.5 Offline Support

**Goal:** tolerate connection loss and recover cleanly, without duplicate actions.

Requirements:
- Detect offline/online (`ConnectionService`) and show a persistent **offline banner**.
- User actions while offline (advance status, cancel, accept suggestion) are applied **optimistically** to the UI and pushed to the **offline queue** with a client-generated **idempotency key**.
- On reconnect: the queue **replays** in order; server-acked actions are cleared; conflicts (server `version` newer) are resolved by re-fetch + reconcile, and the optimistic change is rolled back if rejected.
- **Duplicate prevention:** the idempotency key guarantees replay-safety; identical queued actions are collapsed.
- Queue survives a page reload (persisted to IndexedDB/localStorage).
- A small "pending actions" list is visible so the user knows what's not yet synced.

---

## 8. Cross-Cutting Engineering Challenges (how each is addressed)

| Challenge | Approach |
|---|---|
| Multiple concurrent API requests | Independent per-feature effects; `merge`/`forkJoin` where combined; each order's AI stream isolated. |
| Request cancellation | `switchMap` for search & restartable streams; `takeUntilDestroyed` on teardown. |
| Race conditions | `version`/`updatedAt` reconciliation; `concatMap` for ordered mutations; drop stale socket events. |
| Optimistic updates | ComponentStore `updater` applies immediately; effect rolls back on error. |
| Retry strategies | Exponential backoff + jitter + max attempts (AI, sync); surfaced retry UI. |
| Error recovery | `catchError` → error state; retry actions; reconnect reconciliation. |
| Caching | `shareReplay` on catalog/read streams; store acts as in-memory cache; HTTP cache interceptor optional. |
| Reactive programming | RxJS in services/effects; signals in view. |
| Memory leak prevention | `takeUntilDestroyed`, ComponentStore auto-dispose, no manual subscriptions in components. |
| Efficient change detection | Zoneless + OnPush + signals + `@for track`. |
| Preventing unnecessary renders | Memoized selectors, `computed`, granular signals, presentational components. |

---

## 9. Mock Backend Design

The **quality of simulation is graded**, so this is a first-class deliverable.

### 9.1 REST (MSW)
- Handlers for: `GET /orders`, `POST /orders/:id/status`, `POST /orders/:id/cancel`, `GET /products?q=&category=`, `GET /kitchen/load`, `POST /ai/suggest`.
- Configurable **latency** and **error injection** per handler (via a mock config token) so we can demo error/retry paths on demand.
- Same handlers reused in Vitest for integration tests (MSW `setupServer`).

### 9.2 Realtime (custom RxJS fake socket)
- `RealtimeService` exposes `events$: Observable<OrderUpdateEvent | KitchenLoadEvent>`.
- Driven by RxJS `timer`/`interval` with jitter; emits status transitions and kitchen load changes.
- Exposes `disconnect()` / `reconnect()` to **demo offline recovery** and reconciliation on camera.
- Deterministic mode (seeded) for tests; random mode for the demo.

### 9.3 AI simulation
- `AiAssistantService.suggest(order, type)` returns an Observable that:
  - waits a random delay, then emits partial chunks (streaming), then completes; **or**
  - errors (configurable probability) to exercise retry/backoff; **or**
  - exceeds timeout.
- Content templates per suggestion type (e.g. upsell picks complementary items; allergy warning scans `items[].allergens`).

### 9.4 Seed data
- `mocks/data/`: ~50–100 orders across channels/statuses, a **large** product catalog (e.g. 2–5k items) to prove search performance, kitchen load presets.

**Deliverable:** a **Bruno** (or Postman) collection for the MSW REST endpoints + the JSON seed datasets committed to the repo.

---

## 10. UI/UX & Accessibility Requirements

- Responsive layout (workspace usable on laptop; graceful narrower widths).
- Every async surface: **skeleton** while loading, **empty state**, **error state** with retry.
- Smooth transitions for status/priority changes (subtle, not flashy).
- **Error boundaries:** a shared `ErrorState` component + a top-level error catcher so one failing panel never blanks the workspace.
- **Keyboard accessibility:** search combobox, status actions, retry buttons all reachable; visible focus rings; logical tab order.
- **ARIA:** live regions for streaming AI and connection status; combobox roles for search; badges have text alternatives.
- Good information hierarchy: priority/status are visually scannable at a glance.
- Respect `prefers-reduced-motion`.

---

## 11. Scalability & "Hundreds of Screens" Story

Talking points baked into the architecture (for Part 4 of the video):

- **Feature isolation:** each feature is a self-contained folder with its own store/services/UI and a lazy route — new screens are additive, not entangling.
- **Presentational/container split:** `shared/ui` stays reusable; features compose them.
- **Boundary enforcement:** lint rules prevent cross-feature imports → the codebase stays decoupled as it grows.
- **ComponentStore per feature** scales better than one giant global store for a workspace of many independent surfaces; a global store could still be introduced for genuinely cross-cutting state if needed.
- **Zoneless + OnPush + signals** keep render cost proportional to what changed, not app size.
- **Typed contracts** in `core/models` mean many teams can build screens against stable interfaces.

---

## 12. Testing Strategy

Tooling: **Vitest** + **Angular Testing Library** + **MSW**.

Required coverage (minimum):

| Area | What we assert |
|---|---|
| State management | ComponentStore updaters/selectors; optimistic apply + rollback. |
| Search | Debounce, cancellation (no stale overwrite), keyboard nav, highlight, empty/recent. |
| Order status updates | Reconciliation drops stale versions; pipeline advances correctly. |
| AI assistant | Full state machine incl. streaming accumulation, error → retry → success. |
| Retry logic | Backoff schedule + max attempts (fake timers). |
| Offline sync | Queue persist, dedupe by idempotency key, replay order, conflict rollback. |
| Component behavior | Loading/empty/error states render; a11y roles present. |
| Critical flows (integration+) | "order arrives → priority updates on load change → suggestion streams → accept while offline → syncs on reconnect." |

- Use RxJS/Vitest **fake timers** for polling, debounce, backoff, streaming.
- Use MSW to drive integration tests through the real HTTP path.
- Aim for meaningful assertions over coverage %, but keep core logic near-fully covered.

---

## 13. Open Questions / Decisions to Confirm (discuss before build)

1. **State lib confirmation:** Stick with **NgRx ComponentStore** (as specified), or switch to **@ngrx/signals SignalStore** to showcase the newest API? *(Recommendation: keep ComponentStore; it fits the RxJS-heavy orchestration story and you asked for it.)*
2. **Styling:** **Tailwind** (faster, full control) vs **Angular Material** (accessible components out of the box, less a11y work). *(Recommendation: Tailwind + a few CDK primitives — a11y/focus-trap/virtual-scroll — best balance.)*
3. **Zoneless:** Go fully **zoneless** (strong signal, slightly more care needed) or keep Zone.js with OnPush? *(Recommendation: zoneless — it's stable in 22 and directly showcases change-detection mastery.)*
4. **Offline persistence:** **IndexedDB (idb-keyval)** vs **localStorage**. *(Recommendation: idb-keyval — more realistic for a queue, still tiny.)*
5. **Realtime:** custom RxJS fake socket (recommended) vs MSW's WebSocket support. *(Recommendation: custom — full control of races/reconnect for the demo.)*
6. **Scope guardrail:** confirm we build the **5 modules** as depth-first slices rather than breadth (i.e. fewer things, done to a high bar). The brief explicitly says depth > completeness.
7. **RTL/i18n:** out of scope by default — confirm we skip it (your background makes it tempting, but it adds cost with no grading upside here).
8. **API collection:** **Bruno** vs **Postman** for the deliverable. *(Recommendation: Bruno — git-friendly, plain files in-repo.)*

---

## 14. Deliverables Checklist

- [ ] GitHub repo, complete source.
- [ ] `README.md` — architecture, folder structure, design decisions, state approach, performance notes, assumptions, known limitations, future improvements.
- [ ] Installation + environment instructions.
- [ ] Tests (unit + at least one integration flow).
- [ ] Mock backend (MSW handlers + fake socket + AI sim).
- [ ] Bruno/Postman collection for mock REST endpoints.
- [ ] Mock datasets committed.
- [ ] Architecture diagram (recommended).
- [ ] **AI Usage Disclosure** doc (tools used, key prompts, what was AI-generated vs. human-designed, how AI output was verified, rejected suggestions).
- [ ] 12–20 min walkthrough video (demo → engineering deep-dive → code navigation → trade-offs).

---

## 15. Suggested Build Plan (phased, for Claude Code)

> Build **depth-first**: get one vertical slice fully working (data → store → UI → tests) before widening.

1. **Foundation:** Angular 22 app, zoneless + OnPush config, strict TS, ESLint/Prettier, Tailwind, folder skeleton, `core/models`, MSW bootstrap, seed data.
2. **Live Orders (vertical slice):** OrderApiService + LiveOrdersStore + board UI + skeleton/empty/error + `@for track`. Tests for store + reconciliation.
3. **Realtime + Kitchen Load:** fake socket, merge/reconcile with polling, KitchenLoadStore, priority derivation (pure fn + tests), delayed indicators.
4. **AI Assistant:** streaming + retry/backoff + timeout + state machine + a11y live region. Tests for the full machine.
5. **Product Search:** debounce + switchMap cancel + keyboard combobox + recent + highlight + virtualization. Tests incl. stale-response.
6. **Offline Sync:** ConnectionService, OfflineQueueService (idb), optimistic + rollback, replay + dedupe, offline banner + pending list. Tests for queue/replay/conflict.
7. **Polish:** transitions, reduced-motion, error boundary, empty states audit, a11y pass.
8. **Docs & artifacts:** README, architecture diagram, Bruno collection, AI disclosure. Prep video script.

---

### Appendix A — Priority derivation (illustrative, to live in `core/utils`)

```ts
function derivePriority(order: Order, load: KitchenLoad, now: Date): OrderPriority {
  const ageMin = (now.getTime() - new Date(order.createdAt).getTime()) / 60000;
  const deliveryAtRisk = order.delivery?.risk === 'high';
  if (load.level === 'critical' && (ageMin > 10 || deliveryAtRisk)) return 'urgent';
  if (load.level === 'high' && ageMin > 15) return 'high';
  if (deliveryAtRisk) return 'high';
  return 'normal';
}
```
*(Pure, deterministic, unit-tested; consumed by the store, never the template.)*
