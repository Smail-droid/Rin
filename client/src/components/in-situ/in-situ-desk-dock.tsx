import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * 管理员前台在场操作事件降级守卫：
 * 彻底废弃 1/2 半屏抽屉，接收历史广播时平滑跳转全屏专属工作台。
 */
export function InSituDeskDock() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleOpenWriting = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setLocation(detail?.id ? `/admin/writing/${detail.id}` : "/admin/writing");
    };
    const handleOpenMedia = () => setLocation("/gallery");
    const handleOpenAppearance = () => setLocation("/admin/settings?tab=theme");

    window.addEventListener("rin:open-writing-drawer", handleOpenWriting);
    window.addEventListener("rin:open-media-drawer", handleOpenMedia);
    window.addEventListener("rin:open-appearance-drawer", handleOpenAppearance);

    return () => {
      window.removeEventListener("rin:open-writing-drawer", handleOpenWriting);
      window.removeEventListener("rin:open-media-drawer", handleOpenMedia);
      window.removeEventListener("rin:open-appearance-drawer", handleOpenAppearance);
    };
  }, [setLocation]);

  return null;
}
