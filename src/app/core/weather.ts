import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, repeat, tap, timeout, timer } from 'rxjs';
import { APP_SETTINGS } from '../settings';
import { Clock } from './clock';

export interface WeatherResponse {
  current: { time: number; temperature_2m: number | null; weather_code: number | null; is_day: number };
  hourly: {
    time: number[];
    temperature_2m: (number | null)[];
    weather_code: (number | null)[];
    is_day: number[];
  };
}

export interface WeatherCondition {
  label: string;
  icon: string;
  sunny: boolean;
}

/** WMO codes from Open-Meteo; the plain orange sun matches the clock reference. */
export function weatherCondition(code: number | null, isDay: number): WeatherCondition {
  const condition = (label: string, icon: string, sunny = false) => ({ label, icon, sunny });
  if (code === null) return condition('Conditions unavailable', '–');
  if (code === 0 || code === 1) {
    return condition(code === 0 ? 'Clear sky' : 'Mainly clear', isDay ? '●' : '☾', !!isDay);
  }
  if (code === 2) return condition('Partly cloudy', '⛅');
  if (code === 3) return condition('Overcast', '☁');
  if (code === 45 || code === 48) return condition('Fog', '≋');
  if (code >= 51 && code <= 57) return condition('Drizzle', '☂');
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return condition('Rain', '☂');
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return condition('Snow', '❄');
  if (code >= 95 && code <= 99) return condition('Thunderstorm', 'ϟ');
  return condition('Conditions unavailable', '–');
}

/** Public weather requests never use the family Worker or its token. */
@Injectable({ providedIn: 'root' })
export class Weather {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(APP_SETTINGS).weather;
  private readonly clock = inject(Clock);
  private readonly data = signal<WeatherResponse | null>(null);
  readonly failed = signal(false);
  readonly loading = signal(true);
  readonly failureMessage = signal('Weather unavailable · retrying in a minute');
  readonly location = this.settings.location;

  readonly current = computed(() => {
    const current = this.data()?.current;
    return current ? {
      temperature: Math.round(current.temperature_2m!),
      ...weatherCondition(current.weather_code, current.is_day),
    } : null;
  });

  readonly stale = computed(() => this.failed() || (
    !!this.data() && this.clock.now().getTime() / 1000 - this.data()!.current.time > 3600
  ));

  readonly hours = computed(() => {
    const hourly = this.data()?.hourly;
    if (!hourly) return [];
    const now = this.clock.now().getTime() / 1000;
    return hourly.time.flatMap((time, i) => {
      const temperature = hourly.temperature_2m[i];
      if (time <= now || typeof temperature !== 'number' || !Number.isFinite(temperature)) return [];
      return [{
        time,
        temperature: Math.round(temperature),
        ...weatherCondition(hourly.weather_code[i] ?? null, hourly.is_day[i]),
      }];
    }).slice(0, 3);
  });

  constructor() {
    const { latitude, longitude, timeZone, refreshMinutes } = this.settings;
    this.http.get<WeatherResponse>('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude, longitude,
        current: 'temperature_2m,weather_code,is_day',
        hourly: 'temperature_2m,weather_code,is_day',
        temperature_unit: 'celsius',
        timezone: timeZone,
        timeformat: 'unixtime',
        forecast_days: 2,
      },
    }).pipe(
      timeout(15_000),
      tap(data => {
        if (typeof data.current?.temperature_2m !== 'number' ||
            !Number.isFinite(data.current.temperature_2m) ||
            !Number.isFinite(data.current.time) ||
            !Array.isArray(data.hourly?.time) ||
            !Array.isArray(data.hourly.temperature_2m) ||
            !Array.isArray(data.hourly.weather_code) ||
            !Array.isArray(data.hourly.is_day)) {
          throw new Error('Weather data unavailable');
        }
        this.data.set(data);
        this.failed.set(false);
        this.loading.set(false);
      }),
      catchError((error: unknown) => {
        const busy = error instanceof HttpErrorResponse && [429, 503].includes(error.status);
        this.failureMessage.set(busy
          ? 'Weather provider is busy · retrying in a minute'
          : 'Weather unavailable · retrying in a minute');
        this.failed.set(true);
        this.loading.set(false);
        return EMPTY;
      }),
      repeat({ delay: () => timer(this.failed() ? 60_000 : Math.max(1, refreshMinutes) * 60_000) }),
      takeUntilDestroyed(),
    ).subscribe();
  }
}
