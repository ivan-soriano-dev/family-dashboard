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
  CalendarFeeds,
  addDays,
  demoEvents,
  expandCalendars,
  groupByDay,
} from './calendar-events';

type Expanded = { events: CalendarEvent[]; failed: boolean };

/** Downloads shared calendars through the Worker and combines their events into one agenda. */
@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly api = inject(WorkerApi);
  private readonly store = inject(LocalStore);
  private readonly token = inject(FamilyToken);
  private readonly clock = inject(Clock);
  private readonly settings = inject(APP_SETTINGS);
  private readonly demo = inject(DisplayMode).demo;
  private readonly document = inject(DOCUMENT);

  private readonly feeds = signal<CalendarFeeds | null>(this.demo ? null : this.savedFeeds());
  private readonly refreshFailed = signal(false);

  private savedFeeds(): CalendarFeeds | null {
    const saved = this.store.getJson<CalendarFeeds>('calendars');
    if (saved && Array.isArray(saved.calendars) && Array.isArray(saved.unavailable)) return saved;
    // Keep the old single-calendar copy visible during the first upgrade/offline load.
    const legacy = this.store.getText('ics');
    return legacy ? { calendars: [{ id: '1', ics: legacy, stale: false }], unavailable: [] } : null;
  }

  /** Recomputed only when the feed or the day changes. */
  private readonly expanded = computed<Expanded | null>(() => {
    const today = this.clock.today();
    if (this.demo) return { events: demoEvents(today), failed: false };
    const feeds = this.feeds();
    if (!feeds) return null;
    return expandCalendars(feeds, today, addDays(today, this.settings.daysAhead));
  });

  readonly loading = computed(() => this.expanded() === null && !this.refreshFailed());
  readonly failed = computed(() => this.refreshFailed() || !!this.expanded()?.failed);

  /** Recomputed every minute, so finished events dim and the current one is highlighted. */
  readonly days = computed<AgendaDay[]>(() => {
    const result = this.expanded();
    if (!result) return [];
    return groupByDay(result.events, this.clock.today(), this.settings.daysAhead, this.clock.now());
  });

  readonly isEmpty = computed(() => {
    const result = this.expanded();
    return !!result && !this.failed() && result.events.length === 0;
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
      const feeds = await this.api.calendars();
      this.feeds.set(feeds);
      this.store.set('calendars', feeds);
      this.refreshFailed.set(false);
    } catch {
      this.refreshFailed.set(true);
      /* offline: keep the saved copy */
    }
  }
}
