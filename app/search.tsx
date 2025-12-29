// app/search.tsx ← 終極覆蓋版（已加入 TV 瞬間 focus，行為 100% 你原本的）
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableOpacity,
  FlatList,
  BackHandler,
  Platform,
} from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult } from "@/services/api";
import { Search, QrCode } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from "@/utils/Logger";
import OpenCC from "opencc-js";

// 關鍵加入這兩行
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

const cn2tw = (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: "cn", to: "tw" }) : (s: string) => s;
const tw2cn = (OpenCC as any)?.Converter ? (OpenCC as any).Converter({ from: "tw", to: "cn" }) : (s: string) => s;
const logger = Logger.withTag("SearchScreen");

export default function SearchScreen() {
  // 關鍵：加入這段，解決 Android TV 進入頁面延遲 focus 的百年難題
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android" && deviceType === "tv") {
        const timer = setTimeout(() => {
          textInputRef.current?.focus();
        }, 120);
        return () => clearTimeout(timer);
      }
    }, [])
  );

  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();
  // 響應式配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing, columns } = responsiveConfig;
  // TV 模式 spacing=0, numColumns=5
  const listSpacing = deviceType === "tv" ? 0 : spacing;
  const listColumns = deviceType === "tv" ? 5 : columns;
  const flatListRef = useRef<FlatList<SearchResult>>(null);

  // 保留 BackHandler 攔截
  useEffect(() => {
    const handler = () => {
      if (!isInputFocused) {
        textInputRef.current?.focus?.();
        return true; // 攔截，不退出 App
      }
      return false; // 焦點在搜尋欄時，交給系統
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
  }, [isInputFocused]);

  useEffect(() => {
    if (lastMessage && targetPage === "search") {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      handleSearch(realMessage);
      clearMessage();
    }
  }, [lastMessage, targetPage]);

  const handleSearch = async (searchText?: string) => {
    const term = typeof searchText === "string" ? searchText : keyword;
    if (!term.trim()) {
      Keyboard.dismiss();
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      const simplifiedTerm = tw2cn(term) ?? term;
      const response = await api.searchVideos(simplifiedTerm);
      if (response.results.length > 0) {
        setResults(response.results);
      } else {
        setError("没有找到相关内容");
      }
    } catch (err) {
      setError("搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const onSearchPress = () => handleSearch();
  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal("search");
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <VideoCard
      id={item.id.toString()}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
    />
  );

  // 動態樣式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderSearchContent = () => (
    <>
      <View style={dynamicStyles.searchContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            dynamicStyles.inputContainer,
            { borderColor: isInputFocused ? Colors.dark.primary : "transparent" },
          ]}
          onPress={() => textInputRef.current?.focus()}
        >
          <TextInput
            ref={textInputRef}
            style={dynamicStyles.input}
            placeholder="搜索电影、剧集..."
            placeholderTextColor="#888"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={onSearchPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
          />
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
          <Search size={deviceType === "mobile" ? 20 : 24} color="white" />
        </StyledButton>
        {deviceType !== "mobile" && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === "tv" ? 24 : 20} color="white" />
          </StyledButton>
        )}
      </View>

      {loading ? (
        <VideoLoadingAnimation showProgressBar={false} />
      ) : error ? (
        <View style={[commonStyles.center, { flex: 1 }]}>
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : results.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={results}
          renderItem={({ item }) => (
            <View
              style={{
                width: `${100 / listColumns}%`,
                alignSelf: "stretch",
              }}
            >
              {renderItem({ item })}
            </View>
          )}
          keyExtractor={(item) => item.id.toString()}
          numColumns={listColumns}
          contentContainerStyle={{
            paddingHorizontal: listSpacing,
          }}
          columnWrapperStyle={{
            columnGap: deviceType === "tv" ? 0 : listSpacing,
          }}
        />
      ) : (
        !loading && (
          <View style={[commonStyles.center, { flex: 1 }]}>
            <ThemedText style={dynamicStyles.errorText}>输入关键词开始搜索</ThemedText>
          </View>
        )
      )}

      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
    </ThemedView>
  );

  if (deviceType === "tv") {
    return content;
  }
  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === "mobile";
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === "tv" ? 50 : 0,
    },
    searchContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing,
      marginBottom: spacing,
      alignItems: "center",
      paddingTop: isMobile ? spacing / 2 : 0,
    },
    inputContainer: {
      flex: 1,
      height: isMobile ? minTouchTarget : 50,
      backgroundColor: "#2c2c2e",
      borderRadius: isMobile ? 8 : 8,
      marginRight: spacing / 2,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      paddingHorizontal: spacing,
      color: "white",
      fontSize: isMobile ? 16 : 18,
    },
    searchButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
      marginRight: deviceType !== "mobile" ? spacing / 2 : 0,
    },
    qrButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
    },
    errorText: {
      color: "red",
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
  });
};
