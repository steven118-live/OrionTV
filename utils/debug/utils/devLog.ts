// src/utils/devLog.ts
import Logger from '../../Logger';

const DEFAULT_TAG = "DevLog";
const shortLogger = Logger?.withTag?.(DEFAULT_TAG) ?? Logger;

/**
 * 解析 Error.stack 回傳最接近的呼叫者字串 (format: file:line:col or "unknown")
 */
function getCallerFileLine(skipDepth = 2): string {
  try {
    const err = new Error();
    if (!err.stack) return "unknown";
    const lines = err.stack.split("\n").map((l) => l.trim());
    // lines[0] = "Error"
    // we want the caller line; skipDepth default 2 (devLog -> wrapper -> caller)
    const target = lines[skipDepth + 1] ?? lines[lines.length - 1];
    if (!target) return "unknown";
    return target.replace(/^at\s+/, "");
  } catch {
    return "unknown";
  }
}

/**
 * 稳定 32-bit 哈希 (FNV-1a)
 */
function hashStringToInt(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * logLineShort
 * - tag: optional tag shown in output
 * - skipDepth: 調整 stack depth（預設 2）
 * - maxCode: shortCode 上限 (預設 99999) -> shortCode ∈ [1, maxCode]
 * 回傳 { fileLine, shortCode } 方便進一步使用或測試
 *
 * 注意：輸出僅在 process.env.DEBUG_FLAGS === 'true' 時顯示
 */
export function logLineShort(tag = DEFAULT_TAG, skipDepth = 2, maxCode = 99999) {
  try {
    const enabled = process.env.DEBUG_FLAGS === 'true';
    if (!enabled) return { fileLine: "disabled", shortCode: 0 };

    const caller = getCallerFileLine(skipDepth);
    const parts = caller.split(/\s+/);
    const fileLine = parts[parts.length - 1] ?? caller;
    const h = hashStringToInt(fileLine);
    const bounded = Math.max(1, (h % maxCode) + 1);
    const shortCode = bounded;

    const padLen = String(maxCode).length;
    const out = `[${tag}] ${fileLine} #${String(shortCode).padStart(padLen, "0")}`;

    // 三路輸出：console + debug + Logger
    try {
      console.log(out);
      if (console.debug) console.debug(out);
    } catch {
      /* ignore console errors */
    }

    try {
      shortLogger?.info?.(out);
    } catch {
      /* ignore logger errors */
    }

    return { fileLine, shortCode };
  } catch {
    return { fileLine: "unknown", shortCode: 0 };
  }
}

export default {
  logLineShort,
};
