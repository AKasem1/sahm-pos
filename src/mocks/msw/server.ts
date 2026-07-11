import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW server for Vitest integration tests (§9.1, §12). */
export const server = setupServer(...handlers);
