import { create } from "zustand";
import { Favorite, FavoriteManager } from "@/services/storage";

interface FavoriteWithKey extends Favorite {
  key: string;
}

interface FavoritesStore {
  favorites: FavoriteWithKey[];
  loading: boolean;
  error: string | null;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (key: string, value?: Favorite) => Promise<void>;
  clearFavorites: () => Promise<void>;
}

const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  loading: false,
  error: null,

  async fetchFavorites() {
    set({ loading: true, error: null });
    try {
      const favoritesData = await FavoriteManager.getAll();

      const favoritesArray: FavoriteWithKey[] = Object.entries(favoritesData)
        .map(([key, value]) => {
          if (
            typeof key !== "string" ||
            !key.includes("+") ||
            typeof value !== "object" ||
            !value.title ||
            !value.source_name
          ) {
            return null;
          }
          return { ...value, key };
        })
        .filter(Boolean) as FavoriteWithKey[];

      set({ favorites: favoritesArray, loading: false });
    } catch {
      set({ error: "收藏資料讀取失敗", loading: false });
    }
  },

  async toggleFavorite(key, value) {
    try {
      const exists = get().favorites.find(f => f.key === key);
      if (exists) {
        await FavoriteManager.remove(key);
      } else if (
        value &&
        typeof value === "object" &&
        value.title &&
        value.source
      ) {
        const finalValue: Favorite = {
          id: value.id,
          source: value.source,
          title: value.title,
          source_name: value.source_name ?? value.source,
          cover: value.cover ?? "",
          year: value.year ?? "",
          save_time: Date.now(),
        };
        await FavoriteManager.set(key, finalValue);
      }
      await get().fetchFavorites();
    } catch {
      set({ error: "收藏操作失敗" });
    }
  },

  async clearFavorites() {
    try {
      await FavoriteManager.clearAll();
      set({ favorites: [] });
    } catch {
      set({ error: "清空收藏失敗" });
    }
  },
}));

export default useFavoritesStore;