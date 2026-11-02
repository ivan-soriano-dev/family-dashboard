/** Date/time formatting with the browser's built-in Intl API (no locale data to register). */
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

export function formatTime(date: Date, locale: string): string {
  return formatter(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatLongDate(date: Date, locale: string): string {
  return capitalize(
    formatter(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date),
  );
}

export function formatDayHeading(date: Date, locale: string): string {
  return capitalize(
    formatter(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(date),
  );
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
