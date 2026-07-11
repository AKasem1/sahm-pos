import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PRODUCT_CATEGORIES, Product, ProductCategory } from '../../../core/models/product.model';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { SearchStore } from '../data/search.store';
import { ResultItemComponent } from './result-item.component';

/**
 * Advanced Product Search page (§7.4). Container owning the ARIA combobox
 * semantics and the keyboard-navigation index (a component-local signal — the
 * fast Layer-3 path with no store round-trip). Results are virtualized with the
 * CDK viewport so a multi-thousand-item catalog scrolls smoothly and only the
 * visible rows are ever in the DOM.
 */
@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SearchStore],
  imports: [
    ScrollingModule,
    ResultItemComponent,
    SpinnerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="text-xl font-bold tracking-tight text-ink">Product Search</h1>
      <p class="mb-4 text-sm text-muted">
        Keyboard-first search over {{ catalogHint }} menu items across branches.
      </p>

      <!-- Combobox -->
      <div class="relative">
        <div
          class="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 shadow-[var(--shadow-card)] transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft"
        >
          <span aria-hidden="true" class="text-faint">🔎</span>
          <input
            #searchInput
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="search-listbox"
            [attr.aria-expanded]="isOpen()"
            [attr.aria-activedescendant]="activeDescendant()"
            [value]="vm().query"
            (input)="onInput($event)"
            (focus)="open()"
            (blur)="onBlur()"
            (keydown)="onKeydown($event)"
            placeholder="Search burgers, pizza, drinks…"
            class="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            autocomplete="off"
          />
          @if (vm().status === 'loading') {
            <app-spinner [size]="16" />
          } @else if (vm().query) {
            <button
              type="button"
              (click)="clear()"
              class="rounded-md p-1 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Clear search"
            >
              ✕
            </button>
          }
        </div>

        <!-- Category chips -->
        <div class="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          @for (cat of categories; track cat) {
            <button
              type="button"
              (click)="toggleCategory(cat)"
              [attr.aria-pressed]="vm().category === cat"
              class="rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset transition-all active:scale-95"
              [class]="
                vm().category === cat
                  ? 'bg-brand text-white ring-transparent shadow-sm'
                  : 'bg-surface text-muted ring-line hover:text-ink hover:bg-surface-2'
              "
            >
              {{ cat }}
            </button>
          }
        </div>

        <!-- Dropdown -->
        @if (isOpen()) {
          <div
            class="absolute z-20 mt-2 w-full animate-fade-in-up overflow-hidden rounded-xl border border-line bg-elevated shadow-[var(--shadow-pop)]"
          >
            @if (vm().showRecent) {
              @if (vm().recent.length) {
                <div class="flex items-center justify-between px-3.5 py-2 text-xs font-medium text-faint">
                  <span>Recent searches</span>
                  <button
                    type="button"
                    (mousedown)="clearRecent($event)"
                    class="rounded px-1 hover:text-ink"
                  >
                    Clear
                  </button>
                </div>
                <ul>
                  @for (term of vm().recent; track term) {
                    <li>
                      <button
                        type="button"
                        (mousedown)="pickRecent($event, term)"
                        class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <span class="text-faint" aria-hidden="true">🕑</span> {{ term }}
                      </button>
                    </li>
                  }
                </ul>
              } @else {
                <div class="px-3.5 py-6 text-center text-sm text-faint">
                  Start typing to search the catalog.
                </div>
              }
            } @else if (vm().status === 'error') {
              <div class="p-3">
                <app-error-state
                  title="Search failed"
                  [message]="vm().error ?? ''"
                  (retry)="retry()"
                />
              </div>
            } @else if (vm().results.length === 0 && vm().status === 'success') {
              <div class="px-3.5 py-6 text-center text-sm text-faint">
                No matches for “{{ vm().query }}”.
              </div>
            } @else {
              <div class="border-b border-line px-3.5 py-1.5 text-xs font-medium text-faint">
                {{ vm().total }} result(s)
              </div>
              <cdk-virtual-scroll-viewport
                #viewport
                [itemSize]="itemSize"
                id="search-listbox"
                role="listbox"
                aria-label="Search results"
                class="block h-80"
              >
                <div
                  *cdkVirtualFor="let product of vm().results; let i = index; trackBy: trackById"
                  [id]="'opt-' + i"
                  role="option"
                  [attr.aria-selected]="i === highlightedIndex()"
                  (mousedown)="pickResult($event, product)"
                  (mouseenter)="highlightedIndex.set(i)"
                  class="cursor-pointer"
                  [style.height.px]="itemSize"
                >
                  <app-result-item
                    [product]="product"
                    [query]="vm().query"
                    [active]="i === highlightedIndex()"
                  />
                </div>
              </cdk-virtual-scroll-viewport>
            }
          </div>
        }
      </div>

      @if (selected(); as p) {
        <app-empty-state
          class="mt-6 block"
          icon="✅"
          [title]="'Selected: ' + p.name"
          message="In a real POS this would add the item to the active order."
        />
      }
    </div>
  `,
})
export class SearchPageComponent {
  private readonly store = inject(SearchStore);
  readonly catalogHint = '2,000+';

  readonly categories: readonly ProductCategory[] = PRODUCT_CATEGORIES;
  readonly itemSize = 52;

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private readonly viewport = viewChild<CdkVirtualScrollViewport>('viewport');

  readonly vm = toSignal(this.store.vm$, {
    initialValue: {
      query: '',
      category: null as ProductCategory | null,
      results: [] as Product[],
      total: 0,
      status: 'idle' as const,
      error: null as string | null,
      recent: [] as string[],
      showRecent: true,
    },
  });

  readonly isOpen = signal(false);
  readonly highlightedIndex = signal(-1);
  readonly selected = signal<Product | null>(null);

  readonly activeDescendant = computed(() =>
    this.highlightedIndex() >= 0 ? `opt-${this.highlightedIndex()}` : null,
  );

  open(): void {
    this.isOpen.set(true);
  }

  onBlur(): void {
    // Delay so a mousedown on an option/recent item registers before we close.
    setTimeout(() => this.isOpen.set(false), 120);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.highlightedIndex.set(-1);
    this.isOpen.set(true);
    this.selected.set(null);
    this.store.updateSearch(value, this.vm().category);
  }

  toggleCategory(cat: ProductCategory): void {
    const next = this.vm().category === cat ? null : cat;
    this.isOpen.set(true);
    this.store.updateSearch(this.vm().query, next);
  }

  onKeydown(event: KeyboardEvent): void {
    const results = this.vm().results;
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        this.isOpen.set(true);
        const next = Math.min(this.highlightedIndex() + 1, results.length - 1);
        this.highlightedIndex.set(next);
        this.scrollToActive(next);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = Math.max(this.highlightedIndex() - 1, 0);
        this.highlightedIndex.set(prev);
        this.scrollToActive(prev);
        break;
      }
      case 'Enter': {
        event.preventDefault();
        const idx = this.highlightedIndex();
        if (idx >= 0 && results[idx]) {
          this.selectProduct(results[idx]);
        } else if (this.vm().query.trim()) {
          this.store.pushRecent(this.vm().query);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        this.isOpen.set(false);
        this.highlightedIndex.set(-1);
        break;
      }
    }
  }

  private scrollToActive(index: number): void {
    this.viewport()?.scrollToIndex(index, 'smooth');
  }

  pickResult(event: Event, product: Product): void {
    event.preventDefault();
    this.selectProduct(product);
  }

  private selectProduct(product: Product): void {
    this.selected.set(product);
    this.store.pushRecent(product.name);
    this.isOpen.set(false);
  }

  pickRecent(event: Event, term: string): void {
    event.preventDefault();
    this.store.updateSearch(term, this.vm().category);
    this.inputRef().nativeElement.focus();
    this.isOpen.set(true);
  }

  clearRecent(event: Event): void {
    event.preventDefault();
    this.store.clearRecent();
  }

  clear(): void {
    this.store.updateSearch('', this.vm().category);
    this.highlightedIndex.set(-1);
    this.selected.set(null);
    this.inputRef().nativeElement.focus();
  }

  retry(): void {
    this.store.updateSearch(this.vm().query, this.vm().category);
  }

  trackById(_index: number, product: Product): string {
    return product.id;
  }
}
