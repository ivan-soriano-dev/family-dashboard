export type Meal = "lunch" | "dinner";
export interface Dish {
  id: string;
  text: string;
  audience?: string;
}
export interface MenuData {
  /** Strings are supported for menus saved before multiple dishes were introduced. */
  meals: Record<string, string | Dish[]>;
  away?: Record<string, boolean>;
  updated: number;
}
export interface DishChange {
  date: string;
  meal: Meal;
  text: string;
  audience?: string;
  op?: "add" | "edit" | "delete";
  id?: string;
}
export type MenuChange =
  | DishChange
  | {
      date: string;
      meal: Meal;
      op: "setAway";
      away: boolean;
    };
export function dishes(value: string | Dish[] | undefined): Dish[] {
  return typeof value === "string"
    ? value
      ? [{ id: "legacy", text: value }]
      : []
    : (value ?? []);
}
export function changeDishes(items: Dish[], change: DishChange): Dish[] {
  const id = change.id ?? "legacy";
  if (change.op === "delete" || !change.text)
    return items.filter((d) => d.id !== id);
  const dish: Dish = { id, text: change.text, audience: change.audience ?? "" };
  return items.some((d) => d.id === id)
    ? items.map((d) => (d.id === id ? dish : d))
    : [...items, dish];
}
export const emptyMenu = (): MenuData => ({ meals: {}, updated: 0 });

/** Date-only arithmetic in UTC avoids DST and browser time-zone shifts. */
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function monday(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}
export function dateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function weekDays(week: string): { date: string; meals: Meal[] }[] {
  return Array.from({ length: 7 }, (_, i) => ({
    date: shiftDate(week, i),
    meals: i < 5 ? ["dinner"] : ["lunch", "dinner"],
  }));
}
