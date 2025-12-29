import { BUILD_ENV } from './BuildEnv';

export const UPDATE_CONFIG = {
  // 是否自動檢查更新
  AUTO_CHECK: true,

  // 檢查間隔：12 小時
  CHECK_INTERVAL: 12 * 60 * 60 * 1000,

  // 官方 OrionTV 的版本來源
  ORIONTV_ORG_GITHUB_RAW_URL:
    `https://ghfast.top/https://raw.githubusercontent.com/orion-lib/OrionTV/refs/heads/master/package.json?t=${Date.now()}`,

  // 當前 repo 的版本來源
  GITHUB_RAW_URL:
    `https://raw.githubusercontent.com/${BUILD_ENV.USER_NAME}/${BUILD_ENV.REPO_NAME}/${BUILD_ENV.BRANCH_NAME}/package.json`,

  // 生成下載 URL
  getDownloadUrl(version: string): string {
    const safeBranch = BUILD_ENV.BRANCH_NAME.replace(/[^a-zA-Z0-9_-]/g, "-");
    const suffix =
      BUILD_ENV.BRANCH_NAME === "main" || BUILD_ENV.BRANCH_NAME === "master"
        ? ""
        : `-${safeBranch}`;
    return `https://github.com/${BUILD_ENV.USER_NAME}/${BUILD_ENV.REPO_NAME}/releases/download/v${version}${suffix}/orionTV.${version}${suffix}.apk`;
  },

  // 是否顯示 Release Notes
  SHOW_RELEASE_NOTES: true,

  // 是否允許跳過版本
  ALLOW_SKIP_VERSION: true,

  // 下載逾時：10 分鐘
  DOWNLOAD_TIMEOUT: 10 * 60 * 1000,

  // 僅 WiFi 自動下載
  AUTO_DOWNLOAD_ON_WIFI: false,

  // 通知設定
  NOTIFICATION: {
    ENABLED: true,
    TITLE: "OrionTV 更新",
    DOWNLOADING_TEXT: "正在下載新版本...",
    DOWNLOAD_COMPLETE_TEXT: "下載完成，點擊安裝",
  },
};
