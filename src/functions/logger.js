/**
 * Structured logging utility for Auuki.
 *
 * Provides consistent logging with levels, tags, and optional structured data.
 * In production, only warnings and errors are emitted by default.
 *
 * @example
 * import { log, logger } from './functions/logger.js';
 *
 * log.info('ble', 'Device connected', { name: 'Tacx Neo' });
 * log.warn('workout', 'Step skipped due to invalid target');
 * log.error('persistence', 'Failed to save settings', error);
 *
 * // Per-module logger
 * const bleLog = logger('ble');
 * bleLog.info('Connected');
 * bleLog.debug('Raw data', dataView);
 */

const LogLevel = Object.freeze({
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
});

// Default level based on environment
const DEFAULT_LEVEL = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
  ? LogLevel.warn
  : LogLevel.debug;

let currentLevel = DEFAULT_LEVEL;

/**
 * Set the minimum log level.
 * @param {'debug' | 'info' | 'warn' | 'error' | 'silent'} level
 */
function setLevel(level) {
  if (level in LogLevel) {
    currentLevel = LogLevel[level];
  }
}

/**
 * Get the current log level name.
 * @returns {'debug' | 'info' | 'warn' | 'error' | 'silent'}
 */
function getLevel() {
  return Object.keys(LogLevel).find(k => LogLevel[k] === currentLevel) ?? 'debug';
}

/**
 * Format a log message with tag.
 * @param {string} tag - Module or subsystem tag
 * @param {string} message - Log message
 * @returns {string}
 */
function formatMessage(tag, message) {
  const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
  return `[${timestamp}] :${tag} ${message}`;
}

/**
 * Log at debug level.
 * @param {string} tag
 * @param {string} message
 * @param {...any} data
 */
function debug(tag, message, ...data) {
  if (currentLevel > LogLevel.debug) return;
  console.debug(formatMessage(tag, message), ...data);
}

/**
 * Log at info level.
 * @param {string} tag
 * @param {string} message
 * @param {...any} data
 */
function info(tag, message, ...data) {
  if (currentLevel > LogLevel.info) return;
  console.log(formatMessage(tag, message), ...data);
}

/**
 * Log at warn level.
 * @param {string} tag
 * @param {string} message
 * @param {...any} data
 */
function warn(tag, message, ...data) {
  if (currentLevel > LogLevel.warn) return;
  console.warn(formatMessage(tag, message), ...data);
}

/**
 * Log at error level.
 * @param {string} tag
 * @param {string} message
 * @param {...any} data
 */
function error(tag, message, ...data) {
  if (currentLevel > LogLevel.error) return;
  console.error(formatMessage(tag, message), ...data);
}

/**
 * Create a logger bound to a specific tag.
 * @param {string} tag - Module or subsystem tag
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 */
function logger(tag) {
  return Object.freeze({
    debug: (message, ...data) => debug(tag, message, ...data),
    info: (message, ...data) => info(tag, message, ...data),
    warn: (message, ...data) => warn(tag, message, ...data),
    error: (message, ...data) => error(tag, message, ...data),
  });
}

const log = Object.freeze({
  debug,
  info,
  warn,
  error,
  setLevel,
  getLevel,
});

export { log, logger, LogLevel, setLevel, getLevel };
export default log;
