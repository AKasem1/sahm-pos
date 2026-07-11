import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ThemePref, ThemeService } from '../core/services/theme.service';

interface ThemeOption {
  readonly value: ThemePref;
  readonly icon: string;
  readonly label: string;
  readonly hint: string;
}

/**
 * Appearance menu (light / dark / system). A discoverable dropdown — rather than
 * a blind cycling button — so the user can see every option, read what each does,
 * and know which is active. Accessible: `menuitemradio` items with `aria-checked`,
 * Esc closes and restores focus, a backdrop handles click-outside.
 */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        #trigger
        type="button"
        (click)="toggle()"
        (keydown.escape)="close()"
        class="flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted ring-1 ring-inset ring-line transition-colors hover:bg-surface-2 hover:text-ink"
        [class.bg-surface-2]="open()"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        aria-label="Appearance"
        title="Appearance"
      >
        <span class="text-base leading-none" aria-hidden="true">{{ triggerIcon() }}</span>
        <span class="text-[10px] leading-none text-faint" aria-hidden="true">▾</span>
      </button>

      @if (open()) {
        <!-- click-outside backdrop -->
        <button
          type="button"
          class="fixed inset-0 z-40 cursor-default"
          tabindex="-1"
          aria-hidden="true"
          (click)="close()"
        ></button>

        <div
          class="absolute right-0 z-50 mt-2 w-60 animate-fade-in-up overflow-hidden rounded-xl border border-line bg-elevated p-1.5 shadow-[var(--shadow-pop)]"
          role="menu"
          aria-label="Appearance"
          (keydown.escape)="close()"
        >
          <p class="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Appearance
          </p>
          @for (opt of options; track opt.value) {
            <button
              type="button"
              role="menuitemradio"
              [attr.aria-checked]="theme.pref() === opt.value"
              (click)="choose(opt.value)"
              class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
              [class.bg-surface-2]="theme.pref() === opt.value"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-base ring-1 ring-inset ring-line"
                aria-hidden="true"
                >{{ opt.icon }}</span
              >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-ink">{{ opt.label }}</span>
                <span class="block text-xs text-faint">{{ hintFor(opt) }}</span>
              </span>
              @if (theme.pref() === opt.value) {
                <span class="text-sm text-brand-fg" aria-hidden="true">✓</span>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly open = signal(false);

  readonly options: readonly ThemeOption[] = [
    { value: 'light', icon: '☀️', label: 'Light', hint: 'Always light' },
    { value: 'dark', icon: '🌙', label: 'Dark', hint: 'Always dark' },
    { value: 'system', icon: '🖥️', label: 'System', hint: 'Match your device' },
  ];

  /** The trigger shows the icon of the *resolved* theme, not the preference,
   * so it always reflects what's actually on screen. */
  readonly triggerIcon = computed(() => (this.theme.resolved() === 'dark' ? '🌙' : '☀️'));

  hintFor(opt: ThemeOption): string {
    if (opt.value === 'system') {
      return `Match your device (now ${this.theme.resolved()})`;
    }
    return opt.hint;
  }

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    if (this.open()) {
      this.open.set(false);
      this.trigger().nativeElement.focus();
    }
  }

  choose(value: ThemePref): void {
    this.theme.set(value);
    this.close();
  }
}
