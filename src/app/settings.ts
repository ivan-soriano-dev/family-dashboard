import { InjectionToken } from '@angular/core';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SETTINGS – the only file you normally need to edit.
 *  Change a value, commit, and the GitHub Action rebuilds and publishes the site.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SETTINGS: Settings = {
  /** Cloudflare Worker address. Leave empty to run in demo mode (sample data, nothing shared). */
  workerUrl: 'https://family-dashboard.cuenta-familia-soriano-navarro.workers.dev/',

  /**
   * Primary colour (any hex colour). Button text and readable text shades are worked out
   * automatically. Also update the two default values at the top of src/styles.css so the
   * very first paint uses the same colour.
   */
  primaryColor: '#ecd8dc',

  /** Date and time format, e.g. 'es-ES', 'fr-FR', 'en-US'. */
  locale: 'en-ES',

  /** How many days the calendar shows. */
  daysAhead: 7,

  /** How often the lists are re-checked (seconds). */
  listRefreshSeconds: 30,

  /** How often the calendar is re-checked (minutes). The Worker itself caches it for 15 minutes. */
  calendarRefreshMinutes: 10,

  /** Full page reload on the photo frame (hours). 0 disables it. */
  frameReloadHours: 6,

  /** Night dimming on the photo frame. Set dim to 0 to disable. */
  night: { from: 23, to: 7, dim: 0.8 },

  /** Every word shown on screen. */
  text: {
    calendar: 'Calendar',
    todo: 'To do',
    groceries: 'Groceries',
    today: 'Today',
    tomorrow: 'Tomorrow',
    allDay: 'All day',
    loadingCalendar: 'Loading the calendar…',
    nothingToday: 'Nothing planned',
    noEvents: 'Nothing in the next days',
    calendarError: 'Calendar unavailable',
    addTask: 'Add a task',
    addItem: 'Add an item',
    add: 'Add',
    remove: 'Remove',
    emptyTodo: 'Nothing to do',
    emptyGroceries: 'Nothing to buy',
    removeCompleted: 'Remove completed',
    clearList: 'Clear list',
    clearConfirm: 'Tap again to clear',
    left: 'left',
    updated: 'Updated',
    offline: 'Offline, showing the last saved copy',
    demo: 'Demo mode: set workerUrl in src/app/settings.ts',
    tokenTitle: 'Enter the family token',
    tokenHelp:
      'It’s the password you saved in Cloudflare as FAMILY_TOKEN. This device remembers it.',
    tokenPlaceholder: 'Family token',
    tokenSave: 'Save',
    tokenRejected: 'That token didn’t work. Check it and try again.',
  },
};

export interface Settings {
  workerUrl: string;
  primaryColor: string;
  locale: string;
  daysAhead: number;
  listRefreshSeconds: number;
  calendarRefreshMinutes: number;
  frameReloadHours: number;
  night: { from: number; to: number; dim: number };
  text: Texts;
}

export interface Texts {
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
export const APP_SETTINGS = new InjectionToken<Settings>('APP_SETTINGS', {
  providedIn: 'root',
  factory: () => SETTINGS,
});
