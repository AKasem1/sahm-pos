import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Presentational error-state with a keyboard-reachable Retry button (§10).
 * Emits `retry`; the container owns the actual recovery logic.
 */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl border border-danger-line bg-danger-soft px-6 py-8 text-center"
      role="alert"
    >
      <div
        class="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-xl shadow-[var(--shadow-card)]"
        aria-hidden="true"
      >
        ⚠️
      </div>
      <p class="text-sm font-semibold text-danger">{{ title() }}</p>
      @if (message()) {
        <p class="max-w-sm text-sm text-danger/80">{{ message() }}</p>
      }
      @if (showRetry()) {
        <button
          type="button"
          (click)="retry.emit()"
          class="rounded-lg bg-danger px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
        >
          {{ retryLabel() }}
        </button>
      }
    </div>
  `,
})
export class ErrorStateComponent {
  readonly title = input('Something went wrong');
  readonly message = input('');
  readonly showRetry = input(true);
  readonly retryLabel = input('Retry');
  readonly retry = output<void>();
}
