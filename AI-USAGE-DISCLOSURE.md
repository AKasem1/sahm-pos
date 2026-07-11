# AI Usage Disclosure

Per the challenge requirement, this documents how AI tooling was used to build the
Smart Order Workspace.

## Tools used

- **Claude Code (Anthropic)** — used as an agentic pair-programmer to scaffold the
  Angular 22 project, generate the layered implementation, write tests, and drive a
  headless-browser smoke test of the running app.

## What was human-designed vs. AI-generated

- **Human-designed (in the PRD):** the product concept, the three-layer state
  architecture, the choice of ComponentStore + RxJS + zoneless, the folder
  structure, the domain model, the feature specs, and the resolution of the open
  questions (§13). The PRD is the human specification; the agent executed it.
- **AI-generated:** the concrete TypeScript/HTML implementation of the services,
  stores, components, mock backend, seed-data generators, and the test suite —
  following the PRD's decisions rather than inventing architecture.

## Key prompts (paraphrased)

1. "Analyze the PRD in this directory, create the Angular project for it, and
   implement it; for the open-questions section go with the recommendations."
2. Follow-up guidance implicit in the PRD: build depth-first vertical slices
   (data → store → UI → tests) and keep business logic out of components.

## How AI output was verified

- **Type + build:** `ng build` with TypeScript **strict** + Angular
  **strictTemplates** — the whole app compiles clean.
- **Tests:** 41 Vitest tests (unit + component + MSW integration) written and run
  green, covering reconciliation, optimistic rollback, the AI state machine (incl.
  retry/backoff), search cancellation, and the offline queue (dedupe/replay/409).
- **Runtime:** the app was launched (`ng serve`) and driven with a headless-Chrome
  CDP script — verified real data loading via MSW, live order rendering (60 cards),
  search virtualization (72 matches, ~10 DOM rows) + ARIA `aria-activedescendant`
  keyboard nav, and the AI panel streaming through `loading → retry → streaming →
  success` live.

## Corrections / rejected or reworked suggestions

- Initial import of `tapResponse` from `@ngrx/component-store` was wrong for NgRx
  21 (it moved to `@ngrx/operators`); corrected after the build flagged it.
- A first cut of the rollback updater was routed through the staleness-gated
  `upsertOrder`, which would have silently dropped the rollback (snapshot has a
  lower version than the optimistic value). Reworked into a dedicated
  force-replace updater.
- The AI-store test's first mock returned a hot `Subject`, so an RxJS `retry`
  couldn't re-run the producer; the mock was corrected to a **cold** observable to
  faithfully model the real service.
- The AI concurrency guard initially used `mergeMap(…, 1)` (queuing) instead of the
  intended `exhaustMap` (ignore-while-busy); corrected to match the PRD's
  "can't double-fire" requirement.

## Not AI-authored

- The PRD document itself (human author).
- The resolution of product/architecture trade-offs — those were specified by the
  human and merely implemented by the agent.
