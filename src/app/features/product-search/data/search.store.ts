import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/operators';
import { EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Product, ProductCategory } from '../../../core/models/product.model';
import { ProductCatalogService } from './product-catalog.service';

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

const RECENT_KEY = 'sahm.recent-searches.v1';
const RECENT_LIMIT = 6;
const DEBOUNCE_MS = 250;

interface SearchState {
  readonly query: string;
  readonly category: ProductCategory | null;
  readonly results: Product[];
  readonly total: number;
  readonly status: SearchStatus;
  readonly error: string | null;
  readonly recent: string[];
}

/**
 * SearchStore (Layer 2, §7.4). Owns the search pipeline; the view keeps only the
 * ephemeral keyboard-highlight index as a signal (§5.3).
 *
 * The pipeline is the textbook cancellation story: `debounceTime` →
 * `distinctUntilChanged` → `switchMap`. `switchMap` cancels the in-flight
 * request when a newer keystroke arrives, so a slow stale response can never
 * overwrite fresh results.
 */
@Injectable()
export class SearchStore extends ComponentStore<SearchState> {
  private readonly catalog = inject(ProductCatalogService);

  constructor() {
    super({
      query: '',
      category: null,
      results: [],
      total: 0,
      status: 'idle',
      error: null,
      recent: loadRecent(),
    });
  }

  readonly query$ = this.select((s) => s.query);
  readonly category$ = this.select((s) => s.category);
  readonly results$ = this.select((s) => s.results);
  readonly total$ = this.select((s) => s.total);
  readonly status$ = this.select((s) => s.status);
  readonly error$ = this.select((s) => s.error);
  readonly recent$ = this.select((s) => s.recent);

  readonly vm$ = this.select(
    this.query$,
    this.category$,
    this.results$,
    this.total$,
    this.status$,
    this.error$,
    this.recent$,
    (query, category, results, total, status, error, recent) => ({
      query,
      category,
      results,
      total,
      status,
      error,
      recent,
      showRecent: status !== 'loading' && query.trim() === '' && category === null,
    }),
  );

  readonly setQuery = this.updater<string>((state, query) => ({ ...state, query }));
  readonly setCategory = this.updater<ProductCategory | null>((state, category) => ({
    ...state,
    category,
  }));

  private readonly setLoading = this.updater((state) => ({
    ...state,
    status: 'loading' as const,
    error: null,
  }));

  private readonly setResults = this.updater<{ products: Product[]; total: number }>(
    (state, { products, total }) => ({
      ...state,
      results: products,
      total,
      status: 'success',
      error: null,
    }),
  );

  private readonly setError = this.updater<string>((state, error) => ({
    ...state,
    status: 'error',
    error,
  }));

  private readonly setEmpty = this.updater((state) => ({
    ...state,
    results: [],
    total: 0,
    status: 'idle' as const,
  }));

  readonly pushRecent = this.updater<string>((state, term) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return state;
    }
    const recent = [trimmed, ...state.recent.filter((r) => r !== trimmed)].slice(0, RECENT_LIMIT);
    saveRecent(recent);
    return { ...state, recent };
  });

  readonly clearRecent = this.updater((state) => {
    saveRecent([]);
    return { ...state, recent: [] };
  });

  /**
   * The debounced, cancellable search effect. Triggered on every query/category
   * change; empty input short-circuits to the empty/recent state without a call.
   */
  readonly runSearch = this.effect<{ query: string; category: ProductCategory | null }>(
    (input$) =>
      input$.pipe(
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.query === b.query && a.category === b.category),
        switchMap(({ query, category }) => {
          const q = query.trim();
          if (q === '' && category === null) {
            this.setEmpty();
            return EMPTY;
          }
          this.setLoading();
          return this.catalog.search(q, category).pipe(
            tapResponse(
              (res) => this.setResults(res),
              (err: unknown) => this.setError(describe(err)),
            ),
          );
        }),
      ),
  );

  /** Called by the view on each keystroke / category toggle. */
  updateSearch(query: string, category: ProductCategory | null): void {
    this.setQuery(query);
    this.setCategory(category);
    this.runSearch({ query, category });
  }
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(recent: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // ignore quota / private-mode errors
  }
}

function describe(err: unknown): string {
  if (typeof err === 'object' && err && 'status' in err) {
    return `HTTP ${(err as { status: number }).status}`;
  }
  return err instanceof Error ? err.message : 'Search failed';
}
