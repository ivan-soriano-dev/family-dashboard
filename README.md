# Family dashboard

A clock, the Apple family calendar, a to-do list and a grocery list on one screen.
The page is hosted for free on GitHub Pages. A small free Cloudflare Worker reads the
iCloud calendar and stores the two lists so every phone sees the same lists.

```
family-dashboard/
├── index.html                    the page (colours, settings and markup)
├── tailwind.css                  the built Tailwind styles (already built for you)
├── tailwind.config.js            Tailwind setup: colour names, breakpoints, variants
├── src/tailwind.input.css        Tailwind source (a few shared component classes)
├── .github/workflows/pages.yml   rebuilds tailwind.css and publishes on every push
├── README.md                     this guide
└── worker/
    ├── worker.js                 the Cloudflare Worker
    └── wrangler.toml             only needed if you deploy the Worker from the command line
```

Try it first: open `index.html` in a browser. With no Worker configured it runs in
demo mode with sample events and lists. Add `?mode=frame` to the address to see the
photo-frame layout.

Total setup time: about 30 minutes.

---

## 1. Get the iCloud calendar link (5 min)

On an iPhone: **Calendar → Calendars → (i) next to the family calendar → turn on
Public Calendar → Share Link → Copy**. On a Mac: right-click the calendar →
**Sharing Settings… → Public Calendar**.

The link starts with `webcal://`. Keep it private: anyone who has it can read the
calendar. It will only be stored as a secret in Cloudflare, never on GitHub.

If the Public Calendar switch doesn't appear for the Family Sharing calendar, create a
new shared calendar (for example "Family") and share it with the family instead.

## 2. Pick a family token (1 min)

This is the password the family devices use. Make it long and random, for example
from a password manager: `k7Qp-2mWx-9fTz-Lr4e`. Write it down for the next steps.

## 3. Create the Cloudflare Worker (10 min)

1. Create a free account at <https://dash.cloudflare.com>.
2. **Storage & Databases → KV → Create** a namespace called `family-dashboard-data`.
3. **Workers & Pages → Create → Start with Hello World**, name it `family-dashboard`,
   and click **Deploy**.
4. Click **Edit code**, replace everything with the contents of `worker/worker.js`,
   and click **Deploy**.
5. Go to the Worker's **Settings**:
   - **Bindings → Add → KV namespace**: variable name `DATA`, namespace
     `family-dashboard-data`.
   - **Variables and Secrets → Add**:

     | Type   | Name             | Value                                            |
     |--------|------------------|--------------------------------------------------|
     | Secret | `ICLOUD_ICS_URL` | the `webcal://…` link from step 1                |
     | Secret | `FAMILY_TOKEN`   | the token from step 2                            |
     | Text   | `ALLOWED_ORIGIN` | `https://YOUR-GITHUB-USERNAME.github.io`         |

6. Copy the Worker address shown at the top, for example
   `https://family-dashboard.yourname.workers.dev`.

Check: opening `https://family-dashboard.yourname.workers.dev/lists/todo` in a browser
should say `Wrong or missing family token`. That means the Worker is running.

## 4. Put the page on GitHub Pages (10 min)

1. Create a new **public** repository on GitHub, for example `family-dashboard`.
2. Open `index.html`, find `WORKER_URL: ''` near the top of the script and paste the
   Worker address between the quotes. Optionally change `LOCALE` (for example `'es-ES'`)
   and the words in `TEXT`.
3. Upload the whole folder (it contains no secrets). The web uploader can skip the
   hidden `.github` folder: if it does, use **Add file → Create new file**, name it
   `.github/workflows/pages.yml` and paste the file's contents.
4. **Settings → Pages → Build and deployment → Source: GitHub Actions.** Every push now
   rebuilds the Tailwind CSS and publishes the site (see the **Actions** tab).
5. After a minute or two the page is live at
   `https://YOUR-GITHUB-USERNAME.github.io/family-dashboard/`.

## 5. Phones

Open this address once on each phone (put your own token at the end):

```
https://YOUR-GITHUB-USERNAME.github.io/family-dashboard/#token=YOUR-FAMILY-TOKEN
```

The phone remembers the token and removes it from the address bar. Then use **Share →
Add to Home Screen** (iPhone) or **⋮ → Add to Home screen** (Android) so it opens like
an app. Changes show on the other devices within about 30 seconds.

Instead of the link, you can also open the plain address and type the token when asked.

## 6. The photo frame

1. Turn on developer options on the frame (Settings → About → tap **Build number** 7
   times) and allow installing apps from unknown sources.
2. Install a kiosk browser app, for example **Fully Kiosk Browser**.
3. Set its start address to:

   ```
   https://YOUR-GITHUB-USERNAME.github.io/family-dashboard/?mode=frame#token=YOUR-FAMILY-TOKEN
   ```

4. In the kiosk app, turn on: start on boot, keep screen on, and fullscreen.

Frame mode hides the add, delete, "Remove completed" and "Clear list" buttons (tapping an item still checks it off),
dims the screen at night (23:00 to 07:00, change `NIGHT` in `index.html`), nudges the
layout by a few pixels every hour to avoid screen burn-in, and reloads itself every
6 hours.

If the page stays blank on the frame, the built-in browser engine is probably very old:
update **Android System WebView** (via Play Store, or by installing its APK) or use a
kiosk app that ships its own engine.

---

## Colours and styling (Tailwind)

The page is styled with [Tailwind CSS](https://v3.tailwindcss.com) v3. Version 3 is
used on purpose: its output still works on the older Android browser engines found in
photo frames, while v4 needs recent browsers.

**Change the primary colour:** edit one line near the top of `index.html`:

```js
var THEME = {
  primary: '#ecd8dc'
};
```

Any hex colour works. The page works out the rest on its own: the text colour on
buttons (dark or white), and a darker or lighter shade of the same hue wherever the
colour is used as text, so it stays readable in light and dark mode. No rebuild is
needed because the Tailwind colours point at CSS variables.

Where the primary colour appears: the clock's colon, the "Today" badge, the Add
buttons, checked items, input focus rings, and the browser bar on phones.

**Other colours** (backgrounds, borders, text greys) are the `--bg-*`, `--line*` and
`--fg*` variables in the `<style>` block of `index.html`, for light mode (`:root`) and
dark mode (`.dark`). They use `R G B` numbers, for example `249 250 251`.

**Changing layout or adding classes:** edit the classes in `index.html` (the markup, and
the `UI` object in the script for things the script draws). New classes need a rebuild
of `tailwind.css`. The GitHub Action does it on every push; to preview locally run:

```
npx tailwindcss@3.4.17 -i src/tailwind.input.css -o tailwind.css --watch
```

Tailwind additions in `tailwind.config.js`:

| Name            | Use                                                        |
|-----------------|------------------------------------------------------------|
| `wall:`         | wide screens (900 px and up): the frame, tablets, desktops |
| `frame:`        | only on the photo frame (`?mode=frame`), e.g. `frame:hidden` |
| `hover-hover:`  | hover styles only on devices with a mouse                  |
| `primary`, `on-primary`, `accent` | the theme colour, text on it, readable text shade |
| `page`, `panel`, `hover`, `line`, `line-strong`, `fg` … `fg-4`, `danger` | surface and text colours |

## Updating the Worker

When `worker/worker.js` changes, open the Worker in Cloudflare, click **Edit code**,
paste the new contents and click **Deploy**. Your secrets, variables and saved lists
stay as they are.

## Settings in `index.html`

| Setting                | Default   | What it does                                       |
|------------------------|-----------|----------------------------------------------------|
| `WORKER_URL`           | empty     | Worker address; empty means demo mode              |
| `LOCALE`               | `'en-GB'` | Date and time format (`'es-ES'`, `'en-US'`, …)     |
| `DAYS_AHEAD`           | `7`       | Days shown in the calendar                         |
| `LIST_REFRESH_SEC`     | `30`      | How often lists are re-checked                     |
| `CALENDAR_REFRESH_MIN` | `10`      | How often the calendar is re-checked               |
| `FRAME_RELOAD_HOURS`   | `6`       | Full reload on the frame                           |
| `NIGHT`                | 23→7, 0.8 | Night dimming on the frame; `dim: 0` turns it off  |
| `TEXT`                 | English   | Every word shown on screen                         |

## How it works

- **Calendar:** the Worker downloads the iCloud feed at most every 15 minutes and keeps
  the last good copy if iCloud is unavailable. The page expands repeating events,
  moved occurrences and deleted occurrences with
  [ical.js](https://github.com/kewisch/ical.js) (Mozilla, MPL-2.0).
- **Lists:** each change (add, check, remove, remove completed, clear list) is sent to the Worker,
  which saves the list in Cloudflare KV. The page shows the change immediately and then
  takes the saved version from the Worker.
- **Offline:** every device keeps the last calendar and lists, so the frame still shows
  something if the internet drops. The bottom-right corner says when it last updated.
- **Free limits:** Cloudflare's free plan allows 100,000 reads and 1,000 writes per day.
  A frame plus a few phones uses a few thousand reads and a few dozen writes.

## Security notes

- The token protects both the calendar and the lists. Anyone with the token can see
  the calendar and change the lists. To change it, update `FAMILY_TOKEN` in Cloudflare
  and open the token link again on each device.
- The token is passed after `#`, which browsers never send to GitHub.
- To stop sharing the calendar, turn off Public Calendar in iCloud. The link stops
  working and the Worker keeps showing the last copy until you remove it from KV.

## Troubleshooting

| What you see                         | What to check                                                    |
|--------------------------------------|------------------------------------------------------------------|
| "Enter the family token" keeps coming back | The token on the device must match `FAMILY_TOKEN` exactly  |
| "Offline, showing the last saved copy" | `WORKER_URL` is correct and `ALLOWED_ORIGIN` matches the GitHub Pages address (no trailing slash) |
| "Calendar unavailable"               | Open `…workers.dev/calendar` with the token (e.g. using a REST client) to see the error; check the calendar is still public |
| Events at the wrong hour             | The frame's time zone in Android settings                        |
| A change on one phone takes a minute to show elsewhere | Normal: Cloudflare KV can take up to ~60 seconds to spread changes |
