import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  Platform,
} from "react-native";
import PositionableFAB from "./PositionableFAB";

/**
 * DebugOverlay with:
 * - batched log updates (reduce UI churn)
 * - globalThis.__pushAppDebug safe wrapper
 * - focuses Close button when panel opens (TV)
 * - uses pointerEvents="box-none" on parent
 */

export default function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const pendingRef = useRef<string[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeRef = useRef<any>(null);

  useEffect(() => {
    mountedRef.current = true;
    // safe global push that batches UI updates
    // @ts-ignore
    globalThis.__pushAppDebug = (msg: string) => {
      try {
        if (!mountedRef.current) return;
        pendingRef.current.push(`${new Date().toLocaleTimeString()} ${msg}`);
        if (!batchTimerRef.current) {
          batchTimerRef.current = setTimeout(() => {
            setLogs((prev) => {
              const batch = pendingRef.current.splice(0);
              batchTimerRef.current = null;
              const next = prev.concat(batch).slice(-200);
              return next;
            });
          }, 180);
        }
      } catch (_) {}
    };
    return () => {
      mountedRef.current = false;
      // @ts-ignore
      try {
        delete globalThis.__pushAppDebug;
      } catch (_) {}
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };
  }, []);

  // Close overlay on hardware back when open
  useEffect(() => {
    const handler = () => {
      if (open) {
        setOpen(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [open]);

  // When panel opens, on TV request focus for closeRef by rendering hasTVPreferredFocus on it
  useEffect(() => {
    // small microtask to allow component to mount before focus hint
    if (open && Platform.isTV && closeRef.current && typeof closeRef.current.setNativeProps === "function") {
      try {
        // hasTVPreferredFocus prop on Pressable will do the main job; this is a light fallback
        closeRef.current.setNativeProps?.({ hasTVPreferredFocus: true });
      } catch (_) {}
    }
  }, [open]);

  const clearLogs = useCallback(() => setLogs([]), []);
  const copyLogs = useCallback(async () => {
    try {
      const joined = logs.join("\n");
      const Clipboard = require("@react-native-clipboard/clipboard");
      Clipboard && Clipboard.setString(joined);
      // @ts-ignore
      globalThis.__pushAppDebug?.("[DBG_COPY] logs copied");
    } catch (_) {}
  }, [logs]);

  const panelStyle: ViewStyle = {
    position: "absolute",
    right: 12,
    top: 40,
    width: Math.min(420, Dimensions.get("window").width - 24),
    height: Math.min(420, Dimensions.get("window").height - 80),
    backgroundColor: "rgba(6,6,6,0.95)",
    borderRadius: 8,
    padding: 12,
    zIndex: 99998,
  };

  return (
    <View pointerEvents="box-none" style={styles.overlayContainer}>
      <PositionableFAB onPress={() => setOpen(true)} initial="center" />

      {open && (
        <View style={panelStyle} pointerEvents="box-none">
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Debug Overlay</Text>
            <View style={styles.headerButtons}>
              <Pressable
                ref={closeRef}
                hasTVPreferredFocus={open}
                onPress={() => setOpen(false)}
                style={styles.iconButton}
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Close debug overlay"
              >
                <Text style={styles.iconText}>Close</Text>
              </Pressable>

              <Pressable onPress={clearLogs} style={styles.iconButton} focusable={true} accessibilityRole="button" accessibilityLabel="Clear logs">
                <Text style={styles.iconText}>Clear</Text>
              </Pressable>

              <Pressable onPress={copyLogs} style={styles.iconButton} focusable={true} accessibilityRole="button" accessibilityLabel="Copy logs">
                <Text style={styles.iconText}>Copy</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.logContainer}>
            {logs.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No logs</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {logs
                  .slice()
                  .reverse()
                  .map((l, i) => (
                    <View key={i} style={styles.logRow}>
                      <Text style={styles.logText}>{l}</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/* styles */

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  headerButtons: {
    flexDirection: "row",
  },
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  iconText: {
    color: "#fff",
    fontSize: 12,
  },
  logContainer: {
    marginTop: 12,
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
  },
  logRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  logText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
});