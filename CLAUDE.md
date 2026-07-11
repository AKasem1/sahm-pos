# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project

**Sahm — Smart Order Workspace**: a real-time, AI-assisted restaurant POS dashboard
built as a frontend architecture demonstration. See
`PRD-Smart-Restaurant-POS-Dashboard.md` for the full brief and `ARCHITECTURE.md`
for the design rationale. The emphasis is engineering *reasoning* (state
management, resilience, change-detection efficiency), not a finished product.

## Environment

- **Node** v24.18.0 (via nvm — this repo has an `.nvmrc`). Run `nvm use` first.
- Install deps with `npm install --legacy-peer-deps` (Angular 22 peer ranges).

## Commands

| Task | Command |
|---|---|
| Dev server | `npm start` (→ http://localhost:4200) |
| Production build | `npm run build` |
| Unit + integration tests (Vitest) | `npm test` |
| Tests in watch mode | `npm run test:watch` |
| Lint | `npm run lint` |
| Format | `npm run format` |

Run a single test file: `npm test -- src/app/features/live-orders/data/live-orders.store.spec.ts`

## Architecture — the three-layer model

Business logic **never** lives in components. Data flows in one direction:

```
[MSW REST] [Fake Socket] [AI sim]        ← external boundary (src/mocks/)
        │        │        │
        ▼        ▼        ▼
   RxJS Services (Layer 1)               ← Observables, orchestration, retries
        │
        ▼   effects call services
   ComponentStore (Layer 2)              ← feature state, optimistic + rollback
        │
        ▼   select() → toSignal()
   Signals in components (Layer 3)       ← computed view models, local UI state
        │
        ▼
   OnPush template (zoneless render)
```

- **Layer 1 — Services (RxJS):** own everything touching the outside world or
  composing async streams. Expose Observables, hold no view state. Live in
  `core/services/` (app-wide singletons: connection, realtime, offline-queue,
  theme) or a feature's `data/` folder (feature-specific: order-api, catalog).
- **Layer 2 — NgRx ComponentStore:** one store per feature, in `data/`. Holds
  canonical async state, runs effects that call Layer-1 services, handles
  optimistic updates + rollback. Selectors are bridged to the view with
  `toSignal(store.select(...))`.
- **Layer 3 — Signals:** component-local, ephemeral view state (toggles, active
  tab, keyboard-nav index) and `computed()` view models. Never put this in a store.

## Key conventions

- **Angular 22, standalone components only** (no NgModules).
- **Zoneless** (`provideZonelessChangeDetection`) + **OnPush everywhere** +
  signals. Change-detection efficiency is a graded criterion — keep renders
  proportional to what changed (`@for` with `track`, granular signals, memoized
  selectors, presentational `shared/ui` components).
- **TypeScript strict mode** (all strict flags). Typing quality is graded.
- **RxJS for streams/orchestration, Signals for view state** — right tool per layer.
- Teardown via `takeUntilDestroyed()` + ComponentStore auto-dispose. **No manual
  `subscribe()` in components.**
- Priority derivation and other domain rules are **pure functions in `core/utils/`**
  (unit-tested), consumed by stores — never computed in templates.

## Folder structure

```
src/app/
  core/         # app-wide singletons, no UI: models/ services/ interceptors/ tokens/ utils/
  shared/       # reusable presentational UI + pipes (no store/service injection)
  features/
    live-orders/    # data/ (store, api service) + ui/ + routes  — §7.1
    kitchen-load/   # data/ (store, service) + ui/                — §7.3
    ai-assistant/   # data/ (store, service) + ui/                — §7.2
    product-search/ # data/ (store, catalog service) + ui/        — §7.4
    offline-sync/   # ui/ (queue view is driven by core service)  — §7.5
  layout/       # Shell, ConnectionIndicator, ThemeToggle
src/mocks/      # msw/ (handlers, worker, server) + data/ (seed) + socket/ (fake socket)
src/testing/    # integration flow specs
bruno/          # Bruno API collection for the mock REST endpoints
```

### Boundary rules

- `features/*` may import from `core` and `shared`, **never** from another
  feature's internals.
- `shared/ui` is presentational only (inputs/outputs, no store/service injection).
- Domain logic lives in `data/` (store or service), never in a component.

## Mock backend

- **REST** via MSW (`src/mocks/msw/`): configurable latency + error injection
  through the `MOCK_CONFIG` injection token, so failure/retry paths are demoable.
  The same handlers back the integration tests (`setupServer`).
- **Realtime** via a custom RxJS "fake socket" (`RealtimeService`) driven by
  timers with jitter; exposes `disconnect()`/`reconnect()` for demoing recovery.
- **AI** via `AiAssistantService`: random delay → streamed partial chunks →
  complete, or configurable failure/timeout to exercise retry/backoff.

## Testing

Vitest + Angular Testing Library + MSW. Prioritize meaningful assertions over
coverage %: store updaters/selectors, optimistic apply + rollback, search
debounce/cancellation, reconciliation dropping stale versions, the AI state
machine, backoff schedules (fake timers), and offline queue replay/dedupe/conflict.
The end-to-end flow lives in `src/testing/orders-flow.integration.spec.ts`.
