import { Pipe, PipeTransform } from '@angular/core';

export interface HighlightSegment {
  readonly text: string;
  readonly match: boolean;
}

/**
 * XSS-safe match highlighting (§7.4). Instead of returning HTML, we return
 * typed segments the template renders with a `<mark>` — no `innerHTML`, so
 * arbitrary product/search text can never inject markup.
 */
@Pipe({ name: 'highlightMatch' })
export class HighlightMatchPipe implements PipeTransform {
  transform(text: string, query: string | null | undefined): HighlightSegment[] {
    const q = (query ?? '').trim();
    if (!q) {
      return [{ text, match: false }];
    }
    const lowerText = text.toLowerCase();
    const lowerQuery = q.toLowerCase();
    const segments: HighlightSegment[] = [];
    let cursor = 0;

    for (;;) {
      const idx = lowerText.indexOf(lowerQuery, cursor);
      if (idx === -1) {
        segments.push({ text: text.slice(cursor), match: false });
        break;
      }
      if (idx > cursor) {
        segments.push({ text: text.slice(cursor, idx), match: false });
      }
      segments.push({ text: text.slice(idx, idx + q.length), match: true });
      cursor = idx + q.length;
    }
    return segments.filter((s) => s.text.length > 0);
  }
}
