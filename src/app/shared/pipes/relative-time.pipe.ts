import { Pipe, PipeTransform, inject } from '@angular/core';
import { CLOCK } from '../../core/tokens/clock.token';
import { relativeTime } from '../../core/utils/format';

/**
 * Formats an ISO timestamp as compact relative time ("3m", "1h 12m").
 * Pure — recomputed only when its input changes; the board's frequent updates
 * keep it fresh without a per-second timer.
 */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  private readonly clock = inject(CLOCK);

  transform(iso: string | null | undefined): string {
    if (!iso) {
      return '';
    }
    return relativeTime(iso, this.clock.now());
  }
}
