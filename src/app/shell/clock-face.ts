import { Component, computed, inject } from '@angular/core';
import { APP_SETTINGS } from '../settings';
import { Clock } from '../core/clock';
import { Weather } from '../core/weather';

@Component({
  selector: 'app-clock-face',
  host: { 'aria-label': 'Clock and weather', role: 'group' },
  template: `
    <div class="clock-weekday">{{ weekday() }}</div>
    <div class="clock-time">{{ time() }}</div>
    <div class="clock-date">{{ date() }}</div>
    <div class="weather" [attr.aria-label]="'Weather in ' + weather.location + ', degrees Celsius'">
      @if (weather.current(); as current) {
        <div class="weather-current">
          <span class="weather-icon" [class.sunny]="current.sunny" aria-hidden="true">{{ current.icon }}</span>
          <div>
            <div class="weather-condition">{{ current.label }}</div>
            <div class="weather-temperature" aria-label="Current temperature">{{ current.temperature }}°</div>
          </div>
        </div>
        <div class="weather-hours">
          @for (hour of weather.hours(); track hour.time) {
            <div class="weather-hour" [attr.aria-label]="hour.label">
              <span class="weather-icon" [class.sunny]="hour.sunny" aria-hidden="true">{{ hour.icon }}</span>
              <div>
                <div class="weather-hour-time">{{ formatHour(hour.time) }}</div>
                <div class="weather-hour-temperature">{{ hour.temperature }}°</div>
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="weather-message" role="status">{{ weather.loading() ? 'Loading weather…' : weather.failureMessage() }}</p>
      }
      <div class="weather-credit">
        <span>{{ weather.location }}@if (weather.current()) { · °C }</span>
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
      </div>
      @if (weather.current() && weather.stale()) {
        <div class="weather-message" role="status">Weather update unavailable · showing last update</div>
      }
    </div>
  `,
  styleUrl: './clock-face.css',
})
export class ClockFace {
  private readonly clock = inject(Clock);
  private readonly settings = inject(APP_SETTINGS);
  protected readonly weather = inject(Weather);
  private readonly timeOptions = { timeZone: this.settings.weather.timeZone };
  private readonly weekdayFormat = new Intl.DateTimeFormat(this.settings.locale, {
    ...this.timeOptions, weekday: 'long',
  });
  private readonly dateFormat = new Intl.DateTimeFormat(this.settings.locale, {
    ...this.timeOptions, day: 'numeric', month: 'long', year: 'numeric',
  });
  private readonly clockFormat = new Intl.DateTimeFormat(this.settings.locale, {
    ...this.timeOptions, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  private readonly hourFormat = new Intl.DateTimeFormat(this.settings.locale, {
    ...this.timeOptions, hour: 'numeric', hour12: true,
  });

  protected readonly weekday = computed(() => this.weekdayFormat.format(this.clock.now()));
  protected readonly time = computed(() => this.clockFormat.format(this.clock.now()));
  protected readonly date = computed(() => this.dateFormat.format(this.clock.now()));
  protected formatHour(time: number): string {
    return this.hourFormat.format(new Date(time * 1000));
  }
}
