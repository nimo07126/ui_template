const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo SDK 54 discovers the pnpm workspace and shared packages automatically.
const config = getDefaultConfig(__dirname);
// Reanimated's precompiled web entry bypasses NativeWind's JSX interop.
// Compile its source for the optional browser preview, as Metro does on native.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-reanimated') {
    return context.resolveRequest(
      { ...context, mainFields: ['react-native', 'browser', 'main'] },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
