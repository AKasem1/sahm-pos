import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../../../core/api-routes';
import { Product, ProductCategory } from '../../../core/models/product.model';

export interface ProductSearchResult {
  readonly total: number;
  readonly products: Product[];
}

/** Typed REST client for the product catalog (Layer 1, §7.4). */
@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private readonly http = inject(HttpClient);

  search(query: string, category: ProductCategory | null, limit = 200): Observable<ProductSearchResult> {
    let params = new HttpParams().set('limit', String(limit));
    if (query) {
      params = params.set('q', query);
    }
    if (category) {
      params = params.set('category', category);
    }
    return this.http.get<ProductSearchResult>(API.products(), { params });
  }
}
