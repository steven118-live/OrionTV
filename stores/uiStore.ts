// stores/uiStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; // 必須引入 createJSONStorage
import AsyncStorage from '@react-native-async-storage/async-storage'; // 必須引入 AsyncStorage

export enum AIMode {
  LowMemory = "low",
  Balanced = "balanced",
  HighPerformance = "high",
}

interface UIState {
  enableHeaderAutoHide: boolean;
  aiMode: AIMode;
  toggleHeaderAutoHide: () => void;
  setAIMode: (mode: AIMode) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      enableHeaderAutoHide: true,          // 預設開啟
      aiMode: AIMode.Balanced,             // 預設模式保持一致
      toggleHeaderAutoHide: () =>
        set((state) => ({ enableHeaderAutoHide: !state.enableHeaderAutoHide })),
      setAIMode: (mode: AIMode) => set({ aiMode: mode }),
    }),
    {
      name: 'ui-storage',
      // 關鍵修正：將 AsyncStorage 設置為 Zustand 的持久化儲存引擎
      storage: createJSONStorage(() => AsyncStorage),

      // 只存 UI 的兩項，避免未來 store 變動造成資料污染
      partialize: (state) => ({
        enableHeaderAutoHide: state.enableHeaderAutoHide,
        aiMode: state.aiMode,
      }),
    }
  )
);
