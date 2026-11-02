import { expandEvents, groupByDay } from './calendar-events';

// Weekly event with a skipped (EXDATE) and a moved (RECURRENCE-ID) occurrence,
// a 3-day all-day event and an old one-off event, in the Europe/Madrid time zone.
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTIMEZONE
TZID:Europe/Madrid
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19810329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19961027T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:swim
SUMMARY:Swimming
DTSTART;TZID=Europe/Madrid:20261005T180000
DTEND;TZID=Europe/Madrid:20261005T190000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
EXDATE;TZID=Europe/Madrid:20261104T180000
END:VEVENT
BEGIN:VEVENT
UID:swim
RECURRENCE-ID;TZID=Europe/Madrid:20261109T180000
SUMMARY:Swimming (moved)
DTSTART;TZID=Europe/Madrid:20261109T193000
DTEND;TZID=Europe/Madrid:20261109T203000
END:VEVENT
BEGIN:VEVENT
UID:trip
SUMMARY:Grandma visiting
DTSTART;VALUE=DATE:20261106
DTEND;VALUE=DATE:20261109
END:VEVENT
BEGIN:VEVENT
UID:old
SUMMARY:Old thing
DTSTART:20250101T100000Z
DTEND:20250101T110000Z
END:VEVENT
END:VCALENDAR`;

describe('expandEvents', () => {
  const from = new Date(2026, 10, 2); // 2 Nov 2026, local time
  const to = new Date(2026, 10, 12);
  const events = expandEvents(ICS, from, to);

  it('expands repeats, skips EXDATEs and applies moved occurrences', () => {
    expect(events.map((e) => e.title)).toEqual([
      'Swimming',
      'Grandma visiting',
      'Swimming (moved)',
      'Swimming',
    ]);
    const utcStarts = events.filter((e) => !e.allDay).map((e) => e.start.toISOString());
    expect(utcStarts).toEqual([
      '2026-11-02T17:00:00.000Z',
      '2026-11-09T18:30:00.000Z',
      '2026-11-11T17:00:00.000Z',
    ]);
  });

  it('keeps all-day events as whole days', () => {
    const trip = events.find((e) => e.allDay)!;
    expect(trip.start).toEqual(new Date(2026, 10, 6));
    expect(trip.end).toEqual(new Date(2026, 10, 9));
  });
});

describe('groupByDay', () => {
  it('always shows today, then only days with events; spans multi-day events', () => {
    const today = new Date(2026, 10, 3);
    const events = expandEvents(ICS, today, new Date(2026, 10, 10));
    const days = groupByDay(events, today, 7, new Date(2026, 10, 3, 12));
    // today (empty), Wed 4 skipped by EXDATE, Fri–Sun all-day trip, Mon 9 moved swim
    expect(days.map((d) => d.offset)).toEqual([0, 3, 4, 5, 6]);
    expect(days[0].rows).toEqual([]);
  });
});
