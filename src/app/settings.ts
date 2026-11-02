import { InjectionToken } from "@angular/core";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SETTINGS – the only file you normally need to edit.
 *  Change a value, commit, and the GitHub Action rebuilds and publishes the site.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SETTINGS: Settings = {
  /** Cloudflare Worker address. Leave empty to run in demo mode (sample data, nothing shared). */
  workerUrl:
    "https://family-dashboard.cuenta-familia-soriano-navarro.workers.dev/",

  /**
   * Primary colour (any hex colour). Button text and readable text shades are worked out
   * automatically. Also update the two default values at the top of src/styles.css so the
   * very first paint uses the same colour.
   */
  primaryColor: "#c8a2c8",

  /** Date and time format, e.g. 'es-ES', 'fr-FR', 'en-US'. */
  locale: "en-ES",

  /** Weather for Loriguilla (CP 46393), using the free Open-Meteo API. */
  weather: {
    latitude: 39.49,
    longitude: -0.57,
    location: "Loriguilla · 46393",
    timeZone: "Europe/Madrid",
    refreshMinutes: 15,
  },

  /** How many days the calendar shows. */
  daysAhead: 15,

  /** How often the lists are re-checked (seconds). */
  listRefreshSeconds: 30,

  /** How often the calendar is re-checked (minutes). The Worker itself caches it for 15 minutes. */
  calendarRefreshMinutes: 120,

  /** Full page reload on the photo frame (hours). 0 disables it. */
  frameReloadHours: 6,

  /** Night dimming on the photo frame. Set dim to 0 to disable. */
  night: { from: 23, to: 7, dim: 0.8 },

  /** Every word shown on screen. */
  text: {
    home: "Home",
    openNavigation: "Abrir navegación",
    closeNavigation: "Cerrar navegación",
    menu: "Menú",
    menuHelp: "Cena de lunes a viernes · Comida y cena el fin de semana",
    lunch: "Comida",
    dinner: "Cena",
    previousWeek: "Semana anterior",
    nextWeek: "Semana siguiente",
    thisWeek: "Esta semana",
    loadingMenu: "Cargando el menú…",
    mealAudience: "¿Para quién? (opcional)",
    mealAudiencePlaceholder: "Niñas, adultos, todos…",
    mealPlaceholder: "¿Qué vamos a comer?",
    noMeal: "Sin decidir",
    addMeal: "Añadir plato",
    editMeal: "Editar plato",
    clearMealHelp: "Deja el campo vacío para eliminar el plato.",
    savingMeal: "Guardando…",
    cancel: "Cancelar",
    eatingOut: "Comemos fuera",
    menuChangeError: "No se pudo guardar el cambio. Inténtalo de nuevo.",
    menuSaveError:
      "No se pudo guardar. Tu texto sigue aquí; inténtalo de nuevo.",
    calendar: "Calendario",
    todo: "Tareas",
    groceries: "Lista de la compra",
    today: "Hoy",
    tomorrow: "Mañana",
    allDay: "Todo el día",
    loadingCalendar: "Cargando el calendario…",
    nothingToday: "Nada previsto",
    noEvents: "No hay eventos en los próximos días",
    calendarError: "Calendario no disponible",
    addTask: "Añadir una tarea",
    addItem: "Añadir un artículo",
    add: "Añadir",
    remove: "Eliminar",
    emptyTodo: "Nada que hacer",
    emptyGroceries: "Nada que comprar",
    removeCompleted: "Eliminar completados",
    clearList: "Vaciar lista",
    clearConfirm: "Pulsa de nuevo para vaciar",
    left: "pendientes",
    updated: "Actualizado",
    offline: "Sin conexión, mostrando la última copia guardada",
    demo: "Modo de demostración: configura workerUrl en src/app/settings.ts",
    tokenTitle: "Introduce el token familiar",
    tokenHelp:
      "Es la contraseña que guardaste en Cloudflare como FAMILY_TOKEN. Este dispositivo la recuerda.",
    tokenPlaceholder: "Token familiar",
    tokenSave: "Guardar",
    tokenRejected: "El token no es válido. Revísalo e inténtalo de nuevo.",
  },
};

export interface Settings {
  workerUrl: string;
  primaryColor: string;
  locale: string;
  weather: {
    latitude: number;
    longitude: number;
    location: string;
    timeZone: string;
    refreshMinutes: number;
  };
  daysAhead: number;
  listRefreshSeconds: number;
  calendarRefreshMinutes: number;
  frameReloadHours: number;
  night: { from: number; to: number; dim: number };
  text: Texts;
}

export interface Texts {
  home: string;
  openNavigation: string;
  closeNavigation: string;
  menu: string;
  menuHelp: string;
  lunch: string;
  dinner: string;
  previousWeek: string;
  nextWeek: string;
  thisWeek: string;
  loadingMenu: string;
  mealAudience: string;
  mealAudiencePlaceholder: string;
  mealPlaceholder: string;
  noMeal: string;
  addMeal: string;
  editMeal: string;
  clearMealHelp: string;
  savingMeal: string;
  cancel: string;
  eatingOut: string;
  menuChangeError: string;
  menuSaveError: string;

  calendar: string;
  todo: string;
  groceries: string;
  today: string;
  tomorrow: string;
  allDay: string;
  loadingCalendar: string;
  nothingToday: string;
  noEvents: string;
  calendarError: string;
  addTask: string;
  addItem: string;
  add: string;
  remove: string;
  emptyTodo: string;
  emptyGroceries: string;
  removeCompleted: string;
  clearList: string;
  clearConfirm: string;
  left: string;
  updated: string;
  offline: string;
  demo: string;
  tokenTitle: string;
  tokenHelp: string;
  tokenPlaceholder: string;
  tokenSave: string;
  tokenRejected: string;
}

/** Injected everywhere instead of importing SETTINGS directly, so tests can override it. */
export const APP_SETTINGS = new InjectionToken<Settings>("APP_SETTINGS", {
  providedIn: "root",
  factory: () => SETTINGS,
});
