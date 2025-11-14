/**
 * 统一日志管理器
 * 在开发环境输出完整日志，生产环境移除所有日志代码
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export type OverlayLog = {
  ts: number;
  level: string;
  message: string | object;
  meta?: any;
};

// --- Debug overlay integration (safe buffer pubsub) ---
const OVERLAY_BUFFER_MAX = 1000;
let overlayBuffer: OverlayLog[] = [];
const overlaySubs = new Set<(logs: OverlayLog[]) => void>();

export function safePushToOverlay(level: string, message: string, meta?: any) {
  try {
    const entry: OverlayLog = { ts: Date.now(), level, message, meta };
    overlayBuffer.push(entry);
    if (overlayBuffer.length > OVERLAY_BUFFER_MAX) {
      overlayBuffer = overlayBuffer.slice(-OVERLAY_BUFFER_MAX);
    }
    const snapshot = overlayBuffer.slice();
    overlaySubs.forEach(cb => {
      try {
        cb(snapshot);
      } catch (_) {
        /* ignore subscriber errors */
      }
    });
  } catch (_) {
    /* swallow to avoid crash in production logging */
  }
}

export function getBufferedLogs(limit = 500): OverlayLog[] {
  return overlayBuffer.slice(-limit);
}

export function exportBufferedLogs(format: 'text' | 'json' = 'text', limit = 200): string {
  const data = getBufferedLogs(limit);
  if (format === 'json') return JSON.stringify(data, null, 2);
  return data
    .map(d =>
      `${new Date(d.ts).toISOString()} | ${d.level} | ${
        typeof d.message === 'string' ? d.message : JSON.stringify(d.message)
      }`
    )
    .join('\n');
}

export function subscribeOverlay(cb: (logs: OverlayLog[]) => void) {
  overlaySubs.add(cb);
  try {
    cb(overlayBuffer.slice());
  } catch (_) {}
  return () => overlaySubs.delete(cb);
}
// --- end overlay integration ---

interface LoggerOptions {
  tag?: string;
  level?: LogLevel;
}

class LoggerClass {
  private minLevel: LogLevel = LogLevel.DEBUG;

  /**
   * 设置最小日志级别
   */
  setMinLevel(level: LogLevel): void {
    if (__DEV__) {
      this.minLevel = level;
    }
  }

  /**
   * 格式化日志输出
   */
  private formatMessage(level: string, tag: string | undefined, message: any, ...args: any[]): void {
    if (!__DEV__) return;

    const timestamp = new Date().toISOString().substr(11, 12);
    const prefix = tag ? `[${timestamp}][${level}][${tag}]` : `[${timestamp}][${level}]`;
    
    switch (level) {
      case 'DEBUG':
        console.log(prefix, message, ...args);
        break;
      case 'INFO':
        console.info(prefix, message, ...args);
        break;
      case 'WARN':
        console.warn(prefix, message, ...args);
        break;
      case 'ERROR':
        console.error(prefix, message, ...args);
        break;
    }
  }

  /**
   * 调试级别日志
   */
  debug(message: any, ...args: any[]): void;
  debug(options: LoggerOptions, message: any, ...args: any[]): void;
  debug(optionsOrMessage: LoggerOptions | any, message?: any, ...args: any[]): void {
    if (!__DEV__ || this.minLevel > LogLevel.DEBUG) return;

    if (typeof optionsOrMessage === 'object' && optionsOrMessage.tag !== undefined) {
      const options = optionsOrMessage as LoggerOptions;
      this.formatMessage('DEBUG', options.tag, message, ...args);
    } else {
      this.formatMessage('DEBUG', undefined, optionsOrMessage, message, ...args);
    }
  }

  /**
   * 信息级别日志
   */
  info(message: any, ...args: any[]): void;
  info(options: LoggerOptions, message: any, ...args: any[]): void;
  info(optionsOrMessage: LoggerOptions | any, message?: any, ...args: any[]): void {
    if (!__DEV__ || this.minLevel > LogLevel.INFO) return;

    if (typeof optionsOrMessage === 'object' && optionsOrMessage.tag !== undefined) {
      const options = optionsOrMessage as LoggerOptions;
      this.formatMessage('INFO', options.tag, message, ...args);
    } else {
      this.formatMessage('INFO', undefined, optionsOrMessage, message, ...args);
    }
  }

  /**
   * 警告级别日志
   */
  warn(message: any, ...args: any[]): void;
  warn(options: LoggerOptions, message: any, ...args: any[]): void;
  warn(optionsOrMessage: LoggerOptions | any, message?: any, ...args: any[]): void {
    if (!__DEV__ || this.minLevel > LogLevel.WARN) return;

    if (typeof optionsOrMessage === 'object' && optionsOrMessage.tag !== undefined) {
      const options = optionsOrMessage as LoggerOptions;
      this.formatMessage('WARN', options.tag, message, ...args);
    } else {
      this.formatMessage('WARN', undefined, optionsOrMessage, message, ...args);
    }
  }

  /**
   * 错误级别日志
   */
  error(message: any, ...args: any[]): void;
  error(options: LoggerOptions, message: any, ...args: any[]): void;
  error(optionsOrMessage: LoggerOptions | any, message?: any, ...args: any[]): void {
    if (!__DEV__ || this.minLevel > LogLevel.ERROR) return;

    if (typeof optionsOrMessage === 'object' && optionsOrMessage.tag !== undefined) {
      const options = optionsOrMessage as LoggerOptions;
      this.formatMessage('ERROR', options.tag, message, ...args);
    } else {
      this.formatMessage('ERROR', undefined, optionsOrMessage, message, ...args);
    }
  }

  withTag(tag: string): LoggerClass {
    const taggedLogger = new LoggerClass();
    taggedLogger.minLevel = this.minLevel;

    const originalDebug = taggedLogger.debug.bind(taggedLogger);
    const originalInfo = taggedLogger.info.bind(taggedLogger);
    const originalWarn = taggedLogger.warn.bind(taggedLogger);
    const originalError = taggedLogger.error.bind(taggedLogger);

    taggedLogger.debug = (message: any, ...args: any[]) => originalDebug({ tag }, message, ...args);
    taggedLogger.info = (message: any, ...args: any[]) => originalInfo({ tag }, message, ...args);
    taggedLogger.warn = (message: any, ...args: any[]) => originalWarn({ tag }, message, ...args);
    taggedLogger.error = (message: any, ...args: any[]) => originalError({ tag }, message, ...args);

    return taggedLogger;
  }
}

export const Logger = new LoggerClass();
export default Logger;
