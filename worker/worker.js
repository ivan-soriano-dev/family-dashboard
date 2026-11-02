/**
 * Family Dashboard – Cloudflare Worker
 *
 *   GET  /calendar          -> the iCloud calendar (.ics), with CORS, cached 15 min
 *   GET  /calendars         -> { calendars: [{ id, ics, stale }], unavailable: [id] }
 *   GET  /lists/todo        -> { items: [...], updated: 1730000000000 }
 *   POST /lists/todo        -> apply one change, returns the new list
 *                              { op: add | toggle | edit | delete | clearDone | clear }
 *        /lists/groceries   (same as todo)
 *
 *   GET  /menu/YYYY-MM-DD   -> meals for the week starting on that Monday
 *   POST /menu/YYYY-MM-DD   -> { date, meal, op: add | edit | delete, id, text, audience? }
 *
 * Every request needs the header  X-Family-Token: <FAMILY_TOKEN>
 *
 * Settings (Cloudflare dashboard > Worker > Settings):
 *   Secret    ICLOUD_ICS_URL   your public iCloud calendar link (webcal:// or https://)
 *   Secret    ICLOUD_ICS_URL_2 second link; add _3, _4, etc. for more calendars
 *   Secret    FAMILY_TOKEN     a long random password shared by the family
 *   Variable  ALLOWED_ORIGIN   e.g. https://yourname.github.io   (optional, "*" if empty)
 *   KV        DATA             a KV namespace binding
 */

var LISTS = ['todo', 'groceries'];
var CAL_TTL_MS = 15 * 60 * 1000;
var MAX_ITEMS = 300;
var MAX_TEXT = 200;

export default {
  async fetch(request, env) {
    var cors = corsHeaders(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (!env.FAMILY_TOKEN || request.headers.get('X-Family-Token') !== env.FAMILY_TOKEN) {
      return json({ error: 'Wrong or missing family token' }, 401, cors);
    }

    var path = new URL(request.url).pathname.replace(/\/+$/, '');

    try {
      if (path === '/calendar' && request.method === 'GET') return await calendar(env, cors);
      if (path === '/calendars' && request.method === 'GET') return await calendars(env, cors);

      var menuMatch = path.match(/^\/menu\/(\d{4}-\d{2}-\d{2})$/);
      if (menuMatch) {
        var week = menuMatch[1];
        if (!validDate(week) || new Date(week + 'T00:00:00Z').getUTCDay() !== 1) {
          return json({ error: 'Week must be a Monday (YYYY-MM-DD)' }, 400, cors);
        }
        if (request.method === 'GET') return json(await readMenu(env, week), 200, cors);
        if (request.method === 'POST') {
          return await changeMenu(env, week, await request.json().catch(function () { return null; }), cors);
        }
      }

      var m = path.match(/^\/lists\/([a-z]+)$/);
      if (m && LISTS.indexOf(m[1]) !== -1) {
        if (request.method === 'GET') return json(await readList(env, m[1]), 200, cors);
        if (request.method === 'POST') {
          var body = await request.json().catch(function () { return null; });
          return await changeList(env, m[1], body, cors);
        }
      }
      return json({ error: 'Not found' }, 404, cors);
    } catch (err) {
      return json({ error: String(err && err.message || err) }, 500, cors);
    }
  }
};

/* ---------------- calendar ---------------- */

async function calendar(env, cors) {
  if (!env.ICLOUD_ICS_URL) return json({ error: 'ICLOUD_ICS_URL is not set' }, 500, cors);
  try {
    var result = await readCalendar(env, env.ICLOUD_ICS_URL);
    return ics(result.body, cors, result.state);
  } catch {
    return json({ error: 'Calendar unavailable. Check that the calendar is still public.' }, 502, cors);
  }
}

async function calendars(env, cors) {
  var keys = Object.keys(env).filter(function (key) {
    return /^ICLOUD_ICS_URL(?:_[2-9]|_[1-9]\d+)?$/.test(key) &&
      typeof env[key] === 'string' && env[key].trim();
  }).sort(function (a, b) {
    return (Number(a.replace('ICLOUD_ICS_URL_', '')) || 1) -
      (Number(b.replace('ICLOUD_ICS_URL_', '')) || 1);
  });
  if (!keys.length) return json({ error: 'No calendar links configured' }, 500, cors);

  var results = await Promise.all(keys.map(async function (key) {
    var id = key === 'ICLOUD_ICS_URL' ? '1' : key.slice('ICLOUD_ICS_URL_'.length);
    try {
      var result = await readCalendar(env, env[key]);
      return { id: id, ics: result.body, stale: result.state === 'stale' };
    } catch {
      return { id: id };
    }
  }));
  var available = results.filter(function (result) { return result.ics !== undefined; });
  return json({
    calendars: available,
    unavailable: results.filter(function (result) { return result.ics === undefined; })
      .map(function (result) { return result.id; })
  }, available.length ? 200 : 502, cors);
}

async function readCalendar(env, link) {
  var url = link.trim().replace(/^webcal:\/\//i, 'https://');
  if (new URL(url).protocol !== 'https:') throw new Error('Calendar links must use HTTPS');
  // Changing a link must never reuse a different calendar's cached contents.
  var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
  var hash = Array.from(new Uint8Array(digest), function (byte) {
    return byte.toString(16).padStart(2, '0');
  }).join('');
  var cacheKey = 'cache:calendar:' + hash;
  var cached = await env.DATA.get(cacheKey, 'json');
  if (cached && Date.now() - cached.at < CAL_TTL_MS) return { body: cached.body, state: 'hit' };

  try {
    var res = await fetch(url, {
      headers: { 'User-Agent': 'FamilyDashboard/1.0', 'Accept': 'text/calendar' },
      signal: AbortSignal.timeout(10_000)
    });
    var body = res.ok ? await res.text() : '';
    if (!/^BEGIN:VCALENDAR\s*$/m.test(body) || !/^END:VCALENDAR\s*$/m.test(body)) {
      throw new Error('Invalid calendar response');
    }
  } catch {
    if (cached) return { body: cached.body, state: 'stale' };
    throw new Error('Calendar unavailable');
  }
  // A cache write failure should not hide freshly downloaded events.
  await env.DATA.put(cacheKey, JSON.stringify({ at: Date.now(), body: body }), {
    expirationTtl: 30 * 24 * 60 * 60
  }).catch(function () {});
  return { body: body, state: 'miss' };
}

function ics(body, cors, state) {
  var h = Object.assign({ 'Content-Type': 'text/calendar; charset=utf-8', 'X-Cache': state }, cors);
  return new Response(body, { headers: h });
}

/* ---------------- lists ---------------- */

async function readList(env, name) {
  return (await env.DATA.get('list:' + name, 'json')) || { items: [], updated: 0 };
}

async function changeList(env, name, change, cors) {
  if (!change || typeof change.op !== 'string') return json({ error: 'Missing "op"' }, 400, cors);

  var list = await readList(env, name);
  var items = list.items;
  var find = function (id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return i; return -1; };
  var clean = function (t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT); };
  var i;

  switch (change.op) {
    case 'add':
      var text = clean(change.text);
      if (!text) return json({ error: 'Empty item' }, 400, cors);
      if (items.length >= MAX_ITEMS) return json({ error: 'List is full (' + MAX_ITEMS + ' items)' }, 400, cors);
      items.push({ id: change.id || crypto.randomUUID(), text: text, done: false, at: Date.now() });
      break;
    case 'toggle':
      i = find(change.id);
      if (i !== -1) items[i].done = typeof change.done === 'boolean' ? change.done : !items[i].done;
      break;
    case 'edit':
      i = find(change.id);
      if (i !== -1 && clean(change.text)) items[i].text = clean(change.text);
      break;
    case 'delete':
      i = find(change.id);
      if (i !== -1) items.splice(i, 1);
      break;
    case 'clearDone':
      list.items = items = items.filter(function (x) { return !x.done; });
      break;
    case 'clear':
      list.items = items = [];
      break;
    default:
      return json({ error: 'Unknown op "' + change.op + '"' }, 400, cors);
  }

  list.updated = Date.now();
  await putWithRetry(env, 'list:' + name, JSON.stringify(list));
  return json(list, 200, cors);
}

// KV allows 1 write per second per key; retry if two people tap at the same moment.
async function putWithRetry(env, key, value) {
  for (var attempt = 0; ; attempt++) {
    try { return await env.DATA.put(key, value); }
    catch (e) {
      if (attempt >= 3) throw e;
      await new Promise(function (r) { setTimeout(r, 1100); });
    }
  }
}

/* ---------------- weekly menu ---------------- */

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  var parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

async function readMenu(env, week) {
  return (await env.DATA.get('menu:' + week, 'json')) || { meals: {}, updated: 0 };
}

async function changeMenu(env, week, change, cors) {
  if (!change || !validDate(change.date) || (change.op !== 'setAway' && typeof change.text !== 'string') ||
      (change.meal !== 'dinner' && change.meal !== 'lunch')) {
    return json({ error: 'Invalid meal' }, 400, cors);
  }
  var offset = (Date.parse(change.date) - Date.parse(week)) / 86400000;
  if (offset < 0 || offset > 6 || (change.meal === 'lunch' && offset < 5)) {
    return json({ error: 'Meal is outside the weekly menu slots' }, 400, cors);
  }
  var menu = await readMenu(env, week);
  var key = change.date + ':' + change.meal;
  if (change.op === 'setAway') {
    if (typeof change.away !== 'boolean') return json({ error: 'Invalid away state' }, 400, cors);
    menu.away = Object.assign({}, menu.away);
    if (change.away) menu.away[key] = true;
    else delete menu.away[key];
    menu.updated = Date.now();
    await putWithRetry(env, 'menu:' + week, JSON.stringify(menu));
    return json(menu, 200, cors);
  }
  if (menu.away && menu.away[key]) return json({ error: 'This meal is marked as eating out' }, 409, cors);
  var text = change.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  var op = change.op || 'edit';
  var id = change.id || 'legacy';
  if (['add', 'edit', 'delete'].indexOf(op) === -1 || typeof id !== 'string' || id.length > 100 ||
      (change.op && (!change.id || typeof change.id !== 'string')) ||
      (change.audience !== undefined && typeof change.audience !== 'string')) {
    return json({ error: 'Invalid dish change' }, 400, cors);
  }
  var stored = menu.meals[key];
  var items = typeof stored === 'string' ? [{ id: 'legacy', text: stored }] : (stored || []);
  var existing = items.findIndex(function (dish) { return dish.id === id; });
  if (op === 'add' && !text) return json({ error: 'Empty dish' }, 400, cors);
  if (op === 'delete' || !text) {
    items = items.filter(function (dish) { return dish.id !== id; });
  } else {
    if (existing === -1 && change.op === 'edit') return json({ error: 'Dish not found' }, 404, cors);
    var dish = { id: id, text: text, audience: (change.audience || '').replace(/\s+/g, ' ').trim().slice(0, 60) };
    if (existing === -1) {
      if (items.length >= 20) return json({ error: 'Too many dishes in this meal' }, 400, cors);
      items = items.concat([dish]);
    } else {
      items = items.map(function (item) { return item.id === id ? dish : item; });
    }
  }
  if (items.length) menu.meals[key] = items;
  else delete menu.meals[key];
  menu.updated = Date.now();
  await putWithRetry(env, 'menu:' + week, JSON.stringify(menu));
  return json(menu, 200, cors);
}

/* ---------------- helpers ---------------- */

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Family-Token',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store'
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors)
  });
}
