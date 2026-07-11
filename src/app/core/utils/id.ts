/**
 * Client-side id helpers.
 *
 * `idempotencyKey()` is the anchor for offline replay-safety (§7.5): the same
 * key must survive a page reload and dedupe identical queued actions, so it is
 * generated once at action-creation time and persisted with the action.
 */

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old runtimes / test shims.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function idempotencyKey(): string {
  return `idem_${randomId()}`;
}

export function suggestionId(): string {
  return `sg_${randomId()}`;
}

/**
 * Deterministic dedupe key for a queued action: two actions that target the same
 * effect (e.g. advance the same order to the same status) collapse to one.
 */
export function actionDedupeKey(type: string, payload: Record<string, unknown>): string {
  const orderId = String(payload['orderId'] ?? '');
  const extra = String(payload['toStatus'] ?? payload['suggestionId'] ?? '');
  return `${type}:${orderId}:${extra}`;
}
