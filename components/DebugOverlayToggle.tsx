// Minimal patch: runtime require fallback for logger if module/type not present.
// Kept original UI and useSettingsStore usage intact.

import React, { useCallback } from "react";
import { View, Text, StyleSheet, Switch, Platform } from "react-native";
import { useSettingsStore } from "@/stores/settingsStore";
import { emitDebugToast } from "@/utils/debug/DebugToast";

// runtime fallback to avoid TS/packager failure when the module or its types are missing
let debugLog: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  debugLog = require("@/utils/debug/logger").debugLog;
} catch {
  debugLog = () => {};
}

export default function DebugOverlayToggle(): JSX.Element {
  const debugOverlayEnabled = useSettingsStore((s: any) => s.debugOverlayEnabled);
  const setDebugOverlayEnabled = useSettingsStore((s: any) => s.setDebugOverlayEnabled);

  const onToggle = useCallback(
    async (v: boolean) => {
      await setDebugOverlayEnabled(v);
      try {
        emitDebugToast(v ? "Debug overlay enabled" : "Debug overlay disabled");
      } catch {}
      try {
        debugLog("settings", { action: "toggle_debug_overlay", value: v }, "info");
      } catch {}
    },
    [setDebugOverlayEnabled]
  );

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title}>Debug Overlay</Text>
        <Text style={styles.subtitle}>在畫面上顯示開發專用的除錯面板</Text>
      </View>
      <Switch
        value={!!debugOverlayEnabled}
        onValueChange={onToggle}
        trackColor={{ false: "#767577", true: "#4ade80" }}
        thumbColor={Platform.OS === "android" ? (debugOverlayEnabled ? "#fff" : "#fff") : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    backgroundColor: "transparent",
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    color: "#111",
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});
