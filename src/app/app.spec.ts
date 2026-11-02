import { ComponentFixture, TestBed } from "@angular/core/testing";
import { App } from "./app";
import { APP_SETTINGS, SETTINGS } from "./settings";
import { Weather } from "./core/weather";
import { signal } from "@angular/core";

describe("App (demo mode)", () => {
  async function navigate(
    fixture: ComponentFixture<App>,
    page: "home" | "menu",
  ): Promise<void> {
    const el = fixture.nativeElement as HTMLElement;
    const hash = `#${page}`;
    // Anchor navigation is a browser task, outside Angular's whenStable tracking.
    const navigated =
      window.location.hash === hash
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener("hashchange", () => resolve(), {
              once: true,
            });
          });
    el.querySelector<HTMLAnchorElement>(`a[href="${hash}"]`)!.click();
    await navigated;
    await fixture.whenStable();
    expect(window.location.hash).toBe(hash);
    expect(
      el.querySelector(`a[href="${hash}"]`)!.getAttribute("aria-current"),
    ).toBe("page");
  }

  beforeEach(async () => {
    localStorage.clear();
    // Reset the URL without leaving a queued hashchange for the next test.
    window.history.replaceState(null, "", "#home");
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: APP_SETTINGS, useValue: { ...SETTINGS, workerUrl: "" } },
        {
          provide: Weather,
          useValue: {
            current: signal(null),
            loading: signal(false),
            location: SETTINGS.weather.location,
            failureMessage: signal(
              "Weather unavailable · retrying in a minute",
            ),
          },
        },
      ],
    }).compileComponents();
  });

  it("shows the clock, both lists with sample items and the calendar", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(SETTINGS.text.todo);
    expect(el.textContent).toContain(SETTINGS.text.groceries);
    expect(el.textContent).toContain("Milk");
    expect(el.textContent).toContain(SETTINGS.text.calendar);
    expect(el.textContent).toContain(SETTINGS.text.demo);
  });

  it("opens the full weekly menu, saves and edits a meal, and returns Home", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    await navigate(fixture, "menu");
    expect(el.querySelectorAll(".day-card")).toHaveLength(7);
    expect(el.querySelectorAll(".meal-slot")).toHaveLength(9);
    expect(
      el.querySelector('a[href="#menu"]')!.getAttribute("aria-current"),
    ).toBe("page");
    el.querySelector<HTMLButtonElement>(
      '.meal-slot button:not([role="switch"])',
    )!.click();
    await fixture.whenStable();
    const input = el.querySelector<HTMLInputElement>(".meal-slot input")!;
    input.value = "Vegetable soup";
    input.dispatchEvent(new Event("input"));
    el.querySelector(".meal-slot form")!.dispatchEvent(
      new Event("submit", { cancelable: true }),
    );
    await fixture.whenStable();
    expect(el.querySelector(".meal-value")!.textContent).toContain(
      "Vegetable soup",
    );
    el.querySelector<HTMLButtonElement>(
      '.meal-slot button:not([role="switch"])',
    )!.click();
    await fixture.whenStable();
    expect(el.querySelector<HTMLInputElement>(".meal-slot input")!.value).toBe(
      "Vegetable soup",
    );
    el.querySelector<HTMLButtonElement>(
      '.meal-slot button[type="button"]:not([role="switch"])',
    )!.click();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>(
      '.week-controls button[aria-label="' + SETTINGS.text.nextWeek + '"]',
    )!.click();
    await fixture.whenStable();
    expect(el.textContent).not.toContain("Vegetable soup");
    el.querySelector<HTMLButtonElement>(
      '.week-controls button[aria-label="' + SETTINGS.text.previousWeek + '"]',
    )!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain("Vegetable soup");
    await navigate(fixture, "home");
    expect(el.querySelector("app-menu-page")).toBeNull();
    expect(el.textContent).toContain(SETTINGS.text.calendar);
  });

  it("adds dishes for children and adults, edits and removes each independently", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    await navigate(fixture, "menu");
    const slot = () => el.querySelector(".meal-slot")!;
    const openAdd = async () => {
      Array.from(slot().querySelectorAll<HTMLButtonElement>("button"))
        .find((b) => b.textContent!.includes(SETTINGS.text.addMeal))!
        .click();
      await fixture.whenStable();
    };
    const submit = async (text: string, audience: string) => {
      const fields = slot().querySelectorAll<HTMLInputElement>("input");
      fields[0].value = text;
      fields[0].dispatchEvent(new Event("input"));
      fields[1].value = audience;
      fields[1].dispatchEvent(new Event("input"));
      slot()
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { cancelable: true }));
      await fixture.whenStable();
    };
    await openAdd();
    await submit("Pasta", "Niñas");
    await openAdd();
    await submit("Ensalada", "Adultos");
    expect(slot().querySelectorAll("li")).toHaveLength(2);
    expect(slot().textContent).toContain("Niñas");
    expect(slot().textContent).toContain("Adultos");
    slot().querySelector<HTMLButtonElement>("li button")!.click();
    await fixture.whenStable();
    await submit("Arroz", "Niñas");
    expect(slot().textContent).toContain("Arroz");
    expect(slot().textContent).toContain("Ensalada");
    slot().querySelector<HTMLButtonElement>("li button")!.click();
    await fixture.whenStable();
    await submit("", "Niñas");
    expect(slot().querySelectorAll("li")).toHaveLength(1);
    expect(slot().textContent).toContain("Ensalada");
    expect(slot().textContent).not.toContain("Arroz");
    expect(el.querySelectorAll(".meal-slot")[1].textContent).not.toContain(
      "Ensalada",
    );
    await navigate(fixture, "home");
    await navigate(fixture, "menu");
    expect(slot().textContent).toContain("Ensalada");
    expect(slot().textContent).toContain("Adultos");
  });

  it("marks an individual meal as eating out and restores its dishes when switched off", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    await navigate(fixture, "menu");
    const slot = () => el.querySelector(".meal-slot")!;
    slot()
      .querySelector<HTMLButtonElement>('button:not([role="switch"])')!
      .click();
    await fixture.whenStable();
    const input = slot().querySelector("input")!;
    input.value = "Pasta";
    input.dispatchEvent(new Event("input"));
    slot()
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await fixture.whenStable();
    slot().querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    await fixture.whenStable();
    expect(
      slot().querySelector('[role="switch"]')!.getAttribute("aria-checked"),
    ).toBe("true");
    expect(slot().textContent).toContain("🎉");
    expect(slot().querySelector("ul")).toBeNull();
    expect(slot().querySelector('button:not([role="switch"])')).toBeNull();
    expect(
      el.querySelectorAll('[role="switch"]')[1].getAttribute("aria-checked"),
    ).toBe("false");
    await navigate(fixture, "home");
    await navigate(fixture, "menu");
    expect(
      slot().querySelector('[role="switch"]')!.getAttribute("aria-checked"),
    ).toBe("true");
    slot().querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    await fixture.whenStable();
    expect(
      slot().querySelector('[role="switch"]')!.getAttribute("aria-checked"),
    ).toBe("false");
    expect(slot().textContent).toContain("Pasta");
    expect(slot().querySelector('button:not([role="switch"])')).not.toBeNull();
  });

  it("adds and checks off an item", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const form = el.querySelectorAll("form")[1];
    const input = form.querySelector("input")!;
    input.value = "Eggs";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await fixture.whenStable();
    expect(el.textContent).toContain("Eggs");

    const first = el
      .querySelectorAll<HTMLButtonElement>("app-list-panel")[1]
      .querySelector<HTMLButtonElement>("[role=checkbox]")!;
    first.click();
    await fixture.whenStable();
    expect(first.getAttribute("aria-checked")).toBe("true");
  });
});
