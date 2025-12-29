// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the project and workspace directories
// eslint-disable-next-line no-undef
const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// When enabled, the optional code below will allow Metro to resolve
// and bundle source files with TV-specific extensions
// (e.g., *.ios.tv.tsx, *.android.tv.tsx, *.tv.tsx)
//
// Metro will still resolve source files with standard extensions
// as usual if TV-specific files are not found for a module.
//
// if (process.env?.EXPO_TV === '1') {
//   const originalSourceExts = config.resolver.sourceExts;
//   const tvSourceExts = [
//     ...originalSourceExts.map((e) => `tv.${e}`),
//     ...originalSourceExts,
//   ];
//   config.resolver.sourceExts = tvSourceExts;
// }

// This can be replaced with `find-yarn-workspace-root`
const monorepoRoot = path.resolve(projectRoot, "../..");

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// === Added alias mapping for ThemedText override (non-invasive) ===
// This maps imports using the alias '@/components/ThemedText' to the
// override implementation at components/overrides/ThemedText.tsx.
// It does not modify or delete the original components/ThemedText.tsx file.
// To revert, remove the entry below and restart Metro with --reset-cache.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@/components/ThemedText": path.resolve(__dirname, "components/overrides/ThemedText.tsx"),
};

module.exports = config;
