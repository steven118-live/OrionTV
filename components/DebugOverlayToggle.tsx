import React, { useCallback } from "react";
import { View, Text, StyleSheet, Switch, Platform } from "react-native";
import { useSettingsStore } from "@/stores/settingsStore";
import { emitDebugToast } from "@/src/debug/DebugToast";
import { debugLog } from "@/src/debug/logger";

export default function DebugOverlayToggle(): JSX.Element {
  const debugOverlayEnabled = useSettingsStore((s) => s.debugOverlayEnabled);
  const setDebugOverlayEnabled = useSettingsStore((s) => s.setDebugOverlayEnabled);

  const onToggle = useCallback(
    async (v: boolean) => {
      await setDebugOverlayEnabled(v);
      try {
        emitDebugToast(v ? "Debug overlay enabled" : "Debug overlay disabled");
      } catch {}
      debugLog("settings", { action: "toggle_debug_overlay", value: v }, "info");
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