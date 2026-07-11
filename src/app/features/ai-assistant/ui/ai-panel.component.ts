import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { AiSuggestion, AiSuggestionType } from '../../../core/models/ai.model';
import { Order } from '../../../core/models/order.model';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';
import { CLOCK } from '../../../core/tokens/clock.token';
import { idempotencyKey } from '../../../core/utils/id';
import { AiAssistantStore } from '../data/ai-assistant.store';
import { SuggestionCardComponent } from './suggestion-card.component';

/**
 * AI Assistant panel (§7.2). Container: injects the board-scoped
 * AiAssistantStore, auto-requests the suggestions relevant to the selected
 * order, and lets the user request more types. Accepting a suggestion enqueues
 * an offline-safe action so it survives connection loss (§7.5).
 */
@Component({
  selector: 'app-ai-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SuggestionCardComponent],
  template: `
    <div class="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <header
        class="flex items-center justify-between border-b border-line bg-gradient-to-br from-brand-soft/60 to-transparent px-3.5 py-2.5"
      >
        <div class="flex items-center gap-2">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-sm ring-1 ring-inset ring-brand-line"
            aria-hidden="true"
            >✨</span
          >
          <div>
            <h2 class="text-sm font-semibold text-ink">AI Assistant</h2>
            <p class="text-xs text-faint">{{ order().reference }}</p>
          </div>
        </div>
        <button
          type="button"
          (click)="close.emit()"
          class="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Close assistant"
        >
          ✕
        </button>
      </header>

      <div class="flex flex-wrap gap-1.5 border-b border-line px-3.5 py-2.5">
        @for (type of allTypes; track type) {
          <button
            type="button"
            (click)="request(type)"
            class="rounded-full px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-line transition-all hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            + {{ labelFor(type) }}
          </button>
        }
      </div>

      <div class="max-h-[28rem] space-y-2 overflow-y-auto p-3.5">
        @for (s of suggestions(); track s.id) {
          <app-suggestion-card [suggestion]="s" (retry)="retry(s.type)" (accept)="accept(s)" />
        } @empty {
          <p class="py-4 text-center text-sm text-faint">Requesting suggestions…</p>
        }
      </div>
    </div>
  `,
})
export class AiPanelComponent {
  private readonly store = inject(AiAssistantStore);
  private readonly queue = inject(OfflineQueueService);
  private readonly clock = inject(CLOCK);

  readonly order = input.required<Order>();
  readonly close = output<void>();

  readonly allTypes: readonly AiSuggestionType[] = [
    'upsell',
    'allergy_warning',
    'missing_info',
    'delivery_risk',
    'kitchen_overload',
  ];

  private readonly orderId = computed(() => this.order().id);

  readonly suggestions = toSignal(
    toObservable(this.orderId).pipe(switchMap((id) => this.store.selectSuggestions(id))),
    { initialValue: [] as AiSuggestion[] },
  );

  private readonly autoRequested = new Set<string>();

  constructor() {
    // Auto-request the contextually relevant suggestions when the order changes.
    effect(() => {
      const order = this.order();
      if (this.autoRequested.has(order.id)) {
        return;
      }
      this.autoRequested.add(order.id);
      const types: AiSuggestionType[] = ['upsell', 'allergy_warning'];
      if (order.channel === 'delivery') {
        types.push('delivery_risk');
      }
      types.forEach((type) => this.store.requestSuggestion({ order, type }));
    });
  }

  labelFor(type: AiSuggestionType): string {
    return type.replace('_', ' ');
  }

  request(type: AiSuggestionType): void {
    this.store.requestSuggestion({ order: this.order(), type });
  }

  retry(type: AiSuggestionType): void {
    this.store.retrySuggestion({ order: this.order(), type });
  }

  accept(suggestion: AiSuggestion): void {
    // Optimistic + offline-safe: queue an ACCEPT_SUGGESTION with an idempotency
    // key so it replays exactly once on reconnect (§7.5).
    this.queue.enqueue({
      id: idempotencyKey(),
      type: 'ACCEPT_SUGGESTION',
      payload: { orderId: this.order().id, suggestionId: suggestion.id },
      createdAt: this.clock.now().toISOString(),
    });
  }
}
