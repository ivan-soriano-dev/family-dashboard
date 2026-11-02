import { Component, computed, inject } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { Clock } from '../core/clock';
import { formatLongDate, formatTime } from '../core/format';

/** The big clock and today's date. */
@Component({
  selector: 'app-clock-face',
  host: { 'aria-label': 'Clock', role: 'group' },
  template: `
    <div
      class="text-[64px] leading-none font-light tracking-[-0.04em] tabular-nums wall:text-[19vh]"
    >
      {{ parts()[0] }}<span class="text-accent">:</span>{{ parts()[1] }}
    </div>
    <div class="mt-2.5 text-lg text-fg-3 wall:mt-[1.6vh] wall:text-[3.4vh]">{{ date() }}</div>
  `,
})
export class ClockFace {
  private readonly clock = inject(Clock);
  private readonly locale = inject(APP_SETTINGS).locale;

  protected readonly parts = computed(() => {
    const time = formatTime(this.clock.now(), this.locale);
    const i = time.indexOf(':');
    return i < 0 ? [time, ''] : [time.slice(0, i), time.slice(i + 1)];
  });
  protected readonly date = computed(() => formatLongDate(this.clock.now(), this.locale));
}
