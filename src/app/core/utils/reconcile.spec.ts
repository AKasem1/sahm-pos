import { describe, expect, it } from 'vitest';
import { Order } from '../models/order.model';
import { isNewer, reconcileOrder } from './reconcile';

function order(version: number, updatedAt: string): Order {
  return {
    id: 'o1',
    reference: '#A-1',
    channel: 'walk-in',
    status: 'received',
    priority: 'normal',
    items: [],
    total: 0,
    createdAt: '2026-07-10T12:00:00Z',
    updatedAt,
    version,
  };
}

describe('isNewer', () => {
  it('treats anything as newer than undefined', () => {
    expect(isNewer(order(1, 'x'), undefined)).toBe(true);
  });

  it('prefers the higher version', () => {
    expect(isNewer(order(2, 'a'), order(1, 'z'))).toBe(true);
    expect(isNewer(order(1, 'z'), order(2, 'a'))).toBe(false);
  });

  it('falls back to updatedAt when versions tie', () => {
    const older = order(1, '2026-07-10T12:00:00Z');
    const newer = order(1, '2026-07-10T12:05:00Z');
    expect(isNewer(newer, older)).toBe(true);
    expect(isNewer(older, newer)).toBe(false);
  });
});

describe('reconcileOrder', () => {
  it('drops a stale incoming update (keeps current reference)', () => {
    const current = order(3, '2026-07-10T12:10:00Z');
    const stale = order(2, '2026-07-10T12:05:00Z');
    expect(reconcileOrder(current, stale)).toBe(current);
  });

  it('accepts a newer incoming update', () => {
    const current = order(2, '2026-07-10T12:05:00Z');
    const fresh = order(3, '2026-07-10T12:10:00Z');
    expect(reconcileOrder(current, fresh)).toBe(fresh);
  });
});
