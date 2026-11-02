import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { APP_SETTINGS, SETTINGS } from '../settings';
import { Clock } from './clock';
import { Weather, WeatherResponse } from './weather';
import { workerInterceptor } from './worker-interceptor';

describe('Weather', () => {
  const now = signal(new Date('2026-08-12T07:31:03Z'));
  const sample = (): WeatherResponse => ({
    current: { time: now().getTime() / 1000, temperature_2m: 19.2, weather_code: 0, is_day: 1 },
    hourly: {
      time: [7, 8, 9, 10, 11].map(hour => Date.UTC(2026, 7, 12, hour) / 1000),
      temperature_2m: [19, 20, 23, 25, 26],
      weather_code: [0, 0, 2, 61, 3],
      is_day: [1, 1, 1, 1, 1],
    },
  });
  let weather: Weather;
  let http: HttpTestingController;
  const request = () => http.expectOne(req => req.url === 'https://api.open-meteo.com/v1/forecast');

  beforeEach(() => {
    vi.useFakeTimers();
    now.set(new Date('2026-08-12T07:31:03Z'));
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([workerInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_SETTINGS, useValue: SETTINGS },
      { provide: Clock, useValue: { now } },
    ] });
    weather = TestBed.inject(Weather);
    http = TestBed.inject(HttpTestingController);
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('requests Celsius weather for Loriguilla without sending the family token', () => {
    const req = request();
    expect(req.request.params.get('latitude')).toBe('39.49');
    expect(req.request.params.get('longitude')).toBe('-0.57');
    expect(req.request.params.get('timezone')).toBe('Europe/Madrid');
    expect(req.request.params.get('temperature_unit')).toBe('celsius');
    expect(req.request.headers.has('X-Family-Token')).toBe(false);
    req.flush(sample());
    expect(weather.current()).toMatchObject({ temperature: 19, label: 'Clear sky', sunny: true });
    expect(weather.hours().map(hour => hour.temperature)).toEqual([20, 23, 25]);
    expect(weather.hours().map(hour => hour.label)).toEqual(['Clear sky', 'Partly cloudy', 'Rain']);
    expect(weather.loading()).toBe(false);
  });

  it('advances forecast hours with the clock and skips missing temperatures', () => {
    const data = sample();
    data.hourly.temperature_2m[2] = null;
    request().flush(data);
    expect(weather.hours().map(hour => hour.temperature)).toEqual([20, 25, 26]);
    now.set(new Date('2026-08-12T08:00:00Z'));
    expect(weather.hours().map(hour => hour.temperature)).toEqual([25, 26]);
  });

  it('keeps the last reading after a failed refresh and recovers on the next poll', () => {
    request().flush(sample());
    vi.advanceTimersByTime(SETTINGS.weather.refreshMinutes * 60_000);
    request().flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(weather.current()?.temperature).toBe(19);
    expect(weather.stale()).toBe(true);
    vi.advanceTimersByTime(60_000);
    request().flush(sample());
    expect(weather.stale()).toBe(false);
  });

  it('retries an overloaded provider every minute, then returns to the normal refresh interval', () => {
    request().flush({ error: true, reason: 'The service is overloaded' }, {
      status: 503, statusText: 'Service Unavailable',
    });
    expect(weather.current()).toBeNull();
    expect(weather.failureMessage()).toBe('Weather provider is busy · retrying in a minute');
    vi.advanceTimersByTime(59_999);
    http.expectNone(req => req.url === 'https://api.open-meteo.com/v1/forecast');
    vi.advanceTimersByTime(1);
    request().flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    vi.advanceTimersByTime(60_000);
    request().flush(sample());
    expect(weather.current()?.temperature).toBe(19);
    expect(weather.failed()).toBe(false);
    vi.advanceTimersByTime(60_000);
    http.expectNone(req => req.url === 'https://api.open-meteo.com/v1/forecast');
    vi.advanceTimersByTime((SETTINGS.weather.refreshMinutes - 1) * 60_000);
    request().flush(sample());
  });

  it('shows unavailable instead of converting a missing temperature to zero', () => {
    const data = sample();
    data.current.temperature_2m = null;
    request().flush(data);
    expect(weather.current()).toBeNull();
    expect(weather.failed()).toBe(true);
    expect(weather.loading()).toBe(false);
  });

  it('times out a stalled request and retries on the next poll', () => {
    const stalled = request();
    vi.advanceTimersByTime(15_000);
    expect(stalled.cancelled).toBe(true);
    expect(weather.failed()).toBe(true);
    vi.advanceTimersByTime(60_000);
    request().flush(sample());
    expect(weather.failed()).toBe(false);
  });
});
