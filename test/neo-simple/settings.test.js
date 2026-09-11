/**
 * @jest-environment jsdom
 */

import { createSettingsController } from '../../src/neo-simple/settings.js';
import { clamp, toInt, toFloat } from '../../src/neo-simple/utils.js';

describe('workout load settings', () => {
  let ctx;
  let settings;

  beforeEach(() => {
    const input = (value) => {
      const el = document.createElement('input');
      el.value = value;
      return el;
    };
    ctx = {
      state: { builder: { steps: [] } },
      elements: { ftpEl: input('185'), intensityEl: input('100') },
      limits: { gradeMin: -40, gradeMax: 40 },
      clamp, toInt, toFloat,
      getRideSettings: () => ({ intensityPct: toInt(ctx.elements.intensityEl.value) }),
      saveSettings: jest.fn(),
      loadSettings: jest.fn(() => ({})),
      readManualGrade: jest.fn(),
      readRouteLengthKm: jest.fn(),
      readRouteMaxGrade: jest.fn(),
      readRouteAssumeKmh: jest.fn(),
      updateHillsUi: jest.fn(),
      applySelectedRoute: jest.fn(),
      setWindMps: jest.fn(),
      applyCurrentErgStepIfRunning: jest.fn(),
    };
    settings = createSettingsController(ctx);
    settings.bind();
  });

  test('saves FTP when it changes and restores it for the next visit', () => {
    ctx.elements.ftpEl.dispatchEvent(new Event('change'));
    const saved = ctx.saveSettings.mock.calls[0][0];
    expect(saved.ftp).toBe(185);

    ctx.elements.ftpEl.value = '250';
    ctx.loadSettings.mockReturnValue(saved);
    settings.applyInitialSettings();
    expect(ctx.elements.ftpEl.value).toBe('185');
  });

  test('updates the current ERG target once per quick adjustment', () => {
    settings.setIntensityPct(99);
    expect(ctx.elements.intensityEl.value).toBe('99');
    expect(ctx.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ intensityPct: 99 }));
    expect(ctx.applyCurrentErgStepIfRunning).toHaveBeenCalledTimes(1);
  });
});
