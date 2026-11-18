const DEFAULT_THEME_COLOR = "#b5445e";
const DEFAULT_SECONDARY_COLOR = "#d38e9e";
export const DEFAULT_THEME_OPACITY = 100;

export interface ThemePreset {
  id: string;
  name: string;
  color: string;
  secondary?: string;
  previewBg: string;
  accent: string;
  description: string;
}

export interface MultiColorPalette {
  id: string;
  name: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  tintLight: string;
  tintDark: string;
  surfaceDark: string;
  description: string;
}

export interface WallpaperPreset {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  previewStyle: {
    background?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundSize?: string;
  };
}

/** 5 款克制轻量 CSS 背景纹理预设 */
export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "none",
    name: "纯色留白",
    subtitle: "干净通透纯色画布",
    url: "none",
    previewStyle: { background: "#faf8f8" },
  },
  {
    id: "sakura-glow",
    name: "浅樱柔雾",
    subtitle: "低饱和淡粉微光",
    url: "radial-gradient(ellipse 75% 50% at 20% 0%, rgba(181, 68, 94, 0.08), transparent 68%), radial-gradient(ellipse 65% 45% at 85% 10%, rgba(211, 142, 158, 0.09), transparent 65%)",
    previewStyle: { background: "linear-gradient(135deg, #f8eaee 0%, #faf5f6 60%, #ffffff 100%)" },
  },
  {
    id: "starry-nebula",
    name: "紫藤暮色",
    subtitle: "素雅靛紫雾霭",
    url: "radial-gradient(ellipse 75% 48% at 25% 0%, rgba(90, 82, 168, 0.09), transparent 68%), radial-gradient(circle 500px at 85% 15%, rgba(149, 143, 209, 0.08), transparent 62%)",
    previewStyle: { background: "linear-gradient(135deg, #ecebf8 0%, #f5f4fb 60%, #ffffff 100%)" },
  },
  {
    id: "washi-dots",
    name: "手账点阵",
    subtitle: "极细纸面网格点",
    url: "radial-gradient(rgba(100, 116, 139, 0.18) 1px, transparent 1px)",
    previewStyle: {
      backgroundColor: "#f8f8f7",
      backgroundImage: "radial-gradient(rgba(100, 116, 139, 0.32) 1px, transparent 1px)",
      backgroundSize: "8px 8px",
    },
  },
  {
    id: "morning-mist",
    name: "海盐青岚",
    subtitle: "清透雾蓝呼吸感",
    url: "radial-gradient(ellipse 75% 50% at 18% 0%, rgba(36, 106, 136, 0.08), transparent 68%), radial-gradient(circle 500px at 85% 18%, rgba(111, 164, 188, 0.08), transparent 62%)",
    previewStyle: { background: "linear-gradient(135deg, #e9f2f7 0%, #f4f9fb 60%, #ffffff 100%)" },
  },
];

/** 6 套低饱和同色系画廊配色（全线 WCAG AA ≥ 5.2:1，杜绝高饱和撞色） */
export const MULTI_COLOR_PALETTES: MultiColorPalette[] = [
  {
    id: "rose_mist",
    name: "浅樱豆沙",
    primary: "#b5445e",
    primaryDark: "#b5445e",
    secondary: "#d38e9e",
    accent: "#f3dce2",
    tintLight: "#faf8f8",
    tintDark: "#141316",
    surfaceDark: "#1d1b20",
    description: "豆沙玫瑰 × 浅烟粉",
  },
  {
    id: "kyoto_ink",
    name: "京都纸墨",
    primary: "#3f4d5e",
    primaryDark: "#4e6076",
    secondary: "#8494a6",
    accent: "#dde3ea",
    tintLight: "#f8f8f7",
    tintDark: "#131518",
    surfaceDark: "#1c1f24",
    description: "青石墨蓝 × 宣纸白",
  },
  {
    id: "sea_mist",
    name: "海盐雾蓝",
    primary: "#246a88",
    primaryDark: "#277191",
    secondary: "#6fa4bc",
    accent: "#d5e7f0",
    tintLight: "#f6f9fb",
    tintDark: "#10161c",
    surfaceDark: "#182129",
    description: "雾海青蓝 × 浅海盐",
  },
  {
    id: "moss_tea",
    name: "抹茶苔绿",
    primary: "#2c6d58",
    primaryDark: "#2f745e",
    secondary: "#77a696",
    accent: "#d4e8e0",
    tintLight: "#f7faf8",
    tintDark: "#111815",
    surfaceDark: "#19231f",
    description: "抹茶松绿 × 浅艾草",
  },
  {
    id: "wisteria_dusk",
    name: "暮山紫藤",
    primary: "#5a52a8",
    primaryDark: "#6159b3",
    secondary: "#958fd1",
    accent: "#e1dff5",
    tintLight: "#f8f7fb",
    tintDark: "#14131d",
    surfaceDark: "#1d1c2a",
    description: "紫藤暮靛 × 浅丁香",
  },
  {
    id: "amber_latte",
    name: "焦糖拿铁",
    primary: "#9a5033",
    primaryDark: "#a65738",
    secondary: "#c8937c",
    accent: "#efe0d8",
    tintLight: "#faf8f6",
    tintDark: "#181412",
    surfaceDark: "#231e1b",
    description: "赤陶焦糖 × 燕麦奶咖",
  },
];

export const THEME_PRESETS: ThemePreset[] = [
  ...MULTI_COLOR_PALETTES.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.primary,
    secondary: p.secondary,
    previewBg: p.tintLight,
    accent: p.accent,
    description: p.description,
  })),
  { id: "sakura", name: "春日樱落", color: "#d6336c", secondary: "#ea7b52", previewBg: "#fdf8f9", accent: "#ffd0da", description: "经典蔷薇绯红，生机与浪漫交织" },
  { id: "paper_ink", name: "极简纸墨", color: "#334155", secondary: "#c2410c", previewBg: "#f8f9fa", accent: "#e4e4e7", description: "极简纯粹纸墨，水墨书卷雅致风范" },
  { id: "cyber_cold", name: "赛博冷萃", color: "#0369a1", secondary: "#4f46e5", previewBg: "#f6fafc", accent: "#70e1ff", description: "清透冷萃蓝，冷静克制质感" },
  { id: "aoi_sora", name: "和风青空", color: "#0284c7", secondary: "#0d9488", previewBg: "#f0f9ff", accent: "#7dd3fc", description: "海风拂过澄澈天际，辽阔明亮" },
  { id: "midnight_deep", name: "午夜深邃", color: "#4f46e5", secondary: "#9333ea", previewBg: "#f8f7fc", accent: "#a5b4fc", description: "静谧午夜深蓝星空，专注而内敛" },
];

export const ACCENT_COLOR_PRESETS = [
  "#0284c7",
  "#0369a1",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#9333ea",
  "#c026d3",
  "#d6336c",
  "#e11d48",
  "#c2410c",
  "#b45309",
  "#047857",
  "#0d9488",
  "#334155",
];

export const OPACITY_SHORTCUTS = [100, 92, 82];

function normalizeHex(value: string | undefined | null, fallback = DEFAULT_THEME_COLOR) {
  if (!value) return fallback;
  const trimmed = value.trim();

  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const expanded = short[1]
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded}`.toLowerCase();
  }

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function themeColorToRgb(value: string | undefined | null) {
  return hexToRgb(normalizeHex(value));
}

function mix(value: number, target: number, ratio: number) {
  return Math.round(value + (target - value) * ratio);
}

function shade(hex: string, ratio: number) {
  const { r, g, b } = hexToRgb(hex);
  const target = ratio < 0 ? 0 : 255;
  const amount = Math.abs(ratio);

  return {
    r: mix(r, target, amount),
    g: mix(g, target, amount),
    b: mix(b, target, amount),
  };
}

function toCssRgb({ r, g, b }: { r: number; g: number; b: number }) {
  return `${r} ${g} ${b}`;
}

/** 计算 WCAG 2.1 相对亮度与白字对比度，确保主色按钮永不出现“浅底白字” */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatioWithWhite(hex: string): number {
  const lum = getRelativeLuminance(hex);
  return (1.0 + 0.05) / (lum + 0.05);
}

export function normalizeThemeColor(value: string | undefined | null) {
  return normalizeHex(value, "#fc466b");
}

export function normalizeThemeOpacity(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(100, Math.max(30, Math.round(value)));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.min(100, Math.max(30, parsed));
    }
  }
  return DEFAULT_THEME_OPACITY;
}

let currentThemeColorHex = DEFAULT_THEME_COLOR;
let currentSecondaryColorHex = DEFAULT_SECONDARY_COLOR;
let currentPaletteId: string | undefined = "rose_mist";

/** 根据预设 ID 或主色自动匹配对应的语义色盘（兼容历史预设 ID 平滑迁移） */
export function findPaletteByIdOrColor(presetId?: string | null, colorHex?: string | null): MultiColorPalette | undefined {
  if (presetId) {
    const byId = MULTI_COLOR_PALETTES.find((p) => p.id === presetId);
    if (byId) return byId;
    if (presetId === "cherry_peach" || presetId === "sakura") return MULTI_COLOR_PALETTES[0];
    if (presetId === "paper_ink") return MULTI_COLOR_PALETTES[1];
    if (presetId === "sea_salt" || presetId === "cyber_cold" || presetId === "aoi_sora") return MULTI_COLOR_PALETTES[2];
    if (presetId === "forest_sun") return MULTI_COLOR_PALETTES[3];
    if (presetId === "twilight_nebula" || presetId === "midnight_deep") return MULTI_COLOR_PALETTES[4];
    if (presetId === "sunset_caramel") return MULTI_COLOR_PALETTES[5];
  }
  if (colorHex) {
    const norm = normalizeHex(colorHex);
    const byColor = MULTI_COLOR_PALETTES.find(
      (p) => p.primary.toLowerCase() === norm || p.primaryDark.toLowerCase() === norm
    );
    if (byColor) return byColor;
  }
  return undefined;
}

if (typeof window !== "undefined") {
  window.addEventListener("colorSchemeChange", () => {
    applyThemeColor(currentThemeColorHex, currentSecondaryColorHex, currentPaletteId);
  });
}

export function applyThemeColor(
  value: string | undefined | null,
  secondaryValue?: string | null,
  presetId?: string | null
) {
  const color = normalizeHex(value);
  const matchedPalette = findPaletteByIdOrColor(presetId, color);
  const secondary = secondaryValue
    ? normalizeHex(secondaryValue, DEFAULT_SECONDARY_COLOR)
    : matchedPalette?.secondary || DEFAULT_SECONDARY_COLOR;

  currentThemeColorHex = color;
  currentSecondaryColorHex = secondary;
  currentPaletteId = matchedPalette?.id;

  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.getAttribute("data-color-mode") === "dark" || root.classList.contains("dark");

  // 暗黑模式使用色盘专属高对比暗色主色；自定义超暗色自动使用高对比暖朱色而非浅灰，严禁“浅底白字”
  let effectiveHex = color;
  if (isDark) {
    if (matchedPalette) {
      effectiveHex = matchedPalette.primaryDark;
    } else if (getRelativeLuminance(color) < 0.05) {
      effectiveHex = "#c2410c";
    }
  }

  const effectiveRgb = hexToRgb(effectiveHex);
  const secRgb = hexToRgb(secondary);

  root.style.setProperty("--theme-rgb", toCssRgb(effectiveRgb));
  root.style.setProperty("--theme-hover-rgb", toCssRgb(shade(effectiveHex, isDark ? 0.12 : -0.16)));
  root.style.setProperty("--theme-active-rgb", toCssRgb(shade(effectiveHex, isDark ? 0.2 : -0.26)));
  root.style.setProperty("--theme-secondary-rgb", toCssRgb(secRgb));

  // 画布与表面语义联动：彻底消除死锁灰底，同时保持高级克制
  if (matchedPalette) {
    if (isDark) {
      root.style.setProperty("--rin-canvas-rgb", toCssRgb(hexToRgb(matchedPalette.tintDark)));
      root.style.setProperty("--rin-surface-rgb", toCssRgb(hexToRgb(matchedPalette.surfaceDark)));
    } else {
      root.style.setProperty("--rin-canvas-rgb", toCssRgb(hexToRgb(matchedPalette.tintLight)));
      root.style.setProperty("--rin-surface-rgb", "255 255 255");
    }
  } else {
    root.style.removeProperty("--rin-canvas-rgb");
    root.style.removeProperty("--rin-surface-rgb");
  }
}

export function applyThemePalette(palette: MultiColorPalette) {
  applyThemeColor(palette.primary, palette.secondary, palette.id);
}

export function applyThemeOpacity(value: unknown) {
  const opacity = normalizeThemeOpacity(value);
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const alpha = opacity / 100;
  root.style.setProperty("--rin-surface-alpha", alpha.toString());
  root.style.setProperty("--rin-glass-opacity", `${opacity}%`);
  const blurPx = opacity >= 98 ? 0 : Math.min(12, Math.round((1 - alpha) * 18 + 3));
  root.style.setProperty("--rin-glass-blur", `${blurPx}px`);
  root.style.setProperty("--rin-glass-border-alpha", opacity >= 98 ? "0.08" : `${(0.08 + (1 - alpha) * 0.12).toFixed(2)}`);
}

export function applyArtTitleColor(value: string | undefined | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!value || value.trim().length === 0) {
    root.style.removeProperty("--art-title-rgb");
    return;
  }
  const color = normalizeHex(value);
  root.style.setProperty("--art-title-rgb", toCssRgb(hexToRgb(color)));
}

export function applyThemeFontFamily(family: string | undefined | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (family === "serif") {
    root.style.setProperty(
      "--rin-font-family",
      '"Noto Serif SC", "Source Han Serif CN VF", "Songti SC", "STSong", serif'
    );
  } else if (family === "mono") {
    root.style.setProperty(
      "--rin-font-family",
      'ui-monospace, SFMono-Regular, "Fira Code", Menlo, Monaco, Consolas, monospace'
    );
  } else {
    root.style.setProperty(
      "--rin-font-family",
      'Cantarell, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif'
    );
  }
}

export function applyThemeFontSize(value: unknown) {
  if (typeof document === "undefined") return;
  const parsed = Number.parseInt(String(value ?? 16), 10);
  const size = Math.min(22, Math.max(13, Number.isNaN(parsed) ? 16 : parsed));
  document.documentElement.style.setProperty("--rin-font-size", `${size}px`);
}

export function applyThemeWallpaper(url: string | undefined | null, opacity?: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const cleanUrl = (url || "").trim();

  if (!cleanUrl || cleanUrl === "none" || cleanUrl === "empty") {
    root.style.setProperty("--rin-wallpaper-url", "none");
    root.style.setProperty("--rin-wallpaper-opacity", "0");
    root.style.setProperty("--rin-wallpaper-size", "cover");
    root.style.setProperty("--rin-wallpaper-repeat", "no-repeat");
    document.body.classList.add("no-wallpaper");
    document.body.classList.remove("has-wallpaper");
    return;
  }

  document.body.classList.remove("no-wallpaper");
  document.body.classList.add("has-wallpaper");

  const isCssImageFn = /^(radial-gradient|linear-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|url)\(/i.test(cleanUrl);
  const isDotPattern = /1px,\s*transparent\s*1px/i.test(cleanUrl);

  root.style.setProperty("--rin-wallpaper-url", isCssImageFn ? cleanUrl : `url('${cleanUrl}')`);
  root.style.setProperty("--rin-wallpaper-size", isDotPattern ? "22px 22px" : "cover");
  root.style.setProperty("--rin-wallpaper-repeat", isDotPattern ? "repeat" : "no-repeat");

  if (opacity !== undefined) {
    const alpha = Math.min(100, Math.max(0, opacity)) / 100;
    root.style.setProperty("--rin-wallpaper-opacity", alpha.toFixed(2));
  }
}

export function applyThemeCustomCursor(enabled: boolean) {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.body.classList.add("custom-cursor-enabled");
  } else {
    document.body.classList.remove("custom-cursor-enabled");
  }
}

export function applyGalleryTiltDegree(degree: number) {
  if (typeof document === "undefined") return;
  const clamped = Math.min(10, Math.max(0, degree));
  document.documentElement.style.setProperty("--rin-tilt-degree", `${clamped}deg`);
}

export function applyFullTheme(color?: string | null, opacity?: unknown, secondaryColor?: string | null, presetId?: string | null) {
  applyThemeColor(color, secondaryColor, presetId);
  applyThemeOpacity(opacity);
}
