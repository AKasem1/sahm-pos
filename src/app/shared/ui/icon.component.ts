import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Icon names available across the app. Kept as a closed union so a typo is a
 * compile error and the whole icon set is discoverable in one place.
 */
export type IconName =
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'check'
  | 'search'
  | 'close'
  | 'clock'
  | 'warning'
  | 'sparkles'
  | 'utensils'
  | 'refresh'
  | 'inbox'
  | 'chevron-down';

/**
 * Presentational SVG icon (§10, shared/ui). Inline, currentColor-driven strokes
 * so icons inherit text color and scale crisply — no emoji, no icon font, no
 * external requests. Purely inputs; injects nothing.
 *
 * Usage: `<app-icon name="search" />` — size via the `size` input (px) or by
 * setting font-size / width on the host with the `w-*`/`h-*` utility classes.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (name()) {
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
          />
        }
        @case ('moon') {
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        }
        @case ('monitor') {
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        }
        @case ('close') {
          <path d="M18 6 6 18M6 6l12 12" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        }
        @case ('warning') {
          <path
            d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        }
        @case ('sparkles') {
          <path
            d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
          />
          <path d="M19 15l.6 1.6L21 17l-1.4.4L19 19l-.6-1.6L17 17l1.4-.4L19 15z" />
        }
        @case ('utensils') {
          <path d="M3 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7" />
        }
        @case ('refresh') {
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        }
        @case ('inbox') {
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path
            d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
          />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
}
