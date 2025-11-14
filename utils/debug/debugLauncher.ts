/**
 * debugLauncher
 * - export startDebugOverlay(): 保證 global push 存在，並在 global flag 上標記已啟動
 * - export stopDebugOverlay(): 可選的關閉標記
 *
 * 使用情境：
 * - 你只需在任意模組呼叫 startDebugOverlay()
 * - 但要讓 UI 真的渲染 Overlay，需要在 App 根（index.tsx 或 App root）放一個 conditional render，該 render 只讀取 global flag (一次性改動)
 */

import * as DebugOverlayMod from "./DebugOverlay";
const ensureGlobalPush =
  (DebugOverlayMod as any).ensureGlobalPush ??
  (DebugOverlayMod as any).default ??
  (DebugOverlayMod as any);

import Logger from "@/utils/Logger";

// flag name 決定 UI 是否顯示 overlay
const FLAG = "__DEBUG_OVERLAY_ENABLED__";

export function startDebugOverlay() {
  try {
    ensureGlobalPush();
    // @ts-ignore
    globalThis[FLAG] = true;
    // push a startup message
    // @ts-ignore
    globalThis.__pushAppDebug?.("[DEBUG_LAUNCHER] started");
    return true;
  } catch (e) {
    return false;
  }
}

export function stopDebugOverlay() {
  try {
    // @ts-ignore
    globalThis[FLAG] = false;
    return true;
  } catch {
    return false;
  }
}

export function isDebugOverlayEnabled() {
  try {
    // @ts-ignore
    return Boolean(globalThis[FLAG]);
  } catch {
    return false;
  }
}
