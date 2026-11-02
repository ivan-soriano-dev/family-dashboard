import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { Clock } from '../core/clock';
import { DisplayMode } from '../core/display-mode';
import { FamilyToken } from '../core/family-token';
import { LocalStore } from '../core/local-store';
import { WorkerApi } from '../core/worker-api';
import {
  AgendaDay,
  CalendarEvent,
  addDays,
  demoEvents,
  expandEvents,
  groupByDay,
} from './calendar-events';

type Expanded = { ok: true; events: CalendarEvent[] } | { ok: false };

/** The family calendar: downloads the .ics through the Worker and turns it into days to show. */
@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly api = inject(WorkerApi);
  private readonly store = inject(LocalStore);
  private readonly token = inject(FamilyToken);
  private readonly clock = inject(Clock);
  private readonly settings = inject(APP_SETTINGS);
  private readonly demo = inject(DisplayMode).demo;
  private readonly document = inject(DOCUMENT);

  /** Raw .ics text (cached on the device so something shows while offline). */
  private readonly ics = signal<string | null>(this.demo ? null : this.store.getText('ics'));

  /** Recomputed only when the feed or the day changes. */
  private readonly expanded = computed<Expanded | null>(() => {
    const today = this.clock.today();
    if (this.demo) return { ok: true, events: demoEvents(today) };
    const ics = this.ics();
    if (!ics) return null;
    try {
      return {
        ok: true,
        events: expandEvents(ics, today, addDays(today, this.settings.daysAhead)),
      };
    } catch (e) {
      console.error('Could not read the calendar', e);
      return { ok: false };
    }
  });

  readonly loading = computed(() => this.expanded() === null);
  readonly failed = computed(() => this.expanded()?.ok === false);

  /** Recomputed every minute, so finished events dim and the current one is highlighted. */
  readonly days = computed<AgendaDay[]>(() => {
    const result = this.expanded();
    if (!result?.ok) return [];
    return groupByDay(result.events, this.clock.today(), this.settings.daysAhead, this.clock.now());
  });

  readonly isEmpty = computed(() => {
    const result = this.expanded();
    return !!result?.ok && result.events.length === 0;
  });

  constructor() {
    if (this.demo) return;

    effect(() => {
      if (this.token.value()) untracked(() => void this.refresh());
    });

    const id = setInterval(
      () => void this.refresh(),
      this.settings.calendarRefreshMinutes * 60_000,
    );
    const onVisible = () => !this.document.hidden && void this.refresh();
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(id);
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }

  async refresh(): Promise<void> {
    if (this.demo || !this.token.value()) return;
    try {
      const text = await this.api.calendar();
      this.ics.set(text);
      this.store.set('ics', text);
    } catch {
      /* offline: keep the saved copy */
    }
  }
}
