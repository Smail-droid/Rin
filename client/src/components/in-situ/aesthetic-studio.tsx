import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { AmbientEffectsCanvas, normalizeAmbienceMode, type AmbienceMode } from "../ambient-effects-canvas";

/**
 * 全站环境氛围画布宿主（遵守《美化章程》第五章）：
 * - 支持后台默认配置 (`theme.ambience`) 与访客在顶部居中微工具栏的独立实时开关；
 * - 零侧滑抽屉、零悬浮轨、零重复日夜按钮。
 */
export function InSituAestheticStudio() {
  const [location] = useLocation();
  const siteConfig = useSiteConfig();
  const isAdminRoute = location.startsWith("/admin");

  const [ambienceMode, setAmbienceMode] = useState<AmbienceMode>(() => {
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
    setAmbienceMode(normalizeAmbienceMode(siteConfig.themeAmbience));
  }, [siteConfig.themeAmbience]);

  useEffect(() => {
    const handleAmbienceChange = (e: Event) => {
      const next = (e as CustomEvent<{ mode?: AmbienceMode }>).detail?.mode;
      if (next !== undefined) {
        setAmbienceMode(normalizeAmbienceMode(next));
      }
    };
    window.addEventListener("rin:ambience-updated", handleAmbienceChange);
    return () => window.removeEventListener("rin:ambience-updated", handleAmbienceChange);
  }, []);

  if (isAdminRoute || ambienceMode === "none") {
    return null;
  }

  return createPortal(<AmbientEffectsCanvas mode={ambienceMode} />, document.body);
}
