import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/** The current time as a signal, updated every second. */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly tick = signal(new Date());

  readonly now = this.tick.asReadonly();

  /** Midnight today; only changes when the day changes. */
  readonly today = computed(
    () => {
      const d = new Date(this.now());
      d.setHours(0, 0, 0, 0);
      return d;
    },
    { equal: (a, b) => a.getTime() === b.getTime() },
  );

  constructor() {
    const id = setInterval(() => this.tick.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
