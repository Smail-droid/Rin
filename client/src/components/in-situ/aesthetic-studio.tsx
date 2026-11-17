import { useState, useEffect, useCallback } from "react";
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
import type { FeedCardVariant } from "../feed-card-options";
import { AmbientEffectsCanvas, type AmbienceMode } from "../ambient-effects-canvas";

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

interface ScenePreset {
  id: "sakura" | "editorial" | "galaxy" | "amber";
  name: string;
  badge: string;
  icon: string;
  desc: string;
  ambience: AmbienceMode;
  config: Record<string, unknown>;
}

const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "sakura",
    name: "和风浅樱",
    badge: "落樱飞舞 · 治愈粉白",
    icon: "ri-sparkling-2-line",
    desc: "落樱飞舞、粉白温润渐变、手账微倾、浮墨微光自然顶栏",
    ambience: "sakura",
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
    id: "galaxy",
    name: "星穹幽夜",
    badge: "星尘萤火 · 静谧幽蓝",
    icon: "ri-planet-line",
    desc: "萤火星尘、深邃幽蓝、通透毛玻璃、插图立绘纯净展现",
    ambience: "fireflies",
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
    id: "editorial",
    name: "京都夜雨",
    badge: "细雨微光 · 纸墨雅致",
    icon: "ri-rainy-line",
    desc: "雨丝如织、雅灰沉静、衬线体排印、极简纯文本社论顶栏",
    ambience: "rain",
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
    id: "amber",
    name: "手账暖阳",
    badge: "和纸微粒 · 温暖米杏",
    icon: "ri-camera-lens-line",
    desc: "手账点阵、暖杏焦糖、拍立得拟物错落、便签微托盘",
    ambience: "none",
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
  { id: "default", label: "拍立得手账", icon: "ri-camera-line", desc: "拟物留白与胶片暗角" },
  { id: "editorial", label: "极简社论", icon: "ri-book-open-line", desc: "大号衬线标题与呼吸感摘要" },
  { id: "poster", label: "巨幅画册", icon: "ri-image-line", desc: "纯净立绘呈现，文字下移" },
  { id: "compact", label: "极客单行", icon: "ri-list-check-2", desc: "纯粹单行条目，极速扫读" },
];

export function InSituAestheticStudio() {
  const [location] = useLocation();
  const siteConfig = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);

  // 1. 画廊环境粒子动效 (雨丝 / 落樱 / 萤火星尘 / 纯净)
  const [ambienceMode, setAmbienceMode] = useState<AmbienceMode>(() => {
    try {
      const saved = localStorage.getItem("rin_ambience_mode");
      if (saved && ["none", "rain", "sakura", "fireflies"].includes(saved)) {
        return saved as AmbienceMode;
      }
    } catch {}
    return "sakura";
  });

  // 2. 严格唯一选中的场景预设 ID (杜绝点一个显示两个 Bug)
  const [activeSceneId, setActiveSceneId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("rin_active_scene_id");
      if (saved) return saved;
    } catch {}
    return "sakura";
  });

  // 3. 模块化实验室二级 Tab
  const [activeTab, setActiveTab] = useState<"ambience" | "card" | "slider" | "wallpaper" | "color" | "interaction">("ambience");

  // Dynamic parameters state
  const [tiltVal, setTiltVal] = useState(siteConfig.galleryTiltDegree ?? 1.8);
  const [gapVal, setGapVal] = useState(siteConfig.galleryCardGap ?? 24);
  const [wallpaperUrlVal, setWallpaperUrlVal] = useState(siteConfig.themeWallpaper || "none");
  const [wallpaperOpacityVal, setWallpaperOpacityVal] = useState(siteConfig.themeWallpaperOpacity ?? 35);
  const [customCursorVal, setCustomCursorVal] = useState(siteConfig.themeCustomCursor !== false);
  const [readingProgressVal, setReadingProgressVal] = useState(siteConfig.themeReadingProgress !== false);

  // 用户个人收藏壁纸列表
  const [savedWallpapers, setSavedWallpapers] = useState<Array<{ id: string; name: string; url: string }>>(() => {
    try {
      const list = localStorage.getItem("rin_saved_custom_wallpapers");
      if (list) return JSON.parse(list);
    } catch {}
    return [];
  });

  // Toast / Share copy feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // URL 参数水合 (支持将搭配配置以链接形式直接分享给他人打开)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qAmbience = params.get("ambience");
    const qTilt = params.get("tilt");
    const qVariant = params.get("variant");
    const qNav = params.get("nav");

    if (qAmbience && ["none", "rain", "sakura", "fireflies"].includes(qAmbience)) {
      setAmbienceMode(qAmbience as AmbienceMode);
    }
    if (qTilt) {
      const parsedTilt = parseFloat(qTilt);
      if (!isNaN(parsedTilt)) {
        setTiltVal(parsedTilt);
        applyGalleryTiltDegree(parsedTilt);
      }
    }
    if (qVariant) {
      void persistConfig({ "feed.card_variant": qVariant });
    }
    if (qNav) {
      void persistConfig({ "header.layout": qNav });
    }
  }, []);

  useEffect(() => {
    if (siteConfig.galleryTiltDegree !== undefined) setTiltVal(siteConfig.galleryTiltDegree);
    if (siteConfig.galleryCardGap !== undefined) setGapVal(siteConfig.galleryCardGap);
    if (siteConfig.themeWallpaper !== undefined) setWallpaperUrlVal(siteConfig.themeWallpaper);
    if (siteConfig.themeWallpaperOpacity !== undefined) setWallpaperOpacityVal(siteConfig.themeWallpaperOpacity);
    if (siteConfig.themeCustomCursor !== undefined) setCustomCursorVal(siteConfig.themeCustomCursor !== false);
    if (siteConfig.themeReadingProgress !== undefined) setReadingProgressVal(siteConfig.themeReadingProgress !== false);
  }, [
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

  const activeVariant = siteConfig.feedCardVariant || "default";
  const activeColor = siteConfig.themeColor || "#fc466b";
  const activeHeaderLayout = siteConfig.headerLayout || "classic";

  const persistConfig = async (updates: Record<string, unknown>) => {
    try {
      const cached = sessionStorage.getItem("config");
      const parsed = cached ? JSON.parse(cached) : {};
      const next = { ...parsed, ...updates };
      sessionStorage.setItem("config", JSON.stringify(next));

      window.dispatchEvent(new Event("rin:config-updated"));
      await client.config.update("client", updates);
    } catch (err) {
      console.error("Failed to persist aesthetic config:", err);
    }
  };

  // 切换场景预设
  const handleApplyScene = (scene: ScenePreset) => {
    setActiveSceneId(scene.id);
    setAmbienceMode(scene.ambience);
    try {
      localStorage.setItem("rin_active_scene_id", scene.id);
      localStorage.setItem("rin_ambience_mode", scene.ambience);
    } catch {}

    applyThemeColor(String(scene.config["theme.color"]));
    applyThemeFontFamily(String(scene.config["theme.font_family"]));
    if (scene.config["gallery.tilt_degree"] !== undefined) {
      applyGalleryTiltDegree(Number(scene.config["gallery.tilt_degree"]));
      setTiltVal(Number(scene.config["gallery.tilt_degree"]));
    }
    if (scene.config["theme.wallpaper"] !== undefined) {
      const wpUrl = String(scene.config["theme.wallpaper"]);
      const wpOp = Number(scene.config["theme.wallpaper_opacity"] ?? 35);
      setWallpaperUrlVal(wpUrl);
      setWallpaperOpacityVal(wpOp);
      applyThemeWallpaper(wpUrl, wpOp);
    }
    void persistConfig(scene.config);
  };

  // 灵感一掷：像参考网站“随机一双”一样，随机生成一套协调好玩的搭配
  const handleRandomRoll = () => {
    const randomScene = SCENE_PRESETS[Math.floor(Math.random() * SCENE_PRESETS.length)];
    const randomTilt = parseFloat((Math.random() * 4).toFixed(1));
    const randomAmbience: AmbienceMode = ["rain", "sakura", "fireflies"][Math.floor(Math.random() * 3)] as any;

    setActiveSceneId(randomScene.id);
    setAmbienceMode(randomAmbience);
    setTiltVal(randomTilt);
    applyGalleryTiltDegree(randomTilt);

    const merged = {
      ...randomScene.config,
      "gallery.tilt_degree": randomTilt,
    };
    handleApplyScene({ ...randomScene, ambience: randomAmbience, config: merged });
    showToast("🎲 灵感一掷：已随机生成一套全新画廊意境搭配！");
  };

  // 复制当前搭配链接 (参考网站 "复制这一双的链接" 机制)
  const handleCopyShareLink = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("scene", activeSceneId);
    url.searchParams.set("ambience", ambienceMode);
    url.searchParams.set("tilt", tiltVal.toFixed(1));
    url.searchParams.set("variant", activeVariant);
    url.searchParams.set("nav", activeHeaderLayout);

    navigator.clipboard.writeText(url.toString());
    showToast("🔗 当前画廊搭配链接已复制，发给朋友可直接还原这套效果！");
  };

  // 还原默认
  const handleResetDefault = () => {
    const defaultScene = SCENE_PRESETS[0];
    handleApplyScene(defaultScene);
    showToast("🧹 已恢复为初始和风画廊默认设计。");
  };

  // 快捷键监听 (参考网站快捷键 R/P/F/Space/0/C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 当处于输入框或按下修饰键时不拦截
      if (
        ["input", "textarea", "select"].includes((e.target as HTMLElement)?.tagName?.toLowerCase()) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handleRandomRoll();
      } else if (e.key === "r" || e.key === "R") {
        setAmbienceMode((prev) => (prev === "rain" ? "none" : "rain"));
      } else if (e.key === "p" || e.key === "P") {
        setAmbienceMode((prev) => (prev === "sakura" ? "none" : "sakura"));
      } else if (e.key === "f" || e.key === "F") {
        setAmbienceMode((prev) => (prev === "fireflies" ? "none" : "fireflies"));
      } else if (e.key === "0") {
        handleResetDefault();
      } else if (e.key === "c" || e.key === "C") {
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSceneId, ambienceMode, tiltVal, activeVariant, activeHeaderLayout]);

  const handleSelectAmbience = (mode: AmbienceMode) => {
    setAmbienceMode(mode);
    try {
      localStorage.setItem("rin_ambience_mode", mode);
    } catch {}
  };

  const handleChangeTilt = (val: number) => {
    setTiltVal(val);
    applyGalleryTiltDegree(val);
    void persistConfig({ "gallery.tilt_degree": val });
  };

  const handleChangeGap = (val: number) => {
    setGapVal(val);
    void persistConfig({ "gallery.card_gap": val });
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

  const handleSaveCustomWallpaper = () => {
    applyThemeWallpaper(wallpaperUrlVal, wallpaperOpacityVal);
    void persistConfig({
      "theme.wallpaper": wallpaperUrlVal.trim(),
      "theme.wallpaper_opacity": wallpaperOpacityVal,
    });
  };

  const handleBookmarkCurrentWallpaper = () => {
    if (!wallpaperUrlVal || wallpaperUrlVal === "none") return;
    const name = prompt("请输入此壁纸预设的名称（如: 晨光微曦）", `自定义壁纸 #${savedWallpapers.length + 1}`);
    if (!name) return;

    const newItem = { id: `wp_${Date.now()}`, name: name.trim(), url: wallpaperUrlVal.trim() };
    const updated = [newItem, ...savedWallpapers];
    setSavedWallpapers(updated);
    try {
      localStorage.setItem("rin_saved_custom_wallpapers", JSON.stringify(updated));
    } catch {}
    showToast("✓ 壁纸已保存至个人收藏库！");
  };

  const handleToggleThemeMode = () => {
    const current = getStoredThemeMode();
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    setThemeMode(next);
  };

  const handleToggleCursor = () => {
    const next = !customCursorVal;
    setCustomCursorVal(next);
    applyThemeCustomCursor(next);
    void persistConfig({ "theme.custom_cursor": next });
  };

  const handleToggleReadingProgress = () => {
    const next = !readingProgressVal;
    setReadingProgressVal(next);
    void persistConfig({ "theme.reading_progress": next });
  };

  const handleDeleteSavedWallpaper = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedWallpapers.filter((w) => w.id !== id);
    setSavedWallpapers(updated);
    try {
      localStorage.setItem("rin_saved_custom_wallpapers", JSON.stringify(updated));
    } catch {}
  };

  return createPortal(
    <>
      {/* 0. 粒子特效画布：雨丝 / 落樱 / 萤火星尘 (在画布底层轻量流淌，不抢焦点) */}
      <AmbientEffectsCanvas mode={ambienceMode} />

      {/* 1. 左侧快操坞 (Quick Action Rail - 参考站同款悬浮纵向胶囊) */}
      <aside
        aria-label="画廊快速意境坞"
        className="fixed left-5 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-2 p-1.5 rounded-full border border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl shadow-lg select-none"
      >
        {/* 雨丝天气 */}
        <button
          type="button"
          onClick={() => handleSelectAmbience(ambienceMode === "rain" ? "none" : "rain")}
          className={`group relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-xs font-semibold transition-all cursor-pointer ${
            ambienceMode === "rain"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-md scale-105"
              : "text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          title="细雨夜雨 (快捷键 R)"
        >
          <span className="absolute -top-1 -right-1 font-mono text-[9px] px-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 scale-90">
            R
          </span>
          <i className="ri-rainy-line text-sm" />
          <span className="text-[9px] scale-90">夜雨</span>
        </button>

        {/* 樱落飞花 */}
        <button
          type="button"
          onClick={() => handleSelectAmbience(ambienceMode === "sakura" ? "none" : "sakura")}
          className={`group relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-xs font-semibold transition-all cursor-pointer ${
            ambienceMode === "sakura"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-md scale-105"
              : "text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          title="落樱飞舞 (快捷键 P)"
        >
          <span className="absolute -top-1 -right-1 font-mono text-[9px] px-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 scale-90">
            P
          </span>
          <i className="ri-sparkling-2-line text-sm" />
          <span className="text-[9px] scale-90">落樱</span>
        </button>

        {/* 星尘萤火 */}
        <button
          type="button"
          onClick={() => handleSelectAmbience(ambienceMode === "fireflies" ? "none" : "fireflies")}
          className={`group relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-xs font-semibold transition-all cursor-pointer ${
            ambienceMode === "fireflies"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-md scale-105"
              : "text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          title="萤火星尘 (快捷键 F)"
        >
          <span className="absolute -top-1 -right-1 font-mono text-[9px] px-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 scale-90">
            F
          </span>
          <i className="ri-planet-line text-sm" />
          <span className="text-[9px] scale-90">星尘</span>
        </button>

        <div className="w-5 h-px bg-black/10 dark:bg-white/10 my-0.5" />

        {/* 灵感一掷 (随机一式，空格键触发) */}
        <button
          type="button"
          onClick={handleRandomRoll}
          className="group relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 shadow-xs transition-all active:scale-90 cursor-pointer"
          title="灵感一掷 · 随机搭配一式 (快捷键 空格)"
        >
          <span className="absolute -top-1 -right-1 font-mono text-[8px] px-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 scale-75">
            SPC
          </span>
          <i className="ri-dice-line text-sm group-hover:rotate-45 transition-transform" />
          <span className="text-[9px] scale-90">灵感</span>
        </button>

        {/* 复位 */}
        <button
          type="button"
          onClick={handleResetDefault}
          className="group relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
          title="复位默认设定 (快捷键 0)"
        >
          <span className="absolute -top-1 -right-1 font-mono text-[8px] px-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 scale-75">
            0
          </span>
          <i className="ri-restart-line text-sm" />
          <span className="text-[9px] scale-90">复位</span>
        </button>

        {/* 展开/收起模块化实验室面板 */}
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          className={`group relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-xs font-semibold transition-all cursor-pointer ${
            isOpen
              ? "bg-theme text-white shadow-md scale-105"
              : "text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          title="打开/关闭画廊装配实验室 (快捷键 C)"
        >
          <span className="absolute -top-1 -right-1 font-mono text-[8px] px-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 scale-75">
            C
          </span>
          <i className="ri-sound-module-line text-sm" />
          <span className="text-[9px] scale-90">工坊</span>
        </button>
      </aside>

      {/* 移动端左下角唤起微纽 */}
      <div className="fixed bottom-6 left-6 z-40 md:hidden select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 shadow-md backdrop-blur-xl text-neutral-700 dark:text-neutral-200 active:scale-95 transition cursor-pointer"
          title="画廊随想实验室"
        >
          <i className="ri-palette-line text-lg text-theme" />
        </button>
      </div>

      {/* 2. 遮罩 (仅在移动端开启) */}
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {/* 3. 右侧模块化实验室面板 (参考站同款悬浮双层工作大盘) */}
      {isOpen && (
        <div className="fixed right-4 sm:right-6 top-18 bottom-6 z-50 w-[92vw] sm:w-[380px] max-w-[420px] flex flex-col gap-3 pointer-events-auto select-none font-sans ani-show overflow-hidden">
          {/* 上层卡片：场景/意境卡片 (Scene Picker) */}
          <div className="p-3.5 rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#12161f]/90 backdrop-blur-2xl shadow-xl space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase flex items-center gap-1.5">
                <i className="ri-landscape-line text-neutral-400" />
                <span>场景氛围预设</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SCENE_PRESETS.map((scene) => {
                const isCurrent = activeSceneId === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => handleApplyScene(scene)}
                    className={`group relative flex flex-col p-2.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                      isCurrent
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 shadow-md ring-1 ring-neutral-900/10 dark:ring-white/20"
                        : "border-neutral-200/70 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/60 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-lg text-xs ${
                            isCurrent
                              ? "bg-white/20 text-white dark:bg-neutral-900/10 dark:text-neutral-950"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 group-hover:text-theme"
                          }`}
                        >
                          <i className={scene.icon} />
                        </span>
                        <span className="font-bold text-xs">{scene.name}</span>
                      </div>
                      {isCurrent && (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white text-[8px] shadow-2xs">
                          <i className="ri-check-line font-bold" />
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[9px] line-clamp-1 ${
                        isCurrent ? "opacity-80" : "text-neutral-400"
                      }`}
                    >
                      {scene.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 下层卡片：多维度自由搭配实验室 (Modular Deep Customizer) */}
          <div className="flex-1 flex flex-col rounded-3xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#12161f]/90 backdrop-blur-2xl shadow-xl overflow-hidden">
            {/* 多标签切换头 */}
            <div className="px-3 pt-3 pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0 text-xs">
              {[
                { id: "ambience", label: "意境粒子", icon: "ri-sparkling-line" },
                { id: "card", label: "卡片布局", icon: "ri-layout-grid-line" },
                { id: "slider", label: "倾角间距", icon: "ri-equalizer-line" },
                { id: "wallpaper", label: "背景画布", icon: "ri-image-line" },
                { id: "color", label: "微光色彩", icon: "ri-palette-line" },
                { id: "interaction", label: "光标体验", icon: "ri-cursor-line" },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-2.5 py-1 rounded-xl font-medium transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold shadow-2xs"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <i className={tab.icon} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 实验室可滚动交互区 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* 1. 意境粒子 Tab */}
              {activeTab === "ambience" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-neutral-500">画布天气与氛围粒子</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "none", label: "纯净静止", icon: "ri-forbid-line" },
                        { id: "rain", label: "雨丝夜雨", icon: "ri-rainy-line" },
                        { id: "sakura", label: "落樱飞花", icon: "ri-sparkling-2-line" },
                        { id: "fireflies", label: "星尘萤火", icon: "ri-planet-line" },
                      ].map((item) => {
                        const isSelected = ambienceMode === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectAmbience(item.id as AmbienceMode)}
                            className={`p-2 rounded-xl border flex items-center gap-2 transition cursor-pointer ${
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-xs"
                                : "border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            <i className={item.icon} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10px] text-neutral-400 leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                    💡 提示：按键盘 <kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">R</kbd> 降下雨丝，<kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">P</kbd> 落樱，<kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">F</kbd> 萤火，<kbd className="font-mono px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">Space</kbd> 灵感一掷。
                  </p>
                </div>
              )}

              {/* 2. 卡片布局 Tab */}
              {activeTab === "card" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-neutral-500">画廊文章卡片变体</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CARD_VARIANTS.map((v) => {
                        const isSelected = activeVariant === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => persistConfig({ "feed.card_variant": v.id })}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 font-bold shadow-xs"
                                : "border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              <i className={v.icon} />
                              <span>{v.label}</span>
                            </div>
                            <span className="text-[9px] opacity-70 block truncate mt-0.5">{v.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
                    <label className="text-[11px] font-semibold text-neutral-500">顶栏导航风格 (嵌入画布)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "classic", label: "浮墨微光" },
                        { id: "compact", label: "京都社论" },
                        { id: "dock", label: "手账托盘" },
                      ].map((hl) => {
                        const isSelected = activeHeaderLayout === hl.id;
                        return (
                          <button
                            key={hl.id}
                            type="button"
                            onClick={() => persistConfig({ "header.layout": hl.id })}
                            className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold transition text-center cursor-pointer ${
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 shadow-xs"
                                : "border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-900/60 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            {hl.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. 倾角间距 Tab */}
              {activeTab === "slider" && (
                <div className="space-y-4">
                  {/* 拍立得倾角滑块 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        拍立得手账错落倾斜度
                      </span>
                      <span className="font-mono font-bold text-[11px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
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
                      <span className="font-mono font-bold text-[11px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
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
              )}

              {/* 4. 背景画布 Tab */}
              {activeTab === "wallpaper" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-neutral-500">轻量意境背景 (CSS渲染)</label>
                      <button
                        type="button"
                        onClick={() => handleSelectWallpaperPreset("none")}
                        className="text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 underline"
                      >
                        留空清空
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {WALLPAPER_PRESETS.map((wp) => {
                        const isSelected =
                          (wp.url === "none" && (!wallpaperUrlVal || wallpaperUrlVal === "none")) ||
                          wallpaperUrlVal === wp.url;
                        return (
                          <button
                            key={wp.id}
                            type="button"
                            onClick={() => handleSelectWallpaperPreset(wp.url)}
                            className={`px-2 py-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-2 transition cursor-pointer ${
                              isSelected
                                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950 shadow-xs font-bold"
                                : "border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-800/70 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            <span className={`h-3 w-3 rounded-full border border-black/10 shrink-0 ${wp.previewBg}`} />
                            <span className="truncate">{wp.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 收藏的壁纸 */}
                  {savedWallpapers.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
                      <label className="text-[10px] text-neutral-400">已收藏的个性壁纸</label>
                      <div className="flex flex-wrap gap-1">
                        {savedWallpapers.map((sw) => (
                          <span
                            key={sw.id}
                            onClick={() => handleSelectWallpaperPreset(sw.url)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer border ${
                              wallpaperUrlVal === sw.url
                                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900"
                                : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800"
                            }`}
                          >
                            <span>{sw.name}</span>
                            <i
                              className="ri-close-line text-xs opacity-60 hover:opacity-100 hover:text-rose-500"
                              onClick={(e) => handleDeleteSavedWallpaper(sw.id, e)}
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 自定义输入与收藏 */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>自定义图片直链 / 渐变代码</span>
                      <button
                        type="button"
                        onClick={handleBookmarkCurrentWallpaper}
                        className="text-theme hover:underline font-semibold flex items-center gap-0.5 cursor-pointer text-[10px]"
                      >
                        <i className="ri-bookmark-line" />
                        <span>收藏当前</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={wallpaperUrlVal}
                        onChange={(e) => setWallpaperUrlVal(e.target.value)}
                        placeholder="https://... 或 radial-gradient(...)"
                        className="flex-1 px-2.5 py-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-[11px] font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomWallpaper}
                        className="px-2.5 py-1 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold text-[10px] shrink-0"
                      >
                        应用
                      </button>
                    </div>
                  </div>

                  {/* 半透度显影滑块 */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500">背景显影强度 (Opacity)</span>
                      <span className="font-mono font-bold text-[11px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
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
              )}

              {/* 5. 色彩光照 Tab */}
              {activeTab === "color" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-neutral-500">核心主题微光色</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {CURATED_PRESETS.map((p) => {
                        const isSelected = activeColor.toLowerCase() === p.color.toLowerCase();
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              applyThemeColor(p.color);
                              void persistConfig({ "theme.color": p.color, "theme.preset": "custom" });
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition cursor-pointer ${
                              isSelected
                                ? "border-neutral-900 dark:border-white ring-2 ring-neutral-900/10 dark:ring-white/20 bg-neutral-100 dark:bg-neutral-800"
                                : "border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-900/60"
                            }`}
                          >
                            <span
                              className="h-5 w-5 rounded-full shadow-2xs"
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

                  <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">日夜光照模式</p>
                      <p className="text-[10px] text-neutral-400">切换全站深浅对比</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleThemeMode}
                      className="px-3 py-1 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:border-neutral-400 transition"
                    >
                      <i className="ri-sun-line text-amber-500 mr-1" />
                      <span>明暗切换</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 6. 光标与阅读交互 Tab */}
              {activeTab === "interaction" && (
                <div className="space-y-3">
                  {/* 二次元定制光标开关 */}
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-900/60">
                    <div>
                      <p className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">二次元定制鼠标指针</p>
                      <p className="text-[10px] text-neutral-400">可爱动漫小箭头与点击手势指针</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={customCursorVal}
                      onClick={handleToggleCursor}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        customCursorVal ? "bg-neutral-900 dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full ${customCursorVal ? "bg-white dark:bg-neutral-900" : "bg-white"} shadow-xs transition transform mt-1 ${
                          customCursorVal ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* 顶端极光阅读进度条开关 */}
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-900/60">
                    <div>
                      <p className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">顶端极光阅读进度条</p>
                      <p className="text-[10px] text-neutral-400">滚动下拉时全站顶端渐变进度随动</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={readingProgressVal}
                      onClick={handleToggleReadingProgress}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        readingProgressVal ? "bg-neutral-900 dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full ${readingProgressVal ? "bg-white dark:bg-neutral-900" : "bg-white"} shadow-xs transition transform mt-1 ${
                          readingProgressVal ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 实验室底部功能工具条 (灵感一掷 + 复制搭配链接 + 还原默认) */}
            <div className="p-3 border-t border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-50/80 dark:bg-neutral-900/80 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRandomRoll}
                className="flex-1 py-2 px-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition cursor-pointer"
                title="随机搭配一式 (空格键)"
              >
                <i className="ri-dice-line text-sm" />
                <span>灵感一掷</span>
              </button>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 text-neutral-700 dark:text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1 hover:border-neutral-400 active:scale-95 transition cursor-pointer"
                title="复制当前搭配的专属链接分享给他人"
              >
                <i className="ri-share-line text-sm text-theme" />
                <span>分享搭配</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefault}
                className="h-8 w-8 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center justify-center hover:border-neutral-400 transition cursor-pointer"
                title="还原默认设置"
              >
                <i className="ri-restart-line text-xs" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 浮动 Toast 气泡 */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-950 text-xs font-semibold shadow-2xl backdrop-blur-md ani-show select-none pointer-events-none flex items-center gap-2">
          <i className="ri-sparkling-fill text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>,
    document.body
  );
}
