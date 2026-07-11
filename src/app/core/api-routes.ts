/**
 * Central REST route builders for the mock backend (§9.1).
 *
 * Kept in `core` so both the feature-level `OrderApiService` and the core
 * `OfflineQueueService` (which replays queued mutations directly) speak to the
 * exact same endpoints without a feature→core boundary violation.
 */
export const API = {
  base: '/api',
  orders: () => `/api/orders`,
  orderStatus: (id: string) => `/api/orders/${id}/status`,
  orderCancel: (id: string) => `/api/orders/${id}/cancel`,
  products: () => `/api/products`,
  kitchenLoad: () => `/api/kitchen/load`,
  aiSuggest: () => `/api/ai/suggest`,
} as const;
