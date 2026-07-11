import { KitchenLoad } from '../../app/core/models/kitchen.model';
import { Order, OrderStatus, nextStatus } from '../../app/core/models/order.model';
import { initialKitchenLoad } from '../data/kitchen';
import { buildSeedOrders } from '../data/orders';

/**
 * In-memory mock database shared by the MSW handlers and the fake socket.
 *
 * A single mutable source of truth means REST mutations, polling reads and
 * socket-driven progression all agree — which is exactly what lets us
 * demonstrate reconciliation across the three update sources (§7.1).
 */
class MockDb {
  private orders = new Map<string, Order>();
  private kitchen: KitchenLoad = initialKitchenLoad();
  /** Idempotency keys already applied, for replay-safe mutations (§7.5). */
  private appliedKeys = new Set<string>();

  constructor() {
    this.reset();
  }

  reset(seedCount = 60, base = Date.now()): void {
    this.orders = new Map(buildSeedOrders(seedCount, base).map((o) => [o.id, o]));
    this.kitchen = initialKitchenLoad();
    this.appliedKeys.clear();
  }

  listOrders(): Order[] {
    return [...this.orders.values()];
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  getKitchen(): KitchenLoad {
    return this.kitchen;
  }

  setKitchen(load: KitchenLoad): void {
    this.kitchen = load;
  }

  private bump(order: Order, patch: Partial<Order>): Order {
    const updated: Order = {
      ...order,
      ...patch,
      version: order.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(order.id, updated);
    return updated;
  }

  /**
   * Advance an order's status with optimistic-concurrency + idempotency checks.
   * Returns a discriminated result the handler maps to HTTP status codes.
   */
  advanceStatus(
    id: string,
    toStatus: OrderStatus,
    fromVersion: number | undefined,
    idempotencyKey: string | null,
  ): { ok: true; order: Order } | { ok: false; reason: 'not-found' | 'conflict' | 'invalid' } {
    const order = this.orders.get(id);
    if (!order) {
      return { ok: false, reason: 'not-found' };
    }
    if (idempotencyKey && this.appliedKeys.has(idempotencyKey)) {
      return { ok: true, order }; // replay-safe no-op
    }
    // Optimistic-concurrency guard: reject if the client acted on stale state.
    if (typeof fromVersion === 'number' && fromVersion < order.version) {
      return { ok: false, reason: 'conflict' };
    }
    const expected = nextStatus(order.status);
    if (expected !== toStatus) {
      return { ok: false, reason: 'invalid' };
    }
    if (idempotencyKey) {
      this.appliedKeys.add(idempotencyKey);
    }
    return { ok: true, order: this.bump(order, { status: toStatus }) };
  }

  cancelOrder(
    id: string,
    fromVersion: number | undefined,
    idempotencyKey: string | null,
  ): { ok: true; order: Order } | { ok: false; reason: 'not-found' | 'conflict' } {
    const order = this.orders.get(id);
    if (!order) {
      return { ok: false, reason: 'not-found' };
    }
    if (idempotencyKey && this.appliedKeys.has(idempotencyKey)) {
      return { ok: true, order };
    }
    if (typeof fromVersion === 'number' && fromVersion < order.version) {
      return { ok: false, reason: 'conflict' };
    }
    if (idempotencyKey) {
      this.appliedKeys.add(idempotencyKey);
    }
    return { ok: true, order: this.bump(order, { status: 'cancelled' }) };
  }

  /** Socket-driven natural progression of a random in-flight order. */
  progressRandomOrder(pick: number): Order | null {
    const active = this.listOrders().filter((o) => nextStatus(o.status) !== null);
    if (!active.length) {
      return null;
    }
    const order = active[pick % active.length]!;
    const to = nextStatus(order.status);
    if (!to) {
      return null;
    }
    return this.bump(order, { status: to });
  }
}

export const mockDb = new MockDb();
