/**
 * Family Dashboard – Cloudflare Worker
 *
 *   GET  /calendar          -> the iCloud calendar (.ics), with CORS, cached 15 min
 *   GET  /lists/todo        -> { items: [...], updated: 1730000000000 }
 *   POST /lists/todo        -> apply one change, returns the new list
 *                              { op: add | toggle | edit | delete | clearDone | clear }
 *        /lists/groceries   (same as todo)
 *
 * Every request needs the header  X-Family-Token: <FAMILY_TOKEN>
 *
 * Settings (Cloudflare dashboard > Worker > Settings):
 *   Secret    ICLOUD_ICS_URL   your public iCloud calendar link (webcal:// or https://)
 *   Secret    FAMILY_TOKEN     a long random password shared by the family
 *   Variable  ALLOWED_ORIGIN   e.g. https://yourname.github.io   (optional, "*" if empty)
 *   KV        DATA             a KV namespace binding
 */

var LISTS = ['todo', 'groceries'];
var CAL_KEY = 'cache:calendar';
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

  var cached = await env.DATA.get(CAL_KEY, 'json');
  if (cached && Date.now() - cached.at < CAL_TTL_MS) return ics(cached.body, cors, 'hit');

  var url = env.ICLOUD_ICS_URL.trim().replace(/^webcal:\/\//i, 'https://');
  var res = await fetch(url, { headers: { 'User-Agent': 'FamilyDashboard/1.0', 'Accept': 'text/calendar' } });
  var body = res.ok ? await res.text() : '';

  if (body.indexOf('BEGIN:VCALENDAR') === -1) {
    // iCloud hiccup: keep showing the last good copy if there is one
    if (cached) return ics(cached.body, cors, 'stale');
    return json({ error: 'iCloud returned ' + res.status + '. Check that the calendar is still public.' }, 502, cors);
  }
  await env.DATA.put(CAL_KEY, JSON.stringify({ at: Date.now(), body: body }));
  return ics(body, cors, 'miss');
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
