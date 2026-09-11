import { log, logger, LogLevel, setLevel, getLevel } from '../../src/functions/logger.js';

describe('logger', () => {
    let consoleDebugSpy;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // Reset to debug level for tests
        setLevel('debug');
    });

    afterEach(() => {
        consoleDebugSpy.mockRestore();
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('log levels', () => {
        test('LogLevel has correct numeric values', () => {
            expect(LogLevel.debug).toBe(0);
            expect(LogLevel.info).toBe(1);
            expect(LogLevel.warn).toBe(2);
            expect(LogLevel.error).toBe(3);
            expect(LogLevel.silent).toBe(4);
        });

        test('setLevel and getLevel work correctly', () => {
            setLevel('warn');
            expect(getLevel()).toBe('warn');

            setLevel('debug');
            expect(getLevel()).toBe('debug');
        });

        test('invalid level is ignored', () => {
            setLevel('debug');
            setLevel('invalid');
            expect(getLevel()).toBe('debug');
        });
    });

    describe('log functions', () => {
        test('log.debug calls console.debug with formatted message', () => {
            log.debug('test-tag', 'test message');
            expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
            const call = consoleDebugSpy.mock.calls[0][0];
            expect(call).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] :test-tag test message/);
        });

        test('log.info calls console.log', () => {
            log.info('test-tag', 'test message');
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        });

        test('log.warn calls console.warn', () => {
            log.warn('test-tag', 'test message');
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        });

        test('log.error calls console.error', () => {
            log.error('test-tag', 'test message');
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });

        test('extra data is passed to console', () => {
            const data = { key: 'value' };
            log.info('tag', 'message', data);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(String), data);
        });
    });

    describe('log level filtering', () => {
        test('debug log is suppressed when level is info', () => {
            setLevel('info');
            log.debug('tag', 'message');
            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        test('info log is suppressed when level is warn', () => {
            setLevel('warn');
            log.info('tag', 'message');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        test('warn log is suppressed when level is error', () => {
            setLevel('error');
            log.warn('tag', 'message');
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('all logs are suppressed when level is silent', () => {
            setLevel('silent');
            log.debug('tag', 'message');
            log.info('tag', 'message');
            log.warn('tag', 'message');
            log.error('tag', 'message');
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe('logger factory', () => {
        test('creates bound logger with tag', () => {
            const bleLog = logger('ble');
            bleLog.info('Connected');
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            const call = consoleLogSpy.mock.calls[0][0];
            expect(call).toMatch(/:ble Connected/);
        });

        test('bound logger respects log levels', () => {
            setLevel('warn');
            const bleLog = logger('ble');
            bleLog.debug('debug message');
            bleLog.info('info message');
            bleLog.warn('warn message');
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        });
    });
});
