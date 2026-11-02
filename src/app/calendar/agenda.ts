import { Component, inject } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { formatDayHeading, formatTime } from '../core/format';
import { AgendaDay, AgendaRow } from './calendar-events';
import { CalendarStore } from './calendar-store';

/** The calendar panel: today plus the next days that have events. */
@Component({
  selector: 'app-agenda',
  templateUrl: './agenda.html',
  host: { class: 'panel', 'aria-labelledby': 'agenda-heading' },
})
export class Agenda {
  protected readonly calendar = inject(CalendarStore);
  private readonly settings = inject(APP_SETTINGS);
  protected readonly text = this.settings.text;

  protected dayName(day: AgendaDay): string {
    if (day.offset === 0) return this.text.today;
    if (day.offset === 1) return this.text.tomorrow;
    return formatDayHeading(day.date, this.settings.locale);
  }

  protected time(row: AgendaRow): string {
    if (row.event.allDay) return this.text.allDay;
    if (row.continues) return '…' + formatTime(row.event.end, this.settings.locale);
    return formatTime(row.event.start, this.settings.locale);
  }
}
