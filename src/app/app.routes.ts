import { Routes } from '@angular/router';

/**
 * Top-level lazy routes (§6). Each feature is code-split behind a lazy
 * `loadChildren`, demonstrating the "hundreds of screens" additive story (§11):
 * new features are new lazy chunks, not edits to a central module.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'orders' },
  {
    path: 'orders',
    title: 'Live Orders · Sahm',
    loadChildren: () => import('./features/live-orders/live-orders.routes'),
  },
  {
    path: 'search',
    title: 'Product Search · Sahm',
    loadChildren: () => import('./features/product-search/product-search.routes'),
  },
  {
    path: 'sync',
    title: 'Offline Sync · Sahm',
    loadChildren: () => import('./features/offline-sync/offline-sync.routes'),
  },
  { path: '**', redirectTo: 'orders' },
];
