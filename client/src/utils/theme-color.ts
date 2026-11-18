const DEFAULT_THEME_COLOR = "#fc466b";
const DEFAULT_SECONDARY_COLOR = "#f59e6c";
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
  secondary: string;
  accent: string;
  tintLight: string;
  tintDark: string;
  description: string;
}

/** 8 套多色联动色盘：每套同时驱动主强调色、辅助呼应色与柔和画布氛围 */
export const MULTI_COLOR_PALETTES: MultiColorPalette[] = [
  {
    id: "cherry_peach",
    name: "樱桃蜜桃",
    primary: "#e84a72",
    secondary: "#f59e6c",
    accent: "#fbcfe8",
    tintLight: "#fff5f7",
    tintDark: "#24141b",
    description: "暖樱粉 × 蜜桃杏",
  },
  {
    id: "sea_salt",
    name: "海盐薄荷",
    primary: "#0284c7",
    secondary: "#14b8a6",
    accent: "#bae6fd",
    tintLight: "#f0f9ff",
    tintDark: "#0f1d28",
    description: "晴空蓝 × 清薄荷",
  },
  {
    id: "twilight_nebula",
    name: "暮光星云",
    primary: "#4f46e5",
    secondary: "#a855f7",
    accent: "#c7d2fe",
    tintLight: "#f5f3ff",
    tintDark: "#17142b",
    description: "靛蓝 × 星云紫",
  },
  {
    id: "forest_sun",
    name: "森屿暖阳",
    primary: "#059669",
    secondary: "#d97706",
    accent: "#a7f3d0",
    tintLight: "#f0fdf4",
    tintDark: "#10221c",
    description: "松柏绿 × 暖琥珀",
  },
  {
    id: "kyoto_ink",
    name: "京都纸墨",
    primary: "#334155",
    secondary: "#c2410c",
    accent: "#cbd5e1",
    tintLight: "#f8fafc",
    tintDark: "#161a20",
    description: "黛石板 × 印章朱",
  },
  {
    id: "sunset_caramel",
    name: "落日焦糖",
    primary: "#ea580c",
    secondary: "#e11d48",
    accent: "#fed7aa",
    tintLight: "#fff7ed",
    tintDark: "#241612",
    description: "琥珀橙 × 玫瑰绯",
  },
  {
    id: "aurora_prism",
    name: "极光青紫",
    primary: "#0d9488",
    secondary: "#7c3aed",
    accent: "#99f6e4",
    tintLight: "#f0fdfa",
    tintDark: "#112023",
    description: "青翠 × 极光紫",
  },
  {
    id: "berry_champagne",
    name: "奶油浆果",
    primary: "#be185d",
    secondary: "#ca8a04",
    accent: "#fbcfe8",
    tintLight: "#fdf2f8",
    tintDark: "#23131c",
    description: "浆果梅 × 香槟金",
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
  { id: "sakura", name: "春日樱落", color: "#fc466b", secondary: "#f59e6c", previewBg: "#fff1f3", accent: "#ffd0da", description: "经典蔷薇绯红，生机与浪漫交织" },
  { id: "paper_ink", name: "极简纸墨", color: "#27272a", secondary: "#c2410c", previewBg: "#f4f4f5", accent: "#e4e4e7", description: "极简纯粹纸墨，水墨书卷雅致风范" },
  { id: "cyber_cold", name: "赛博冷萃", color: "#00c4ff", secondary: "#6366f1", previewBg: "#e0f7ff", accent: "#70e1ff", description: "冰蓝电光冷萃，通透未来科技质感" },
  { id: "aoi_sora", name: "和风青空", color: "#0284c7", secondary: "#14b8a6", previewBg: "#e0f2fe", accent: "#7dd3fc", description: "海风拂过澄澈天际，辽阔明亮" },
  { id: "midnight_deep", name: "午夜深邃", color: "#6366f1", secondary: "#a855f7", previewBg: "#eef2ff", accent: "#a5b4fc", description: "静谧午夜深蓝星空，专注而内敛" },
];

export const ACCENT_COLOR_PRESETS = [
  "#0ea5e9",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#9333ea",
  "#c026d3",
  "#e84a72",
  "#e11d48",
  "#ea580c",
  "#d97706",
  "#eab308",
  "#84cc16",
  "#16a34a",
  "#0d9488",
  "#06b6d4",
  "#475569",
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

export function normalizeThemeColor(value: string | undefined | null) {
  return normalizeHex(value);
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

function getPerceivedLuminance(rgb: { r: number; g: number; b: number }): number {
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/** 根据预设 ID 或主色自动匹配对应的多色组合 */
export function findPaletteByIdOrColor(presetId?: string | null, colorHex?: string | null): MultiColorPalette | undefined {
  if (presetId) {
    const byId = MULTI_COLOR_PALETTES.find((p) => p.id === presetId);
    if (byId) return byId;
  }
  if (colorHex) {
    const norm = normalizeHex(colorHex);
    const byColor = MULTI_COLOR_PALETTES.find((p) => p.primary.toLowerCase() === norm);
    if (byColor) return byColor;
  }
  return undefined;
}

if (typeof window !== "undefined") {
  window.addEventListener("colorSchemeChange", () => {
    applyThemeColor(currentThemeColorHex, currentSecondaryColorHex);
  });
}

export function applyThemeColor(value: string | undefined | null, secondaryValue?: string | null) {
  const color = normalizeHex(value);
  const matchedPalette = findPaletteByIdOrColor(undefined, color);
  const secondary = secondaryValue
    ? normalizeHex(secondaryValue, DEFAULT_SECONDARY_COLOR)
    : matchedPalette?.secondary || DEFAULT_SECONDARY_COLOR;

  currentThemeColorHex = color;
  currentSecondaryColorHex = secondary;

  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const isDark = root.getAttribute("data-color-mode") === "dark" || root.classList.contains("dark");
  const rgb = hexToRgb(color);
  const secRgb = hexToRgb(secondary);
  const luminance = getPerceivedLuminance(rgb);
  const secLuminance = getPerceivedLuminance(secRgb);

  // 暗色模式低明度对比度自适应保护：避免深黛/纸墨色在黑夜模式下融进背景
  const effectiveRgb = isDark && luminance < 75 ? { r: 203, g: 213, b: 225 } : rgb;
  const effectiveSecRgb = isDark && secLuminance < 75 ? { r: 251, g: 146, b: 60 } : secRgb;

  root.style.setProperty("--theme-rgb", toCssRgb(effectiveRgb));
  root.style.setProperty(
    "--theme-hover-rgb",
    toCssRgb(isDark && luminance < 75 ? { r: 226, g: 232, b: 240 } : shade(color, -0.22))
  );
  root.style.setProperty(
    "--theme-active-rgb",
    toCssRgb(isDark && luminance < 75 ? { r: 148, g: 163, b: 184 } : shade(color, -0.34))
  );
  root.style.setProperty("--theme-secondary-rgb", toCssRgb(effectiveSecRgb));
}

export function applyThemePalette(palette: MultiColorPalette) {
  applyThemeColor(palette.primary, palette.secondary);
}

export function applyThemeOpacity(value: unknown) {
  const opacity = normalizeThemeOpacity(value);
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const alpha = opacity / 100;
  root.style.setProperty("--rin-surface-alpha", alpha.toString());
  root.style.setProperty("--rin-glass-opacity", `${opacity}%`);
  // 克制模糊度：避免重度发虚，仅在半透明时给予轻微清透磨砂
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
    return;
  }

  document.body.classList.remove("no-wallpaper");

  // 区分 CSS 渐变函数与图片 URL，彻底修复 radial-gradient 被错包进 url(...) 导致失效的问题
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

export function applyFullTheme(color?: string | null, opacity?: unknown, secondaryColor?: string | null) {
  applyThemeColor(color, secondaryColor);
  applyThemeOpacity(opacity);
}
