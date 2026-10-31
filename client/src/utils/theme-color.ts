const DEFAULT_THEME_COLOR = "#fc466b";
export const DEFAULT_THEME_OPACITY = 100;

export interface ThemePreset {
  id: string;
  name: string;
  color: string;
  previewBg: string;
  description: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "sakura", name: "春日樱落", color: "#fc466b", previewBg: "#fff1f3", description: "经典蔷薇绯红，生机与浪漫交织" },
  { id: "paper_ink", name: "极简纸墨", color: "#27272a", previewBg: "#f4f4f5", description: "极简纯粹纸墨，水墨书卷雅致风范" },
  { id: "cyber_cold", name: "赛博冷萃", color: "#00c4ff", previewBg: "#e0f7ff", description: "冰蓝电光冷萃，通透未来科技质感" },
  { id: "aoi_sora", name: "和风青空", color: "#0284c7", previewBg: "#e0f2fe", description: "海风拂过澄澈天际，辽阔明亮" },
  { id: "midnight_deep", name: "午夜深邃", color: "#6366f1", previewBg: "#eef2ff", description: "静谧午夜深蓝星空，专注而内敛" },
  { id: "violet_twilight", name: "暮光紫霞", color: "#8b5cf6", previewBg: "#f5f3ff", description: "落霞与晚霭交融的梦幻紫韵" },
  { id: "forest_mist", name: "森屿绿野", color: "#059669", previewBg: "#ecfdf5", description: "苍翠幽深森林，带来源泉般的清新" },
  { id: "golden_sunset", name: "落日熔金", color: "#d97706", previewBg: "#fffbeb", description: "暖阳晚霞熔金，温馨治愈的暮色" },
  { id: "rose_cream", name: "玫瑰奶霜", color: "#f43f5e", previewBg: "#fff1f2", description: "丝滑甜润的玫瑰奶霜，柔和典雅" },
  { id: "mint_soda", name: "薄荷苏打", color: "#0d9488", previewBg: "#f0fdfa", description: "清凉通透薄荷气泡，沁人心脾" },
  { id: "ocean_abyss", name: "蔚蓝深海", color: "#2563eb", previewBg: "#eff6ff", description: "浩瀚神秘深海，沉静广袤之美" },
  { id: "lilac_dream", name: "迷雾丁香", color: "#c026d3", previewBg: "#fdf4ff", description: "微风吹拂的丁香花海，轻盈曼妙" },
  { id: "caramel_amber", name: "焦糖琥珀", color: "#b45309", previewBg: "#fef3c7", description: "温润沉香焦糖，富有复古年代韵味" },
  { id: "moss_rain", name: "雨后青苔", color: "#65a30d", previewBg: "#f7fee7", description: "初霁雨后青石苔藓，生机盎然" },
  { id: "obsidian_slate", name: "黑曜石影", color: "#475569", previewBg: "#f1f5f9", description: "理性内敛石板灰调，高级质感" },
  { id: "peach_coral", name: "珊瑚蜜桃", color: "#fb7185", previewBg: "#fff1f2", description: "清甜初熟珊瑚蜜桃，活泼灵动" },
  { id: "aurora_teal", name: "极光青翠", color: "#14b8a6", previewBg: "#ccfbf1", description: "北极星空下的青翠极光波纹" },
  { id: "crimson_flame", name: "赤焰朱砂", color: "#dc2626", previewBg: "#fef2f2", description: "东方传统朱砂赤金，端庄热烈" },
];

export const ACCENT_COLOR_PRESETS = [
  "#0ea5e9", // 天蓝 Sky
  "#2563eb", // 宝蓝 Blue
  "#4f46e5", // 靛蓝 Indigo
  "#7c3aed", // 紫罗兰 Violet
  "#9333ea", // 紫色 Purple
  "#c026d3", // 品红 Fuchsia
  "#fc466b", // 蔷薇粉 Rose
  "#e11d48", // 玫瑰红 Crimson
  "#ea580c", // 暖橙 Orange
  "#d97706", // 琥珀黄 Amber
  "#eab308", // 金黄 Yellow
  "#84cc16", // 嫩绿 Lime
  "#16a34a", // 翠绿 Green
  "#0d9488", // 青绿 Teal
  "#06b6d4", // 湖蓝 Cyan
  "#475569", // 石板灰 Slate
];

export const OPACITY_SHORTCUTS = [100, 85, 70];

function normalizeHex(value: string | undefined | null) {
  if (!value) return DEFAULT_THEME_COLOR;
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

  return DEFAULT_THEME_COLOR;
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

export function applyThemeColor(value: string | undefined | null) {
  const color = normalizeHex(value);
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty("--theme-rgb", toCssRgb(hexToRgb(color)));
  root.style.setProperty("--theme-hover-rgb", toCssRgb(shade(color, -0.3)));
  root.style.setProperty("--theme-active-rgb", toCssRgb(shade(color, -0.4)));
}

export function applyThemeOpacity(value: unknown) {
  const opacity = normalizeThemeOpacity(value);
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const alpha = opacity / 100;
  root.style.setProperty("--rin-surface-alpha", alpha.toString());
  root.style.setProperty("--rin-glass-opacity", `${opacity}%`);
  // 毛玻璃模糊度：不透明时为 0px，透明时平滑增加模糊质感
  const blurPx = opacity >= 100 ? 0 : Math.round((1 - alpha) * 20 + 6);
  root.style.setProperty("--rin-glass-blur", `${blurPx}px`);
  root.style.setProperty("--rin-glass-border-alpha", opacity >= 100 ? "0.1" : `${(0.1 + (1 - alpha) * 0.15).toFixed(2)}`);
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

export function applyThemeFontSize(value: unknown) {
  if (typeof document === "undefined") return;
  const parsed = Number.parseInt(String(value ?? 16), 10);
  const size = Math.min(22, Math.max(13, Number.isNaN(parsed) ? 16 : parsed));
  document.documentElement.style.setProperty("--rin-font-size", `${size}px`);
}

export function applyFullTheme(color?: string | null, opacity?: unknown) {
  applyThemeColor(color);
  applyThemeOpacity(opacity);
}
