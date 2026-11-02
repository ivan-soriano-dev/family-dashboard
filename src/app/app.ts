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
 *  Wide screens (frame): clock + calendar on the left, the two lists on the right.
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
