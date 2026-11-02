import ICAL from "ical.js";

/** One occurrence of an event, ready to display. */
export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location: string;
  /** Event colour, falling back to the shared calendar's colour when provided. */
  color?: string;
}

export interface CalendarFeeds {
  calendars: { id: string; ics: string; stale: boolean }[];
  unavailable: string[];
}

/** Expand each feed separately so matching UIDs and time zones cannot mix calendars. */
export function expandCalendars(feeds: CalendarFeeds, from: Date, to: Date) {
  const events: CalendarEvent[] = [];
  let failed = feeds.unavailable.length > 0;
  for (const feed of feeds.calendars) {
    failed ||= feed.stale;
    try {
      events.push(...expandEvents(feed.ics, from, to));
    } catch {
      failed = true;
    }
  }
  events.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      Number(b.allDay) - Number(a.allDay),
  );
  return { events, failed };
}

export type EventState = "past" | "now" | "later";

export interface AgendaRow {
  event: CalendarEvent;
  /** Starts on an earlier day and continues into this one. */
  continues: boolean;
  state: EventState;
}

export interface AgendaDay {
  date: Date;
  /** 0 = today, 1 = tomorrow, … */
  offset: number;
  rows: AgendaRow[];
}

const DAY = 86_400_000;

function componentColor(component: ICAL.Component): string | undefined {
  for (const property of ["color", "x-apple-calendar-color", "x-wr-calcolor"]) {
    const value = component.getFirstPropertyValue(property);
    if (typeof value !== "string") continue;
    const color = value.trim();
    if (
      /^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+)$/i.test(
        color,
      )
    ) {
      return color;
    }
  }
  return undefined;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Reads an iCalendar (.ics) feed and returns every occurrence that overlaps [from, to),
 * including repeating events, moved occurrences (RECURRENCE-ID) and skipped ones (EXDATE),
 * converted to the device's time zone.
 */
export function expandEvents(
  ics: string,
  from: Date,
  to: Date,
): CalendarEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  const calendarColor = componentColor(calendar);
  for (const tz of calendar.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      /* ignore malformed time zones */
    }
  }

  const recurring = new Map<string, ICAL.Event>();
  const single: ICAL.Event[] = [];
  const exceptions: ICAL.Event[] = [];

  for (const vevent of calendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent);
    if (vevent.hasProperty("recurrence-id")) exceptions.push(event);
    else if (event.isRecurring()) recurring.set(event.uid, event);
    else single.push(event);
  }
  for (const ex of exceptions) {
    const master = recurring.get(ex.uid);
    if (master) master.relateException(ex);
    else single.push(ex);
  }

  const out: CalendarEvent[] = [];
  const push = (
    event: ICAL.Event,
    start: ICAL.Time,
    end: ICAL.Time | null,
    master?: ICAL.Event,
  ) => {
    const s = start.toJSDate();
    const e = end
      ? end.toJSDate()
      : new Date(s.getTime() + (start.isDate ? DAY : 0));
    if (e <= from && s < from) return;
    if (s >= to) return;
    out.push({
      title: event.summary || "(no title)",
      start: s,
      end: e,
      allDay: start.isDate,
      location: event.location || "",
      color:
        componentColor(event.component) ??
        (master && componentColor(master.component)) ??
        calendarColor,
    });
  };

  for (const event of single) push(event, event.startDate, event.endDate);

  for (const event of recurring.values()) {
    const duration = event.endDate
      ? event.endDate.toJSDate().getTime() -
        event.startDate.toJSDate().getTime()
      : 0;
    const iterator = event.iterator();
    for (
      let next = iterator.next(), guard = 0;
      next && guard < 20_000;
      next = iterator.next(), guard++
    ) {
      const start = next.toJSDate();
      if (start >= to) break;
      if (start.getTime() + Math.max(duration, 1) <= from.getTime()) continue;
      const details = event.getOccurrenceDetails(next);
      push(details.item, details.startDate, details.endDate, event);
    }
  }

  return out.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      Number(b.allDay) - Number(a.allDay),
  );
}

/**
 * Groups events into days starting at `today`. Today is always included (even if empty);
 * later days only when they have something.
 */
export function groupByDay(
  events: readonly CalendarEvent[],
  today: Date,
  days: number,
  now: Date,
): AgendaDay[] {
  const result: AgendaDay[] = [];
  for (let offset = 0; offset < days; offset++) {
    const dayStart = addDays(today, offset);
    const dayEnd = addDays(today, offset + 1);
    const rows: AgendaRow[] = events
      .filter(
        (e) =>
          e.start < dayEnd &&
          (e.end > dayStart ||
            (e.end.getTime() === e.start.getTime() && e.start >= dayStart)),
      )
      .map((event) => ({
        event,
        continues: !event.allDay && event.start < dayStart,
        state:
          offset > 0 || event.allDay
            ? "later"
            : event.end <= now && event.end > event.start
              ? "past"
              : event.start <= now && event.end > now
                ? "now"
                : "later",
      }));
    if (offset === 0 || rows.length)
      result.push({ date: dayStart, offset, rows });
  }
  return result;
}

/** Sample events for demo mode, relative to today. */
export function demoEvents(today: Date): CalendarEvent[] {
  const at = (day: number, h: number, m = 0) => {
    const d = addDays(today, day);
    d.setHours(h, m, 0, 0);
    return d;
  };
  return [
    {
      title: "School run",
      start: at(0, 8, 30),
      end: at(0, 9),
      allDay: false,
      location: "",
    },
    {
      title: "Dentist – Lucía",
      start: at(0, 17),
      end: at(0, 17, 45),
      allDay: false,
      location: "Clínica Dental",
    },
    {
      title: "Swimming",
      start: at(1, 18),
      end: at(1, 19),
      allDay: false,
      location: "Polideportivo",
    },
    {
      title: "Grandma visiting",
      start: at(3, 0),
      end: at(5, 0),
      allDay: true,
      location: "",
    },
    {
      title: "Family dinner",
      start: at(4, 21),
      end: at(4, 23),
      allDay: false,
      location: "",
    },
  ];
}
