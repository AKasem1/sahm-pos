import { KitchenLoad, KitchenLoadLevel } from '../../app/core/models/kitchen.model';

/** Kitchen-load presets keyed by level (§9.4). */
export const KITCHEN_PRESETS: Record<KitchenLoadLevel, Omit<KitchenLoad, 'updatedAt'>> = {
  low: { level: 'low', activeOrders: 6, avgPrepMinutes: 8, capacityPct: 30 },
  medium: { level: 'medium', activeOrders: 14, avgPrepMinutes: 12, capacityPct: 55 },
  high: { level: 'high', activeOrders: 22, avgPrepMinutes: 18, capacityPct: 82 },
  critical: { level: 'critical', activeOrders: 30, avgPrepMinutes: 26, capacityPct: 97 },
};

export function makeKitchenLoad(level: KitchenLoadLevel, at: string): KitchenLoad {
  return { ...KITCHEN_PRESETS[level], updatedAt: at };
}

export function initialKitchenLoad(): KitchenLoad {
  return makeKitchenLoad('medium', new Date().toISOString());
}
