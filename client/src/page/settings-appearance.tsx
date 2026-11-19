import { useCallback, useEffect, useRef } from "react";
import {
  ACCENT_COLOR_PRESETS,
  OPACITY_SHORTCUTS,
  THEME_PRESETS,
  WALLPAPER_PRESETS,
  applyGalleryTiltDegree,
  applyThemeColor,
  applyThemeCustomCursor,
  applyThemeFontFamily,
  applyThemeFontSize,
  applyThemeOpacity,
  applyThemeWallpaper,
  normalizeThemeColor,
  normalizeThemeOpacity,
} from "../utils/theme-color";
import { normalizeFeedCardVariant, type FeedCardVariant } from "../components/feed-card-options";
import { normalizeAmbienceMode, type AmbienceMode } from "../components/ambient-effects-canvas";

type ClientConfigReader = {
  get: (key: string) => unknown;
};

const CARD_VARIANT_BLOCKS: Array<{
  id: FeedCardVariant;
  label: string;
  tag: string;
}> = [
  { id: "default", label: "拍立得瀑布流", tag: "白边微倾" },
  { id: "poster", label: "全幅沉浸画册", tag: "原图满幅" },
  { id: "editorial", label: "图文双栏杂志", tag: "左文右图" },
  { id: "compact", label: "紧凑文章列表", tag: "高密扫读" },
];

const AMBIENCE_BLOCKS: Array<{
  id: AmbienceMode;
  label: string;
  icon: string;
}> = [
  { id: "none", label: "关闭粒子", icon: "ri-forbid-line" },
  { id: "sakura", label: "飘落樱花", icon: "ri-flower-line" },
  { id: "rain", label: "清透细雨", icon: "ri-rainy-line" },
  { id: "fireflies", label: "呼吸萤火", icon: "ri-sparkling-2-line" },
];

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

/**
 * 后台分块外观与版式配置面板（遵循《美化章程》第一章与第四章）：
 * - 全部外观参数分块平铺，所见即所得，点击即实时预览；
 * - 严禁重复放置日夜切换按钮（后台顶栏已保留唯一一处）。
 */
export function SettingsAppearancePanel({
  clientConfig,
  setConfigValue,
}: {
  clientConfig: ClientConfigReader;
  setConfigValue: (type: "client" | "server", key: string, value: unknown) => void;
}) {
  const cardVariant = normalizeFeedCardVariant(String(clientConfig.get("feed.card_variant") ?? "default"));
  const activePreset = String(clientConfig.get("theme.preset") ?? "sakura");
  const activeColor = normalizeThemeColor(String(clientConfig.get("theme.color") ?? "#fc466b"));
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
  const navFontSize = Number.parseInt(String(clientConfig.get("header.nav_font_size") ?? 15), 10) || 15;
  const navGap = Number.parseInt(String(clientConfig.get("header.nav_gap") ?? 12), 10) || 12;
  const navOrganicTilt = clientConfig.get("header.nav_organic_tilt") !== false && clientConfig.get("header.nav_organic_tilt") !== "false";
  const customCursor = clientConfig.get("theme.custom_cursor") !== false && clientConfig.get("theme.custom_cursor") !== "false";
  const readingProgress = clientConfig.get("theme.reading_progress") !== false && clientConfig.get("theme.reading_progress") !== "false";
  const matchedPresetObj = THEME_PRESETS.find((p) => p.id === activePreset);

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
    [setConfigValue]
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
    [commitDraftColor]
  );

  return (
    <div className="w-full flex flex-col space-y-4 ani-show">
      {/* 分块 1：首页文章列表版式 */}
      <section className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-layout-masonry-line text-theme text-base" />
            <h3 className="font-bold text-sm t-primary">首页文章版式</h3>
          </div>
          <span className="text-[11px] text-neutral-400">画册与拍立得均完整呈现原图，不强行裁切</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CARD_VARIANT_BLOCKS.map((item) => {
            const selected = cardVariant === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setConfigValue("client", "feed.card_variant", item.id)}
                className={`flex flex-col gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                  selected
                    ? "border-theme bg-theme/[0.06] ring-1 ring-theme/25"
                    : "border-black/10 dark:border-white/10 hover:border-theme/40"
                }`}
              >
                <VariantThumb variant={item.id} />
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold ${selected ? "text-theme" : "t-primary"}`}>
                    {item.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400">
                    {item.tag}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 分块 2：18 套明快主题预设 + 经典 16 色自由调色盘 + 彩虹取色器 */}
      <section className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-palette-line text-theme text-base" />
            <h3 className="font-bold text-sm t-primary">主题配色与自由调色盘</h3>
          </div>
          <span className="font-mono text-xs font-bold text-theme">{activeColor}</span>
        </div>

        {/* 18 套经典明快主题色珠 */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            18 套明快预设主题（点击即刻全局生效）
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {THEME_PRESETS.map((preset) => {
              const isSelected = activePreset === preset.id && activeColor === preset.color.toLowerCase();
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
                  className={`group relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer ${
                    isSelected ? "ring-2 ring-offset-2 ring-theme shadow-sm scale-105" : "hover:shadow-xs"
                  }`}
                  style={{
                    backgroundColor: preset.previewBg,
                    border: `1.5px solid ${isSelected ? preset.color : "rgba(0,0,0,0.12)"}`,
                  }}
                >
                  <span
                    className="h-4 w-4 rounded-full shadow-2xs transition-transform group-hover:scale-110"
                    style={{ backgroundColor: preset.color }}
                  />
                  {isSelected ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <i className="ri-check-line text-[11px] font-bold text-white drop-shadow-xs" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {matchedPresetObj ? (
            <div className="inline-flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-black/[0.02] dark:bg-white/[0.03] px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: matchedPresetObj.color }} />
              <span className="font-semibold t-primary">{matchedPresetObj.name}</span>
              <span>·</span>
              <span>{matchedPresetObj.description}</span>
            </div>
          ) : null}
        </div>

        {/* 16 色自由调色盘 + 彩虹原生自由取色器 + HEX 手输 */}
        <div className="space-y-2.5 pt-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              自由调色盘（点选任意高亮色珠，或点击彩虹色盘无限制取色）
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

          <div className="flex flex-wrap items-center gap-2.5">
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
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer ${
                    isSelected ? "ring-2 ring-offset-2 ring-theme shadow-sm scale-105" : "hover:shadow-xs"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {isSelected ? <i className="ri-check-line text-xs font-bold text-white drop-shadow-xs" /> : null}
                </button>
              );
            })}

            {/* 经典彩虹渐变自由调色盘 */}
            <label
              title="打开系统自由调色盘"
              className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 via-emerald-400 to-sky-500 text-white shadow-sm transition-transform hover:scale-110 active:scale-95 ring-1 ring-black/10 dark:ring-white/20"
            >
              <i className="ri-palette-line text-xs drop-shadow-xs" />
              <input
                ref={colorInputRef}
                type="color"
                defaultValue={/^#[0-9a-f]{6}$/i.test(activeColor) ? activeColor : "#fc466b"}
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

        {/* 卡片通透度 / 轻磨砂滑块 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold t-primary">卡片通透度</span>
            <span className="font-mono text-theme font-bold">{themeOpacity}%</span>
          </div>
          <div className="flex items-center gap-2">
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
            />
          </div>
        </div>
      </section>

      {/* 分块 3：粒子氛围与背景画布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <i className="ri-sparkling-line text-theme text-base" />
              <h3 className="font-bold text-sm t-primary">全站粒子氛围</h3>
            </div>
            <span className="text-[11px] text-neutral-400">持久化全站生效</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {AMBIENCE_BLOCKS.map((item) => {
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
        </section>

        <section className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <i className="ri-image-2-line text-theme text-base" />
              <h3 className="font-bold text-sm t-primary">背景画布纹理</h3>
            </div>
            <span className="font-mono text-[11px] text-theme font-semibold">浓度 {wallpaperOpacity}%</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WALLPAPER_PRESETS.map((wp) => {
              const selected =
                (wp.url === "none" && (!wallpaperUrl || wallpaperUrl === "none")) ||
                wallpaperUrl === wp.url;
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
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                    selected
                      ? "border-theme bg-theme/[0.08] text-theme font-bold"
                      : "border-black/10 dark:border-white/10 hover:border-theme/40 t-primary"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-md border border-black/10 dark:border-white/10 shrink-0"
                    style={wp.previewStyle}
                  />
                  <span className="text-xs truncate">{wp.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
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
            />
          </div>
        </section>
      </div>

      {/* 分块 4：网格密度与排版细节 */}
      <section className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-black/5 dark:border-white/5">
          <i className="ri-equalizer-line text-theme text-base" />
          <h3 className="font-bold text-sm t-primary">瀑布流密度与细节</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* 列数 */}
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
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
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

          {/* 对齐 */}
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
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
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

          {/* 正文字体 */}
          <div className="space-y-1.5">
            <span className="font-semibold t-primary block">全站正文字体</span>
            <div className="flex gap-1.5">
              {[
                { label: "无衬线", value: "sans" },
                { label: "优雅衬线", value: "serif" },
                { label: "极客等宽", value: "mono" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    applyThemeFontFamily(opt.value);
                    setConfigValue("client", "theme.font_family", opt.value);
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
          <div className="space-y-1.5">
            <div className="flex justify-between">
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
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold t-primary">顶栏导航字号</span>
              <span className="font-mono text-theme font-bold">{navFontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={navFontSize}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                setConfigValue("client", "header.nav_font_size", val);
              }}
              className="w-full accent-theme cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="font-semibold t-primary">顶栏导航间距</span>
              <span className="font-mono text-theme font-bold">{navGap}px</span>
            </div>
            <input
              type="range"
              min={4}
              max={28}
              step={2}
              value={navGap}
              onChange={(e) => {
                const val = Number.parseInt(e.target.value, 10);
                setConfigValue("client", "header.nav_gap", val);
              }}
              className="w-full accent-theme cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
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
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={navOrganicTilt}
              onChange={(e) => setConfigValue("client", "header.nav_organic_tilt", e.target.checked)}
              className="accent-theme rounded"
            />
            <span className="font-semibold t-primary">导航手账灵动微倾角</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={customCursor}
              onChange={(e) => {
                applyThemeCustomCursor(e.target.checked);
                setConfigValue("client", "theme.custom_cursor", e.target.checked);
              }}
              className="accent-theme rounded"
            />
            <span className="font-semibold t-primary">定制趣味鼠标指针</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={readingProgress}
              onChange={(e) => setConfigValue("client", "theme.reading_progress", e.target.checked)}
              className="accent-theme rounded"
            />
            <span className="font-semibold t-primary">顶部阅读进度条</span>
          </label>
        </div>
      </section>
    </div>
  );
}
