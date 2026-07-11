import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/operators';
import { Observable } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { KitchenLoad } from '../../../core/models/kitchen.model';
import { RealtimeEvent } from '../../../core/models/realtime.model';
import { RealtimeService } from '../../../core/services/realtime.service';
import { initialKitchenLoad } from '../../../../mocks/data/kitchen';
import { KitchenLoadService } from './kitchen-load.service';

const HISTORY_LIMIT = 20;

interface KitchenLoadState {
  readonly load: KitchenLoad;
  readonly history: KitchenLoad[];
  readonly loaded: boolean;
}

/**
 * KitchenLoadStore (Layer 2, §7.3). Holds the current load plus a short rolling
 * history for the trend sparkline. Fed by an initial REST read and then the fake
 * socket's kitchen events.
 */
@Injectable()
export class KitchenLoadStore extends ComponentStore<KitchenLoadState> {
  private readonly service = inject(KitchenLoadService);
  private readonly realtime = inject(RealtimeService);

  constructor() {
    super({ load: initialKitchenLoad(), history: [], loaded: false });
  }

  readonly load$ = this.select((s) => s.load);
  readonly history$ = this.select((s) => s.history);
  readonly level$ = this.select((s) => s.load.level);
  readonly capacity$ = this.select((s) => s.load.capacityPct);
  readonly loaded$ = this.select((s) => s.loaded);

  readonly capacityTrend$: Observable<number[]> = this.select(this.history$, (history) =>
    history.map((h) => h.capacityPct),
  );

  private readonly setLoad = this.updater<KitchenLoad>((state, load) => ({
    load,
    loaded: true,
    history: [...state.history, load].slice(-HISTORY_LIMIT),
  }));

  readonly loadInitial = this.effect<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() =>
        this.service.getLoad().pipe(
          tapResponse(
            (load) => this.setLoad(load),
            () => void 0,
          ),
        ),
      ),
    ),
  );

  readonly listenRealtime = this.effect<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() =>
        this.realtime.events$.pipe(
          filter((e: RealtimeEvent): e is Extract<RealtimeEvent, { kind: 'kitchen-load' }> =>
            e.kind === 'kitchen-load',
          ),
          map((e) => this.setLoad(e.load)),
        ),
      ),
    ),
  );

  init(): void {
    this.loadInitial();
    this.listenRealtime();
  }
}
