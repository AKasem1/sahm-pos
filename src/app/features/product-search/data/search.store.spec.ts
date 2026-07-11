import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../../../core/models/product.model';
import { ProductCatalogService, ProductSearchResult } from './product-catalog.service';
import { SearchStore } from './search.store';

function product(id: string, name: string): Product {
  return {
    id,
    name,
    category: 'burgers',
    price: 1,
    available: true,
    searchTokens: name.toLowerCase(),
  };
}

describe('SearchStore', () => {
  let subjects: Subject<ProductSearchResult>[];
  let search: ReturnType<typeof vi.fn>;
  let store: SearchStore;

  function results(): Product[] {
    let snapshot: Product[] = [];
    store.results$.subscribe((r) => (snapshot = r)).unsubscribe();
    return snapshot;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    subjects = [];
    search = vi.fn(() => {
      const s = new Subject<ProductSearchResult>();
      subjects.push(s);
      return s;
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        SearchStore,
        { provide: ProductCatalogService, useValue: { search } },
      ],
    });
    store = TestBed.inject(SearchStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces rapid keystrokes into a single request', () => {
    store.updateSearch('c', null);
    store.updateSearch('ch', null);
    store.updateSearch('che', null);
    vi.advanceTimersByTime(300);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('che', null);
  });

  it('does not call the API for an empty query with no category', () => {
    store.updateSearch('', null);
    vi.advanceTimersByTime(300);
    expect(search).not.toHaveBeenCalled();
  });

  it('cancels a stale in-flight request so late responses cannot overwrite fresh ones (switchMap)', () => {
    store.updateSearch('a', null);
    vi.advanceTimersByTime(300); // subscribes request #0

    store.updateSearch('ab', null);
    vi.advanceTimersByTime(300); // switchMap cancels #0, subscribes #1

    // Fresh (second) response resolves first.
    subjects[1]!.next({ total: 1, products: [product('b', 'Fresh')] });
    subjects[1]!.complete();

    // Stale (first) response arrives late — must be ignored.
    subjects[0]!.next({ total: 1, products: [product('a', 'Stale')] });

    expect(results().map((p) => p.name)).toEqual(['Fresh']);
  });

  it('persists recent searches (deduped, most-recent-first)', () => {
    store.pushRecent('pizza');
    store.pushRecent('burger');
    store.pushRecent('pizza');
    let recent: string[] = [];
    store.recent$.subscribe((r) => (recent = r)).unsubscribe();
    expect(recent).toEqual(['pizza', 'burger']);
    expect(JSON.parse(localStorage.getItem('sahm.recent-searches.v1')!)).toEqual(['pizza', 'burger']);
  });
});
