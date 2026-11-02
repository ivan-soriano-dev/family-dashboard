import { Component, computed, inject } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { DisplayMode } from '../core/display-mode';
import { formatTime } from '../core/format';
import { SyncStatus } from '../core/sync-status';

/** "Updated 18:42" / "Offline…" / "Demo mode…" in the corner. */
@Component({
  selector: 'app-status-line',
  host: {
    'aria-live': 'polite',
    class:
      'pointer-events-none block px-4 pb-6 text-center text-xs wall:fixed wall:right-3.5 wall:bottom-2.5 wall:p-0',
    '[class.text-danger]': 'offline()',
    '[class.text-fg-4]': '!offline()',
  },
  template: `{{ message() }}`,
})
export class StatusLine {
  private readonly status = inject(SyncStatus);
  private readonly settings = inject(APP_SETTINGS);
  private readonly demo = inject(DisplayMode).demo;

  protected readonly offline = computed(() => !this.demo && this.status.offline());
  protected readonly message = computed(() => {
    const t = this.settings.text;
    if (this.demo) return t.demo;
    if (this.status.offline()) return t.offline;
    const last = this.status.lastSuccess();
    return last ? `${t.updated} ${formatTime(last, this.settings.locale)}` : '';
  });
}
