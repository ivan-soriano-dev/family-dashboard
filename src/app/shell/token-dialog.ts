import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { FamilyToken } from '../core/family-token';

/** Asks for the family token when the device doesn't have one, or when it stopped working. */
@Component({
  selector: 'app-token-dialog',
  template: `
    <dialog
      #dialog
      class="m-auto w-[min(420px,calc(100%-3rem))] rounded-2xl border border-line bg-panel p-6 text-fg backdrop:bg-page"
      (cancel)="$event.preventDefault()"
    >
      <h2 class="mb-1.5 text-xl font-semibold">{{ text.tokenTitle }}</h2>
      <p class="mb-4 text-[15px] text-fg-3">{{ text.tokenHelp }}</p>
      <form class="flex gap-2" (submit)="save($event, field)">
        <input
          #field
          type="password"
          autocomplete="off"
          class="field"
          [placeholder]="text.tokenPlaceholder"
          [attr.aria-label]="text.tokenPlaceholder"
        />
        <button type="submit" class="primary-button">{{ text.tokenSave }}</button>
      </form>
      <p class="mt-2.5 min-h-[1lh] text-sm text-danger" aria-live="polite">
        {{ token.rejected() }}
      </p>
    </dialog>
  `,
})
export class TokenDialog {
  protected readonly token = inject(FamilyToken);
  protected readonly text = inject(APP_SETTINGS).text;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.token.needsInput() && !el.open) el.showModal();
      if (!this.token.needsInput() && el.open) el.close();
    });
  }

  protected save(event: SubmitEvent, field: HTMLInputElement): void {
    event.preventDefault();
    this.token.save(field.value);
    field.value = '';
  }
}
