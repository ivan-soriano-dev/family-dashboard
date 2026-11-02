# Family Dashboard

A shared calendar, to-do list, and shopping list for phones and a wall display.
The Angular frontend runs on GitHub Pages; a Cloudflare Worker accesses the
calendar and stores shared lists in Cloudflare KV.

## Configuration

| Location | What to maintain |
|---|---|
| [`src/app/settings.ts`](src/app/settings.ts) | Worker URL, language and text, calendar range, refresh intervals, theme colour, and frame settings. An empty `workerUrl` enables demo mode. |
| [`src/styles.css`](src/styles.css) | Colours, fonts, and responsive styles. Keep the initial theme colours aligned with `settings.ts`. |
| [`src/app/app.html`](src/app/app.html) | Main screen layout. Calendar, list, and shell components are under `src/app/`. |
| [`public/`](public/) and [`src/index.html`](src/index.html) | App icons, manifest, and page title. |
| [`worker/worker.js`](worker/worker.js) | Backend authentication, calendar fetching, and list updates. |
| [`worker/wrangler.toml`](worker/wrangler.toml) | Optional CLI deployment settings and KV binding. Replace placeholders before use; keep secrets out of this file. |
| [`package.json`](package.json) and `package-lock.json` | Supported Node.js versions, commands, and pinned dependencies. |

Cloudflare dashboard: <https://dash.cloudflare.com/>. Select your account, then
open **Compute →** [**Workers & Pages**](https://dash.cloudflare.com/?to=/:account/workers-and-pages),
select **family-dashboard**. Menu paths below start from that Worker.

| Setting | Where to find or edit it | Purpose |
|---|---|---|
| `DATA` (KV binding) | **Settings → Bindings → DATA → pencil icon**; **Add binding → KV namespace** if missing. | Connects the Worker to the namespace holding shared data. |
| `FAMILY_TOKEN` (secret) | **Settings → Runtime variables and secrets → FAMILY_TOKEN → pencil icon**; **Add variable** if missing, with type **Secret**. | Shared password required to read the calendar and read or change lists. Existing secret values are hidden; replace them to change them. |
| `ICLOUD_ICS_URL` (secret) | **Settings → Runtime variables and secrets → ICLOUD_ICS_URL → pencil icon**; **Add variable** if missing, with type **Secret**. | Public iCloud calendar subscription link. |
| `ALLOWED_ORIGIN` (variable) | **Settings → Runtime variables and secrets → ALLOWED_ORIGIN → pencil icon**; **Add variable** if missing, with type **Text**. | Frontend origin, such as `https://<username>.github.io`, without the repository path or trailing slash. This is a browser restriction, not authentication. |

![Cloudflare Settings: runtime variables and secrets, edit buttons, and DATA binding; values redacted](docs/images/cloudflare-settings-redacted.png)

The screenshot shows the navigation; store `FAMILY_TOKEN` and `ICLOUD_ICS_URL` as
**Secret**, rather than the plain **Variable** type shown. Some dashboard versions
label the section **Variables and Secrets** or provide a separate **Bindings** tab.

Find the Worker address under **Settings → Domains & Routes**; use it as
`workerUrl` in `src/app/settings.ts`. Save or deploy changes when prompted.

## Storage and backups

| Location | Contents |
|---|---|
| iCloud Calendar | Original calendar events; edit them in Apple Calendar. |
| [Cloudflare KV](https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces), bound as `DATA` | `list:todo` and `list:groceries` hold shared lists. `cache:calendar` holds the last fetched calendar, refreshed after 15 minutes when requested. |
| Each browser’s `localStorage` | `fd:token` stores the password; `fd:list:todo`, `fd:list:groceries`, and `fd:ics` store local copies. Demo data uses `fd:demo:…`. |

To view or edit stored data, open **Storage & databases → Workers KV →
family-dashboard-data → KV Pairs** (or the namespace bound as `DATA` if renamed).
Select a key to inspect or edit its value; use its delete action to remove it.
Check **Worker → Settings → Bindings → DATA** for the namespace
name if unsure.

![Cloudflare Storage and databases menu: Workers KV and the data namespace; account name redacted](docs/images/cloudflare-kv-redacted.png)

Back up lists by securely exporting or copying their KV values before changing or
deleting data. The app has no list history or automatic backups. Browser copies
are for offline display, not a dependable backup. Clearing site data removes the
saved password and local copies; it does not delete shared KV data. KV propagation
and app polling can delay updates between devices.

## Run and deploy

Use a Node.js version supported by `package.json`.

```bash
npm ci
npm start       # Development server at http://localhost:4200
npm test        # Unit tests
npm run build   # Production output: dist/family-dashboard/browser
```

For local demo use, temporarily set `workerUrl` to an empty string. Open
`?mode=frame` for the wall display. On a connected device, enter the family token
in the app when prompted; the browser remembers it. Configure a kiosk browser to
open the frontend URL with `?mode=frame` for a permanent display.

- **Frontend:** GitHub repository → **Settings → Pages**, with **GitHub Actions**
  as the source. Inspect [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
  and its latest run under **Actions** when checking deployment. A push to `main`
  installs dependencies, runs tests, builds Angular with the Pages base path, and
  publishes `dist/family-dashboard/browser`.
- **Worker:** update `worker/worker.js`, then open
  [**Workers & Pages**](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
  → **family-dashboard → Edit code**, paste the code, and select **Deploy**.
  Review releases under **family-dashboard → Deployments**.
  Frontend pushes do not deploy the Worker. CLI deployment is
  also possible after configuring `worker/wrangler.toml`.

See [`docs/setup-guide-en.md`](docs/setup-guide-en.md) for initial setup.

## Routine maintenance

| Task or symptom | Action |
|---|---|
| Rotate the shared password | Replace `FAMILY_TOKEN` in Cloudflare, then enter the new token on each device when prompted. Keep a copy in a password manager. |
| Change the calendar | Replace `ICLOUD_ICS_URL` in Cloudflare. Delete `cache:calendar` from KV to force a fresh fetch on the next request. Existing browser copies may remain until refreshed. |
| Token repeatedly rejected | Check the entered value against the configured `FAMILY_TOKEN`; replace the secret if needed. |
| Offline or stale data | Check `workerUrl`, Worker availability, `DATA`, and `ALLOWED_ORIGIN`. For calendar problems, check that the iCloud public link still works. |
| Demo data on the published site | Set `workerUrl`, rebuild, and deploy the frontend. |
| Failed deployment or blank page | Read the GitHub Actions logs and browser console; check the Angular build output and Pages base path. |
| Update dependencies | Update the package files together, run tests and a production build, and check the app locally before deploying. |
| Wall display shows an old version | Reload the kiosk browser; keep its browser/WebView updated. |

## Keep private

Never commit real tokens, calendar subscription links, personal calendar/list
contents, or data exports. Configuration names and storage keys are maintenance
references, not credentials. The Worker URL is public frontend configuration;
avoid adding account-specific addresses to documentation unnecessarily.

Anyone with the family token can read the calendar and change lists. Anyone with
the public iCloud subscription link can read that calendar directly, independently
of the Worker token. Treat both values as secrets. Browser storage also contains
the token and cached personal data, so use trusted devices and clear site data
when retiring one. Rotating the token does not erase previously cached data.
