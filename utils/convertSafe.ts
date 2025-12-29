// utils/convertSafe
/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenCC from 'opencc-js';

/**
 * 目的
 * - 避免在含有 URL、電子郵件、Rev 標記、程式碼標記或注音符號時做轉換（跳過）
 * - 提供同步快速快取轉換、以及非同步安全轉換 API
 */

// 匹配：URL | Rev### | email | 特殊字元 | Bopomofo (注音) Unicode 範圍
const SKIP_PATTERN = /https?:\/\/|\bRev\d+\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|[`<>]|\u3100-\u312F|\u31A0-\u31BF/;

type ConverterFunc = (s: string) => string;

// 建立兩個方向的 converter
const cn2tw: ConverterFunc =
  (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'cn', to: 'tw' }) : (s: string) => s;

const tw2cn: ConverterFunc =
  (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: 'tw', to: 'cn' }) : (s: string) => s;

const convertCache = new Map<string, string>();

export function shouldSkipConvert(s?: string | null): boolean {
  if (!s) return true;
  if (typeof s !== 'string') return true;
  if (!s.trim()) return true;
  if (SKIP_PATTERN.test(s)) return true;
  return false;
}

/**
 * 簡→繁（快速快取）
 */
export function convertCn2TwFast(s: string): string {
  if (!s) return s;
  const cached = convertCache.get(`cn2tw:${s}`);
  if (cached) return cached;
  if (shouldSkipConvert(s)) return s;
  try {
    const out = cn2tw(s);
    if (out && out !== s) convertCache.set(`cn2tw:${s}`, out);
    return out;
  } catch {
    return s;
  }
}

/**
 * 繁→簡（快速快取）
 */
export function convertTw2CnFast(s: string): string {
  if (!s) return s;
  const cached = convertCache.get(`tw2cn:${s}`);
  if (cached) return cached;
  if (shouldSkipConvert(s)) return s;
  try {
    const out = tw2cn(s);
    if (out && out !== s) convertCache.set(`tw2cn:${s}`, out);
    return out;
  } catch {
    return s;
  }
}

/**
 * 非同步安全轉換（簡→繁）
 */
export async function convertCn2TwSafeAsync(s: string): Promise<string> {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  try {
    const out = cn2tw(s);
    if (out && out !== s) convertCache.set(`cn2tw:${s}`, out);
    return out;
  } catch {
    return s;
  }
}

/**
 * 非同步安全轉換（繁→簡）
 */
export async function convertTw2CnSafeAsync(s: string): Promise<string> {
  if (!s) return s;
  if (shouldSkipConvert(s)) return s;
  try {
    const out = tw2cn(s);
    if (out && out !== s) convertCache.set(`tw2cn:${s}`, out);
    return out;
  } catch {
    return s;
  }
}

/** 清除快取 */
export function clearConvertCache() {
  convertCache.clear();
}
