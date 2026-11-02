import { Injectable, signal } from '@angular/core';

/** Whether the last call to the Worker worked, and when. Shown in the bottom-right corner. */
@Injectable({ providedIn: 'root' })
export class SyncStatus {
  readonly lastSuccess = signal<Date | null>(null);
  readonly offline = signal(false);

  success(): void {
    this.lastSuccess.set(new Date());
    this.offline.set(false);
  }

  failure(): void {
    this.offline.set(true);
  }
}
