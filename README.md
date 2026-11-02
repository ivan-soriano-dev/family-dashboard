# Panel familiar

Pantalla con reloj, calendario familiar de Apple, lista de tareas y lista de la compra.
Se ve en un marco de fotos Android y se edita desde los móviles.

Este documento es un mapa para mantener la aplicación: qué piezas existen, dónde está
cada una y qué tocar para cada cambio. La guía de instalación paso a paso (en inglés)
está en [`docs/setup-guide-en.md`](docs/setup-guide-en.md).

> **Este repositorio es público y no contiene ningún secreto.** El enlace del
> calendario de iCloud y la contraseña familiar (token) solo están guardados en
> Cloudflare y en los dispositivos. No los añadas nunca a este repositorio, ni a
> issues ni a commits.

---

## Cómo encaja todo

```
 Móviles (editan) ──┐                         ┌──► iCloud: calendario público (.ics)
                    ├──► Worker de Cloudflare ─┤
 Marco (muestra) ───┘    (worker.js)           └──► Cloudflare KV: listas + copia del calendario
        ▲
        └── página estática en GitHub Pages (index.html)
```

Hay **cuatro sitios** donde vive algo:

| Sitio | Qué hay | Cómo se cambia |
|---|---|---|
| **GitHub** (este repositorio) | La página, sus estilos, iconos y una copia del código del Worker | Editar archivos y hacer commit; se publica solo |
| **Cloudflare** | El Worker en funcionamiento, sus secretos y los datos de las listas | Panel de Cloudflare |
| **iCloud** | El calendario familiar, compartido como calendario público | App Calendario (iPhone o Mac) |
| **Dispositivos** | El token y una copia de los datos en cada navegador; la app de quiosco en el marco | En cada dispositivo |

---

## 1. GitHub: este repositorio

### Archivos

| Archivo | Para qué sirve | ¿Se edita a mano? |
|---|---|---|
| `index.html` | La página completa: estructura, colores, ajustes, textos y lógica | Sí, es el archivo principal |
| `tailwind.css` | Estilos generados por Tailwind | **No.** Lo genera la GitHub Action |
| `tailwind.config.js` | Nombres de colores, puntos de corte (`wall:`) y variantes (`frame:`, `hover-hover:`) | Solo para cambiar el sistema de estilos |
| `src/tailwind.input.css` | Fuente de Tailwind y clases compartidas (`.panel`, `.panel-head`…) | Rara vez |
| `manifest.webmanifest` | Nombre, colores e iconos para «Añadir a pantalla de inicio» (Android) | Si cambia el nombre o el icono |
| `icons/` | Icono de la casa: `icon.svg` (pestaña), `apple-touch-icon.png` (iPhone), `icon-192.png` e `icon-512.png` (Android) | Si cambia el icono |
| `.github/workflows/pages.yml` | Genera `tailwind.css` y publica la web en cada commit | Rara vez (versiones de acciones) |
| `worker/worker.js` | **Copia** del código del Worker | Sí, pero hay que copiarlo a Cloudflare después (ver sección 2) |
| `worker/wrangler.toml` | Configuración para desplegar el Worker por línea de comandos | Solo si se usa `wrangler` |
| `docs/setup-guide-en.md` | Guía de instalación completa (inglés) | Si cambia la instalación |

La carpeta `.github` está oculta en el Finder de macOS (se muestra con **⌘ Mayús .**).

### Dentro de `index.html`

Todo lo configurable está agrupado en bloques con comentarios:

| Bloque | Dónde | Qué controla |
|---|---|---|
| `THEME` | Primer `<script>` en `<head>` | **Color principal** (`primary`). El resto de tonos se calcula solo |
| `<style>` con `:root` y `.dark` | Justo debajo | Colores de fondos, bordes y textos (modo claro y oscuro), en formato `R G B` |
| Enlaces `rel="icon"`, `apple-touch-icon`, `manifest` | `<head>` | Favicon e iconos de pantalla de inicio |
| `CONFIG` | Primer `<script>` al final de `<body>` | Dirección del Worker, idioma, días del calendario, frecuencias de refresco, horario nocturno del marco, **todos los textos** |
| `UI` | Justo debajo de `CONFIG` | Clases de Tailwind de lo que dibuja el script (eventos, elementos de las listas, botones) |
| Resto del script | Después de `UI` | Lógica: reloj, calendario, listas, sincronización |

Ajustes de `CONFIG`:

| Ajuste | Valor actual | Efecto |
|---|---|---|
| `WORKER_URL` | dirección `…workers.dev` | Vacío = modo demo (datos de ejemplo, sin Worker) |
| `LOCALE` | `'en-GB'` | Formato de fecha y hora (`'es-ES'` para español) |
| `DAYS_AHEAD` | `7` | Días que muestra el calendario |
| `LIST_REFRESH_SEC` | `30` | Cada cuánto se comprueban las listas |
| `CALENDAR_REFRESH_MIN` | `10` | Cada cuánto se comprueba el calendario |
| `FRAME_RELOAD_HOURS` | `6` | Recarga completa del marco |
| `NIGHT` | 23 h → 7 h, `0.8` | Oscurecimiento nocturno en el marco (`dim: 0` lo desactiva) |
| `TEXT` | inglés | Todas las palabras de la pantalla |

### Publicación (GitHub Pages)

- **Dónde:** repositorio → **Settings → Pages**. *Source* debe ser **GitHub Actions**.
- **Cómo:** cada commit en `main` lanza la acción «Deploy to GitHub Pages» (pestaña
  **Actions**). Tarda 1–2 minutos; tick verde = publicado.
- **Dirección:** `https://<usuario>.github.io/<repositorio>/`
- **Requisito:** el repositorio debe ser **público** para usar Pages gratis.

---

## 2. Cloudflare: el Worker y los datos

Todo está en la cuenta de Cloudflare de la familia (<https://dash.cloudflare.com>).

### El Worker `family-dashboard`

- **Dónde:** **Compute → Workers & Pages → family-dashboard**.
- **Dirección:** `https://family-dashboard.<subdominio>.workers.dev` (también en
  **Settings → Domains & Routes**).
- **Qué hace:**
  - Comprueba el token de cada petición.
  - Descarga el calendario de iCloud y guarda una copia durante 15 minutos.
  - Lee y guarda las listas.

Rutas que responde (todas requieren la cabecera `X-Family-Token`):

| Ruta | Método | Respuesta |
|---|---|---|
| `/calendar` | GET | Calendario en formato `.ics` |
| `/lists/todo`, `/lists/groceries` | GET | La lista en JSON |
| `/lists/todo`, `/lists/groceries` | POST | Aplica un cambio: `add`, `toggle`, `edit`, `delete`, `clearDone`, `clear` |

**Configuración del Worker** (**family-dashboard → Settings**):

| Tipo | Nombre | Contenido | Dónde está el valor real |
|---|---|---|---|
| Binding KV | `DATA` | Namespace `family-dashboard-data` | Settings → Bindings |
| Secreto | `ICLOUD_ICS_URL` | Enlace público del calendario (`webcal://…`) | Solo en Cloudflare (no se puede volver a ver; se reemplaza) |
| Secreto | `FAMILY_TOKEN` | Contraseña familiar | Solo en Cloudflare y en el gestor de contraseñas de la familia |
| Variable | `ALLOWED_ORIGIN` | `https://<usuario>.github.io` (sin barra final) | Settings → Variables and Secrets |

> ⚠️ **El código del Worker se pega a mano.** Cloudflare no lee este repositorio.
> Tras cambiar `worker/worker.js`: **Edit code** → pegar → **Deploy**. Los secretos
> y los datos no se pierden al hacerlo.

### Los datos: KV `family-dashboard-data`

- **Dónde:** **Storage & databases → KV → family-dashboard-data → KV Pairs**.
  Desde ahí se pueden ver, editar, copiar o borrar las claves.

| Clave | Contenido | Se actualiza |
|---|---|---|
| `list:todo` | Lista de tareas (JSON) | Con cada cambio en la lista |
| `list:groceries` | Lista de la compra (JSON) | Con cada cambio en la lista |
| `cache:calendar` | Última copia del calendario + hora de descarga | Como mucho cada 15 minutos |

Formato de una lista:

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
- El enlace que se genera es lo que se guarda en `ICLOUD_ICS_URL`.
- Si se desactiva **Calendario público**, el enlace deja de funcionar. El panel sigue
  mostrando la última copia guardada.
- **Si se crea un enlace nuevo**, hay que reemplazar el secreto `ICLOUD_ICS_URL` en
  Cloudflare.

---

## 4. Dispositivos

### Móviles

- **Uso:** icono «Family» en la pantalla de inicio.
  - **iPhone:** Safari → Compartir → **Añadir a pantalla de inicio**.
  - **Android:** Chrome → ⋮ → **Añadir a pantalla de inicio**.
- **Primera vez:** abrir `https://<usuario>.github.io/<repositorio>/#token=<TOKEN>` o
  escribir el token cuando lo pida. En iPhone, la app de la pantalla de inicio guarda
  sus datos aparte de Safari, así que pide el token una vez más.
- **Qué guarda el navegador** (localStorage, claves `fd:…`):

  | Clave | Contenido |
  |---|---|
  | `fd:token` | El token |
  | `fd:list:todo`, `fd:list:groceries` | Última copia de cada lista |
  | `fd:ics` | Última copia del calendario |
  | `fd:demo:…` | Solo en modo demo |

### Marco de fotos

- **Dónde:** opciones de desarrollador activadas, con una app de quiosco (p. ej.
  Fully Kiosk Browser).
- **Dirección de inicio:** `https://<usuario>.github.io/<repositorio>/?mode=frame#token=<TOKEN>`
- **Ajustes de la app de quiosco:** arrancar al encender, pantalla siempre encendida,
  pantalla completa.
- **El modo marco:**
  - muestra siempre el tema oscuro,
  - oculta los botones de edición,
  - se oscurece de noche,
  - se mueve unos píxeles cada hora contra el quemado de pantalla,
  - y se recarga cada 6 horas.
- **Si se queda en blanco:** actualizar **Android System WebView**.

---

## 5. Dependencias externas

| Qué | Versión | Dónde se usa | Si falla |
|---|---|---|---|
| [ical.js](https://github.com/kewisch/ical.js) | 1.5.0 (jsDelivr) | `index.html`, interpreta el calendario | El calendario muestra «Calendar unavailable» |
| Fuente Inter | Google Fonts | `index.html` | Se usa la fuente del sistema |
| Tailwind CSS | 3.4.17 | GitHub Action | La publicación falla (cruz roja en Actions) |
| GitHub Actions | `checkout@v4`, `setup-node@v4` (Node 22), `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4` | `pages.yml` | Actualizar versiones si GitHub avisa |

Tailwind se mantiene en la **v3** a propósito: su CSS funciona en los navegadores
antiguos de los marcos Android. La v4 necesita navegadores recientes.

---

## 6. Tareas habituales

| Quiero… | Qué hacer |
|---|---|
| Cambiar el color principal | `index.html` → `THEME.primary` → commit |
| Cambiar textos o idioma | `index.html` → `CONFIG.TEXT` y `CONFIG.LOCALE` → commit |
| Cambiar frecuencias de refresco o el horario nocturno | `index.html` → `CONFIG` → commit |
| Cambiar el diseño o añadir clases | `index.html` (HTML o bloque `UI`) → commit. La Action regenera `tailwind.css` |
| Probar en local | Abrir `index.html` (modo demo si `WORKER_URL` está vacío). Con estilos nuevos: `npx tailwindcss@3.4.17 -i src/tailwind.input.css -o tailwind.css --watch` |
| Cambiar el icono | Reemplazar los archivos de `icons/` (mismos nombres y tamaños) → commit. En los móviles, borrar el icono y añadirlo de nuevo |
| Cambiar el token | Cloudflare → Worker → Settings → Variables and Secrets → editar `FAMILY_TOKEN`. Después, abrir el enlace con el token nuevo en cada dispositivo y actualizar la dirección del marco |
| Cambiar el calendario | Generar el enlace público en iCloud → reemplazar `ICLOUD_ICS_URL` en Cloudflare |
| Cambiar el código del Worker | Editar `worker/worker.js` → commit → pegarlo en Cloudflare (**Edit code → Deploy**) |
| Copia de seguridad de las listas | Cloudflare → KV → `family-dashboard-data` → copiar el valor de `list:todo` y `list:groceries` |
| Vaciar o corregir una lista a mano | Cloudflare → KV → editar o borrar la clave |
| Forzar que el calendario se descargue ya | Cloudflare → KV → borrar `cache:calendar` |
| Ver la versión nueva en el marco ya | Reiniciar la app de quiosco o usar su botón de recargar |

---

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pide el token una y otra vez | El token no coincide con `FAMILY_TOKEN` | Revisarlo (mayúsculas, espacios) |
| «Offline, showing the last saved copy» | No llega al Worker | Revisar `WORKER_URL` en `index.html` y que `ALLOWED_ORIGIN` sea exactamente `https://<usuario>.github.io` |
| «Calendar unavailable» | El enlace de iCloud ya no es público o no se pudo leer | Revisar **Calendario público**; reemplazar `ICLOUD_ICS_URL` si cambió |
| Los eventos salen a otra hora | Zona horaria del dispositivo | Ajustes de fecha y hora del marco o del móvil |
| Un cambio tarda en aparecer en otro dispositivo | Propagación de KV (hasta ~60 s) o refresco de 30 s | Normal; esperar |
| Cruz roja en **Actions** | Falla la generación de Tailwind o la publicación | Abrir la ejecución y leer el error |
| La web muestra la versión antigua | Caché de GitHub Pages (hasta ~10 min) | Esperar y recargar |
| El marco se queda en blanco | WebView muy antiguo | Actualizar **Android System WebView** |

---

## 8. Seguridad, en resumen

- **El token** protege el calendario y las listas. Quien lo tenga puede ver el
  calendario y cambiar las listas.
- **`ALLOWED_ORIGIN`** solo limita qué web puede usar el Worker desde un navegador.
  No sustituye al token.
- **El token viaja después de `#`** en la dirección, que los navegadores nunca envían
  a GitHub.
- **Para retirar todo:**
  1. desactivar **Calendario público** en iCloud,
  2. borrar el namespace KV,
  3. borrar el Worker,
  4. borrar o hacer privado este repositorio.
