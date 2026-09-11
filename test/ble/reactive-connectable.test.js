/**
 * @jest-environment jsdom
 */

import ReactiveConnectable from '../../src/ble/reactive-connectable.js';
import Connectable from '../../src/ble/connectable.js';
import { xf } from '../../src/functions.js';
import { Device, ControlMode } from '../../src/ble/enums.js';
import { log } from '../../src/functions/logger.js';

jest.mock('../../src/ble/connectable.js', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../src/models/models.js', () => ({ models: { sources: { isSource: () => false } } }));

describe('trainer target queue', () => {
  let trainer;
  let connection;
  let device;
  let callbacks;

  async function settle() {
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
  }

  function target(key, value) {
    xf.dispatch(`db:${key}Target`, { [`${key}Target`]: value });
  }

  function mode(value) {
    xf.dispatch('db:mode', { mode: value });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    log.setLevel('silent');
    trainer = {
      setPowerTarget: jest.fn().mockResolvedValue(true),
      setResistanceTarget: jest.fn().mockResolvedValue(true),
      setSimulation: jest.fn().mockResolvedValue(true),
      protocol: jest.fn().mockResolvedValue(true),
    };
    connection = { services: { trainer }, isConnected: jest.fn(() => true), getName: () => 'Test trainer' };
    Connectable.mockImplementation((args) => {
      callbacks = args;
      return connection;
    });
    device = ReactiveConnectable({ deviceType: Device.controllable, filter: { acceptAllDevices: true } });
  });

  afterEach(() => {
    device.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
    log.setLevel('debug');
  });

  test.each([
    ['power', ControlMode.erg, 'setPowerTarget', { power: 150 }],
    ['resistance', ControlMode.resistance, 'setResistanceTarget', { resistance: 150 }],
    ['slope', ControlMode.sim, 'setSimulation', { grade: 150, windSpeed: 0 }],
  ])('keeps the latest queued %s adjustment', async (key, selectedMode, method, expected) => {
    mode(selectedMode);
    target(key, 250);
    target(key, 200);
    target(key, 150);
    await settle();

    expect(trainer[method]).toHaveBeenCalledTimes(1);
    expect(trainer[method]).toHaveBeenCalledWith(expected);
  });

  test('does not retry an old failed load after the rider lowers the target', async () => {
    let finishFirst;
    trainer.setPowerTarget.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
    target('power', 250);
    await settle();
    target('power', 150);
    await settle();
    expect(trainer.setPowerTarget).toHaveBeenCalledTimes(1);

    finishFirst(false);
    await settle();
    jest.advanceTimersByTime(1000);
    await settle();
    expect(trainer.setPowerTarget.mock.calls).toEqual([[{ power: 250 }], [{ power: 150 }]]);
    expect(trainer.protocol).not.toHaveBeenCalled();
  });

  test('drops an outdated retry while protocol recovery is in progress', async () => {
    let finishProtocol;
    trainer.setPowerTarget.mockResolvedValueOnce(false);
    trainer.protocol.mockImplementationOnce(() => new Promise((resolve) => { finishProtocol = resolve; }));
    target('power', 250);
    await settle();

    target('power', 100);
    finishProtocol(true);
    await settle();
    expect(trainer.setPowerTarget.mock.calls).toEqual([[{ power: 250 }], [{ power: 100 }]]);
  });

  test('does not retry a SIM command after switching to ERG', async () => {
    let finishSlope;
    trainer.setSimulation.mockImplementationOnce(() => new Promise((resolve) => { finishSlope = resolve; }));
    mode(ControlMode.sim);
    target('slope', 8);
    await settle();
    mode(ControlMode.erg);
    target('power', 120);
    finishSlope(false);
    await settle();

    expect(trainer.setSimulation).toHaveBeenCalledTimes(1);
    expect(trainer.setPowerTarget).toHaveBeenCalledWith({ power: 120 });
    expect(trainer.protocol).not.toHaveBeenCalled();
  });

  test('sends the latest disconnected target after reconnecting', async () => {
    connection.isConnected.mockReturnValue(false);
    target('power', 250);
    target('power', 120);
    await settle();
    expect(trainer.setPowerTarget).not.toHaveBeenCalled();

    connection.isConnected.mockReturnValue(true);
    callbacks.onConnected();
    await settle();
    expect(trainer.setPowerTarget.mock.calls).toEqual([[{ power: 120 }]]);
  });

  test('cancels scheduled retries when stopped', async () => {
    trainer.setPowerTarget.mockResolvedValue(false);
    target('power', 250);
    await settle();
    expect(trainer.setPowerTarget).toHaveBeenCalledTimes(2);
    device.stop();
    jest.advanceTimersByTime(1000);
    await settle();
    expect(trainer.setPowerTarget).toHaveBeenCalledTimes(2);
  });

  test('retries the current load after a temporary failure', async () => {
    trainer.setPowerTarget.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    target('power', 120);
    await settle();
    jest.advanceTimersByTime(450);
    await settle();
    expect(trainer.setPowerTarget.mock.calls).toEqual([
      [{ power: 120 }], [{ power: 120 }], [{ power: 120 }],
    ]);
  });
});
