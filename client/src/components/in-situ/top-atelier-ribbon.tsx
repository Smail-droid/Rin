import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
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

function IconTag({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

/**
 * 🌸 画廊微光在场工坊微控制岛（In-Situ Live Studio）：
 * - 彻底消灭半屏抽屉，所见即管理；
 * - 访客可用：独立氛围开关（樱花 / 细雨 / 萤火）；
 * - 管理员可用：现场直调版式、主题色、调色盘、AI 导读现场总开关，以及全屏创作/图床/音廊直达；
 * - 调色采用 rAF 硬件加速，零卡顿流转。
 */
export function TopAtelierRibbon() {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const { t } = useTranslation();
  const isAdmin = Boolean(profile?.permission);

  const [ambience, setAmbience] = useState<AmbienceMode>(() => {
    try {
      const visitorSaved = sessionStorage.getItem("rin_visitor_ambience");
      if (visitorSaved !== null) return normalizeAmbienceMode(visitorSaved);
    } catch {}
    return normalizeAmbienceMode(siteConfig.themeAmbience);
  });

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

  const handleToggleAISummary = async () => {
    const nextVal = !siteConfig.aiSummaryEnabled;
    try {
      const cached = sessionStorage.getItem("config");
      const parsed = cached ? JSON.parse(cached) : {};
      parsed["ai_summary.enabled"] = nextVal;
      sessionStorage.setItem("config", JSON.stringify(parsed));
      window.dispatchEvent(new Event("rin:config-updated"));
      await client.config.update("server", { "ai_summary.enabled": nextVal });
    } catch (err) {
      console.error("Failed to toggle AI summary:", err);
    }
  };

  const ambienceItems: Array<{
    id: Exclude<AmbienceMode, "none">;
    label: string;
    icon: JSX.Element;
  }> = [
    { id: "sakura", label: t("ambience.sakura", { defaultValue: "樱花" }), icon: <IconSakura /> },
    { id: "rain", label: t("ambience.rain", { defaultValue: "细雨" }), icon: <IconRain /> },
    { id: "fireflies", label: t("ambience.fireflies", { defaultValue: "萤火" }), icon: <IconFireflies /> },
  ];

  const variantLabels: Record<FeedCardVariant, string> = {
    default: t("variant.polaroid", { defaultValue: "拍立得" }),
    poster: t("variant.poster", { defaultValue: "画册" }),
    editorial: t("variant.editorial", { defaultValue: "杂志" }),
    compact: t("variant.compact", { defaultValue: "列表" }),
  };
  const currentVariantLabel = variantLabels[siteConfig.feedCardVariant] || currentVariantMeta.label;
  const currentPaletteName = t(`palette.${currentPalette.id}`, { defaultValue: currentPalette.name });

  return (
    <div
      aria-label={t("top_ribbon_aria", { defaultValue: "画廊氛围与在场工坊" })}
      className="w-full max-w-4xl mx-auto px-4 pt-2 pb-2 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1.5 text-xs select-none ani-show"
    >
      {/* 1. 访客可用：独立氛围微开关 */}
      {ambienceItems.map((item) => {
        const active = ambience === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleToggleAmbience(item.id)}
            aria-pressed={active}
            title={
              active
                ? t("ambience.close_mode", { mode: item.label, defaultValue: `关闭${item.label}氛围` })
                : t("ambience.open_mode", { mode: item.label, defaultValue: `开启${item.label}氛围` })
            }
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

      {/* 2. 管理员专属：现场直调与全屏直达 */}
      {isAdmin ? (
        <>
          <span className="h-3 w-px bg-neutral-300/60 dark:bg-white/10 rounded-full" aria-hidden="true" />

          {/* 版式一键即切 */}
          <button
            type="button"
            onClick={handleCycleVariant}
            title={t("variant.switch_title", { current: currentVariantLabel, defaultValue: `切换文章版式（当前：${currentVariantLabel}）` })}
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-600 dark:text-neutral-300 hover:text-theme transition-all duration-200 cursor-pointer font-medium"
          >
            <IconLayout />
            <span>{currentVariantLabel}</span>
          </button>

          {/* 预设色盘一键即切 */}
          <button
            type="button"
            onClick={handleCyclePalette}
            title={t("palette.switch_title", { current: currentPaletteName, defaultValue: `切换画廊主题色（当前：${currentPaletteName}）` })}
            className="inline-flex items-center gap-1.5 py-0.5 text-xs text-neutral-600 dark:text-neutral-300 hover:text-theme transition-all duration-200 cursor-pointer font-medium"
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/15"
              style={{ backgroundColor: liveColorHex }}
              aria-hidden="true"
            />
            <span>{currentPaletteName}</span>
          </button>

          {/* 自由彩虹调色 */}
          <label
            title={t("palette.custom_title", { defaultValue: "自由取色实时调控" })}
            className="relative inline-flex items-center gap-1 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <span
              className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 via-emerald-400 to-sky-500 shrink-0"
              aria-hidden="true"
            />
            <span className="hidden sm:inline">{t("palette.custom_label", { defaultValue: "调色" })}</span>
            <input
              ref={colorInputRef}
              type="color"
              aria-label={t("palette.custom_aria", { defaultValue: "自由调色盘选色" })}
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

          {/* 现场 AI 导读总开关 (点一下现场立即生效，无需穿门) */}
          <button
            type="button"
            onClick={handleToggleAISummary}
            title={
              siteConfig.aiSummaryEnabled
                ? t("ai_summary.disable_hint", { defaultValue: "点击即刻关闭全站文章导读" })
                : t("ai_summary.enable_hint", { defaultValue: "点击即刻开启全站文章导读" })
            }
            className={`inline-flex items-center gap-1 py-0.5 text-xs transition-all duration-200 cursor-pointer ${
              siteConfig.aiSummaryEnabled
                ? "text-theme font-bold"
                : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            <i className="ri-sparkling-2-line" />
            <span>
              {siteConfig.aiSummaryEnabled
                ? t("ai_summary.status_on", { defaultValue: "导读:开" })
                : t("ai_summary.status_off", { defaultValue: "导读:关" })}
            </span>
          </button>

          <span className="h-3 w-px bg-neutral-300/60 dark:bg-white/10 rounded-full" aria-hidden="true" />

          {/* 全屏创作直达 */}
          <Link
            href="/writing"
            title={t("nav.write_title", { defaultValue: "进入全屏沉浸创作台" })}
            className="inline-flex items-center gap-1 py-0.5 text-xs text-theme hover:brightness-110 font-bold transition-all duration-200 cursor-pointer"
          >
            <IconQuill />
            <span>{t("writing", { defaultValue: "撰写" })}</span>
          </Link>

          {/* 图床画廊直达 */}
          <Link
            href="/gallery"
            title={t("nav.gallery_title", { defaultValue: "进入全宽图床画廊" })}
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <IconGallery />
            <span className="hidden sm:inline">{t("gallery_title", { defaultValue: "图床" })}</span>
          </Link>

          {/* 音廊电台直达 */}
          <Link
            href="/music"
            title={t("nav.music_title", { defaultValue: "进入沉浸音廊工作台" })}
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <IconMusic />
            <span className="hidden sm:inline">{t("music_title", { defaultValue: "音廊" })}</span>
          </Link>

          {/* 标签管理直达 */}
          <Link
            href="/hashtags"
            title={t("nav.tags_title", { defaultValue: "标签体系管理" })}
            className="inline-flex items-center gap-1 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 hover:text-theme transition-all duration-200 cursor-pointer"
          >
            <IconTag />
            <span className="hidden md:inline">{t("hashtags", { defaultValue: "标签" })}</span>
          </Link>
        </>
      ) : null}
    </div>
  );
}
