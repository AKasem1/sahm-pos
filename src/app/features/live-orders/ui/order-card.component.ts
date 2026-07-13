import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BadgeComponent, BadgeTone } from '../../../shared/ui/badge.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { formatCurrency } from '../../../core/utils/format';
import { nextStatus } from '../../../core/models/order.model';
import { OrderView } from '../data/live-orders.store';
import { StatusPipelineComponent } from './status-pipeline.component';

/**
 * Presentational order card (§7.1). All data comes via a single `order` input;
 * user intents leave via outputs. No store/service injection — this is a dumb
 * component so the board can render hundreds of them cheaply under OnPush.
 */
@Component({
  selector: 'app-order-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, StatusPipelineComponent, RelativeTimePipe, IconComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="group flex h-full animate-fade-in-up flex-col rounded-xl border bg-surface p-3.5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
      [class]="
        order().derivedPriority === 'urgent'
          ? 'border-danger-line'
          : order().delayed
            ? 'border-warning-line'
            : 'border-line'
      "
      [class.opacity-55]="pending()"
      [attr.aria-busy]="pending()"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold tracking-tight text-ink">{{ order().reference }}</span>
            <app-badge [tone]="channelTone()">{{ order().channel }}</app-badge>
          </div>
          <div class="mt-0.5 truncate text-xs text-faint">
            {{ order().customer?.name || 'Guest' }} · {{ order().createdAt | relativeTime }} old
          </div>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <app-badge [tone]="priorityTone()">{{ order().derivedPriority }}</app-badge>
          @if (order().delayed) {
            <app-badge tone="warning">delayed</app-badge>
          }
        </div>
      </div>

      <div class="mt-3.5">
        <app-status-pipeline [status]="order().status" />
      </div>

      <ul class="mt-3.5 space-y-1 text-xs text-muted">
        @for (item of order().items; track item.id) {
          <li class="flex justify-between gap-2">
            <span class="truncate">
              <span class="font-medium text-ink/70">{{ item.quantity }}×</span> {{ item.name }}
            </span>
            <span class="shrink-0 tabular-nums text-faint">{{ line(item.unitPrice, item.quantity) }}</span>
          </li>
        }
      </ul>

      @if (order().delivery?.risk === 'high') {
        <p
          class="mt-2.5 flex items-center gap-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger ring-1 ring-inset ring-danger-line"
        >
          <app-icon name="warning" [size]="14" /> High delivery risk · ETA
          {{ order().delivery?.etaMinutes }}m
        </p>
      }

      <div class="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        <span class="text-sm font-bold tracking-tight text-ink">{{ total() }}</span>
        <div class="flex gap-1.5">
          <button
            type="button"
            (click)="viewAssistant.emit(order())"
            class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-fg ring-1 ring-inset ring-brand-line transition-all hover:bg-brand-soft active:scale-95"
          >
            <app-icon name="sparkles" [size]="14" /> AI
          </button>
          @if (canCancel()) {
            <button
              type="button"
              (click)="cancel.emit(order())"
              [disabled]="pending()"
              class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-danger ring-1 ring-inset ring-danger-line transition-all hover:bg-danger-soft active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
          }
          @if (nextLabel()) {
            <button
              type="button"
              (click)="advance.emit(order())"
              [disabled]="pending()"
              class="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50"
            >
              {{ nextLabel() }}
            </button>
          }
        </div>
      </div>
    </article>
  `,
})
export class OrderCardComponent {
  readonly order = input.required<OrderView>();
  readonly pending = input(false);

  readonly advance = output<OrderView>();
  readonly cancel = output<OrderView>();
  readonly viewAssistant = output<OrderView>();

  readonly total = computed(() => formatCurrency(this.order().total));

  readonly nextLabel = computed(() => {
    const to = nextStatus(this.order().status);
    return to ? `→ ${to}` : null;
  });

  readonly canCancel = computed(() => {
    const s = this.order().status;
    return s !== 'cancelled' && s !== 'completed' && s !== 'delivered';
  });

  readonly channelTone = computed<BadgeTone>(() => {
    switch (this.order().channel) {
      case 'delivery':
        return 'info';
      case 'online':
        return 'brand';
      default:
        return 'neutral';
    }
  });

  readonly priorityTone = computed<BadgeTone>(() => {
    switch (this.order().derivedPriority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      default:
        return 'neutral';
    }
  });

  line(unitPrice: number, qty: number): string {
    return formatCurrency(unitPrice * qty);
  }
}
