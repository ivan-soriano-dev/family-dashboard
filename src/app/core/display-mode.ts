import { DOCUMENT, Injectable, computed, inject } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { Clock } from './clock';
import { buildPalette, css } from './palette';

const SHIFTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [2, -1],
  [-2, 1],
  [1, 2],
  [-1, -2],
  [3, 0],
  [-3, 1],
  [0, -3],
];

/**
 * Decides how the page looks on this device:
 *  - "frame" mode (?mode=frame): always dark, read-only, night dimming, anti burn-in, periodic reload
 *  - otherwise follows the phone's light/dark setting
 * and applies the theme colours as CSS variables (read by the Tailwind colours in styles.css).
 */
@Injectable({ providedIn: 'root' })
export class DisplayMode {
  private readonly document = inject(DOCUMENT);
  private readonly settings = inject(APP_SETTINGS);
  private readonly clock = inject(Clock);

  readonly isFrame = new URLSearchParams(this.document.location.search).get('mode') === 'frame';

  /** Opacity of the black night overlay (frame only). */
  readonly nightOpacity = computed(() => {
    const { from, to, dim } = this.settings.night;
    if (!this.isFrame || !dim) return 0;
    const h = this.clock.now().getHours();
    const night = from > to ? h >= from || h < to : h >= from && h < to;
    return night ? dim : 0;
  });

  /** Tiny offset that changes every hour so static pixels don't burn into the screen. */
  readonly shift = computed(() => {
    if (!this.isFrame) return 'none';
    const [x, y] = SHIFTS[this.clock.now().getHours() % SHIFTS.length];
    return `translate(${x}px, ${y}px)`;
  });

  /** No Worker configured: sample data, stored only on this device. */
  readonly demo = !this.settings.workerUrl;

  /** Called once at startup (see app.config.ts). */
  apply(): void {
    const root = this.document.documentElement;
    const view = this.document.defaultView;
    const prefersDark = view?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    root.classList.toggle('frame', this.isFrame);
    root.classList.toggle('dark', this.isFrame || prefersDark);

    try {
      const p = buildPalette(this.settings.primaryColor);
      root.style.setProperty('--primary', css(p.primary));
      root.style.setProperty('--on-primary', css(p.onPrimary));
      root.style.setProperty('--accent-light', css(p.accentLight));
      root.style.setProperty('--accent-dark', css(p.accentDark));
      this.document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', this.settings.primaryColor);
    } catch (e) {
      console.error('settings.primaryColor is not a valid hex colour', e);
    }

    if (this.isFrame && this.settings.frameReloadHours > 0) {
      setTimeout(() => this.document.location.reload(), this.settings.frameReloadHours * 3_600_000);
    }
  }
}
