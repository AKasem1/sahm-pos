import {
  Order,
  OrderChannel,
  OrderItem,
  OrderStatus,
} from '../../app/core/models/order.model';

/**
 * Deterministic order seed generator (§9.4): ~60 orders spread across channels
 * and statuses, with a mix of delivery risk and ages so the board, priority
 * derivation and delay indicators all have something to show on first paint.
 */

const CHANNELS: readonly OrderChannel[] = ['walk-in', 'delivery', 'online'];
const STATUSES: readonly OrderStatus[] = [
  'received',
  'preparing',
  'ready',
  'delivered',
  'completed',
];

const ITEM_POOL: ReadonlyArray<Omit<OrderItem, 'id' | 'quantity'>> = [
  { name: 'Classic Cheeseburger', unitPrice: 8.5, allergens: ['gluten', 'dairy'] },
  { name: 'Pepperoni Pizza', unitPrice: 13.5, allergens: ['gluten', 'dairy'] },
  { name: 'French Fries', unitPrice: 3.5 },
  { name: 'Cola', unitPrice: 2.5 },
  { name: 'Caesar Salad', unitPrice: 7.5, allergens: ['dairy', 'gluten', 'fish'] },
  { name: 'Chocolate Brownie', unitPrice: 5.0, allergens: ['gluten', 'dairy', 'nuts'] },
  { name: 'Iced Latte', unitPrice: 4.0, allergens: ['dairy'] },
  { name: 'Veggie Burger', unitPrice: 9.0, allergens: ['gluten', 'soy'] },
];

const NAMES = [
  'Sara',
  'Omar',
  'Lina',
  'Khaled',
  'Maya',
  'Yousef',
  'Nadia',
  'Tariq',
  'Hana',
  'Ziad',
];

function buildItems(seed: number): OrderItem[] {
  const count = (seed % 3) + 1;
  const items: OrderItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = ITEM_POOL[(seed + i * 3) % ITEM_POOL.length]!;
    items.push({
      id: `oi_${seed}_${i}`,
      quantity: ((seed + i) % 3) + 1,
      ...base,
    });
  }
  return items;
}

function orderTotal(items: OrderItem[]): number {
  return Math.round(items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0) * 100) / 100;
}

export function buildSeedOrders(count = 60, base = Date.now()): Order[] {
  const orders: Order[] = [];
  for (let i = 0; i < count; i += 1) {
    const channel = CHANNELS[i % CHANNELS.length]!;
    const status = STATUSES[i % STATUSES.length]!;
    const items = buildItems(i + 1);
    const ageMinutes = (i * 7) % 40; // 0..39 minutes old
    const createdAt = new Date(base - ageMinutes * 60_000).toISOString();
    const isDelivery = channel === 'delivery';
    const riskRoll = i % 5;

    const order: Order = {
      id: `o_${1000 + i}`,
      reference: `#A-${1000 + i}`,
      channel,
      status,
      priority: 'normal', // recomputed by the store against live kitchen load
      items,
      total: orderTotal(items),
      customer: { name: NAMES[i % NAMES.length]!, phone: `+9715${(1000000 + i).toString()}` },
      createdAt,
      updatedAt: createdAt,
      version: 1,
      ...(isDelivery
        ? {
            delivery: {
              address: `${100 + i} Palm Street`,
              etaMinutes: 15 + (i % 20),
              risk: riskRoll === 0 ? 'high' : riskRoll === 1 ? 'low' : 'none',
            },
          }
        : {}),
    };
    orders.push(order);
  }
  return orders;
}
