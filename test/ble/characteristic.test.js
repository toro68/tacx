import { Characteristic } from '../../src/ble/characteristic.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('Characteristic.write', () => {
    test('serializes concurrent writes', async () => {
        const pending = [];
        const order = [];

        const mockGattCharacteristic = {
            uuid: '00000000-0000-0000-0000-000000000000',
            writeValue: jest.fn(() => {
                const d = deferred();
                pending.push(d);
                order.push('start');
                return d.promise.then(() => order.push('end'));
            }),
            startNotifications: jest.fn(),
            addEventListener: jest.fn(),
            stopNotifications: jest.fn(),
        };

        const c = Characteristic({ characteristic: mockGattCharacteristic, name: 'test' });

        const p1 = c.write(new DataView(new Uint8Array([1]).buffer));
        const p2 = c.write(new DataView(new Uint8Array([2]).buffer));

        await Promise.resolve();
        expect(mockGattCharacteristic.writeValue).toHaveBeenCalledTimes(1);

        pending[0].resolve();
        await expect(p1).resolves.toBe(true);
        await Promise.resolve();

        expect(mockGattCharacteristic.writeValue).toHaveBeenCalledTimes(2);

        pending[1].resolve();

        await expect(p2).resolves.toBe(true);
        expect(order).toStrictEqual(['start','end','start','end']);
    });

    test.each([{}, Symbol('invalid'), -1, 1n])('rejects non-BufferSource value %p', async (value) => {
        const mockGattCharacteristic = {
            uuid: '00000000-0000-0000-0000-000000000000',
            writeValue: jest.fn(),
            startNotifications: jest.fn(),
            addEventListener: jest.fn(),
            stopNotifications: jest.fn(),
        };

        const c = Characteristic({ characteristic: mockGattCharacteristic, name: 'test' });
        await expect(c.write(value)).resolves.toBe(false);
        expect(mockGattCharacteristic.writeValue).not.toHaveBeenCalled();
    });
});

describe('Characteristic retries and response timeout', () => {
  let gatt;
  let characteristic;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    gatt = {
      uuid: '00000000-0000-0000-0000-000000000000',
      writeValue: jest.fn(),
      startNotifications: jest.fn(),
      addEventListener: jest.fn(),
    };
    characteristic = Characteristic({ characteristic: gatt, name: 'test' });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Allow the serialized writes and retry continuations to settle between timers.
  async function flushPromises() {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  }

  test.each(['write', 'notifications'])('preserves the configured delay across %s retries', async (operation) => {
    const method = operation === 'write' ? gatt.writeValue : gatt.startNotifications;
    method.mockRejectedValueOnce(new Error('busy'))
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce(undefined);

    const result = operation === 'write'
      ? characteristic.writeWithRetry(new Uint8Array([1]), 2, 500)
      : characteristic.startNotificationsWithRetry(jest.fn(), 2, 500);
    await flushPromises();
    expect(method).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(method).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(499);
    await flushPromises();
    expect(method).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1);
    await expect(result).resolves.toBe(true);
    expect(method).toHaveBeenCalledTimes(3);
  });

  test('does not let an earlier response timeout release a later block', () => {
    characteristic.block();
    jest.advanceTimersByTime(500);
    characteristic.block();
    jest.advanceTimersByTime(500);
    expect(characteristic.isReady()).toBe(false);

    jest.advanceTimersByTime(500);
    expect(characteristic.isReady()).toBe(true);
  });

  test('continues the write queue after a failed write', async () => {
    gatt.writeValue.mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce(undefined);
    const first = characteristic.write(new Uint8Array([1]));
    const second = characteristic.write(new Uint8Array([2]));

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(gatt.writeValue).toHaveBeenCalledTimes(2);
  });
});
