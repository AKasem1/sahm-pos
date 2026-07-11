import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** Presentational status/priority badge. Text alternative comes from content. */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset"
      [class]="toneClass()"
    >
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');

  readonly toneClass = computed(() => {
    switch (this.tone()) {
      case 'brand':
        return 'bg-brand-soft text-brand-fg ring-brand-line';
      case 'success':
        return 'bg-success-soft text-success ring-success-line';
      case 'warning':
        return 'bg-warning-soft text-warning ring-warning-line';
      case 'danger':
        return 'bg-danger-soft text-danger ring-danger-line';
      case 'info':
        return 'bg-info-soft text-info ring-info-line';
      default:
        return 'bg-surface-2 text-muted ring-line';
    }
  });
}
