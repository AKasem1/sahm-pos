import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { formatCurrency } from '../../../core/utils/format';
import { HighlightMatchPipe } from '../../../shared/pipes/highlight-match.pipe';

/**
 * Presentational search result row. Renders the query match with `<mark>` via
 * typed segments (HighlightMatchPipe) — never `innerHTML`, so it's XSS-safe
 * (§7.4). `active` styling is driven by the parent's keyboard highlight.
 */
@Component({
  selector: 'app-result-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HighlightMatchPipe],
  template: `
    <div
      class="flex items-center justify-between gap-3 border-l-2 px-3 py-2 transition-colors"
      [class]="active() ? 'border-brand bg-brand-soft' : 'border-transparent bg-transparent'"
    >
      <div class="min-w-0">
        <p class="truncate text-sm text-ink">
          @for (seg of product().name | highlightMatch: query(); track $index) {
            @if (seg.match) {
              <mark class="rounded bg-warning-soft px-0.5 font-semibold text-warning">{{ seg.text }}</mark>
            } @else {
              <span>{{ seg.text }}</span>
            }
          }
        </p>
        <p class="text-xs capitalize text-faint">
          {{ product().category }}
          @if (!product().available) {
            · <span class="font-medium text-danger">unavailable</span>
          }
        </p>
      </div>
      <span class="shrink-0 text-sm font-semibold tabular-nums text-muted">{{ price() }}</span>
    </div>
  `,
})
export class ResultItemComponent {
  readonly product = input.required<Product>();
  readonly query = input('');
  readonly active = input(false);

  readonly price = computed(() => formatCurrency(this.product().price));
}
