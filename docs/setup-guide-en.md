# Setup guide

From nothing to a working dashboard: about 30–40 minutes. For what each part is and
how to maintain it, see the [README](../README.md) (Spanish).

You need:
- a GitHub account (personal),
- a free Cloudflare account,
- the family's Apple calendar,
- and, for local work only, Node.js 24.

---

## 1. Get the iCloud calendar link (5 min)

On an iPhone: **Calendar → Calendars → (i) next to the family calendar → turn on
Public Calendar → Share Link → Copy**. On a Mac: right-click the calendar →
**Sharing Settings… → Public Calendar**.

The link starts with `webcal://`. Keep it private: anyone with it can read the
calendar. It is only ever stored as a secret in Cloudflare.

If the switch doesn't appear for the Family Sharing calendar, create a new shared
calendar and share it with the family instead.

## 2. Pick a family token (1 min)

A long random password, for example from a password manager: `k7Qp-2mWx-9fTz-Lr4e`.

## 3. Create the Cloudflare Worker (10 min)

1. **Storage & databases → KV → Create**: name `family-dashboard-data`, data location
   **Standard**.
2. **Compute → Workers & Pages → Create → Start with Hello World**: name
   `family-dashboard`, then **Deploy**.
3. **Edit code**: replace everything with `worker/worker.js` from this repository, then
   **Deploy**.
4. Worker → **Settings**:
   - **Bindings → Add → KV namespace**: variable name `DATA`, namespace
     `family-dashboard-data`.
   - **Variables and Secrets → Add**:

     | Type   | Name             | Value                                    |
     |--------|------------------|------------------------------------------|
     | Secret | `ICLOUD_ICS_URL` | the `webcal://…` link from step 1        |
     | Secret | `FAMILY_TOKEN`   | the token from step 2                    |
     | Text   | `ALLOWED_ORIGIN` | `https://YOUR-GITHUB-USERNAME.github.io` |

5. Copy the Worker address (shown after deploying, on the Worker's overview page, and
   under **Settings → Domains & Routes**): `https://family-dashboard.<subdomain>.workers.dev`.

Check: opening `…workers.dev/lists/todo` in a browser should say
`Wrong or missing family token`.

## 4. Put the app on GitHub Pages (10 min)

Use Git (the web uploader skips hidden folders such as `.github` and can't delete old
files).

1. Create a **public** repository on your personal GitHub account, e.g. `family-dashboard`,
   and clone it.
2. Copy this project into it, including hidden files. From the unzipped folder:

   ```bash
   cp -R ~/Downloads/family-dashboard/. ~/path/to/your/clone/
   ```

   If the repository already holds the previous single-page version, delete its old
   files first (`index.html`, `tailwind.css`, `tailwind.config.js`, `src/`, `icons/`,
   `manifest.webmanifest`, `.github/`) and keep only `.git`.
3. Edit `src/app/settings.ts`: put the Worker address in `workerUrl`. Optionally change
   `locale` (e.g. `'es-ES'`) and the words in `text`.
4. Commit and push to `main`.
5. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. **Actions** tab → "Deploy to GitHub Pages". If it didn't start, click
   **Run workflow**. After 2–3 minutes and a green tick, the app is live at
   `https://YOUR-GITHUB-USERNAME.github.io/REPOSITORY-NAME/`.

## 5. Phones

Open once on each phone (with your token):

```
https://YOUR-GITHUB-USERNAME.github.io/REPOSITORY-NAME/#token=YOUR-FAMILY-TOKEN
```

Then add it to the home screen:
- **iPhone:** Safari → Share → **Add to Home Screen** → **Add**. The home-screen app
  asks for the token once more, because iOS keeps its data separate from Safari.
- **Android:** Chrome → ⋮ → **Add to home screen**.

## 6. The photo frame

- **Choose a frame with Android 10 or newer.** The app needs a browser engine (Android
  System WebView) from roughly the last 2.5 years, and Chrome no longer updates on
  Android 9 or older.
- **Set it up:**
  1. Enable developer options (Settings → About → tap **Build number** 7 times).
  2. Allow installing apps.
  3. Install a kiosk browser such as Fully Kiosk Browser.
  4. Set its start address to

     ```
     https://YOUR-GITHUB-USERNAME.github.io/REPOSITORY-NAME/?mode=frame#token=YOUR-FAMILY-TOKEN
     ```

  5. Turn on: start on boot, keep screen on, fullscreen.
- **Keep Android System WebView up to date** (Play Store).

## Local development

```bash
npm ci        # install exact versions
npm start     # http://localhost:4200 (demo mode if workerUrl is empty)
npm test      # unit tests
```

Frame layout locally: `http://localhost:4200/?mode=frame`. To use the real Worker
locally, temporarily add `http://localhost:4200` to `ALLOWED_ORIGIN`, or set it to `*`.
