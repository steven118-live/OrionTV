// components/settings/UIHeaderAutoHideSection.tsx
import React from "react";
import { View, Switch, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useUIStore } from "@/stores/uiStore";

type Props = {
  onChanged?: () => void;
  onFocus?: () => void;
};

export const UIHeaderAutoHideSection = ({ onChanged, onFocus }: Props) => {
  const enableHeaderAutoHide = useUIStore((state) => state.enableHeaderAutoHide);

  const handleToggle = () => {
    useUIStore.setState((state) => ({
      enableHeaderAutoHide: !state.enableHeaderAutoHide,
    }));
    onChanged?.();
  };

  return (
    <Pressable
      onPress={handleToggle}
      onFocus={onFocus}
      style={({ focused }) => ({
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: focused ? 3 : 0,
        borderColor: focused ? "#00FFAA" : "transparent",
      })}
      // ← 錯誤 2：改成正確的 TV 焦點屬性
      focusable={true}
      hasTVPreferredFocus={false} // 如果需要首選焦點再設 true
    >
      <ThemedText style={{ fontSize: 17, color: "#fff" }}>
        隱藏頂部欄（TV / 平板）
      </ThemedText>
      <Switch
        value={enableHeaderAutoHide}
        onValueChange={handleToggle}
      />
    </Pressable>
  );
};