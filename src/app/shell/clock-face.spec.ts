import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ClockFace } from './clock-face';
import { Weather } from '../core/weather';

describe('ClockFace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T07:31:03Z'));
    TestBed.configureTestingModule({
      imports: [ClockFace],
      providers: [{ provide: Weather, useValue: {
        current: signal({ temperature: 19, label: 'Clear sky', sunny: true, icon: '●' }),
        hours: signal([]), stale: signal(false), location: 'Loriguilla · 46393',
      } }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('renders the reference date and Madrid time, with seconds ticking', () => {
    const fixture = TestBed.createComponent(ClockFace);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.clock-weekday')?.textContent).toBe('Wednesday');
    expect(el.querySelector('.clock-time')?.textContent).toBe('09:31:03');
    expect(el.querySelector('.clock-date')?.textContent).toBe('12 August 2026');
    expect(el.textContent).toContain('19°');
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(el.querySelector('.clock-time')?.textContent).toBe('09:31:04');
  });

  it('explains a provider outage when no weather reading is available', () => {
    TestBed.overrideProvider(Weather, { useValue: {
      current: signal(null), loading: signal(false), location: 'Loriguilla · 46393',
      failureMessage: signal('Weather provider is busy · retrying in a minute'),
    } });
    const fixture = TestBed.createComponent(ClockFace);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent)
      .toBe('Weather provider is busy · retrying in a minute');
  });

  it('updates the date when Madrid crosses midnight', () => {
    vi.setSystemTime(new Date('2026-08-12T21:59:59Z'));
    const fixture = TestBed.createComponent(ClockFace);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.clock-time').textContent).toBe('00:00:00');
    expect(fixture.nativeElement.querySelector('.clock-weekday').textContent).toBe('Thursday');
    expect(fixture.nativeElement.querySelector('.clock-date').textContent).toBe('13 August 2026');
  });
});
