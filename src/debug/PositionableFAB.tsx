import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  TVEventHandler,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Preset =
  | "right-bottom"
  | "right-center"
  | "right-top"
  | "left-bottom"
  | "left-center"
  | "left-top"
  | "center";

export type PositionableFABStorage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

export type PositionableFABProps = {
  onPress: () => void;
  initial?: Preset;
  storageKey?: string;
  persist?: boolean;
  label?: string;
  storage?: PositionableFABStorage;
};

const DEFAULT_STORAGE_KEY = "DBG_FAB_POS";
const DRAG_THRESHOLD = 4;
const LONG_PRESS_MS = 600;

const presets: Record<Preset, { left: string; top: string }> = {
  "right-bottom": { left: "90%", top: "90%" },
  "right-center": { left: "90%", top: "50%" },
  "right-top": { left: "90%", top: "10%" },
  "left-bottom": { left: "10%", top: "90%" },
  "left-center": { left: "10%", top: "50%" },
  "left-top": { left: "10%", top: "10%" },
  center: { left: "50%", top: "50%" },
};

function useSavedPreset(
  key: string,
  initial: Preset,
  persist: boolean,
  storage?: PositionableFABStorage
) {
  const [preset, setPreset] = useState<Preset>(initial);
  const store = storage ?? {
    getItem: async (k: string) => AsyncStorage.getItem(k),
    setItem: async (k: string, v: string) => AsyncStorage.setItem(k, v),
  };

  useEffect(() => {
    if (!persist) return;
    let mounted = true;
    (async () => {
      try {
        const s = await store.getItem(key);
        if (!mounted) return;
        if (s && (presets as any)[s]) setPreset(s as Preset);
      } catch (_) {}
    })();
    return () => {
      mounted = false;
    };
  }, [key, persist, store]);

  useEffect(() => {
    if (!persist) return;
    (async () => {
      try {
        await store.setItem(key, preset);
      } catch (_) {}
    })();
  }, [key, preset, persist, store]);

  return { preset, setPreset };
}

export default function PositionableFAB({
  onPress,
  initial = "center",
  storageKey = DEFAULT_STORAGE_KEY,
  persist = true,
  label = "DBG",
  storage,
}: PositionableFABProps) {
  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const { preset, setPreset } = useSavedPreset(storageKey, initial, persist, storage);
  const movedRef = useRef(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const tvEventHandlerRef = useRef<any>(null);

  const animateReset = useCallback(() => {
    Animated.timing(translate, {
      toValue: { x: 0, y: 0 },
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translate]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        movedRef.current = false;
      },
      onPanResponderMove: (_, g) => {
        movedRef.current = true;
        translate.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        if (movedRef.current) {
          const { width, height } = Dimensions.get("window");
          const cx = Math.max(0, Math.min(width, g.moveX ?? g.dx + width / 2));
          const cy = Math.max(0, Math.min(height, g.moveY ?? g.dy + height / 2));
          let col: "left" | "center" | "right" = "center";
          let row: "top" | "center" | "bottom" = "center";
          if (cx < width * 0.33) col = "left";
          else if (cx > width * 0.66) col = "right";
          if (cy < height * 0.33) row = "top";
          else if (cy > height * 0.66) row = "bottom";
          const key = `${col}-${row}` as keyof typeof presets;
          if ((presets as any)[key]) setPreset(key as Preset);
          else setPreset("center");
          animateReset();
        } else {
          onPress();
        }
      },
    })
  ).current;

  useEffect(() => {
    // TV fallback: use TVEventHandler if available to detect select/ok presses reliably
    if (!Platform.isTV) return;
    try {
      const tvHandler = new TVEventHandler();
      tvHandler.enable(null, (_cmp, evt) => {
        // evt.eventType may be 'select' on some runtimes; on AndroidTV some use keyDown events
        const t = (evt && (evt.eventType || evt.type)) || null;
        if (t === "select" || t === "playPause" || (evt && (evt.action === "select" || evt.eventKeyAction === 0))) {
          // treat as OK/select
          onPress();
        }
      });
      tvEventHandlerRef.current = tvHandler;
    } catch (_) {
      tvEventHandlerRef.current = null;
    }
    return () => {
      try {
        if (tvEventHandlerRef.current) {
          tvEventHandlerRef.current.disable();
          tvEventHandlerRef.current = null;
        }
      } catch (_) {}
    };
  }, [onPress]);

  const onPressIn = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      const keys = Object.keys(presets) as Preset[];
      const idx = keys.indexOf(preset);
      const next = keys[(idx + 1) % keys.length];
      setPreset(next);
    }, LONG_PRESS_MS);
  };

  const onPressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const containerStyle: ViewStyle = {
    position: "absolute",
    left: presets[preset].left,
    top: presets[preset].top,
    zIndex: 99999,
  };

  return (
    <Animated.View style={[containerStyle, { transform: translate.getTranslateTransform() }]}>
      <TouchableOpacity
        {...panResponder.panHandlers}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
        focusable={true}
        accessibilityRole="button"
        accessibilityLabel={`Debug button, position ${preset}`}
        hasTVPreferredFocus={false}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.fab}
      >
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  label: {
    color: "#fff",
    fontWeight: "700",
  },
});