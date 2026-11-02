# Panel familiar

Pantalla con reloj, calendario familiar de Apple, lista de tareas y lista de la compra.
Se ve en un marco de fotos Android y se edita desde los móviles.

Hecha con **Angular 22** (componentes standalone, signals, sin zone.js) y **Tailwind CSS 4**.
Se publica gratis en GitHub Pages; los datos compartidos viven en un Worker gratuito de
Cloudflare.

Este documento es un mapa para mantener la aplicación: qué piezas existen, dónde está
cada una y qué tocar para cada cambio. La guía de instalación paso a paso (en inglés)
está en [`docs/setup-guide-en.md`](docs/setup-guide-en.md).

> **Este repositorio es público y no contiene ningún secreto.** El enlace del
> calendario de iCloud y la contraseña familiar (token) solo están en Cloudflare y en
> los dispositivos. No los añadas nunca al código, a issues ni a commits.

---

## Cómo encaja todo

```
 Móviles (editan) ──┐                          ┌──► iCloud: calendario público (.ics)
                    ├──► Worker de Cloudflare ──┤
 Marco (muestra) ───┘    (worker/worker.js)     └──► Cloudflare KV: listas + copia del calendario
        ▲
        └── app Angular compilada, publicada en GitHub Pages
```

| Sitio | Qué hay | Cómo se cambia |
|---|---|---|
| **GitHub** (este repositorio) | El código de la app, iconos, tests y una copia del código del Worker | Commit en `main`: la GitHub Action prueba, compila y publica |
| **Cloudflare** | El Worker en funcionamiento, sus secretos y los datos de las listas | Panel de Cloudflare |
| **iCloud** | El calendario familiar, compartido como calendario público | App Calendario (iPhone o Mac) |
| **Dispositivos** | El token y una copia de los datos en cada navegador; la app de quiosco en el marco | En cada dispositivo |

---

## 1. GitHub: este repositorio

### Lo que se edita normalmente

| Quiero cambiar… | Archivo |
|---|---|
| Dirección del Worker, **color principal**, idioma, días del calendario, frecuencias de refresco, horario nocturno, **todos los textos** | [`src/app/settings.ts`](src/app/settings.ts) |
| Colores de fondos, bordes y textos (claro/oscuro), fuente, punto de corte `wall:` | [`src/styles.css`](src/styles.css) |
| Distribución de la pantalla | [`src/app/app.html`](src/app/app.html) |
| Iconos, nombre de la app en el móvil | [`public/icons/`](public/icons), [`public/manifest.webmanifest`](public/manifest.webmanifest), [`src/index.html`](src/index.html) |

### Mapa del código (`src/app/`)

| Carpeta / archivo | Qué hace |
|---|---|
| `settings.ts` | **Ajustes** (ver tabla de abajo). Se inyecta como `APP_SETTINGS` |
| `app.ts`, `app.html` | Componente raíz: distribución en móvil (una columna) y en pantalla ancha (3 columnas) |
| `app.config.ts` | Arranque: `HttpClient` con `fetch`, interceptor del token y aplicación del tema |
| **`core/`** | Servicios compartidos |
| `core/display-mode.ts` | Modo marco (`?mode=frame`), claro/oscuro, colores del tema, oscurecimiento nocturno, desplazamiento anti-quemado, recarga periódica |
| `core/palette.ts` | Calcula, a partir del color principal, el color del texto sobre él y tonos legibles (contraste 4.5:1) |
| `core/clock.ts` | Hora actual como signal (cambia cada minuto) y el día de hoy |
| `core/family-token.ts` | Token familiar: lo lee de `#token=…`, lo guarda y decide cuándo pedirlo |
| `core/worker-api.ts` | Llamadas al Worker (calendario y listas), con límite de 15 s; avisa al estado y al token |
| `core/worker-interceptor.ts` | Añade la cabecera `X-Family-Token` a las peticiones al Worker |
| `core/sync-status.ts` | «Updated 18:42» / «Offline…» |
| `core/local-store.ts` | Acceso seguro a `localStorage` (claves `fd:…`) |
| `core/format.ts` | Formato de fecha y hora con `Intl` |
| **`calendar/`** | Calendario |
| `calendar/calendar-events.ts` | Lógica pura: interpreta el `.ics` (repeticiones, excepciones, zonas horarias) y agrupa por días. Eventos de demo |
| `calendar/calendar-store.ts` | Descarga el calendario, lo guarda en el dispositivo y expone los días a mostrar |
| `calendar/agenda.ts`, `.html` | Panel «Calendar» |
| **`lists/`** | Listas compartidas |
| `lists/list-model.ts` | Tipos y lógica pura de los cambios (`add`, `toggle`, `edit`, `delete`, `clearDone`, `clear`) |
| `lists/lists-store.ts` | Estado de las dos listas: cambio inmediato en pantalla, envío al Worker, refresco periódico |
| `lists/list-panel.ts`, `.html` | Panel de una lista: elementos, añadir, «Clear list» (doble toque) y «Remove completed» |
| **`shell/`** | Piezas de la pantalla |
| `shell/clock-face.ts` | Reloj grande y fecha |
| `shell/token-dialog.ts` | Diálogo «Enter the family token» |
| `shell/status-line.ts` | Texto de estado en la esquina |
| `*.spec.ts` | Tests unitarios (Vitest) |

### Ajustes de `src/app/settings.ts`

| Ajuste | Valor actual | Efecto |
|---|---|---|
| `workerUrl` | `''` | Dirección `…workers.dev`. Vacío = modo demo (datos de ejemplo, nada compartido) |
| `primaryColor` | `'#ecd8dc'` | Color principal. Los demás tonos se calculan solos* |
| `locale` | `'en-GB'` | Formato de fecha y hora (`'es-ES'` para español) |
| `daysAhead` | `7` | Días que muestra el calendario |
| `listRefreshSeconds` | `30` | Cada cuánto se comprueban las listas |
| `calendarRefreshMinutes` | `10` | Cada cuánto se comprueba el calendario |
| `frameReloadHours` | `6` | Recarga completa del marco (`0` la desactiva) |
| `night` | 23 h → 7 h, `0.8` | Oscurecimiento nocturno del marco (`dim: 0` lo desactiva) |
| `text` | inglés | Todas las palabras de la pantalla |

\* Al cambiar `primaryColor`, actualiza también los cuatro valores `--primary`,
`--on-primary`, `--accent-light` y `--accent-dark` al principio de `src/styles.css`.
Solo se usan durante el primer instante de carga; si no se cambian, la app sigue
funcionando con el color nuevo.

### Otros archivos

| Archivo | Para qué sirve |
|---|---|
| `src/styles.css` | Tailwind 4: variables de color, nombres de color (`bg-primary`, `text-fg-3`…), variante `frame:`, punto de corte `wall:` y clases compartidas (`panel`, `field`, `primary-button`…) |
| `src/index.html` | Página base: título, iconos, manifest |
| `public/` | Se copia tal cual a la web: `icons/` y `manifest.webmanifest` |
| `angular.json`, `tsconfig*.json`, `.postcssrc.json` | Configuración de Angular, TypeScript y Tailwind (rara vez se tocan) |
| `package.json`, `package-lock.json` | Dependencias con **versiones exactas** |
| `.github/workflows/pages.yml` | En cada commit en `main`: instala, ejecuta los tests, compila y publica |
| `.github/dependabot.yml` | Propone actualizaciones mensuales de dependencias (esperando 14 días tras cada versión nueva) |
| `worker/worker.js` | **Copia** del código del Worker (ver sección 2) |
| `worker/wrangler.toml` | Para desplegar el Worker por línea de comandos (opcional) |
| `docs/setup-guide-en.md` | Guía de instalación (inglés) |

Las carpetas `.github` y otros archivos que empiezan por punto están ocultos en el
Finder de macOS (se muestran con **⌘ Mayús .**).

### Trabajar en local

Requiere **Node.js 24** (o 22.22.3+).

```bash
npm ci          # instalar las versiones exactas
npm start       # http://localhost:4200, se recarga al guardar
npm test        # tests unitarios
npm run build   # compilación de producción en dist/family-dashboard/browser
```

Con `workerUrl` vacío, la app funciona en modo demo. Para probar el modo marco:
`http://localhost:4200/?mode=frame`.

### Publicación (GitHub Pages)

- **Dónde:** repositorio → **Settings → Pages**. *Source* debe ser **GitHub Actions**.
- **Cómo:** cada commit en `main` lanza «Deploy to GitHub Pages» (pestaña **Actions**).
  Tarda 2–3 minutos; tick verde = publicado. Si un test falla, no se publica nada y la
  versión anterior sigue en línea.
- **Dirección:** `https://<usuario>.github.io/<repositorio>/`. La Action ajusta sola la
  ruta base con el nombre del repositorio.
- **Requisito:** el repositorio debe ser **público** para usar Pages gratis.

---

## 2. Cloudflare: el Worker y los datos

Todo está en la cuenta de Cloudflare de la familia (<https://dash.cloudflare.com>).
El Worker es el mismo que en la versión anterior de la app; no cambió al pasar a Angular.

### El Worker `family-dashboard`

- **Dónde:** **Compute → Workers & Pages → family-dashboard**.
- **Dirección:** `https://family-dashboard.<subdominio>.workers.dev` (también en
  **Settings → Domains & Routes**). Es el valor de `workerUrl`.
- **Qué hace:**
  - Comprueba el token de cada petición.
  - Descarga el calendario de iCloud y guarda una copia durante 15 minutos.
  - Lee y guarda las listas.

| Ruta | Método | Respuesta |
|---|---|---|
| `/calendar` | GET | Calendario en formato `.ics` |
| `/lists/todo`, `/lists/groceries` | GET | La lista en JSON |
| `/lists/todo`, `/lists/groceries` | POST | Aplica un cambio: `add`, `toggle`, `edit`, `delete`, `clearDone`, `clear` |

Todas las rutas requieren la cabecera `X-Family-Token`.

**Configuración** (**family-dashboard → Settings**):

| Tipo | Nombre | Contenido | Dónde está el valor real |
|---|---|---|---|
| Binding KV | `DATA` | Namespace `family-dashboard-data` | Settings → Bindings |
| Secreto | `ICLOUD_ICS_URL` | Enlace público del calendario (`webcal://…`) | Solo en Cloudflare (no se puede volver a ver; se reemplaza) |
| Secreto | `FAMILY_TOKEN` | Contraseña familiar | Solo en Cloudflare y en el gestor de contraseñas de la familia |
| Variable | `ALLOWED_ORIGIN` | `https://<usuario>.github.io` (sin barra final) | Settings → Variables and Secrets |

> ⚠️ **El código del Worker se pega a mano.** Cloudflare no lee este repositorio.
> Tras cambiar `worker/worker.js`: **Edit code** → pegar → **Deploy**. Los secretos y
> los datos no se pierden al hacerlo.

### Los datos: KV `family-dashboard-data`

- **Dónde:** **Storage & databases → KV → family-dashboard-data → KV Pairs**.
  Desde ahí se pueden ver, editar, copiar o borrar las claves.

| Clave | Contenido | Se actualiza |
|---|---|---|
| `list:todo` | Lista de tareas (JSON) | Con cada cambio |
| `list:groceries` | Lista de la compra (JSON) | Con cada cambio |
| `cache:calendar` | Última copia del calendario + hora de descarga | Como mucho cada 15 minutos |

```json
{ "items": [ { "id": "…", "text": "Leche", "done": false, "at": 1793618006696 } ],
  "updated": 1793618020000 }
```

- Los datos son permanentes y no caducan.
- No hay historial: lo que se borra, desaparece. Para hacer una copia de seguridad,
  copia el valor de la clave.
- Los cambios pueden tardar hasta ~60 s en llegar a todos los dispositivos.
- **Límites gratuitos:** 100 000 lecturas y 1 000 escrituras al día. Un marco
  encendido todo el día usa unas 6 000 lecturas.

---

## 3. iCloud: el calendario

- **Dónde:** iPhone → **Calendario → Calendarios → (i)** junto al calendario familiar
  → **Calendario público**. En Mac: clic derecho en el calendario → **Compartir**.
- El enlace generado es el secreto `ICLOUD_ICS_URL`.
- Si se desactiva **Calendario público**, el enlace deja de funcionar. El panel sigue
  mostrando la última copia guardada.
- **Si se crea un enlace nuevo**, hay que reemplazar el secreto en Cloudflare.

---

## 4. Dispositivos

### Móviles

- **Uso:** icono «Family» en la pantalla de inicio.
  - **iPhone:** Safari → Compartir → **Añadir a pantalla de inicio**.
  - **Android:** Chrome → ⋮ → **Añadir a pantalla de inicio**.
- **Primera vez:** abrir `https://<usuario>.github.io/<repositorio>/#token=<TOKEN>` o
  escribir el token cuando lo pida. En iPhone, la app de la pantalla de inicio guarda
  sus datos aparte de Safari, así que pide el token una vez más.
- **Qué guarda el navegador** (localStorage):

  | Clave | Contenido |
  |---|---|
  | `fd:token` | El token |
  | `fd:list:todo`, `fd:list:groceries` | Última copia de cada lista |
  | `fd:ics` | Última copia del calendario |
  | `fd:demo:…` | Solo en modo demo |

  Son las mismas claves que en la versión anterior, así que los dispositivos ya
  configurados no tienen que volver a meter el token.

### Marco de fotos (pendiente de comprar)

- **Requisito:** Android **10 o superior**, con **Android System WebView** actualizable.
  Angular necesita un navegador de los últimos ~2,5 años; Chrome ya no se actualiza en
  Android 9 o anterior.
- **Configuración:**
  1. Activar las opciones de desarrollador.
  2. Instalar una app de quiosco (p. ej. Fully Kiosk Browser).
  3. Poner como dirección de inicio
     `https://<usuario>.github.io/<repositorio>/?mode=frame#token=<TOKEN>`.
  4. Activar: arrancar al encender, pantalla siempre encendida, pantalla completa.
- **El modo marco:**
  - muestra siempre el tema oscuro,
  - oculta los botones de edición (tocar un elemento sigue marcándolo),
  - se oscurece de noche,
  - se mueve unos píxeles cada hora contra el quemado de pantalla,
  - y se recarga cada 6 horas.

---

## 5. Dependencias

Todas con versión exacta en `package.json`. Cada versión se eligió con al menos dos
semanas desde su publicación.

| Qué | Versión | Uso |
|---|---|---|
| Angular (`@angular/*`) | 22.2.3 | Framework |
| TypeScript | 6.0.3 | Lenguaje (la versión la marca Angular) |
| Tailwind CSS (`tailwindcss`, `@tailwindcss/postcss`) | 4.3.3 | Estilos |
| [ical.js](https://github.com/kewisch/ical.js) | 2.2.1 | Interpretar el calendario |
| `@fontsource-variable/inter` | 5.3.0 | Fuente Inter, servida desde la propia web (sin Google Fonts) |
| RxJS, tslib | 7.8.2, 2.8.1 | Requeridos por Angular |
| Vitest, jsdom | 5.0.5, 30.1.3 | Tests |
| Prettier | 3.9.10 | Formato del código (`npx prettier --write src`) |
| Node.js (Action y local) | 24 | Compilación |
| GitHub Actions | `checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4` | Publicación |

**Actualizar:**
- Dependabot abre pull requests mensuales. Si la Action pasa en verde (tests +
  compilación), se pueden fusionar.
- Para saltar de versión mayor de Angular, usar `npx ng update @angular/core @angular/cli`
  en local, ejecutar `npm test` y `npm start`, y hacer commit.
- Cada versión mayor de Angular tiene soporte unos 18 meses.

---

## 6. Tareas habituales

| Quiero… | Qué hacer |
|---|---|
| Cambiar el color principal | `settings.ts` → `primaryColor` (y los 4 valores por defecto de `styles.css`) → commit |
| Cambiar textos o idioma | `settings.ts` → `text` y `locale` → commit |
| Cambiar frecuencias de refresco o el horario nocturno | `settings.ts` → commit |
| Cambiar el diseño | Plantillas `.html` / `template` de los componentes, o `app.html` → commit |
| Cambiar colores de fondo o de texto | `styles.css` → bloques `:root` (claro) y `.dark` (oscuro) |
| Cambiar el icono | Reemplazar los archivos de `public/icons/` (mismos nombres y tamaños) → commit. En los móviles, borrar el icono y añadirlo de nuevo |
| Cambiar el token | Cloudflare → Worker → Settings → editar `FAMILY_TOKEN`. Después, abrir el enlace con el token nuevo en cada dispositivo y actualizar la dirección del marco |
| Cambiar el calendario | Generar el enlace público en iCloud → reemplazar `ICLOUD_ICS_URL` en Cloudflare |
| Cambiar el código del Worker | Editar `worker/worker.js` → commit → pegarlo en Cloudflare (**Edit code → Deploy**). Si cambian las rutas o el formato, actualizar también `core/worker-api.ts` y `lists/list-model.ts` |
| Copia de seguridad de las listas | Cloudflare → KV → copiar el valor de `list:todo` y `list:groceries` |
| Vaciar o corregir una lista a mano | Cloudflare → KV → editar o borrar la clave |
| Forzar que el calendario se descargue ya | Cloudflare → KV → borrar `cache:calendar` |
| Ver la versión nueva en el marco ya | Reiniciar la app de quiosco o usar su botón de recargar |

---

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pide el token una y otra vez | No coincide con `FAMILY_TOKEN` | Revisarlo (mayúsculas, espacios) |
| «Offline, showing the last saved copy» | No llega al Worker | Revisar `workerUrl` en `settings.ts` y que `ALLOWED_ORIGIN` sea exactamente `https://<usuario>.github.io` |
| «Calendar unavailable» | El `.ics` no se pudo interpretar | Revisar **Calendario público**; reemplazar `ICLOUD_ICS_URL` si cambió |
| «Demo mode…» en la web publicada | `workerUrl` vacío | Rellenarlo en `settings.ts` y hacer commit |
| Página en blanco tras publicar | Ruta base incorrecta o error de JavaScript | Abrir la consola del navegador; comprobar que la web se abre en `/<repositorio>/` |
| Cruz roja en **Actions** | Falla un test o la compilación | Abrir la ejecución y leer el error; la versión anterior sigue publicada |
| Los eventos salen a otra hora | Zona horaria del dispositivo | Ajustes de fecha y hora |
| Un cambio tarda en aparecer en otro dispositivo | Propagación de KV (hasta ~60 s) o refresco de 30 s | Normal; esperar |
| La web muestra la versión antigua | Caché de GitHub Pages (hasta ~10 min) | Esperar y recargar |
| El marco se queda en blanco | WebView demasiado antiguo | Actualizar **Android System WebView** (requiere Android 10+) |

---

## 8. Seguridad, en resumen

- **El token** protege el calendario y las listas. Quien lo tenga puede ver el
  calendario y cambiar las listas.
- **`ALLOWED_ORIGIN`** solo limita qué web puede usar el Worker desde un navegador.
  No sustituye al token.
- **El token viaja después de `#`** en la dirección, que los navegadores nunca envían a
  GitHub, y la app lo borra de la barra de direcciones al leerlo.
- **La app no carga nada de terceros:** la fuente y las librerías van dentro de la
  compilación.
- **Para retirar todo:**
  1. desactivar **Calendario público** en iCloud,
  2. borrar el namespace KV,
  3. borrar el Worker,
  4. borrar o hacer privado este repositorio.
