import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { client } from "../../app/runtime";
import {
  THEME_PRESETS,
  applyThemeColor,
  applyThemeFontFamily,
  applyThemeWallpaper,
  applyThemeCustomCursor,
  applyGalleryTiltDegree,
} from "../../utils/theme-color";
import { getStoredThemeMode, setThemeMode, type ThemeMode } from "../../utils/darkModeUtils";
import { type FeedCardVariant } from "../feed-card-options";

const CURATED_PRESETS = THEME_PRESETS.slice(0, 8);

// 5 款轻量级纯净 CSS 意境背景 (拒绝沉重杂乱的大图片，清爽通透)
export interface WallpaperPreset {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  icon: string;
  previewBg: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "none",
    name: "纯白留空",
    subtitle: "极简纯净纯色画布",
    url: "none",
    icon: "ri-forbid-line",
    previewBg: "bg-neutral-100 dark:bg-neutral-800",
  },
  {
    id: "sakura-glow",
    name: "樱落柔雾",
    subtitle: "和风暖调微光渐变",
    url: "radial-gradient(ellipse 80% 60% at 50% -15%, rgba(252, 70, 107, 0.12), transparent 70%), radial-gradient(circle 500px at 10% 20%, rgba(254, 218, 226, 0.25), transparent)",
    icon: "ri-sparkling-2-line",
    previewBg: "bg-gradient-to-tr from-rose-200/50 via-pink-100/50 to-white",
  },
  {
    id: "starry-nebula",
    name: "幽夜星云",
    subtitle: "深空静谧冷调渐变",
    url: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56, 189, 248, 0.15), transparent 70%), radial-gradient(circle 600px at 90% 10%, rgba(99, 102, 241, 0.12), transparent 60%)",
    icon: "ri-planet-line",
    previewBg: "bg-gradient-to-tr from-sky-300/40 via-indigo-200/40 to-neutral-900",
  },
  {
    id: "washi-dots",
    name: "和纸点阵",
    subtitle: "日系手账文具微粒",
    url: "radial-gradient(rgba(100, 116, 139, 0.14) 1px, transparent 1px)",
    icon: "ri-file-paper-2-line",
    previewBg: "bg-neutral-200/40",
  },
  {
    id: "morning-mist",
    name: "晨光青霭",
    subtitle: "水彩柔和自然呼吸",
    url: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(16, 185, 129, 0.10), transparent 70%), radial-gradient(circle 500px at 80% 20%, rgba(245, 158, 11, 0.08), transparent)",
    icon: "ri-landscape-line",
    previewBg: "bg-gradient-to-tr from-emerald-100/50 via-amber-100/40 to-white",
  },
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
    desc: "16:9 拍立得拟物卡片、温润微光、自然微倾手账、浮墨微光自然顶栏",
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
      "theme.wallpaper": "radial-gradient(ellipse 80% 60% at 50% -15%, rgba(252, 70, 107, 0.12), transparent 70%), radial-gradient(circle 500px at 10% 20%, rgba(254, 218, 226, 0.25), transparent)",
      "theme.wallpaper_opacity": 35,
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
      "theme.wallpaper": "none",
      "theme.wallpaper_opacity": 0,
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
      "theme.wallpaper": "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56, 189, 248, 0.15), transparent 70%), radial-gradient(circle 600px at 90% 10%, rgba(99, 102, 241, 0.12), transparent 60%)",
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
      "theme.wallpaper": "radial-gradient(rgba(100, 116, 139, 0.14) 1px, transparent 1px)",
      "theme.wallpaper_opacity": 30,
    },
  },
];

const CARD_VARIANTS: Array<{ id: FeedCardVariant; label: string; icon: string; desc: string }> = [
  { id: "default", label: "拍立得手账", icon: "ri-camera-line", desc: "拟物白边留白与胶片暗角" },
  { id: "editorial", label: "极简社论", icon: "ri-book-open-line", desc: "大号衬线标题与呼吸感摘要" },
  { id: "poster", label: "巨幅画册", icon: "ri-image-line", desc: "纯净大图呈现，文字下移分离" },
  { id: "compact", label: "极客单行", icon: "ri-list-check-2", desc: "纯粹单行条目，极速扫读" },
];

export function InSituAestheticStudio() {
  const [location] = useLocation();
  const siteConfig = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [siteNameVal, setSiteNameVal] = useState(siteConfig.name || "Rin");
  const [siteDescVal, setSiteDescVal] = useState(siteConfig.description || "");

  // 严格单独记录当前激活的唯一大师级意境预设 (消灭点一个显示两个的 Bug)
  const [activeMasterPreset, setActiveMasterPreset] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("rin_active_master_preset");
      if (saved) return saved;
    } catch {}
    return "sakura";
  });

  // Dynamic parameters state
  const [tiltVal, setTiltVal] = useState(siteConfig.galleryTiltDegree ?? 1.8);
  const [gapVal, setGapVal] = useState(siteConfig.galleryCardGap ?? 24);
  const [wallpaperUrlVal, setWallpaperUrlVal] = useState(siteConfig.themeWallpaper || "none");
  const [wallpaperOpacityVal, setWallpaperOpacityVal] = useState(siteConfig.themeWallpaperOpacity ?? 35);
  const [customCursorVal, setCustomCursorVal] = useState(siteConfig.themeCustomCursor !== false);
  const [readingProgressVal, setReadingProgressVal] = useState(siteConfig.themeReadingProgress !== false);

  // 用户个人收藏壁纸列表 (持久化存储)
  const [savedWallpapers, setSavedWallpapers] = useState<Array<{ id: string; name: string; url: string }>>(() => {
    try {
      const list = localStorage.getItem("rin_saved_custom_wallpapers");
      if (list) return JSON.parse(list);
    } catch {}
    return [];
  });

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
    setActiveMasterPreset(preset.id);
    try {
      localStorage.setItem("rin_active_master_preset", preset.id);
    } catch {}

    applyThemeColor(String(preset.config["theme.color"]));
    applyThemeFontFamily(String(preset.config["theme.font_family"]));
    if (preset.config["gallery.tilt_degree"] !== undefined) {
      applyGalleryTiltDegree(Number(preset.config["gallery.tilt_degree"]));
      setTiltVal(Number(preset.config["gallery.tilt_degree"]));
    }
    if (preset.config["theme.wallpaper"] !== undefined) {
      const wpUrl = String(preset.config["theme.wallpaper"]);
      const wpOp = Number(preset.config["theme.wallpaper_opacity"] ?? 35);
      setWallpaperUrlVal(wpUrl);
      setWallpaperOpacityVal(wpOp);
      applyThemeWallpaper(wpUrl, wpOp);
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
  const handleSaveWallpaper = (targetUrl?: string) => {
    const urlToSave = (targetUrl ?? wallpaperUrlVal).trim();
    applyThemeWallpaper(urlToSave, wallpaperOpacityVal);
    void persistConfig({
      "theme.wallpaper": urlToSave,
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

  // Bookmark / Save Custom Wallpaper
  const handleBookmarkCurrentWallpaper = () => {
    if (!wallpaperUrlVal || wallpaperUrlVal === "none") return;
    const name = prompt("请输入此壁纸预设的名称（如: 治愈星河）", `自定义壁纸 #${savedWallpapers.length + 1}`);
    if (!name) return;

    const newItem = { id: `wp_${Date.now()}`, name: name.trim(), url: wallpaperUrlVal.trim() };
    const updated = [newItem, ...savedWallpapers];
    setSavedWallpapers(updated);
    try {
      localStorage.setItem("rin_saved_custom_wallpapers", JSON.stringify(updated));
    } catch {}
  };

  const handleDeleteSavedWallpaper = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedWallpapers.filter((w) => w.id !== id);
    setSavedWallpapers(updated);
    try {
      localStorage.setItem("rin_saved_custom_wallpapers", JSON.stringify(updated));
    } catch {}
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
      {/* 浮动唤起圆纽（高质感极简 40x40 矢量图标） */}
      <div className="fixed bottom-6 left-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 shadow-md backdrop-blur-xl hover:border-neutral-400 dark:hover:border-neutral-600 hover:scale-105 active:scale-95 transition-all text-neutral-700 dark:text-neutral-200 cursor-pointer"
          title="美学工坊 · 设计系统与参数中枢"
        >
          <i className="ri-palette-line text-lg text-theme group-hover:rotate-12 transition-transform" />
          {saving ? <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> : null}
        </button>
      </div>

      {/* 遮罩 */}
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {/* 侧边滑出高阶美学设计工坊抽屉 (严格遵循 Shadcn + Swiss 2.0 规范，典雅克制) */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 w-full sm:w-[420px] bg-white/95 dark:bg-[#12161f]/95 backdrop-blur-2xl shadow-2xl border-r border-neutral-200/80 dark:border-neutral-800/80 flex flex-col transition-transform duration-300 ease-out select-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 1. 抽屉顶栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/70 dark:border-neutral-800/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 text-sm">
              <i className="ri-palette-line text-theme" />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                前台美学工坊 · 参数中枢
              </h2>
              <p className="text-[11px] text-neutral-400 font-normal">
                全局排版、无级参数与背景意境微调
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* 2. 抽屉滚动内容 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* 站点基本身份快速更新 */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <i className="ri-quill-pen-line text-neutral-500" />
                <span>站点名称与描述</span>
              </span>
              <button
                type="button"
                onClick={handleSaveBrand}
                disabled={saving}
                className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-[10px] font-bold shadow-2xs hover:opacity-90 transition cursor-pointer"
              >
                保存身份
              </button>
            </div>
            <input
              type="text"
              value={siteNameVal}
              onChange={(e) => setSiteNameVal(e.target.value)}
              placeholder="站点名称 (如: 画廊随想)"
              className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-xs font-semibold outline-none focus:border-neutral-400 transition"
            />
            <input
              type="text"
              value={siteDescVal}
              onChange={(e) => setSiteDescVal(e.target.value)}
              placeholder="站点副标题/描述..."
              className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-xs outline-none focus:border-neutral-400 transition"
            />
          </div>

          {/* 3. 四大画廊意境一键变奏 (彻底消除多选 Bug，高阶瑞士排版质感) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase flex items-center gap-1.5">
                <i className="ri-magic-line text-neutral-400" />
                <span>四大画廊意境一键变奏</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">1-Click</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MASTER_PRESETS.map((preset) => {
                const isCurrent = activeMasterPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyMasterPreset(preset)}
                    className={`group relative flex flex-col justify-between p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                      isCurrent
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 shadow-md ring-2 ring-neutral-900/10 dark:ring-white/20"
                        : "border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-white dark:hover:bg-neutral-850"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs shrink-0 ${
                            isCurrent
                              ? "bg-white/20 text-white dark:bg-neutral-900/10 dark:text-neutral-950"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 group-hover:text-theme"
                          }`}
                        >
                          <i className={preset.icon} />
                        </span>
                        <span className="font-bold text-xs truncate">
                          {preset.name}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] shadow-2xs shrink-0">
                          <i className="ri-check-line font-bold" />
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] leading-tight line-clamp-1 mt-0.5 ${
                        isCurrent ? "opacity-80" : "text-neutral-400"
                      }`}
                    >
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. 全屏通透沉浸背景 (5 款轻量 CSS 意境预设 + 收藏保存管理) */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/70">
            <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800/60 pb-2">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <i className="ri-image-line text-neutral-500" />
                <span>全屏通透背景壁纸</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectWallpaperPreset("none")}
                  className="px-2 py-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 text-[10px] font-medium transition cursor-pointer"
                >
                  留空清空
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveWallpaper()}
                  className="px-2 py-0.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-[10px] font-bold shadow-2xs hover:opacity-90 transition cursor-pointer"
                >
                  应用当前
                </button>
              </div>
            </div>

            {/* 5 款轻量级纯净 CSS 意境预设 */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400">轻量意境预设 (点击即时生效)</label>
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
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-2 transition cursor-pointer ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 shadow-xs font-bold"
                          : "border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-800/80 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      <span className={`h-3 w-3 rounded-full border border-black/10 shrink-0 ${wp.previewBg}`} />
                      <span className="truncate">{wp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 用户个人收藏的自定义壁纸列表 */}
            {savedWallpapers.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <label className="text-[11px] text-neutral-400">已收藏的自定义壁纸</label>
                <div className="flex flex-wrap gap-1.5">
                  {savedWallpapers.map((sw) => {
                    const isSelected = wallpaperUrlVal === sw.url;
                    return (
                      <span
                        key={sw.id}
                        onClick={() => handleSelectWallpaperPreset(sw.url)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono cursor-pointer transition border ${
                          isSelected
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900"
                            : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400"
                        }`}
                      >
                        <i className="ri-bookmark-3-line text-theme" />
                        <span className="font-sans font-medium">{sw.name}</span>
                        <i
                          className="ri-close-line text-xs opacity-60 hover:opacity-100 hover:text-rose-500"
                          onClick={(e) => handleDeleteSavedWallpaper(sw.id, e)}
                        />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 自定义壁纸输入框与收藏 */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>自定义直链 / 渐变代码</span>
                <button
                  type="button"
                  onClick={handleBookmarkCurrentWallpaper}
                  className="text-theme hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <i className="ri-bookmark-line" />
                  <span>+ 收藏当前壁纸</span>
                </button>
              </div>
              <input
                type="text"
                value={wallpaperUrlVal}
                onChange={(e) => setWallpaperUrlVal(e.target.value)}
                placeholder="https://... 或 radial-gradient(...)"
                className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-xs font-mono outline-none focus:border-neutral-400 transition"
              />
            </div>

            {/* 半透度显影滑块 */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">背景显影强度 (Opacity)</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300 font-bold text-[11px] bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                  {wallpaperOpacityVal}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={wallpaperOpacityVal}
                onChange={(e) => handleChangeWallpaperOpacity(Number.parseInt(e.target.value, 10))}
                className="w-full accent-neutral-900 dark:accent-white h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* 5. 动态无级参数微调滑块集群 (Continuous Sliders) */}
          <div className="space-y-4 p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/70">
            <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800/60 pb-2">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <i className="ri-equalizer-line text-neutral-500" />
                <span>动态无级参数微调 (实时生效)</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">Sliders</span>
            </div>

            {/* 拍立得倾斜角滑块 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  拍立得错落倾斜度
                </span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300 font-bold text-[11px] bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
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
                className="w-full accent-neutral-900 dark:accent-white h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>0.0° (纯平对齐)</span>
                <span>2.0° (自然微倾)</span>
                <span>8.0° (随性错落)</span>
              </div>
            </div>

            {/* 卡片间距滑块 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  画廊卡片间距 (Gap)
                </span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300 font-bold text-[11px] bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                  {gapVal}px
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="48"
                step="2"
                value={gapVal}
                onChange={(e) => handleChangeGap(Number.parseInt(e.target.value, 10))}
                className="w-full accent-neutral-900 dark:accent-white h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* 6. 交互微动效与光标体验 */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/70">
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 border-b border-neutral-200/60 dark:border-neutral-800/60 pb-2">
              <i className="ri-sparkling-line text-neutral-500" />
              <span>二次元微动效与光标体验</span>
            </span>

            {/* 二次元萌系光标开关 */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-col">
                <span className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">二次元定制鼠标指针</span>
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
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <div className="flex flex-col">
                <span className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">顶端极光阅读进度条</span>
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

          {/* 7. 顶栏导航 3 大风格切换 */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold tracking-wider text-neutral-500 uppercase flex items-center gap-1.5">
              <i className="ri-layout-top-line text-neutral-400" />
              <span>顶栏导航风格 (嵌入画布，绝不遮挡)</span>
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
                    className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition-all text-center cursor-pointer ${
                      isSelected
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 shadow-xs"
                        : "border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {hl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8. 卡片排版形态 */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
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
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-xs"
                        : "border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <i className={`${v.icon} text-sm ${isSelected ? "text-white dark:text-neutral-900" : "text-neutral-400"}`} />
                    <span className="text-xs">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 9. 核心主题色盘 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
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
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-neutral-900 dark:border-white ring-2 ring-neutral-900/10 dark:ring-white/20 bg-neutral-100 dark:bg-neutral-800"
                        : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-400 bg-white/70 dark:bg-neutral-900/60"
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full shadow-2xs transition-transform hover:scale-110"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300 truncate w-full text-center">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10. 全局字族方案 */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
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
                    className={`flex-1 py-1.5 px-2 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      isSelected
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 shadow-xs"
                        : "border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <div>{f.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 11. 日夜光照模式 */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              日夜模式
            </label>
            <button
              type="button"
              onClick={handleToggleThemeMode}
              className="w-full flex items-center justify-between p-3 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-400 transition cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
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
