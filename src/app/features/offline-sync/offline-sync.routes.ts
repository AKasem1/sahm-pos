import { Routes } from '@angular/router';
import { SyncPageComponent } from './ui/sync-page.component';

/** Lazy-loaded route for Offline Sync (§6). */
export const OFFLINE_SYNC_ROUTES: Routes = [{ path: '', component: SyncPageComponent }];

export default OFFLINE_SYNC_ROUTES;
