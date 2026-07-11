import { KitchenLoad } from '../models/kitchen.model';
import { Order, OrderPriority } from '../models/order.model';

/**
 * Priority derivation (Appendix A / §7.3).
 *
 * Pure and deterministic: given an order, the current kitchen load and a clock
 * reading, decide the order's priority. It is unit-tested and consumed by the
 * store — never computed in a template. This is the single place where "kitchen
 * load influences order priority" lives.
 */
export function derivePriority(order: Order, load: KitchenLoad, now: Date): OrderPriority {
  const ageMin = (now.getTime() - new Date(order.createdAt).getTime()) / 60000;
  const deliveryAtRisk = order.delivery?.risk === 'high';

  if (load.level === 'critical' && (ageMin > 10 || deliveryAtRisk)) {
    return 'urgent';
  }
  if (load.level === 'high' && ageMin > 15) {
    return 'high';
  }
  if (deliveryAtRisk) {
    return 'high';
  }
  return 'normal';
}

/**
 * "Delayed" indicator (§7.3): an active order is flagged delayed when the
 * kitchen is under pressure and the order has aged past the average prep time.
 */
export function isDelayed(order: Order, load: KitchenLoad, now: Date): boolean {
  if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'delivered') {
    return false;
  }
  const ageMin = (now.getTime() - new Date(order.createdAt).getTime()) / 60000;
  const pressure = load.level === 'high' || load.level === 'critical';
  return pressure && ageMin > load.avgPrepMinutes;
}
