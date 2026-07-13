import { HttpErrorResponse } from '@angular/common/http';

/**
 * Human-readable message for any thrown value on an HTTP path.
 *
 * The important subtlety: Angular reuses `HttpErrorResponse` for *client-side*
 * failures too. A JSON parse error on an otherwise-OK response surfaces as an
 * `HttpErrorResponse` whose `.status` is the real transport status (often `200`)
 * — so blindly printing `HTTP ${status}` yields the misleading "HTTP 200". We
 * treat status `0` and any `2xx` as a transport/parse failure, not a server
 * error, and only format genuine 4xx/5xx as `HTTP <status>`.
 */
export function describeHttpError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0 || (err.status >= 200 && err.status < 300)) {
      return 'Network error — please retry';
    }
    return `HTTP ${err.status}`;
  }
  if (typeof err === 'object' && err && 'status' in err) {
    const status = (err as { status: number }).status;
    if (status === 0 || (status >= 200 && status < 300)) {
      return 'Network error — please retry';
    }
    return `HTTP ${status}`;
  }
  return err instanceof Error ? err.message : 'Request failed';
}
