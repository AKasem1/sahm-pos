import { MonoTypeOperatorFunction, Observable, throwError, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import { RetryPolicy } from '../tokens/mock-config.token';
import { backoffDelay } from './backoff';

/**
 * RxJS retry operator using our exponential-backoff-with-jitter policy (§8).
 *
 * This is the single reusable retry primitive shared by the AI service and the
 * offline sync effect. `retryCount` is 0-based inside RxJS `retry`, so we pass
 * `retryCount + 1` to `backoffDelay` (which is 1-based). After `maxAttempts`
 * the error is re-thrown so the caller's `catchError` can surface an error state.
 */
export function retryWithBackoff<T>(
  policy: RetryPolicy,
  rand: () => number = Math.random,
  onRetry?: (attempt: number, error: unknown) => void,
): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) =>
    source.pipe(
      retry({
        count: policy.maxAttempts,
        delay: (error, retryCount) => {
          if (retryCount > policy.maxAttempts) {
            return throwError(() => error);
          }
          onRetry?.(retryCount, error);
          return timer(backoffDelay(retryCount, policy, rand));
        },
      }),
    );
}
