import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ACCENT_COLOR_PRESETS,
  MULTI_COLOR_PALETTES,
  OPACITY_SHORTCUTS,
  THEME_PRESETS,
  TITLE_EFFECT_OPTIONS,
  TITLE_FONT_OPTIONS,
  TITLE_FONT_STACKS,
  WALLPAPER_PRESETS,
  applyGalleryTiltDegree,
  applyThemeColor,
  applyThemeCustomCursor,
  applyThemeFontFamily,
  applyThemeFontSize,
  applyThemeOpacity,
  applyThemeTitleEffect,
  applyThemeTitleFont,
  applyThemeWallpaper,
  findPaletteByIdOrColor,
  normalizeThemeColor,
  normalizeThemeOpacity,
  normalizeTitleEffect,
  normalizeTitleFont,
  type TitleEffect,
} from "../utils/theme-color";
import { normalizeFeedCardVariant, type FeedCardVariant } from "../components/feed-card-options";
import { normalizeAmbienceMode, type AmbienceMode } from "../components/ambient-effects-canvas";
import { normalizeHeaderLayout } from "../components/site-header/layout-options";
import { useColorMode } from "../utils/darkModeUtils";
import { AdminSwitch } from "../components/admin-switch";

type ClientConfigReader = {
  get: (key: string) => unknown;
};

const LEGACY_TITLE_STYLE_MAP: Record<TitleEffect, string> = {
  clean: "classic_clean",
  soft_glow: "glass_glow",
  editorial_rule: "aurora_flow",
  tactile_ink: "ink_calligraphy",
  neon_prism: "cyber_neon",
};

function VariantThumb({ variant }: { variant: FeedCardVariant }) {
  if (variant === "editorial") {
    return (
      <div className="h-14 w-full rounded-xl bg-neutral-100 dark:bg-white/[0.04] p-2 flex flex-col justify-between gap-1.5">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-3/4 rounded bg-neutral-400/70" />
            <div className="h-1 w-full rounded bg-neutral-300/70 dark:bg-neutral-600" />
          </div>
          <div className="h-4 w-7 rounded bg-theme/35 shrink-0" />
        </div>
        <div className="h-px w-full bg-neutral-200 dark:bg-white/10" />
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-2/3 rounded bg-neutral-400/70" />
            <div className="h-1 w-5/6 rounded bg-neutral-300/70 dark:bg-neutral-600" />
          </div>
          <div className="h-4 w-7 rounded bg-theme-secondary/35 shrink-0" />
        </div>
      </div>
    );
  }

  if (variant === "poster") {
    return (
      <div className="h-14 w-full rounded-xl bg-neutral-100 dark:bg-white/[0.04] p-2 grid grid-cols-3 gap-1.5 items-start">
        <div className="h-10 rounded-md bg-gradient-to-br from-theme/50 to-theme-secondary/45 relative overflow-hidden">
          <div className="absolute inset-x-1 bottom-1 h-1.5 rounded-xs bg-black/40" />
        </div>
        <div className="h-8 rounded-md bg-gradient-to-br from-theme-secondary/45 to-theme/35 relative overflow-hidden">
          <div className="absolute inset-x-1 bottom-1 h-1.5 rounded-xs bg-black/40" />
        </div>
        <div className="h-10 rounded-md bg-gradient-to-br from-theme/40 to-theme-secondary/50 relative overflow-hidden">
          <div className="absolute inset-x-1 bottom-1 h-1.5 rounded-xs bg-black/40" />
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="h-14 w-full rounded-xl bg-neutral-100 dark:bg-white/[0.04] p-2 flex flex-col justify-between">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="h-1.5 w-2/3 rounded bg-neutral-400/60" />
            <div className="h-1.5 w-6 rounded bg-theme/40" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-14 w-full rounded-xl bg-neutral-100 dark:bg-white/[0.04] p-2 grid grid-cols-3 gap-1.5">
      <div className="rounded bg-white dark:bg-neutral-800 p-1 flex flex-col gap-1 -rotate-2 shadow-2xs">
        <div className="flex-1 rounded-xs bg-theme/30" />
        <div className="h-1 w-2/3 rounded bg-neutral-300 dark:bg-neutral-600" />
      </div>
      <div className="rounded bg-white dark:bg-neutral-800 p-1 flex flex-col gap-1 rotate-2 shadow-2xs">
        <div className="flex-1 rounded-xs bg-theme-secondary/35" />
        <div className="h-1 w-1/2 rounded bg-neutral-300 dark:bg-neutral-600" />
      </div>
      <div className="rounded bg-white dark:bg-neutral-800 p-1 flex flex-col gap-1 -rotate-1 shadow-2xs">
        <div className="flex-1 rounded-xs bg-theme/25" />
        <div className="h-1 w-3/4 rounded bg-neutral-300 dark:bg-neutral-600" />
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const expanded =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return `rgba(255, 255, 255, ${alpha})`;
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 后台 Bento Grid 模块化外观与版式配置面板：
 * - 全部外观参数按 Bento Grid 模块化卡片排布；
 * - 内置所见即所得微型画廊预览框，所有微调实时生效。
 */
export function SettingsAppearancePanel({
  clientConfig,
  setConfigValue,
}: {
  clientConfig: ClientConfigReader;
  setConfigValue: (type: "client" | "server", key: string, value: unknown) => void;
}) {
  const { t } = useTranslation();

  const cardVariantBlocks = useMemo(
    () => [
      {
        id: "default" as FeedCardVariant,
        label: t("appearance.variant_default", { defaultValue: "拍立得瀑布流" }),
        tag: t("appearance.variant_default_tag", { defaultValue: "白边微倾" }),
      },
      {
        id: "poster" as FeedCardVariant,
        label: t("appearance.variant_poster", { defaultValue: "全幅沉浸画册" }),
        tag: t("appearance.variant_poster_tag", { defaultValue: "原图满幅" }),
      },
      {
        id: "editorial" as FeedCardVariant,
        label: t("appearance.variant_editorial", { defaultValue: "图文双栏杂志" }),
        tag: t("appearance.variant_editorial_tag", { defaultValue: "左文右图" }),
      },
      {
        id: "compact" as FeedCardVariant,
        label: t("appearance.variant_compact", { defaultValue: "紧凑文章列表" }),
        tag: t("appearance.variant_compact_tag", { defaultValue: "高密扫读" }),
      },
    ],
    [t],
  );

  const ambienceBlocks = useMemo(
    () => [
      { id: "none" as AmbienceMode, label: t("appearance.ambience_none", { defaultValue: "关闭粒子" }), icon: "ri-forbid-line" },
      { id: "sakura" as AmbienceMode, label: t("appearance.ambience_sakura", { defaultValue: "飘落樱花" }), icon: "ri-flower-line" },
      { id: "rain" as AmbienceMode, label: t("appearance.ambience_rain", { defaultValue: "清透细雨" }), icon: "ri-rainy-line" },
      { id: "fireflies" as AmbienceMode, label: t("appearance.ambience_fireflies", { defaultValue: "呼吸萤火" }), icon: "ri-sparkling-2-line" },
    ],
    [t],
  );

  const bodyFontOptions = useMemo(
    () => [
      { value: "sans", label: "无衬线" },
      { value: "serif", label: "优雅衬线" },
      { value: "kai", label: "温润文楷" },
      { value: "mono", label: "极客等宽" },
    ],
    [],
  );

  const cardVariant = normalizeFeedCardVariant(String(clientConfig.get("feed.card_variant") ?? "default"));
  const headerLayout = normalizeHeaderLayout(String(clientConfig.get("header.layout") ?? "classic"));
  const activePreset = String(clientConfig.get("theme.preset") ?? "sakura_paper");
  const activeColor = normalizeThemeColor(String(clientConfig.get("theme.color") ?? "#d87a90"));
  const activeSecondary = String(clientConfig.get("theme.secondary_color") ?? "");
  const themeOpacity = normalizeThemeOpacity(clientConfig.get("theme.opacity"));
  const activeAmbience = normalizeAmbienceMode(clientConfig.get("theme.ambience"));
  const wallpaperUrl = String(clientConfig.get("theme.wallpaper") ?? "none");
  const wallpaperOpacity = Number.parseInt(String(clientConfig.get("theme.wallpaper_opacity") ?? 35), 10) || 35;
  const columns = String(clientConfig.get("gallery.columns") ?? "auto");
  const align = String(clientConfig.get("gallery.align") ?? "center");
  const cardGap = Number.parseInt(String(clientConfig.get("gallery.card_gap") ?? 24), 10) || 24;
  const tiltDegree = Number.parseFloat(String(clientConfig.get("gallery.tilt_degree") ?? 1.8));
  const safeTilt = Number.isNaN(tiltDegree) ? 1.8 : tiltDegree;
  const fontFamily = String(clientConfig.get("theme.font_family") ?? "sans");
  const themeFontSize = Number.parseInt(String(clientConfig.get("theme.font_size") ?? 16), 10) || 16;
  const activeTitleFont = normalizeTitleFont(String(clientConfig.get("theme.title_font") ?? "serif"));
  const activeTitleEffect = normalizeTitleEffect(
    String(clientConfig.get("theme.title_effect") ?? clientConfig.get("atelier.title_style") ?? "clean"),
  );
  const customCursor = clientConfig.get("theme.custom_cursor") !== false && clientConfig.get("theme.custom_cursor") !== "false";
  const readingProgress = clientConfig.get("theme.reading_progress") !== false && clientConfig.get("theme.reading_progress") !== "false";
  const siteTitle = String(clientConfig.get("site.name") || "Rin");

  const matchedPresetObj = THEME_PRESETS.find((p) => p.id === activePreset);
  const matchedPalette = findPaletteByIdOrColor(activePreset, activeColor) ?? MULTI_COLOR_PALETTES[0];
  const colorMode = useColorMode();
  const isDarkMode = colorMode === "dark";

  const previewCanvasHex = isDarkMode ? matchedPalette.tintDark : matchedPalette.tintLight;
  const previewSurfaceHex = isDarkMode ? matchedPalette.surfaceDark : matchedPalette.surfaceLight;
  const previewInkHex = isDarkMode ? matchedPalette.inkDark : matchedPalette.inkLight;
  const previewMutedHex = isDarkMode ? matchedPalette.inkMutedDark : matchedPalette.inkMutedLight;
  const previewHairlineHex = isDarkMode ? matchedPalette.hairlineDark : matchedPalette.hairlineLight;
  const previewSecondaryColor = activeSecondary || matchedPresetObj?.secondary || matchedPalette.secondary;
  const surfaceAlpha = themeOpacity / 100;
  const previewCardSurface = hexToRgba(previewSurfaceHex, surfaceAlpha);
  const previewCardBlur = themeOpacity >= 98 ? "0px" : `${Math.min(10, Math.round((1 - surfaceAlpha) * 14 + 2))}px`;

  // 高频滑块/取色器 rAF 实时预览 + 250ms 防抖写入草稿，杜绝拖动时整页重渲染卡顿
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const colorRafRef = useRef<number | null>(null);
  const colorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingColorRef = useRef<string | null>(null);

  useEffect(() => {
    if (colorInputRef.current && document.activeElement !== colorInputRef.current && /^#[0-9a-f]{6}$/i.test(activeColor)) {
      colorInputRef.current.value = activeColor;
    }
  }, [activeColor]);

  useEffect(() => {
    return () => {
      if (colorRafRef.current !== null) cancelAnimationFrame(colorRafRef.current);
      if (colorTimerRef.current !== null) clearTimeout(colorTimerRef.current);
    };
  }, []);

  const commitDraftColor = useCallback(
    (hex: string) => {
      if (colorTimerRef.current !== null) {
        clearTimeout(colorTimerRef.current);
        colorTimerRef.current = null;
      }
      pendingColorRef.current = null;
      setConfigValue("client", "theme.preset", "custom");
      setConfigValue("client", "theme.color", hex);
      setConfigValue("client", "theme.secondary_color", "");
    },
    [setConfigValue],
  );

  const handleLivePickerInput = useCallback(
    (rawHex: string) => {
      const normalized = normalizeThemeColor(rawHex);
      pendingColorRef.current = normalized;
      if (colorRafRef.current === null) {
        colorRafRef.current = requestAnimationFrame(() => {
          colorRafRef.current = null;
          if (pendingColorRef.current) {
            applyThemeColor(pendingColorRef.current, undefined, "custom");
          }
        });
      }
      if (colorTimerRef.current !== null) clearTimeout(colorTimerRef.current);
      colorTimerRef.current = setTimeout(() => {
        commitDraftColor(normalized);
      }, 250);
    },
    [commitDraftColor],
  );

  const activeTitleFontLabel = TITLE_FONT_OPTIONS.find((f) => f.id === activeTitleFont)?.label ?? "思源宋体";
  const activeTitleEffectLabel = TITLE_EFFECT_OPTIONS.find((e) => e.id === activeTitleEffect)?.label ?? "纯墨极简";
  const activeCardVariantLabel = cardVariantBlocks.find((v) => v.id === cardVariant)?.label ?? "拍立得瀑布流";
  const activeHeaderLayoutLabel =
    headerLayout === "dock" ? "三岛悬浮" : headerLayout === "compact" ? "极简社论" : "经典居中";

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ani-show">
      {/* 左侧主调控流 (lg:col-span-7) */}
      <div className="lg:col-span-7 flex flex-col gap-4 order-2 lg:order-1">
      {/* Bento Card A: 主题配色方案 & 自由调色 */}
      <section className="p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <i className="ri-palette-line text-theme text-base shrink-0" />
            <h3 className="font-bold text-sm t-primary truncate">主题配色方案 & 自由调色</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1" title="画布底色">
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/20" style={{ backgroundColor: previewCanvasHex }} />
                <span>画布</span>
              </span>
              <span className="inline-flex items-center gap-1" title="正文墨色">
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/20" style={{ backgroundColor: previewInkHex }} />
                <span>文字</span>
              </span>
              <span className="inline-flex items-center gap-1" title="品牌主色">
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/20" style={{ backgroundColor: activeColor }} />
                <span>主色</span>
              </span>
            </span>
            <span className="font-mono text-xs font-bold text-theme">{activeColor}</span>
          </div>
        </div>

        {/* 20 套协调主题色盘 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-neutral-500 dark:text-neutral-400">
              20 套协调主题色盘（推荐温润樱雪纸墨 / 暖麦护眼 + 18 套鲜活配色）
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THEME_PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id && activeColor === preset.color.toLowerCase();
              const presetPalette = findPaletteByIdOrColor(preset.id, preset.color);
              const dotCanvas = presetPalette?.tintLight || preset.previewBg;
              const dotInk = presetPalette?.inkLight || "#2D2628";
              const dotPrimary = preset.color;
              const badge =
                preset.id === "sakura_paper" ? "推荐" : preset.id === "warm_wheat" ? "护眼" : null;

              return (
                <button
                  key={preset.id}
                  type="button"
                  title={`${preset.name} · ${preset.description}`}
                  onClick={() => {
                    applyThemeColor(preset.color, preset.secondary, preset.id);
                    setConfigValue("client", "theme.preset", preset.id);
                    setConfigValue("client", "theme.color", preset.color);
                    setConfigValue("client", "theme.secondary_color", preset.secondary || "");
                  }}
                  className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-theme bg-theme/[0.08] ring-1 ring-theme/25 shadow-2xs"
                      : "border-black/10 dark:border-white/10 hover:border-theme/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-xs font-bold truncate ${isSelected ? "text-theme" : "t-primary"}`}>
                        {preset.name}
                      </span>
                      {badge ? (
                        <span className="shrink-0 rounded px-1 py-px text-[9px] font-bold bg-theme/15 text-theme">
                          {badge}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* 画布 / 文字 / 主色 语义预览三圆点 */}
                  <span className="flex items-center -space-x-1 shrink-0" aria-hidden="true">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/15 dark:border-white/25"
                      style={{ backgroundColor: dotCanvas }}
                      title="画布"
                    />
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/80 dark:border-black/40"
                      style={{ backgroundColor: dotInk }}
                      title="文字"
                    />
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/80 dark:border-black/40"
                      style={{ backgroundColor: dotPrimary }}
                      title="主色"
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {/* 当前激活色盘语义预览条 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-black/[0.02] dark:bg-white/[0.03] px-3 py-2 rounded-xl border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: activeColor }} />
              <span className="font-semibold t-primary truncate">
                {matchedPresetObj ? matchedPresetObj.name : "自定义调色"}
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="truncate hidden sm:inline">
                {matchedPresetObj ? matchedPresetObj.description : `自定义主色 ${activeColor}`}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[11px] font-mono shrink-0">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/25" style={{ backgroundColor: previewCanvasHex }} />
                <span>画布</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/25" style={{ backgroundColor: previewInkHex }} />
                <span>文字</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/25" style={{ backgroundColor: activeColor }} />
                <span>主色</span>
              </span>
            </div>
          </div>
        </div>

        {/* 16 色自由调色盘 + 彩虹原生自由取色器 + HEX 输入 */}
        <div className="space-y-2.5 pt-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              自由调色盘（16 精选色珠 · 彩虹取色 · HEX）
            </span>
            <input
              type="text"
              value={activeColor}
              onChange={(e) => {
                const raw = e.target.value.trim();
                setConfigValue("client", "theme.preset", "custom");
                setConfigValue("client", "theme.color", raw);
                if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
                  applyThemeColor(raw, undefined, "custom");
                }
              }}
              className="w-24 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-center font-mono text-xs t-primary outline-none focus:border-theme"
              aria-label="自定义 HEX 色值"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_COLOR_PRESETS.map((color) => {
              const isSelected = activeColor === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onClick={() => {
                    applyThemeColor(color, undefined, "custom");
                    setConfigValue("client", "theme.preset", "custom");
                    setConfigValue("client", "theme.color", color);
                    setConfigValue("client", "theme.secondary_color", "");
                  }}
                  className={`relative flex h-[26px] w-[26px] items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer ${
                    isSelected ? "ring-2 ring-offset-2 ring-theme shadow-sm scale-105" : "hover:shadow-xs"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {isSelected ? <i className="ri-check-line text-[11px] font-bold text-white drop-shadow-xs" /> : null}
                </button>
              );
            })}

            <label
              title="打开系统自由调色盘"
              className="relative flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 via-emerald-400 to-sky-500 text-white shadow-sm transition-transform hover:scale-110 active:scale-95 ring-1 ring-black/10 dark:ring-white/20"
            >
              <i className="ri-palette-line text-xs drop-shadow-xs" />
              <input
                ref={colorInputRef}
                type="color"
                defaultValue={/^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : "#d87a90"}
                onInput={(e) => handleLivePickerInput((e.target as HTMLInputElement).value)}
                onBlur={(e) => {
                  if (pendingColorRef.current) {
                    commitDraftColor(normalizeThemeColor(e.target.value));
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>
          </div>
        </div>

        {/* 卡片通透度滑块 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold t-primary">卡片通透度</span>
            <span className="font-mono text-theme font-bold">{themeOpacity}%</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {OPACITY_SHORTCUTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    applyThemeOpacity(val);
                    setConfigValue("client", "theme.opacity", val);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    themeOpacity === val
                      ? "bg-theme text-white"
                      : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                  }`}
                >
                  {val === 100 ? "纯白" : `${val}%`}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={50}
              max={100}
              step={2}
              value={themeOpacity}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                applyThemeOpacity(val);
                setConfigValue("client", "theme.opacity", val);
              }}
              className="w-28 accent-theme cursor-pointer"
              aria-label="卡片通透度"
            />
          </div>
        </div>
      </section>

      {/* Bento Card C: 正交标题系统 (标题字族 × 标题质感) + 正文字族 & 字号 */}
      <section className="p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <i className="ri-font-size-2 text-theme text-base" />
            <h3 className="font-bold text-sm t-primary">正交标题系统 & 排版字号</h3>
          </div>
          <span className="text-[11px] font-mono text-theme font-semibold">
            {activeTitleFontLabel} × {activeTitleEffectLabel}
          </span>
        </div>

        {/* 1. 标题字族 */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            标题字族（Title Font）
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TITLE_FONT_OPTIONS.map((font) => {
              const selected = activeTitleFont === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => {
                    const resolved = applyThemeTitleFont(font.id);
                    setConfigValue("client", "theme.title_font", resolved);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    selected
                      ? "border-theme bg-theme/[0.08] ring-1 ring-theme/25"
                      : "border-black/10 dark:border-white/10 hover:border-theme/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-sm font-bold t-primary"
                      style={{ fontFamily: TITLE_FONT_STACKS[font.id] }}
                    >
                      文Aa
                    </span>
                    {selected ? <i className="ri-check-line text-xs text-theme font-bold" /> : null}
                  </div>
                  <span className={`text-xs font-bold ${selected ? "text-theme" : "t-primary"}`}>{font.label}</span>
                  <span className="text-[10px] text-neutral-400 truncate">{font.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 标题质感 */}
        <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            标题质感（Title Effect · 正交叠加任意字族）
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {TITLE_EFFECT_OPTIONS.map((effect) => {
              const selected = activeTitleEffect === effect.id;
              return (
                <button
                  key={effect.id}
                  type="button"
                  title={effect.description}
                  onClick={() => {
                    const resolved = applyThemeTitleEffect(effect.id);
                    setConfigValue("client", "theme.title_effect", resolved);
                    setConfigValue("client", "atelier.title_style", LEGACY_TITLE_STYLE_MAP[resolved]);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    selected
                      ? "border-theme bg-theme/[0.08] ring-1 ring-theme/25"
                      : "border-black/10 dark:border-white/10 hover:border-theme/40"
                  }`}
                >
                  <span
                    className={`rin-page-title text-sm leading-snug rin-title-font-${activeTitleFont} rin-title-effect-${effect.id}`}
                    style={{ fontFamily: TITLE_FONT_STACKS[activeTitleFont] }}
                  >
                    画廊
                  </span>
                  <span className={`text-[11px] font-bold truncate ${selected ? "text-theme" : "t-primary"}`}>
                    {effect.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 正文字族 + 基础字号 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
          <div className="space-y-1.5">
            <span className="font-semibold t-primary block">全站正文字族</span>
            <div className="grid grid-cols-2 gap-1.5">
              {bodyFontOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    applyThemeFontFamily(opt.value);
                    setConfigValue("client", "theme.font_family", opt.value);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
                    fontFamily === opt.value
                      ? "bg-theme text-white shadow-2xs"
                      : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 flex flex-col justify-center">
            <div className="flex justify-between items-center">
              <span className="font-semibold t-primary">全站基础字号</span>
              <span className="font-mono text-theme font-bold">{themeFontSize}px</span>
            </div>
            <input
              type="range"
              min={13}
              max={22}
              step={1}
              value={themeFontSize}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                applyThemeFontSize(val);
                setConfigValue("client", "theme.font_size", val);
              }}
              className="w-full accent-theme cursor-pointer"
              aria-label="全站基础字号"
            />
            <div className="flex justify-between text-[10px] font-mono text-neutral-400">
              <span>13px 紧凑</span>
              <span>16px 默认</span>
              <span>22px 大字</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Card D: 文章卡片版式 (4 套缩略图卡片) + 瀑布流列数 / 对齐 / 间距 / 倾角微调 */}
      <section className="p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <i className="ri-layout-masonry-line text-theme text-base" />
            <h3 className="font-bold text-sm t-primary">文章卡片版式 & 瀑布流微调</h3>
          </div>
          <span className="text-[11px] text-neutral-400 hidden sm:inline">原图完整呈现，不强行裁切</span>
        </div>

        {/* 4 套版式缩略图卡片 */}
        <div className="grid grid-cols-2 gap-2.5">
          {cardVariantBlocks.map((item) => {
            const selected = cardVariant === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setConfigValue("client", "feed.card_variant", item.id)}
                className={`flex flex-col gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  selected
                    ? "border-theme bg-theme/[0.06] ring-1 ring-theme/25"
                    : "border-black/10 dark:border-white/10 hover:border-theme/40"
                }`}
              >
                <VariantThumb variant={item.id} />
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold truncate ${selected ? "text-theme" : "t-primary"}`}>
                    {item.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 shrink-0">
                    {item.tag}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 瀑布流列数 & 对齐 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
          <div className="space-y-1.5">
            <span className="font-semibold t-primary block">瀑布流列数</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "自适应", value: "auto" },
                { label: "2 列", value: "2" },
                { label: "3 列", value: "3" },
                { label: "4 列", value: "4" },
                { label: "5 列", value: "5" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfigValue("client", "gallery.columns", opt.value)}
                  className={`px-2 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    columns === opt.value
                      ? "bg-theme text-white shadow-2xs"
                      : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="font-semibold t-primary block">画布对齐</span>
            <div className="flex gap-1.5">
              {[
                { label: "居中聚拢", value: "center" },
                { label: "撑满两端", value: "fluid" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfigValue("client", "gallery.align", opt.value)}
                  className={`flex-1 px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    align === opt.value
                      ? "bg-theme text-white shadow-2xs"
                      : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 间距 & 微倾角 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold t-primary">卡片间距</span>
              <span className="font-mono text-theme font-bold">{cardGap}px</span>
            </div>
            <input
              type="range"
              min={8}
              max={40}
              step={2}
              value={cardGap}
              onChange={(e) => setConfigValue("client", "gallery.card_gap", Number.parseInt(e.target.value, 10))}
              className="w-full accent-theme cursor-pointer"
              aria-label="卡片间距"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold t-primary">拍立得微倾角</span>
              <span className="font-mono text-theme font-bold">{safeTilt.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={0.2}
              value={safeTilt}
              onChange={(e) => {
                const deg = Number.parseFloat(e.target.value);
                applyGalleryTiltDegree(deg);
                setConfigValue("client", "gallery.tilt_degree", deg);
              }}
              className="w-full accent-theme cursor-pointer"
              aria-label="拍立得微倾角"
            />
          </div>
        </div>
      </section>

      {/* Bento Card E: 氛围粒子特效 + 趣味鼠标指针 + 阅读进度条开关 */}
      <section className="p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-sparkling-line text-theme text-base" />
            <h3 className="font-bold text-sm t-primary">氛围粒子特效 & 阅读交互</h3>
          </div>
          <span className="text-[11px] text-neutral-400">持久化全站生效</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {ambienceBlocks.map((item) => {
            const selected = activeAmbience === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setConfigValue("client", "theme.ambience", item.id);
                  window.dispatchEvent(new CustomEvent("rin:ambience-updated", { detail: { mode: item.id } }));
                }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                  selected
                    ? "border-theme bg-theme/[0.08] text-theme font-bold"
                    : "border-black/10 dark:border-white/10 hover:border-theme/40 t-primary"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-base shrink-0 ${
                    selected ? "bg-theme text-white" : "bg-black/5 dark:bg-white/10 text-neutral-500"
                  }`}
                >
                  <i className={item.icon} />
                </span>
                <span className="text-xs font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
          <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
            <div className="min-w-0">
              <span className="font-bold t-primary block">趣味鼠标指针</span>
              <span className="text-[10px] text-neutral-400 block truncate">桌面端轻盈定制光标</span>
            </div>
            <AdminSwitch
              checked={customCursor}
              ariaLabel="趣味鼠标指针"
              onChange={(checked) => {
                applyThemeCustomCursor(checked);
                setConfigValue("client", "theme.custom_cursor", checked);
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
            <div className="min-w-0">
              <span className="font-bold t-primary block">顶部阅读进度条</span>
              <span className="text-[10px] text-neutral-400 block truncate">长文阅读进度指示线</span>
            </div>
            <AdminSwitch
              checked={readingProgress}
              ariaLabel="顶部阅读进度条"
              onChange={(checked) => setConfigValue("client", "theme.reading_progress", checked)}
            />
          </div>
        </div>
      </section>

      {/* Bento Card F: 背景画布纹理预设与浓度 */}
      <section className="p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-image-2-line text-theme text-base" />
            <h3 className="font-bold text-sm t-primary">背景画布纹理预设与浓度</h3>
          </div>
          <span className="font-mono text-[11px] text-theme font-semibold">浓度 {wallpaperOpacity}%</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {WALLPAPER_PRESETS.map((wp) => {
            const selected =
              (wp.url === "none" && (!wallpaperUrl || wallpaperUrl === "none")) || wallpaperUrl === wp.url;
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => {
                  const nextOp = wp.url === "none" ? 0 : Math.max(25, wallpaperOpacity || 35);
                  applyThemeWallpaper(wp.url, nextOp);
                  setConfigValue("client", "theme.wallpaper", wp.url);
                  setConfigValue("client", "theme.wallpaper_opacity", nextOp);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  selected
                    ? "border-theme bg-theme/[0.08] text-theme font-bold"
                    : "border-black/10 dark:border-white/10 hover:border-theme/40 t-primary"
                }`}
              >
                <span
                  className="h-6 w-6 rounded-md border border-black/10 dark:border-white/10 shrink-0"
                  style={wp.previewStyle}
                />
                <div className="min-w-0">
                  <span className="text-xs block truncate">{wp.name}</span>
                  <span className="text-[10px] text-neutral-400 block truncate font-normal">{wp.subtitle}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-2 border-t border-black/5 dark:border-white/5">
          <input
            type="text"
            value={wallpaperUrl === "none" ? "" : wallpaperUrl}
            onChange={(e) => {
              const val = e.target.value.trim() || "none";
              applyThemeWallpaper(val, wallpaperOpacity);
              setConfigValue("client", "theme.wallpaper", val);
            }}
            placeholder="自定义图片 URL 或 CSS 渐变，留空为纯色"
            className="rin-field font-mono flex-1"
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-neutral-400">显影</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={wallpaperOpacity}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                applyThemeWallpaper(wallpaperUrl, val);
                setConfigValue("client", "theme.wallpaper_opacity", val);
              }}
              className="w-24 accent-theme cursor-pointer"
              title="背景显影浓度"
              aria-label="背景显影浓度"
            />
          </div>
        </div>
      </section>
      </div>

      {/* 右侧粘性实时预览视口 (Bento Card B: 桌面端随滚动始终悬停对照) */}
      <section className="lg:col-span-5 lg:sticky lg:top-28 order-1 lg:order-2 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs flex flex-col justify-between space-y-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <i className="ri-eye-2-line text-theme text-base shrink-0" />
            <h3 className="font-bold text-sm t-primary truncate">所见即所得微型画廊预览</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-theme/10 text-theme font-bold shrink-0">
            LIVE WYSIWYG
          </span>
        </div>

        {/* 实时画廊预览视口 */}
        <div
          className="relative flex-1 rounded-2xl border overflow-hidden p-3.5 flex flex-col justify-between gap-3 transition-colors duration-200 min-h-[290px]"
          style={{
            backgroundColor: previewCanvasHex,
            color: previewInkHex,
            borderColor: previewHairlineHex,
            fontFamily: TITLE_FONT_STACKS[normalizeTitleFont(fontFamily)],
          }}
        >
          {/* 背景画布纹理微缩层 */}
          {wallpaperUrl && wallpaperUrl !== "none" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: /^(radial-gradient|linear-gradient|conic-gradient|url)\(/i.test(wallpaperUrl)
                  ? wallpaperUrl
                  : `url('${wallpaperUrl}')`,
                backgroundSize: /1px,\s*transparent\s*1px/i.test(wallpaperUrl) ? "16px 16px" : "cover",
                opacity: Math.min(0.45, Math.max(0.06, wallpaperOpacity / 100)),
              }}
            />
          ) : null}

          {/* 微缩顶栏（实时响应 header.layout: classic | compact | dock） */}
          <div className="relative z-10">
            {headerLayout === "dock" ? (
              <div className="flex items-center justify-between gap-1.5 text-[10px]">
                <span
                  className="px-2 py-1 rounded-full border font-bold truncate max-w-[84px]"
                  style={{
                    backgroundColor: previewCardSurface,
                    borderColor: previewHairlineHex,
                    backdropFilter: `blur(${previewCardBlur})`,
                  }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle" style={{ backgroundColor: activeColor }} />
                  {siteTitle}
                </span>
                <span
                  className="px-2.5 py-1 rounded-full border flex items-center gap-2 font-medium"
                  style={{
                    backgroundColor: previewCardSurface,
                    borderColor: previewHairlineHex,
                    backdropFilter: `blur(${previewCardBlur})`,
                  }}
                >
                  <span style={{ color: activeColor }}>随想</span>
                  <span style={{ color: previewMutedHex }}>归档</span>
                  <span style={{ color: previewMutedHex }}>友链</span>
                </span>
                <span
                  className="px-2 py-1 rounded-full border flex items-center gap-1"
                  style={{
                    backgroundColor: previewCardSurface,
                    borderColor: previewHairlineHex,
                    backdropFilter: `blur(${previewCardBlur})`,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeColor }} />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: previewSecondaryColor }} />
                </span>
              </div>
            ) : headerLayout === "compact" ? (
              <div
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[10px]"
                style={{
                  backgroundColor: previewCardSurface,
                  borderColor: previewHairlineHex,
                  backdropFilter: `blur(${previewCardBlur})`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-md shrink-0" style={{ backgroundColor: activeColor }} />
                  <span className="font-bold truncate">{siteTitle}</span>
                  <span style={{ color: activeColor }}>随想</span>
                  <span style={{ color: previewMutedHex }}>归档</span>
                </div>
                <span className="h-2 w-5 rounded-full" style={{ backgroundColor: hexToRgba(activeColor, 0.25) }} />
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px]"
                style={{
                  backgroundColor: previewCardSurface,
                  borderColor: previewHairlineHex,
                  backdropFilter: `blur(${previewCardBlur})`,
                }}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeColor }} />
                  <span>{siteTitle}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[9px]">
                  <span style={{ color: activeColor }}>画廊</span>
                  <span style={{ color: previewMutedHex }}>时光</span>
                  <span style={{ color: previewMutedHex }}>随笔</span>
                  <span style={{ color: previewMutedHex }}>关于</span>
                </div>
              </div>
            )}
          </div>

          {/* 微缩页面标题（实时响应 theme.title_font × theme.title_effect） */}
          <div className="relative z-10 space-y-1 px-0.5" data-title-font={activeTitleFont} data-title-effect={activeTitleEffect}>
            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: previewMutedHex }}>
              GALLERY ATELIER · PREVIEW
            </div>
            <div
              className={`rin-page-title text-lg leading-snug rin-title-font-${activeTitleFont} rin-title-effect-${activeTitleEffect}`}
              style={{ fontFamily: TITLE_FONT_STACKS[activeTitleFont] }}
            >
              微光画廊随想
            </div>
            <p className="text-[10px] leading-relaxed truncate" style={{ color: previewMutedHex, fontSize: `${Math.max(10, Math.round(themeFontSize * 0.65))}px` }}>
              正文字号 {themeFontSize}px · 卡片通透 {themeOpacity}% · 微调即刻映射
            </p>
          </div>

          {/* 微缩文章卡片流（实时响应 feed.card_variant & theme.opacity & gallery.tilt_degree） */}
          <div className="relative z-10">
            {cardVariant === "poster" ? (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((idx) => (
                  <div
                    key={idx}
                    className="relative h-24 rounded-xl overflow-hidden border flex flex-col justify-end"
                    style={{
                      borderColor: previewHairlineHex,
                      background:
                        idx === 0
                          ? `linear-gradient(135deg, ${hexToRgba(activeColor, 0.72)}, ${hexToRgba(previewSecondaryColor, 0.6)})`
                          : `linear-gradient(135deg, ${hexToRgba(previewSecondaryColor, 0.72)}, ${hexToRgba(activeColor, 0.55)})`,
                    }}
                  >
                    <div className="bg-gradient-to-t from-black/55 via-black/15 to-transparent px-2.5 py-2 text-white">
                      <div className="text-[10px] font-bold truncate">{idx === 0 ? "光影手记 #01" : "午后漫步 #02"}</div>
                      <div className="text-[8px] opacity-85">全幅沉浸画册</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : cardVariant === "editorial" ? (
              <div className="space-y-1.5">
                {[
                  { title: "边缘微光设计笔记", tag: "设计", accent: activeColor },
                  { title: "春日樱雪纸墨漫步", tag: "随笔", accent: previewSecondaryColor },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border p-2 flex items-center justify-between gap-2.5"
                    style={{
                      backgroundColor: previewCardSurface,
                      borderColor: previewHairlineHex,
                      backdropFilter: `blur(${previewCardBlur})`,
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[11px] font-bold truncate">{item.title}</div>
                      <div className="flex items-center gap-1.5 text-[9px]" style={{ color: previewMutedHex }}>
                        <span className="px-1.5 py-px rounded" style={{ backgroundColor: hexToRgba(item.accent, 0.14), color: activeColor }}>
                          {item.tag}
                        </span>
                        <span>3 min read</span>
                      </div>
                    </div>
                    <div
                      className="h-9 w-12 rounded-lg shrink-0"
                      style={{ background: `linear-gradient(135deg, ${hexToRgba(activeColor, 0.45)}, ${hexToRgba(previewSecondaryColor, 0.45)})` }}
                    />
                  </div>
                ))}
              </div>
            ) : cardVariant === "compact" ? (
              <div
                className="rounded-xl border divide-y"
                style={{
                  backgroundColor: previewCardSurface,
                  borderColor: previewHairlineHex,
                  backdropFilter: `blur(${previewCardBlur})`,
                }}
              >
                {["极简文字流排版规范", "二次元轻磨砂质感调校", "响应式瀑布流密度实践"].map((label, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-[10px]"
                    style={{ borderColor: previewHairlineHex }}
                  >
                    <span className="flex items-center gap-1.5 font-semibold truncate">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: activeColor }} />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="font-mono text-[9px] shrink-0" style={{ color: previewMutedHex }}>
                      0{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 px-1">
                {[
                  { title: "樱雪纸墨日记", rot: -safeTilt },
                  { title: "画廊手账拾遗", rot: safeTilt },
                ].map((card, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border p-1.5 shadow-xs transition-transform"
                    style={{
                      backgroundColor: previewCardSurface,
                      borderColor: previewHairlineHex,
                      backdropFilter: `blur(${previewCardBlur})`,
                      transform: `rotate(${card.rot}deg)`,
                    }}
                  >
                    <div
                      className="h-12 rounded-lg mb-1.5"
                      style={{
                        background:
                          idx === 0
                            ? `linear-gradient(135deg, ${hexToRgba(activeColor, 0.42)}, ${hexToRgba(previewSecondaryColor, 0.3)})`
                            : `linear-gradient(135deg, ${hexToRgba(previewSecondaryColor, 0.42)}, ${hexToRgba(activeColor, 0.25)})`,
                      }}
                    />
                    <div className="flex items-center justify-between gap-1 px-0.5">
                      <span className="text-[10px] font-bold truncate">{card.title}</span>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: activeColor }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 当前实时参数状态标签 */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
            标题: {activeTitleFontLabel} × {activeTitleEffectLabel}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
            顶栏: {activeHeaderLayoutLabel}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
            卡片: {activeCardVariantLabel}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
            模式: {isDarkMode ? "暗夜" : "日间"}
          </span>
        </div>
      </section>
    </div>
  );
}
