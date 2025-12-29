// app/index.tsx （行為完全一致 + 核心問題修復版）
import React, { useEffect, useCallback, useRef, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  Animated,
  StatusBar,
  Platform,
  BackHandler,
  ToastAndroid,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { api } from "@/services/api";
import VideoCard from "@/components/VideoCard";
import { useFocusEffect, useRouter } from "expo-router";
import { Search, Settings, LogOut, Heart } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import useHomeStore, { RowItem, Category } from "@/stores/homeStore";
import useAuthStore from "@/stores/authStore";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import { useApiConfig, getApiConfigErrorMessage } from "@/hooks/useApiConfig";
import { Colors } from "@/constants/Colors";
import { useUIStore, AIMode } from "@/stores/uiStore";  // 改成這行！

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = "dark";
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeHeaderAnim = useRef(new Animated.Value(1)).current;
  const headerTranslateY = fadeHeaderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });
  const insets = useSafeAreaInsets();
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing, columns, cardWidth } = responsiveConfig;

  const {
    categories,
    selectedCategory,
    contentData,
    loading,
    loadingMore,
    error,
    fetchInitialData,
    loadMoreData,
    selectCategory,
    refreshPlayRecords,
    clearError,
  } = useHomeStore();
  const { isLoggedIn, logout } = useAuthStore();
  const isLoggedInState = useAuthStore((state) => state.isLoggedIn);
  const apiConfigStatus = useApiConfig();
  const flatListRef = useRef<FlatList>(null);
  const hasInitialized = useRef(false);
  const prevRowRef = useRef(0);
  const [initReady, setInitReady] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const isTV = deviceType === "tv";
  const isTablet = deviceType === "tablet";
  const isMobile = deviceType === "mobile";
  const hasShownInvalidToast = useRef(false);
  const backPressTimeRef = useRef<number | null>(null);
  const firstCategoryButtonRef = useRef<any>(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const orientationKey = isLandscape ? "landscape" : "portrait";
  const enableHeaderAutoHide = useUIStore((state) => state.enableHeaderAutoHide);
  // 加這行（在 orientationKey ＆ enableHeaderAutoHide 下面）
  const headerPadding = enableHeaderAutoHide && hideUI
  ? (isTV ? Math.max(120, height * 0.18) : Math.max(100, height * 0.15))
  : 0;
  const aiMode = useUIStore((state) => state.aiMode);

  const getVisibleRows = () => {
    let baseRows = isTV ? 1.5 : 2.5;
    if (hideUI) baseRows += 0.5;
    switch (aiMode) {
     case "low":
       return baseRows;
     case "balanced":
       return baseRows * 1.5;
     case "high":
       return baseRows * 2;
    }
  };

  const visibleRows = getVisibleRows() ?? (isTV ? 4 : 6);
  const itemsPerRow = isTV ? 5 : columns;
  const itemHeight = cardWidth + spacing;
  const visibleHeight = itemHeight * visibleRows;
  const LOAD_MORE_THRESHOLD = Math.max(visibleHeight * 1.5, 300);
  const onEndReachedThreshold = Math.min(LOAD_MORE_THRESHOLD / Math.max(visibleHeight, 1), 0.9);

  // 完全動態性能參數（根據 AI_MODE + 可見區域自動調整）
  // 完全正確的 AI 記憶體保護模式切換
  const performanceParams = useMemo(() => {
    const cardsInFirstScreen = Math.ceil(visibleRows * itemsPerRow * 1.5); // 基礎值：1.5 屏

    // 三種等級，差異要夠明顯才有用！
    const config = {
      low: {
        initial: Math.floor(cardsInFirstScreen * 0.6),   // 超省：只渲染 0.6 屏
        batch: Math.max(4, itemsPerRow),                  // 最小批次
        window: 7,                                        // 極小虛擬化窗口
      },
      balanced: {
        initial: cardsInFirstScreen,                      // 標準：1.5 屏（你原本的設計）
        batch: itemsPerRow * 3,
        window: Math.max(11, Math.ceil(visibleRows * 4) + 1),
      },
      high: {
        initial: cardsInFirstScreen * 3,                  // 極致：4.5 屏一次渲染
        batch: itemsPerRow * 8,                           // 超大批次
        window: 31,                                       // 超大窗口，幾乎不虛擬化
      },
    };

    return config[aiMode]; // 改成 aiMode
  }, [visibleRows, itemsPerRow, aiMode]); // 依賴加上 aiMode

  const getContentGap = () => {
    if (!isTV) return spacing;
    const CARD_WIDTH = width / 5;
    const totalColumns = 5;
    const leftover = width - CARD_WIDTH * totalColumns;
    return leftover / (totalColumns + 1);
  };

  useEffect(() => {
    if (apiConfigStatus.needsConfiguration) return;
    // if (apiConfigStatus.isValid === false && !hasShownInvalidToast.current) {
    //   ToastAndroid.show("API 检查服务器中..请稍待", ToastAndroid.SHORT); //LONG SHORT
    //   hasShownInvalidToast.current = true;
    //   return;
    // }
    // if (apiConfigStatus.isValid === true) {
    //   hasShownInvalidToast.current = false;
    // }
    if (hasInitialized.current) return;
    const initialize = async () => {
      try {
        await refreshPlayRecords();
        hasInitialized.current = true;
        setInitReady(true);
      } catch (err) {
        console.error("Home 初始化失败", err);
        hasInitialized.current = false;
      }
    };
    initialize();
  }, [
    apiConfigStatus.needsConfiguration,
    apiConfigStatus.isValid,
    apiConfigStatus.isValidating,
    isLoggedInState,
  ]);

  useFocusEffect(
    useCallback(() => {
      refreshPlayRecords();
    }, [refreshPlayRecords])
  );

  useFocusEffect(
    useCallback(() => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let subscription: any = null;

      const handleBackPress = () => {
        if (!initReady) return true;

        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        if (hideUI) setHideUI(false);

        if (isTV || isTablet) {
          Animated.timing(fadeHeaderAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
            // 清理之前的 timeout（防止重複聚焦）
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              firstCategoryButtonRef.current?.focus?.();
            }, 100);
          });
        }

        // 3. 雙擊退出邏輯
        const now = Date.now();
        if (!backPressTimeRef.current || now - backPressTimeRef.current > 2000) {
          backPressTimeRef.current = now;
          ToastAndroid.show("再按一次返回键退出应用", ToastAndroid.SHORT);
          return true;
        }
        BackHandler.exitApp();
        return true;
      };

      if (Platform.OS === "android") {
        subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
      }

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (subscription) subscription.remove();
        backPressTimeRef.current = null;
      };
    }, [initReady, hideUI, isTV, isTablet, fadeHeaderAnim])
  );

  useEffect(() => {
    if (!selectedCategory) return;
    if (selectedCategory.tags && !selectedCategory.tag) {
      const defaultTag = selectedCategory.tags[0];
      setSelectedTag(defaultTag);
      selectCategory({ ...selectedCategory, tag: defaultTag });
      return;
    }
    // 只有在API配置完成且分类有效时才获取数据
    if (apiConfigStatus.isConfigured && !apiConfigStatus.needsConfiguration) {
      // 对于有标签的分类，需要确保有标签才获取数据
      if (selectedCategory.tags && selectedCategory.tag) {
        fetchInitialData();
      }
      // 对于无标签的分类，直接获取数据
      else if (!selectedCategory.tags) {
        fetchInitialData();
      }
    }
  }, [
    selectedCategory,
    selectedCategory?.tag,
    apiConfigStatus.isConfigured,
    apiConfigStatus.needsConfiguration,
    fetchInitialData,
    selectCategory,
  ]);

  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) clearError();
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  // ---- UI 顯示/隱藏控制 ----
  const handleFocusRow = (rowIndex: number) => {
    if (!isTV && !isTablet) return;
    if (!initReady) return;
    if (!enableHeaderAutoHide) return; // 關鍵：關閉時不隱藏

    const prevRow = prevRowRef.current;
    // ----------------------------------------------------------------------
    // 1. 向下移動 (隱藏 Header)
    // ----------------------------------------------------------------------
    if (rowIndex > prevRow && rowIndex > 0) {
      if (!hideUI) {
        setHideUI(true);
        Animated.timing(fadeHeaderAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }
    // ----------------------------------------------------------------------
    // 2. 向上移動到頂部 (修正處)
    // ----------------------------------------------------------------------
    // 只有當焦點回到最頂部的 Row 0 時，才執行取消隱藏的操作。
    } else if (rowIndex === 0 && hideUI) { // *** 關鍵修正：將 <= 1 改為 === 0 ***
      setHideUI(false);
      Animated.timing(fadeHeaderAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
       flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
    prevRowRef.current = rowIndex;
  };

  useEffect(() => {
    if (!enableHeaderAutoHide) {
      fadeHeaderAnim.setValue(1);        // 強制顯示
      setHideUI(false);                  // 強制取消隱藏狀態
      return;
    }
    // 核心修復：僅在值真正改變時才執行動畫，防止重渲染干擾播放器
    const targetValue = hideUI ? 0 : 1;
    // @ts-ignore - 讀取動畫當前值，避免重複觸發
    if (fadeHeaderAnim._value !== targetValue) {
      Animated.timing(fadeHeaderAnim, { toValue: targetValue, duration: 300, useNativeDriver: true }).start();
    }
  }, [hideUI, enableHeaderAutoHide]);

  useEffect(() => {
    if (!loading && contentData.length > 0) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else if (loading) {
      fadeAnim.setValue(0);
    }
  }, [loading, contentData.length, fadeAnim]);

  const handleCategorySelect = (category: Category) => {
    setSelectedTag(null);
    selectCategory(category);
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag);
    if (selectedCategory) selectCategory({ ...selectedCategory, tag });
  };

  // 關鍵修正2：第一個分類按鈕加上 ref + 首屏焦點
  const renderCategory = ({ item, index }: { item: Category; index: number }) => {
    const isSelected = selectedCategory?.title === item.title;
    return (
      <StyledButton
        ref={index === 0 ? firstCategoryButtonRef : null}
        hasTVPreferredFocus={index === 0}
        text={item.title}
        onPress={() => handleCategorySelect(item)}
        isSelected={isSelected}
        style={dynamicStyles.categoryButton}
        textStyle={dynamicStyles.categoryText}
      />
    );
  };

  const renderContentItem = useCallback(({ item, index }: { item: RowItem; index: number }) => {
      const rowIndex = Math.floor(index / itemsPerRow);
      return (
        <View style={{ flex: 1 / itemsPerRow, padding: spacing / 2 }}>
          <VideoCard
            {...item}
            api={api}
            onRecordDeleted={fetchInitialData}
            onFocus={
              !isMobile && enableHeaderAutoHide
                ? () => handleFocusRow(rowIndex)
                : undefined
            }
          />
        </View>
      );
    },
    // 關鍵！加上 hideUI
    [itemsPerRow, spacing, api, fetchInitialData, isMobile, enableHeaderAutoHide, handleFocusRow, hideUI]
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: spacing * 2, alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  };
  const shouldShowApiConfig = apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags;
  // ... 你的 renderHeader、HeaderAndCategory、dynamicStyles 全部保持不變
  const renderHeader = () => {
    if (deviceType === "mobile") {
      // 移动端不显示顶部导航，使用底部Tab导航
      return null;
    }

    return (
      <View style={dynamicStyles.headerContainer}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ThemedText style={dynamicStyles.headerTitle}>首页</ThemedText>
          <Pressable
            android_ripple={Platform.isTV || deviceType !== "tv" ? { color: "transparent" } : { color: Colors.dark.link }}
            style={{ marginLeft: 20 }}
            onPress={() => router.push("/live")}
          >
            {({ focused }) => <ThemedText style={[dynamicStyles.headerTitle, { color: focused ? "white" : "grey" }]}>直播</ThemedText>}
          </Pressable>
        </View>
        <View style={dynamicStyles.rightHeaderButtons}>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/favorites")} variant="ghost">
            <Heart color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton
            style={dynamicStyles.iconButton}
            onPress={() => router.push({ pathname: "/search" })}
            variant="ghost"
          >
            <Search color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/settings")} variant="ghost">
            <Settings color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          {isLoggedIn && (
            <StyledButton style={dynamicStyles.iconButton} onPress={logout} variant="ghost">
              <LogOut color={colorScheme === "dark" ? "white" : "black"} size={24} />
            </StyledButton>
          )}
        </View>
      </View>
    );
  };

  // 动态样式
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === "mobile" ? insets.top : deviceType === "tablet" ? insets.top + 20 : 40,
    },
    headerContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing * 1.5,
      marginBottom: spacing,
    },
    headerTitle: {
      fontSize: deviceType === "mobile" ? 24 : deviceType === "tablet" ? 28 : 32,
      fontWeight: "bold",
      paddingTop: 16,
    },
    rightHeaderButtons: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconButton: {
      borderRadius: 30,
      marginLeft: spacing / 2,
    },
    categoryContainer: {
      paddingBottom: spacing / 2,
    },
    categoryListContent: {
      paddingHorizontal: spacing,
    },
    categoryButton: {
      paddingHorizontal: isTV ? spacing / 4 : spacing / 2,
      paddingVertical: spacing / 2,
      borderRadius: deviceType === "mobile" ? 6 : 8,
      marginHorizontal: isTV ? spacing / 4 : spacing / 2,
    },
    categoryText: {
      fontSize: deviceType === "mobile" ? 14 : 16,
      fontWeight: "500",
    },
    contentContainer: {
      flex: 1,
    },
  });

  const HeaderAndCategory = () => (
    <Animated.View style={{
      opacity: enableHeaderAutoHide ? fadeHeaderAnim : 1,
      transform: [{ translateY: enableHeaderAutoHide ? headerTranslateY : 0 }],
    }}>
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}
      {(enableHeaderAutoHide ? !hideUI : true) && renderHeader()}
      {(enableHeaderAutoHide ? !hideUI : true) && (
        <View style={dynamicStyles.categoryContainer}>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.title}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.categoryListContent}
          />
        </View>
      )}
      {(enableHeaderAutoHide ? !hideUI : true) && selectedCategory?.tags && (
        <View style={dynamicStyles.categoryContainer}>
          <FlatList
            data={selectedCategory.tags}
            renderItem={({ item, index }) => (
              <StyledButton
                hasTVPreferredFocus={index === 0}
                text={item}
                onPress={() => handleTagSelect(item)}
                isSelected={selectedTag === item}
                style={dynamicStyles.categoryButton}
                textStyle={dynamicStyles.categoryText}
                variant="ghost"
              />
            )}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.categoryListContent}
          />
        </View>
      )}
    </Animated.View>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      <HeaderAndCategory />
      {shouldShowApiConfig ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {getApiConfigErrorMessage(apiConfigStatus)}
          </ThemedText>
        </View>
      ) : apiConfigStatus.isValidating ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            正在验证服务器配置...
          </ThemedText>
        </View>
      ) : apiConfigStatus.error && !apiConfigStatus.isValid ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {apiConfigStatus.error}
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing }}>
            {error}
          </ThemedText>
        </View>
      ) : (
        <Animated.View style={[dynamicStyles.contentContainer, { opacity: fadeAnim }]}>
          {/* 關鍵修正4：TV 使用原生 FlatList + orientationKey 防止旋轉崩潰 */}
          {isTV ? (
            <FlatList
              ref={flatListRef}
              data={contentData}
              renderItem={renderContentItem}
              keyExtractor={(item, index) => item.id?.toString() ?? `item-${index}`}
              numColumns={itemsPerRow}
              columnWrapperStyle={{ gap: getContentGap(), paddingHorizontal: getContentGap() }}
              contentContainerStyle={{ paddingBottom: spacing * 4, paddingTop: headerPadding, }}
              onEndReached={loadMoreData}
              onEndReachedThreshold={onEndReachedThreshold}
              ListFooterComponent={renderFooter}
              initialNumToRender={performanceParams.initial}
              maxToRenderPerBatch={performanceParams.batch}
              windowSize={performanceParams.window}
              removeClippedSubviews={true}
              key={`tv-flatlist-${orientationKey}`}
            />
          ) : (
            <CustomScrollView
              data={contentData}
              renderItem={renderContentItem}
              numColumns={itemsPerRow}
              loading={loading}
              loadingMore={loadingMore}
              error={error}
              onEndReached={loadMoreData}
              loadMoreThreshold={LOAD_MORE_THRESHOLD}
              emptyMessage={selectedCategory?.tags ? "请选择一个子分类" : "该分类下暂无内容"}
              ListFooterComponent={renderFooter}
            />
          )}
        </Animated.View>
      )}
    </ThemedView>
  );

  if (isTV) return content;
  return <ResponsiveNavigation>{content}</ResponsiveNavigation>;
}
