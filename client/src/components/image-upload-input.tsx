import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import {
  DEFAULT_IMAGE_MAX_FILE_SIZE,
  isImageFile,
  uploadImageFile,
} from "../utils/image-upload";

type ImageUploadInputProps = {
  value: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  shape?: "rounded" | "circle";
  maxFileSize?: number;
};

export function ImageUploadInput({
  value,
  onChange,
  onError,
  placeholder,
  disabled = false,
  shape = "rounded",
  maxFileSize = DEFAULT_IMAGE_MAX_FILE_SIZE,
}: ImageUploadInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const roundedClass = shape === "circle" ? "rounded-full" : "rounded-2xl";

  const showError = (message: string) => {
    onError?.(message || t("upload.failed"));
  };

  const handleFile = async (file: File) => {
    if (!isImageFile(file)) {
      showError(t("upload.image.invalid_type"));
      return;
    }

    if (file.size > maxFileSize) {
      showError(t("upload.failed$size", { size: Math.round(maxFileSize / 1024 / 1024) }));
      return;
    }

    setUploading(true);
    try {
      const result = await uploadImageFile(file);
      onChange(result.url);
    } catch (error) {
      showError(error instanceof Error ? error.message : t("upload.failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* 紧凑左右组件排布：左侧为无损预览+拖拽上传合一区，右侧为直链输入与图库选择 */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        {/* 左侧：集预览、拖拽放置与点击上传于一体的紧凑方块 (节省 60% 纵向高度) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !uploading) setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (disabled || uploading) return;
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onClick={() => {
            if (!disabled && !uploading) inputRef.current?.click();
          }}
          className={`relative group h-24 sm:h-28 w-full sm:w-44 shrink-0 flex flex-col items-center justify-center ${roundedClass} border-2 border-dashed p-1.5 transition-all cursor-pointer overflow-hidden ${
            dragging
              ? "border-theme bg-theme/10 ring-2 ring-theme/30 scale-[1.02]"
              : value
              ? "border-theme/40 bg-black/[0.02] dark:bg-white/[0.02]"
              : "border-black/15 bg-black/[0.015] hover:border-theme/50 dark:border-white/15 dark:bg-white/[0.02]"
          }`}
          title="点击或拖拽图片到此处上传"
        >
          {value ? (
            <>
              <img
                src={value}
                alt={t("upload.image.preview_alt")}
                className="h-full w-full object-contain rounded-xl"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1 backdrop-blur-xs">
                <i className="ri-upload-2-line" />
                <span>更换图片</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-neutral-400 p-2 text-center">
              <i className="ri-image-add-line text-2xl text-theme/70 mb-1" />
              <span className="text-[11px] font-bold t-primary">点击或拖放图片</span>
              <span className="text-[9px] font-mono text-neutral-400 mt-0.5">建议 800×480 像素</span>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs text-white text-xs font-semibold gap-1.5">
              <ReactLoading type="spin" color="#ffffff" height={16} width={16} />
              <span>上传中...</span>
            </div>
          )}
        </div>

        {/* 右侧：URL 直链填入与快捷操作 */}
        <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
          <div>
            <label className="text-[10px] font-mono text-neutral-400 block mb-1">
              图片访问直链 (支持手动输入或粘贴 R2 链接 · 推荐 800×480)
            </label>
            <input
              type="url"
              value={value}
              disabled={disabled || uploading}
              placeholder={placeholder || "https://..."}
              onChange={(e) => onChange(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-w px-3 py-2 text-xs t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-theme dark:border-white/10 dark:bg-white/[0.02]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-w px-3 py-1.5 text-xs font-semibold t-primary hover:border-theme hover:text-theme transition dark:border-white/10 dark:bg-white/[0.02]"
            >
              <i className="ri-upload-cloud-line text-sm" />
              <span>本地上传</span>
            </button>

            <a
              href="/admin/files"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-w px-3 py-1.5 text-xs font-semibold t-primary hover:border-theme hover:text-theme transition dark:border-white/10 dark:bg-white/[0.02]"
              title="在新窗口打开图床媒体库复制直链"
            >
              <i className="ri-folder-image-line text-sm" />
              <span>图床选择</span>
            </a>

            {value && (
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                title="清空当前图片"
              >
                <i className="ri-delete-bin-line" />
                <span>清空</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
        }}
      />
    </div>
  );
}
