import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { LocalStore } from './local-store';

/**
 * The family token (the password that protects the Worker).
 * It can arrive once in the address (…#token=XYZ); it is then saved on the device
 * and removed from the address bar. Browsers never send the part after # to GitHub.
 */
@Injectable({ providedIn: 'root' })
export class FamilyToken {
  private readonly store = inject(LocalStore);
  private readonly document = inject(DOCUMENT);
  private readonly settings = inject(APP_SETTINGS);

  private readonly token = signal(this.readInitial());
  private readonly rejectedMessage = signal<string | null>(null);

  readonly value = this.token.asReadonly();
  readonly rejected = this.rejectedMessage.asReadonly();

  /** True when the "Enter the family token" dialog should be shown. */
  readonly needsInput = computed(
    () => !!this.settings.workerUrl && (!this.token() || !!this.rejectedMessage()),
  );

  save(token: string): void {
    const clean = token.trim();
    if (!clean) return;
    this.store.set('token', clean);
    this.rejectedMessage.set(null);
    this.token.set(clean);
  }

  /** The Worker answered 401: ask for the token again. */
  reject(): void {
    this.rejectedMessage.set(this.settings.text.tokenRejected);
  }

  private readInitial(): string {
    const { location, defaultView } = this.document;
    const fromHash = new URLSearchParams(location.hash.slice(1)).get('token');
    if (fromHash) {
      this.store.set('token', fromHash);
      defaultView?.history.replaceState(null, '', location.pathname + location.search);
      return fromHash;
    }
    return this.store.getText('token') ?? '';
  }
}
