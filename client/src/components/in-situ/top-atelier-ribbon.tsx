import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
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

/** 精修 1.5px 线性 SVG 图标集（去包裹、纯图标+文字直排） */
function IconSakura({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 11.5C10.4 9 9.8 5.8 11.3 4.2c.4-.4.7-.2.7.5 0-.7.3-.9.7-.5 1.5 1.6.9 4.8-.7 7.3Z" />
      <path d="M12.5 11.8c2.6-1 5.8-.8 7 1.1.3.5 0 .8-.6.6.6.2.8.5.4 1-1.3 1.7-4.5 1.5-6.8-2.7Z" />
      <path d="M12.2 12.4c1.6 2.3 2.4 5.4 1 7.1-.4.4-.7.2-.7-.5 0 .7-.3.9-.7.5-1.5-1.7-.7-4.8.4-7.1Z" />
      <path d="M11.5 11.8c-2.6-1-5.8-.8-7 1.1-.3.5 0 .8.6.6-.6.2-.8.5-.4 1 1.3 1.7 4.5 1.5 6.8-2.7Z" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconRain({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 14.5a4 4 0 0 1-.8-7.92A5.5 5.5 0 0 1 16.8 6a3.5 3.5 0 0 1 .7 6.95" />
      <path d="M8.5 16.5 7.2 20" />
      <path d="M13 16.5 11.7 20" />
      <path d="M17.5 16.5 16.2 20" />
    </svg>
  );
}

function IconFireflies({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.5l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5L6 9.5 10.5 8 12 3.5Z" />
      <circle cx="18.2" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="6.2" cy="17.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLayout({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="4" width="7" height="9" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="5.5" rx="1.5" />
      <rect x="13.5" y="12.5" width="7" height="7.5" rx="1.5" />
      <rect x="3.5" y="16" width="7" height="4" rx="1.5" />
    </svg>
  );
}

function IconQuill({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19.5 4.5c-4.5.5-9.5 3.5-12.5 8.5L5 19l6-2c5-3 8-8 8.5-12.5Z" />
      <path d="M14 10 5 19" />
    </svg>
  );
}

function IconGallery({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m20.5 15.5-4.5-4.5-6.5 6.5" />
    </svg>
  );
}

function IconMusic({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 17.5V6.5l10-2v11" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </svg>
  );
}

function IconSliders({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 7h4m4 0h8M4 12h10m4 0h2M4 17h6m4 0h6" />
      <circle cx="10" cy="7" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="12" cy="17" r="2" />
    </svg>
  );
}

function IconTag({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

/**
 * 页面上方居中纯图标+文字微工具栏（完全无外框包裹，与画布自然融为一体）：
 * - 访客与站长均可见 3 枚独立的「樱花 / 细雨 / 萤火」直按开关；
 * - 站长登录态顺滑衔接版式/配色/调色盘与撰写/图床/音廊/设置；
 * - 调色盘拖动采用 rAF 纯 CSS 变量实时预览 + 停顿防抖单次持久化，彻底根绝卡顿。
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

  // 拖动调色盘时的纯本地颜色展示，避免每像素触发全局 ConfigContext 重渲染
  const [liveColorHex, setLiveColorHex] = useState<string>(() =>
    normalizeThemeColor(siteConfig.themeColor)
  );
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const rafColorRef = useRef<number | null>(null);
  const pendingColorRef = useRef<string | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const normalized = normalizeThemeColor(siteConfig.themeColor);
    setLiveColorHex(normalized);
    if (colorInputRef.current && document.activeElement !== colorInputRef.current) {
      colorInputRef.current.value = normalized;
    }
  }, [siteConfig.themeColor]);

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
    return () => {
      window.removeEventListener("rin:ambience-updated", onUpdated);
      if (rafColorRef.current !== null) cancelAnimationFrame(rafColorRef.current);
      if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    };
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

  const commitCustomColor = useCallback(
    (hex: string) => {
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      pendingColorRef.current = null;
      setLiveColorHex(hex);
      void persistClientConfig({
        "theme.preset": "custom",
        "theme.color": hex,
        "theme.secondary_color": "",
      });
    },
    [persistClientConfig]
  );

  // 60fps 丝滑选色：拖动中仅用 rAF 写 CSS 变量（0 次整树重渲染、0 次网络请求），停顿 350ms 后才持久化一次
  const handleLiveColorInput = useCallback(
    (rawHex: string) => {
      const hex = normalizeThemeColor(rawHex);
      pendingColorRef.current = hex;

      if (rafColorRef.current === null) {
        rafColorRef.current = requestAnimationFrame(() => {
          rafColorRef.current = null;
          if (pendingColorRef.current) {
            applyThemeColor(pendingColorRef.current, undefined, "custom");
          }
        });
      }

      if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        commitCustomColor(hex);
      }, 350);
    },
    [commitCustomColor]
  );

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
        p.primary.toLowerCase() === liveColorHex.toLowerCase()
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
    setLiveColorHex(next.primary);
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
      className="w-full max-w-5xl mx-auto px-4 pt-1.5 pb-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs select-none"
    >
      {/* 1. 访客可用：纯图标+文字独立氛围开关（无任何外框包裹） */}
      {ambienceItems.map((item) => {
        const active = ambience === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleToggleAmbience(item.id)}
            aria-pressed={active}
            title={active ? `关闭${item.label}氛围` : `开启${item.label}氛围`}
            className={`inline-flex items-center gap-1 py-0.5 text-xs transition-all duration-200 cursor-pointer ${
              active
                ? "text-theme font-semibold glow-theme"
                : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}

      {/* 2. 管理员登录态专属：无外框纯图标+文字快捷区 */}
      {isAdmin ? (
        <>
          <span className="h-3.5 w-px bg-neutral-300/50 dark:bg-white/10 rounded-full" aria-hidden="true" />

          <button
            type="button"
            onClick={handleCycleVariant}
            title={`切换文章版式（当前：${currentVariantMeta.label}）`}
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <IconLayout />
            <span>{currentVariantMeta.label}</span>
          </button>

          <button
            type="button"
            onClick={handleCyclePalette}
            title={`切换明快主题色（当前：${currentPalette.name}）`}
            className="inline-flex items-center gap-1.5 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/15"
              style={{ backgroundColor: liveColorHex }}
              aria-hidden="true"
            />
            <span>{currentPalette.name}</span>
          </button>

          <label
            title="打开调色盘自由选色"
            className="relative inline-flex items-center gap-1 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <span
              className="h-3 w-3 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 via-emerald-400 to-sky-500 shrink-0"
              aria-hidden="true"
            />
            <span className="hidden sm:inline">调色</span>
            <input
              ref={colorInputRef}
              type="color"
              aria-label="自由调色盘选色"
              defaultValue={liveColorHex}
              onInput={(e) => handleLiveColorInput((e.target as HTMLInputElement).value)}
              onBlur={(e) => {
                if (pendingColorRef.current) {
                  commitCustomColor(normalizeThemeColor(e.target.value));
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>

          <span className="h-3.5 w-px bg-neutral-300/50 dark:bg-white/10 rounded-full" aria-hidden="true" />

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("rin:open-writing-drawer"))}
            title="写新文章"
            className="inline-flex items-center gap-1 py-0.5 text-xs text-theme hover:brightness-110 hover:glow-theme-sm transition-all duration-200 cursor-pointer font-semibold"
          >
            <IconQuill />
            <span>撰写</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("rin:open-media-drawer"))}
            title="图床与媒体库"
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all duration-200 cursor-pointer"
          >
            <IconGallery />
            <span className="hidden md:inline">图床</span>
          </button>

          <Link
            href="/music"
            title="微光音廊工作台"
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all duration-200 cursor-pointer"
          >
            <IconMusic />
            <span className="hidden md:inline">音廊</span>
          </Link>

          <Link
            href="/hashtags"
            title="标签体系前台管理"
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all duration-200 cursor-pointer"
          >
            <IconTag />
            <span className="hidden md:inline">标签</span>
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("rin:open-appearance-drawer"))}
            title="前台排版与导航外观工坊（实时调节字号、间距与排布）"
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-400 dark:text-neutral-500 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <IconSliders />
            <span className="hidden md:inline">排版</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
