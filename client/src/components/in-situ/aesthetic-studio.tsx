import { useState } from "react";
import { createPortal } from "react-dom";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { client } from "../../app/runtime";
import { THEME_PRESETS, applyThemeColor, applyThemeOpacity } from "../../utils/theme-color";
import { getStoredThemeMode, setThemeMode, type ThemeMode } from "../../utils/darkModeUtils";
import { type FeedCardVariant } from "../feed-card-options";

const CURATED_PRESETS = THEME_PRESETS.slice(0, 8);

const CARD_VARIANTS: Array<{ id: FeedCardVariant; label: string; icon: string; desc: string }> = [
  { id: "default", label: "拍立得手账", icon: "ri-camera-line", desc: "拟物白边留白与胶片暗角" },
  { id: "editorial", label: "极简社论", icon: "ri-book-open-line", desc: "大号衬线标题与呼吸感摘要" },
  { id: "poster", label: "巨幅画册", icon: "ri-image-line", desc: "海报沉浸大图与微光浮层" },
  { id: "compact", label: "极客单行", icon: "ri-list-check-2", desc: "纯粹单行条目，极速扫读" },
];

export function InSituAestheticStudio() {
  const siteConfig = useSiteConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeVariant = (siteConfig.feedCardVariant || "default") as FeedCardVariant;
  const activeColor = siteConfig.themeColor || "#fc466b";
  const activeOpacity = siteConfig.themeOpacity ?? 100;
  const activeColumns = String(siteConfig.galleryColumns ?? "auto");
  const activeGap = siteConfig.galleryCardGap ?? 24;

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

  const handleSelectVariant = (variant: FeedCardVariant) => {
    void persistConfig({ "feed.card_variant": variant });
  };

  const handleSelectColor = (color: string) => {
    applyThemeColor(color);
    void persistConfig({ "theme.color": color, "theme.preset": "custom" });
  };

  const handleSelectOpacity = (opacity: number) => {
    applyThemeOpacity(opacity);
    void persistConfig({ "theme.opacity": opacity });
  };

  const handleSelectColumns = (cols: string) => {
    void persistConfig({ "gallery.columns": cols });
  };

  const handleSelectGap = (gap: number) => {
    void persistConfig({ "gallery.card_gap": gap });
  };

  const handleToggleThemeMode = () => {
    const current = getStoredThemeMode();
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    setThemeMode(next);
  };

  return createPortal(
    <>
      {/* 浮动唤起胶囊（仅博主已登录时可见） */}
      <div className="fixed bottom-6 left-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-lg backdrop-blur-xl hover:border-theme hover:text-theme dark:border-white/10 dark:bg-neutral-900/80 dark:text-neutral-300 dark:hover:border-theme dark:hover:text-theme transition-all"
          title="展开前台美学工坊"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-theme/10 text-theme group-hover:scale-110 transition-transform">
            <i className="ri-palette-line text-xs" />
          </span>
          <span className="font-mono">美学工坊</span>
          {saving ? <span className="h-1.5 w-1.5 rounded-full bg-theme animate-ping" /> : null}
        </button>
      </div>

      {/* 抽屉浮层遮罩 */}
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {/* 美学工坊滑出抽屉 */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-sm border-r border-black/10 bg-white/95 dark:border-white/10 dark:bg-[#12161f]/95 shadow-2xl backdrop-blur-2xl transition-transform duration-300 select-none flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-black/5 p-4 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme">
              <i className="ri-equalizer-line text-sm" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">前台美学工坊</h2>
              <p className="text-[11px] text-neutral-400 font-mono">In-Situ Aesthetic Studio</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* 核心配置流 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 1. 卡片版式骨架 (4 种结构级差异变体) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              卡片版式骨架
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CARD_VARIANTS.map((variant) => {
                const isSelected = activeVariant === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => handleSelectVariant(variant.id)}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-theme bg-theme/5 shadow-2xs text-theme"
                        : "border-black/5 hover:border-black/15 bg-neutral-50/50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-white/15 text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <i className={variant.icon} />
                      <span>{variant.label}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-1 line-clamp-1">
                      {variant.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 温润多层氛围色盘 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              氛围色盘
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CURATED_PRESETS.map((preset) => {
                const isSelected = activeColor.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectColor(preset.color)}
                    className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "border-theme shadow-xs ring-2 ring-theme/20"
                        : "border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20"
                    }`}
                    title={preset.name}
                  >
                    <span
                      className="h-6 w-6 rounded-full shadow-xs transition-transform group-hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: preset.color }}
                    >
                      {isSelected ? <i className="ri-check-line text-white text-xs" /> : null}
                    </span>
                    <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-full">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 瀑布流排布列数 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              瀑布流排布列数
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: "auto", label: "自适应" },
                { id: "2", label: "2 列" },
                { id: "3", label: "3 列" },
                { id: "4", label: "4 列" },
              ].map((col) => {
                const isSelected = activeColumns === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleSelectColumns(col.id)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? "border-theme bg-theme text-white"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. 页面留白间距 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              页面留白间距
            </label>
            <div className="flex items-center gap-2">
              {[
                { val: 16, label: "紧凑 16px" },
                { val: 24, label: "标准 24px" },
                { val: 32, label: "宽松 32px" },
              ].map((g) => {
                const isSelected = Number(activeGap) === g.val;
                return (
                  <button
                    key={g.val}
                    type="button"
                    onClick={() => handleSelectGap(g.val)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? "border-theme bg-theme text-white"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. 卡片透光度 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              卡片透光度
            </label>
            <div className="flex items-center gap-2">
              {[100, 85, 70].map((val) => {
                const isSelected = Number(activeOpacity) === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectOpacity(val)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? "border-theme bg-theme text-white"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {val}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. 日夜光照模式 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              光照模式
            </label>
            <button
              type="button"
              onClick={handleToggleThemeMode}
              className="w-full flex items-center justify-between p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:bg-neutral-100 dark:hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <i className="ri-sun-line text-amber-500" />
                <span>日夜模式极速切换</span>
              </div>
              <span className="text-xs font-mono text-neutral-400">切换</span>
            </button>
          </div>
        </div>

        {/* 底部：底层机房快捷通道 */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.01]">
          <a
            href="/admin/dashboard"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold shadow-xs hover:opacity-90 transition active:scale-98"
          >
            <i className="ri-dashboard-3-line" />
            <span>进入底层机房 (Engine Room)</span>
          </a>
        </div>
      </div>
    </>,
    document.body
  );
}
