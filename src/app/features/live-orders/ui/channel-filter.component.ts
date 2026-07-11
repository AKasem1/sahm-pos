import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChannelFilter } from '../data/live-orders.store';

interface Chip {
  readonly value: ChannelFilter;
  readonly label: string;
}

/** Channel filter chips (§7.1). Presentational; selection flows out via output. */
@Component({
  selector: 'app-channel-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter orders by channel">
      @for (chip of chips; track chip.value) {
        <button
          type="button"
          (click)="select.emit(chip.value)"
          [attr.aria-pressed]="active() === chip.value"
          class="rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-all active:scale-[0.97]"
          [class]="
            active() === chip.value
              ? 'bg-brand text-white ring-transparent shadow-sm'
              : 'bg-surface text-muted ring-line hover:text-ink hover:border-line-strong hover:bg-surface-2'
          "
        >
          {{ chip.label }}
        </button>
      }
    </div>
  `,
})
export class ChannelFilterComponent {
  readonly active = input.required<ChannelFilter>();
  readonly select = output<ChannelFilter>();

  readonly chips: readonly Chip[] = [
    { value: 'all', label: 'All' },
    { value: 'walk-in', label: 'Walk-in' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'online', label: 'Online' },
  ];
}
