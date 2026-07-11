/**
 * Small formatting helpers used across features.
 */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Compact relative time ("just now", "3m", "1h 12m") from an ISO string.
 * Kept pure + string-in/string-out for easy testing in the RelativeTimePipe.
 */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now.getTime() - then) / 1000));

  if (diffSec < 10) {
    return 'just now';
  }
  if (diffSec < 60) {
    return `${diffSec}s`;
  }
  const min = Math.floor(diffSec / 60);
  if (min < 60) {
    return `${min}m`;
  }
  const hours = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin ? `${hours}h ${remMin}m` : `${hours}h`;
}
