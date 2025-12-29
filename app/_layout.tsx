// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Platform, View, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import LoginModal from "@/components/LoginModal";
import useAuthStore from "@/stores/authStore";
import { useUpdateStore, initUpdateStore } from "@/stores/updateStore";
import { UpdateModal } from "@/components/UpdateModal";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useApiConfig } from "@/hooks/useApiConfig";
import Logger from "@/utils/Logger";
import { api } from "@/services/api";

const logger = Logger.withTag("RootLayout");
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = "dark";
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // SettingsStore
  const { apiBaseUrl, remoteInputEnabled } = useSettingsStore();
  const { startServer, stopServer } = useRemoteControlStore();
  const { checkLoginStatus } = useAuthStore();
  const { checkForUpdate, lastCheckTime } = useUpdateStore();
  const responsiveConfig = useResponsiveLayout();
  const apiStatus = useApiConfig();

  const hasInitialized = useRef(false);

  // Step 1: 載入 settingsStore 設定 + 初始化 update store
  useEffect(() => {
    useSettingsStore.getState().loadSettings();
    initUpdateStore();
  }, []);

  useEffect(() => {
    if (apiBaseUrl) checkLoginStatus(apiBaseUrl);
  }, [apiBaseUrl, checkLoginStatus]);

  // Step 2: 字型載入完成 → 隱藏 Splash
  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (fontError) logger.warn("字型載入失敗", fontError);
    }
  }, [fontsLoaded, fontError]);

  // Step 3: 核心初始化（只執行一次）
  useEffect(() => {
    if (!apiStatus.isValid || (!fontsLoaded || fontError) || hasInitialized.current) return;
    hasInitialized.current = true;

    const preloadApp = async () => {
      try {
        logger.info("TrackPlayer initialized");

        // API 健康檢查 + 重試
        const apiPing = async (retries = 3, timeoutMs = 2000) => {
          for (let i = 0; i < retries; i++) {
            try {
              await Promise.race([
                (api as any).get("/ping"),
                new Promise((_, reject) => setTimeout(() => reject(new Error("API ping timeout")), timeoutMs))
              ]);
              logger.info("API warm-up 成功");
              return;
            } catch (err) {
              logger.warn(`API warm-up 第 ${i + 1} 次失敗:`, err);
              if (i === retries - 1) throw err;
            }
          }
        };

        await apiPing();
      } catch (err) {
        logger.warn("API warm-up 最終失敗", err);
      }
    };

    preloadApp();
  }, [apiStatus.isValid, fontsLoaded, fontError, lastCheckTime, checkForUpdate]);

  // Step 4: 根據 remoteInputEnabled 啟動/停止 server
  useEffect(() => {
    // 只有在非手机端才启动远程控制服务器
    if (remoteInputEnabled && responsiveConfig.deviceType !== "mobile") {
      startServer();
    } else {
      stopServer();
    }
  }, [remoteInputEnabled, startServer, stopServer, responsiveConfig.deviceType]);

  // 渲染屏障：等待字型和持久化狀態載入完成
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // ⭐ 當所有條件都滿足時，隱藏 Splash Screen (如果前面沒隱藏的話)
  SplashScreen.hideAsync();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View style={styles.container}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="detail" />
            {Platform.OS !== "web" && <Stack.Screen name="play" />}
            <Stack.Screen name="search" />
            <Stack.Screen name="live" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>
        <Toast />
        <LoginModal />
        <UpdateModal />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
