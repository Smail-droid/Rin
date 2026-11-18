import { useEffect, useRef } from "react";
import { useSiteConfig } from "../hooks/useSiteConfig";

/**
 * 顶部阅读进度条（纯 GPU 合成层驱动）：
 * 使用 rAF + transform: scaleX()，滚动过程 0 次 React 重渲染、0 次 Layout 重排。
 */
export function GlobalReadingProgress() {
  const siteConfig = useSiteConfig();
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteConfig.themeReadingProgress) return;

    let rafId: number | null = null;

    const updateBar = () => {
      rafId = null;
      const el = barRef.current;
      if (!el) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docHeight <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / docHeight));
      el.style.transform = `scaleX(${ratio})`;
    };

    const handleScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(updateBar);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    updateBar();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [siteConfig.themeReadingProgress]);

  if (!siteConfig.themeReadingProgress) return null;

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none origin-left will-change-transform"
      style={{
        background: `linear-gradient(90deg, rgb(var(--theme-rgb, 252 70 107)) 0%, #38bdf8 55%, #a855f7 100%)`,
        transform: "scaleX(0)",
        boxShadow: "0 0 10px rgb(var(--theme-rgb, 252 70 107) / 0.45)",
      }}
    />
  );
}
