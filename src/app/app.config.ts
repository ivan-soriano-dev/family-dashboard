import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { DisplayMode } from './core/display-mode';
import { workerInterceptor } from './core/worker-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([workerInterceptor])),
    // theme colours, light/dark and frame mode, before the first render
    provideAppInitializer(() => inject(DisplayMode).apply()),
  ],
};
