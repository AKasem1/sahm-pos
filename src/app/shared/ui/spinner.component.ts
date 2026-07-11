import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Presentational loading spinner (§10 loading states). */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-block animate-spin rounded-full border-2 border-line-strong border-t-brand"
      [style.width.px]="size()"
      [style.height.px]="size()"
      role="status"
      [attr.aria-label]="label()"
    ></span>
  `,
})
export class SpinnerComponent {
  readonly size = input(18);
  readonly label = input('Loading');
}
