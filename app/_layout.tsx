// app_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Platform, View, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import LoginModal from "@/components/LoginModal";
import useAuthStore from "@/stores/authStore";
import { useUpdateStore, initUpdateStore } from "@/stores/updateStore";
import { UpdateModal } from "@/components/UpdateModal";
import { UPDATE_CONFIG } from "@/constants/UpdateConfig";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import useHomeStore from "@/stores/homeStore";
import { useApiConfig } from "@/hooks/useApiConfig";
import Logger from "@/utils/Logger";

import DebugToast from "@/src/debug/DebugToast";
import DebugOverlay from "@/src/debug/DebugOverlay";
import { loadFlags } from "@/src/debug/flags";

const logger = Logger.withTag("RootLayout");

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = "dark";
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // NOTE: ensure settingsStore exposes debugOverlayEnabled (boolean) if you want runtime control
  const { loadSettings, remoteInputEnabled, apiBaseUrl, debugOverlayEnabled } = useSettingsStore();
  const { startServer, stopServer } = useRemoteControlStore();
  const { checkLoginStatus } = useAuthStore();
  const { checkForUpdate, lastCheckTime } = useUpdateStore();
  const responsiveConfig = useResponsiveLayout();
  const { refreshPlayRecords, initEpisodeSelection } = useHomeStore();
  const apiStatus = useApiConfig();

  const hasInitialized = useRef(false); // 初始化鎖
  const [flagsLoaded, setFlagsLoaded] = useState(false); // track debug flags load completion

  // load persisted debug flags and initialize debug UI (non-blocking)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadFlags();
      } catch (_) {
        // ignore
      } finally {
        if (mounted) setFlagsLoaded(true);
      }
    })();
    // Note: avoid enabling verbose/line_trace by default in production
    // import { setDebugFlags } from "@/src/debug/flags"; setDebugFlags({ verbose: true }, false);
    return () => {
      mounted = false;
    };
  }, []);

  // 初始化設定
  useEffect(() => {
    const initializeApp = async () => {
      await loadSettings();
    };
    initializeApp();
    initUpdateStore(); // 初始化更新存储
  }, [loadSettings]);

  // 檢查登入狀態
  useEffect(() => {
    if (apiBaseUrl) {
      checkLoginStatus(apiBaseUrl);
    }
  }, [apiBaseUrl, checkLoginStatus]);

  // 字型載入完成後隱藏 Splash
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      if (error) {
        logger.warn(`Error in loading fonts: ${error}`);
      }
    }
  }, [loaded, error]);

  // API 驗證成功後才刷新最近播放 & 初始化選集 & 檢查更新
  useEffect(() => {
    if (!apiStatus.isValid || (!loaded && !error) || hasInitialized.current) return;
    hasInitialized.current = true;

    const updateTimer = setTimeout(() => {
      if (loaded && UPDATE_CONFIG.AUTO_CHECK && Platform.OS === "android") {
        const shouldCheck = Date.now() - lastCheckTime > UPDATE_CONFIG.CHECK_INTERVAL;
        if (shouldCheck) {
          checkForUpdate(true);
        }
      }

      const playbackTimer = setTimeout(async () => {
        try {
          await refreshPlayRecords();
        } catch (err) {
          logger.warn("播放紀錄刷新失敗", err);
          useHomeStore.getState().setPlayRecords([]); // fallback 空陣列，確保 UI 不空白
        } finally {
          initEpisodeSelection(); // 確保初始化選集，不受錯誤影響
        }
      }, 2000);

      return () => clearTimeout(playbackTimer);
    }, 1000);

    return () => clearTimeout(updateTimer);
  }, [apiStatus.isValid, refreshPlayRecords, initEpisodeSelection, loaded, error, lastCheckTime, checkForUpdate]);

  // 遠端控制伺服器啟停
  useEffect(() => {
    if (remoteInputEnabled && responsiveConfig.deviceType !== "mobile") {
      startServer();
    } else {
      stopServer();
    }
  }, [remoteInputEnabled, startServer, stopServer, responsiveConfig.deviceType]);

  // Decide whether to show DebugOverlay:
  // - show if __DEV__ is true, OR
  // - show if settingsStore.debugOverlayEnabled is true
  const shouldShowOverlay = flagsLoaded && (typeof debugOverlayEnabled === "boolean" ? debugOverlayEnabled : __DEV__);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View style={styles.container}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="detail" options={{ headerShown: false }} />
            {Platform.OS !== "web" && <Stack.Screen name="play" options={{ headerShown: false }} />}
            <Stack.Screen name="search" options={{ headerShown: false }} />
            <Stack.Screen name="live" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="favorites" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </View>

        <Toast />
        <LoginModal />
        <UpdateModal />

        {/* Debug UI: DebugToast always mounted; DebugOverlay controlled by flagsLoaded + settingsStore or dev mode */}
        <DebugToast />
        {shouldShowOverlay && <DebugOverlay />}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
