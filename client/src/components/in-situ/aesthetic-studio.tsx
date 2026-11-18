import { useState, useEffect, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { ProfileContext } from "../../state/profile";
import { client } from "../../app/runtime";
import {
  MULTI_COLOR_PALETTES,
  applyThemeColor,
  applyThemePalette,
  applyThemeOpacity,
  applyThemeFontFamily,
  applyThemeWallpaper,
  applyThemeCustomCursor,
  applyGalleryTiltDegree,
  type MultiColorPalette,
} from "../../utils/theme-color";
import { getStoredThemeMode, setThemeMode, useColorMode, type ThemeMode } from "../../utils/darkModeUtils";
import type { FeedCardVariant } from "../feed-card-options";
import { AmbientEffectsCanvas, type AmbienceMode } from "../ambient-effects-canvas";

export interface WallpaperPreset {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  previewStyle: React.CSSProperties;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "none",
    name: "纯色留白",
    subtitle: "干净无纹理背景",
    url: "none",
    previewStyle: { background: "#f8fafc" },
  },
  {
    id: "sakura-glow",
    name: "樱桃柔光",
    subtitle: "粉橘暖调渐变",
    url: "radial-gradient(ellipse 80% 55% at 20% 0%, rgba(232, 74, 114, 0.22), transparent 65%), radial-gradient(ellipse 65% 50% at 85% 15%, rgba(245, 158, 108, 0.22), transparent 65%)",
    previewStyle: { background: "linear-gradient(135deg, #ffe4ec 0%, #fff1e6 55%, #ffffff 100%)" },
  },
  {
    id: "starry-nebula",
    name: "暮光星云",
    subtitle: "靛紫冷调氛围",
    url: "radial-gradient(ellipse 80% 50% at 25% 0%, rgba(79, 70, 229, 0.22), transparent 68%), radial-gradient(circle 540px at 85% 15%, rgba(168, 85, 247, 0.2), transparent 60%)",
    previewStyle: { background: "linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 60%, #f8fafc 100%)" },
  },
  {
    id: "washi-dots",
    name: "手账点阵",
    subtitle: "极细纸面网格点",
    url: "radial-gradient(rgba(100, 116, 139, 0.26) 1px, transparent 1px)",
    previewStyle: {
      backgroundColor: "#f8fafc",
      backgroundImage: "radial-gradient(rgba(100, 116, 139, 0.35) 1px, transparent 1px)",
      backgroundSize: "8px 8px",
    },
  },
  {
    id: "morning-mist",
    name: "海盐青岚",
    subtitle: "晴蓝薄荷呼吸感",
    url: "radial-gradient(ellipse 80% 55% at 15% 0%, rgba(2, 132, 199, 0.18), transparent 68%), radial-gradient(circle 520px at 88% 20%, rgba(20, 184, 166, 0.18), transparent 60%)",
    previewStyle: { background: "linear-gradient(135deg, #e0f2fe 0%, #ccfbf1 55%, #ffffff 100%)" },
  },
];

interface ScenePreset {
  id: "polaroid" | "magazine" | "exhibition" | "compact";
  name: string;
  subtitle: string;
  variant: FeedCardVariant;
  ambience: AmbienceMode;
  paletteId: string;
  colors: [string, string];
  config: Record<string, unknown>;
}

const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "polaroid",
    name: "拍立得瀑布流",
    subtitle: "多列错落照片墙 · 胶带微倾",
    variant: "default",
    ambience: "sakura",
    paletteId: "cherry_peach",
    colors: ["#e84a72", "#f59e6c"],
    config: {
      "feed.card_variant": "default",
      "header.position": "top",
      "header.layout": "classic",
      "theme.font_family": "sans",
      "theme.preset": "cherry_peach",
      "theme.color": "#e84a72",
      "theme.secondary_color": "#f59e6c",
      "gallery.tilt_degree": 1.8,
      "gallery.columns": "auto",
      "gallery.card_gap": 24,
      "theme.opacity": 100,
      "theme.wallpaper": WALLPAPER_PRESETS[1].url,
      "theme.wallpaper_opacity": 45,
    },
  },
  {
    id: "magazine",
    name: "图文双栏杂志",
    subtitle: "单列左文右图 · 衬线阅读感",
    variant: "editorial",
    ambience: "rain",
    paletteId: "kyoto_ink",
    colors: ["#334155", "#c2410c"],
    config: {
      "feed.card_variant": "editorial",
      "header.position": "top",
      "header.layout": "compact",
      "theme.font_family": "serif",
      "theme.preset": "kyoto_ink",
      "theme.color": "#334155",
      "theme.secondary_color": "#c2410c",
      "gallery.tilt_degree": 0,
      "gallery.columns": "auto",
      "gallery.card_gap": 20,
      "theme.opacity": 100,
      "theme.wallpaper": WALLPAPER_PRESETS[3].url,
      "theme.wallpaper_opacity": 35,
    },
  },
  {
    id: "exhibition",
    name: "全幅沉浸画册",
    subtitle: "无白边大图展墙 · 底部铭牌",
    variant: "poster",
    ambience: "fireflies",
    paletteId: "twilight_nebula",
    colors: ["#4f46e5", "#a855f7"],
    config: {
      "feed.card_variant": "poster",
      "header.position": "top",
      "header.layout": "dock",
      "theme.font_family": "sans",
      "theme.preset": "twilight_nebula",
      "theme.color": "#4f46e5",
      "theme.secondary_color": "#a855f7",
      "gallery.tilt_degree": 0,
      "gallery.columns": "auto",
      "gallery.card_gap": 20,
      "theme.opacity": 96,
      "theme.wallpaper": WALLPAPER_PRESETS[2].url,
      "theme.wallpaper_opacity": 45,
    },
  },
  {
    id: "compact",
    name: "紧凑文章列表",
    subtitle: "单行高密目录 · 极速扫读",
    variant: "compact",
    ambience: "none",
    paletteId: "sea_salt",
    colors: ["#0284c7", "#14b8a6"],
    config: {
      "feed.card_variant": "compact",
      "header.position": "top",
      "header.layout": "compact",
      "theme.font_family": "sans",
      "theme.preset": "sea_salt",
      "theme.color": "#0284c7",
      "theme.secondary_color": "#14b8a6",
      "gallery.tilt_degree": 0,
      "gallery.columns": "auto",
      "gallery.card_gap": 12,
      "theme.opacity": 100,
      "theme.wallpaper": "none",
      "theme.wallpaper_opacity": 0,
    },
  },
];

const CARD_VARIANTS: Array<{ id: FeedCardVariant; label: string; desc: string }> = [
  { id: "default", label: "拍立得瀑布流", desc: "保留原图比例 · 纸胶带微倾" },
  { id: "editorial", label: "图文双栏杂志", desc: "左文右图 6:4 · 细线分隔" },
  { id: "poster", label: "全幅沉浸画册", desc: "无边框满幅展墙 · 磨砂铭牌" },
  { id: "compact", label: "紧凑文章列表", desc: "单行日期标题 · 高密扫读" },
];

const HEADER_STYLES = [
  { id: "classic", label: "居中自然导航", desc: "标题居中无边框" },
  { id: "compact", label: "杂志左对齐", desc: "极简左标题右菜单" },
  { id: "dock", label: "居中胶囊托盘", desc: "居中轻底色导航槽" },
];

const AMBIENCE_OPTIONS: Array<{ id: AmbienceMode; label: string; desc: string; icon: string; shortcut?: string }> = [
  { id: "none", label: "关闭粒子", desc: "保持页面完全静止清爽", icon: "ri-forbid-line" },
  { id: "rain", label: "细雨氛围", desc: "斜落雨丝与底部微弱涟漪", icon: "ri-rainy-line", shortcut: "R" },
  { id: "sakura", label: "飘落樱花", desc: "柔和翻转飘散的花瓣粒子", icon: "ri-flower-line", shortcut: "P" },
  { id: "fireflies", label: "漂浮萤火", desc: "呼吸闪烁的暖光与青蓝微尘", icon: "ri-sparkling-2-line", shortcut: "F" },
];

type DrawerTabId =
  | "style"
  | "palette"
  | "ambience"
  | "backdrop"
  | "detail"
  | "site"
  | "security"
  | "ai"
  | "storage";

const TAB_META: Record<DrawerTabId, { title: string; subtitle: string; icon: string; short: string }> = {
  style: { title: "整站风格与版式", subtitle: "切换页面排版结构与顶栏形态", icon: "ri-layout-masonry-line", short: "风格" },
  palette: { title: "多色主题配色", subtitle: "三色联动方案与明暗外观", icon: "ri-palette-line", short: "配色" },
  ambience: { title: "画布粒子氛围", subtitle: "明暗模式自适应的动态粒子层", icon: "ri-sparkling-line", short: "粒子" },
  backdrop: { title: "背景画布纹理", subtitle: "纯 CSS 轻渐变、点阵或自定义图", icon: "ri-image-2-line", short: "背景" },
  detail: { title: "排版与交互细节", subtitle: "倾角、间距、字体与阅读辅助", icon: "ri-equalizer-line", short: "细节" },
  site: { title: "站点基础信息", subtitle: "修改站名、简介、头像与分页数", icon: "ri-global-line", short: "站点" },
  security: { title: "功能开关与安全", subtitle: "统一管理前台模块开关与访问策略", icon: "ri-shield-check-line", short: "开关" },
  ai: { title: "AI 模型与密钥", subtitle: "配置自动摘要服务商与端点参数", icon: "ri-cpu-line", short: "AI" },
  storage: { title: "存储与接口", subtitle: "OpenList 代理、图床直传 Token", icon: "ri-hard-drive-2-line", short: "存储" },
};

function DrawerSwitch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        checked ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

/** 微缩版式线框图：让用户一眼看懂 4 套风格的结构差异 */
function StyleWireframe({ variant }: { variant: FeedCardVariant }) {
  if (variant === "editorial") {
    return (
      <div className="h-11 w-full rounded-lg bg-neutral-100/90 dark:bg-white/[0.04] p-1.5 flex flex-col justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-1">
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-4/5 rounded bg-neutral-400/60" />
            <div className="h-1 w-full rounded bg-neutral-300/60 dark:bg-neutral-600/60" />
          </div>
          <div className="h-3.5 w-6 rounded bg-theme/35 shrink-0" />
        </div>
        <div className="h-px w-full bg-neutral-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5 flex-1">
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-3/4 rounded bg-neutral-400/60" />
            <div className="h-1 w-5/6 rounded bg-neutral-300/60 dark:bg-neutral-600/60" />
          </div>
          <div className="h-3.5 w-6 rounded bg-theme-secondary/35 shrink-0" />
        </div>
      </div>
    );
  }
  if (variant === "poster") {
    return (
      <div className="h-11 w-full rounded-lg bg-neutral-100/90 dark:bg-white/[0.04] p-1.5 grid grid-cols-2 gap-1.5">
        <div className="rounded bg-gradient-to-br from-theme/45 to-theme-secondary/45 relative overflow-hidden">
          <div className="absolute inset-x-1 bottom-1 h-2 rounded-xs bg-black/35" />
        </div>
        <div className="rounded bg-gradient-to-br from-theme-secondary/40 to-theme/35 relative overflow-hidden">
          <div className="absolute inset-x-1 bottom-1 h-2 rounded-xs bg-black/35" />
        </div>
      </div>
    );
  }
  if (variant === "compact") {
    return (
      <div className="h-11 w-full rounded-lg bg-neutral-100/90 dark:bg-white/[0.04] p-1.5 flex flex-col justify-between">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="h-1.5 w-2/3 rounded bg-neutral-400/55" />
            <div className="h-1 w-5 rounded bg-theme/40" />
          </div>
        ))}
      </div>
    );
  }
  // default: polaroid masonry
  return (
    <div className="h-11 w-full rounded-lg bg-neutral-100/90 dark:bg-white/[0.04] p-1.5 grid grid-cols-3 gap-1">
      <div className="rounded bg-white dark:bg-neutral-800 p-0.5 flex flex-col gap-0.5 -rotate-2 shadow-2xs">
        <div className="flex-1 rounded-xs bg-theme/30" />
        <div className="h-1 w-2/3 rounded bg-neutral-300 dark:bg-neutral-600" />
      </div>
      <div className="rounded bg-white dark:bg-neutral-800 p-0.5 flex flex-col gap-0.5 rotate-2 shadow-2xs">
        <div className="flex-1 rounded-xs bg-theme-secondary/35" />
        <div className="h-1 w-1/2 rounded bg-neutral-300 dark:bg-neutral-600" />
      </div>
      <div className="rounded bg-white dark:bg-neutral-800 p-0.5 flex flex-col gap-0.5 -rotate-1 shadow-2xs">
        <div className="flex-1 rounded-xs bg-theme/25" />
        <div className="h-1 w-3/4 rounded bg-neutral-300 dark:bg-neutral-600" />
      </div>
    </div>
  );
}

export function InSituAestheticStudio() {
  // =========================================================================
  // REACT HOOKS 铁律：所有 Hooks 无条件置于组件最顶层，严禁放在提前 return 之后
  // =========================================================================
  const [location] = useLocation();
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const colorMode = useColorMode();
  const isAdmin = Boolean(profile?.permission);
  const isAdminRoute = location.startsWith("/admin");

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTabId>("style");

  const [ambienceMode, setAmbienceMode] = useState<AmbienceMode>(() => {
    try {
      const saved = localStorage.getItem("rin_ambience_mode");
      if (saved && ["none", "rain", "sakura", "fireflies"].includes(saved)) {
        return saved as AmbienceMode;
      }
    } catch {}
    return "sakura";
  });

  const [activeSceneId, setActiveSceneId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("rin_active_scene_id");
      if (saved) return saved;
    } catch {}
    return "polaroid";
  });

  const [tiltVal, setTiltVal] = useState(siteConfig.galleryTiltDegree ?? 1.8);
  const [gapVal, setGapVal] = useState(siteConfig.galleryCardGap ?? 24);
  const [fontFamilyVal, setFontFamilyVal] = useState<string>("sans");
  const [wallpaperUrlVal, setWallpaperUrlVal] = useState(siteConfig.themeWallpaper || "none");
  const [wallpaperOpacityVal, setWallpaperOpacityVal] = useState(siteConfig.themeWallpaperOpacity ?? 35);
  const [customCursorVal, setCustomCursorVal] = useState(siteConfig.themeCustomCursor !== false);
  const [readingProgressVal, setReadingProgressVal] = useState(siteConfig.themeReadingProgress !== false);

  // 管理员配置状态（按需懒加载）
  const [adminClientCfg, setAdminClientCfg] = useState<Record<string, any>>({});
  const [adminServerCfg, setAdminServerCfg] = useState<Record<string, any>>({});
  const [adminCfgLoaded, setAdminCfgLoaded] = useState(false);
  const [adminCfgLoading, setAdminCfgLoading] = useState(false);

  const [savedWallpapers, setSavedWallpapers] = useState<Array<{ id: string; name: string; url: string }>>(() => {
    try {
      const list = localStorage.getItem("rin_saved_custom_wallpapers");
      if (list) return JSON.parse(list);
    } catch {}
    return [];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  }, []);

  const persistConfig = useCallback(async (updates: Record<string, unknown>) => {
    try {
      const cached = sessionStorage.getItem("config");
      const parsed = cached ? JSON.parse(cached) : {};
      const next = { ...parsed, ...updates };
      sessionStorage.setItem("config", JSON.stringify(next));
      window.dispatchEvent(new Event("rin:config-updated"));
      await client.config.update("client", updates);
    } catch (err) {
      console.error("Failed to persist config:", err);
    }
  }, []);

  const persistServerConfig = useCallback(
    async (updates: Record<string, unknown>) => {
      try {
        await client.config.update("server", updates);
        setAdminServerCfg((prev) => ({ ...prev, ...updates }));
        showToast("服务端配置已保存");
      } catch (err: any) {
        showToast(`保存失败：${err?.message || "权限不足"}`);
      }
    },
    [showToast]
  );

  // 兼容外部事件触发统一抽屉（如原“百宝箱”事件）
  useEffect(() => {
    const handleOpenSettingsDrawer = () => {
      setActiveTab(isAdmin ? "site" : "style");
      setIsOpen(true);
    };
    window.addEventListener("rin:open-settings-drawer", handleOpenSettingsDrawer);
    return () => window.removeEventListener("rin:open-settings-drawer", handleOpenSettingsDrawer);
  }, [isAdmin]);

  // 懒加载管理员站点/开关/安全/AI/存储配置
  useEffect(() => {
    const adminTabs: DrawerTabId[] = ["site", "security", "ai", "storage"];
    if (!isOpen || !isAdmin || adminCfgLoaded || !adminTabs.includes(activeTab)) return;

    setAdminCfgLoading(true);
    Promise.allSettled([client.config.get("client"), client.config.get("server")])
      .then(([cRes, sRes]) => {
        if (cRes.status === "fulfilled" && cRes.value.data) {
          setAdminClientCfg(cRes.value.data as Record<string, any>);
        }
        if (sRes.status === "fulfilled" && sRes.value.data) {
          setAdminServerCfg(sRes.value.data as Record<string, any>);
        }
        setAdminCfgLoaded(true);
      })
      .finally(() => setAdminCfgLoading(false));
  }, [isOpen, isAdmin, activeTab, adminCfgLoaded]);

  // 同步 siteConfig 到本地滑块与开关状态
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

  const handleSelectAmbience = useCallback((mode: AmbienceMode) => {
    setAmbienceMode(mode);
    try {
      localStorage.setItem("rin_ambience_mode", mode);
    } catch {}
  }, []);

  const handleApplyScene = useCallback(
    (scene: ScenePreset) => {
      setActiveSceneId(scene.id);
      setAmbienceMode(scene.ambience);
      try {
        localStorage.setItem("rin_active_scene_id", scene.id);
        localStorage.setItem("rin_ambience_mode", scene.ambience);
      } catch {}

      applyThemeColor(String(scene.config["theme.color"]), String(scene.config["theme.secondary_color"]));
      applyThemeOpacity(scene.config["theme.opacity"] ?? 100);
      applyThemeFontFamily(String(scene.config["theme.font_family"] ?? "sans"));
      setFontFamilyVal(String(scene.config["theme.font_family"] ?? "sans"));

      if (scene.config["gallery.tilt_degree"] !== undefined) {
        const deg = Number(scene.config["gallery.tilt_degree"]);
        applyGalleryTiltDegree(deg);
        setTiltVal(deg);
      }
      if (scene.config["gallery.card_gap"] !== undefined) {
        setGapVal(Number(scene.config["gallery.card_gap"]));
      }
      if (scene.config["theme.wallpaper"] !== undefined) {
        const wpUrl = String(scene.config["theme.wallpaper"]);
        const wpOp = Number(scene.config["theme.wallpaper_opacity"] ?? 35);
        setWallpaperUrlVal(wpUrl);
        setWallpaperOpacityVal(wpOp);
        applyThemeWallpaper(wpUrl, wpOp);
      }
      void persistConfig(scene.config);
      showToast(`已切换为「${scene.name}」`);
    },
    [persistConfig, showToast]
  );

  const handleRandomRoll = useCallback(() => {
    const nextScene = SCENE_PRESETS[Math.floor(Math.random() * SCENE_PRESETS.length)];
    const nextPalette = MULTI_COLOR_PALETTES[Math.floor(Math.random() * MULTI_COLOR_PALETTES.length)];
    const nextAmbience: AmbienceMode = (["none", "rain", "sakura", "fireflies"] as const)[
      Math.floor(Math.random() * 4)
    ];

    const mergedConfig = {
      ...nextScene.config,
      "theme.preset": nextPalette.id,
      "theme.color": nextPalette.primary,
      "theme.secondary_color": nextPalette.secondary,
    };

    handleApplyScene({
      ...nextScene,
      ambience: nextAmbience,
      paletteId: nextPalette.id,
      config: mergedConfig,
    });
    showToast(`随机搭配：${nextScene.name} + ${nextPalette.name}`);
  }, [handleApplyScene, showToast]);

  const handleResetDefault = useCallback(() => {
    handleApplyScene(SCENE_PRESETS[0]);
    showToast("已恢复默认风格");
  }, [handleApplyScene, showToast]);

  // 键盘快捷键（R/P/F/Space/C/ESC；在后台路由与输入态不拦截）
  useEffect(() => {
    if (isAdminRoute) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        return;
      }
      if (
        ["input", "textarea", "select"].includes((e.target as HTMLElement)?.tagName?.toLowerCase()) ||
        (e.target as HTMLElement)?.isContentEditable ||
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
        handleSelectAmbience(ambienceMode === "rain" ? "none" : "rain");
      } else if (e.key === "p" || e.key === "P") {
        handleSelectAmbience(ambienceMode === "sakura" ? "none" : "sakura");
      } else if (e.key === "f" || e.key === "F") {
        handleSelectAmbience(ambienceMode === "fireflies" ? "none" : "fireflies");
      } else if (e.key === "c" || e.key === "C") {
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdminRoute, isOpen, ambienceMode, handleRandomRoll, handleSelectAmbience]);

  // =========================================================================
  // EARLY RETURN 严格位于全部 Hooks 之后
  // =========================================================================
  if (isAdminRoute) {
    return null;
  }

  const activeVariant = siteConfig.feedCardVariant || "default";
  const activeColor = (siteConfig.themeColor || "#e84a72").toLowerCase();
  const activePresetId = siteConfig.themePreset || "";
  const activeHeaderLayout = siteConfig.headerLayout || "classic";

  const handleCycleAmbience = () => {
    const order: AmbienceMode[] = ["none", "rain", "sakura", "fireflies"];
    const next = order[(order.indexOf(ambienceMode) + 1) % order.length];
    handleSelectAmbience(next);
    const meta = AMBIENCE_OPTIONS.find((item) => item.id === next);
    if (meta) showToast(`粒子氛围：${meta.label}`);
  };

  const handleToggleThemeMode = () => {
    const current = getStoredThemeMode();
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    setThemeMode(next);
  };

  const handleSelectPalette = (palette: MultiColorPalette) => {
    applyThemePalette(palette);
    void persistConfig({
      "theme.preset": palette.id,
      "theme.color": palette.primary,
      "theme.secondary_color": palette.secondary,
    });
    showToast(`配色已切换：${palette.name}`);
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

  const handleChangeFont = (family: "sans" | "serif" | "mono") => {
    setFontFamilyVal(family);
    applyThemeFontFamily(family);
    void persistConfig({ "theme.font_family": family });
  };

  const handleSelectWallpaperPreset = (url: string) => {
    setWallpaperUrlVal(url);
    const nextOpacity = url === "none" ? 0 : Math.max(25, wallpaperOpacityVal || 40);
    setWallpaperOpacityVal(nextOpacity);
    applyThemeWallpaper(url, nextOpacity);
    void persistConfig({
      "theme.wallpaper": url,
      "theme.wallpaper_opacity": nextOpacity,
    });
  };

  const handleChangeWallpaperOpacity = (val: number) => {
    setWallpaperOpacityVal(val);
    applyThemeWallpaper(wallpaperUrlVal, val);
    void persistConfig({ "theme.wallpaper_opacity": val });
  };

  const handleSaveCustomWallpaper = () => {
    const nextOpacity = Math.max(20, wallpaperOpacityVal || 40);
    setWallpaperOpacityVal(nextOpacity);
    applyThemeWallpaper(wallpaperUrlVal, nextOpacity);
    void persistConfig({
      "theme.wallpaper": wallpaperUrlVal.trim(),
      "theme.wallpaper_opacity": nextOpacity,
    });
    showToast("自定义背景已应用");
  };

  const handleBookmarkCurrentWallpaper = () => {
    if (!wallpaperUrlVal || wallpaperUrlVal === "none") return;
    const name = prompt("为当前背景命名：", `背景收藏 #${savedWallpapers.length + 1}`);
    if (!name) return;
    const newItem = { id: `wp_${Date.now()}`, name: name.trim(), url: wallpaperUrlVal.trim() };
    const updated = [newItem, ...savedWallpapers];
    setSavedWallpapers(updated);
    try {
      localStorage.setItem("rin_saved_custom_wallpapers", JSON.stringify(updated));
    } catch {}
    showToast("背景已加入收藏");
  };

  const handleDeleteSavedWallpaper = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedWallpapers.filter((w) => w.id !== id);
    setSavedWallpapers(updated);
    try {
      localStorage.setItem("rin_saved_custom_wallpapers", JSON.stringify(updated));
    } catch {}
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

  const handleSaveAdminClientField = async (key: string, value: unknown) => {
    setAdminClientCfg((prev) => ({ ...prev, [key]: value }));
    await persistConfig({ [key]: value });
    showToast("配置已即时生效");
  };

  const currentAmbienceMeta = AMBIENCE_OPTIONS.find((item) => item.id === ambienceMode) || AMBIENCE_OPTIONS[0];
  const visitorTabs: DrawerTabId[] = ["style", "palette", "ambience", "backdrop", "detail"];
  const adminTabs: DrawerTabId[] = ["site", "security", "ai", "storage"];
  const activeTabMeta = TAB_META[activeTab];

  const isClientToggleOn = (key: string, defaultOn = true) => {
    const raw = adminClientCfg[key];
    if (raw === undefined) return defaultOn;
    return raw !== false && raw !== "false";
  };

  return createPortal(
    <>
      {/* 0. 全视口粒子画布 */}
      <AmbientEffectsCanvas mode={ambienceMode} />

      {/* 1. 左侧 44px 极简毛玻璃悬浮轨（干净克制、悬停浮出清晰提示胶囊） */}
      <aside
        aria-label="页面快捷外观栏"
        className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-1 w-11 p-1.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/85 dark:bg-[#131722]/85 backdrop-blur-md shadow-[0_8px_28px_-8px_rgba(15,23,42,0.14)] select-none"
      >
        {/* 粒子氛围循环快切 */}
        <button
          type="button"
          onClick={handleCycleAmbience}
          className={`group relative flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
            ambienceMode !== "none"
              ? "bg-theme/10 text-theme"
              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-800 dark:hover:text-neutral-100"
          }`}
          aria-label={`粒子氛围：${currentAmbienceMeta.label}`}
        >
          {ambienceMode !== "none" ? (
            <span className="absolute -left-1.5 top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-theme to-theme-secondary" />
          ) : null}
          <i className={`${currentAmbienceMeta.icon} text-[16px]`} />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 shadow-md opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all">
            {currentAmbienceMeta.label} · 点按切换
          </span>
        </button>

        {/* 明暗模式切换 */}
        <button
          type="button"
          onClick={handleToggleThemeMode}
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-800 dark:hover:text-neutral-100 transition-all cursor-pointer"
          aria-label="切换明暗外观"
        >
          <i className={colorMode === "dark" ? "ri-moon-clear-line text-[16px] text-theme-secondary" : "ri-sun-line text-[16px] text-amber-500"} />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 shadow-md opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all">
            {colorMode === "dark" ? "切换浅色模式" : "切换深色模式"}
          </span>
        </button>

        {/* 随机搭配 */}
        <button
          type="button"
          onClick={handleRandomRoll}
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-theme transition-all active:scale-90 cursor-pointer"
          aria-label="随机搭配风格"
        >
          <i className="ri-shuffle-line text-[16px]" />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 shadow-md opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all">
            随机搭配 · 空格
          </span>
        </button>

        <div className="my-0.5 h-px w-5 bg-neutral-200/80 dark:bg-white/10" />

        {/* 打开统一外观与设置抽屉 */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group relative flex h-8 w-8 items-center justify-center rounded-xl transition-all cursor-pointer ${
            isOpen
              ? "bg-gradient-to-tr from-theme to-theme-secondary text-white shadow-sm"
              : "text-neutral-600 dark:text-neutral-300 hover:bg-theme/10 hover:text-theme"
          }`}
          aria-label="打开外观与站点设置抽屉"
        >
          <i className="ri-equalizer-line text-[16px]" />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 shadow-md opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all">
            {isAdmin ? "外观与站点设置 · C" : "外观定制 · C"}
          </span>
        </button>
      </aside>

      {/* 移动端左下角唤起钮 */}
      <div className="fixed bottom-5 left-5 z-40 md:hidden select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-white/95 dark:bg-[#131722]/95 shadow-lg backdrop-blur-md text-theme active:scale-95 transition cursor-pointer"
          aria-label="打开外观与设置抽屉"
        >
          <i className="ri-equalizer-line text-lg" />
        </button>
      </div>

      {/* 2. 移动端轻遮罩（桌面端保留左侧主画布完全可看可滚，实现真侧滑抽屉） */}
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {/* 3. 420px 双栏现代侧滑真抽屉（左 56px 纵向图标轨 + 右 364px 紧凑内容区） */}
      {isOpen ? (
        <aside
          aria-label="前台外观与站点设置抽屉"
          className="fixed top-0 right-0 bottom-0 z-50 w-[94vw] sm:w-[420px] flex bg-white dark:bg-[#111520] border-l border-neutral-200/80 dark:border-white/10 shadow-[-12px_0_40px_-16px_rgba(15,23,42,0.18)] select-none ani-show-fast"
        >
          {/* 左侧 56px 垂直图标轨：彻底根绝横向 Tab 截断问题 */}
          <nav className="w-14 shrink-0 border-r border-neutral-200/75 dark:border-white/[0.08] bg-neutral-50/70 dark:bg-white/[0.02] flex flex-col items-center py-3 gap-1 overflow-y-auto scrollbar-none">
            {visitorTabs.map((tabId) => {
              const meta = TAB_META[tabId];
              const active = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className={`relative flex flex-col items-center justify-center w-11 py-1.5 rounded-xl transition-all cursor-pointer ${
                    active
                      ? "bg-theme/10 text-theme font-semibold"
                      : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-white/[0.05] hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  {active ? (
                    <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full bg-gradient-to-b from-theme to-theme-secondary" />
                  ) : null}
                  <i className={`${meta.icon} text-[16px]`} />
                  <span className="text-[10px] mt-0.5 leading-none">{meta.short}</span>
                </button>
              );
            })}

            {isAdmin ? (
              <>
                <div className="my-1.5 flex flex-col items-center gap-1 w-full px-2">
                  <div className="h-px w-full bg-neutral-200/80 dark:bg-white/10" />
                  <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500">管理</span>
                </div>
                {adminTabs.map((tabId) => {
                  const meta = TAB_META[tabId];
                  const active = activeTab === tabId;
                  return (
                    <button
                      key={tabId}
                      type="button"
                      onClick={() => setActiveTab(tabId)}
                      className={`relative flex flex-col items-center justify-center w-11 py-1.5 rounded-xl transition-all cursor-pointer ${
                        active
                          ? "bg-theme/12 text-theme font-semibold"
                          : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-white/[0.05] hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                    >
                      {active ? (
                        <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full bg-gradient-to-b from-theme to-theme-secondary" />
                      ) : null}
                      <i className={`${meta.icon} text-[16px]`} />
                      <span className="text-[10px] mt-0.5 leading-none">{meta.short}</span>
                    </button>
                  );
                })}
              </>
            ) : null}
          </nav>

          {/* 右侧主内容列 */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* 抽屉顶栏 */}
            <header className="px-4 py-3.5 border-b border-neutral-200/75 dark:border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h2 className="text-[13px] font-bold text-neutral-900 dark:text-neutral-100 truncate">
                  {activeTabMeta.title}
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                  {activeTabMeta.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition cursor-pointer shrink-0"
                title="关闭抽屉 (ESC)"
              >
                <i className="ri-close-line text-base" />
              </button>
            </header>

            {/* 抽屉滚动内容区 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
              {/* ============ 1. 风格与版式 ============ */}
              {activeTab === "style" ? (
                <>
                  <section className="space-y-2.5">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      一键切换整站风格
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {SCENE_PRESETS.map((scene) => {
                        const isCurrent = activeSceneId === scene.id && activeVariant === scene.variant;
                        return (
                          <button
                            key={scene.id}
                            type="button"
                            onClick={() => handleApplyScene(scene)}
                            className={`group flex flex-col gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isCurrent
                                ? "border-theme bg-theme/[0.06] ring-1 ring-theme/20"
                                : "border-neutral-200/80 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-theme/40"
                            }`}
                          >
                            <StyleWireframe variant={scene.variant} />
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`font-semibold text-xs truncate ${isCurrent ? "text-theme" : "text-neutral-800 dark:text-neutral-100"}`}>
                                  {scene.name}
                                </span>
                                <span className="flex items-center -space-x-1 shrink-0">
                                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white dark:ring-neutral-900" style={{ backgroundColor: scene.colors[0] }} />
                                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white dark:ring-neutral-900" style={{ backgroundColor: scene.colors[1] }} />
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                {scene.subtitle}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-2 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      单独调整文章列表结构
                    </div>
                    <div className="space-y-1.5">
                      {CARD_VARIANTS.map((v) => {
                        const isSelected = activeVariant === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => void persistConfig({ "feed.card_variant": v.id })}
                            className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                              isSelected
                                ? "border-theme bg-theme/[0.06] text-theme"
                                : "border-neutral-200/80 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 text-neutral-700 dark:text-neutral-200"
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-xs">{v.label}</div>
                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{v.desc}</div>
                            </div>
                            {isSelected ? <i className="ri-check-line text-theme text-sm font-bold" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-2 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      顶栏导航排布
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {HEADER_STYLES.map((hl) => {
                        const isSelected = activeHeaderLayout === hl.id;
                        return (
                          <button
                            key={hl.id}
                            type="button"
                            onClick={() => void persistConfig({ "header.layout": hl.id })}
                            className={`px-2 py-2 rounded-xl border text-center transition cursor-pointer ${
                              isSelected
                                ? "border-theme bg-theme/[0.08] text-theme font-semibold"
                                : "border-neutral-200/80 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-white/20"
                            }`}
                          >
                            <div className="text-[11px] leading-tight">{hl.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : null}

              {/* ============ 2. 多色主题配色 ============ */}
              {activeTab === "palette" ? (
                <>
                  <section className="space-y-2">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      外观明暗模式
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-neutral-100 dark:bg-white/[0.05]">
                      <button
                        type="button"
                        onClick={() => setThemeMode("light")}
                        className={`py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          colorMode !== "dark"
                            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs"
                            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                        }`}
                      >
                        <i className="ri-sun-line text-amber-500" />
                        <span>浅色模式</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setThemeMode("dark")}
                        className={`py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          colorMode === "dark"
                            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs"
                            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                        }`}
                      >
                        <i className="ri-moon-clear-line text-indigo-400" />
                        <span>深色模式</span>
                      </button>
                    </div>
                  </section>

                  <section className="space-y-2.5 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      多色联动色盘（主色 × 呼应色 × 柔和氛围）
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {MULTI_COLOR_PALETTES.map((p) => {
                        const isSelected = activePresetId === p.id || activeColor === p.primary.toLowerCase();
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPalette(p)}
                            className={`flex flex-col gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "border-theme bg-theme/[0.06] ring-1 ring-theme/20"
                                : "border-neutral-200/80 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20"
                            }`}
                          >
                            {/* 3 色拼接色条，直观展示多色搭配 */}
                            <div className="flex h-6 w-full overflow-hidden rounded-lg border border-black/5 dark:border-white/10">
                              <span className="flex-[1.4]" style={{ backgroundColor: p.primary }} />
                              <span className="flex-1" style={{ backgroundColor: p.secondary }} />
                              <span className="flex-[0.7]" style={{ backgroundColor: p.accent }} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`font-semibold text-xs ${isSelected ? "text-theme" : "text-neutral-800 dark:text-neutral-100"}`}>
                                  {p.name}
                                </span>
                                {isSelected ? <i className="ri-check-line text-theme text-xs font-bold" /> : null}
                              </div>
                              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                {p.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : null}

              {/* ============ 3. 环境粒子 ============ */}
              {activeTab === "ambience" ? (
                <section className="space-y-2.5">
                  <div className="space-y-2">
                    {AMBIENCE_OPTIONS.map((item) => {
                      const isSelected = ambienceMode === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectAmbience(item.id)}
                          className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition cursor-pointer ${
                            isSelected
                              ? "border-theme bg-theme/[0.06]"
                              : "border-neutral-200/80 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${
                                isSelected
                                  ? "bg-theme/15 text-theme"
                                  : "bg-neutral-100 dark:bg-white/[0.06] text-neutral-500 dark:text-neutral-400"
                              }`}
                            >
                              <i className={item.icon} />
                            </span>
                            <div className="min-w-0">
                              <div className={`font-semibold text-xs ${isSelected ? "text-theme" : "text-neutral-800 dark:text-neutral-100"}`}>
                                {item.label}
                              </div>
                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                {item.desc}
                              </div>
                            </div>
                          </div>
                          {item.shortcut ? (
                            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md border border-neutral-200 dark:border-white/10 text-neutral-400 shrink-0">
                              {item.shortcut}
                            </kbd>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                    粒子画布已针对浅色与深色模式分别调校对比度，并自动跳过减弱动效设置，不拦截页面点击。
                  </p>
                </section>
              ) : null}

              {/* ============ 4. 背景画布 ============ */}
              {activeTab === "backdrop" ? (
                <div className="space-y-4">
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">内置轻背景</span>
                      <button
                        type="button"
                        onClick={() => handleSelectWallpaperPreset("none")}
                        className="text-[11px] text-neutral-400 hover:text-theme transition cursor-pointer"
                      >
                        清空背景
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {WALLPAPER_PRESETS.map((wp) => {
                        const isSelected =
                          (wp.url === "none" && (!wallpaperUrlVal || wallpaperUrlVal === "none")) ||
                          wallpaperUrlVal === wp.url;
                        return (
                          <button
                            key={wp.id}
                            type="button"
                            onClick={() => handleSelectWallpaperPreset(wp.url)}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                              isSelected
                                ? "border-theme bg-theme/[0.06]"
                                : "border-neutral-200/80 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20"
                            }`}
                          >
                            <span
                              className="h-7 w-7 rounded-lg border border-black/10 dark:border-white/10 shrink-0"
                              style={wp.previewStyle}
                            />
                            <div className="min-w-0">
                              <div className={`text-xs font-semibold truncate ${isSelected ? "text-theme" : "text-neutral-800 dark:text-neutral-100"}`}>
                                {wp.name}
                              </div>
                              <div className="text-[10px] text-neutral-400 truncate">{wp.subtitle}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {savedWallpapers.length > 0 ? (
                    <section className="space-y-1.5 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">我的收藏</span>
                      <div className="flex flex-wrap gap-1.5">
                        {savedWallpapers.map((sw) => (
                          <span
                            key={sw.id}
                            onClick={() => handleSelectWallpaperPreset(sw.url)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] cursor-pointer border transition ${
                              wallpaperUrlVal === sw.url
                                ? "border-theme bg-theme/10 text-theme font-semibold"
                                : "border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300"
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
                    </section>
                  ) : null}

                  <section className="space-y-2 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">自定义图片或 CSS 渐变</span>
                      <button
                        type="button"
                        onClick={handleBookmarkCurrentWallpaper}
                        className="text-[11px] text-theme hover:underline cursor-pointer"
                      >
                        收藏当前
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={wallpaperUrlVal}
                        onChange={(e) => setWallpaperUrlVal(e.target.value)}
                        placeholder="https://... 或 radial-gradient(...)"
                        className="rin-field font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomWallpaper}
                        className="px-3 py-2 rounded-lg bg-theme text-white text-xs font-semibold hover:bg-theme-hover transition shrink-0 cursor-pointer"
                      >
                        应用
                      </button>
                    </div>
                  </section>

                  <section className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600 dark:text-neutral-300 font-medium">背景显影浓度</span>
                      <span className="font-mono text-[11px] text-theme font-semibold">{wallpaperOpacityVal}%</span>
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
                  </section>
                </div>
              ) : null}

              {/* ============ 5. 排版与交互细节 ============ */}
              {activeTab === "detail" ? (
                <div className="space-y-4">
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-700 dark:text-neutral-200">拍立得卡片倾角</span>
                      <span className="font-mono text-[11px] text-theme font-semibold">{tiltVal.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      step="0.2"
                      value={tiltVal}
                      onChange={(e) => handleChangeTilt(Number.parseFloat(e.target.value))}
                      className="w-full accent-theme h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>0° 齐平</span>
                      <span>1.8° 微倾</span>
                      <span>6° 错落</span>
                    </div>
                  </section>

                  <section className="space-y-2 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-700 dark:text-neutral-200">画廊卡片间距</span>
                      <span className="font-mono text-[11px] text-theme font-semibold">{gapVal}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="40"
                      step="2"
                      value={gapVal}
                      onChange={(e) => handleChangeGap(Number.parseInt(e.target.value, 10))}
                      className="w-full accent-theme h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
                    />
                  </section>

                  <section className="space-y-2 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">全站正文字体</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "sans" as const, label: "无衬线" },
                        { id: "serif" as const, label: "优雅衬线" },
                        { id: "mono" as const, label: "极客等宽" },
                      ].map((f) => {
                        const active = fontFamilyVal === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleChangeFont(f.id)}
                            className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                              active
                                ? "border-theme bg-theme/[0.08] text-theme font-semibold"
                                : "border-neutral-200/80 dark:border-white/10 text-neutral-600 dark:text-neutral-300"
                            }`}
                          >
                            <div className="text-xs">{f.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-2 pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <div className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="font-medium text-neutral-800 dark:text-neutral-100">定制鼠标指针</p>
                        <p className="text-[10px] text-neutral-400">启用趣味手绘箭头与点击指针</p>
                      </div>
                      <DrawerSwitch checked={customCursorVal} onToggle={handleToggleCursor} label="定制鼠标指针" />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="font-medium text-neutral-800 dark:text-neutral-100">顶部阅读进度条</p>
                        <p className="text-[10px] text-neutral-400">浏览长文时页面顶端显示滚动进度</p>
                      </div>
                      <DrawerSwitch checked={readingProgressVal} onToggle={handleToggleReadingProgress} label="顶部阅读进度条" />
                    </div>
                  </section>
                </div>
              ) : null}

              {/* ============ 管理员区：加载状态 ============ */}
              {isAdmin && ["site", "security", "ai", "storage"].includes(activeTab) && adminCfgLoading ? (
                <div className="flex items-center justify-center py-16 text-neutral-400 gap-2">
                  <i className="ri-loader-4-line animate-spin text-theme text-base" />
                  <span>正在读取站点配置...</span>
                </div>
              ) : null}

              {/* ============ 6. 管理员：站点基础信息 ============ */}
              {isAdmin && activeTab === "site" && !adminCfgLoading ? (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">站点名称</label>
                    <input
                      type="text"
                      defaultValue={adminClientCfg["site.name"] ?? siteConfig.name ?? ""}
                      onBlur={(e) => void handleSaveAdminClientField("site.name", e.target.value.trim())}
                      className="rin-field font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">站点简介 / 副标题</label>
                    <textarea
                      rows={2}
                      defaultValue={adminClientCfg["site.description"] ?? siteConfig.description ?? ""}
                      onBlur={(e) => void handleSaveAdminClientField("site.description", e.target.value.trim())}
                      className="rin-field resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">头像链接</label>
                    <div className="flex items-center gap-2">
                      {siteConfig.avatar ? (
                        <img
                          src={siteConfig.avatar}
                          alt=""
                          className="h-8 w-8 rounded-lg object-cover border border-neutral-200 dark:border-white/10 shrink-0"
                        />
                      ) : null}
                      <input
                        type="text"
                        defaultValue={adminClientCfg["site.avatar"] ?? siteConfig.avatar ?? ""}
                        onBlur={(e) => void handleSaveAdminClientField("site.avatar", e.target.value.trim())}
                        placeholder="https://..."
                        className="rin-field font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">每页文章数量</label>
                    <input
                      type="number"
                      min="3"
                      max="50"
                      defaultValue={adminClientCfg["site.page_size"] ?? siteConfig.pageSize ?? 12}
                      onBlur={(e) =>
                        void handleSaveAdminClientField("site.page_size", Number.parseInt(e.target.value, 10) || 12)
                      }
                      className="rin-field font-mono w-28"
                    />
                  </div>

                  <p className="text-[10px] text-neutral-400 pt-1">输入完成后移开焦点即自动保存生效。</p>
                </div>
              ) : null}

              {/* ============ 7. 管理员：功能开关与系统安全（原百宝箱完整整合） ============ */}
              {isAdmin && activeTab === "security" && !adminCfgLoading ? (
                <div className="space-y-5">
                  <section className="space-y-1">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 pb-1.5">
                      功能特性开关
                    </div>
                    {[
                      { key: "header.show_nav", label: "前台显示顶部导航栏", desc: "关闭后仅保留右上角极简图标" },
                      { key: "comment.enabled", label: "评论与留言系统", desc: "允许访客在文章底部留言交流" },
                      { key: "friend_apply_enable", label: "开放友链自助申请", desc: "访客可在星廊提交交换友链申请" },
                      { key: "counter.enabled", label: "访问统计 (PV / UV)", desc: "记录并展示文章阅读次数" },
                      { key: "openlist.show_in_nav", label: "顶栏显示网盘入口", desc: "在导航栏增加 OpenList 目录链接", defaultOn: false },
                      { key: "rss", label: "原生 RSS 订阅源", desc: "对外提供 /rss.xml 与 /feed" },
                    ].map((item) => {
                      const on = isClientToggleOn(item.key, item.defaultOn ?? true);
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 py-2.5 border-b border-neutral-100 dark:border-white/[0.06] last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-800 dark:text-neutral-100">{item.label}</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</p>
                          </div>
                          <DrawerSwitch
                            checked={on}
                            onToggle={() => void handleSaveAdminClientField(item.key, !on)}
                            label={item.label}
                          />
                        </div>
                      );
                    })}
                  </section>

                  <section className="space-y-1 pt-2 border-t border-neutral-200/80 dark:border-white/10">
                    <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 pb-1.5">
                      系统安全策略
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-neutral-100 dark:border-white/[0.06]">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-800 dark:text-neutral-100">开放前台账号登录</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">关闭后仅保留管理员入口</p>
                      </div>
                      <DrawerSwitch
                        checked={isClientToggleOn("login.enabled", true)}
                        onToggle={() =>
                          void handleSaveAdminClientField("login.enabled", !isClientToggleOn("login.enabled", true))
                        }
                        label="开放前台账号登录"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-800 dark:text-neutral-100">友链申请自动免审通过</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">探针检测通过后自动入驻星廊</p>
                      </div>
                      <DrawerSwitch
                        checked={
                          adminServerCfg["friend_apply_auto_accept"] === true ||
                          adminServerCfg["friend_apply_auto_accept"] === "true"
                        }
                        onToggle={() => {
                          const cur =
                            adminServerCfg["friend_apply_auto_accept"] === true ||
                            adminServerCfg["friend_apply_auto_accept"] === "true";
                          void persistServerConfig({ friend_apply_auto_accept: !cur });
                        }}
                        label="友链申请自动免审通过"
                      />
                    </div>
                  </section>
                </div>
              ) : null}

              {/* ============ 8. 管理员：AI 模型配置 ============ */}
              {isAdmin && activeTab === "ai" && !adminCfgLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-theme/20 bg-theme/[0.04]">
                    <div>
                      <p className="font-semibold text-neutral-800 dark:text-neutral-100">AI 自动摘要与写作辅助</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">生成文章导读与智能排版建议</p>
                    </div>
                    <DrawerSwitch
                      checked={
                        adminServerCfg["ai_summary.enabled"] === true ||
                        adminServerCfg["ai_summary.enabled"] === "true"
                      }
                      onToggle={() => {
                        const cur =
                          adminServerCfg["ai_summary.enabled"] === true ||
                          adminServerCfg["ai_summary.enabled"] === "true";
                        void persistServerConfig({ "ai_summary.enabled": !cur });
                      }}
                      label="AI 自动摘要开关"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">模型服务商</span>
                      <a href="/admin/ai" className="text-[11px] text-theme hover:underline">
                        高级提示词设置 &rarr;
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "cloudflare", label: "Worker AI" },
                        { id: "openai", label: "OpenAI" },
                        { id: "claude", label: "Claude" },
                        { id: "gemini", label: "Gemini" },
                        { id: "deepseek", label: "DeepSeek" },
                      ].map((prov) => {
                        const active = (adminServerCfg["ai_summary.provider"] || "cloudflare") === prov.id;
                        return (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() => void persistServerConfig({ "ai_summary.provider": prov.id })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] border transition cursor-pointer ${
                              active
                                ? "border-theme bg-theme/10 text-theme font-semibold"
                                : "border-neutral-200/80 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300"
                            }`}
                          >
                            {prov.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">模型 ID</label>
                    <input
                      type="text"
                      defaultValue={adminServerCfg["ai_summary.model"] || ""}
                      onBlur={(e) => void persistServerConfig({ "ai_summary.model": e.target.value.trim() })}
                      placeholder="gpt-4o-mini / deepseek-chat"
                      className="rin-field font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">API Key</label>
                    <input
                      type="password"
                      defaultValue={adminServerCfg["ai_summary.api_key"] || ""}
                      onBlur={(e) => void persistServerConfig({ "ai_summary.api_key": e.target.value.trim() })}
                      placeholder="sk-..."
                      className="rin-field font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">自定义接口地址（可选）</label>
                    <input
                      type="text"
                      defaultValue={adminServerCfg["ai_summary.api_url"] || ""}
                      onBlur={(e) => void persistServerConfig({ "ai_summary.api_url": e.target.value.trim() })}
                      placeholder="留空则使用官方默认地址"
                      className="rin-field font-mono"
                    />
                  </div>
                </div>
              ) : null}

              {/* ============ 9. 管理员：存储与接口（原百宝箱完整整合） ============ */}
              {isAdmin && activeTab === "storage" && !adminCfgLoading ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                      OpenList 网盘边缘代理地址
                    </label>
                    <input
                      type="text"
                      defaultValue={adminClientCfg["openlist.worker_url"] || ""}
                      onBlur={(e) => void handleSaveAdminClientField("openlist.worker_url", e.target.value.trim())}
                      placeholder="https://openlist.yourdomain.workers.dev"
                      className="rin-field font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                        图床对外直传 API Token
                      </label>
                      {adminServerCfg["storage.api_token"] ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(String(adminServerCfg["storage.api_token"]));
                            showToast("图床 Token 已复制");
                          }}
                          className="text-[11px] text-theme hover:underline cursor-pointer"
                        >
                          复制
                        </button>
                      ) : null}
                    </div>
                    <input
                      type="text"
                      defaultValue={adminServerCfg["storage.api_token"] || ""}
                      onBlur={(e) => void persistServerConfig({ "storage.api_token": e.target.value.trim() })}
                      placeholder="用于 Typora / PicGo 免登录直传 R2"
                      className="rin-field font-mono"
                    />
                  </div>

                  <div className="pt-3 border-t border-neutral-200/70 dark:border-white/[0.07]">
                    <a
                      href="/admin/settings"
                      className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/80 dark:border-white/10 hover:border-theme/40 hover:bg-theme/[0.03] transition"
                    >
                      <div>
                        <p className="font-semibold text-neutral-800 dark:text-neutral-100">更多高级运维项</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">WordPress 导入、Webhook、Favicon 与页脚代码</p>
                      </div>
                      <i className="ri-arrow-right-up-line text-neutral-400" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 抽屉底栏：仅保留「随机搭配」+「恢复默认」（移除不需要的分享搭配） */}
            <footer className="px-4 py-3 border-t border-neutral-200/75 dark:border-white/[0.08] bg-neutral-50/70 dark:bg-white/[0.02] flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRandomRoll}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-theme to-theme-secondary text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
              >
                <i className="ri-shuffle-line text-sm" />
                <span>随机搭配</span>
              </button>
              <button
                type="button"
                onClick={handleResetDefault}
                className="py-2 px-3 rounded-xl border border-neutral-200/90 dark:border-white/15 bg-white dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 font-medium text-xs hover:border-neutral-300 dark:hover:border-white/25 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition cursor-pointer"
              >
                恢复默认
              </button>
            </footer>
          </div>
        </aside>
      ) : null}

      {/* 4. 轻量反馈提示条 */}
      {toastMessage ? (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-3.5 py-2 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-100 text-xs font-medium shadow-lg backdrop-blur-md ani-show-fast select-none pointer-events-none flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gradient-to-tr from-theme to-theme-secondary" />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </>,
    document.body
  );
}
