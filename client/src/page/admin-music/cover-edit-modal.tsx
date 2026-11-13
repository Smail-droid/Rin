import { createPortal } from "react-dom";
import type { R2MusicFileItem } from "../../services/music-api";
import { cleanDisplayTitle } from "./types";

interface CoverEditModalProps {
  coverTargetFile: R2MusicFileItem | null;
  coverInputUrl: string;
  setCoverInputUrl: (url: string) => void;
  onClose: () => void;
  onSave: (file: R2MusicFileItem, url: string) => void;
  onAutoSniff: (file: R2MusicFileItem) => void;
  onOpenMediaPicker: () => void;
}

export function CoverEditModal({
  coverTargetFile,
  coverInputUrl,
  setCoverInputUrl,
  onClose,
  onSave,
  onAutoSniff,
  onOpenMediaPicker,
}: CoverEditModalProps) {
  if (!coverTargetFile || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 ani-show"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-5 border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <h4 className="font-bold text-sm t-primary flex items-center gap-1.5 truncate">
            <i className="ri-image-edit-line text-theme shrink-0" />
            <span className="truncate">更换专辑封面 · {cleanDisplayTitle(coverTargetFile.displayName)}</span>
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="space-y-1.5 text-xs">
          <label className="text-[11px] font-bold text-neutral-500">封面图片直链 URL</label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={coverInputUrl}
              onChange={(e) => setCoverInputUrl(e.target.value)}
              placeholder="输入封面图片 URL (自动转存 R2 存储桶)"
              className="flex-1 rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs outline-none focus:border-theme"
            />
            <button
              type="button"
              onClick={onOpenMediaPicker}
              className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 font-bold shrink-0 transition"
              title="从 R2 媒体库中挑选已有的封面图片"
            >
              媒体库
            </button>
          </div>
        </div>

        {/* 封面预览 */}
        {coverInputUrl.trim() && (
          <div className="flex items-center justify-center p-3 rounded-xl bg-black/5 dark:bg-white/5">
            <img
              src={coverInputUrl.trim()}
              alt="预览"
              className="h-28 w-28 rounded-xl object-cover shadow-md"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-xs">
          <button
            type="button"
            onClick={() => onAutoSniff(coverTargetFile)}
            className="text-theme hover:underline font-bold flex items-center gap-1"
          >
            <i className="ri-magic-line" />
            <span>自动嗅探封面</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-neutral-400 hover:bg-black/5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => onSave(coverTargetFile, coverInputUrl)}
              disabled={!coverInputUrl.trim()}
              className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover disabled:opacity-40"
            >
              保存并生效
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
