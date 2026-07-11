/**
 * Canonical order domain types (§4).
 *
 * These live in `core/models` and are the single contract shared by the MSW
 * mocks, the RxJS services, the ComponentStores and the UI. Nothing else in the
 * app should redefine an order shape.
 */

export type OrderChannel = 'walk-in' | 'delivery' | 'online';

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type OrderPriority = 'normal' | 'high' | 'urgent';

export type DeliveryRisk = 'none' | 'low' | 'high';

export interface OrderItem {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly modifiers?: string[];
  readonly allergens?: string[];
}

export interface OrderDelivery {
  readonly address?: string;
  readonly etaMinutes?: number;
  readonly risk?: DeliveryRisk;
}

export interface OrderCustomer {
  readonly name?: string;
  readonly phone?: string;
}

export interface Order {
  readonly id: string;
  /** Human-friendly reference, e.g. `#A-1042`. */
  readonly reference: string;
  readonly channel: OrderChannel;
  readonly status: OrderStatus;
  /** Derived from kitchen load + age (see §7 / derivePriority). */
  readonly priority: OrderPriority;
  readonly items: OrderItem[];
  readonly total: number;
  readonly customer?: OrderCustomer;
  readonly delivery?: OrderDelivery;
  /** ISO timestamp. */
  readonly createdAt: string;
  /** ISO timestamp. */
  readonly updatedAt: string;
  /** Monotonic version used for race/conflict reconciliation (§8). */
  readonly version: number;
}

/**
 * The forward status pipeline shown in the board UI. `cancelled` is a terminal
 * side-exit and is intentionally excluded from the linear flow.
 */
export const ORDER_PIPELINE: readonly OrderStatus[] = [
  'received',
  'preparing',
  'ready',
  'delivered',
  'completed',
] as const;

/** Terminal statuses that can no longer be advanced. */
export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'completed',
  'cancelled',
]);

/** Returns the next status in the pipeline, or `null` at a terminal state. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  if (TERMINAL_STATUSES.has(status)) {
    return null;
  }
  const idx = ORDER_PIPELINE.indexOf(status);
  if (idx === -1 || idx === ORDER_PIPELINE.length - 1) {
    return null;
  }
  return ORDER_PIPELINE[idx + 1] ?? null;
}
