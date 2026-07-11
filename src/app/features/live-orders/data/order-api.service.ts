import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '../../../core/api-routes';
import { Order, OrderStatus } from '../../../core/models/order.model';

interface OrdersResponse {
  readonly orders: Order[];
}

/**
 * OrderApiService (Layer 1, §5). Thin, typed REST client for orders — no view
 * state, just Observables. The offline-sync path replays the same endpoints via
 * OfflineQueueService, so idempotency keys are threaded through here too.
 */
@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly http = inject(HttpClient);

  getOrders(): Observable<Order[]> {
    return this.http.get<OrdersResponse>(API.orders()).pipe(map((r) => r.orders));
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`${API.orders()}/${id}`);
  }

  advanceStatus(
    id: string,
    toStatus: OrderStatus,
    fromVersion: number,
    idempotencyKey: string,
  ): Observable<Order> {
    return this.http.post<Order>(
      API.orderStatus(id),
      { status: toStatus, fromVersion },
      { headers: this.idempotent(idempotencyKey) },
    );
  }

  cancelOrder(id: string, fromVersion: number, idempotencyKey: string): Observable<Order> {
    return this.http.post<Order>(
      API.orderCancel(id),
      { fromVersion },
      { headers: this.idempotent(idempotencyKey) },
    );
  }

  private idempotent(key: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': key });
  }
}
