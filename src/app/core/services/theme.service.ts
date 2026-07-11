import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePref = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'sahm.theme.v1';

/**
 * ThemeService — light/dark theming with a system-following default.
 *
 * The preference (`light | dark | system`) is a signal persisted to
 * localStorage. An effect stamps `data-theme` on `<html>` so the CSS token
 * overrides in `styles.css` take effect instantly. When the preference is
 * `system` we remove the attribute and let `prefers-color-scheme` decide, while
 * still tracking the OS value via `matchMedia` so the toggle shows the right icon.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly media = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  readonly pref = signal<ThemePref>(this.readStored());
  private readonly systemDark = signal<boolean>(this.media?.matches ?? false);

  /** The theme actually applied, after resolving `system`. */
  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this.pref();
    if (pref === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return pref;
  });

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const pref = this.pref();
      const root = this.doc.documentElement;
      if (pref === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', pref);
      }
      try {
        localStorage.setItem(STORAGE_KEY, pref);
      } catch {
        /* private mode — ignore */
      }
    });
  }

  /** Cycle light → dark → system for the toggle button. */
  cycle(): void {
    this.pref.update((p) => (p === 'light' ? 'dark' : p === 'dark' ? 'system' : 'light'));
  }

  set(pref: ThemePref): void {
    this.pref.set(pref);
  }

  private readStored(): ThemePref {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        return raw;
      }
    } catch {
      /* ignore */
    }
    return 'system';
  }
}
