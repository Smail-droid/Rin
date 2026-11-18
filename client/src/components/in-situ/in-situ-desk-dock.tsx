import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { ProfileContext } from "../../state/profile";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { client } from "../../app/runtime";
import { MULTI_COLOR_PALETTES, applyThemePalette } from "../../utils/theme-color";
import type { FeedCardVariant } from "../feed-card-options";
import { normalizeAmbienceMode, type AmbienceMode } from "../ambient-effects-canvas";
import { InSituWritingDrawer } from "./in-situ-writing-drawer";
import { InSituMediaDrawer } from "./in-situ-media-drawer";

const VARIANT_CYCLE: Array<{ id: FeedCardVariant; label: string; icon: string }> = [
  { id: "default", label: "拍立得瀑布流", icon: "ri-layout-masonry-line" },
  { id: "poster", label: "全幅沉浸画册", icon: "ri-gallery-view-2" },
  { id: "editorial", label: "图文双栏杂志", icon: "ri-newspaper-line" },
  { id: "compact", label: "紧凑文章列表", icon: "ri-list-check-2" },
];

const AMBIENCE_CYCLE: Array<{ id: AmbienceMode; label: string; icon: string }> = [
  { id: "none", label: "关闭粒子", icon: "ri-sparkling-line" },
  { id: "sakura", label: "飘落樱花", icon: "ri-flower-line" },
  { id: "rain", label: "清透细雨", icon: "ri-rainy-line" },
  { id: "fireflies", label: "呼吸萤火", icon: "ri-sparkling-2-fill" },
];

/**
 * 管理员登录态前台「一键即切」极简快捷栏
 * 遵守《美化章程》第一章：
 * - 效仿顶栏日夜按钮，点一下立刻切换版式 / 配色 / 粒子并持久化；
 * - 绝不重复放置日夜模式按钮；完整细节配置直达后台 /admin/settings。
 */
export function InSituDeskDock() {
  // REACT HOOKS 铁律：所有 Hooks 无条件置于组件顶层
  const [location] = useLocation();
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();

  const [writingOpen, setWritingOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [quickTip, setQuickTip] = useState<string | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showQuickTip = useCallback((text: string) => {
    setQuickTip(text);
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setQuickTip(null), 1800);
  }, []);

  const persistClientConfig = useCallback(async (updates: Record<string, unknown>) => {
    try {
      const cached = sessionStorage.getItem("config");
      const parsed = cached ? JSON.parse(cached) : {};
      const next = { ...parsed, ...updates };
      sessionStorage.setItem("config", JSON.stringify(next));
      window.dispatchEvent(new Event("rin:config-updated"));
      await client.config.update("client", updates);
    } catch (err) {
      console.error("Failed to persist quick toggle config:", err);
    }
  }, []);

  useEffect(() => {
    const handleOpenWriting = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEditId(detail?.id || null);
      setWritingOpen(true);
    };
    const handleOpenMedia = () => setMediaOpen(true);

    window.addEventListener("rin:open-writing-drawer", handleOpenWriting);
    window.addEventListener("rin:open-media-drawer", handleOpenMedia);

    return () => {
      window.removeEventListener("rin:open-writing-drawer", handleOpenWriting);
      window.removeEventListener("rin:open-media-drawer", handleOpenMedia);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    };
  }, []);

  if (!profile?.permission || location.startsWith("/admin")) {
    return null;
  }

  const currentVariant = siteConfig.feedCardVariant || "default";
  const currentVariantMeta =
    VARIANT_CYCLE.find((v) => v.id === currentVariant) || VARIANT_CYCLE[0];

  const currentPaletteIdx = Math.max(
    0,
    MULTI_COLOR_PALETTES.findIndex(
      (p) =>
        p.id === siteConfig.themePreset ||
        p.primary.toLowerCase() === (siteConfig.themeColor || "").toLowerCase()
    )
  );
  const currentPalette = MULTI_COLOR_PALETTES[currentPaletteIdx] || MULTI_COLOR_PALETTES[0];

  const currentAmbience = normalizeAmbienceMode(siteConfig.themeAmbience);
  const currentAmbienceMeta =
    AMBIENCE_CYCLE.find((a) => a.id === currentAmbience) || AMBIENCE_CYCLE[0];

  const handleCycleVariant = () => {
    const idx = VARIANT_CYCLE.findIndex((v) => v.id === currentVariant);
    const next = VARIANT_CYCLE[(idx + 1) % VARIANT_CYCLE.length];
    void persistClientConfig({ "feed.card_variant": next.id });
    showQuickTip(`版式：${next.label}`);
  };

  const handleCyclePalette = () => {
    const next = MULTI_COLOR_PALETTES[(currentPaletteIdx + 1) % MULTI_COLOR_PALETTES.length];
    applyThemePalette(next);
    void persistClientConfig({
      "theme.preset": next.id,
      "theme.color": next.primary,
      "theme.secondary_color": next.secondary,
    });
    showQuickTip(`配色：${next.name}`);
  };

  const handleCycleAmbience = () => {
    const idx = AMBIENCE_CYCLE.findIndex((a) => a.id === currentAmbience);
    const next = AMBIENCE_CYCLE[(idx + 1) % AMBIENCE_CYCLE.length];
    window.dispatchEvent(new CustomEvent("rin:ambience-updated", { detail: { mode: next.id } }));
    void persistClientConfig({ "theme.ambience": next.id });
    showQuickTip(`粒子：${next.label}`);
  };

  return createPortal(
    <>
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 select-none">
        {quickTip ? (
          <div className="px-3 py-1 rounded-full border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 shadow-md backdrop-blur-md ani-show-fast pointer-events-none flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-theme" />
            <span>{quickTip}</span>
          </div>
        ) : null}

        <aside
          aria-label="管理员前台快捷栏"
          className="flex items-center gap-1 p-1.5 rounded-2xl border border-neutral-200/85 dark:border-white/10 bg-white/90 dark:bg-[#161a24]/90 shadow-[0_8px_28px_-8px_rgba(15,23,42,0.16)] backdrop-blur-md"
        >
          {/* 1. 一键循环版式 */}
          <button
            type="button"
            onClick={handleCycleVariant}
            title={`当前版式：${currentVariantMeta.label}（点击切换下一版式）`}
            aria-label={`切换版式，当前${currentVariantMeta.label}`}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-theme/10 hover:text-theme transition-all active:scale-90 cursor-pointer"
          >
            <i className={`${currentVariantMeta.icon} text-[15px]`} />
          </button>

          {/* 2. 一键循环配色（双色色点直觉展示） */}
          <button
            type="button"
            onClick={handleCyclePalette}
            title={`当前配色：${currentPalette.name}（点击切换下一色盘）`}
            aria-label={`切换配色，当前${currentPalette.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition-all active:scale-90 cursor-pointer"
          >
            <span className="flex items-center -space-x-1">
              <span
                className="h-3 w-3 rounded-full ring-1 ring-white dark:ring-neutral-900 shadow-2xs"
                style={{ backgroundColor: currentPalette.primary }}
              />
              <span
                className="h-3 w-3 rounded-full ring-1 ring-white dark:ring-neutral-900 shadow-2xs"
                style={{ backgroundColor: currentPalette.secondary }}
              />
            </span>
          </button>

          {/* 3. 一键循环粒子 */}
          <button
            type="button"
            onClick={handleCycleAmbience}
            title={`当前粒子：${currentAmbienceMeta.label}（点击切换下一氛围）`}
            aria-label={`切换粒子，当前${currentAmbienceMeta.label}`}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-90 cursor-pointer ${
              currentAmbience !== "none"
                ? "bg-theme/12 text-theme"
                : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-theme"
            }`}
          >
            <i className={`${currentAmbienceMeta.icon} text-[15px]`} />
          </button>

          <div className="mx-0.5 h-4 w-px bg-neutral-200/80 dark:bg-white/10" />

          {/* 4. 创作与后台直达 */}
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setWritingOpen(true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme text-white hover:bg-theme-hover transition-all active:scale-90 cursor-pointer shadow-xs"
            title="写新文章"
          >
            <i className="ri-quill-pen-line text-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => setMediaOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white transition-all active:scale-90 cursor-pointer"
            title="图床与媒体库"
          >
            <i className="ri-folder-image-line text-[15px]" />
          </button>

          <a
            href="/admin/music"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90 cursor-pointer"
            title="音乐曲库管理"
          >
            <i className="ri-music-2-line text-[15px]" />
          </a>

          <a
            href="/admin/settings?tab=theme"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] hover:text-theme transition-all active:scale-90 cursor-pointer"
            title="前往后台完整外观与系统设置"
          >
            <i className="ri-settings-4-line text-[15px]" />
          </a>
        </aside>
      </div>

      <InSituWritingDrawer
        isOpen={writingOpen}
        onClose={() => {
          setWritingOpen(false);
          setEditId(null);
        }}
        editId={editId}
      />

      <InSituMediaDrawer
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
      />
    </>,
    document.body
  );
}
