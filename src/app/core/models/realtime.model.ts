/**
 * Realtime event types emitted by the fake socket (§9.2).
 *
 * The socket multiplexes two event kinds over one stream. Consumers discriminate
 * on `kind`. Every order event carries `version`/`updatedAt` so the store can
 * reconcile against optimistic and polled state (§8).
 */

import { KitchenLoad } from './kitchen.model';
import { Order, OrderStatus } from './order.model';

export interface OrderUpdateEvent {
  readonly kind: 'order-update';
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly version: number;
  readonly updatedAt: string;
  /** Present when the socket announces a brand-new order. */
  readonly order?: Order;
}

export interface KitchenLoadEvent {
  readonly kind: 'kitchen-load';
  readonly load: KitchenLoad;
}

export type RealtimeEvent = OrderUpdateEvent | KitchenLoadEvent;

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting';
