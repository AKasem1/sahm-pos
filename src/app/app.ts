import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ShellComponent } from './layout/shell.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShellComponent],
  template: `<app-shell />`,
})
export class App {
  constructor() {
    // Constructing the ThemeService at bootstrap applies the persisted theme
    // before first paint (avoids a light→dark flash).
    inject(ThemeService);
  }
}
