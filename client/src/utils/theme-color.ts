const DEFAULT_THEME_COLOR = "#fc466b";
const DEFAULT_SECONDARY_COLOR = "#ff85a1";
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

/** 5 款清新轻量 CSS 背景纹理预设 */
export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "none",
    name: "纯色留白",
    subtitle: "干净通透纯色画布",
    url: "none",
    previewStyle: { background: "#f8fafc" },
  },
  {
    id: "sakura-glow",
    name: "春日樱雾",
    subtitle: "粉白轻透微光",
    url: "radial-gradient(ellipse 75% 50% at 20% 0%, rgba(252, 70, 107, 0.12), transparent 68%), radial-gradient(ellipse 65% 45% at 85% 10%, rgba(255, 182, 193, 0.16), transparent 65%)",
    previewStyle: { background: "linear-gradient(135deg, #ffe4ec 0%, #fff5f7 60%, #ffffff 100%)" },
  },
  {
    id: "starry-nebula",
    name: "星空微澜",
    subtitle: "靛蓝紫霞轻雾",
    url: "radial-gradient(ellipse 75% 48% at 25% 0%, rgba(99, 102, 241, 0.13), transparent 68%), radial-gradient(circle 500px at 85% 15%, rgba(139, 92, 246, 0.11), transparent 62%)",
    previewStyle: { background: "linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 60%, #ffffff 100%)" },
  },
  {
    id: "washi-dots",
    name: "手账点阵",
    subtitle: "极细纸面网格点",
    url: "radial-gradient(rgba(100, 116, 139, 0.2) 1px, transparent 1px)",
    previewStyle: {
      backgroundColor: "#f8fafc",
      backgroundImage: "radial-gradient(rgba(100, 116, 139, 0.34) 1px, transparent 1px)",
      backgroundSize: "8px 8px",
    },
  },
  {
    id: "morning-mist",
    name: "晴空薄荷",
    subtitle: "天蓝青岚呼吸感",
    url: "radial-gradient(ellipse 75% 50% at 18% 0%, rgba(14, 165, 233, 0.12), transparent 68%), radial-gradient(circle 500px at 85% 18%, rgba(20, 184, 166, 0.12), transparent 62%)",
    previewStyle: { background: "linear-gradient(135deg, #e0f2fe 0%, #ccfbf1 60%, #ffffff 100%)" },
  },
];

/** 8 套明快清新的精选主题色盘（供顶部一键快切与后台快速挑选） */
export const MULTI_COLOR_PALETTES: MultiColorPalette[] = [
  {
    id: "sakura",
    name: "春日樱落",
    primary: "#fc466b",
    primaryDark: "#fb5678",
    secondary: "#ff85a1",
    accent: "#ffd0da",
    tintLight: "#fff9fa",
    tintDark: "#15161c",
    surfaceDark: "#1e2028",
    description: "经典蔷薇樱粉，明快灵动",
  },
  {
    id: "aoi_sora",
    name: "和风青空",
    primary: "#0ea5e9",
    primaryDark: "#38bdf8",
    secondary: "#38bdf8",
    accent: "#bae6fd",
    tintLight: "#f7fbff",
    tintDark: "#121720",
    surfaceDark: "#1b222e",
    description: "澄澈晴空天蓝，清透辽阔",
  },
  {
    id: "midnight_deep",
    name: "午夜深邃",
    primary: "#6366f1",
    primaryDark: "#818cf8",
    secondary: "#818cf8",
    accent: "#c7d2fe",
    tintLight: "#f8f9ff",
    tintDark: "#141521",
    surfaceDark: "#1d1f2f",
    description: "星夜靛蓝紫，沉静有质感",
  },
  {
    id: "violet_twilight",
    name: "暮光紫霞",
    primary: "#8b5cf6",
    primaryDark: "#a78bfa",
    secondary: "#c084fc",
    accent: "#ddd6fe",
    tintLight: "#faf8ff",
    tintDark: "#171422",
    surfaceDark: "#211d30",
    description: "晚霞梦幻紫韵，轻盈浪漫",
  },
  {
    id: "mint_soda",
    name: "薄荷苏打",
    primary: "#14b8a6",
    primaryDark: "#2dd4bf",
    secondary: "#2dd4bf",
    accent: "#99f6e4",
    tintLight: "#f6fefe",
    tintDark: "#111a1b",
    surfaceDark: "#192628",
    description: "清凉薄荷气泡，清爽透气",
  },
  {
    id: "forest_mist",
    name: "森屿绿野",
    primary: "#10b981",
    primaryDark: "#34d399",
    secondary: "#34d399",
    accent: "#a7f3d0",
    tintLight: "#f6fdf9",
    tintDark: "#111a16",
    surfaceDark: "#192620",
    description: "生机翡翠嫩绿，自然治愈",
  },
  {
    id: "golden_sunset",
    name: "落日熔金",
    primary: "#f59e0b",
    primaryDark: "#fbbf24",
    secondary: "#fbbf24",
    accent: "#fde68a",
    tintLight: "#fffdf7",
    tintDark: "#1a1712",
    surfaceDark: "#25211a",
    description: "暖阳晚霞流金，明朗治愈",
  },
  {
    id: "paper_ink",
    name: "极简纸墨",
    primary: "#27272a",
    primaryDark: "#6366f1",
    secondary: "#71717a",
    accent: "#e4e4e7",
    tintLight: "#fafafa",
    tintDark: "#141518",
    surfaceDark: "#1e2026",
    description: "纯粹纸墨黑白，经典耐看",
  },
];

/** 18 套完整高颜值明快主题预设（完整还原经典调色板体验） */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "sakura", name: "春日樱落", color: "#fc466b", secondary: "#ff85a1", previewBg: "#fff1f3", accent: "#ffd0da", description: "经典蔷薇绯红，生机与浪漫交织" },
  { id: "paper_ink", name: "极简纸墨", color: "#27272a", secondary: "#71717a", previewBg: "#f4f4f5", accent: "#e4e4e7", description: "极简纯粹纸墨，水墨书卷雅致风范" },
  { id: "cyber_cold", name: "赛博冷萃", color: "#00c4ff", secondary: "#38bdf8", previewBg: "#e0f7ff", accent: "#70e1ff", description: "冰蓝电光冷萃，通透未来科技质感" },
  { id: "aoi_sora", name: "和风青空", color: "#0ea5e9", secondary: "#38bdf8", previewBg: "#e0f2fe", accent: "#7dd3fc", description: "海风拂过澄澈天际，辽阔明亮" },
  { id: "midnight_deep", name: "午夜深邃", color: "#6366f1", secondary: "#818cf8", previewBg: "#eef2ff", accent: "#a5b4fc", description: "静谧午夜深蓝星空，专注而内敛" },
  { id: "violet_twilight", name: "暮光紫霞", color: "#8b5cf6", secondary: "#a78bfa", previewBg: "#f5f3ff", accent: "#c4b5fd", description: "落霞与晚霭交融的梦幻紫韵" },
  { id: "forest_mist", name: "森屿绿野", color: "#10b981", secondary: "#34d399", previewBg: "#ecfdf5", accent: "#6ee7b7", description: "清新翡翠森林，自然鲜活气息" },
  { id: "golden_sunset", name: "落日熔金", color: "#f59e0b", secondary: "#fbbf24", previewBg: "#fffbeb", accent: "#fde68a", description: "暖阳晚霞熔金，温馨治愈的暮色" },
  { id: "rose_cream", name: "玫瑰奶霜", color: "#f43f5e", secondary: "#fb7185", previewBg: "#fff1f2", accent: "#fecdd3", description: "丝滑甜润的玫瑰奶霜，柔和典雅" },
  { id: "mint_soda", name: "薄荷苏打", color: "#14b8a6", secondary: "#2dd4bf", previewBg: "#f0fdfa", accent: "#99f6e4", description: "清凉通透薄荷气泡，沁人心脾" },
  { id: "ocean_abyss", name: "蔚蓝深海", color: "#2563eb", secondary: "#60a5fa", previewBg: "#eff6ff", accent: "#93c5fd", description: "澄澈蔚蓝深海，明亮而沉静" },
  { id: "lilac_dream", name: "迷雾丁香", color: "#c026d3", secondary: "#e879f9", previewBg: "#fdf4ff", accent: "#f0abfc", description: "微风吹拂的丁香花海，轻盈曼妙" },
  { id: "caramel_amber", name: "暖橘蜜糖", color: "#f97316", secondary: "#fb923c", previewBg: "#fff7ed", accent: "#fed7aa", description: "明亮暖橘蜜糖，活力温暖手账感" },
  { id: "moss_rain", name: "初霁嫩芽", color: "#84cc16", secondary: "#a3e635", previewBg: "#f7fee7", accent: "#bef264", description: "雨后初霁的嫩绿新芽，朝气盎然" },
  { id: "obsidian_slate", name: "清雾石板", color: "#475569", secondary: "#94a3b8", previewBg: "#f1f5f9", accent: "#cbd5e1", description: "理性克制石板灰调，清爽干练" },
  { id: "peach_coral", name: "珊瑚蜜桃", color: "#fb7185", secondary: "#fda4af", previewBg: "#fff1f2", accent: "#fecdd3", description: "清甜初熟珊瑚蜜桃，活泼灵动" },
  { id: "aurora_teal", name: "极光青翠", color: "#06b6d4", secondary: "#22d3ee", previewBg: "#ecfeff", accent: "#a5f3fc", description: "北极星空下的晶莹青蓝极光" },
  { id: "crimson_flame", name: "朱砂绯红", color: "#ef4444", secondary: "#f87171", previewBg: "#fef2f2", accent: "#fca5a5", description: "鲜明朱砂正红，热烈醒目" },
];

/** 16 色经典圆珠自由调色盘 */
export const ACCENT_COLOR_PRESETS = [
  "#0ea5e9", // 天蓝 Sky
  "#2563eb", // 宝蓝 Blue
  "#4f46e5", // 靛蓝 Indigo
  "#6366f1", // 星空紫蓝
  "#8b5cf6", // 紫罗兰 Violet
  "#c026d3", // 丁香紫 Fuchsia
  "#fc466b", // 樱花绯 Rose
  "#f43f5e", // 玫瑰红
  "#fb7185", // 珊瑚蜜桃
  "#f97316", // 暖橘 Orange
  "#f59e0b", // 熔金 Amber
  "#84cc16", // 嫩绿 Lime
  "#10b981", // 翡翠绿 Emerald
  "#14b8a6", // 薄荷青 Teal
  "#06b6d4", // 湖蓝 Cyan
  "#475569", // 石板灰 Slate
];

export const OPACITY_SHORTCUTS = [100, 90, 80];

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
let currentPaletteId: string | undefined = "sakura";

/** 根据预设 ID 或主色自动匹配对应的色盘（兼容历史预设 ID 平滑迁移） */
export function findPaletteByIdOrColor(presetId?: string | null, colorHex?: string | null): MultiColorPalette | undefined {
  if (presetId) {
    const byId = MULTI_COLOR_PALETTES.find((p) => p.id === presetId);
    if (byId) return byId;
    if (presetId === "rose_mist" || presetId === "cherry_peach") return MULTI_COLOR_PALETTES[0];
    if (presetId === "sea_mist" || presetId === "sea_salt" || presetId === "cyber_cold") return MULTI_COLOR_PALETTES[1];
    if (presetId === "wisteria_dusk" || presetId === "twilight_nebula") return MULTI_COLOR_PALETTES[3];
    if (presetId === "moss_tea" || presetId === "forest_sun") return MULTI_COLOR_PALETTES[5];
    if (presetId === "amber_latte" || presetId === "sunset_caramel") return MULTI_COLOR_PALETTES[6];
    if (presetId === "kyoto_ink") return MULTI_COLOR_PALETTES[7];
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
  const matchedPreset = THEME_PRESETS.find((p) => p.id === presetId || p.color.toLowerCase() === color);
  const secondary = secondaryValue
    ? normalizeHex(secondaryValue, DEFAULT_SECONDARY_COLOR)
    : matchedPreset?.secondary || matchedPalette?.secondary || toHexFromShade(color, 0.28);

  currentThemeColorHex = color;
  currentSecondaryColorHex = secondary;
  currentPaletteId = presetId || matchedPalette?.id;

  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.getAttribute("data-color-mode") === "dark" || root.classList.contains("dark");

  // 保持色彩鲜活通透；仅当主色在暗黑模式下极度接近纯黑（如 #27272a）时平滑提亮，避免融进黑夜背景
  let effectiveHex = color;
  if (isDark) {
    if (matchedPalette && getRelativeLuminance(color) < 0.04) {
      effectiveHex = matchedPalette.primaryDark;
    } else if (getRelativeLuminance(color) < 0.04) {
      effectiveHex = "#6366f1";
    }
  }

  const effectiveRgb = hexToRgb(effectiveHex);
  const secRgb = hexToRgb(secondary);

  root.style.setProperty("--theme-rgb", toCssRgb(effectiveRgb));
  root.style.setProperty("--theme-hover-rgb", toCssRgb(shade(effectiveHex, isDark ? 0.14 : -0.14)));
  root.style.setProperty("--theme-active-rgb", toCssRgb(shade(effectiveHex, isDark ? 0.22 : -0.24)));
  root.style.setProperty("--theme-secondary-rgb", toCssRgb(secRgb));

  // 画布保持清透干净的白/浅雪与深炭夜，绝不发灰发闷
  if (isDark) {
    root.style.setProperty("--rin-canvas-rgb", matchedPalette ? toCssRgb(hexToRgb(matchedPalette.tintDark)) : "21 22 28");
    root.style.setProperty("--rin-surface-rgb", matchedPalette ? toCssRgb(hexToRgb(matchedPalette.surfaceDark)) : "30 32 40");
  } else {
    root.style.setProperty("--rin-canvas-rgb", matchedPalette ? toCssRgb(hexToRgb(matchedPalette.tintLight)) : "248 250 252");
    root.style.setProperty("--rin-surface-rgb", "255 255 255");
  }
}

function toHexFromShade(hex: string, ratio: number): string {
  const { r, g, b } = shade(hex, ratio);
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
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
