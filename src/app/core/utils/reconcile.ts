import { Order } from '../models/order.model';

/**
 * Reconciliation rule (§7.1 / §8): an incoming update wins only if it is
 * strictly newer than what we already hold. "Newer" is decided by `version`
 * first (monotonic, authoritative), falling back to `updatedAt` when versions
 * tie. Stale events are dropped — this is what prevents socket/polling races
 * from flickering the board or regressing an optimistic change.
 */
export function isNewer(
  incoming: Pick<Order, 'version' | 'updatedAt'>,
  current: Pick<Order, 'version' | 'updatedAt'> | undefined,
): boolean {
  if (!current) {
    return true;
  }
  if (incoming.version !== current.version) {
    return incoming.version > current.version;
  }
  return new Date(incoming.updatedAt).getTime() > new Date(current.updatedAt).getTime();
}

/**
 * Merge an incoming order into the current one, keeping the newer of the two.
 * Returns the reference unchanged when the incoming update is stale, so change
 * detection / selectors don't needlessly recompute.
 */
export function reconcileOrder(current: Order | undefined, incoming: Order): Order {
  if (!current) {
    return incoming;
  }
  return isNewer(incoming, current) ? incoming : current;
}
