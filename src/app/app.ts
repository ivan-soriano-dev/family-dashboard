import { Component, inject } from '@angular/core';
import { APP_SETTINGS } from './settings';
import { DisplayMode } from './core/display-mode';
import { Agenda } from './calendar/agenda';
import { ListPanel } from './lists/list-panel';
import { ClockFace } from './shell/clock-face';
import { StatusLine } from './shell/status-line';
import { TokenDialog } from './shell/token-dialog';

/**
 * Page layout.
 *  Phones: one column – clock, to do, groceries, calendar.
 *  Wide screens (frame): clock + tasks in the narrow left column, calendar in the
 *  middle, and groceries on the right. The left column is 30% narrower than before.
 */
@Component({
  selector: 'app-root',
  imports: [Agenda, ClockFace, ListPanel, StatusLine, TokenDialog],
  templateUrl: './app.html',
  host: { class: 'block h-full' },
})
export class App {
  protected readonly display = inject(DisplayMode);
  protected readonly text = inject(APP_SETTINGS).text;
}
