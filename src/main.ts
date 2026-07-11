import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Bootstrap. We start the MSW worker BEFORE bootstrapping Angular so the very
 * first `GET /api/orders` is guaranteed to be intercepted by the mock backend
 * (§9.1). MSW is loaded dynamically so it never ships in a production bundle.
 */
async function main(): Promise<void> {
  const { startMockWorker } = await import('./mocks/msw/browser');
  await startMockWorker();
  await bootstrapApplication(App, appConfig);
}

main().catch((err) => console.error(err));
