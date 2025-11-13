// src/debug/DebugToast.tsx
import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { getDebugFlags } from "./flags";

let emitter: ((s: string) => void) | null = null;

export function emitDebugToast(s: string) {
  if (getDebugFlags().ui_feedback === false) return;
  emitter && emitter(s);
}

export default function DebugToast() {
  const [text, setText] = useState<string | null>(null);
  const anim = new Animated.Value(0);

  useEffect(() => {
    emitter = (s: string) => {
      setText(s);
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setText(null));
    };
    return () => {
      emitter = null;
    };
  }, []);

  if (!text) return null;
  return (
    <Animated.View style={[styles.container, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }]}>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 110,
    left: 24,
    right: 24,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
    zIndex: 999999,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 13,
  },
});