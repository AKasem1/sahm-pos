import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { LoadGaugeComponent } from '../../kitchen-load/ui/load-gauge.component';
import { LoadTrendComponent } from '../../kitchen-load/ui/load-trend.component';
import { KitchenLoadStore } from '../../kitchen-load/data/kitchen-load.store';
import { AiPanelComponent } from '../../ai-assistant/ui/ai-panel.component';
import { AiAssistantStore } from '../../ai-assistant/data/ai-assistant.store';
import { LiveOrdersStore, OrderView } from '../data/live-orders.store';
import { ChannelFilterComponent } from './channel-filter.component';
import { OrderCardComponent } from './order-card.component';
import { RealtimeService } from '../../../core/services/realtime.service';
import { initialKitchenLoad } from '../../../../mocks/data/kitchen';

/**
 * Live Orders Workspace page (§7.1). Container component: it wires the store to
 * presentational children and owns the loading/empty/error state switch. No
 * business logic lives here — intents are forwarded straight to the store.
 *
 * Providers: both feature stores are provided at this route so they are scoped
 * to the page and auto-disposed on navigation away (ComponentStore teardown).
 */
@Component({
  selector: 'app-orders-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LiveOrdersStore, KitchenLoadStore, AiAssistantStore],
  imports: [
    ChannelFilterComponent,
    OrderCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    LoadGaugeComponent,
    LoadTrendComponent,
    AiPanelComponent,
  ],
  template: `
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <!-- Main column -->
      <section>
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold tracking-tight text-ink">Live Orders</h1>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span class="rounded-md bg-surface-2 px-2 py-0.5 font-medium text-muted ring-1 ring-inset ring-line">
                {{ counts().total }} total
              </span>
              <span class="rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger ring-1 ring-inset ring-danger-line">
                {{ counts().urgent }} urgent
              </span>
              <span class="rounded-md bg-warning-soft px-2 py-0.5 font-semibold text-warning ring-1 ring-inset ring-warning-line">
                {{ counts().delayed }} delayed
              </span>
            </div>
          </div>
          <button
            type="button"
            (click)="toggleConnection()"
            class="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-muted ring-1 ring-inset ring-line transition-all hover:text-ink hover:ring-line-strong active:scale-95"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              [class]="socketConnected() ? 'bg-success' : 'bg-faint'"
            ></span>
            {{ socketConnected() ? 'Simulate disconnect' : 'Reconnect socket' }}
          </button>
        </div>

        <app-channel-filter [active]="channelFilter()" (select)="store.setChannelFilter($event)" />

        <div class="mt-4">
          @switch (loadStatus()) {
            @case ('loading') {
              <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                @for (n of skeletons; track n) {
                  <div class="rounded-xl border border-line bg-surface p-3.5">
                    <app-skeleton height="1.25rem" width="55%" />
                    <div class="mt-4"><app-skeleton height="0.5rem" /></div>
                    <div class="mt-4 space-y-2">
                      <app-skeleton height="0.75rem" width="80%" />
                      <app-skeleton height="0.75rem" width="65%" />
                    </div>
                    <div class="mt-4"><app-skeleton height="2rem" /></div>
                  </div>
                }
              </div>
            }
            @case ('error') {
              <app-error-state
                title="Couldn't load orders"
                [message]="error() ?? ''"
                (retry)="store.loadOrders()"
              />
            }
            @default {
              @if (orders().length === 0) {
                <app-empty-state
                  icon="🍽️"
                  title="No orders for this filter"
                  message="Orders will appear here as they arrive across channels."
                />
              } @else {
                <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                  @for (order of orders(); track order.id) {
                    <app-order-card
                      [order]="order"
                      [pending]="isPending(order.id)"
                      (advance)="store.advanceStatus($event)"
                      (cancel)="store.cancelOrder($event)"
                      (viewAssistant)="openAssistant($event)"
                    />
                  }
                </div>
              }
            }
          }
        </div>
      </section>

      <!-- Sidebar -->
      <aside class="flex flex-col gap-4 lg:sticky lg:top-[5.75rem] lg:self-start">
        <div class="rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)]">
          <app-load-gauge [load]="kitchenLoad()" />
          <div class="mt-1 text-faint">
            <app-load-trend [points]="capacityTrend()" />
          </div>
        </div>

        @if (selectedOrder(); as order) {
          <app-ai-panel [order]="order" (close)="store.selectOrder(null)" />
        } @else {
          <div
            class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface/40 p-6 text-center text-sm text-muted"
          >
            <span class="text-2xl" aria-hidden="true">✨</span>
            <p>Select an order's <span class="font-semibold text-ink">AI</span> button to see live suggestions.</p>
          </div>
        }
      </aside>
    </div>
  `,
})
export class OrdersBoardComponent {
  readonly store = inject(LiveOrdersStore);
  private readonly kitchenStore = inject(KitchenLoadStore);
  private readonly realtime = inject(RealtimeService);

  readonly skeletons = Array.from({ length: 6 }, (_, i) => i);

  readonly orders = toSignal(this.store.filteredOrders$, { initialValue: [] as OrderView[] });
  readonly loadStatus = toSignal(this.store.loadStatus$, { initialValue: 'idle' as const });
  readonly error = toSignal(this.store.error$, { initialValue: null });
  readonly channelFilter = toSignal(this.store.channelFilter$, { initialValue: 'all' as const });
  readonly counts = toSignal(this.store.counts$, {
    initialValue: { total: 0, urgent: 0, delayed: 0 },
  });
  readonly selectedOrder = toSignal(this.store.selectedOrder$, { initialValue: null });
  readonly kitchenLoad = toSignal(this.kitchenStore.load$, {
    initialValue: initialKitchenLoad(),
  });
  readonly capacityTrend = toSignal(this.kitchenStore.capacityTrend$, { initialValue: [] });

  private readonly pendingIds = toSignal(this.store.pendingIds$, { initialValue: [] as string[] });
  private readonly pendingSet = computed(() => new Set(this.pendingIds()));
  readonly socketConnected = this.realtime.connected;

  constructor() {
    this.store.init();
    this.kitchenStore.init();
  }

  isPending(id: string): boolean {
    return this.pendingSet().has(id);
  }

  openAssistant(order: OrderView): void {
    this.store.selectOrder(order.id);
  }

  toggleConnection(): void {
    if (this.realtime.connected()) {
      this.realtime.disconnect();
    } else {
      this.realtime.reconnect();
      // Re-fetch + reconcile once the socket resumes.
      this.store.loadOrders();
    }
  }
}
