import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { ProfileContext } from "../../state/profile";
import { InSituWritingDrawer } from "./in-situ-writing-drawer";
import { InSituMediaDrawer } from "./in-situ-media-drawer";

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

  useEffect(() => {
    const handleOpenWriting = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEditId(detail?.id || null);
      setWritingOpen(true);
    };
    const handleOpenMedia = () => setMediaOpen(true);

    window.addEventListener("rin:open-writing-drawer", handleOpenWriting);
    window.addEventListener("rin:open-media-drawer", handleOpenMedia);

    return () => {
      window.removeEventListener("rin:open-writing-drawer", handleOpenWriting);
      window.removeEventListener("rin:open-media-drawer", handleOpenMedia);
    };
  }, []);

  if (!profile?.permission || location.startsWith("/admin")) {
    return null;
  }

  return createPortal(
    <>
      <InSituWritingDrawer
        isOpen={writingOpen}
        onClose={() => {
          setWritingOpen(false);
          setEditId(null);
        }}
        editId={editId}
      />

      <InSituMediaDrawer
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
      />
    </>,
    document.body
  );
}
