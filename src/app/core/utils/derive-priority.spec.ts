import { describe, expect, it } from 'vitest';
import { KitchenLoad } from '../models/kitchen.model';
import { Order } from '../models/order.model';
import { derivePriority, isDelayed } from './derive-priority';

function makeOrder(overrides: Partial<Order> = {}): Order {
  const now = new Date('2026-07-10T12:00:00Z');
  return {
    id: 'o1',
    reference: '#A-1',
    channel: 'delivery',
    status: 'preparing',
    priority: 'normal',
    items: [],
    total: 10,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 1,
    ...overrides,
  };
}

function makeLoad(overrides: Partial<KitchenLoad> = {}): KitchenLoad {
  return {
    level: 'medium',
    activeOrders: 10,
    avgPrepMinutes: 12,
    capacityPct: 50,
    updatedAt: '2026-07-10T12:00:00Z',
    ...overrides,
  };
}

describe('derivePriority', () => {
  const now = new Date('2026-07-10T12:20:00Z'); // 20 minutes after createdAt

  it('is urgent when kitchen is critical and order aged past 10m', () => {
    const order = makeOrder({ createdAt: '2026-07-10T12:00:00Z' });
    expect(derivePriority(order, makeLoad({ level: 'critical' }), now)).toBe('urgent');
  });

  it('is urgent when kitchen is critical and delivery is at high risk (even if young)', () => {
    const order = makeOrder({
      createdAt: '2026-07-10T12:19:00Z', // 1 minute old
      delivery: { risk: 'high' },
    });
    expect(derivePriority(order, makeLoad({ level: 'critical' }), now)).toBe('urgent');
  });

  it('is high when kitchen is high and order aged past 15m', () => {
    const order = makeOrder({ createdAt: '2026-07-10T12:00:00Z' });
    expect(derivePriority(order, makeLoad({ level: 'high' }), now)).toBe('high');
  });

  it('is high when delivery is at high risk under normal load', () => {
    const order = makeOrder({ delivery: { risk: 'high' } });
    expect(derivePriority(order, makeLoad({ level: 'low' }), now)).toBe('high');
  });

  it('is normal otherwise', () => {
    const order = makeOrder({ createdAt: '2026-07-10T12:18:00Z' });
    expect(derivePriority(order, makeLoad({ level: 'medium' }), now)).toBe('normal');
  });
});

describe('isDelayed', () => {
  const now = new Date('2026-07-10T12:20:00Z');

  it('flags active orders older than avg prep under pressure', () => {
    const order = makeOrder({ status: 'preparing', createdAt: '2026-07-10T12:00:00Z' });
    expect(isDelayed(order, makeLoad({ level: 'high', avgPrepMinutes: 15 }), now)).toBe(true);
  });

  it('does not flag terminal/delivered orders', () => {
    const order = makeOrder({ status: 'completed', createdAt: '2026-07-10T11:00:00Z' });
    expect(isDelayed(order, makeLoad({ level: 'critical', avgPrepMinutes: 5 }), now)).toBe(false);
  });

  it('does not flag when kitchen is not under pressure', () => {
    const order = makeOrder({ status: 'preparing', createdAt: '2026-07-10T12:00:00Z' });
    expect(isDelayed(order, makeLoad({ level: 'low', avgPrepMinutes: 5 }), now)).toBe(false);
  });
});
