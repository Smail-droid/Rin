import { useCallback, useContext, useEffect, useState } from "react";
import { ProfileContext } from "../../state/profile";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { client } from "../../app/runtime";
import { MULTI_COLOR_PALETTES, applyThemeColor, applyThemePalette, normalizeThemeColor } from "../../utils/theme-color";
import type { FeedCardVariant } from "../feed-card-options";
import { normalizeAmbienceMode, type AmbienceMode } from "../ambient-effects-canvas";

const VARIANT_CYCLE: Array<{ id: FeedCardVariant; label: string }> = [
  { id: "default", label: "拍立得" },
  { id: "poster", label: "画册" },
  { id: "editorial", label: "杂志" },
  { id: "compact", label: "列表" },
];

/** 精修 1.5px 线性 SVG 图标集（统一视觉克重，拒绝粗糙图标混搭） */
function IconSakura({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 12c-1.5-2.8-1-6.5 0-8 1 1.5 1.5 5.2 0 8Z" />
      <path d="M12 12c2.8-1.5 6.5-1 8 0-1.5 1-5.2 1.5-8 0Z" />
      <path d="M12 12c1.5 2.8 1 6.5 0 8-1-1.5-1.5-5.2 0-8Z" />
      <path d="M12 12c-2.8 1.5-6.5 1-8 0 1.5-1 5.2-1.5 8 0Z" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconRain({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 15a4 4 0 0 1-.8-7.92A5.5 5.5 0 0 1 16.8 6.5 3.5 3.5 0 0 1 17.5 13.5" />
      <path d="M8.5 16.5 7 20" />
      <path d="M13 16.5 11.5 20" />
      <path d="M17.5 16.5 16 20" />
    </svg>
  );
}

function IconFireflies({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3l1.6 4.8L18.5 9.5l-4.9 1.7L12 16l-1.6-4.8-4.9-1.7 4.9-1.7L12 3Z" />
      <circle cx="18.5" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="6" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLayout({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="4" width="7" height="9" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="5.5" rx="1.5" />
      <rect x="13.5" y="12.5" width="7" height="7.5" rx="1.5" />
      <rect x="3.5" y="16" width="7" height="4" rx="1.5" />
    </svg>
  );
}

function IconQuill({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19.5 4.5c-4.5.5-9.5 3.5-12.5 8.5L5 19l6-2c5-3 8-8 8.5-12.5Z" />
      <path d="M14 10 5 19" />
    </svg>
  );
}

function IconGallery({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m20.5 15.5-4.5-4.5-6.5 6.5" />
    </svg>
  );
}

function IconMusic({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 17.5V6.5l10-2v11" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </svg>
  );
}

function IconSliders({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 7h4m4 0h8M4 12h10m4 0h2M4 17h6m4 0h6" />
      <circle cx="10" cy="7" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="12" cy="17" r="2" />
    </svg>
  );
}

/**
 * 页面上方居中自然嵌入微工具栏（遵守《美化章程》第一章与第五章）：
 * - 非悬浮（正常文档流居中嵌入顶栏下方），无廉价浮空阴影胶囊；
 * - 访客与站长均可见 3 枚独立的「樱花 / 细雨 / 萤火」直按开关（点下即开，再点即关）；
 * - 站长登录态顺滑衔接「版式一键切 / 配色一键切 / 写文章 / 图床 / 音廊 / 后台设置」。
 */
export function TopAtelierRibbon() {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const isAdmin = Boolean(profile?.permission);

  const [ambience, setAmbience] = useState<AmbienceMode>(() => {
    try {
      const visitorSaved = sessionStorage.getItem("rin_visitor_ambience");
      if (visitorSaved !== null) return normalizeAmbienceMode(visitorSaved);
    } catch {}
    return normalizeAmbienceMode(siteConfig.themeAmbience);
  });

  useEffect(() => {
    try {
      if (sessionStorage.getItem("rin_visitor_ambience") !== null) return;
    } catch {}
    setAmbience(normalizeAmbienceMode(siteConfig.themeAmbience));
  }, [siteConfig.themeAmbience]);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const next = (e as CustomEvent<{ mode?: AmbienceMode }>).detail?.mode;
      if (next !== undefined) {
        setAmbience(normalizeAmbienceMode(next));
      }
    };
    window.addEventListener("rin:ambience-updated", onUpdated);
    return () => window.removeEventListener("rin:ambience-updated", onUpdated);
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
      console.error("Failed to persist config:", err);
    }
  }, []);

  const handleToggleAmbience = (target: Exclude<AmbienceMode, "none">) => {
    const next: AmbienceMode = ambience === target ? "none" : target;
    setAmbience(next);
    try {
      sessionStorage.setItem("rin_visitor_ambience", next);
    } catch {}
    window.dispatchEvent(new CustomEvent("rin:ambience-updated", { detail: { mode: next } }));
    if (isAdmin) {
      void persistClientConfig({ "theme.ambience": next });
    }
  };

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

  const handleCycleVariant = () => {
    const idx = VARIANT_CYCLE.findIndex((v) => v.id === currentVariant);
    const next = VARIANT_CYCLE[(idx + 1) % VARIANT_CYCLE.length];
    void persistClientConfig({ "feed.card_variant": next.id });
  };

  const handleCyclePalette = () => {
    const next = MULTI_COLOR_PALETTES[(currentPaletteIdx + 1) % MULTI_COLOR_PALETTES.length];
    applyThemePalette(next);
    void persistClientConfig({
      "theme.preset": next.id,
      "theme.color": next.primary,
      "theme.secondary_color": next.secondary,
    });
  };

  const ambienceItems: Array<{
    id: Exclude<AmbienceMode, "none">;
    label: string;
    icon: JSX.Element;
  }> = [
    { id: "sakura", label: "樱花", icon: <IconSakura /> },
    { id: "rain", label: "细雨", icon: <IconRain /> },
    { id: "fireflies", label: "萤火", icon: <IconFireflies /> },
  ];

  return (
    <div
      aria-label="画廊氛围与快捷栏"
      className="w-full max-w-5xl mx-auto px-4 pt-1 pb-2 flex items-center justify-center select-none"
    >
      <div className="inline-flex flex-wrap items-center justify-center gap-0.5 sm:gap-1 px-2 py-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.015] dark:bg-white/[0.02]">
        {/* 1. 访客可用：独立氛围效果开关（点下即开，再点即关） */}
        {ambienceItems.map((item) => {
          const active = ambience === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleToggleAmbience(item.id)}
              aria-pressed={active}
              title={active ? `关闭${item.label}氛围` : `开启${item.label}氛围`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                active
                  ? "bg-theme/12 text-theme font-semibold"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* 2. 管理员登录态专属：一键即切与创作直达 */}
        {isAdmin ? (
          <>
            <span className="mx-1 h-3.5 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />

            <button
              type="button"
              onClick={handleCycleVariant}
              title={`切换文章版式（当前：${currentVariantMeta.label}）`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-theme hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <IconLayout />
              <span className="hidden sm:inline">{currentVariantMeta.label}</span>
            </button>

            <button
              type="button"
              onClick={handleCyclePalette}
              title={`切换明快主题色（当前：${currentPalette.name}）`}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-theme hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-transparent ring-black/10 dark:ring-white/20 shrink-0"
                style={{ backgroundColor: siteConfig.themeColor || currentPalette.primary }}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{currentPalette.name}</span>
            </button>

            <label
              title="打开调色盘自由选色"
              className="relative inline-flex h-6 w-6 items-center justify-center rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <span
                className="h-3.5 w-3.5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 via-emerald-400 to-sky-500 ring-1 ring-black/10 dark:ring-white/20"
                aria-hidden="true"
              />
              <input
                type="color"
                aria-label="自由调色盘选色"
                value={normalizeThemeColor(siteConfig.themeColor)}
                onChange={(e) => {
                  const hex = normalizeThemeColor(e.target.value);
                  applyThemeColor(hex, undefined, "custom");
                  void persistClientConfig({
                    "theme.preset": "custom",
                    "theme.color": hex,
                    "theme.secondary_color": "",
                  });
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>

            <span className="mx-1 h-3.5 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("rin:open-writing-drawer"))}
              title="写新文章"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-theme hover:bg-theme/10 transition-colors cursor-pointer"
            >
              <IconQuill />
              <span className="hidden md:inline">撰写</span>
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("rin:open-media-drawer"))}
              title="图床与媒体库"
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <IconGallery />
            </button>

            <a
              href="/admin/music"
              title="音廊曲库"
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <IconMusic />
            </a>

            <a
              href="/admin/settings?tab=theme"
              title="后台外观与系统设置"
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-theme hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <IconSliders />
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}
