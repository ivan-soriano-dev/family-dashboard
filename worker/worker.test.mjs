import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const first = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-APPLE-CALENDAR-COLOR:#ff0000\r\nEND:VCALENDAR';
const second = first.replace('#ff0000', '#0000ff');
const originalFetch = globalThis.fetch;
let values;
let env;
let calls;
const request = (path = '/calendars', token = 'test-token') => worker.fetch(new Request('https://worker.example' + path, {
  headers: { 'X-Family-Token': token }
}), env);

beforeEach(() => {
  values = new Map();
  calls = [];
  env = {
    FAMILY_TOKEN: 'test-token',
    ICLOUD_ICS_URL: 'webcal://calendar.example/first',
    ICLOUD_ICS_URL_2: 'https://calendar.example/second',
    DATA: {
      get: async key => values.get(key) ?? null,
      put: async (key, value) => { values.set(key, JSON.parse(value)); }
    }
  };
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response(url.endsWith('/second') ? second : first);
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('requires the family token before fetching any calendars', async () => {
  assert.equal((await request('/calendars', 'wrong')).status, 401);
  assert.equal(calls.length, 0);
});

test('returns separate feeds with colours and caches each independently', async () => {
  const response = await request();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { calendars: [
    { id: '1', ics: first, stale: false },
    { id: '2', ics: second, stale: false }
  ], unavailable: [] });
  assert.deepEqual([...calls].sort(), ['https://calendar.example/first', 'https://calendar.example/second']);
  assert.equal(values.size, 2);
  assert.ok([...values.keys()].every(key => /^cache:calendar:[a-f0-9]{64}$/.test(key)));
  await request();
  assert.equal(calls.length, 2);
  assert.ok(!JSON.stringify(body).includes('calendar.example'));
});

test('supports one calendar and the legacy endpoint', async () => {
  delete env.ICLOUD_ICS_URL_2;
  assert.equal((await (await request()).json()).calendars.length, 1);
  const legacy = await request('/calendar');
  assert.equal(legacy.headers.get('Content-Type'), 'text/calendar; charset=utf-8');
  assert.equal(await legacy.text(), first);
});

test('supports additional numbered calendars even when numbers have gaps', async () => {
  env.ICLOUD_ICS_URL_10 = 'https://calendar.example/tenth';
  env.ICLOUD_ICS_URL_4 = 'https://calendar.example/fourth';
  const body = await (await request()).json();
  assert.deepEqual(body.calendars.map(feed => feed.id), ['1', '2', '4', '10']);
});

test('keeps the working feed when another fails without a cache', async () => {
  globalThis.fetch = async url => {
    if (url.endsWith('/second')) throw new Error('Network failure containing a private URL');
    return new Response(first);
  };
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    calendars: [{ id: '1', ics: first, stale: false }], unavailable: ['2']
  });
});

test('uses stale cached feeds on network errors and invalid responses', async () => {
  await request();
  for (const value of values.values()) value.at = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/second')) throw new Error('Offline');
    return new Response('<html>Unavailable</html>');
  };
  const body = await (await request()).json();
  assert.deepEqual(body.calendars.map(feed => [feed.ics, feed.stale]), [[first, true], [second, true]]);
  assert.deepEqual(body.unavailable, []);
});

test('changing a secret never reuses the previous calendar cache', async () => {
  await request();
  env.ICLOUD_ICS_URL_2 = 'https://calendar.example/replacement';
  globalThis.fetch = async () => { throw new Error('Offline'); };
  const body = await (await request()).json();
  assert.deepEqual(body.calendars.map(feed => feed.id), ['1']);
  assert.deepEqual(body.unavailable, ['2']);
});

test('removing a secret removes its feed immediately', async () => {
  await request();
  delete env.ICLOUD_ICS_URL_2;
  assert.deepEqual((await (await request()).json()).calendars.map(feed => feed.id), ['1']);
});

test('does not hide fresh events when KV writes fail', async () => {
  env.DATA.put = async () => { throw new Error('KV unavailable'); };
  assert.equal((await request()).status, 200);
});

test('reports missing configuration and complete outages without leaking links', async () => {
  globalThis.fetch = async () => { throw new Error(env.ICLOUD_ICS_URL); };
  const response = await request();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { calendars: [], unavailable: ['1', '2'] });
  delete env.ICLOUD_ICS_URL;
  delete env.ICLOUD_ICS_URL_2;
  assert.equal((await request()).status, 500);
});

const saveMeal = (week, change, token = 'test-token') => worker.fetch(new Request('https://worker.example/menu/' + week, {
  method: 'POST', headers: { 'X-Family-Token': token, 'Content-Type': 'application/json' },
  body: JSON.stringify(change)
}), env);

test('weekly menus require authentication and valid Monday dates', async () => {
  assert.equal((await request('/menu/2026-11-02', 'wrong')).status, 401);
  assert.equal((await saveMeal('2026-11-02', { date: '2026-11-02', meal: 'dinner', text: 'Soup' }, 'wrong')).status, 401);
  assert.equal(values.size, 0);
  for (const week of ['2026-11-03', '2026-02-30']) {
    assert.equal((await request('/menu/' + week)).status, 400);
  }
  assert.deepEqual(await (await request('/menu/2026-11-02')).json(), { meals: {}, updated: 0 });
});

test('saves, edits, removes and isolates weekly meals', async () => {
  const week = '2026-11-02';
  const dinner = { date: week, meal: 'dinner', text: '  Tomato\n soup  ' };
  let response = await saveMeal(week, dinner);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).meals[week + ':dinner'][0].text, 'Tomato soup');
  await saveMeal(week, { date: '2026-11-07', meal: 'lunch', text: 'Rice' });
  await saveMeal(week, { date: '2026-11-08', meal: 'dinner', text: 'Pizza' });
  await saveMeal(week, { ...dinner, text: 'Pasta' });
  const menu = await (await request('/menu/' + week)).json();
  assert.deepEqual(menu.meals, {
    '2026-11-02:dinner': [{ id: 'legacy', text: 'Pasta', audience: '' }],
    '2026-11-07:lunch': [{ id: 'legacy', text: 'Rice', audience: '' }],
    '2026-11-08:dinner': [{ id: 'legacy', text: 'Pizza', audience: '' }]
  });
  assert.ok(menu.updated > 0);
  assert.deepEqual((await (await request('/menu/2026-11-09')).json()).meals, {});
  await saveMeal(week, { ...dinner, text: '' });
  assert.equal((await (await request('/menu/' + week)).json()).meals[week + ':dinner'], undefined);
});

test('rejects weekday lunches, other weeks, invalid dates and invalid meal data', async () => {
  for (const change of [
    { date: '2026-11-02', meal: 'lunch', text: 'Rice' },
    { date: '2026-11-09', meal: 'dinner', text: 'Rice' },
    { date: '2026-11-01', meal: 'dinner', text: 'Rice' },
    { date: '2026-02-30', meal: 'dinner', text: 'Rice' },
    { date: '2026-11-02', meal: 'breakfast', text: 'Rice' },
    { date: '2026-11-02', meal: 'dinner', text: 123 }, null
  ]) assert.equal((await saveMeal('2026-11-02', change)).status, 400);
  assert.equal(values.size, 0);
});


test('preserves existing menus and changes only the selected dish', async () => {
  const week = '2026-11-02';
  const key = week + ':dinner';
  values.set('menu:' + week, { meals: { [key]: 'Original soup' }, updated: 1 });
  const change = { date: week, meal: 'dinner', id: 'adults', op: 'add', text: 'Salad', audience: 'Adults' };
  assert.equal((await saveMeal(week, change)).status, 200);
  // Retrying the same submission must not add a duplicate.
  await saveMeal(week, change);
  let menu = await (await request('/menu/' + week)).json();
  assert.deepEqual(menu.meals[key], [
    { id: 'legacy', text: 'Original soup' }, { id: 'adults', text: 'Salad', audience: 'Adults' }
  ]);
  await saveMeal(week, { ...change, op: 'edit', text: 'Fish', audience: ' Adultos  ' });
  menu = await (await request('/menu/' + week)).json();
  assert.equal(menu.meals[key][0].text, 'Original soup');
  assert.deepEqual(menu.meals[key][1], { id: 'adults', text: 'Fish', audience: 'Adultos' });
  await saveMeal(week, { ...change, op: 'delete', text: '' });
  menu = await (await request('/menu/' + week)).json();
  assert.deepEqual(menu.meals[key], [{ id: 'legacy', text: 'Original soup' }]);
  await saveMeal(week, { ...change, op: 'delete', id: 'legacy', text: '' });
  menu = await (await request('/menu/' + week)).json();
  assert.equal(menu.meals[key], undefined);
});

test('validates dish operations and limits without saving invalid changes', async () => {
  const change = { date: '2026-11-02', meal: 'dinner', id: 'dish', op: 'add', text: 'Rice' };
  for (const invalid of [
    { ...change, op: 'unknown' }, { ...change, id: '' },
    { ...change, audience: 123 }, { ...change, text: ' ' }
  ]) assert.equal((await saveMeal('2026-11-02', invalid)).status, 400);
  assert.equal((await saveMeal('2026-11-02', { ...change, op: 'edit' })).status, 404);
  assert.equal(values.size, 0);
  values.set('menu:2026-11-02', {
    meals: { '2026-11-02:dinner': Array.from({ length: 20 }, (_, i) => ({ id: 'dish-' + i, text: 'Meal' })) }, updated: 1
  });
  assert.equal((await saveMeal('2026-11-02', change)).status, 400);
});


test('eating out blocks dish changes while preserving dishes and other meals', async () => {
  const week = '2026-11-02';
  const dish = { date: week, meal: 'dinner', op: 'add', id: 'kids', text: 'Pasta', audience: 'Niñas' };
  await saveMeal(week, dish);
  const toggle = { date: week, meal: 'dinner', op: 'setAway', away: true };
  assert.equal((await saveMeal(week, toggle)).status, 200);
  for (const op of ['add', 'edit', 'delete']) {
    assert.equal((await saveMeal(week, { ...dish, op })).status, 409);
  }
  let menu = await (await request('/menu/' + week)).json();
  assert.equal(menu.away[week + ':dinner'], true);
  assert.equal(menu.meals[week + ':dinner'][0].text, 'Pasta');
  assert.equal((await saveMeal(week, { ...dish, date: '2026-11-03' })).status, 200);
  assert.equal((await saveMeal(week, { ...toggle, away: false })).status, 200);
  assert.equal((await saveMeal(week, { ...dish, op: 'edit', text: 'Rice' })).status, 200);
  menu = await (await request('/menu/' + week)).json();
  assert.equal(menu.away[week + ':dinner'], undefined);
  assert.equal(menu.meals[week + ':dinner'][0].text, 'Rice');
});

test('validates away state, dates, and authentication', async () => {
  const toggle = { date: '2026-11-02', meal: 'dinner', op: 'setAway', away: true };
  for (const away of [undefined, 'true', 1, null]) {
    assert.equal((await saveMeal('2026-11-02', { ...toggle, away })).status, 400);
  }
  assert.equal((await saveMeal('2026-11-02', toggle, 'wrong')).status, 401);
  assert.equal((await saveMeal('2026-11-02', { ...toggle, meal: 'lunch' })).status, 400);
  assert.equal((await saveMeal('2026-11-02', { ...toggle, date: '2026-11-09' })).status, 400);
  assert.equal(values.size, 0);
});
