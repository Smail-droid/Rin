import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { ProfileContext } from "../../state/profile";
import { InSituWritingDrawer } from "./in-situ-writing-drawer";
import { InSituMediaDrawer } from "./in-situ-media-drawer";

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
      {/* 右下角轻巧管理员快捷操作条（与左侧 44px 悬浮轨保持同一设计语言；系统设置已整合进统一抽屉） */}
      <aside
        aria-label="管理员快捷操作栏"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1 p-1.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/85 dark:bg-[#131722]/85 shadow-[0_8px_28px_-8px_rgba(15,23,42,0.14)] backdrop-blur-md select-none"
      >
        <button
          type="button"
          onClick={() => {
            setEditId(null);
            setWritingOpen(true);
          }}
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme hover:bg-theme hover:text-white transition-all active:scale-95 cursor-pointer"
          title="写新文章"
        >
          <i className="ri-quill-pen-line text-[15px]" />
        </button>

        <button
          type="button"
          onClick={() => setMediaOpen(true)}
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-900 dark:hover:text-white transition-all active:scale-95 cursor-pointer"
          title="图床与媒体库"
        >
          <i className="ri-folder-image-line text-[15px]" />
        </button>

        <a
          href="/admin/music"
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-95 cursor-pointer"
          title="音乐曲库管理"
        >
          <i className="ri-music-2-line text-[15px]" />
        </a>

        <div className="mx-0.5 h-4 w-px bg-neutral-200/80 dark:bg-white/10" />

        <a
          href="/admin/dashboard"
          className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-900 dark:hover:text-white transition-all active:scale-95 cursor-pointer"
          title="后台总控台"
        >
          <i className="ri-dashboard-3-line text-[15px]" />
        </a>
      </aside>

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
