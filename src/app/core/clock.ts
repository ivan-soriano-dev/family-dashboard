import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

const sameMinute = (a: Date, b: Date) =>
  Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000);

/** The current time as a signal, updated once per minute (checked every second). */
@Injectable({ providedIn: 'root' })
export class Clock {
  private readonly tick = signal(new Date(), { equal: sameMinute });

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
