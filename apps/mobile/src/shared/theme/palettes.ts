import { tokens } from '@template/design-tokens';
import Color from 'colorjs.io';
import type { ThemeConfig } from 'heroui-native';

export const themeOptions = [
  { id: 'studio', name: '专注工作', description: '灰蓝留白 · 紫靛强调', mode: 'light' },
  { id: 'clarity', name: '清晰交互', description: '中性表面 · 明确反馈', mode: 'light' },
  { id: 'reading', name: '温润阅读', description: '暖色纸面 · 舒展阅读', mode: 'light' },
  { id: 'night', name: '夜间工作', description: '柔和深底 · 清晰层级', mode: 'dark' },
] as const;
export type ThemeId = (typeof themeOptions)[number]['id'];

// React Native needs concrete sRGB colors; CSS var()/color-mix() stay on Web.
const nativeColor = (value: string) => new Color(value).to('srgb').toString({ format: 'hex' });
const c = tokens.color;
const studio = {
  background: c.canvas,
  foreground: c.ink,
  surface: c.surface,
  'surface-secondary': c.surfaceSubtle,
  'surface-tertiary': c.surfaceMuted,
  muted: c.muted,
  default: c.surfaceMuted,
  accent: c.accent,
  'accent-foreground': c.surface,
  success: c.success,
  'success-foreground': c.surface,
  warning: c.warning,
  'warning-foreground': c.surface,
  danger: c.danger,
  'danger-foreground': c.surface,
  border: c.line,
  separator: c.line,
};

function makePalette(source: Record<string, string>) {
  const color = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, nativeColor(value)]),
  );
  const mix = (a: string, b: string, amount: number) =>
    new Color(a).mix(new Color(b), amount, { space: 'srgb' }).toString({ format: 'hex' });
  return {
    background: color.background,
    foreground: color.foreground,
    panel: color.surface,
    surface: color.surface,
    surfaceForeground: color.foreground,
    surface1: color['surface-secondary'],
    surface2: color['surface-tertiary'],
    surface3: color.default,
    muted: color.muted,
    mutedForeground: color.muted,
    default: color.default,
    defaultForeground: color.foreground,
    accent: color.accent,
    accentForeground: color['accent-foreground'],
    accentSoft: mix(color.background, color.accent, 0.13),
    accentSoftForeground: mix(color.foreground, color.accent, 0.65),
    success: color.success,
    successForeground: color['success-foreground'],
    warning: color.warning,
    warningForeground: color['warning-foreground'],
    danger: color.danger,
    dangerForeground: color['danger-foreground'],
    border: color.border,
    divider: color.border,
    link: color.accent,
  };
}

export const palettes = {
  studio: makePalette(studio),
  clarity: makePalette(tokens.themes.clarity),
  reading: makePalette(tokens.themes.reading),
  night: makePalette(tokens.themes.night),
};

export function heroTheme(id: ThemeId): ThemeConfig {
  const theme = {
    colors: palettes[id],
    // HeroUI multiplies DEFAULT for rounded-* (2xl = 2x, 3xl = 3x).
    borderRadius: { DEFAULT: '8px', panel: '16px', 'panel-inner': '12px' },
  };
  return { light: theme, dark: theme };
}
