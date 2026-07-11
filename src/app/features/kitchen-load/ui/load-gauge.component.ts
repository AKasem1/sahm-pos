import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { KitchenLoad, KitchenLoadLevel } from '../../../core/models/kitchen.model';

/**
 * Kitchen load gauge (§7.3). Presentational: capacity bar + level, plus active
 * orders and avg prep time. Colour tracks the load level.
 */
@Component({
  selector: 'app-load-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold uppercase tracking-wide text-faint">Kitchen load</span>
        <span
          class="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset"
          [class]="badgeClass()"
          >{{ load().level }}</span
        >
      </div>

      <div
        class="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter"
        [attr.aria-valuenow]="load().capacityPct"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-label]="'Kitchen capacity ' + load().capacityPct + '%'"
      >
        <div
          class="h-full rounded-full transition-[width] duration-700 ease-out"
          [class]="barClass()"
          [style.width.%]="load().capacityPct"
        ></div>
      </div>

      <dl class="mt-3.5 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-surface-2 py-1.5">
          <dt class="text-[10px] font-medium uppercase text-faint">Capacity</dt>
          <dd class="text-sm font-bold tabular-nums text-ink">{{ load().capacityPct }}%</dd>
        </div>
        <div class="rounded-lg bg-surface-2 py-1.5">
          <dt class="text-[10px] font-medium uppercase text-faint">Active</dt>
          <dd class="text-sm font-bold tabular-nums text-ink">{{ load().activeOrders }}</dd>
        </div>
        <div class="rounded-lg bg-surface-2 py-1.5">
          <dt class="text-[10px] font-medium uppercase text-faint">Avg prep</dt>
          <dd class="text-sm font-bold tabular-nums text-ink">{{ load().avgPrepMinutes }}m</dd>
        </div>
      </dl>
    </div>
  `,
})
export class LoadGaugeComponent {
  readonly load = input.required<KitchenLoad>();

  private readonly level = computed<KitchenLoadLevel>(() => this.load().level);

  readonly barClass = computed(() => {
    switch (this.level()) {
      case 'low':
        return 'bg-success';
      case 'medium':
        return 'bg-brand';
      case 'high':
        return 'bg-warning';
      case 'critical':
        return 'bg-danger';
    }
  });

  readonly badgeClass = computed(() => {
    switch (this.level()) {
      case 'low':
        return 'bg-success-soft text-success ring-success-line';
      case 'medium':
        return 'bg-brand-soft text-brand-fg ring-brand-line';
      case 'high':
        return 'bg-warning-soft text-warning ring-warning-line';
      case 'critical':
        return 'bg-danger-soft text-danger ring-danger-line';
    }
  });
}
