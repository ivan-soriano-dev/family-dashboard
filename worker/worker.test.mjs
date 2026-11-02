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
