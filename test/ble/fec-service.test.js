import FEC from '../../src/ble/fec/fec.js';
import { uuids } from '../../src/ble/web-ble.js';

describe('FEC setup protocol', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  async function finishProtocol() {
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    jest.advanceTimersByTime(1000);
  }

  test.each([
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])('reports setup result for user data=%s and wind=%s', async (userData, wind, expected) => {
    const fec = FEC({ service: { uuid: uuids.fec } });
    fec.characteristics.control = {
      write: jest.fn().mockResolvedValueOnce(userData).mockResolvedValueOnce(wind),
    };
    const result = fec.protocol();
    await finishProtocol();

    await expect(result).resolves.toBe(expected);
    expect(fec.characteristics.control.write).toHaveBeenCalledTimes(2);
  });

  test('shares simultaneous setup calls and permits a later retry', async () => {
    const fec = FEC({ service: { uuid: uuids.fec } });
    fec.characteristics.control = { write: jest.fn().mockResolvedValue(true) };

    const first = fec.protocol();
    const second = fec.protocol();
    await finishProtocol();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fec.characteristics.control.write).toHaveBeenCalledTimes(2);

    const retry = fec.protocol();
    await finishProtocol();
    await expect(retry).resolves.toBe(true);
    expect(fec.characteristics.control.write).toHaveBeenCalledTimes(4);
  });
});
