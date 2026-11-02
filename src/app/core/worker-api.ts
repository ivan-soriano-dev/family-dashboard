import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { APP_SETTINGS } from '../settings';
import type { ListChange, ListData, ListName } from '../lists/list-model';
import { FamilyToken } from './family-token';
import { SyncStatus } from './sync-status';

const TIMEOUT_MS = 15_000;

/**
 * Typed calls to the Cloudflare Worker (see worker/worker.js).
 * Every call gives up after 15 s, updates the status line, and asks for the token again on 401.
 */
@Injectable({ providedIn: 'root' })
export class WorkerApi {
  private readonly http = inject(HttpClient);
  private readonly token = inject(FamilyToken);
  private readonly status = inject(SyncStatus);
  private readonly base = inject(APP_SETTINGS).workerUrl.replace(/\/+$/, '');

  calendar(): Promise<string> {
    return this.run(this.http.get(`${this.base}/calendar`, { responseType: 'text' }));
  }

  list(name: ListName): Promise<ListData> {
    return this.run(this.http.get<ListData>(`${this.base}/lists/${name}`));
  }

  change(name: ListName, change: ListChange): Promise<ListData> {
    return this.run(this.http.post<ListData>(`${this.base}/lists/${name}`, change));
  }

  private async run<T>(request: Observable<T>): Promise<T> {
    try {
      const result = await firstValueFrom(request.pipe(timeout(TIMEOUT_MS)));
      this.status.success();
      return result;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.token.reject();
      else this.status.failure();
      throw error;
    }
  }
}
