/**
 * AI assistant domain types (§4 / §7.2).
 */

export type AiSuggestionType =
  | 'upsell'
  | 'allergy_warning'
  | 'missing_info'
  | 'delivery_risk'
  | 'kitchen_overload';

/**
 * Per-suggestion state machine: `idle → loading → streaming → success`, or
 * `→ error → (retry) → loading …`.
 */
export type AiRequestStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error';

export interface AiSuggestion {
  readonly id: string;
  readonly orderId: string;
  readonly type: AiSuggestionType;
  readonly status: AiRequestStatus;
  /** Accumulates during streaming. */
  readonly content: string;
  readonly retryCount: number;
  readonly error?: string;
  /** ISO timestamp of the last status transition (for UI ordering/debug). */
  readonly updatedAt: string;
}

/** A partial streamed chunk emitted by the AI simulation. */
export interface AiStreamChunk {
  readonly type: 'chunk';
  readonly delta: string;
}

export interface AiStreamDone {
  readonly type: 'done';
}

export type AiStreamEvent = AiStreamChunk | AiStreamDone;

export const AI_SUGGESTION_LABELS: Record<AiSuggestionType, string> = {
  upsell: 'Upsell opportunity',
  allergy_warning: 'Allergy warning',
  missing_info: 'Missing information',
  delivery_risk: 'Delivery risk',
  kitchen_overload: 'Kitchen overload',
};
