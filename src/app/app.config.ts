import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { httpErrorRetryInterceptor } from './core/interceptors/http-error-retry.interceptor';
import { MOCK_CONFIG, defaultMockConfig } from './core/tokens/mock-config.token';
import { CLOCK, systemClock } from './core/tokens/clock.token';

/**
 * Root application providers.
 *
 * Zoneless change detection (§3, §13-Q3): we run with no Zone.js. Combined with
 * OnPush + signals this makes render cost proportional to what changed, which is
 * the whole point of the "efficient change detection" success criterion.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([httpErrorRetryInterceptor])),

    // Mock-backend configuration (latency + error injection) is provided via a
    // token so the demo/tests can flip failure modes without touching handlers.
    { provide: MOCK_CONFIG, useValue: defaultMockConfig },
    // Injectable clock keeps age/priority derivation deterministic under test.
    { provide: CLOCK, useValue: systemClock },
  ],
};
