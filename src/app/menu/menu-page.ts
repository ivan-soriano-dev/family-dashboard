import { Component, computed, effect, inject, signal } from "@angular/core";
import { APP_SETTINGS } from "../settings";
import { Clock } from "../core/clock";
import { cleanText } from "../lists/list-model";
import {
  Dish,
  Meal,
  dishes,
  dateInZone,
  monday,
  shiftDate,
  weekDays,
} from "./menu-model";
import { MenuStore } from "./menu-store";

@Component({
  selector: "app-menu-page",
  templateUrl: "./menu-page.html",
  host: { class: "menu-page" },
})
export class MenuPage {
  private readonly settings = inject(APP_SETTINGS);
  protected readonly text = this.settings.text;
  protected readonly store = inject(MenuStore);
  protected readonly today = computed(() =>
    dateInZone(this.clock.now(), this.settings.weather.timeZone),
  );
  private readonly clock = inject(Clock);
  protected readonly offset = signal(0);
  protected readonly week = computed(() =>
    shiftDate(monday(this.today()), this.offset() * 7),
  );
  protected readonly days = computed(() => weekDays(this.week()));
  protected readonly editing = signal<string | null>(null);
  protected readonly draft = signal("");
  protected readonly audience = signal("");
  private readonly dishId = signal<string | null>(null);
  protected readonly adding = signal(false);
  protected readonly range = computed(
    () =>
      `${this.label(this.week())} – ${this.label(shiftDate(this.week(), 6))}`,
  );

  constructor() {
    effect(() => this.store.select(this.week()));
  }
  protected label(date: string, weekday = false): string {
    return new Intl.DateTimeFormat(this.settings.locale, {
      timeZone: "UTC",
      ...(weekday ? { weekday: "long" } : {}),
      day: "numeric",
      month: "short",
      ...(!weekday ? { year: "numeric" } : {}),
    }).format(new Date(`${date}T00:00:00Z`));
  }
  protected items(date: string, meal: Meal): Dish[] {
    return dishes(this.store.data()?.meals[`${date}:${meal}`]);
  }
  protected isAway(date: string, meal: Meal): boolean {
    return !!this.store.data()?.away?.[`${date}:${meal}`];
  }
  protected async toggleAway(date: string, meal: Meal): Promise<void> {
    const key = `${date}:${meal}`;
    const saved = await this.store.save({
      date,
      meal,
      op: "setAway",
      away: !this.isAway(date, meal),
    });
    if (saved && this.editing() === key) this.editing.set(null);
  }
  protected edit(date: string, meal: Meal, dish?: Dish): void {
    if (this.isAway(date, meal)) return;
    this.editing.set(`${date}:${meal}`);
    this.dishId.set(dish?.id ?? crypto.randomUUID());
    this.adding.set(!dish);
    this.draft.set(dish?.text ?? "");
    this.audience.set(dish?.audience ?? "");
    this.store.error.set(false);
  }
  protected move(offset: number): void {
    this.editing.set(null);
    this.offset.set(offset);
  }
  protected async save(event: Event, date: string, meal: Meal): Promise<void> {
    event.preventDefault();
    if (this.isAway(date, meal)) return;
    const text = cleanText(this.draft());
    if (this.adding() && !text) return;
    if (
      await this.store.save({
        date,
        meal,
        text,
        audience: cleanText(this.audience()).slice(0, 60),
        id: this.dishId()!,
        op: this.adding() ? "add" : text ? "edit" : "delete",
      })
    )
      this.editing.set(null);
  }
}
