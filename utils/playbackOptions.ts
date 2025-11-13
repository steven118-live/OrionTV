// utils/playbackOptions.ts
import { Alert } from "react-native";
import Logger from "@/utils/Logger";
import useFavoritesStore from "@/stores/favoritesStore";
// per-file debug setup (place at top of file, after imports)
import { setFileDebugConfig } from "@/src/debug/flags";
import { debugLog } from "@/src/debug/logger";
import { emitDebugToast } from "@/src/debug/DebugToast";

const DBG_TAG = "playbackOptions"; // or "playbackOptions" in other file

// enable per-file settings at runtime (non-persistent here)
setFileDebugConfig(DBG_TAG, {
  line_trace: true,
  verbose: false,
  ui_feedback: true,
  download_status: true,
});

const logger = Logger.withTag("playbackOptions_safe_codes");

/**
 * Design:
 * - Show numeric codes (1-100) on toast/alert for quick on-screen debugging.
 * - safeToastCode(code, delaySec) will show the numeric code after delaySec seconds (default 2s).
 * - All side-effects deferred to next tick and protected by try/catch.
 */

/** safeToastCode: 顯示純數字代碼；延遲預設 2 秒 */
function safeToastCode(code: number, delaySec = 2) {
  const msg = String(code);
  try {
    setTimeout(() => {
      try {
        // lazy require to avoid module load issues on TV
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ToastModule = require("react-native-toast-message");
        const Toast = ToastModule && ToastModule.default ? ToastModule.default : ToastModule;
        if (Toast && typeof Toast.show === "function") {
          try {
            Toast.show({
              type: "info",
              text1: msg,
              position: "top",
              visibilityTime: Math.max(1000, delaySec * 1000),
            });
            return;
          } catch (e) {
            logger.info("Toast.show failed, fallback to Alert", e, code);
          }
        }
      } catch (e) {
        logger.info("Toast module not available", e, code);
      }

      // fallback Alert (non-blocking)
      try {
        Alert.alert("", msg);
      } catch (e) {
        // last resort: console
        // eslint-disable-next-line no-console
        console.warn("safeToastCode Alert failed", e, code);
      }
    }, Math.max(0, Math.round(delaySec * 1000)));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("safeToastCode outer error", err, code);
  }
}

/** wrapSafeCallback: 將 callback 延到下一 tick，並包 try/catch */
function wrapSafeCallback(fn?: () => void) {
  return () => {
    if (!fn) return;
    try {
      setTimeout(() => {
        try {
          fn();
        } catch (e) {
          logger.info("wrapped callback error", e);
          // show an error code for wrapped callback exceptions
          safeToastCode(50, 2);
        }
      }, 0);
    } catch (e) {
      logger.info("wrapSafeCallback outer error", e);
      safeToastCode(51, 2);
    }
  };
}

/** normalizeOptions: 確保按鈕陣列安全 */
type AlertButton = { text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" };
function normalizeOptions(opts: any[]): AlertButton[] {
  const allowedStyles = new Set(["default", "cancel", "destructive"]);
  const out: AlertButton[] = [];
  (opts || []).forEach((o) => {
    try {
      if (!o || typeof o.text !== "string") return;
      const btn: AlertButton = { text: o.text };
      if (typeof o.onPress === "function") btn.onPress = wrapSafeCallback(o.onPress);
      if (allowedStyles.has(o.style)) btn.style = o.style;
      out.push(btn);
    } catch (e) {
      logger.info("normalizeOptions skipped malformed entry", e, o);
      safeToastCode(52, 2);
    }
  });
  if (!out.some((b) => b.style === "cancel")) {
    out.push({ text: "取消", style: "cancel" });
  }
  return out;
}

/**
 * Params / safety notes
 */
interface PlaybackOptionsParams {
  id: string;
  title: string;
  source: string;
  progress?: number;
  isFavorite?: boolean;
  onRecordDeleted?: () => void;
}

interface FavoriteOptionsParams {
  id: string;
  title: string;
  source: string;
  isFavorite?: boolean;
}

/**
 * Error code mapping (for quick reference)
 * - 10: getPlaybackOptions called (entry)
 * - 11: getPlaybackOptions: PlayRecordManager.remove not available
 * - 12: getPlaybackOptions: PlayRecordManager.remove thrown
 * - 13: getPlaybackOptions: remove success
 * - 20: getPlaybackOptions: toggleFavorite not available
 * - 21: getPlaybackOptions: toggleFavorite threw / rejected
 * - 22: getPlaybackOptions: toggleFavorite success (added)
 * - 23: getPlaybackOptions: toggleFavorite success (removed)
 * - 24: favorite option onPress failed outer
 * - 30: getFavoriteOptions called (entry)
 * - 32/33: getFavoriteOptions add/remove success
 * - 34: getFavoriteOptions onPress outer failed
 * - 50/51/52: internal wrapper/normalize errors
 */

/**
 * Attempt to synchronously merge a new favorite into the in-memory favorites state
 * using a few conservative patterns (tries in order):
 *  - useFavoritesStore.setState if exposed (zustand internal API)
 *  - useFavoritesStore.getState().setFavorites if provided by store API
 *  - fallback: call fetchFavorites() to reload from persistence
 *
 * This code is defensive: it never throws and logs outcomes for debugging.
 */
function mergeIntoStoreFavorites(newItem: any) {
  try {
    const storeApi = (useFavoritesStore as any);
    // 1) setState on store (zustand exposes setState on the hook function)
    if (storeApi && typeof storeApi.setState === "function") {
      try {
        const current = storeApi.getState ? storeApi.getState().favorites : undefined;
        const arr = Array.isArray(current) ? current : [];
        // avoid duplicate key
        const exists = arr.some((f: any) => f?.key === newItem?.key);
        if (!exists) {
          storeApi.setState({ favorites: [...arr, newItem] });
          // eslint-disable-next-line no-console
          console.warn("[MERGE_FAVS] used storeApi.setState, new_len=", arr.length + 1);
          return true;
        }
        return true;
      } catch (e) {
        logger.info("mergeIntoStoreFavorites via storeApi.setState failed", e);
      }
    }

    // 2) store instance with setter fn (common custom APIs)
    try {
      const state = storeApi && typeof storeApi.getState === "function" ? storeApi.getState() : null;
      if (state && typeof state.setFavorites === "function") {
        const current = Array.isArray(state.favorites) ? state.favorites : [];
        const exists = current.some((f: any) => f?.key === newItem?.key);
        if (!exists) {
          state.setFavorites([...current, newItem]);
          // eslint-disable-next-line no-console
          console.warn("[MERGE_FAVS] used state.setFavorites, new_len=", current.length + 1);
          return true;
        }
        return true;
      }
    } catch (e) {
      logger.info("mergeIntoStoreFavorites via state.setFavorites failed", e);
    }

    // 3) fallback: try to call fetchFavorites to reload from persistence (non-destructive)
    try {
      const state = storeApi && typeof storeApi.getState === "function" ? storeApi.getState() : null;
      if (state && typeof state.fetchFavorites === "function") {
        setTimeout(() => {
          try {
            state.fetchFavorites();
            // eslint-disable-next-line no-console
            console.warn("[MERGE_FAVS] called fetchFavorites fallback");
          } catch (e) {
            logger.info("mergeIntoStoreFavorites fetchFavorites fallback failed", e);
          }
        }, 0);
        return true;
      }
    } catch (e) {
      logger.info("mergeIntoStoreFavorites fetchFavorites attempt failed", e);
    }
  } catch (e) {
    logger.info("mergeIntoStoreFavorites outer failed", e);
  }
  return false;
}

/** safeToggleFavorite: protect toggleFavorite call and refresh/store-merge on success */
function safeToggleFavorite(toggleFn: any, key: string, payload: any, successCode = 22, failCode = 21) {
  try {
    if (!toggleFn || typeof toggleFn !== "function") {
      safeToastCode(20, 2); // toggle not available
      return;
    }
    setTimeout(() => {
      try {
        const res = toggleFn(key, payload);
        const onSuccess = () => {
          safeToastCode(successCode, 1);
          try {
            // try to merge the new item into in-memory favorites to reflect immediately
            const itemToMerge = { key, ...payload };
            const merged = mergeIntoStoreFavorites(itemToMerge);
            if (!merged) {
              // if merge didn't work, fallback to fetchFavorites if available
              const favStore = (useFavoritesStore as any).getState ? (useFavoritesStore as any).getState() : null;
              if (favStore && typeof favStore.fetchFavorites === "function") {
                setTimeout(() => {
                  try {
                    favStore.fetchFavorites();
                  } catch (e) {
                    logger.info("fetchFavorites after toggle failed", e, key);
                  }
                }, 0);
              }
            }
            // debug log current favorites length (non-blocking)
            try {
              const favStore = (useFavoritesStore as any).getState ? (useFavoritesStore as any).getState() : null;
              const favsLen = favStore && Array.isArray(favStore.favorites) ? favStore.favorites.length : null;
              // eslint-disable-next-line no-console
              console.warn("[DEBUG_FAVORITES_AFTER_TOGGLE]", key, "favs_len=", favsLen);
            } catch (_) {}
          } catch (e) {
            logger.info("safeToggleFavorite onSuccess handler failed", e);
          }
        };

        if (res && typeof res.then === "function") {
          res.then(onSuccess).catch((e: any) => {
            logger.info("toggleFavorite promise rejected", e, key);
            safeToastCode(failCode, 2);
          });
        } else {
          onSuccess();
        }
      } catch (e) {
        logger.info("toggleFavorite threw", e, key);
        safeToastCode(failCode, 2);
      }
    }, 0);
  } catch (e) {
    logger.info("safeToggleFavorite outer", e, key);
    safeToastCode(failCode, 2);
  }
}

/** getPlaybackOptions: safe implementation with numeric codes */
export function getPlaybackOptions(params: PlaybackOptionsParams): AlertButton[] {
  try {
    logger.info("getPlaybackOptions called", params);
  } catch (e) {
    // ignore logging error
  }
  // show entry code (non-blocking) for quick visual confirmation
  safeToastCode(10, 1);

  const { id, title, source, progress, isFavorite, onRecordDeleted } = params;

  // Safe access to toggleFavorite via store.getState()
  const toggleFavorite =
    (useFavoritesStore as any).getState && (useFavoritesStore as any).getState().toggleFavorite
      ? (useFavoritesStore as any).getState().toggleFavorite
      : undefined;

  const opts: any[] = [];

  if (progress !== undefined) {
    opts.push({
      text: "删除观看记录",
      onPress: () => {
        try {
          // show confirmation; inner delete uses delayed async and codes for errors
          Alert.alert(
            "删除观看记录",
            `确定要删除 "${title}" 的观看记录吗？`,
            normalizeOptions([
              { text: "取消", style: "cancel" },
              {
                text: "删除",
                style: "destructive",
                onPress: () => {
                  setTimeout(async () => {
                    try {
                      // lazy require PlayRecordManager to avoid import side-effects
                      // eslint-disable-next-line @typescript-eslint/no-var-requires
                      const PlayRecordManager = require("@/services/storage").PlayRecordManager;
                      if (PlayRecordManager && typeof PlayRecordManager.remove === "function") {
                        await PlayRecordManager.remove(source, id);
                      } else {
                        logger.info("PlayRecordManager.remove not available");
                        safeToastCode(11, 2);
                      }
                      wrapSafeCallback(onRecordDeleted)();
                      safeToastCode(13, 1); // success code for delete
                    } catch (e) {
                      logger.info("remove play record failed", e);
                      safeToastCode(12, 2);
                      try {
                        Alert.alert("", String(12)); // also show code in alert as fallback
                      } catch (a) {
                        // ignore
                      }
                    }
                  }, 0);
                },
              },
            ])
          );
        } catch (e) {
          logger.info("failed to show delete confirmation", e);
          safeToastCode(14, 2);
        }
      },
    });
  }

  // favorite toggle
  opts.push({
    text: isFavorite ? "取消收藏" : "加到我的收藏",
    onPress: () => {
      try {
        const key = `${source}+${id}`;
        const payload = {
          id,
          source,
          title,
          source_name: source,
          cover: "",
          year: "",
        };
        safeToggleFavorite(toggleFavorite, key, payload, isFavorite ? 23 : 22, 21);
      } catch (e) {
        logger.info("favorite option onPress failed", e);
        safeToastCode(24, 2);
      }
    },
  });

  return normalizeOptions(opts);
}

/** getFavoriteOptions: safe implementation with numeric codes */
export function getFavoriteOptions(params: FavoriteOptionsParams): AlertButton[] {
  try {
    logger.info("getFavoriteOptions called", params);
  } catch (e) {
    // ignore
  }
  safeToastCode(30, 1);

  const { id, title, source, isFavorite } = params;

  const toggleFavorite =
    (useFavoritesStore as any).getState && (useFavoritesStore as any).getState().toggleFavorite
      ? (useFavoritesStore as any).getState().toggleFavorite
      : undefined;

  const opts: any[] = [
    {
      text: isFavorite ? "取消收藏" : "加到我的收藏",
      onPress: () => {
        try {
          const key = `${source}+${id}`;
          const payload = { id, source, title, source_name: source, cover: "", year: "" };
          safeToggleFavorite(toggleFavorite, key, payload, isFavorite ? 33 : 32, 21);
        } catch (e) {
          logger.info("favorite option onPress failed", e);
          safeToastCode(34, 2);
        }
      },
    },
  ];

  return normalizeOptions(opts);
}