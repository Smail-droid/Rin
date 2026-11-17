import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { client } from "../../app/runtime";
import {
  THEME_PRESETS,
  applyThemeColor,
  applyThemeOpacity,
  applyThemeFontFamily,
  applyThemeWallpaper,
  applyThemeCustomCursor,
  applyGalleryTiltDegree,
} from "../../utils/theme-color";
import { getStoredThemeMode, setThemeMode, type ThemeMode } from "../../utils/darkModeUtils";
import { type FeedCardVariant } from "../feed-card-options";

const CURATED_PRESETS = THEME_PRESETS.slice(0, 8);

const WALLPAPER_PRESETS = [
  { id: "none", name: "留空无壁纸", url: "none", icon: "ri-forbid-line" },
  { id: "sakura", name: "和风浅樱", url: "https://cdn.nodeimage.com/i/qAdktUUKq1wrLwlSuYIbhHDiZtf3lXCp.png", icon: "ri-sparkling-2-line" },
  { id: "starry", name: "静谧星空", url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2070&auto=format&fit=crop", icon: "ri-planet-line" },
  { id: "watercolor", name: "水彩森屿", url: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=2070&auto=format&fit=crop", icon: "ri-landscape-line" },
  { id: "paper", name: "暖调手账", url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=2070&auto=format&fit=crop", icon: "ri-file-paper-2-line" },
];

interface MasterPreset {
  id: "sakura" | "editorial" | "galaxy" | "amber";
  name: string;
  badge: string;
  icon: string;
  desc: string;
  config: Record<string, unknown>;
}

const MASTER_PRESETS: MasterPreset[] = [
  {
    id: "sakura",
    name: "樱落微光",
    badge: "Sakura Radiance",
    icon: "ri-sparkling-2-line",
    desc: "16:9 拍立得拟物卡片、温润微光、自然手账微倾、浮墨微光自然顶栏",
    config: {
      "feed.card_variant": "default",
      "header.position": "top",
      "header.layout": "classic",
      "theme.font_family": "sans",
      "theme.color": "#fc466b",
      "gallery.tilt_degree": 2.0,
      "gallery.columns": "auto",
      "gallery.card_gap": 24,
      "gallery.padding": 24,
      "gallery.align": "center",
      "theme.opacity": 85,
    },
  },
  {
    id: "editorial",
    name: "京都社论",
    badge: "Kyoto Editorial",
    icon: "ri-book-open-line",
    desc: "宽幅画报横屏、纯粹典雅衬线排印、极简纯文本社论顶栏",
    config: {
      "feed.card_variant": "editorial",
      "header.position": "top",
      "header.layout": "compact",
      "theme.font_family": "serif",
      "theme.color": "#78716c",
      "gallery.tilt_degree": 0.0,
      "gallery.columns": "auto",
      "gallery.card_gap": 24,
      "gallery.padding": 24,
      "gallery.align": "center",
      "theme.opacity": 100,
    },
  },
  {
    id: "galaxy",
    name: "星穹幽夜",
    badge: "Celestial Galaxy",
    icon: "ri-planet-line",
    desc: "幽蓝星光、通透毛玻璃卡片、浮墨微光自然顶栏 (插图立绘纯净展现)",
    config: {
      "feed.card_variant": "default",
      "header.position": "top",
      "header.layout": "classic",
      "theme.font_family": "sans",
      "theme.color": "#38bdf8",
      "gallery.tilt_degree": 1.2,
      "gallery.columns": "auto",
      "gallery.card_gap": 20,
      "gallery.padding": 24,
      "gallery.align": "center",
      "theme.opacity": 75,
      "theme.wallpaper": "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2070&auto=format&fit=crop",
      "theme.wallpaper_opacity": 40,
    },
  },
  {
    id: "amber",
    name: "琥珀手账",
    badge: "Amber Washi",
    icon: "ri-camera-lens-line",
    desc: "暖杏焦糖、活泼错落拟物手账、纸质微托盘顶栏",
    config: {
      "feed.card_variant": "default",
      "header.position": "top",
      "header.layout": "dock",
      "theme.font_family": "serif",
      "theme.color": "#f59e0b",
      "gallery.tilt_degree": 3.4,
      "gallery.columns": "auto",
      "gallery.card_gap": 22,
      "gallery.padding": 24,
      "gallery.align": "center",
      "theme.opacity": 90,
    },
  },
];

const CARD_VARIANTS: Array<{ id: FeedCardVariant; label: string; icon: string; desc: string }> = [
  { id: "default", label: "拍立得手账", icon: "ri-camera-line", desc: "拟物白边留白与胶片暗角" },
  { id: "editorial", label: "极简社论", icon: "ri-book-open-line", desc: "大号衬线标题与呼吸感摘要" },
  { id: "poster", label: "巨幅画册", icon: "ri-image-line", desc: "海报沉浸大图与微光浮层" },
  { id: "compact", label: "极客单行", icon: "ri-list-check-2", desc: "纯粹单行条目，极速扫读" },
];

export function InSituAestheticStudio() {
  const [location] = useLocation();
  const siteConfig = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [siteNameVal, setSiteNameVal] = useState(siteConfig.name || "Rin");
  const [siteDescVal, setSiteDescVal] = useState(siteConfig.description || "");

  // Dynamic parameters state
  const [tiltVal, setTiltVal] = useState(siteConfig.galleryTiltDegree ?? 1.8);
  const [gapVal, setGapVal] = useState(siteConfig.galleryCardGap ?? 24);
  const [wallpaperUrlVal, setWallpaperUrlVal] = useState(siteConfig.themeWallpaper || "");
  const [wallpaperOpacityVal, setWallpaperOpacityVal] = useState(siteConfig.themeWallpaperOpacity ?? 35);
  const [customCursorVal, setCustomCursorVal] = useState(siteConfig.themeCustomCursor !== false);
  const [readingProgressVal, setReadingProgressVal] = useState(siteConfig.themeReadingProgress !== false);

  useEffect(() => {
    if (siteConfig.name) setSiteNameVal(siteConfig.name);
    if (siteConfig.description) setSiteDescVal(siteConfig.description);
    if (siteConfig.galleryTiltDegree !== undefined) setTiltVal(siteConfig.galleryTiltDegree);
    if (siteConfig.galleryCardGap !== undefined) setGapVal(siteConfig.galleryCardGap);
    if (siteConfig.themeWallpaper !== undefined) setWallpaperUrlVal(siteConfig.themeWallpaper);
    if (siteConfig.themeWallpaperOpacity !== undefined) setWallpaperOpacityVal(siteConfig.themeWallpaperOpacity);
    if (siteConfig.themeCustomCursor !== undefined) setCustomCursorVal(siteConfig.themeCustomCursor !== false);
    if (siteConfig.themeReadingProgress !== undefined) setReadingProgressVal(siteConfig.themeReadingProgress !== false);
  }, [
    siteConfig.name,
    siteConfig.description,
    siteConfig.galleryTiltDegree,
    siteConfig.galleryCardGap,
    siteConfig.themeWallpaper,
    siteConfig.themeWallpaperOpacity,
    siteConfig.themeCustomCursor,
    siteConfig.themeReadingProgress,
  ]);

  // 严格在所有 Hooks 之后返回（杜绝 React Error #310 / #300 钩子数量不匹配）
  if (location.startsWith("/admin")) {
    return null;
  }

  const activeVariant = (siteConfig.feedCardVariant || "default") as FeedCardVariant;
  const activeColor = siteConfig.themeColor || "#fc466b";
  const activeHeaderLayout = siteConfig.headerLayout || "classic";
  const activeFontFamily = (() => {
    try {
      const cfg = JSON.parse(sessionStorage.getItem("config") || "{}");
      return String(cfg["theme.font_family"] || "sans");
    } catch {
      return "sans";
    }
  })();

  const handleSaveBrand = () => {
    void persistConfig({
      "site.name": siteNameVal.trim(),
      "site.description": siteDescVal.trim(),
    });
  };

  const persistConfig = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const cached = sessionStorage.getItem("config");
      const parsed = cached ? JSON.parse(cached) : {};
      const next = { ...parsed, ...updates };
      sessionStorage.setItem("config", JSON.stringify(next));

      window.dispatchEvent(new Event("rin:config-updated"));
      await client.config.update("client", updates);
    } catch (err) {
      console.error("Failed to persist aesthetic config:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyMasterPreset = (preset: MasterPreset) => {
    applyThemeColor(String(preset.config["theme.color"]));
    applyThemeFontFamily(String(preset.config["theme.font_family"]));
    if (preset.config["gallery.tilt_degree"] !== undefined) {
      applyGalleryTiltDegree(Number(preset.config["gallery.tilt_degree"]));
      setTiltVal(Number(preset.config["gallery.tilt_degree"]));
    }
    if (preset.config["theme.opacity"] !== undefined) {
      applyThemeOpacity(preset.config["theme.opacity"]);
    }
    void persistConfig(preset.config);
  };

  const handleSelectVariant = (variant: FeedCardVariant) => {
    void persistConfig({ "feed.card_variant": variant });
  };

  const handleSelectColor = (color: string) => {
    applyThemeColor(color);
    void persistConfig({ "theme.color": color, "theme.preset": "custom" });
  };

  const handleSelectHeaderLayout = (layout: string) => {
    void persistConfig({ "header.position": "top", "header.layout": layout });
  };

  const handleSelectFontFamily = (family: string) => {
    applyThemeFontFamily(family);
    void persistConfig({ "theme.font_family": family });
  };

  const handleToggleThemeMode = () => {
    const current = getStoredThemeMode();
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    setThemeMode(next);
  };

  // Continuous Tilt Slider Handler
  const handleChangeTilt = (val: number) => {
    setTiltVal(val);
    applyGalleryTiltDegree(val);
    void persistConfig({ "gallery.tilt_degree": val });
  };

  // Card Gap Slider Handler
  const handleChangeGap = (val: number) => {
    setGapVal(val);
    void persistConfig({ "gallery.card_gap": val });
  };

  // Wallpaper Handlers
  const handleSaveWallpaper = () => {
    applyThemeWallpaper(wallpaperUrlVal, wallpaperOpacityVal);
    void persistConfig({
      "theme.wallpaper": wallpaperUrlVal.trim(),
      "theme.wallpaper_opacity": wallpaperOpacityVal,
    });
  };

  const handleSelectWallpaperPreset = (url: string) => {
    setWallpaperUrlVal(url);
    applyThemeWallpaper(url, wallpaperOpacityVal);
    void persistConfig({
      "theme.wallpaper": url,
      "theme.wallpaper_opacity": wallpaperOpacityVal,
    });
  };

  const handleChangeWallpaperOpacity = (val: number) => {
    setWallpaperOpacityVal(val);
    applyThemeWallpaper(wallpaperUrlVal, val);
    void persistConfig({ "theme.wallpaper_opacity": val });
  };

  // Custom Cursor Toggle
  const handleToggleCursor = () => {
    const next = !customCursorVal;
    setCustomCursorVal(next);
    applyThemeCustomCursor(next);
    void persistConfig({ "theme.custom_cursor": next });
  };

  // Reading Progress Toggle
  const handleToggleReadingProgress = () => {
    const next = !readingProgressVal;
    setReadingProgressVal(next);
    void persistConfig({ "theme.reading_progress": next });
  };

  return createPortal(
    <>
      {/* 浮动唤起圆纽（精致极简 40x40 矢量图标，杜绝文字突兀） */}
      <div className="fixed bottom-6 left-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/85 dark:border-white/10 dark:bg-neutral-900/85 shadow-lg backdrop-blur-xl hover:border-theme hover:scale-110 active:scale-95 transition-all text-neutral-600 dark:text-neutral-300 hover:text-theme cursor-pointer"
          title="前台美学工坊 (无级参数滑块、色彩、壁纸与字族微调)"
        >
          <i className="ri-palette-line text-lg text-theme group-hover:rotate-12 transition-transform" />
          {saving ? <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-theme animate-ping" /> : null}
        </button>
      </div>

      {/* 抽屉浮层遮罩 */}
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {/* 侧边滑出美学设计工坊抽屉 */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 w-full sm:w-[420px] bg-white/95 dark:bg-[#12161f]/95 backdrop-blur-2xl shadow-2xl border-r border-black/10 dark:border-white/10 flex flex-col transition-transform duration-300 ease-out select-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 抽屉顶栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-theme/10 text-theme text-sm">
              <i className="ri-palette-line" />
            </span>
            <div>
              <h2 className="text-sm font-bold t-primary">前台美学工坊 · 参数中枢</h2>
              <p className="text-[10px] text-neutral-400">实时调整无级滑块与视觉预设，所见即所得</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>

        {/* 抽屉滚动内容 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* 1. 站点身份标题快速修改 */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold t-primary flex items-center gap-1.5">
                <i className="ri-quill-pen-line text-theme" />
                <span>站点名称与描述</span>
              </span>
              <button
                type="button"
                onClick={handleSaveBrand}
                disabled={saving}
                className="px-2 py-0.5 rounded-md bg-theme/10 hover:bg-theme/20 text-theme text-[10px] font-bold transition cursor-pointer"
              >
                保存身份
              </button>
            </div>
            <input
              type="text"
              value={siteNameVal}
              onChange={(e) => setSiteNameVal(e.target.value)}
              placeholder="站点名称 (如: 画廊随想)"
              className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs font-bold outline-none focus:border-theme"
            />
            <input
              type="text"
              value={siteDescVal}
              onChange={(e) => setSiteDescVal(e.target.value)}
              placeholder="站点副标题/描述..."
              className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs outline-none focus:border-theme"
            />
          </div>

          {/* 2. 四大画廊意境一键变奏 (Master Gallery Aesthetics) */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-gradient-to-br from-theme/5 to-transparent border border-theme/20 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme uppercase tracking-wider flex items-center gap-1.5">
                <i className="ri-magic-line" />
                <span>四大画廊意境一键变奏</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">1-Click</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MASTER_PRESETS.map((preset) => {
                const isCurrent =
                  activeVariant === preset.config["feed.card_variant"] &&
                  activeHeaderLayout === preset.config["header.layout"];
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyMasterPreset(preset)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? "border-theme bg-theme/10 ring-1 ring-theme/30 shadow-xs"
                        : "border-black/5 bg-white/70 dark:bg-white/5 hover:border-theme/30 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs t-primary">
                      <i className={`${preset.icon} text-theme`} />
                      <span>{preset.name}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                      {preset.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 无级参数微调滑块集群 (Continuous Sliders) */}
          <div className="space-y-4 p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
              <span className="text-xs font-bold t-primary flex items-center gap-1.5">
                <i className="ri-equalizer-line text-theme" />
                <span>动态无级参数微调 (实时生效)</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">Sliders</span>
            </div>

            {/* 拍立得倾斜角滑块 (0° ~ 8.0°) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                  拍立得错落倾斜度
                </span>
                <span className="font-mono text-theme font-bold text-[11px]">
                  {tiltVal.toFixed(1)}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.2"
                value={tiltVal}
                onChange={(e) => handleChangeTilt(Number.parseFloat(e.target.value))}
                className="w-full accent-theme h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>0.0° (纯平整齐)</span>
                <span>2.0° (自然微倾)</span>
                <span>8.0° (随性错落)</span>
              </div>
            </div>

            {/* 卡片间距滑块 (8px ~ 48px) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                  画廊卡片间距 (Gap)
                </span>
                <span className="font-mono text-theme font-bold text-[11px]">{gapVal}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="48"
                step="2"
                value={gapVal}
                onChange={(e) => handleChangeGap(Number.parseInt(e.target.value, 10))}
                className="w-full accent-theme h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* 4. 全屏通透沉浸壁纸设置 (Custom Wallpaper) */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
              <span className="text-xs font-bold t-primary flex items-center gap-1.5">
                <i className="ri-image-line text-theme" />
                <span>全屏通透背景壁纸</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectWallpaperPreset("none")}
                  className="px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 hover:border-rose-400 text-neutral-500 hover:text-rose-500 text-[10px] font-medium transition cursor-pointer"
                  title="清空当前壁纸，使用纯净留白"
                >
                  留空清空
                </button>
                <button
                  type="button"
                  onClick={handleSaveWallpaper}
                  className="px-2 py-0.5 rounded-md bg-theme text-white text-[10px] font-bold transition hover:bg-theme-hover cursor-pointer"
                >
                  应用直链
                </button>
              </div>
            </div>

            {/* 5 款精选预设壁纸库 */}
            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400">精选壁纸库 (一键切换或留空)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {WALLPAPER_PRESETS.map((wp) => {
                  const isSelected =
                    (wp.url === "none" && (!wallpaperUrlVal || wallpaperUrlVal === "none")) ||
                    wallpaperUrlVal === wp.url;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => handleSelectWallpaperPreset(wp.url)}
                      className={`px-2 py-1.5 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                        isSelected
                          ? "border-theme bg-theme text-white shadow-2xs font-bold"
                          : "border-black/5 bg-white/70 dark:bg-white/5 hover:border-theme/40 text-neutral-600 dark:text-neutral-300"
                      }`}
                    >
                      <i className={wp.icon} />
                      <span>{wp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-neutral-500">自定义壁纸图片 URL (支持外部图床直链)</label>
              <input
                type="text"
                value={wallpaperUrlVal}
                onChange={(e) => setWallpaperUrlVal(e.target.value)}
                placeholder="https://... 或点击上方预设"
                className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs font-mono outline-none focus:border-theme"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">壁纸半透显影强度</span>
                <span className="font-mono text-theme font-bold text-[11px]">{wallpaperOpacityVal}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={wallpaperOpacityVal}
                onChange={(e) => handleChangeWallpaperOpacity(Number.parseInt(e.target.value, 10))}
                className="w-full accent-theme h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* 5. 交互与微动效开关 (光标 & 极光进度条) */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <span className="text-xs font-bold t-primary flex items-center gap-1.5 border-b border-black/5 dark:border-white/5 pb-2">
              <i className="ri-sparkling-line text-theme" />
              <span>二次元微动效与光标体验</span>
            </span>

            {/* 二次元萌系光标开关 */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-col">
                <span className="font-semibold text-xs t-primary">二次元定制鼠标指针</span>
                <span className="text-[10px] text-neutral-400">可爱动漫小箭头与点击手势指针</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={customCursorVal}
                onClick={handleToggleCursor}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                  customCursorVal ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                    customCursorVal ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* 顶端极光阅读进度条开关 */}
            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
              <div className="flex flex-col">
                <span className="font-semibold text-xs t-primary">顶端极光阅读进度条</span>
                <span className="text-[10px] text-neutral-400">滚动下拉时全站顶端渐变进度随动</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={readingProgressVal}
                onClick={handleToggleReadingProgress}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                  readingProgressVal ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                    readingProgressVal ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 6. 顶栏导航 3 大风格切换 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <i className="ri-layout-top-line text-theme" />
              <span>顶栏导航风格 (自然融入，绝不遮挡)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "classic", label: "浮墨微光流" },
                { id: "compact", label: "京都社论流" },
                { id: "dock", label: "手账微托盘" },
              ].map((hl) => {
                const isSelected = activeHeaderLayout === hl.id;
                return (
                  <button
                    key={hl.id}
                    type="button"
                    onClick={() => handleSelectHeaderLayout(hl.id)}
                    className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition-all text-center ${
                      isSelected
                        ? "border-theme bg-theme text-white shadow-2xs"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {hl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. 卡片展示形态 (4 大卡片模板) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              卡片排版形态
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CARD_VARIANTS.map((v) => {
                const isSelected = activeVariant === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVariant(v.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-theme bg-theme/10 ring-1 ring-theme/30 text-theme font-bold shadow-xs"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-700 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    <i className={`${v.icon} text-sm ${isSelected ? "text-theme" : "text-neutral-400"}`} />
                    <span className="text-xs">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8. 核心主题色盘 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                核心主题微光色
              </label>
              <span className="text-[11px] font-mono text-neutral-400">{activeColor}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CURATED_PRESETS.map((p) => {
                const isSelected = activeColor.toLowerCase() === p.color.toLowerCase();
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectColor(p.color)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-theme ring-2 ring-theme/30 bg-theme/5"
                        : "border-black/5 hover:border-black/20 dark:border-white/5"
                    }`}
                  >
                    <span
                      className="h-6 w-6 rounded-full shadow-2xs transition-transform hover:scale-110"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 truncate w-full text-center">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 9. 全局字族方案 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              全站艺术字体族
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: "sans", label: "现代无衬线" },
                { id: "serif", label: "京都优雅衬线" },
                { id: "mono", label: "等宽极客字符" },
              ].map((f) => {
                const isSelected = activeFontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFontFamily(f.id)}
                    className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-bold transition-all text-center ${
                      isSelected
                        ? "border-theme bg-theme text-white shadow-2xs"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    <div>{f.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10. 日夜光照模式 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              日夜模式
            </label>
            <button
              type="button"
              onClick={handleToggleThemeMode}
              className="w-full flex items-center justify-between p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:bg-neutral-100 dark:hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <i className="ri-sun-line text-amber-500 text-sm" />
                <span>明暗光照模式极速切换</span>
              </div>
              <span className="text-xs font-mono text-neutral-400">切换</span>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
