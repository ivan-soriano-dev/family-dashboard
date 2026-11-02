import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  Signal,
  WritableSignal,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { DisplayMode } from '../core/display-mode';
import { FamilyToken } from '../core/family-token';
import { LocalStore } from '../core/local-store';
import { WorkerApi } from '../core/worker-api';
import {
  LIST_NAMES,
  ListChange,
  ListData,
  ListName,
  applyChange,
  demoList,
  emptyList,
} from './list-model';

/**
 * Holds both shared lists. Changes show immediately (optimistic update), are sent to the
 * Worker, and the Worker's answer replaces the local copy. Lists are re-checked every
 * `listRefreshSeconds`, when the token changes, and when the page becomes visible again.
 */
@Injectable({ providedIn: 'root' })
export class ListsStore {
  private readonly api = inject(WorkerApi);
  private readonly store = inject(LocalStore);
  private readonly token = inject(FamilyToken);
  private readonly settings = inject(APP_SETTINGS);
  private readonly demo = inject(DisplayMode).demo;
  private readonly document = inject(DOCUMENT);

  private readonly data: Record<ListName, WritableSignal<ListData | null>> = {
    todo: signal(this.initial('todo')),
    groceries: signal(this.initial('groceries')),
  };
  /** Number of changes still being saved; while > 0, refreshes are ignored. */
  private pending = 0;

  constructor() {
    if (this.demo) return;

    effect(() => {
      if (this.token.value()) untracked(() => void this.refresh());
    });

    const id = setInterval(() => void this.refresh(), this.settings.listRefreshSeconds * 1000);
    const onVisible = () => !this.document.hidden && void this.refresh();
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(id);
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }

  list(name: ListName): Signal<ListData | null> {
    return this.data[name].asReadonly();
  }

  async refresh(): Promise<void> {
    if (this.demo || !this.token.value() || this.pending) return;
    await Promise.all(
      LIST_NAMES.map(async (name) => {
        try {
          const fresh = await this.api.list(name);
          const current = this.data[name]();
          if (this.pending) return; // a change started meanwhile
          if (current?.updated && fresh.updated < current.updated) return; // older than what we have
          this.accept(name, fresh);
        } catch {
          /* offline: keep showing the saved copy (SyncStatus shows the message) */
        }
      }),
    );
  }

  async change(name: ListName, change: ListChange): Promise<void> {
    const target = this.data[name];
    target.set(applyChange(target() ?? emptyList(), change));

    if (this.demo) {
      this.store.set(`demo:${name}`, target());
      return;
    }

    this.pending++;
    try {
      const saved = await this.api.change(name, change);
      this.pending--;
      if (!this.pending) this.accept(name, saved);
    } catch {
      this.pending--;
      setTimeout(() => void this.refresh(), 3000); // get back in step with the Worker
    }
  }

  private accept(name: ListName, data: ListData): void {
    this.data[name].set(data);
    this.store.set(`list:${name}`, data);
  }

  private initial(name: ListName): ListData | null {
    if (this.demo) return this.store.getJson<ListData>(`demo:${name}`) ?? demoList(name);
    return this.store.getJson<ListData>(`list:${name}`);
  }
}
