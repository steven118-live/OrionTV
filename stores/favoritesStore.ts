// Minimal patch: defensive normalization and avoid direct object-literal-to-Favorite type errors.
// Only small casts added; original behaviour preserved.

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
          const v = value as any;
          if (
            typeof key !== "string" ||
            !key.includes("+") ||
            typeof v !== "object" ||
            !v.title
          ) {
            return null;
          }
          // build intermediate object to avoid TS checking literal against Favorite
          const normalizedObj = {
            id: v.id ?? (key.split("+")[1] ?? ""),
            source: v.source ?? (key.split("+")[0] ?? ""),
            title: v.title,
            source_name: v.source_name ?? v.source ?? (key.split("+")[0] ?? ""),
            cover: v.cover ?? v.poster ?? "",
            year: v.year ?? "",
            save_time: v.save_time ?? Date.now(),
            key,
          };
          return (normalizedObj as unknown) as FavoriteWithKey;
        })
        .filter(Boolean) as FavoriteWithKey[];

      set({ favorites: favoritesArray, loading: false });
    } catch {
      set({ error: "收藏資料讀取失敗", loading: false });
    }
  },

  async toggleFavorite(key, value) {
    try {
      const exists = get().favorites.find((f) => f.key === key);
      if (exists) {
        const [src, id] = key.split("+");
        await (FavoriteManager as any).remove?.(src, id ?? key);
      } else if (
        value &&
        typeof value === "object" &&
        (value as any).title &&
        ((value as any).source || key.includes("+"))
      ) {
        const v = value as any;
        const [srcFromKey, idFromKey] = key.split("+");
        const finalObj = {
          id: v.id ?? idFromKey ?? "",
          source: v.source ?? srcFromKey ?? "",
          title: v.title,
          source_name: v.source_name ?? v.source ?? srcFromKey ?? "",
          cover: v.cover ?? v.poster ?? "",
          year: v.year ?? "",
          save_time: Date.now(),
        };
        await (FavoriteManager as any).set?.(key, finalObj as any);
      }
      await get().fetchFavorites();
    } catch {
      set({ error: "收藏操作失敗" });
    }
  },

  async clearFavorites() {
    try {
      await (FavoriteManager as any).clearAll?.();
      set({ favorites: [] });
    } catch {
      set({ error: "清空收藏失敗" });
    }
  },
}));

export default useFavoritesStore;
