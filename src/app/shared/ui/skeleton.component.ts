import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Presentational shimmer skeleton block (§10). */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="block animate-pulse rounded-md bg-surface-2"
      [style.width]="width()"
      [style.height]="height()"
      aria-hidden="true"
    ></span>
  `,
})
export class SkeletonComponent {
  readonly width = input('100%');
  readonly height = input('1rem');
}
