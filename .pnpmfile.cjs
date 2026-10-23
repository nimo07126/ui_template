module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'heroui-native' && pkg.version === '1.0.0-alpha.16') {
        // This NativeWind-era release declares SDK 54 peers. Mobile compiles its
        // TypeScript source with the SDK 57 Worklets plugin (see metro.config.js),
        // rather than executing its precompiled Worklets 0.5.1 functions.
        Object.assign(pkg.peerDependencies, {
          nativewind: '4.2.7',
          'react-native-reanimated': '4.5.1',
          'react-native-worklets': '0.10.1',
          'react-native-safe-area-context': '~5.7.0',
        });
      }
      return pkg;
    },
  },
};
