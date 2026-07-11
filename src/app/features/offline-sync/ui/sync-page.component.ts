import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ConnectionService } from '../../../core/services/connection.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { PendingQueueListComponent } from './pending-queue-list.component';

/**
 * Offline Sync page (§7.5). Container for the pending-action queue + demo
 * controls. The queue itself is owned by the app-wide, root-provided
 * `OfflineQueueService` (Layer 1) rather than a disposable feature store,
 * because the queue must persist and replay regardless of which route is open —
 * a deliberate deviation from a per-feature ComponentStore for this cross-cutting
 * concern (documented in the README). The page injects that service directly.
 */
@Component({
  selector: 'app-sync-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PendingQueueListComponent, EmptyStateComponent],
  template: `
    <div class="mx-auto max-w-3xl">
      <h1 class="text-xl font-bold tracking-tight text-ink">Offline Sync</h1>
      <p class="mb-4 text-sm text-muted">
        Actions taken offline are applied optimistically, persisted to IndexedDB, and replayed
        exactly once on reconnect using per-action idempotency keys.
      </p>

      <!-- Status + demo controls -->
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)]">
          <div class="text-[10px] font-medium uppercase text-faint">Connection</div>
          <div class="mt-0.5 text-sm font-bold capitalize" [class]="statusClass()">{{ status() }}</div>
        </div>
        <div class="rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)]">
          <div class="text-[10px] font-medium uppercase text-faint">Pending</div>
          <div class="mt-0.5 text-sm font-bold tabular-nums text-ink">{{ queue.pendingCount() }}</div>
        </div>
        <div class="rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)]">
          <div class="text-[10px] font-medium uppercase text-faint">Failed</div>
          <div class="mt-0.5 text-sm font-bold tabular-nums text-ink">{{ queue.failedCount() }}</div>
        </div>
        <div class="rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)]">
          <div class="text-[10px] font-medium uppercase text-faint">Last sync</div>
          <div class="mt-0.5 text-sm font-bold text-ink">{{ lastSyncLabel() }}</div>
        </div>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          (click)="toggleOffline()"
          class="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
          [class]="isOnline() ? 'bg-danger' : 'bg-success'"
        >
          {{ isOnline() ? 'Go offline (simulate)' : 'Go back online' }}
        </button>
        <button
          type="button"
          (click)="queue.replay()"
          [disabled]="!isOnline() || queue.pendingCount() === 0"
          class="rounded-lg bg-surface px-3.5 py-1.5 text-sm font-semibold text-muted ring-1 ring-inset ring-line transition-all hover:text-ink hover:ring-line-strong active:scale-95 disabled:opacity-50"
        >
          Sync now
        </button>
        @if (queue.failedCount() > 0) {
          <button
            type="button"
            (click)="queue.retryFailed()"
            class="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-warning ring-1 ring-inset ring-warning-line transition-all hover:bg-warning-soft active:scale-95"
          >
            Retry failed
          </button>
        }
      </div>

      @if (queue.totalCount() === 0) {
        <app-empty-state
          icon="✅"
          title="Everything is in sync"
          message="Go offline and advance or cancel an order on the Live Orders page to see queued actions here."
        />
      } @else {
        <app-pending-queue-list [actions]="actions()" (discard)="queue.discard($event)" />
      }
    </div>
  `,
})
export class SyncPageComponent {
  private readonly connection = inject(ConnectionService);
  readonly queue = inject(OfflineQueueService);

  readonly status = this.connection.status;
  readonly isOnline = this.connection.isOnline;
  readonly actions = this.queue.actions;

  readonly lastSyncLabel = computed(() => {
    const at = this.queue.lastSyncAt();
    if (!at) {
      return '—';
    }
    return new Date(at).toLocaleTimeString();
  });

  readonly statusClass = computed(() => {
    switch (this.status()) {
      case 'online':
        return 'text-success';
      case 'reconnecting':
        return 'text-warning';
      case 'offline':
        return 'text-danger';
    }
  });

  toggleOffline(): void {
    this.connection.setBrowserOnline(!this.isOnline());
  }
}
