import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { QueuedAction } from '../../../core/models/offline.model';
import { BadgeComponent, BadgeTone } from '../../../shared/ui/badge.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

/** Presentational list of queued offline actions (§7.5). */
@Component({
  selector: 'app-pending-queue-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, RelativeTimePipe],
  template: `
    <ul class="divide-y divide-line rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
      @for (action of actions(); track action.id) {
        <li class="flex animate-fade-in-up items-center gap-3 px-3.5 py-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-ink">{{ label(action) }}</span>
              <app-badge [tone]="tone(action)">{{ action.syncState }}</app-badge>
              @if (action.attempts > 0) {
                <span class="text-xs text-faint">· {{ action.attempts }} attempt(s)</span>
              }
            </div>
            <p class="truncate text-xs text-faint">
              {{ subtitle(action) }} · queued {{ action.createdAt | relativeTime }} ago
              @if (action.lastError) {
                · <span class="text-danger">{{ action.lastError }}</span>
              }
            </p>
          </div>
          @if (action.syncState === 'failed') {
            <button
              type="button"
              (click)="discard.emit(action.id)"
              class="rounded-lg px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Discard
            </button>
          }
        </li>
      }
    </ul>
  `,
})
export class PendingQueueListComponent {
  readonly actions = input.required<QueuedAction[]>();
  readonly discard = output<string>();

  label(action: QueuedAction): string {
    switch (action.type) {
      case 'ADVANCE_STATUS':
        return 'Advance status';
      case 'CANCEL_ORDER':
        return 'Cancel order';
      case 'ACCEPT_SUGGESTION':
        return 'Accept AI suggestion';
    }
  }

  subtitle(action: QueuedAction): string {
    const payload = action.payload as { orderId?: string; toStatus?: string };
    const parts = [payload.orderId, payload.toStatus].filter(Boolean);
    return parts.join(' → ') || action.id;
  }

  tone(action: QueuedAction): BadgeTone {
    switch (action.syncState) {
      case 'syncing':
        return 'info';
      case 'failed':
        return 'danger';
      default:
        return 'warning';
    }
  }
}
