import { Component, DOCUMENT, DestroyRef, inject, signal } from "@angular/core";
import { MenuPage } from "./menu/menu-page";
import { APP_SETTINGS } from "./settings";
import { DisplayMode } from "./core/display-mode";
import { Agenda } from "./calendar/agenda";
import { ListPanel } from "./lists/list-panel";
import { ClockFace } from "./shell/clock-face";
import { StatusLine } from "./shell/status-line";
import { TokenDialog } from "./shell/token-dialog";

/**
 * Home layout, with hash navigation compatible with GitHub Pages.
 *  Phones: one column – clock, to do, groceries, calendar.
 *  Wide screens (frame): clock + tasks in the narrow left column, calendar in the
 *  middle, and groceries on the right. The left column is 30% narrower than before.
 */
@Component({
  selector: "app-root",
  imports: [MenuPage, Agenda, ClockFace, ListPanel, StatusLine, TokenDialog],
  templateUrl: "./app.html",
  host: { class: "block h-full" },
})
export class App {
  private readonly document = inject(DOCUMENT);
  protected readonly page = signal(
    this.document.location.hash === "#menu" ? "menu" : "home",
  );
  protected readonly navigationOpen = signal(false);

  constructor() {
    const view = this.document.defaultView;
    const navigate = () => {
      this.page.set(view?.location.hash === "#menu" ? "menu" : "home");
      this.navigationOpen.set(false);
    };
    view?.addEventListener("hashchange", navigate);
    inject(DestroyRef).onDestroy(() =>
      view?.removeEventListener("hashchange", navigate),
    );
  }

  protected readonly display = inject(DisplayMode);
  protected readonly text = inject(APP_SETTINGS).text;
}
