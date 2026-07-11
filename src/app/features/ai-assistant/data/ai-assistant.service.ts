import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AiStreamEvent, AiSuggestionType } from '../../../core/models/ai.model';
import { Order } from '../../../core/models/order.model';
import { MOCK_CONFIG } from '../../../core/tokens/mock-config.token';

/**
 * AiAssistantService (Layer 1, §9.3) — the AI simulation.
 *
 * `stream()` returns a cold Observable that, per subscription, either:
 *   - waits a random first-chunk delay, then emits partial `chunk` deltas at
 *     jittered intervals, then completes with `done`;  OR
 *   - errors immediately (probability `aiErrorRate`) to exercise retry/backoff.
 * A hard `timeout(aiTimeoutMs)` guards a hung request.
 *
 * Retry + accumulation live in the store; this service only models one attempt.
 * Content is derived from the order so suggestions feel grounded (upsell reads
 * the items, allergy_warning scans allergens, etc.).
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly config = inject(MOCK_CONFIG);

  stream(order: Order, type: AiSuggestionType): Observable<AiStreamEvent> {
    return new Observable<AiStreamEvent>((subscriber) => {
      const timers: ReturnType<typeof setTimeout>[] = [];

      // Fail-fast branch to exercise the error → retry path.
      if (Math.random() < this.config.aiErrorRate) {
        const t = setTimeout(
          () => subscriber.error(new Error('AI service unavailable')),
          this.randBetween(this.config.aiFirstChunkMinMs, this.config.aiFirstChunkMaxMs),
        );
        timers.push(t);
        return () => timers.forEach(clearTimeout);
      }

      const tokens = this.buildContent(order, type).match(/\S+\s*/g) ?? [];
      let index = 0;

      const scheduleNext = (delay: number): void => {
        const t = setTimeout(() => {
          if (index >= tokens.length) {
            subscriber.next({ type: 'done' });
            subscriber.complete();
            return;
          }
          subscriber.next({ type: 'chunk', delta: tokens[index]! });
          index += 1;
          scheduleNext(this.randBetween(this.config.aiChunkMinMs, this.config.aiChunkMaxMs));
        }, delay);
        timers.push(t);
      };

      scheduleNext(this.randBetween(this.config.aiFirstChunkMinMs, this.config.aiFirstChunkMaxMs));

      // Teardown: cancel every pending timer on unsubscribe (no ghost updates).
      return () => timers.forEach(clearTimeout);
    }).pipe(timeout({ first: this.config.aiTimeoutMs }));
  }

  private randBetween(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min));
  }

  private buildContent(order: Order, type: AiSuggestionType): string {
    switch (type) {
      case 'upsell': {
        const hasDrink = order.items.some((i) => /cola|juice|latte|water/i.test(i.name));
        const hasSide = order.items.some((i) => /fries|rings|bread|sticks/i.test(i.name));
        const adds: string[] = [];
        if (!hasSide) adds.push('a side of French Fries');
        if (!hasDrink) adds.push('a chilled drink');
        adds.push('a dessert to finish');
        return `Suggest adding ${adds.join(', ')}. Bundling these typically lifts ticket size by 12–18% for ${order.channel} orders.`;
      }
      case 'allergy_warning': {
        const allergens = [...new Set(order.items.flatMap((i) => i.allergens ?? []))];
        return allergens.length
          ? `Heads up: this order contains ${allergens.join(', ')}. Confirm with the customer before preparing.`
          : `No declared allergens detected in the current items.`;
      }
      case 'missing_info': {
        const missing: string[] = [];
        if (order.channel === 'delivery' && !order.delivery?.address) missing.push('delivery address');
        if (!order.customer?.phone) missing.push('contact phone');
        return missing.length
          ? `This order is missing ${missing.join(' and ')}. Collect it to avoid delays.`
          : `All required customer information is present.`;
      }
      case 'delivery_risk': {
        return order.delivery?.risk === 'high'
          ? `Delivery is at high risk (ETA ${order.delivery.etaMinutes ?? '?'}m under current load). Consider prioritising the kitchen ticket or notifying the customer.`
          : `Delivery risk is within normal range.`;
      }
      case 'kitchen_overload': {
        return `Kitchen is under pressure. Recommend pacing new tickets and flagging urgent orders first to keep prep times under control.`;
      }
    }
  }
}
