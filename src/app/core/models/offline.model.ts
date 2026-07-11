/**
 * Offline queue domain types (§4 / §7.5).
 */

export type QueuedActionType = 'ADVANCE_STATUS' | 'CANCEL_ORDER' | 'ACCEPT_SUGGESTION';

export interface AdvanceStatusPayload {
  readonly orderId: string;
  readonly toStatus: string;
  readonly fromVersion: number;
}

export interface CancelOrderPayload {
  readonly orderId: string;
  readonly fromVersion: number;
}

export interface AcceptSuggestionPayload {
  readonly orderId: string;
  readonly suggestionId: string;
}

export type QueuedActionPayload =
  | AdvanceStatusPayload
  | CancelOrderPayload
  | AcceptSuggestionPayload;

export type QueuedActionSyncState = 'pending' | 'syncing' | 'failed';

export interface QueuedAction {
  /** Client-generated idempotency key — the anchor for dedupe + replay-safety. */
  readonly id: string;
  readonly type: QueuedActionType;
  readonly payload: QueuedActionPayload;
  /** ISO timestamp. */
  readonly createdAt: string;
  readonly attempts: number;
  readonly syncState: QueuedActionSyncState;
  readonly lastError?: string;
}
