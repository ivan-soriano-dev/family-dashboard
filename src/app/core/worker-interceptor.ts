import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { FamilyToken } from './family-token';

/** Adds the family token to every request sent to the Worker (and to nothing else). */
export const workerInterceptor: HttpInterceptorFn = (req, next) => {
  const { workerUrl } = inject(APP_SETTINGS);
  if (!workerUrl || !req.url.startsWith(workerUrl)) return next(req);
  return next(req.clone({ setHeaders: { 'X-Family-Token': inject(FamilyToken).value() } }));
};
