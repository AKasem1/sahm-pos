import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConnectionService } from '../../../core/services/connection.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';

/**
 * Persistent offline / pending-sync banner (§7.5, §10). Rendered in the shell so
 * it is visible from any feature.
 */
@Component({
  selector: 'app-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (visible()) {
      <div
        class="border-b px-4 py-2 text-sm sm:px-6"
        [class]="tone()"
        role="status"
        aria-live="polite"
      >
        <div class="mx-auto flex max-w-[1600px] items-center gap-2.5">
          <span aria-hidden="true">{{ glyph() }}</span>
          <span class="font-semibold">{{ headline() }}</span>
          <span class="hidden opacity-80 sm:inline">{{ detail() }}</span>
          @if (queue.totalCount() > 0) {
            <a
              routerLink="/sync"
              class="ml-auto rounded-md px-2 py-0.5 font-medium underline-offset-2 hover:underline"
            >
              View pending ({{ queue.totalCount() }}) →
            </a>
          }
        </div>
      </div>
    }
  `,
})
export class OfflineBannerComponent {
  private readonly connection = inject(ConnectionService);
  readonly queue = inject(OfflineQueueService);

  readonly status = this.connection.status;

  readonly visible = computed(() => this.status() !== 'online' || this.queue.totalCount() > 0);

  readonly glyph = computed(() => {
    if (this.status() === 'offline') return '⚠️';
    if (this.queue.isReplaying()) return '↻';
    if (this.queue.failedCount() > 0) return '⚠️';
    return '✓';
  });

  readonly headline = computed(() => {
    if (this.status() === 'offline') return "You're offline";
    if (this.queue.isReplaying()) return 'Syncing…';
    if (this.queue.failedCount() > 0) return 'Some actions failed to sync';
    if (this.queue.pendingCount() > 0) return 'Pending changes';
    return 'Back online';
  });

  readonly detail = computed(() => {
    if (this.status() === 'offline') {
      return 'Actions are saved and will sync automatically when the connection returns.';
    }
    if (this.queue.pendingCount() > 0) return `${this.queue.pendingCount()} action(s) queued.`;
    return '';
  });

  readonly tone = computed(() => {
    if (this.status() === 'offline') return 'border-danger-line bg-danger-soft text-danger';
    if (this.queue.failedCount() > 0) return 'border-warning-line bg-warning-soft text-warning';
    return 'border-brand-line bg-brand-soft text-brand-fg';
  });
}
