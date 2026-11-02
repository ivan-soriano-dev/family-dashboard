import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { APP_SETTINGS } from "../settings";
import { DisplayMode } from "../core/display-mode";
import { FamilyToken } from "../core/family-token";
import { LocalStore } from "../core/local-store";
import { WorkerApi } from "../core/worker-api";
import {
  MenuChange,
  MenuData,
  emptyMenu,
  dishes,
  changeDishes,
} from "./menu-model";

@Injectable({ providedIn: "root" })
export class MenuStore {
  private readonly api = inject(WorkerApi);
  private readonly local = inject(LocalStore);
  private readonly token = inject(FamilyToken);
  private readonly settings = inject(APP_SETTINGS);
  private readonly demo = inject(DisplayMode).demo;
  private readonly document = inject(DOCUMENT);
  private readonly selected = signal("");
  private generation = 0;
  readonly data = signal<MenuData | null>(null);
  readonly saving = signal(false);
  readonly error = signal(false);

  constructor() {
    effect(() => {
      this.token.value();
      this.selected();
      untracked(() => void this.refresh());
    });
    const timer = setInterval(
      () => void this.refresh(),
      this.settings.listRefreshSeconds * 1000,
    );
    const visible = () => {
      if (!this.document.hidden) void this.refresh();
    };
    this.document.addEventListener("visibilitychange", visible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener("visibilitychange", visible);
    });
  }

  select(week: string): void {
    if (week === this.selected()) return;
    this.generation++;
    this.selected.set(week);
    this.data.set(
      this.local.getJson<MenuData>(this.key(week)) ??
        (this.demo ? emptyMenu() : null),
    );
    this.error.set(false);
  }

  async refresh(): Promise<void> {
    const week = this.selected();
    if (!week || this.demo || !this.token.value() || this.saving()) return;
    const generation = ++this.generation;
    try {
      const data = await this.api.menu(week);
      if (generation !== this.generation || this.saving()) return;
      this.accept(week, data);
    } catch {
      // Retain the last saved menu; the status line reports the failed refresh.
    }
  }

  async save(change: MenuChange): Promise<boolean> {
    if (this.saving()) return false;
    const key = `${change.date}:${change.meal}`;
    if (change.op !== "setAway" && this.data()?.away?.[key]) {
      this.error.set(true);
      return false;
    }
    const week = this.selected();
    this.generation++;
    this.saving.set(true);
    this.error.set(false);
    try {
      let data: MenuData;
      if (this.demo) {
        const current = this.data() ?? emptyMenu();
        const meals = { ...current.meals };
        const away = { ...current.away };
        if (change.op === "setAway") {
          if (change.away) away[key] = true;
          else delete away[key];
        } else {
          const updated = changeDishes(dishes(meals[key]), change);
          if (updated.length) meals[key] = updated;
          else delete meals[key];
        }
        data = { meals, away, updated: Date.now() };
      } else {
        data = await this.api.saveMeal(week, change);
      }
      this.local.set(this.key(week), data);
      if (week === this.selected()) this.data.set(data);
      return true;
    } catch {
      this.error.set(true);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private key(week: string): string {
    return `${this.demo ? "demo:" : ""}menu:${week}`;
  }
  private accept(week: string, data: MenuData): void {
    this.data.set(data);
    this.local.set(this.key(week), data);
  }
}
