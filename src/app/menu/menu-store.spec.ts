import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { vi } from "vitest";
import { APP_SETTINGS, SETTINGS } from "../settings";
import { DisplayMode } from "../core/display-mode";
import { FamilyToken } from "../core/family-token";
import { WorkerApi } from "../core/worker-api";
import { MenuStore } from "./menu-store";
import { MenuData } from "./menu-model";

const saved: MenuData = { meals: { "2026-11-02:dinner": "Soup" }, updated: 10 };
describe("MenuStore", () => {
  let api: {
    menu: ReturnType<typeof vi.fn>;
    saveMeal: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    localStorage.clear();
    api = {
      menu: vi.fn().mockResolvedValue(saved),
      saveMeal: vi.fn().mockResolvedValue(saved),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_SETTINGS, useValue: SETTINGS },
        { provide: DisplayMode, useValue: { demo: false } },
        { provide: FamilyToken, useValue: { value: signal("test-token") } },
        { provide: WorkerApi, useValue: api },
      ],
    });
  });
  it("keeps the last saved menu when refresh or saving fails", async () => {
    localStorage.setItem("fd:menu:2026-11-02", JSON.stringify(saved));
    const store = TestBed.inject(MenuStore);
    store.select("2026-11-02");
    api.menu.mockRejectedValue(new Error("Offline"));
    await store.refresh();
    api.saveMeal.mockRejectedValue(new Error("Offline"));
    expect(
      await store.save({ date: "2026-11-02", meal: "dinner", text: "Pasta" }),
    ).toBe(false);
    expect(store.data()).toEqual(saved);
    expect(store.error()).toBe(true);
    expect(store.saving()).toBe(false);
    expect(JSON.parse(localStorage.getItem("fd:menu:2026-11-02")!)).toEqual(
      saved,
    );
  });
  it("keeps the saved away state when a toggle cannot be saved", async () => {
    const data = { ...saved, away: { "2026-11-02:dinner": true } };
    localStorage.setItem("fd:menu:2026-11-02", JSON.stringify(data));
    const store = TestBed.inject(MenuStore);
    store.select("2026-11-02");
    api.saveMeal.mockRejectedValue(new Error("Offline"));
    expect(
      await store.save({
        date: "2026-11-02",
        meal: "dinner",
        op: "setAway",
        away: false,
      }),
    ).toBe(false);
    expect(store.data()).toEqual(data);
    expect(store.error()).toBe(true);
    expect(
      await store.save({
        date: "2026-11-02",
        meal: "dinner",
        op: "add",
        id: "new",
        text: "Rice",
      }),
    ).toBe(false);
    expect(api.saveMeal).toHaveBeenCalledTimes(1);
  });

  it("ignores a response for a previously selected week", async () => {
    let resolve!: (data: MenuData) => void;
    api.menu.mockReturnValueOnce(
      new Promise<MenuData>((r) => {
        resolve = r;
      }),
    );
    const store = TestBed.inject(MenuStore);
    store.select("2026-11-02");
    const pending = store.refresh();
    store.select("2026-11-09");
    resolve(saved);
    await pending;
    expect(store.data()).toBeNull();
  });
  it("prevents an older in-flight refresh from replacing a saved meal", async () => {
    let resolve!: (data: MenuData) => void;
    api.menu.mockReturnValueOnce(
      new Promise<MenuData>((r) => {
        resolve = r;
      }),
    );
    const store = TestBed.inject(MenuStore);
    store.select("2026-11-02");
    const pending = store.refresh();
    expect(
      await store.save({ date: "2026-11-02", meal: "dinner", text: "Soup" }),
    ).toBe(true);
    resolve({ meals: {}, updated: 0 });
    await pending;
    expect(store.data()).toEqual(saved);
    expect(JSON.parse(localStorage.getItem("fd:menu:2026-11-02")!)).toEqual(
      saved,
    );
  });
});
