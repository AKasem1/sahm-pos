import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Tiny capacity sparkline (§7.3 nice-to-have). Pure SVG built from the capacity
 * history; no chart lib. `aria-hidden` since the numeric gauge conveys the data.
 */
@Component({
  selector: 'app-load-trend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length > 1) {
      <svg
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        class="h-7 w-full"
        aria-hidden="true"
      >
        <polyline
          [attr.points]="polyline()"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="text-brand"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    }
  `,
})
export class LoadTrendComponent {
  readonly points = input.required<number[]>();

  readonly polyline = computed(() => {
    const values = this.points();
    const n = values.length;
    if (n < 2) {
      return '';
    }
    return values
      .map((v, i) => {
        const x = (i / (n - 1)) * 100;
        const y = 28 - (Math.max(0, Math.min(100, v)) / 100) * 28;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });
}
