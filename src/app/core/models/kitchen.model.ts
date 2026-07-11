/**
 * Kitchen load domain types (§4 / §7.3).
 */

export type KitchenLoadLevel = 'low' | 'medium' | 'high' | 'critical';

export interface KitchenLoad {
  readonly level: KitchenLoadLevel;
  readonly activeOrders: number;
  readonly avgPrepMinutes: number;
  /** 0..100 */
  readonly capacityPct: number;
  /** ISO timestamp. */
  readonly updatedAt: string;
}

export const KITCHEN_LOAD_ORDER: Record<KitchenLoadLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
