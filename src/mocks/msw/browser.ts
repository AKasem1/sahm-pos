import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** MSW browser worker used at app bootstrap (§9.1). */
export const worker = setupWorker(...handlers);

/**
 * Starts MSW. `onUnhandledRequest: 'warn'` lets real asset/HMR requests pass
 * through but logs a console warning for any `/api/*` call that slips past the
 * mock (e.g. a stale service worker), which would otherwise fail with a JSON
 * parse error on the dev server's `index.html` (the misleading "HTTP 200").
 * Returns a promise the bootstrap awaits before rendering so the very first
 * `GET /api/orders` is guaranteed to be intercepted.
 */
export function startMockWorker(): Promise<unknown> {
  return worker.start({
    onUnhandledRequest(request, print) {
      // Only shout about our own API — asset/HMR requests are expected to bypass.
      if (new URL(request.url).pathname.startsWith('/api/')) {
        print.warning();
      }
    },
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}
