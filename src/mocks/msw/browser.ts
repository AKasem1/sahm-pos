import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** MSW browser worker used at app bootstrap (§9.1). */
export const worker = setupWorker(...handlers);

/**
 * Starts MSW. `onUnhandledRequest: 'bypass'` lets real asset/HMR requests pass
 * through untouched. Returns a promise the bootstrap awaits before rendering so
 * the very first `GET /api/orders` is guaranteed to be intercepted.
 */
export function startMockWorker(): Promise<unknown> {
  return worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}
