// src/debug/logger.ts
import { getDebugFlags } from "./flags";

/** limit message size to prevent huge logs */
const MAX_MSG_LEN = 10000;

function truncateMsg(v: string) {
  if (v.length <= MAX_MSG_LEN) return v;
  return v.slice(0, MAX_MSG_LEN) + "...(truncated)";
}

/** try to parse stack to find caller file:line */
function extractCallerLocation(stack?: string): string | null {
  if (!stack) return null;
  // stack lines vary across engines; this heuristic covers RN JSCore / Hermes / V8 styles
  const lines = stack.split("\n").map((l) => l.trim()).filter(Boolean);
  // skip first line (Error)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // pattern examples:
    // at MyComponent (index.android.bundle:1234:56)
    // at Object.<anonymous> (/path/to/file.js:12:34)
    const m = line.match(/(?:\(|\s)([^\s()]+\.js(?::\d+:\d+)?)/);
    if (m && m[1]) return m[1];
  }
  return null;
}

/** main debug logger */
export function debugLog(tag: string, payload: any, level: "debug" | "info" | "warn" | "error" = "debug") {
  const flags = getDebugFlags();
  if (!flags.verbose && level === "debug") return;
  // decide whether to show network logs etc.
  if (!flags.network_log && /network|http|fetch|xhr/i.test(tag)) return;

  const time = new Date().toISOString();
  let msgStr: string;
  if (typeof payload === "string") msgStr = payload;
  else {
    try {
      msgStr = JSON.stringify(payload);
    } catch (_) {
      msgStr = String(payload);
    }
  }
  msgStr = truncateMsg(msgStr);

  let loc: string | null = null;
  if (flags.line_trace) {
    const err = new Error();
    // Error.stack is sometimes undefined in RN release; guard it
    loc = extractCallerLocation(err.stack);
  }

  const out = {
    time,
    level,
    tag,
    location: loc,
    message: msgStr,
  };

  // push to global debug overlay if exists
  try {
    // @ts-ignore
    if (globalThis.__pushAppDebug && typeof globalThis.__pushAppDebug === "function") {
      // single-line formatted for overlay
      const single = `${time} [${level.toUpperCase()}] ${tag}${loc ? ` ${loc}` : ""} ${msgStr}`;
      // @ts-ignore
      globalThis.__pushAppDebug(single);
    }
  } catch (_) {}

  // also output to console for developer workflows
  if (level === "error" || level === "warn") console[level](out);
  else console.log(out);
}