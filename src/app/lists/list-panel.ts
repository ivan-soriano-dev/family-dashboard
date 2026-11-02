import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { ListName, cleanText, newId, sortForDisplay } from './list-model';
import { ListsStore } from './lists-store';

/** One shared list (to do or groceries): items, add box, "Clear list" and "Remove completed". */
@Component({
  selector: 'app-list-panel',
  templateUrl: './list-panel.html',
  host: { class: 'panel', '[attr.aria-labelledby]': 'headingId()' },
})
export class ListPanel {
  readonly name = input.required<ListName>();
  readonly heading = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly emptyText = input.required<string>();

  protected readonly text = inject(APP_SETTINGS).text;
  private readonly lists = inject(ListsStore);

  protected readonly headingId = computed(() => `list-${this.name()}-heading`);
  private readonly data = computed(() => this.lists.list(this.name())());

  protected readonly loaded = computed(() => this.data() !== null);
  protected readonly items = computed(() => sortForDisplay(this.data()?.items ?? []));
  protected readonly openCount = computed(() => this.items().filter((i) => !i.done).length);
  protected readonly doneCount = computed(() => this.items().length - this.openCount());

  /** "Clear list" needs a second tap within 4 seconds. */
  protected readonly confirmingClear = signal(false);
  private clearTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.clearTimer));
  }

  protected add(event: SubmitEvent, input: HTMLInputElement): void {
    event.preventDefault();
    const text = cleanText(input.value);
    if (!text) return;
    void this.lists.change(this.name(), { op: 'add', id: newId(), text });
    input.value = '';
    input.focus();
  }

  protected toggle(id: string, done: boolean): void {
    void this.lists.change(this.name(), { op: 'toggle', id, done });
  }

  protected remove(id: string): void {
    void this.lists.change(this.name(), { op: 'delete', id });
  }

  protected removeCompleted(): void {
    void this.lists.change(this.name(), { op: 'clearDone' });
  }

  protected clearList(): void {
    clearTimeout(this.clearTimer);
    if (this.confirmingClear()) {
      this.confirmingClear.set(false);
      void this.lists.change(this.name(), { op: 'clear' });
      return;
    }
    this.confirmingClear.set(true);
    this.clearTimer = setTimeout(() => this.confirmingClear.set(false), 4000);
  }
}
