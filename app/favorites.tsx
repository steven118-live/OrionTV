import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import useFavoritesStore from "@/stores/favoritesStore";
import { Favorite } from "@/services/storage";
import VideoCard from "@/components/VideoCard";
import { api } from "@/services/api";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import Logger from "../src/debug/logger";
import { logLineShort } from "../src/debug/utils/devLog";


const favLogger = Logger.withTag("Favorites");

export default function FavoritesScreen() {
  const { favorites, loading, error, fetchFavorites } = useFavoritesStore();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  useEffect(() => {
    // debug: 印行號短碼（按需）
    logLineShort("Favorites#useEffect");
    favLogger.info("[1000] fetchFavorites start");
    fetchFavorites();
  }, [fetchFavorites]);

  const handleCardUnfavorite = async (item: Favorite & { key: string }) => {
    // debug: 印行號短碼（按需）
    logLineShort("Favorites#onUnfavorite");
    const opBase = 1100;
    const itemId = item?.key ?? "<no-key>";
    favLogger.info(`[${opBase}] onUnfavorite triggered - id=${itemId}`);

    try {
      const before = (useFavoritesStore.getState().favorites || []).slice(0, 10);
      favLogger.info(`[${opBase + 1}] before snapshot: ${JSON.stringify(before)}`);
      await new Promise((res) => setTimeout(res, 200));
      await fetchFavorites();
      const after = (useFavoritesStore.getState().favorites || []).slice(0, 10);
      favLogger.info(`[${opBase + 2}] after snapshot: ${JSON.stringify(after)}`);
    } catch (err) {
      // debug: 印行號短碼（按需）
      logLineShort("Favorites#onUnfavorite#catch");
      const errCode = 2100;
      favLogger.error(`[${errCode}] onUnfavorite handling failed - id=${itemId} - err=${String(err)}`);
    }
  };

  const renderItem = ({ item }: { item: Favorite & { key: string }; index: number }) => {
    const [source, id] = item.key.split("+");
    return (
      <VideoCard
        id={id}
        source={source}
        title={item.title}
        sourceName={item.source_name}
        poster={item.cover}
        year={item.year}
        api={api}
        episodeIndex={1}
        progress={0}
        onUnfavorite={() => handleCardUnfavorite(item)}
      />
    );
  };

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  const renderFavoritesContent = () => (
    <>
      {deviceType === 'tv' && (
        <View style={dynamicStyles.headerContainer}>
          <ThemedText style={dynamicStyles.headerTitle}>我的收藏</ThemedText>
        </View>
      )}
      <CustomScrollView
        data={favorites}
        renderItem={renderItem}
        loading={loading}
        error={error}
        emptyMessage="暂无收藏"
      />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderFavoritesContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="我的收藏" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const isTV = deviceType === 'tv';

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: isTV ? spacing * 2 : 0,
    },
    headerContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing * 1.5,
      marginBottom: spacing / 2,
    },
    headerTitle: {
      fontSize: isMobile ? 24 : isTablet ? 28 : 32,
      fontWeight: "bold",
      paddingTop: spacing,
      color: 'white',
    },
  });
};
