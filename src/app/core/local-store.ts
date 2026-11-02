import { Injectable } from '@angular/core';

/**
 * Small wrapper around localStorage. Keys are prefixed with "fd:" (same keys as the
 * previous version of the app, so existing devices keep their token and cached data).
 * Every call is wrapped in try/catch because storage can be full or disabled.
 */
@Injectable({ providedIn: 'root' })
export class LocalStore {
  private readonly prefix = 'fd:';

  getText(key: string): string | null {
    try {
      return localStorage.getItem(this.prefix + key);
    } catch {
      return null;
    }
  }

  getJson<T>(key: string): T | null {
    const text = this.getText(key);
    if (text === null) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(
        this.prefix + key,
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    } catch {
      /* storage unavailable: the app still works, it just won't remember */
    }
  }
}
