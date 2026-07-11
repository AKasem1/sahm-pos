import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ORDER_PIPELINE, OrderStatus } from '../../../core/models/order.model';

interface Step {
  readonly status: OrderStatus;
  readonly label: string;
  readonly done: boolean;
  readonly current: boolean;
}

const LABELS: Record<OrderStatus, string> = {
  received: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Status pipeline visual (§7.1): received → preparing → ready → delivered →
 * completed, with cancelled shown as a terminal side-exit. Pure presentational.
 */
@Component({
  selector: 'app-status-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cancelled()) {
      <div class="flex items-center gap-1.5 text-xs font-semibold text-danger">
        <span class="h-2 w-2 rounded-full bg-danger"></span>
        Cancelled
      </div>
    } @else {
      <ol class="flex items-center gap-1" [attr.aria-label]="'Status: ' + currentLabel()">
        @for (step of steps(); track step.status) {
          <li class="flex items-center gap-1">
            <span
              class="h-2 w-2 rounded-full transition-all duration-300"
              [class]="
                step.current
                  ? 'bg-brand ring-4 ring-brand-soft scale-110'
                  : step.done
                    ? 'bg-brand'
                    : 'bg-line-strong'
              "
              [title]="step.label"
            ></span>
            @if (!$last) {
              <span
                class="h-0.5 w-4 rounded transition-colors duration-300"
                [class]="step.done ? 'bg-brand/60' : 'bg-line'"
              ></span>
            }
          </li>
        }
      </ol>
    }
  `,
})
export class StatusPipelineComponent {
  readonly status = input.required<OrderStatus>();

  readonly cancelled = computed(() => this.status() === 'cancelled');
  readonly currentLabel = computed(() => LABELS[this.status()]);

  readonly steps = computed<Step[]>(() => {
    const currentIdx = ORDER_PIPELINE.indexOf(this.status());
    return ORDER_PIPELINE.map((status, idx) => ({
      status,
      label: LABELS[status],
      done: idx < currentIdx,
      current: idx === currentIdx,
    }));
  });
}
