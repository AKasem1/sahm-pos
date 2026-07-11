import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Streaming text with a blinking caret while active (§7.2). The wrapper is an
 * `aria-live="polite"` region so assistive tech announces streamed content
 * without interrupting. The caret respects reduced-motion via global CSS.
 */
@Component({
  selector: 'app-streaming-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-sm leading-relaxed text-muted" aria-live="polite" aria-atomic="false">
      {{ content() }}@if (streaming()) {
        <span
          class="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-caret rounded-sm bg-brand align-middle"
          aria-hidden="true"
        ></span>
      }
    </p>
  `,
})
export class StreamingTextComponent {
  readonly content = input('');
  readonly streaming = input(false);
}
