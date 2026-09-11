import { exists, arrayBufferToArray, wait, print, } from '../functions.js';
import { webBle } from './web-ble.js';

function Characteristic(args = {}) {
    //
    // config
    //
    // BluetoothRemoteGATTCharacteristic
    const _characteristic = args.characteristic;

    // Uuid
    const uuid = _characteristic.uuid;

    // String
    const name = args.name ?? webBle.uuidToName(_characteristic.uuid);

    // Function
    // some browsers don't have writeValueWithResponse,
    // but writeValue is deprecated, so try the first or fall back to the last.
    const writerFn = exists(_characteristic.writeValueWithResponse) ?
          'writeValueWithResponse' :
          'writeValue';

    // Int, ms
    const responseTimeout = args.responseTimeout ?? 1000;

    // end  config

    //
    // state
    //
    // private state

    // Int
    let _responseTimeoutId;

    // Bool
    let _ready = true;

    let abortController;
    let signal;

    // Promise chain to serialize writes; prevents "GATT operation already in progress".
    let _writeChain = Promise.resolve();

    // end private state
    // end state

    // accesor methods
    function isReady() {
        return _ready;
    }
    // end accesor methods

    //
    // methods
    //

    // Function -> Bool;
    async function startNotifications(handler) {
        try {
            abortController = new AbortController();
            signal = { signal: abortController.signal };

            await _characteristic.startNotifications();
            _characteristic.addEventListener(
                'characteristicvaluechanged', (e) => handler(e.target.value), signal
            );

            print.log(`tx: notifications: started: on: ${name} ${uuid}.`);
            return true;
        } catch(e) {
            console.error(`notifications: failed: starting: on: name: ${name} uuid: ${uuid}`, e);
            return false;
        }
    }

    // Function, Int, Int -> Bool;
    async function startNotificationsWithRetry(handler, attempts = 10, txRate = 250) {
        const success = await startNotifications(handler);
        if(success) {
            return true;
        } else {
            if(attempts > 0) {
                await wait(txRate);
                print.log(`tx: startNotificationsWithRetry: fail: 'trying again'`);
                return await startNotificationsWithRetry(handler, attempts-1, txRate);
            } else {
                print.log(`tx: startNotificationsWithRetry: fail: 'give up'`);
                return false;
            }
        }
    }

    // Function -> Bool;
    async function stopNotifications(handler) {
        try {
            await _characteristic.stopNotifications();
            abortController.abort();

            print.log(`notifications: stopped: on: ${name} ${uuid}.`);
            return true;
        } catch(e) {
            console.error(`notifications: failed: stopping: on: name: ${name} uuid: ${uuid}`, e);
            return false;
        }
    }

    // {} -> Any
    async function read(args = {}) {
        const fallback = args.fallback;

        try{
            const value = await _characteristic.readValue();
            return value;
        } catch(e) {
            console.error(`rx: characteristic: :failed :read on: ${name} uuid: ${uuid}`, e);
            return fallback;
        }
    }

    function normalizeWriteValue(value) {
        // Web Bluetooth expects BufferSource (ArrayBuffer | ArrayBufferView).
        if(!exists(value)) return null;
        if(value instanceof ArrayBuffer) return value;
        if(ArrayBuffer.isView(value)) return value;
        return null;
    }

    async function doWrite(value) {
        const normalized = normalizeWriteValue(value);
        if(!normalized) {
            print.warn(`tx: characteristic: failed: write: on: ${name} uuid: ${uuid}`, new Error('write() value must be a BufferSource'));
            return false;
        }
        try{
            await _characteristic[writerFn](normalized);
            return true;
        } catch(e) {
            print.warn(`tx: characteristic: failed: write: on: ${name} uuid: ${uuid} value: [${arrayBufferToArray(normalized)}]`, e);
            return false;
        }
    }

    // DataView -> Bool
    async function write(value) {
        const operation = _writeChain.then(() => doWrite(value));
        _writeChain = operation.catch(() => {});
        return await operation;
    }

    // Any, Int, Int -> Bool
    async function writeWithRetry(value, attempts = 10, txRate = 250) {
        let success = await write(value);
        if(success) {
            print.log(`tx: characteristic: writeWithRetry: success:`);
            return true;
        } else {
            if(attempts > 0) {
                print.log(`tx: characteristic: writeWithRetry: fail: continue:`);
                await wait(txRate);
                return await writeWithRetry(value, attempts-1, txRate);
            } else {
                print.log(`tx: characteristic: writeWithRetry: fail: break:`);
                return false;
            }
        }
    }

    // Void -> Void
    function block() {
        clearTimeout(_responseTimeoutId);
        _responseTimeoutId = setTimeout(release, responseTimeout);
        _ready = false;
    }

    // Void -> Void
    function release() {
        clearTimeout(_responseTimeoutId);
        _ready = true;
    }
    // end methods

    return Object.freeze({
        startNotifications,
        startNotificationsWithRetry,
        stopNotifications,
        read,
        write,
        writeWithRetry,

        isReady,
        block,
        release,
    });
}

export { Characteristic };
