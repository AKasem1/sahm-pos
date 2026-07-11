import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ConnectionService } from '../core/services/connection.service';

/**
 * Live connection pill. Uses an `aria-live` region so screen readers announce
 * connectivity changes (§10 ARIA).
 */
@Component({
  selector: 'app-connection-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-xs font-medium ring-1 ring-inset transition-colors"
      [class]="pillClass()"
      role="status"
      aria-live="polite"
    >
      <span class="relative flex h-2 w-2">
        @if (status() !== 'offline') {
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            [class]="dotClass()"
          ></span>
        }
        <span class="relative inline-flex h-2 w-2 rounded-full" [class]="dotClass()"></span>
      </span>
      {{ label() }}
    </span>
  `,
})
export class ConnectionIndicatorComponent {
  private readonly connection = inject(ConnectionService);
  readonly status = this.connection.status;

  readonly label = computed(() => {
    switch (this.status()) {
      case 'online':
        return 'Live';
      case 'reconnecting':
        return 'Reconnecting';
      case 'offline':
        return 'Offline';
    }
  });

  readonly pillClass = computed(() => {
    switch (this.status()) {
      case 'online':
        return 'bg-success-soft text-success ring-success-line';
      case 'reconnecting':
        return 'bg-warning-soft text-warning ring-warning-line';
      case 'offline':
        return 'bg-danger-soft text-danger ring-danger-line';
    }
  });

  readonly dotClass = computed(() => {
    switch (this.status()) {
      case 'online':
        return 'bg-success';
      case 'reconnecting':
        return 'bg-warning';
      case 'offline':
        return 'bg-danger';
    }
  });
}
