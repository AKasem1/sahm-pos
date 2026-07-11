import { HttpResponse, delay, http } from 'msw';
import { AiSuggestionType } from '../../app/core/models/ai.model';
import { OrderStatus } from '../../app/core/models/order.model';
import { Product } from '../../app/core/models/product.model';
import { MockConfig, defaultMockConfig } from '../../app/core/tokens/mock-config.token';
import { getProductCatalog } from '../data/products';
import { mockDb } from './db';

/**
 * MSW REST handlers (§9.1). Latency + error injection are read from a mutable
 * module-level config (seeded from `defaultMockConfig`) so the demo/tests can
 * flip failure modes on the fly via `setMockConfig`.
 */
let config: MockConfig = defaultMockConfig;

export function setMockConfig(patch: Partial<MockConfig>): void {
  config = { ...config, ...patch };
}

export function resetMockConfig(): void {
  config = defaultMockConfig;
}

async function applyLatency(): Promise<void> {
  const jitter = Math.random() * config.restJitterMs;
  await delay(config.restLatencyMs + jitter);
}

function maybeInjectError(): boolean {
  return Math.random() < config.restErrorRate;
}

function idempotencyKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key');
}

export const handlers = [
  // ---- Orders -----------------------------------------------------------
  http.get('/api/orders', async () => {
    await applyLatency();
    return HttpResponse.json({ orders: mockDb.listOrders() });
  }),

  http.get('/api/orders/:id', async ({ params }) => {
    await applyLatency();
    const order = mockDb.getOrder(String(params['id']));
    return order
      ? HttpResponse.json(order)
      : HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  http.post('/api/orders/:id/status', async ({ params, request }) => {
    await applyLatency();
    if (maybeInjectError()) {
      return HttpResponse.json({ message: 'Injected failure' }, { status: 500 });
    }
    const body = (await request.json()) as { status: OrderStatus; fromVersion?: number };
    const result = mockDb.advanceStatus(
      String(params['id']),
      body.status,
      body.fromVersion,
      idempotencyKey(request),
    );
    if (result.ok) {
      return HttpResponse.json(result.order);
    }
    const status = result.reason === 'not-found' ? 404 : result.reason === 'conflict' ? 409 : 422;
    return HttpResponse.json({ message: result.reason }, { status });
  }),

  http.post('/api/orders/:id/cancel', async ({ params, request }) => {
    await applyLatency();
    if (maybeInjectError()) {
      return HttpResponse.json({ message: 'Injected failure' }, { status: 500 });
    }
    const body = (await request.json().catch(() => ({}))) as { fromVersion?: number };
    const result = mockDb.cancelOrder(
      String(params['id']),
      body.fromVersion,
      idempotencyKey(request),
    );
    if (result.ok) {
      return HttpResponse.json(result.order);
    }
    const status = result.reason === 'not-found' ? 404 : 409;
    return HttpResponse.json({ message: result.reason }, { status });
  }),

  // ---- Products ---------------------------------------------------------
  http.get('/api/products', async ({ request }) => {
    await applyLatency();
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const category = url.searchParams.get('category');
    const limit = Number(url.searchParams.get('limit') ?? '50');

    let results: Product[] = getProductCatalog();
    if (category) {
      results = results.filter((p) => p.category === category);
    }
    if (q) {
      results = results.filter((p) => p.searchTokens.includes(q));
    }
    return HttpResponse.json({ total: results.length, products: results.slice(0, limit) });
  }),

  // ---- Kitchen ----------------------------------------------------------
  http.get('/api/kitchen/load', async () => {
    await applyLatency();
    return HttpResponse.json(mockDb.getKitchen());
  }),

  // ---- AI (single-shot; the app uses client-side streaming, see §9.3) ---
  http.post('/api/ai/suggest', async ({ request }) => {
    await applyLatency();
    if (Math.random() < config.aiErrorRate) {
      return HttpResponse.json({ message: 'AI upstream error' }, { status: 503 });
    }
    const body = (await request.json()) as { orderId: string; type: AiSuggestionType };
    return HttpResponse.json({
      orderId: body.orderId,
      type: body.type,
      content: `Suggestion (${body.type}) for order ${body.orderId}.`,
    });
  }),
];
