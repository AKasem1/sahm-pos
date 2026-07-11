import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import { MOCK_CONFIG } from '../tokens/mock-config.token';
import { backoffDelay } from '../utils/backoff';

/**
 * App-wide HTTP interceptor (§6 core/interceptors).
 *
 * Idempotent reads (GET) are transparently retried on transient 5xx/0 errors
 * with backoff. Mutations (POST) are NOT retried here — their retry/rollback is
 * owned by the offline-sync effect where idempotency keys make replay safe (§8).
 */
export const httpErrorRetryInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(MOCK_CONFIG);
  const isIdempotent = req.method === 'GET';

  const stream = next(req);
  if (!isIdempotent) {
    return stream.pipe(
      catchError((error: HttpErrorResponse) => throwError(() => normalize(error))),
    );
  }

  return stream.pipe(
    retry({
      count: 2,
      delay: (error: HttpErrorResponse, retryCount) => {
        if (!isTransient(error) || retryCount > 2) {
          return throwError(() => normalize(error));
        }
        return timer(backoffDelay(retryCount, config.retry));
      },
    }),
    catchError((error: HttpErrorResponse) => throwError(() => normalize(error))),
  );
};

function isTransient(error: HttpErrorResponse): boolean {
  return error.status === 0 || (error.status >= 500 && error.status < 600);
}

function normalize(error: HttpErrorResponse): HttpErrorResponse {
  return error;
}
