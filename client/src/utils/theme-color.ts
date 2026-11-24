const DEFAULT_THEME_COLOR = "#fc466b";
const DEFAULT_CALM_PRESET_ID = "sakura_paper";
const DEFAULT_CALM_PRIMARY_COLOR = "#d87a90";
const DEFAULT_CALM_SECONDARY_COLOR = "#e7a1b0";
const DEFAULT_SECONDARY_COLOR = "#ff85a1";
export const DEFAULT_THEME_OPACITY = 100;

export type TitleFont = "sans" | "serif" | "kai" | "mono";
export type TitleEffect = "clean" | "soft_glow" | "editorial_rule" | "tactile_ink" | "neon_prism";
export type ThemeFontFamily = TitleFont;

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
  surfaceLight: string;
  elevatedLight: string;
  inkLight: string;
  inkMutedLight: string;
  hairlineLight: string;
  tintDark: string;
  surfaceDark: string;
  elevatedDark: string;
  inkDark: string;
  inkMutedDark: string;
  hairlineDark: string;
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

export const TITLE_FONT_STACKS: Record<TitleFont, string> = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, Cantarell, sans-serif',
  serif: '"Noto Serif SC", "Source Han Serif CN", "Source Han Serif CN VF", "Songti SC", "STSong", serif',
  kai: '"LXGW WenKai", "LXGW WenKai Lite", "Kaiti SC", "STKaiti", "BiauKai", serif',
  mono: 'ui-monospace, SFMono-Regular, "Fira Code", Menlo, Monaco, Consolas, monospace',
};

export const TITLE_FONT_OPTIONS: Array<{ id: TitleFont; label: string; description: string }> = [
  { id: "serif", label: "思源宋体", description: "人文画廊刊物衬线" },
  { id: "kai", label: "霞鹜文楷", description: "温润手账楷书气息" },
  { id: "sans", label: "现代黑体", description: "利落几何无衬线" },
  { id: "mono", label: "极客等宽", description: "清晰索引编目等宽" },
];

export const TITLE_EFFECT_OPTIONS: Array<{ id: TitleEffect; label: string; description: string }> = [
  { id: "clean", label: "纯墨极简", description: "克制纯净，无多余装饰" },
  { id: "soft_glow", label: "柔和微光", description: "主题色轻盈光晕" },
  { id: "editorial_rule", label: "刊号细线", description: "舒展字距与主题底线" },
  { id: "tactile_ink", label: "复古压印", description: "纸面凹凸触觉立体墨感" },
  { id: "neon_prism", label: "霓虹棱镜", description: "双色主题流光渐变" },
];

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

/** 多层语义协调主题色盘（Canvas / Surface / Elevated / Ink / Ink Muted / Hairline / Accent） */
export const MULTI_COLOR_PALETTES: MultiColorPalette[] = [
  {
    id: "sakura_paper",
    name: "樱雪纸墨",
    primary: "#D87A90",
    primaryDark: "#E48FA3",
    secondary: "#E7A1B0",
    accent: "#F4DCE2",
    tintLight: "#FDFBFC",
    surfaceLight: "#FFFFFF",
    elevatedLight: "#FFFFFF",
    inkLight: "#2D2628",
    inkMutedLight: "#8E8286",
    hairlineLight: "#E8D5DB",
    tintDark: "#141215",
    surfaceDark: "#1C191D",
    elevatedDark: "#242026",
    inkDark: "#F4EFF1",
    inkMutedDark: "#A1989C",
    hairlineDark: "#352C31",
    description: "莫兰迪樱雪暖纸，低饱和温润画廊默认调性",
  },
  {
    id: "warm_wheat",
    name: "暖麦护眼",
    primary: "#B87A4B",
    primaryDark: "#DDA16E",
    secondary: "#D6A374",
    accent: "#F3E4D2",
    tintLight: "#FAF6EE",
    surfaceLight: "#FFFCF7",
    elevatedLight: "#FFFFFF",
    inkLight: "#2E2720",
    inkMutedLight: "#7B6E60",
    hairlineLight: "#E6DAC8",
    tintDark: "#151310",
    surfaceDark: "#1E1A16",
    elevatedDark: "#28231D",
    inkDark: "#F3EDE4",
    inkMutedDark: "#A89E92",
    hairlineDark: "#383028",
    description: "温润麦穗纸底与棕墨文字，长文阅读护眼舒适",
  },
  {
    id: "sakura",
    name: "经典蔷薇",
    primary: "#fc466b",
    primaryDark: "#fb6f8d",
    secondary: "#ff85a1",
    accent: "#ffd0da",
    tintLight: "#ffffff",
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#262023",
    inkMutedLight: "#71686c",
    hairlineLight: "#ede4e7",
    tintDark: "#14151a",
    surfaceDark: "#1d1f27",
    elevatedDark: "#262933",
    inkDark: "#f5f1f3",
    inkMutedDark: "#a49ba0",
    hairlineDark: "#323542",
    description: "经典蔷薇樱粉，明快灵动",
  },
  {
    id: "aoi_sora",
    name: "和风青空",
    primary: "#0ea5e9",
    primaryDark: "#38bdf8",
    secondary: "#38bdf8",
    accent: "#bae6fd",
    tintLight: "#f8fbfd",
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#1e293b",
    inkMutedLight: "#64748b",
    hairlineLight: "#dce8f2",
    tintDark: "#11161f",
    surfaceDark: "#1a212d",
    elevatedDark: "#222b3a",
    inkDark: "#eff6ff",
    inkMutedDark: "#94a3b8",
    hairlineDark: "#2c3749",
    description: "澄澈晴空天蓝，清透辽阔",
  },
  {
    id: "midnight_deep",
    name: "午夜深邃",
    primary: "#6366f1",
    primaryDark: "#818cf8",
    secondary: "#818cf8",
    accent: "#c7d2fe",
    tintLight: "#fafaff",
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#1e1e2e",
    inkMutedLight: "#666882",
    hairlineLight: "#e2e3f3",
    tintDark: "#131420",
    surfaceDark: "#1c1e2e",
    elevatedDark: "#25283c",
    inkDark: "#f1f2fb",
    inkMutedDark: "#9ca0bd",
    hairlineDark: "#2f334d",
    description: "星夜靛蓝紫，沉静有质感",
  },
  {
    id: "violet_twilight",
    name: "暮光紫霞",
    primary: "#8b5cf6",
    primaryDark: "#a78bfa",
    secondary: "#c084fc",
    accent: "#ddd6fe",
    tintLight: "#fcfaff",
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#251f33",
    inkMutedLight: "#6f6785",
    hairlineLight: "#e8e0f5",
    tintDark: "#161321",
    surfaceDark: "#201c2f",
    elevatedDark: "#2a253d",
    inkDark: "#f5f2fc",
    inkMutedDark: "#a89ec0",
    hairlineDark: "#36304e",
    description: "晚霞梦幻紫韵，轻盈浪漫",
  },
  {
    id: "mint_soda",
    name: "薄荷苏打",
    primary: "#14b8a6",
    primaryDark: "#2dd4bf",
    secondary: "#2dd4bf",
    accent: "#99f6e4",
    tintLight: "#f7fcfb",
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#1b2b29",
    inkMutedLight: "#5f7572",
    hairlineLight: "#d8ece9",
    tintDark: "#10191a",
    surfaceDark: "#182527",
    elevatedDark: "#213235",
    inkDark: "#edf7f6",
    inkMutedDark: "#94aeab",
    hairlineDark: "#293d40",
    description: "清凉薄荷气泡，清爽透气",
  },
  {
    id: "forest_mist",
    name: "森屿绿野",
    primary: "#10b981",
    primaryDark: "#34d399",
    secondary: "#34d399",
    accent: "#a7f3d0",
    tintLight: "#f8fcfa",
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#1c2b24",
    inkMutedLight: "#5d7368",
    hairlineLight: "#d9ece2",
    tintDark: "#101915",
    surfaceDark: "#18251f",
    elevatedDark: "#203129",
    inkDark: "#eef7f2",
    inkMutedDark: "#95afa2",
    hairlineDark: "#293e34",
    description: "生机翡翠嫩绿，自然治愈",
  },
  {
    id: "golden_sunset",
    name: "落日熔金",
    primary: "#f59e0b",
    primaryDark: "#fbbf24",
    secondary: "#fbbf24",
    accent: "#fde68a",
    tintLight: "#fffcf7",
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#2c2418",
    inkMutedLight: "#766957",
    hairlineLight: "#efe2cd",
    tintDark: "#181611",
    surfaceDark: "#242019",
    elevatedDark: "#2f2a21",
    inkDark: "#faf4ea",
    inkMutedDark: "#b0a493",
    hairlineDark: "#3e372b",
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
    surfaceLight: "#ffffff",
    elevatedLight: "#ffffff",
    inkLight: "#18181b",
    inkMutedLight: "#71717a",
    hairlineLight: "#e4e4e7",
    tintDark: "#141518",
    surfaceDark: "#1e2026",
    elevatedDark: "#272a32",
    inkDark: "#f4f4f5",
    inkMutedDark: "#a1a1aa",
    hairlineDark: "#2e313b",
    description: "纯粹纸墨黑白，经典耐看",
  },
];

/** 20 套完整高颜值主题预设（以樱雪纸墨为温润默认，完整保留经典调色板） */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "sakura_paper", name: "樱雪纸墨", color: "#D87A90", secondary: "#E7A1B0", previewBg: "#FDFBFC", accent: "#F4DCE2", description: "莫兰迪樱雪暖纸与温润墨棕，静谧画廊默认皮肤" },
  { id: "warm_wheat", name: "暖麦护眼", color: "#B87A4B", secondary: "#D6A374", previewBg: "#FAF6EE", accent: "#F3E4D2", description: "温和麦穗纸底与棕墨排印，久读不刺眼" },
  { id: "sakura", name: "经典蔷薇", color: "#fc466b", secondary: "#ff85a1", previewBg: "#fff1f3", accent: "#ffd0da", description: "经典蔷薇绯红，生机与浪漫交织" },
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

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
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

let currentThemeColorHex = DEFAULT_CALM_PRIMARY_COLOR;
let currentSecondaryColorHex = DEFAULT_CALM_SECONDARY_COLOR;
let currentPaletteId: string | undefined = DEFAULT_CALM_PRESET_ID;
let currentWallpaperUrl: string | undefined | null = "none";
let currentWallpaperOpacity: number | undefined = 35;

function findPaletteById(id: string): MultiColorPalette | undefined {
  return MULTI_COLOR_PALETTES.find((p) => p.id === id);
}

/** 根据预设 ID 或主色自动匹配对应的色盘（兼容历史预设 ID 平滑迁移） */
export function findPaletteByIdOrColor(presetId?: string | null, colorHex?: string | null): MultiColorPalette | undefined {
  if (presetId) {
    const byId = findPaletteById(presetId);
    if (byId) return byId;
    if (presetId === "default") return findPaletteById("sakura_paper");
    if (presetId === "rose_mist" || presetId === "cherry_peach") return findPaletteById("sakura");
    if (presetId === "sea_mist" || presetId === "sea_salt" || presetId === "cyber_cold") return findPaletteById("aoi_sora");
    if (presetId === "wisteria_dusk" || presetId === "twilight_nebula") return findPaletteById("violet_twilight");
    if (presetId === "moss_tea" || presetId === "forest_sun") return findPaletteById("forest_mist");
    if (presetId === "amber_latte" || presetId === "sunset_caramel") return findPaletteById("golden_sunset");
    if (presetId === "kyoto_ink") return findPaletteById("paper_ink");
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
    applyThemeWallpaper(currentWallpaperUrl, currentWallpaperOpacity);
  });
}

function setRootVarIfChanged(root: HTMLElement, name: string, value: string) {
  if (root.style.getPropertyValue(name) !== value) {
    root.style.setProperty(name, value);
  }
}

export function applyThemeColor(
  value: string | undefined | null,
  secondaryValue?: string | null,
  presetId?: string | null
) {
  const effectivePresetId = presetId || (!value ? DEFAULT_CALM_PRESET_ID : undefined);
  const color = normalizeHex(value, effectivePresetId === DEFAULT_CALM_PRESET_ID ? DEFAULT_CALM_PRIMARY_COLOR : DEFAULT_THEME_COLOR);
  const matchedPalette = findPaletteByIdOrColor(effectivePresetId, color);
  const matchedPreset = THEME_PRESETS.find((p) => p.id === effectivePresetId || p.color.toLowerCase() === color);
  const secondary = secondaryValue
    ? normalizeHex(secondaryValue, DEFAULT_SECONDARY_COLOR)
    : matchedPreset?.secondary || matchedPalette?.secondary || toHexFromShade(color, 0.28);

  currentThemeColorHex = color;
  currentSecondaryColorHex = secondary;
  currentPaletteId = effectivePresetId || matchedPalette?.id;

  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.getAttribute("data-color-mode") === "dark" || root.classList.contains("dark");
  const defaultPalette = findPaletteById(DEFAULT_CALM_PRESET_ID) || MULTI_COLOR_PALETTES[0];

  const canvasHex = isDark
    ? matchedPalette?.tintDark || defaultPalette.tintDark
    : matchedPalette?.tintLight || defaultPalette.tintLight;
  const surfaceHex = isDark
    ? matchedPalette?.surfaceDark || defaultPalette.surfaceDark
    : matchedPalette?.surfaceLight || defaultPalette.surfaceLight;
  const elevatedHex = isDark
    ? matchedPalette?.elevatedDark || defaultPalette.elevatedDark
    : matchedPalette?.elevatedLight || defaultPalette.elevatedLight;
  const inkHex = isDark
    ? matchedPalette?.inkDark || defaultPalette.inkDark
    : matchedPalette?.inkLight || defaultPalette.inkLight;
  const inkMutedHex = isDark
    ? matchedPalette?.inkMutedDark || defaultPalette.inkMutedDark
    : matchedPalette?.inkMutedLight || defaultPalette.inkMutedLight;
  const hairlineHex = isDark
    ? matchedPalette?.hairlineDark || defaultPalette.hairlineDark
    : matchedPalette?.hairlineLight || defaultPalette.hairlineLight;

  // 保持色彩鲜活通透；暗黑模式下优先使用色盘配套的明度提亮主色，避免极暗主色融入黑夜背景
  let effectiveHex = color;
  if (isDark) {
    if (matchedPalette && (getRelativeLuminance(color) < 0.04 || color.toLowerCase() === matchedPalette.primary.toLowerCase())) {
      effectiveHex = matchedPalette.primaryDark;
    } else if (getRelativeLuminance(color) < 0.04) {
      effectiveHex = "#6366f1";
    } else if (getContrastRatio(color, surfaceHex) < 4.5) {
      effectiveHex = toHexFromShade(color, 0.36);
    }
  }

  const effectiveRgb = hexToRgb(effectiveHex);
  const secRgb = hexToRgb(secondary);
  const inkRgbStr = toCssRgb(hexToRgb(inkHex));
  const inkMutedRgbStr = toCssRgb(hexToRgb(inkMutedHex));

  setRootVarIfChanged(root, "--theme-rgb", toCssRgb(effectiveRgb));
  setRootVarIfChanged(root, "--theme-hover-rgb", toCssRgb(shade(effectiveHex, isDark ? 0.14 : -0.14)));
  setRootVarIfChanged(root, "--theme-active-rgb", toCssRgb(shade(effectiveHex, isDark ? 0.22 : -0.24)));
  setRootVarIfChanged(root, "--theme-secondary-rgb", toCssRgb(secRgb));

  // 六层语义表面与墨色令牌同步驱动
  setRootVarIfChanged(root, "--rin-canvas-rgb", toCssRgb(hexToRgb(canvasHex)));
  setRootVarIfChanged(root, "--rin-surface-rgb", toCssRgb(hexToRgb(surfaceHex)));
  setRootVarIfChanged(root, "--rin-elevated-rgb", toCssRgb(hexToRgb(elevatedHex)));
  setRootVarIfChanged(root, "--rin-ink-rgb", inkRgbStr);
  setRootVarIfChanged(root, "--rin-ink-muted-rgb", inkMutedRgbStr);
  setRootVarIfChanged(root, "--rin-hairline-rgb", toCssRgb(hexToRgb(hairlineHex)));
  // 向后兼容别名：保持 --rin-text-rgb 与 --rin-ink-rgb 同步
  setRootVarIfChanged(root, "--rin-text-rgb", inkRgbStr);
  setRootVarIfChanged(root, "--rin-text-muted-rgb", inkMutedRgbStr);
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

const HUMANISTIC_FONT_SHEETS: Partial<Record<TitleFont, { id: string; href: string }>> = {
  serif: {
    id: "rin-font-noto-serif-sc",
    href: "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700&display=swap",
  },
  kai: {
    id: "rin-font-lxgw-wenkai",
    href: "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css",
  },
};

export function ensureHumanisticFontLoaded(font: string | undefined | null) {
  if (typeof document === "undefined" || !document.head) return;
  const normalized = font === "serif" || font === "kai" ? font : null;
  if (!normalized) return;

  const meta = HUMANISTIC_FONT_SHEETS[normalized];
  if (!meta) return;

  if (document.getElementById(meta.id)) return;
  const existingHrefMatch = document.querySelector(`link[rel="stylesheet"][href="${meta.href}"]`);
  if (existingHrefMatch) return;

  const link = document.createElement("link");
  link.id = meta.id;
  link.rel = "stylesheet";
  link.href = meta.href;
  link.media = "print";
  link.onload = () => {
    link.media = "all";
  };
  document.head.appendChild(link);
}

export function normalizeTitleFont(font: string | undefined | null): TitleFont {
  if (font === "sans" || font === "serif" || font === "kai" || font === "mono") {
    return font;
  }
  return "serif";
}

export function normalizeTitleEffect(effect: string | undefined | null): TitleEffect {
  switch (effect) {
    case "clean":
    case "soft_glow":
    case "editorial_rule":
    case "tactile_ink":
    case "neon_prism":
      return effect;
    case "classic_clean":
      return "clean";
    case "glass_glow":
    case "starlight_cosmic":
      return "soft_glow";
    case "aurora_flow":
    case "golden_sunset":
    case "candy_dream":
      return "editorial_rule";
    case "ink_calligraphy":
    case "emboss_3d":
    case "gothic_metal":
      return "tactile_ink";
    case "cyber_neon":
    case "vaporwave_80s":
    case "pixel_arcade":
      return "neon_prism";
    default:
      return "clean";
  }
}

export function applyThemeFontFamily(family: string | undefined | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved: ThemeFontFamily =
    family === "serif" || family === "kai" || family === "mono" ? family : "sans";

  ensureHumanisticFontLoaded(resolved);
  root.style.setProperty("--rin-font-family", TITLE_FONT_STACKS[resolved]);
  root.setAttribute("data-body-font", resolved);
}

export function applyThemeTitleFont(font: string | undefined | null): TitleFont {
  const resolved = normalizeTitleFont(font);
  if (typeof document === "undefined") return resolved;

  const root = document.documentElement;
  ensureHumanisticFontLoaded(resolved);
  root.style.setProperty("--rin-title-font-family", TITLE_FONT_STACKS[resolved]);
  root.setAttribute("data-title-font", resolved);
  return resolved;
}

export function applyThemeTitleEffect(effect: string | undefined | null): TitleEffect {
  const resolved = normalizeTitleEffect(effect);
  if (typeof document === "undefined") return resolved;

  const root = document.documentElement;
  root.setAttribute("data-title-effect", resolved);
  root.style.setProperty("--rin-title-effect", resolved);
  return resolved;
}

export function applyThemeTitleStyle({
  font,
  effect,
}: {
  font?: string | null;
  effect?: string | null;
}) {
  return {
    font: applyThemeTitleFont(font),
    effect: applyThemeTitleEffect(effect),
  };
}

export function applyThemeFontSize(value: unknown) {
  if (typeof document === "undefined") return;
  const parsed = Number.parseInt(String(value ?? 16), 10);
  const size = Math.min(22, Math.max(13, Number.isNaN(parsed) ? 16 : parsed));
  document.documentElement.style.setProperty("--rin-font-size", `${size}px`);
}

export function applyThemeWallpaper(url: string | undefined | null, opacity?: number) {
  currentWallpaperUrl = url;
  if (opacity !== undefined) {
    currentWallpaperOpacity = opacity;
  }
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const cleanUrl = (url || "").trim();
  const isDark = root.getAttribute("data-color-mode") === "dark" || root.classList.contains("dark");

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
    // 深色画布自动进一步柔化渐变光晕上限（14%），避免把暗夜底色染成浑浊褐红色
    const gradientCap = isDark ? 14 : 28;
    const capped = isCssImageFn && !isDotPattern ? Math.min(gradientCap, Math.max(0, opacity)) : Math.min(100, Math.max(0, opacity));
    const alpha = capped / 100;
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
