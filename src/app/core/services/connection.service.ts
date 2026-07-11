import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, fromEvent, map, merge, startWith } from 'rxjs';
import { ConnectionStatus } from '../models/realtime.model';

/**
 * ConnectionService (Layer 1, §5).
 *
 * Single source of truth for browser connectivity. Combines `navigator.onLine`
 * with the `online`/`offline` window events and exposes both a signal (for the
 * view / OnPush templates) and an Observable (for store effects that need to
 * react to reconnection, e.g. offline-queue replay).
 *
 * `reconnecting` is a transient state the RealtimeService can drive during its
 * simulated socket recovery; it's surfaced here so the whole app shares one
 * connection status.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly browserOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  private readonly socketReconnecting = signal<boolean>(false);

  /** Derived, app-wide connection status. */
  readonly status = computed<ConnectionStatus>(() => {
    if (!this.browserOnline()) {
      return 'offline';
    }
    return this.socketReconnecting() ? 'reconnecting' : 'online';
  });

  readonly isOnline = computed(() => this.browserOnline());

  /** Observable form of online-ness for RxJS store effects. */
  readonly online$: Observable<boolean>;

  constructor() {
    const online$ =
      typeof window !== 'undefined'
        ? merge(
            fromEvent(window, 'online').pipe(map(() => true)),
            fromEvent(window, 'offline').pipe(map(() => false)),
          ).pipe(startWith(this.browserOnline()))
        : new Observable<boolean>((sub) => sub.next(true));

    this.online$ = online$;

    online$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((online) => {
      this.browserOnline.set(online);
    });
  }

  /** Called by RealtimeService while it attempts a simulated reconnect. */
  setReconnecting(value: boolean): void {
    this.socketReconnecting.set(value);
  }

  /** Test/demo hook to force the browser-online signal. */
  setBrowserOnline(value: boolean): void {
    this.browserOnline.set(value);
  }
}
