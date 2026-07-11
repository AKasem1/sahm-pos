import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AI_SUGGESTION_LABELS, AiSuggestion } from '../../../core/models/ai.model';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { StreamingTextComponent } from './streaming-text.component';

/**
 * One AI suggestion, rendering every state of the machine (§7.2): idle, loading,
 * streaming, success and error (with a keyboard-reachable Retry). Presentational
 * — request/retry/accept intents leave via outputs.
 */
@Component({
  selector: 'app-suggestion-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent, StreamingTextComponent],
  template: `
    <div class="animate-pop-in rounded-xl border border-line bg-surface-2/50 p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-ink">{{ label() }}</span>
        <span class="text-[10px] font-bold uppercase tracking-wide" [class]="statusClass()">
          {{ suggestion().status }}
          @if (suggestion().retryCount > 0) {
            · retry {{ suggestion().retryCount }}
          }
        </span>
      </div>

      <div class="mt-2 min-h-[2.5rem]">
        @switch (suggestion().status) {
          @case ('idle') {
            <p class="text-sm text-faint">Not requested yet.</p>
          }
          @case ('loading') {
            <div class="flex items-center gap-2 text-sm text-muted">
              <app-spinner [size]="14" />
              @if (suggestion().retryCount > 0) {
                Retrying…
              } @else {
                Thinking…
              }
            </div>
          }
          @case ('error') {
            <div
              class="rounded-lg bg-danger-soft px-2.5 py-1.5 text-sm text-danger ring-1 ring-inset ring-danger-line"
              role="alert"
            >
              {{ suggestion().error || 'Something went wrong.' }}
            </div>
          }
          @default {
            <app-streaming-text
              [content]="suggestion().content"
              [streaming]="suggestion().status === 'streaming'"
            />
          }
        }
      </div>

      <div class="mt-2 flex justify-end gap-1.5">
        @if (suggestion().status === 'error') {
          <button
            type="button"
            (click)="retry.emit()"
            class="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
          >
            Retry
          </button>
        }
        @if (suggestion().status === 'success' && acceptable()) {
          <button
            type="button"
            (click)="accept.emit()"
            class="rounded-lg bg-success px-2.5 py-1 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
          >
            Accept
          </button>
        }
      </div>
    </div>
  `,
})
export class SuggestionCardComponent {
  readonly suggestion = input.required<AiSuggestion>();

  readonly retry = output<void>();
  readonly accept = output<void>();

  readonly label = computed(() => AI_SUGGESTION_LABELS[this.suggestion().type]);

  readonly acceptable = computed(() =>
    ['upsell', 'missing_info'].includes(this.suggestion().type),
  );

  readonly statusClass = computed(() => {
    switch (this.suggestion().status) {
      case 'success':
        return 'text-success';
      case 'error':
        return 'text-danger';
      case 'streaming':
      case 'loading':
        return 'text-brand-fg';
      default:
        return 'text-faint';
    }
  });
}
