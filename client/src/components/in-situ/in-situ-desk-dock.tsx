import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ProfileContext } from "../../state/profile";
import { InSituWritingDrawer } from "./in-situ-writing-drawer";
import { InSituMediaDrawer } from "./in-situ-media-drawer";
import { InSituSettingsDrawer } from "./in-situ-settings-drawer";

export function InSituDeskDock() {
  const profile = useContext(ProfileContext);

  const [writingOpen, setWritingOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Listen to global open requests (e.g. from article cards or shortcuts)
  useEffect(() => {
    const handleOpenWriting = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEditId(detail?.id || null);
      setWritingOpen(true);
    };

    const handleOpenMedia = () => setMediaOpen(true);
    const handleOpenSettings = () => setSettingsOpen(true);

    window.addEventListener("rin:open-writing-drawer", handleOpenWriting);
    window.addEventListener("rin:open-media-drawer", handleOpenMedia);
    window.addEventListener("rin:open-settings-drawer", handleOpenSettings);

    return () => {
      window.removeEventListener("rin:open-writing-drawer", handleOpenWriting);
      window.removeEventListener("rin:open-media-drawer", handleOpenMedia);
      window.removeEventListener("rin:open-settings-drawer", handleOpenSettings);
    };
  }, []);

  // Only render desk objects when admin is signed in
  if (!profile?.permission) {
    return null;
  }

  return createPortal(
    <>
      {/* 具象化在场工坊侍从坞 (Desk Atelier Objects) - 右下角优雅常驻 */}
      <aside
        aria-label="在场工坊桌面物件"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 select-none"
      >
        <div className="flex items-center gap-1.5 p-1 rounded-full border border-black/10 bg-white/85 dark:border-white/10 dark:bg-neutral-900/85 shadow-lg backdrop-blur-xl transition-all">
          {/* 1. 灵感笔筒 (Quill & Desk) */}
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setWritingOpen(true);
            }}
            className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-theme/10 hover:bg-theme text-theme hover:text-white shadow-2xs hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="灵感笔筒 · 原地撰写新文章"
          >
            <i className="ri-quill-pen-line text-lg group-hover:rotate-[-8deg] transition-transform" />
          </button>

          {/* 2. 暗房胶卷盒 (Media Darkroom) */}
          <button
            type="button"
            onClick={() => setMediaOpen(true)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-black/5 hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-white dark:hover:bg-white/20 shadow-2xs hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="暗房胶卷盒 · 媒体与音轨中心"
          >
            <i className="ri-folder-image-line text-lg group-hover:scale-110 transition-transform" />
          </button>

          {/* 3. 系统百宝箱 (Cabinet) */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-black/5 hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-white dark:hover:bg-white/20 shadow-2xs hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="百宝箱 · 在场微调全站配置"
          >
            <i className="ri-settings-4-line text-lg group-hover:rotate-45 transition-transform" />
          </button>
        </div>
      </aside>

      {/* 3 大在场式抽屉 */}
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

      <InSituSettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>,
    document.body
  );
}
