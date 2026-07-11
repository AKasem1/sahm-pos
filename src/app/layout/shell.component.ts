import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConnectionIndicatorComponent } from './connection-indicator.component';
import { ThemeToggleComponent } from './theme-toggle.component';
import { OfflineBannerComponent } from '../features/offline-sync/ui/offline-banner.component';

interface NavItem {
  readonly path: string;
  readonly label: string;
}

/**
 * Application shell (§6 layout). Sticky, blurred top bar + primary navigation +
 * theme toggle + live connection indicator + a persistent offline banner + the
 * routed outlet. Presentational; all live state lives in stores / core services.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ConnectionIndicatorComponent,
    ThemeToggleComponent,
    OfflineBannerComponent,
  ],
  template: `
    <div class="flex min-h-screen flex-col">
      <header
        class="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl backdrop-saturate-150"
      >
        <!-- Top row: brand + status + theme (compact on all widths) -->
        <div class="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <a routerLink="/orders" class="flex items-center gap-2.5">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand to-brand-hover text-sm font-bold text-white shadow-sm ring-1 ring-white/10"
              >S</span
            >
            <span class="flex flex-col leading-none">
              <span class="text-sm font-semibold tracking-tight text-ink">Sahm</span>
              <span class="hidden text-[11px] font-medium text-faint sm:block">
                Smart Order Workspace
              </span>
            </span>
          </a>

          <!-- Desktop nav: inline in the top row -->
          <nav
            class="ml-1 hidden items-center gap-0.5 rounded-xl bg-surface-2/70 p-1 ring-1 ring-inset ring-line/70 md:flex"
            aria-label="Primary"
          >
            @for (item of nav; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-surface !text-ink shadow-[var(--shadow-card)] ring-1 ring-line"
                #rla="routerLinkActive"
                [attr.aria-current]="rla.isActive ? 'page' : null"
                class="rounded-lg px-3 py-1.5 text-sm font-medium text-muted ring-1 ring-transparent transition-all hover:text-ink"
              >
                {{ item.label }}
              </a>
            }
          </nav>

          <div class="ml-auto flex items-center gap-2">
            <app-connection-indicator />
            <app-theme-toggle />
          </div>
        </div>

        <!-- Mobile nav: full-width segmented row below the top row -->
        <nav
          class="flex items-center gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden"
          aria-label="Primary"
        >
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="!bg-surface !text-ink shadow-[var(--shadow-card)] ring-line"
              #rlaM="routerLinkActive"
              [attr.aria-current]="rlaM.isActive ? 'page' : null"
              class="flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-medium text-muted ring-1 ring-inset ring-transparent transition-all hover:text-ink"
            >
              {{ item.label }}
            </a>
          }
        </nav>
      </header>

      <app-offline-banner />

      <main class="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent {
  readonly nav: readonly NavItem[] = [
    { path: '/orders', label: 'Live Orders' },
    { path: '/search', label: 'Product Search' },
    { path: '/sync', label: 'Offline Sync' },
  ];
}
