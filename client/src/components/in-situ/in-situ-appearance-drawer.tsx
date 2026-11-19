import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { client } from "../../app/runtime";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import {
  applyThemeFontFamily,
  applyThemeFontSize,
  applyThemeOpacity,
} from "../../utils/theme-color";

export function InSituAppearanceDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const siteConfig = useSiteConfig();

  // Local state for responsive real-time preview
  const [baseFontSize, setBaseFontSize] = useState<number>(siteConfig.themeFontSize || 16);
  const [navFontSize, setNavFontSize] = useState<number>(siteConfig.headerNavFontSize || 15);
  const [navGap, setNavGap] = useState<number>(siteConfig.headerNavGap || 12);
  const [headerLayout, setHeaderLayout] = useState<string>(siteConfig.headerLayout || "classic");
  const [navOrganicTilt, setNavOrganicTilt] = useState<boolean>(siteConfig.headerNavOrganicTilt !== false);
  const [fontFamily, setFontFamily] = useState<string>("sans");
  const [cardGap, setCardGap] = useState<number>(siteConfig.galleryCardGap || 24);
  const [tiltDegree, setTiltDegree] = useState<number>(siteConfig.galleryTiltDegree ?? 1.8);
  const [opacity, setOpacity] = useState<number>(siteConfig.themeOpacity || 100);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBaseFontSize(siteConfig.themeFontSize || 16);
      setNavFontSize(siteConfig.headerNavFontSize || 15);
      setNavGap(siteConfig.headerNavGap || 12);
      setHeaderLayout(siteConfig.headerLayout || "classic");
      setNavOrganicTilt(siteConfig.headerNavOrganicTilt !== false);
      setCardGap(siteConfig.galleryCardGap || 24);
      setTiltDegree(siteConfig.galleryTiltDegree ?? 1.8);
      setOpacity(siteConfig.themeOpacity || 100);
    }
  }, [isOpen, siteConfig]);

  // Persist with 350ms debounce
  const schedulePersist = useCallback((updates: Record<string, unknown>) => {
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(async () => {
      try {
        const cached = sessionStorage.getItem("config");
        const parsed = cached ? JSON.parse(cached) : {};
        const next = { ...parsed, ...updates };
        sessionStorage.setItem("config", JSON.stringify(next));
        window.dispatchEvent(new Event("rin:config-updated"));
        await client.config.update("client", updates);
      } catch (err) {
        console.error("Failed to persist appearance config:", err);
      }
    }, 350);
  }, []);

  const handleBaseFontSizeChange = (val: number) => {
    setBaseFontSize(val);
    applyThemeFontSize(val);
    schedulePersist({ "theme.font_size": val });
  };

  const handleNavFontSizeChange = (val: number) => {
    setNavFontSize(val);
    schedulePersist({ "header.nav_font_size": val });
  };

  const handleNavGapChange = (val: number) => {
    setNavGap(val);
    schedulePersist({ "header.nav_gap": val });
  };

  const handleHeaderLayoutChange = (val: string) => {
    setHeaderLayout(val);
    schedulePersist({ "header.layout": val });
  };

  const handleNavOrganicTiltToggle = () => {
    const next = !navOrganicTilt;
    setNavOrganicTilt(next);
    schedulePersist({ "header.nav_organic_tilt": next });
  };

  const handleFontFamilyChange = (val: string) => {
    setFontFamily(val);
    applyThemeFontFamily(val);
    schedulePersist({ "theme.font_family": val });
  };

  const handleCardGapChange = (val: number) => {
    setCardGap(val);
    schedulePersist({ "gallery.card_gap": val });
  };

  const handleTiltDegreeChange = (val: number) => {
    setTiltDegree(val);
    schedulePersist({ "gallery.tilt_degree": val });
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    applyThemeOpacity(val);
    schedulePersist({ "theme.opacity": val });
  };

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-l border-neutral-200/80 dark:border-white/10 shadow-2xl flex flex-col z-10 overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shadow-2xs">
              <i className="ri-equalizer-line" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                前台排版与导航工坊
              </h2>
              <p className="text-[11px] text-neutral-400">
                实时调节字号、间距与排布，即刻所见即所得
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Section 1: 顶栏导航字体与间距 */}
          <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <span className="font-bold text-xs text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                <i className="ri-compass-3-line text-theme" />
                <span>顶栏导航设置</span>
              </span>
              <span className="text-[10px] text-neutral-400">Header Nav</span>
            </div>

            {/* 导航字号 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  导航文字大小
                </span>
                <span className="font-mono text-theme font-bold">{navFontSize}px</span>
              </div>
              <input
                type="range"
                min={12}
                max={20}
                step={1}
                value={navFontSize}
                onChange={(e) => handleNavFontSizeChange(Number(e.target.value))}
                className="w-full accent-theme cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>小巧 12px</span>
                <span>默认 15px</span>
                <span>清晰 20px</span>
              </div>
            </div>

            {/* 导航间距 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  导航项间距 (Gap)
                </span>
                <span className="font-mono text-theme font-bold">{navGap}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={28}
                step={2}
                value={navGap}
                onChange={(e) => handleNavGapChange(Number(e.target.value))}
                className="w-full accent-theme cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>紧凑 4px</span>
                <span>适中 12px</span>
                <span>宽裕 28px</span>
              </div>
            </div>

            {/* 导航排布组合 */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 block">
                导航排布组合
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "classic", label: "居中自然", icon: "ri-align-center", desc: "纯文字融入画布" },
                  { id: "dock", label: "胶囊托盘", icon: "ri-capsule-line", desc: "悬浮磨砂托盘" },
                  { id: "compact", label: "靠左紧凑", icon: "ri-align-left", desc: "经典左侧排布" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleHeaderLayoutChange(item.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer select-none ${
                      headerLayout === item.id
                        ? "border-theme bg-theme/10 ring-1 ring-theme/30 text-theme font-bold shadow-2xs"
                        : "border-black/10 dark:border-white/10 bg-black/[0.01] hover:bg-black/5 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <i className={`${item.icon} text-sm mb-0.5`} />
                    <span className="text-[11px]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 手账微倾角 */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 block">
                  手账灵动微倾角
                </span>
                <span className="text-[10px] text-neutral-400">
                  纯文字自然微斜排布，拒绝机械呆板
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={navOrganicTilt}
                onClick={handleNavOrganicTiltToggle}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  navOrganicTilt ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                    navOrganicTilt ? "translate-x-4.5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 2: 全站字体与字阶 */}
          <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <span className="font-bold text-xs text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                <i className="ri-font-size text-theme" />
                <span>全站正文字阶与字体</span>
              </span>
              <span className="text-[10px] text-neutral-400">Typography</span>
            </div>

            {/* 全站基础字号 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  全站基准字号 (Base Size)
                </span>
                <span className="font-mono text-theme font-bold">{baseFontSize}px</span>
              </div>
              <input
                type="range"
                min={13}
                max={22}
                step={1}
                value={baseFontSize}
                onChange={(e) => handleBaseFontSizeChange(Number(e.target.value))}
                className="w-full accent-theme cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>小巧 13px</span>
                <span>标准 16px</span>
                <span>大号 22px</span>
              </div>
            </div>

            {/* 字体族选择 */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 block">
                正文字体族
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "sans", label: "无衬线", desc: "清爽现代" },
                  { id: "serif", label: "优雅衬线", desc: "杂志社论" },
                  { id: "mono", label: "极客等宽", desc: "代码工坊" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleFontFamilyChange(item.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition cursor-pointer select-none ${
                      fontFamily === item.id
                        ? "border-theme bg-theme/10 ring-1 ring-theme/30 text-theme font-bold shadow-2xs"
                        : "border-black/10 dark:border-white/10 bg-black/[0.01] hover:bg-black/5 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <span className="text-xs font-semibold">{item.label}</span>
                    <span className="text-[9px] text-neutral-400 scale-90">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: 画廊密度与通透度 */}
          <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <span className="font-bold text-xs text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                <i className="ri-layout-masonry-line text-theme" />
                <span>画廊卡片间距与质感</span>
              </span>
              <span className="text-[10px] text-neutral-400">Gallery Density</span>
            </div>

            {/* 卡片间距 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  卡片间距 (Card Gap)
                </span>
                <span className="font-mono text-theme font-bold">{cardGap}px</span>
              </div>
              <input
                type="range"
                min={8}
                max={40}
                step={2}
                value={cardGap}
                onChange={(e) => handleCardGapChange(Number(e.target.value))}
                className="w-full accent-theme cursor-pointer"
              />
            </div>

            {/* 拍立得倾斜角 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  拍立得微倾角度
                </span>
                <span className="font-mono text-theme font-bold">{tiltDegree.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={0.2}
                value={tiltDegree}
                onChange={(e) => handleTiltDegreeChange(Number(e.target.value))}
                className="w-full accent-theme cursor-pointer"
              />
            </div>

            {/* 卡片通透度 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  卡片通透度 (Opacity)
                </span>
                <span className="font-mono text-theme font-bold">{opacity}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={opacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                className="w-full accent-theme cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between shrink-0 text-xs">
          <span className="text-[11px] text-neutral-400">
            所有更改均实时保存至站点配置
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-2xs hover:bg-theme-hover active:scale-95 transition cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
