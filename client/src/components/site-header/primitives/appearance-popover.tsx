import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { client } from "../../../app/runtime";
import { useSiteConfig } from "../../../hooks/useSiteConfig";
import { ProfileContext } from "../../../state/profile";
import {
  MULTI_COLOR_PALETTES,
  applyThemeColor,
  applyThemeFontFamily,
  applyThemeFontSize,
  applyThemePalette,
  findPaletteByIdOrColor,
  normalizeThemeColor,
  type MultiColorPalette,
  type ThemeFontFamily,
} from "../../../utils/theme-color";
import { normalizeAmbienceMode, type AmbienceMode } from "../../ambient-effects-canvas";

const CURATED_PRESET_IDS = [
  "sakura_paper",
  "warm_wheat",
  "sakura",
  "aoi_sora",
  "midnight_deep",
  "paper_ink",
] as const;

const CURATED_PALETTES: MultiColorPalette[] = CURATED_PRESET_IDS.map((id) =>
  MULTI_COLOR_PALETTES.find((palette) => palette.id === id)
).filter((palette): palette is MultiColorPalette => Boolean(palette));

const AMBIENCE_OPTIONS: Array<{ id: AmbienceMode; label: string }> = [
  { id: "none", label: "关闭" },
  { id: "sakura", label: "樱花" },
  { id: "rain", label: "细雨" },
  { id: "fireflies", label: "萤火" },
];

const FONT_FAMILY_OPTIONS: Array<{ id: ThemeFontFamily; label: string }> = [
  { id: "sans", label: "现代黑体" },
  { id: "serif", label: "思源宋体" },
  { id: "kai", label: "霞鹜文楷" },
  { id: "mono", label: "等宽" },
];

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 20;

function clampFontSize(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? 16), 10);
  if (Number.isNaN(parsed)) return 16;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed));
}

function normalizeBodyFont(value: string | undefined | null): ThemeFontFamily {
  if (value === "serif" || value === "kai" || value === "mono") {
    return value;
  }
  return "sans";
}

function IconPalette({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="13.5" cy="6.5" r=".7" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".7" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".7" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".7" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z" />
    </svg>
  );
}

type PanelPosition = {
  top?: number;
  bottom?: number;
  right: number;
};

export function AppearancePopover({
  className = "",
  plain = false,
  popoverUp = false,
}: {
  className?: string;
  plain?: boolean;
  popoverUp?: boolean;
}) {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const isAdmin = Boolean(profile?.permission);

  const [isOpen, setIsOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPosition>({ top: 56, right: 16 });
  const [ambience, setAmbience] = useState<AmbienceMode>(() => {
    try {
      const saved = sessionStorage.getItem("rin_visitor_ambience");
      if (saved !== null) return normalizeAmbienceMode(saved);
    } catch {}
    return normalizeAmbienceMode(siteConfig.themeAmbience);
  });
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (siteConfig.themePreset === "custom") return "custom";
    return findPaletteByIdOrColor(siteConfig.themePreset, siteConfig.themeColor)?.id || "sakura_paper";
  });
  const [liveColorHex, setLiveColorHex] = useState<string>(() =>
    normalizeThemeColor(siteConfig.themeColor)
  );
  const [fontFamily, setFontFamily] = useState<ThemeFontFamily>(() =>
    normalizeBodyFont(siteConfig.themeFontFamily)
  );
  const [fontSize, setFontSize] = useState<number>(() =>
    clampFontSize(siteConfig.themeFontSize)
  );

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const colorPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("rin_visitor_ambience") !== null) return;
    } catch {}
    setAmbience(normalizeAmbienceMode(siteConfig.themeAmbience));
  }, [siteConfig.themeAmbience]);

  useEffect(() => {
    if (siteConfig.themePreset === "custom") {
      setSelectedPreset("custom");
    } else {
      const matched = findPaletteByIdOrColor(siteConfig.themePreset, siteConfig.themeColor);
      if (matched) setSelectedPreset(matched.id);
    }
    setLiveColorHex(normalizeThemeColor(siteConfig.themeColor));
  }, [siteConfig.themePreset, siteConfig.themeColor]);

  useEffect(() => {
    setFontFamily(normalizeBodyFont(siteConfig.themeFontFamily));
  }, [siteConfig.themeFontFamily]);

  useEffect(() => {
    setFontSize(clampFontSize(siteConfig.themeFontSize));
  }, [siteConfig.themeFontSize]);

  useEffect(() => {
    const onAmbienceUpdated = (event: Event) => {
      const next = (event as CustomEvent<{ mode?: AmbienceMode }>).detail?.mode;
      if (next !== undefined) {
        setAmbience(normalizeAmbienceMode(next));
      }
    };
    window.addEventListener("rin:ambience-updated", onAmbienceUpdated);
    return () => {
      window.removeEventListener("rin:ambience-updated", onAmbienceUpdated);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (colorPersistTimerRef.current !== null) {
        clearTimeout(colorPersistTimerRef.current);
      }
    };
  }, []);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl || typeof window === "undefined") return;
    const rect = triggerEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const panelWidth = Math.min(300, Math.max(260, viewportWidth - 24));
    const right = Math.max(
      12,
      Math.min(viewportWidth - rect.right, viewportWidth - panelWidth - 12)
    );
    if (popoverUp) {
      setPanelPos({
        bottom: Math.max(12, viewportHeight - rect.top + 8),
        right,
      });
    } else {
      setPanelPos({
        top: Math.max(12, rect.bottom + 8),
        right,
      });
    }
  }, [popoverUp]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleReposition = () => updatePosition();

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition);
    };
  }, [isOpen, updatePosition]);

  const persistSessionConfig = useCallback((updates: Record<string, unknown>) => {
    try {
      const cached = sessionStorage.getItem("config");
      const parsed = cached ? JSON.parse(cached) : {};
      const next = { ...parsed, ...updates };
      sessionStorage.setItem("config", JSON.stringify(next));
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rin:config-updated"));
    }
  }, []);

  const persistClientConfig = useCallback(
    async (updates: Record<string, unknown>) => {
      persistSessionConfig(updates);
      if (isAdmin) {
        try {
          await client.config.update("client", updates);
        } catch (err) {
          console.error("Failed to persist appearance config:", err);
        }
      }
    },
    [isAdmin, persistSessionConfig]
  );

  const handleSelectAmbience = (next: AmbienceMode) => {
    setAmbience(next);
    try {
      sessionStorage.setItem("rin_visitor_ambience", next);
    } catch {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("rin:ambience-updated", { detail: { mode: next } }));
    }
    if (isAdmin) {
      void persistClientConfig({ "theme.ambience": next });
    }
  };

  const handleSelectPalette = (palette: MultiColorPalette) => {
    setSelectedPreset(palette.id);
    setLiveColorHex(palette.primary);
    applyThemePalette(palette);
    void persistClientConfig({
      "theme.preset": palette.id,
      "theme.color": palette.primary,
      "theme.secondary_color": palette.secondary,
    });
  };

  const handleCustomColorChange = (rawHex: string) => {
    const hex = normalizeThemeColor(rawHex);
    setSelectedPreset("custom");
    setLiveColorHex(hex);
    applyThemeColor(hex, undefined, "custom");

    const updates = {
      "theme.preset": "custom",
      "theme.color": hex,
      "theme.secondary_color": "",
    };
    persistSessionConfig(updates);

    if (isAdmin) {
      if (colorPersistTimerRef.current !== null) {
        clearTimeout(colorPersistTimerRef.current);
      }
      colorPersistTimerRef.current = setTimeout(() => {
        colorPersistTimerRef.current = null;
        void client.config.update("client", updates).catch((err) => {
          console.error("Failed to persist custom theme color:", err);
        });
      }, 250);
    }
  };

  const handleSelectFontFamily = (nextFamily: ThemeFontFamily) => {
    setFontFamily(nextFamily);
    applyThemeFontFamily(nextFamily);
    void persistClientConfig({ "theme.font_family": nextFamily });
  };

  const handleStepFontSize = (delta: number) => {
    const nextSize = clampFontSize(fontSize + delta);
    if (nextSize === fontSize) return;
    setFontSize(nextSize);
    applyThemeFontSize(nextSize);
    void persistClientConfig({ "theme.font_size": nextSize });
  };

  const portalContent =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="外观与氛围设置"
            style={{
              top: panelPos.top !== undefined ? `${panelPos.top}px` : undefined,
              bottom: panelPos.bottom !== undefined ? `${panelPos.bottom}px` : undefined,
              right: `${panelPos.right}px`,
            }}
            className="fixed z-[9999] w-[300px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-elevated-rgb)/0.96)] p-3.5 text-[rgb(var(--rin-ink-rgb))] shadow-[0_14px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:shadow-[0_16px_44px_rgba(0,0,0,0.48)] select-none ani-show-fast"
          >
            <div className="space-y-3.5">
              {/* Section 1 · 氛围特效 */}
              <section className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wide text-[rgb(var(--rin-ink-muted-rgb))]">
                    氛围特效
                  </span>
                  <span className="text-[10px] font-mono text-[rgb(var(--rin-ink-muted-rgb))]">
                    {AMBIENCE_OPTIONS.find((item) => item.id === ambience)?.label || "关闭"}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-xl border border-[rgb(var(--rin-hairline-rgb)/0.85)] bg-[rgb(var(--rin-canvas-rgb))] p-1">
                  {AMBIENCE_OPTIONS.map((item) => {
                    const active = ambience === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleSelectAmbience(item.id)}
                        className={`rounded-lg px-1.5 py-1 text-xs transition-all cursor-pointer ${
                          active
                            ? "bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] font-semibold ring-1 ring-theme/45 shadow-2xs"
                            : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="h-px bg-[rgb(var(--rin-hairline-rgb)/0.7)]" />

              {/* Section 2 · 纸感主题方案 */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wide text-[rgb(var(--rin-ink-muted-rgb))]">
                    纸感主题方案
                  </span>
                  <label className="relative inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] px-2 py-0.5 text-[11px] text-[rgb(var(--rin-ink-rgb))] hover:border-theme/50 transition-colors cursor-pointer">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/10 dark:border-white/20 shrink-0"
                      style={{ backgroundColor: liveColorHex }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[10px]">{liveColorHex}</span>
                    <input
                      type="color"
                      aria-label="自定义主题色"
                      value={liveColorHex}
                      onChange={(e) => handleCustomColorChange(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CURATED_PALETTES.map((palette) => {
                    const active = selectedPreset === palette.id;
                    return (
                      <button
                        key={palette.id}
                        type="button"
                        aria-pressed={active}
                        title={palette.description}
                        onClick={() => handleSelectPalette(palette)}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs transition-all cursor-pointer ${
                          active
                            ? "border-theme/60 bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] font-semibold ring-1 ring-theme/30"
                            : "border-[rgb(var(--rin-hairline-rgb)/0.85)] bg-[rgb(var(--rin-canvas-rgb)/0.65)] text-[rgb(var(--rin-ink-muted-rgb))] hover:border-theme/35 hover:text-[rgb(var(--rin-ink-rgb))]"
                        }`}
                      >
                        <span
                          className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/15"
                          style={{ backgroundColor: palette.tintLight }}
                          aria-hidden="true"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: palette.primary }}
                          />
                        </span>
                        <span className="truncate">{palette.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="h-px bg-[rgb(var(--rin-hairline-rgb)/0.7)]" />

              {/* Section 3 · 阅读字阶 */}
              <section className="space-y-2">
                <span className="block text-[11px] font-semibold tracking-wide text-[rgb(var(--rin-ink-muted-rgb))]">
                  阅读字阶
                </span>
                <div className="grid grid-cols-4 gap-1 rounded-xl border border-[rgb(var(--rin-hairline-rgb)/0.85)] bg-[rgb(var(--rin-canvas-rgb))] p-1">
                  {FONT_FAMILY_OPTIONS.map((opt) => {
                    const active = fontFamily === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleSelectFontFamily(opt.id)}
                        className={`rounded-lg px-1 py-1 text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                          active
                            ? "bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] font-semibold ring-1 ring-theme/45 shadow-2xs"
                            : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--rin-hairline-rgb)/0.85)] bg-[rgb(var(--rin-canvas-rgb))] px-2 py-1">
                  <span className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))]">正文字号</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="减小字号"
                      disabled={fontSize <= MIN_FONT_SIZE}
                      onClick={() => handleStepFontSize(-1)}
                      className="flex h-6 w-7 items-center justify-center rounded-lg border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-xs font-medium text-[rgb(var(--rin-ink-rgb))] transition-colors hover:border-theme/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      A-
                    </button>
                    <span className="min-w-[3rem] text-center font-mono text-xs font-semibold tabular-nums text-[rgb(var(--rin-ink-rgb))]">
                      {fontSize}px
                    </span>
                    <button
                      type="button"
                      aria-label="增大字号"
                      disabled={fontSize >= MAX_FONT_SIZE}
                      onClick={() => handleStepFontSize(1)}
                      className="flex h-6 w-7 items-center justify-center rounded-lg border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-xs font-medium text-[rgb(var(--rin-ink-rgb))] transition-colors hover:border-theme/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      A+
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`${className} flex flex-row items-center`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="外观设置"
        title="外观与氛围设置"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={
          plain
            ? `flex h-8 w-8 items-center justify-center rounded-full transition-colors select-none cursor-pointer ${
                isOpen
                  ? "bg-theme/12 text-theme"
                  : "text-neutral-500 hover:bg-black/5 hover:text-theme dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-theme"
              }`
            : `flex h-8 w-8 items-center justify-center rounded-full border bg-[rgb(var(--rin-surface-rgb))] shadow-2xs transition-all select-none cursor-pointer ${
                isOpen
                  ? "border-theme text-theme"
                  : "border-[rgb(var(--rin-hairline-rgb))] text-[rgb(var(--rin-ink-muted-rgb))] hover:border-theme hover:text-theme"
              }`
        }
      >
        <IconPalette className="h-4 w-4" />
      </button>
      {portalContent}
    </div>
  );
}
