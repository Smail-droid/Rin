import { useEffect, useState } from "react";
import { useSiteConfig } from "../hooks/useSiteConfig";

export function GlobalReadingProgress() {
  const siteConfig = useSiteConfig();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!siteConfig.themeReadingProgress) {
      setProgress(0);
      return;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setProgress(0);
        return;
      }
      const pct = Math.min(100, Math.max(0, (scrollY / docHeight) * 100));
      setProgress(pct);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [siteConfig.themeReadingProgress]);

  if (!siteConfig.themeReadingProgress) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none transition-all duration-150 ease-out"
      style={{
        background: `linear-gradient(90deg, var(--theme-color, #fc466b) 0%, #38bdf8 50%, #a855f7 100%)`,
        width: `${progress}%`,
        boxShadow: "0 0 12px rgba(var(--theme-rgb, 252 70 107) / 0.6)",
      }}
    />
  );
}
