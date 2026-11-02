import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { APP_SETTINGS, SETTINGS } from './settings';
import { Weather } from './core/weather';
import { signal } from '@angular/core';

describe('App (demo mode)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: APP_SETTINGS, useValue: { ...SETTINGS, workerUrl: '' } },
        { provide: Weather, useValue: {
          current: signal(null), loading: signal(false), location: SETTINGS.weather.location,
          failureMessage: signal('Weather unavailable · retrying in a minute'),
        } },
      ],
    }).compileComponents();
  });

  it('shows the clock, both lists with sample items and the calendar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(SETTINGS.text.todo);
    expect(el.textContent).toContain(SETTINGS.text.groceries);
    expect(el.textContent).toContain('Milk');
    expect(el.textContent).toContain(SETTINGS.text.calendar);
    expect(el.textContent).toContain(SETTINGS.text.demo);
  });

  it('adds and checks off an item', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const form = el.querySelectorAll('form')[1];
    const input = form.querySelector('input')!;
    input.value = 'Eggs';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(el.textContent).toContain('Eggs');

    const first = el
      .querySelectorAll<HTMLButtonElement>('app-list-panel')[1]
      .querySelector<HTMLButtonElement>('[role=checkbox]')!;
    first.click();
    await fixture.whenStable();
    expect(first.getAttribute('aria-checked')).toBe('true');
  });
});
