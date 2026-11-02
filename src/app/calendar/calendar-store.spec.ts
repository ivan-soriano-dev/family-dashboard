import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { APP_SETTINGS, SETTINGS } from '../settings';
import { Clock } from '../core/clock';
import { DisplayMode } from '../core/display-mode';
import { FamilyToken } from '../core/family-token';
import { WorkerApi } from '../core/worker-api';
import { CalendarStore } from './calendar-store';
import { CalendarFeeds } from './calendar-events';

const ics = (title: string, color: string) => `BEGIN:VCALENDAR
VERSION:2.0
COLOR:${color}
BEGIN:VEVENT
UID:same-id
SUMMARY:${title}
DTSTART:20261102T100000Z
DTEND:20261102T110000Z
END:VEVENT
END:VCALENDAR`;
const sample = (): CalendarFeeds => ({
  calendars: [
    { id: '1', ics: ics('First calendar', 'red'), stale: false },
    { id: '2', ics: ics('Second calendar', 'blue'), stale: false },
  ],
  unavailable: [],
});

describe('CalendarStore', () => {
  let api: { calendars: ReturnType<typeof vi.fn> };
  const token = signal('');
  const create = () => TestBed.inject(CalendarStore);

  beforeEach(() => {
    localStorage.clear();
    token.set('');
    api = { calendars: vi.fn().mockResolvedValue(sample()) };
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_SETTINGS, useValue: SETTINGS },
        {
          provide: Clock,
          useValue: {
            today: signal(new Date(2026, 10, 2)),
            now: signal(new Date(2026, 10, 2, 9)),
          },
        },
        { provide: DisplayMode, useValue: { demo: false } },
        { provide: FamilyToken, useValue: { value: token } },
        { provide: WorkerApi, useValue: api },
      ],
    });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('combines feeds and saves both for an offline reload', async () => {
    const store = create();
    // Refreshes are gated on the configured family token.
    token.set('test-token');
    await store.refresh();
    expect(store.days()[0].rows.map((row) => row.event.title)).toEqual([
      'First calendar',
      'Second calendar',
    ]);
    expect(store.days()[0].rows.map((row) => row.event.color)).toEqual(['red', 'blue']);
    expect(JSON.parse(localStorage.getItem('fd:calendars')!)).toEqual(sample());
    expect(store.failed()).toBe(false);
  });

  it('loads the old single-calendar cache before the first refresh', () => {
    localStorage.setItem('fd:ics', ics('Legacy calendar', 'green'));
    expect(create().days()[0].rows[0].event.title).toBe('Legacy calendar');
  });

  it('keeps the saved agenda on a total refresh failure', async () => {
    localStorage.setItem('fd:calendars', JSON.stringify(sample()));
    const store = create();
    token.set('test-token');
    api.calendars.mockRejectedValue(new Error('Offline'));
    await store.refresh();
    expect(store.days()[0].rows).toHaveLength(2);
    expect(store.failed()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('stops loading after an initial failure and recovers on the next refresh', async () => {
    const store = create();
    token.set('test-token');
    api.calendars.mockRejectedValueOnce(new Error('Offline'));
    await store.refresh();
    expect(store.failed()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.isEmpty()).toBe(false);
    await store.refresh();
    expect(store.failed()).toBe(false);
    expect(store.days()[0].rows).toHaveLength(2);
  });

  it('removes deleted feeds after a successful refresh and flags partial failures', async () => {
    localStorage.setItem('fd:calendars', JSON.stringify(sample()));
    const store = create();
    token.set('test-token');
    api.calendars.mockResolvedValue({ calendars: [sample().calendars[0]], unavailable: [] });
    await store.refresh();
    expect(store.days()[0].rows).toHaveLength(1);
    api.calendars.mockResolvedValue({ calendars: [sample().calendars[0]], unavailable: ['2'] });
    await store.refresh();
    expect(store.days()[0].rows).toHaveLength(1);
    expect(store.failed()).toBe(true);
  });
});
