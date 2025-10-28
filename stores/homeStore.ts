import { create } from "zustand";
import { api, SearchResult, PlayRecord } from "@/services/api";
import { PlayRecordManager } from "@/services/storage";
import useAuthStore from "./authStore";
import { useSettingsStore } from "./settingsStore";

export type RowItem = (SearchResult | PlayRecord) & {
  id: string;
  source: string;
  title: string;
  poster: string;
  progress?: number;
  play_time?: number;
  lastPlayed?: number;
  episodeIndex?: number;
  sourceName?: string;
  totalEpisodes?: number;
  year?: string;
  rate?: string;
};

export interface Category {
  title: string;
  type?: "movie" | "tv" | "record";
  tag?: string;
  tags?: string[];
}

const initialCategories: Category[] = [
  { title: "最近播放", type: "record" },
  { title: "热门剧集", type: "tv", tag: "热门" },
  {
    title: "电视剧",
    type: "tv",
    tags: [
      "国产剧",
      "美剧",
      "英剧",
      "韩剧",
      "日剧",
      "港剧",
      "动漫", // ✅ 替代「日本动画」
      "纪录片"
    ],
  },
  {
    title: "电影",
    type: "movie",
    tags: [
      "热门",
      "最新",
      "经典",
      "豆瓣高分",
      "冷门佳片",
      "华语",
      "欧美",
      "韩国",
      "日本",
      "动作",
      "喜剧",
      "爱情",
      "科幻",
      "悬疑",
      "恐怖",
    ],
  },
  { title: "综艺", type: "tv", tag: "综艺" },
  { title: "豆瓣 Top250", type: "movie", tag: "top250" },
];

interface CacheItem {
  data: RowItem[];
  timestamp: number;
  type: 'movie' | 'tv' | 'record';
  hasMore: boolean;
}

const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟过期
const MAX_CACHE_SIZE = 10; // 最大缓存容量
const MAX_ITEMS_PER_CACHE = 40; // 每个缓存最大条目数

const getCacheKey = (category: Category) => {
  return `${category.type || 'unknown'}-${category.title}-${category.tag || ''}`;
};

const isValidCache = (cacheItem: CacheItem) => {
  return Date.now() - cacheItem.timestamp < CACHE_EXPIRE_TIME;
};

interface HomeState {
  categories: Category[];
  selectedCategory: Category;
  contentData: RowItem[];
  loading: boolean;
  loadingMore: boolean;
  pageStart: number;
  hasMore: boolean;
  error: string | null;
  fetchInitialData: () => Promise<void>;
  loadMoreData: () => Promise<void>;
  selectCategory: (category: Category) => void;
  refreshPlayRecords: () => Promise<void>;
  clearError: () => void;
}

const dataCache = new Map<string, CacheItem>();

const useHomeStore = create<HomeState>((set, get) => ({
  categories: initialCategories,
  selectedCategory: initialCategories[0],
  contentData: [],
  loading: true,
  loadingMore: false,
  pageStart: 0,
  hasMore: true,
  error: null,

  selectCategory: (category: Category) => {
    const currentCategory = get().selectedCategory;
    const cacheKey = getCacheKey(category);

    const isSameCategory =
      currentCategory.title === category.title &&
      currentCategory.tag === category.tag &&
      JSON.stringify(currentCategory.tags || []) === JSON.stringify(category.tags || []);

    if (!isSameCategory) {
      set({
        selectedCategory: category,
        contentData: [],
        pageStart: 0,
        hasMore: true,
        error: null,
      });

      if (category.type === "record" || (category.type === "tv" && category.tag === "动漫")) {
        get().fetchInitialData();
        return;
      }

      const cachedData = dataCache.get(cacheKey);
      if (cachedData && isValidCache(cachedData)) {
        set({
          contentData: cachedData.data,
          pageStart: cachedData.data.length,
          hasMore: cachedData.hasMore,
          loading: false,
        });
      } else {
        if (cachedData) {
          dataCache.delete(cacheKey);
        }
        get().fetchInitialData();
      }
    }
  },

  fetchInitialData: async () => {
    const { apiBaseUrl } = useSettingsStore.getState();
    await useAuthStore.getState().checkLoginStatus(apiBaseUrl);

    const { selectedCategory } = get();
    const cacheKey = getCacheKey(selectedCategory);

    if (selectedCategory.type === 'record') {
      set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null });
      await get().loadMoreData();
      return;
    }

    set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null });
    await get().loadMoreData();
  },

  loadMoreData: async () => {
    const { selectedCategory, pageStart, loadingMore, hasMore } = get();
    if (loadingMore || !hasMore) return;

    if (pageStart > 0) {
      set({ loadingMore: true });
    }

    try {
      if (selectedCategory.type === "record") {
        const { isLoggedIn } = useAuthStore.getState();
        if (!isLoggedIn) {
          set({ contentData: [], hasMore: false });
          return;
        }
        const records = await PlayRecordManager.getAll();
        const rowItems = Object.entries(records)
          .map(([key, record]) => {
            const [source, id] = key.split("+");
            return {
              ...record,
              id,
              source,
              progress: record.play_time / record.total_time,
              poster: record.cover,
              sourceName: record.source_name,
              episodeIndex: record.index,
              totalEpisodes: record.total_episodes,
              lastPlayed: record.save_time,
              play_time: record.play_time,
            };
          })
          .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

        set({ contentData: rowItems, hasMore: false });
      } else if (selectedCategory.type === "tv" && selectedCategory.tag === "动漫") {

        const cacheKey = getCacheKey(selectedCategory);

        if (pageStart === 0) {
          const cacheItems = allResults.slice(0, MAX_ITEMS_PER_CACHE);
          dataCache.set(cacheKey, {
            data: cacheItems,
            timestamp: Date.now(),
            type: "tv",
            hasMore: true,
          });

          set({
            contentData: allResults,
            pageStart: allResults.length,
            hasMore: allResults.length !== 0,
          });
        } else {
          const existingCache = dataCache.get(cacheKey);
          if (existingCache && existingCache.data.length < MAX_ITEMS_PER_CACHE) {
            const updatedData = [...existingCache.data, ...allResults];
            const limitedCacheData = updatedData.slice(0, MAX_ITEMS_PER_CACHE);
            dataCache.set(cacheKey, {
              ...existingCache,
              data: limitedCacheData,
              hasMore: true,
            });
          }

          set((state) => ({
            contentData: [...state.contentData, ...allResults],
            pageStart: state.pageStart + allResults.length,
            hasMore: allResults.length !== 0,
          }));
        }
      } else if (selectedCategory.type && selectedCategory.tag) {
        const result = await api.getDoubanData(
          selectedCategory.type,
          selectedCategory.tag,
          20,
          pageStart
        );

        const newItems = result.list.map((item) => ({
          ...item,
          id: item.title,
          source: "douban",
        })) as RowItem[];

        const cacheKey = getCacheKey(selectedCategory);

        if (pageStart === 0) {
          for (const [key, value] of dataCache.entries()) {
            if (!isValidCache(value)) {
              dataCache.delete(key);
            }
          }

          if (dataCache.size >= MAX_CACHE_SIZE) {
            const oldestKey = Array.from(dataCache.keys())[0];
            dataCache.delete(oldestKey);
          }

          const cacheItems = newItems.slice(0, MAX_ITEMS_PER_CACHE);
          dataCache.set(cacheKey, {
            data: cacheItems,
            timestamp: Date.now(),
            type: selectedCategory.type,
            hasMore: true,
          });

          set({
            contentData: newItems,
            pageStart: newItems.length,
            hasMore: result.list.length !== 0,
          });
        } else {
          const existingCache = dataCache.get(cacheKey);
          if (existingCache && existingCache.data.length < MAX_ITEMS_PER_CACHE) {
            const updatedData = [...existingCache.data, ...newItems];
            const limitedCacheData = updatedData.slice(0, MAX_ITEMS_PER_CACHE);
            dataCache.set(cacheKey, {
              ...existingCache,
              data: limitedCacheData,
              hasMore: true,
            });
          }

          set((state) => ({
            contentData: [...state.contentData, ...newItems],
            pageStart: state.pageStart + newItems.length,
            hasMore: result.list.length !== 0,
          }));
        }
      } else if (selectedCategory.tags) {
        set({ contentData: [], hasMore: false });
      } else {
        set({ hasMore: false });
      }
    } catch (err: any) {
      let errorMessage = "加载失败，请重试";

      if (err.message === "API_URL_NOT_SET") {
        errorMessage = "请点击右上角设置按钮，配置您的服务器地址";
      } else if (err.message === "UNAUTHORIZED") {
        errorMessage = "认证失败，请重新登录";
      } else if (err.message.includes("Network")) {
        errorMessage = "网络连接失败，请检查网络连接";
      } else if (err.message.includes("timeout")) {
        errorMessage = "请求超时，请检查网络或服务器状态";
      } else if (err.message.includes("404")) {
        errorMessage = "服务器API路径不正确，请检查服务器配置";
      } else if (err.message.includes("500")) {
        errorMessage = "服务器内部错误，请联系管理员";
      } else if (err.message.includes("403")) {
        errorMessage = "访问被拒绝，请检查权限设置";
      }

      set({ error: errorMessage });
    } finally {
      set({ loading: false, loadingMore: false });
    }
  },

  refreshPlayRecords: async () => {
    const { apiBaseUrl } = useSettingsStore.getState();
    await useAuthStore.getState().checkLoginStatus(apiBaseUrl);
    const { isLoggedIn } = useAuthStore.getState();
    if (!isLoggedIn) {
      set((state) => {
        const recordCategoryExists = state.categories.some((c) => c.type === "record");
        if (recordCategoryExists) {
          const newCategories = state.categories.filter((c) => c.type !== "record");
          if (state.selectedCategory.type === "record") {
            get().selectCategory(newCategories[0] || null);
          }
          return { categories: newCategories };
        }
        return {};
      });
      return;
    }

    const records = await PlayRecordManager.getAll();
    const hasRecords = Object.keys(records).length > 0;

    set((state) => {
      const recordCategoryExists = state.categories.some((c) => c.type === "record");
      if (hasRecords && !recordCategoryExists) {
        return { categories: [initialCategories[0], ...state.categories] };
      }
      if (!hasRecords && recordCategoryExists) {
        const newCategories = state.categories.filter((c) => c.type !== "record");
        if (state.selectedCategory.type === "record") {
          get().selectCategory(newCategories[0] || null);
        }
        return { categories: newCategories };
      }
      return {};
    });

    get().fetchInitialData();
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useHomeStore;