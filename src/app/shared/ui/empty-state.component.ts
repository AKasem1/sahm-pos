import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Presentational empty-state (§10). Content projected for custom actions. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-12 text-center"
    >
      <div
        class="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-xl"
        aria-hidden="true"
      >
        {{ icon() }}
      </div>
      <p class="text-sm font-semibold text-ink">{{ title() }}</p>
      @if (message()) {
        <p class="max-w-sm text-sm text-muted">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('📭');
  readonly title = input('Nothing here yet');
  readonly message = input('');
}
