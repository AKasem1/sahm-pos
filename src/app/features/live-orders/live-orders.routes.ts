import { Routes } from '@angular/router';
import { OrdersBoardComponent } from './ui/orders-board.component';

/** Lazy-loaded route for the Live Orders workspace (§6). */
export const LIVE_ORDERS_ROUTES: Routes = [{ path: '', component: OrdersBoardComponent }];

export default LIVE_ORDERS_ROUTES;
