import { Modal, Spinner } from "@rin/ui";
import { useEffect, useMemo, useState } from "react";
import type { StorageFileItem } from "../api/client";
import { client } from "../app/runtime";
import { ImageWithFallback } from "./image-with-fallback";

export function R2MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = "选择 R2 存储桶图片",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  title?: string;
}) {
  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    client.storage
      .listFiles({ limit: 100 })
      .then(({ data }) => {
        if (data?.files && Array.isArray(data.files)) {
          // 仅筛选图像类资源
          const imageItems = data.files.filter((item: StorageFileItem) => {
            const isImgType = item.contentType?.startsWith("image/");
            const isImgExt = /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico)$/i.test(item.key);
            return isImgType || isImgExt;
          });
          setFiles(imageItems);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.key.toLowerCase().includes(q));
  }, [files, search]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel={title}
      panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-2xl w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
    >
      <div className="flex flex-col gap-3.5 max-h-[82vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shadow-2xs">
              <i className="ri-folder-image-line" />
            </span>
            <div>
              <h3 className="text-sm font-bold t-primary">{title}</h3>
              <p className="text-[11px] text-neutral-400">
                从 Cloudflare R2 对象存储桶中点选已有相册图片
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索图片文件名..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-theme/40 outline-hidden transition"
          />
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-[260px] max-h-[50vh]">
          {loading ? (
            <div className="py-20 text-center text-neutral-400 flex flex-col items-center justify-center gap-2">
              <Spinner label="正在读取 R2 存储桶图片..." />
              <span className="text-xs">正在从 R2 边缘节点检索相册资源...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center">
              <i className="ri-image-line text-3xl mb-1 opacity-40" />
              <p className="text-xs">{search ? "未找到匹配名称的图片" : "R2 存储桶中暂无图片文件"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredFiles.map((file) => {
                const fileName = file.key.split("/").pop() || file.key;
                return (
                  <div
                    key={file.key}
                    onClick={() => {
                      onSelect(file.url);
                      onClose();
                    }}
                    className="group relative flex flex-col rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-1.5 cursor-pointer hover:border-theme hover:shadow-md transition-all select-none overflow-hidden"
                    title={`点击选取: ${fileName}`}
                  >
                    <div className="h-24 sm:h-28 w-full rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center relative">
                      <ImageWithFallback
                        src={file.url}
                        alt={fileName}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-theme/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-2 py-1 rounded-md bg-white text-theme text-[10px] font-bold shadow-sm">
                          选择此图
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-600 dark:text-neutral-300 truncate mt-1 px-0.5">
                      {fileName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-[11px] text-neutral-400">
          <span>共载入 {filteredFiles.length} 张媒体图片</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-black/10 text-neutral-600 dark:border-white/10 dark:text-neutral-300 hover:bg-black/5 transition"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}
