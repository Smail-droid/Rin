import { Suspense, lazy, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { ProfileContext } from "../../state/profile";

const InSituWritingDrawer = lazy(() =>
  import("./in-situ-writing-drawer").then((m) => ({ default: m.InSituWritingDrawer }))
);
const InSituMediaDrawer = lazy(() =>
  import("./in-situ-media-drawer").then((m) => ({ default: m.InSituMediaDrawer }))
);
const InSituAppearanceDrawer = lazy(() =>
  import("./in-situ-appearance-drawer").then((m) => ({ default: m.InSituAppearanceDrawer }))
);

/**
 * 管理员前台在场撰写与媒体抽屉宿主（零悬浮胶囊）：
 * 可见快捷操作已自然嵌入页面上方居中 TopAtelierRibbon，本组件仅响应事件挂载抽屉。
 */
export function InSituDeskDock() {
  // REACT HOOKS 铁律：所有 Hooks 无条件置于组件顶层
  const [location] = useLocation();
  const profile = useContext(ProfileContext);
  const [writingOpen, setWritingOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  useEffect(() => {
    const handleOpenWriting = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEditId(detail?.id || null);
      setWritingOpen(true);
    };
    const handleOpenMedia = () => setMediaOpen(true);
    const handleOpenAppearance = () => setAppearanceOpen(true);

    window.addEventListener("rin:open-writing-drawer", handleOpenWriting);
    window.addEventListener("rin:open-media-drawer", handleOpenMedia);
    window.addEventListener("rin:open-appearance-drawer", handleOpenAppearance);

    return () => {
      window.removeEventListener("rin:open-writing-drawer", handleOpenWriting);
      window.removeEventListener("rin:open-media-drawer", handleOpenMedia);
      window.removeEventListener("rin:open-appearance-drawer", handleOpenAppearance);
    };
  }, []);

  if (!profile?.permission || location.startsWith("/admin")) {
    return null;
  }

  return createPortal(
    <Suspense fallback={null}>
      {writingOpen && (
        <InSituWritingDrawer
          isOpen={writingOpen}
          onClose={() => {
            setWritingOpen(false);
            setEditId(null);
          }}
          editId={editId}
        />
      )}

      {mediaOpen && (
        <InSituMediaDrawer
          isOpen={mediaOpen}
          onClose={() => setMediaOpen(false)}
        />
      )}

      {appearanceOpen && (
        <InSituAppearanceDrawer
          isOpen={appearanceOpen}
          onClose={() => setAppearanceOpen(false)}
        />
      )}
    </Suspense>,
    document.body
  );
}
