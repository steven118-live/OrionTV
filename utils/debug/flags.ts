// src/debug/flags.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DebugFlags = {
  line_trace: boolean;
  ui_feedback: boolean;
  download_status: boolean;
  network_log: boolean;
  verbose: boolean;
};

const DEFAULT_FLAGS: DebugFlags = {
  line_trace: false,
  ui_feedback: true,
  download_status: true,
  network_log: false,
  verbose: false,
};

const STORAGE_KEY = "DBG_FLAGS_V1";

let flags: DebugFlags = { ...DEFAULT_FLAGS };

export async function loadFlags() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      flags = { ...DEFAULT_FLAGS, ...(JSON.parse(raw) as Partial<DebugFlags>) };
    }
  } catch (_) {}
}

export function getDebugFlags(): DebugFlags {
  return { ...flags };
}

export async function setDebugFlags(next: Partial<DebugFlags>, persist = true) {
  flags = { ...flags, ...next };
  if (persist) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch (_) {}
  }
}