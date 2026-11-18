import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { AmbientEffectsCanvas, normalizeAmbienceMode, type AmbienceMode } from "../ambient-effects-canvas";

export { WALLPAPER_PRESETS } from "../../utils/theme-color";

/**
 * 全站环境氛围画布宿主（遵守《美化章程》第一章与第五章）：
 * - 彻底废除 420px 多 Tab 侧滑大抽屉、左侧悬浮轨与重复日夜按钮；
 * - 仅在前台挂载由站点配置 (`theme.ambience`) 驱动的粒子画布；
 * - 管理员前台“点一下即切换”快捷操作统一收口至 InSituDeskDock，完整配置统一归口后台 /admin/settings。
 */
export function InSituAestheticStudio() {
  // REACT HOOKS 铁律：全部 Hooks 无条件置于组件顶层
  const [location] = useLocation();
  const siteConfig = useSiteConfig();
  const isAdminRoute = location.startsWith("/admin");

  const [ambienceMode, setAmbienceMode] = useState<AmbienceMode>(() =>
    normalizeAmbienceMode(siteConfig.themeAmbience)
  );

  // 响应后台配置或管理员一键循环切换的实时同步
  useEffect(() => {
    setAmbienceMode(normalizeAmbienceMode(siteConfig.themeAmbience));
  }, [siteConfig.themeAmbience]);

  useEffect(() => {
    const handleAmbienceChange = (e: Event) => {
      const next = (e as CustomEvent<{ mode?: AmbienceMode }>).detail?.mode;
      if (next) {
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
