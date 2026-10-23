import type { ColorToken, ThemeId } from "@template/design-tokens/themes";

export type Editing = {
  themeId: ThemeId;
  token: ColorToken;
  previous?: string;
  previousTheme: ThemeId;
  input: string;
  picker: string;
  opacity: number;
};

export function colorParts(value: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return {
    hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`,
    opacity: Math.round((a / 255) * 100),
    identity: a === 0 ? "transparent" : `${r},${g},${b},${a}`,
  };
}

export function colorWithOpacity(hex: string, opacity: number) {
  if (opacity === 100) return hex.toUpperCase();
  return `${hex}${Math.round((opacity / 100) * 255)
    .toString(16)
    .padStart(2, "0")}`.toUpperCase();
}

export function valueLabel(value: string) {
  if (value.startsWith("var(")) return `关联 · ${value.slice(12, -1)}`;
  if (value.startsWith("color-mix")) return "自动派生";
  if (value === "transparent") return "透明";
  return value;
}
