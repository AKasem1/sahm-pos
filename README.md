# Sahm Food — Smart Order Workspace

A frontend-architecture demonstration for a real-time, AI-assisted restaurant POS
dashboard, built with **Angular 22 (zoneless) + signals + RxJS + NgRx ComponentStore**.

> This is an **architecture** showcase, not a finished product. The emphasis is on
> how the frontend handles continuous live updates, failure-prone streaming AI,
> large-dataset UI, and resilience to connection loss — with efficient change
> detection by construction. See [`PRD-Smart-Restaurant-POS-Dashboard.md`](./PRD-Smart-Restaurant-POS-Dashboard.md).

---

## Quick start

```bash
# Node 22.22.3+ or 24.15.0+ is required by the Angular 22 CLI.
npm install --legacy-peer-deps      # ComponentStore peers Angular 21; runs fine on 22
npm start                           # dev server → http://localhost:4200
npm test                            # Vitest (single run)
npm run build                       # production bundle
```

> `--legacy-peer-deps` is only needed because `@ngrx/component-store@21` declares a
> peer of Angular `^21`. ComponentStore is a small, stable library that runs
> correctly on Angular 22; this is documented rather than hidden.

The mock backend (MSW) starts automatically before the app bootstraps — no server
to run. Open **Live Orders** and you'll see orders progressing in real time.

### Things to try in the demo

- **Live Orders** → click **Simulate disconnect**, watch updates pause, then reconnect and see the board re-fetch + reconcile.
- Click an order's **AI** button → watch suggestions stream token-by-token, with real error → retry → success paths.
- **Product Search** → type a query; results are virtualized (only ~10 rows in the DOM) with keyboard nav (↑/↓/Enter/Esc).
- **Offline Sync** → click **Go offline**, advance/cancel some orders on Live Orders, then come back online and watch the queue replay.

---

## Tech stack & key decisions

| Concern | Choice | Why |
|---|---|---|
| Framework | Angular 22, **zoneless** | Signal-first, OnPush-by-default; render cost ∝ what changed |
| Components | Standalone only | Simpler boundaries + lazy loading |
| Reactivity | **RxJS** for orchestration, **signals** for view | Right tool per layer (state model below) |
| Feature state | **NgRx ComponentStore** per feature | Encapsulated, self-disposing state + effects |
| Styling | **Tailwind v4** + **Angular CDK** | Fast, accessible primitives (virtual scroll) |
| Theming | Semantic CSS-var tokens, **light + dark** (auto + toggle) | One token set themes the whole app at runtime |
| HTTP mock | **MSW** | Realistic network layer, reused in tests |
| Realtime mock | **Custom RxJS "fake socket"** | Full control of races/reconnect for the demo |
| Offline store | **IndexedDB** via `idb-keyval` | Realistic durable queue |
| Testing | **Vitest** + **Angular Testing Library** + MSW | Modern default toolchain |

Open questions from the PRD (§13) were resolved with the recommended options:
ComponentStore, Tailwind + CDK, fully zoneless, IndexedDB, custom fake socket,
5 depth-first modules, no RTL/i18n, Bruno collection.

---

## The three-layer state architecture

This is the heart of the submission. Every feature follows the same shape:

```
[MSW REST]   [Fake Socket]   [AI sim]           ← external boundary
     │            │             │
     ▼            ▼             ▼
   RxJS Services (Layer 1)                       ← Observables, retries, cancellation
     │            │             │
     ▼            ▼             ▼
   ComponentStore effects (Layer 2)              ← updaters + optimistic + rollback
     │
     ▼  select() → toSignal()
   Signals in OnPush components (Layer 3)        ← computed view models
     │
     ▼
   Zoneless render
```

- **Layer 1 — services (RxJS).** Own everything touching the outside world or
  composing async streams; expose Observables, hold no view state.
  `OrderApiService`, `RealtimeService`, `AiAssistantService`, `ConnectionService`,
  `OfflineQueueService`.
- **Layer 2 — ComponentStore.** One store per feature. Canonical async state,
  memoized selectors, effects that call Layer 1, optimistic updates + rollback.
- **Layer 3 — signals.** Component-local ephemeral UI state (keyboard highlight
  index, open/closed panels) and `toSignal()` projections of store selectors.

### Why ComponentStore (not global Store, not SignalStore)

The workspace is a set of loosely-coupled feature surfaces. A single global
Store/Effects would add a global action bus we don't need; **feature-scoped,
self-disposing** ComponentStores map cleanly onto the feature folders and tear
down on navigation. We keep **RxJS-based effects** as the orchestration backbone
because the hard problems here — streaming AI, retries with backoff, cancellation,
race handling, offline replay — are stream-composition problems where RxJS is the
strongest fit. `@ngrx/signals` SignalStore was the considered alternative.

### RxJS operators mapped to problems

| Problem | Operator |
|---|---|
| Search request cancellation | `debounceTime` → `distinctUntilChanged` → `switchMap` |
| AI stream must not double-fire per order | `groupBy` + `exhaustMap` |
| Retry with backoff + jitter | `retry({ delay })` + `timer(backoffDelay(...))` |
| Timeout | `timeout({ first })` + `catchError` |
| Reconcile socket + polling + optimistic | `merge` + `isNewer(version/updatedAt)` |
| Teardown / leak prevention | `takeUntilDestroyed` + ComponentStore auto-dispose |

---

## Folder structure

```
src/
  app/
    core/                # app-wide singletons, no UI
      models/            # domain types — the shared contract
      services/          # ConnectionService, OfflineQueueService, RealtimeService
      interceptors/      # http error/retry interceptor
      tokens/            # InjectionTokens: MOCK_CONFIG, CLOCK
      utils/             # backoff, idempotencyKey, reconcile, derivePriority (pure, tested)
    shared/
      ui/                # Badge, Spinner, Skeleton, EmptyState, ErrorState (presentational)
      pipes/             # HighlightMatch (XSS-safe), RelativeTime
    features/
      live-orders/       # data/ (store, api) + ui/ (board, card, pipeline, filter)
      ai-assistant/      # data/ (store, service) + ui/ (panel, suggestion, streaming text)
      kitchen-load/      # data/ (store, service) + ui/ (gauge, trend)
      product-search/    # data/ (store, service) + ui/ (search page, result item)
      offline-sync/      # ui/ (banner, pending list, sync page) — queue owned by core
    layout/              # Shell, ConnectionIndicator
    app.routes.ts        # top-level lazy routes
  mocks/
    msw/                 # handlers, in-memory db, browser worker, node server
    data/                # seed datasets (orders, products, kitchen)
    socket/              # fake-socket event generators
  testing/               # integration specs
```

**Boundary rules:** features import from `core`/`shared` only, never another
feature's internals; `shared/ui` is presentational (inputs/outputs, no store
injection); business logic lives in `data/`, never in a component.

---

## Feature highlights

- **Live Orders** — reconciles three update sources (fake socket + polling +
  optimistic actions) into one truth, gated by `isNewer(version/updatedAt)` so
  stale events never regress the board. Priority + "delayed" are derived by pure
  functions consumed by the store, never in the template.
- **AI Assistant** — per-order/per-type streaming with the full state machine
  `idle → loading → streaming → success | error → retry`. Exponential backoff +
  jitter, hard timeout, `exhaustMap` to prevent double-fire, cancellation on close
  and on route change. Live region for a11y.
- **Kitchen Load** — live gauge + trend sparkline; feeds order priority.
- **Product Search** — `debounce → distinct → switchMap` cancellation, ARIA
  combobox with full keyboard nav, CDK virtual scroll over a 2,400-item catalog,
  XSS-safe match highlighting, persisted recent searches.
- **Offline Sync** — optimistic actions queued to IndexedDB with client-generated
  idempotency keys; FIFO replay on reconnect; 409 conflicts resolved by re-fetch;
  dedupe collapses identical actions.

---

## Design system & theming

The UI is a "Polished SaaS" system driven entirely by **semantic design tokens**
(`--color-surface`, `--color-ink`, `--color-brand`, `--color-danger`, …) exposed
to Tailwind via `@theme` in `src/styles.css`. Components never hardcode palette
colours (`slate-200`, `white`, …); they use semantic utilities (`bg-surface`,
`text-muted`, `ring-line`). Because the utilities compile to `var(--color-…)`,
flipping a single set of variables re-themes the whole app with no rebuild and no
duplicate class sets.

- **Light + dark**, following the OS preference by default, with a manual toggle
  (light → dark → system) in the top bar. `ThemeService` persists the choice and
  stamps `data-theme` on `<html>`; the token overrides live in `styles.css`.
- Tasteful **micro-interactions**: card hover-lift, active-press scale, streaming
  caret, fade-in-up for new cards — all gated behind `prefers-reduced-motion`.
- Themed scrollbars, focus rings, and selection colour.

## Performance / efficient change detection

- **Zoneless** — no Zone.js; change detection is driven by signals only.
- **OnPush everywhere** + `@for` with `track` → new/updated cards don't re-render
  the whole board.
- **Memoized ComponentStore selectors** + `computed()` derive view models once.
- **Virtualized search** keeps only visible rows in the DOM regardless of catalog size.
- **Presentational split** — `shared/ui` and feature `ui/` components take inputs
  only, so their change-detection cost is bounded by their own inputs.

---

## Testing

`npm test` (Vitest + Angular Testing Library + MSW). Coverage focuses on the
behaviours that matter, not a percentage:

- **State management** — reconciliation drops stale versions; optimistic apply +
  rollback; offline enqueue.
- **Search** — debounce collapses keystrokes; `switchMap` cancellation (a late
  stale response cannot overwrite fresh results); recent-search persistence.
- **AI state machine** — streaming accumulation; error → backoff retry → success;
  retry exhaustion → error; `exhaustMap` ignores double-fire.
- **Offline queue** — dedupe by effect key; replay with idempotency header; 409
  conflict handling.
- **Integration (MSW)** — real HTTP path: fetch, advance + version bump,
  optimistic-concurrency 409, idempotent replay.
- **Component a11y** — combobox/filter roles + `aria-pressed`.

Fake timers (`vi.useFakeTimers`) drive debounce/backoff deterministically.
**41 tests across 9 files** at time of writing.

---

## Mock backend

- **REST (MSW):** `GET /api/orders`, `GET /api/orders/:id`,
  `POST /api/orders/:id/status`, `POST /api/orders/:id/cancel`,
  `GET /api/products`, `GET /api/kitchen/load`, `POST /api/ai/suggest`.
  Latency + error injection are configurable via the `MOCK_CONFIG` token, so
  failure paths can be demoed on demand. See the **Bruno collection** in
  [`bruno/`](./bruno).
- **Realtime:** `RealtimeService` emits order + kitchen events on jittered timers,
  with `disconnect()` / `reconnect()` for the demo.
- **AI:** `AiAssistantService` streams token-ish chunks with a configurable failure
  rate and timeout. (The app streams client-side; the `POST /api/ai/suggest`
  handler exists for the REST collection.)
- **Seed data:** ~60 orders across channels/statuses; a deterministic **2,400-item**
  product catalog; kitchen-load presets.

---

## Assumptions, known limitations, future work

**Assumptions**
- No real backend/auth/payments; the MSW in-memory DB is the source of truth.
- The offline queue is owned by the **app-wide `OfflineQueueService` (core)** rather
  than a disposable feature ComponentStore, because the queue must persist and
  replay regardless of the active route. The `offline-sync` feature is the UI over
  that service. This is a deliberate, documented deviation from "one ComponentStore
  per feature" for a genuinely cross-cutting concern.

**Known limitations**
- `ACCEPT_SUGGESTION` has no real server effect in the mock (queued + acked for the
  offline-flow demo).
- Priority derivation recomputes on state change, not on a wall-clock timer, so a
  purely time-based transition appears on the next socket/poll tick.

**Future improvements**
- Split role-specific views (cashier / manager / kitchen) off the shared workspace.
- Introduce a global store only if genuinely cross-cutting state emerges.
- ESLint boundary rules to enforce the import rules in CI.

---

## Environment notes

- Requires Node **22.22.3+** or **24.15.0+** (Angular 22 CLI).
- Package manager: npm. Install with `--legacy-peer-deps` (see Quick start).

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the detailed diagram and data-flow
walkthroughs, and [`AI-USAGE-DISCLOSURE.md`](./AI-USAGE-DISCLOSURE.md) for how AI
tooling was used.
