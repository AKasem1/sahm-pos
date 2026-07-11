import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../../../core/api-routes';
import { KitchenLoad } from '../../../core/models/kitchen.model';

/** Typed REST client for kitchen load (Layer 1). */
@Injectable({ providedIn: 'root' })
export class KitchenLoadService {
  private readonly http = inject(HttpClient);

  getLoad(): Observable<KitchenLoad> {
    return this.http.get<KitchenLoad>(API.kitchenLoad());
  }
}
