const path = require('node:path');
const heroUINativePlugin = require('heroui-native/tailwind-plugin').default;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    path.join(
      path.dirname(require.resolve('heroui-native/package.json')),
      'lib/**/*.{js,ts,jsx,tsx}',
    ),
  ],
  presets: [require('nativewind/preset')],
  plugins: [heroUINativePlugin],
};
