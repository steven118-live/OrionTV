/**
 * logger_augment.ts
 *
 * Non-invasive augmentation layer for the existing OrionTV/utils/Logger.ts
 * - Does NOT modify the original file.
 * - Detects existing methods on the original Logger and only adds missing ones.
 * - Provides: in-memory ring buffer, safe startDebug/stopDebug persistence, legacy helpers (logLineShort/logLine)
 * - If original Logger already exposes an API, augmentation will NOT override it.
 *
 * Usage:
 *  - Prefer: import Logger from './Logger' (existing usage remains)
 *  - If you want augmentation immediately available, import this module once during app bootstrap:
 *      import './utils/logger_augment';
 *
 * This file intentionally keeps additions minimal and defensive.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import OriginalLoggerDefault, * as OriginalNamed from './Logger';

type AnyFn = (...args: any[]) => any;
const STORAGE_KEY = 'ORIONTV_DEBUG_ENABLED_AUGMENT';
const DEFAULT_BUFFER_SIZE = 2000;

function isObject(val: any): val is Record<string, any> {
  return val !== null && typeof val === 'object';
}

// Resolve original default export (could be class instance or object)
const OriginalLogger: any =
  (OriginalNamed && (OriginalNamed.Logger || OriginalNamed.default)) ||
  OriginalLoggerDefault ||
  (OriginalNamed as any).default ||
  null;

// If nothing found, create a minimal fallback logger object to avoid runtime crashes.
// We still won't replace any project file; fallback only used if original export missing.
if (!OriginalLogger) {
  // minimal fallback (should be rare)
  (global as any).__ORIONTV_LOGGER_FALLBACK__ = true;
  // eslint-disable-next-line no-console
  console.warn('[logger_augment] original Logger export not found; using fallback logger.');
  (OriginalNamed as any).Logger = (OriginalNamed as any).default = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

// We'll operate on the instance referenced by OriginalLogger (it might be the exported singleton).
const loggerInstance: any = OriginalLogger;

// --- In-memory ring buffer (private to augment) ---
class RingBuffer<T> {
  private size: number;
  private buf: T[] = [];
  constructor(size = DEFAULT_BUFFER_SIZE) {
    this.size = size;
  }
  push(item: T) {
    this.buf.push(item);
    if (this.buf.length > this.size) {
      this.buf.splice(0, this.buf.length - this.size);
    }
  }
  all() {
    return this.buf.slice();
  }
  clear() {
    this.buf = [];
  }
  export() {
    try {
      return JSON.stringify(this.buf);
    } catch {
      return '[]';
    }
  }
}

type LogEntry = { ts: string; level: string; tag?: string; message: any; args?: any[] };
const augmentBuffer = new RingBuffer<LogEntry>(DEFAULT_BUFFER_SIZE);

// timestamp helper (non-invasive)
function tsNow() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

// Helper to detect if method exists and is callable
function hasMethod(obj: any, name: string): obj is { [k: string]: AnyFn } {
  return isObject(obj) && typeof obj[name] === 'function';
}

// Safe emit used by augment only when original doesn't provide buffering
// NOTE: accept args as an array (third parameter) to avoid invalid spread of an array
function augmentEmit(level: string, tag: string | undefined, message: any, args?: any[]) {
  const entry: LogEntry = { ts: tsNow(), level, tag, message, args: args ? args.slice() : [] };
  augmentBuffer.push(entry);
  // if original has console-level method, prefer to call it AFTER buffer push
  // Do NOT replace original console behavior; just call original if available and enabled.
  try {
    if (hasMethod(loggerInstance, 'emit') && typeof loggerInstance.emit === 'function') {
      // if original has an emit-like API, prefer it
      try {
        if (Array.isArray(args) && args.length) {
          loggerInstance.emit(level, tag, message, ...args);
        } else {
          loggerInstance.emit(level, tag, message);
        }
      } catch {
        /* ignore */
      }
    } else {
      // fallback: call original level methods if present
      const method =
        level === 'DEBUG' ? 'debug' : level === 'INFO' ? 'info' : level === 'WARN' ? 'warn' : 'error';
      if (hasMethod(loggerInstance, method)) {
        try {
          if (tag) {
            // if tag provided, pass it as first arg
            loggerInstance[method]({ tag }, message, ...(args ?? []));
          } else {
            loggerInstance[method](message, ...(args ?? []));
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    // swallow any augmentation-time errors
  }
}

// --- Provide buffer API only if original doesn't provide it ---
if (!hasMethod(loggerInstance, 'getBuffer')) {
  Object.defineProperty(loggerInstance, 'getBuffer', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: () => augmentBuffer.all(),
  });
}
if (!hasMethod(loggerInstance, 'clearBuffer')) {
  Object.defineProperty(loggerInstance, 'clearBuffer', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: () => augmentBuffer.clear(),
  });
}
if (!hasMethod(loggerInstance, 'exportBuffer')) {
  Object.defineProperty(loggerInstance, 'exportBuffer', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: () => augmentBuffer.export(),
  });
}

// --- Provide startDebug/stopDebug persistence only if original missing them ---
if (!hasMethod(loggerInstance, 'startDebug')) {
  Object.defineProperty(loggerInstance, 'startDebug', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: async (secret?: string) => {
      // legacy behavior: only enable in dev; but augmentation will persist flag anyway
      try {
        await AsyncStorage.setItem(STORAGE_KEY, '1');
      } catch {}
      // If original has a method to actually enable logging, prefer to call it (if present), otherwise just return true
      if (hasMethod(loggerInstance, 'setMinLevel') || hasMethod(loggerInstance, 'enable')) {
        // no-op: we don't assume internals; we rely on consumer to check Logger.isEnabled or similar
      }
      return true;
    },
  });
}

if (!hasMethod(loggerInstance, 'stopDebug')) {
  Object.defineProperty(loggerInstance, 'stopDebug', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: async () => {
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {}
    },
  });
}

// --- Backfill simple legacy helpers if missing (logLineShort, logLine) ---
// Only add when they don't exist; if original defines them, leave original behavior intact.
if (!hasMethod(loggerInstance, 'logLineShort')) {
  Object.defineProperty(loggerInstance, 'logLineShort', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: (...args: any[]) => {
      // map to debug if exists else to info
      if (hasMethod(loggerInstance, 'debug')) {
        try {
          loggerInstance.debug(...args);
          return;
        } catch {}
      }
      if (hasMethod(loggerInstance, 'info')) {
        try {
          loggerInstance.info(...args);
          return;
        } catch {}
      }
    },
  });
}

if (!hasMethod(loggerInstance, 'logLine')) {
  Object.defineProperty(loggerInstance, 'logLine', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: (...args: any[]) => {
      if (hasMethod(loggerInstance, 'info')) {
        try {
          loggerInstance.info(...args);
          return;
        } catch {}
      }
      if (hasMethod(loggerInstance, 'debug')) {
        try {
          loggerInstance.debug(...args);
          return;
        } catch {}
      }
    },
  });
}

// --- Intercept original debug/info/warn/error to populate augmentBuffer if original does not already keep a buffer ---
// We will only wrap if original has no getBuffer (meaning it didn't provide a buffer we can read).
if (!hasMethod(loggerInstance, 'getBuffer')) {
  ['debug', 'info', 'warn', 'error'].forEach((levelName) => {
    if (hasMethod(loggerInstance, levelName)) {
      const origFn = loggerInstance[levelName] as AnyFn;
      // wrapped is the decorator around the original logger method
      const wrapped: AnyFn = function (this: any, ...args: any[]) {
        try {
          // Call augmentEmit with args as an array (avoids spreading an array as varargs at call site)
          augmentEmit(levelName.toUpperCase(), undefined, args[0], args.slice(1));
          // call original function with correct this and original args
          return origFn.apply(this, args);
        } catch (e) {
          // if augmentation fails, fall back to original behaviour
          try {
            return origFn.apply(this, args);
          } catch {
            // swallow to avoid breaking host app
            return undefined;
          }
        }
      };
      try {
        // replace the method on the loggerInstance with the wrapped version (non-enumerable)
        Object.defineProperty(loggerInstance, levelName, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: wrapped,
        });
      } catch {
        // if defineProperty fails for some reason, fall back to direct assign
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (loggerInstance as any)[levelName] = wrapped;
      }
    }
  });
}

// Export augmented reference (same instance as original), but safe-typed
export const Logger: any = loggerInstance as any;

// Re-export convenience functions if consumers prefer named imports from this file
export const getBuffer = Logger.getBuffer ? () => Logger.getBuffer() : () => augmentBuffer.all();
export const clearBuffer = Logger.clearBuffer ? () => Logger.clearBuffer() : () => augmentBuffer.clear();
export const exportBuffer = Logger.exportBuffer ? () => Logger.exportBuffer() : () => augmentBuffer.export();
export const startDebug = Logger.startDebug ? (async (s?: string) => Logger.startDebug(s)) : (async () => false);
export const stopDebug = Logger.stopDebug ? (async () => Logger.stopDebug()) : (async () => {});

// Default export matches original default export shape (the same instance)
export default Logger;
