/**
 * @jest-environment jsdom
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { log } from '../../src/functions/logger.js';

jest.mock('../../src/db.js', () => ({}));
jest.mock('../../src/ble/devices.js', () => ({}));

describe('NEO Simple load controls', () => {
  let dispatch;
  const el = (id) => document.getElementById(id);

  beforeAll(() => {
    jest.useFakeTimers();
    log.setLevel('silent');
    document.documentElement.innerHTML = readFileSync(join(__dirname, '../../src/neo-simple.html'), 'utf8');
    localStorage.setItem('neoSimple:settings', JSON.stringify({ ftp: 185, workoutSound: false }));
    const context = new Proxy({}, {
      get(target, key) {
        if (!(key in target)) {
          if (key === 'measureText') target[key] = () => ({ width: 50 });
          else if (key === 'createLinearGradient' || key === 'createRadialGradient') target[key] = () => ({ addColorStop: () => {} });
          else target[key] = () => {};
        }
        return target[key];
      },
    });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    dispatch = jest.fn();
    for (const event of ['ui:power-target-set', 'ui:slope-target-set', 'ui:mode-set']) {
      window.addEventListener(event, (e) => dispatch(event, e.detail.data));
    }
    require('../../src/neo-simple.js');
  });

  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    log.setLevel('debug');
  });

  test('restores FTP and changes ERG load once without resetting the mode', () => {
    expect(el('ftp').value).toBe('185');
    el('btn-workout-start').click();
    const originalWatts = Number.parseInt(el('target').textContent, 10);
    expect(originalWatts).toBeGreaterThan(0);

    dispatch.mockClear();
    el('intensity-slider').value = '80';
    el('intensity-slider').dispatchEvent(new Event('input'));
    const expectedWatts = Math.round(originalWatts * 0.8);
    expect(dispatch.mock.calls.filter(([event]) => event === 'ui:power-target-set')).toEqual([
      ['ui:power-target-set', expectedWatts],
    ]);
    expect(dispatch.mock.calls.some(([event]) => event === 'ui:mode-set')).toBe(false);
    expect(el('target').textContent).toBe(`${expectedWatts} W`);
    expect(el('intensity-live').textContent).toBe('80%');
    expect(el('ride-intensity-live').textContent).toBe('80%');
  });

  test('applies rapid hill adjustments and displays the grade sent to the trainer', () => {
    const radio = document.querySelector('input[name="mode"][value="sim"]');
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    el('sim-auto').checked = false;
    el('sim-auto').dispatchEvent(new Event('change'));
    el('sim-grade').value = '6';
    el('btn-sim-apply').click();

    dispatch.mockClear();
    el('difficulty-slider').value = '50';
    el('difficulty-slider').dispatchEvent(new Event('input'));
    el('difficulty-slider').value = '25';
    el('difficulty-slider').dispatchEvent(new Event('input'));

    expect(dispatch.mock.calls.filter(([event]) => event === 'ui:slope-target-set')).toEqual([
      ['ui:slope-target-set', 3], ['ui:slope-target-set', 1.5],
    ]);
    expect(el('target').textContent).toBe('grade 1.5%');
    expect(el('grade').textContent).toBe('6.0');
    expect(el('difficulty-live').textContent).toBe('25%');
    expect(JSON.parse(localStorage.getItem('neoSimple:settings')).difficultyPct).toBe(25);
  });
});
