import { Alert } from "react-native";
import { PlayRecordManager } from "@/services/storage";
import useFavoritesStore from "@/stores/favoritesStore";

/**
 * 最近播放：提供刪除觀看記錄 + 收藏／取消收藏
 */
export function getPlaybackOptions(item: {
  id: string;
  title: string;
  source: string;
  progress?: number;
  isFavorite?: boolean;
  onRecordDeleted?: () => void;
}) {
  const { id, title, source, progress, isFavorite, onRecordDeleted } = item;
  const { toggleFavorite } = useFavoritesStore();

  const options = [];

  if (progress !== undefined) {
    options.push({
      text: "✔️ 删除观看记录",
      onPress: () => {
        Alert.alert(
          "删除观看记录",
          `确定要删除 "${title}" 的观看记录吗？`,
          [
            { text: "取消", style: "cancel" },
            {
              text: "删除",
              style: "destructive",
              onPress: () => {
                setTimeout(async () => {
                  try {
                    await PlayRecordManager.remove(source, id);
                    onRecordDeleted?.();
                  } catch {
                    Alert.alert("错误", "删除观看记录失败，请重试");
                  }
                }, 0);
              },
            },
          ]
        );
      },
    });
  }

  options.push({
    text: isFavorite ? "💔 取消收藏" : "❤️ 加到我的收藏",
    onPress: () => {
      try {
        toggleFavorite(`${source}+${id}`, {
          id,
          source,
          title,
          source_name: source,
          cover: "",
          year: "",
        });
      } catch {
        Alert.alert("错误", "收藏操作失败，请重试");
      }
    },
  });

  options.push({ text: "取消", style: "cancel" });

  return options;
}

/**
 * 我的收藏：提供收藏／取消收藏（不含刪除記錄）
 */
export function getFavoriteOptions(item: {
  id: string;
  title: string;
  source: string;
  isFavorite?: boolean;
}) {
  const { id, title, source, isFavorite } = item;
  const { toggleFavorite } = useFavoritesStore();

  return [
    {
      text: isFavorite ? "💔 取消收藏" : "❤️ 加到我的收藏",
      onPress: () => {
        try {
          toggleFavorite(`${source}+${id}`, {
            id,
            source,
            title,
            source_name: source,
            cover: "",
            year: "",
          });
        } catch {
          Alert.alert("错误", "收藏操作失败，请重试");
        }
      },
    },
    { text: "取消", style: "cancel" },
  ];
}