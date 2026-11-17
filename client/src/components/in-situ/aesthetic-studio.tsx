import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { client } from "../../app/runtime";
import { THEME_PRESETS, applyThemeColor, applyThemeOpacity, applyThemeFontFamily } from "../../utils/theme-color";
import { getStoredThemeMode, setThemeMode, type ThemeMode } from "../../utils/darkModeUtils";
import { type FeedCardVariant } from "../feed-card-options";

const CURATED_PRESETS = THEME_PRESETS.slice(0, 8);

interface MasterPreset {
  id: "scrapbook" | "editorial" | "terminal";
  name: string;
  badge: string;
  icon: string;
  desc: string;
  config: Record<string, unknown>;
}

const MASTER_PRESETS: MasterPreset[] = [
  {
    id: "scrapbook",
    name: "🌸 和风手账",
    badge: "Indie Scrapbook",
    icon: "ri-camera-lens-line",
    desc: "16:9 拍立得拟物卡片、温润微光、自然手账微倾、融入式经典顶栏",
    config: {
      "feed.card_variant": "default",
      "header.position": "top",
      "header.layout": "classic",
      "theme.font_family": "sans",
      "theme.color": "#fc466b",
      "gallery.tilt_mode": "subtle",
      "gallery.columns": "auto",
      "gallery.card_gap": 24,
      "gallery.padding": 24,
      "gallery.align": "center",
    },
  },
  {
    id: "editorial",
    name: "📝 京都社论",
    badge: "Editorial Journal",
    icon: "ri-book-open-line",
    desc: "宽幅画报横屏、纯粹典雅衬线排印、极简纯文本融入式顶栏",
    config: {
      "feed.card_variant": "editorial",
      "header.position": "top",
      "header.layout": "compact",
      "theme.font_family": "serif",
      "theme.color": "#27272a",
      "gallery.tilt_mode": "flat",
      "gallery.columns": "auto",
      "gallery.card_gap": 24,
      "gallery.padding": 24,
      "gallery.align": "center",
    },
  },
  {
    id: "terminal",
    name: "💻 极客墨影",
    badge: "Dark Terminal",
    icon: "ri-terminal-box-line",
    desc: "44px 高密单行、便签自适应单行终端条、极简融入顶栏",
    config: {
      "feed.card_variant": "compact",
      "header.position": "top",
      "header.layout": "compact",
      "theme.font_family": "mono",
      "theme.color": "#00f2fe",
      "gallery.tilt_mode": "flat",
      "gallery.columns": "auto",
      "gallery.card_gap": 16,
      "gallery.padding": 24,
      "gallery.align": "fluid",
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

  useEffect(() => {
    if (siteConfig.name) setSiteNameVal(siteConfig.name);
    if (siteConfig.description) setSiteDescVal(siteConfig.description);
  }, [siteConfig.name, siteConfig.description]);

  // 严格在所有 Hooks 之后返回（杜绝 React Error #310 / #300 钩子数量不匹配）
  if (location.startsWith("/admin")) {
    return null;
  }

  const activeVariant = (siteConfig.feedCardVariant || "default") as FeedCardVariant;
  const activeColor = siteConfig.themeColor || "#fc466b";
  const activeOpacity = siteConfig.themeOpacity ?? 100;
  const activeColumns = String(siteConfig.galleryColumns ?? "auto");
  const activeGap = siteConfig.galleryCardGap ?? 24;
  const activePadding = siteConfig.galleryPadding ?? 24;
  const activeAlign = siteConfig.galleryAlign || "center";
  const activeHeaderLayout = siteConfig.headerLayout || "classic";
  const activeFontFamily = (() => {
    try {
      const cfg = JSON.parse(sessionStorage.getItem("config") || "{}");
      return String(cfg["theme.font_family"] || "sans");
    } catch {
      return "sans";
    }
  })();
  const activeHeaderPosition = String(siteConfig.headerPosition ?? "top");

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
    void persistConfig(preset.config);
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

  const handleSelectPadding = (pad: number) => {
    void persistConfig({ "gallery.padding": pad });
  };

  const handleSelectAlign = (align: string) => {
    void persistConfig({ "gallery.align": align });
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

  return createPortal(
    <>
      {/* 浮动唤起圆纽（仅前台展示，精致极简 40x40 矢量图标，杜绝文字突兀） */}
      <div className="fixed bottom-6 left-6 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/85 dark:border-white/10 dark:bg-neutral-900/85 shadow-lg backdrop-blur-xl hover:border-theme hover:scale-110 active:scale-95 transition-all text-neutral-600 dark:text-neutral-300 hover:text-theme cursor-pointer"
          title="前台美学工坊 (排版、色彩、留白与字族微调)"
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
          {/* 0. 站点基本身份与标语 */}
          <div className="space-y-2 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                站点名称与描述
              </label>
              <button
                type="button"
                onClick={handleSaveBrand}
                className="text-[11px] text-theme font-bold hover:underline cursor-pointer"
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

          {/* 大师级画廊意境一键预设 (Master Gallery Aesthetics) */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-gradient-to-br from-theme/5 to-transparent border border-theme/20 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-theme uppercase tracking-wider flex items-center gap-1.5">
                <i className="ri-magic-line" />
                <span>三大画廊意境一键变奏</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">1-Click</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {MASTER_PRESETS.map((preset) => {
                const isCurrent =
                  activeVariant === preset.config["feed.card_variant"] &&
                  activeHeaderPosition === preset.config["header.position"] &&
                  activeFontFamily === preset.config["theme.font_family"];
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyMasterPreset(preset)}
                    className={`group relative flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isCurrent
                        ? "border-theme bg-theme/10 ring-2 ring-theme/30 shadow-xs"
                        : "border-black/5 dark:border-white/5 bg-white/60 dark:bg-white/[0.02] hover:border-theme/40 hover:bg-white/90"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shrink-0 group-hover:scale-110 transition-transform">
                      <i className={preset.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs t-primary">{preset.name}</span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/10 text-neutral-500">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                        {preset.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

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

          {/* 2. 温润多色组合意境色盘 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                多色组合氛围色盘
              </label>
              <span className="text-[10px] font-mono text-neutral-400">主色 · 底色 · 辉光</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CURATED_PRESETS.map((preset) => {
                const isSelected = activeColor.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectColor(preset.color)}
                    className={`group flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-theme bg-theme/5 shadow-xs ring-2 ring-theme/20"
                        : "border-black/5 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] hover:border-black/20 dark:hover:border-white/20"
                    }`}
                    title={preset.description}
                  >
                    {/* 三色组合层叠色球 */}
                    <div className="flex items-center shrink-0">
                      <span
                        className="h-5 w-5 rounded-full shadow-2xs z-3 flex items-center justify-center text-white"
                        style={{ backgroundColor: preset.color }}
                      >
                        {isSelected ? <i className="ri-check-line text-[10px]" /> : null}
                      </span>
                      <span
                        className="h-4 w-4 rounded-full -ml-2 border border-white dark:border-neutral-900 shadow-2xs z-2"
                        style={{ backgroundColor: preset.previewBg }}
                      />
                      <span
                        className="h-3 w-3 rounded-full -ml-1.5 border border-white dark:border-neutral-900 shadow-2xs z-1"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block truncate">
                        {preset.name}
                      </span>
                      <span className="text-[9px] text-neutral-400 block truncate mt-0.5">
                        {preset.description}
                      </span>
                    </div>
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
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "auto", label: "自适应 Auto" },
                { id: "2", label: "2 列" },
                { id: "3", label: "3 列" },
                { id: "4", label: "4 列" },
                { id: "5", label: "5 列" },
              ].map((col) => {
                const isSelected = activeColumns === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleSelectColumns(col.id)}
                    className={`flex-1 min-w-[54px] py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? "border-theme bg-theme text-white shadow-2xs"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3.1 画廊两侧留白边距 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              首页两侧留白边距
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { val: 0, label: "无边距 0px" },
                { val: 12, label: "12px" },
                { val: 24, label: "24px" },
                { val: 48, label: "48px" },
                { val: 80, label: "80px" },
              ].map((p) => {
                const isSelected = Number(activePadding) === p.val;
                return (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handleSelectPadding(p.val)}
                    className={`flex-1 min-w-[54px] py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? "border-theme bg-theme text-white shadow-2xs"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3.2 画廊排版对齐方式 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              画廊排版对齐方式
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: "center", label: "居中聚拢 (Center)" },
                { id: "fluid", label: "撑满两端 (Fluid)" },
              ].map((a) => {
                const isSelected = activeAlign === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectAlign(a.id)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      isSelected
                        ? "border-theme bg-theme text-white shadow-2xs"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. 卡片间距与间隙 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              卡片列间距与间隙
            </label>
            <div className="flex items-center gap-2">
              {[
                { val: 12, label: "极密 12px" },
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
                        ? "border-theme bg-theme text-white shadow-2xs"
                        : "border-black/5 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. 全站排印字族 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              全站排印字族
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: "sans", label: "现代无衬线", desc: "极简现代" },
                { id: "serif", label: "典雅衬线", desc: "书卷杂志" },
                { id: "mono", label: "极客等宽", desc: "终端代码" },
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

          {/* 6. 顶栏导航风格 (文字直接嵌入网页，彻底杜绝悬浮遮挡与字体变形) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              顶栏文字排印风格 (嵌入网页)
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: "classic", label: "经典自然顶栏 (居中舒展)" },
                { id: "compact", label: "极简纯文本顶栏 (社论右对齐)" },
              ].map((hl) => {
                const isSelected = activeHeaderLayout === hl.id;
                return (
                  <button
                    key={hl.id}
                    type="button"
                    onClick={() => handleSelectHeaderLayout(hl.id)}
                    className={`flex-1 py-1.5 px-1.5 rounded-xl border text-[11px] font-bold transition-all text-center ${
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

          {/* 7. 卡片透光度 */}
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
