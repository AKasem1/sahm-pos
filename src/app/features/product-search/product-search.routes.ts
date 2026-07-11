import { Routes } from '@angular/router';
import { SearchPageComponent } from './ui/search-page.component';

/** Lazy-loaded route for Advanced Product Search (§6). */
export const PRODUCT_SEARCH_ROUTES: Routes = [{ path: '', component: SearchPageComponent }];

export default PRODUCT_SEARCH_ROUTES;
