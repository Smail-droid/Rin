import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { client } from "../../app/runtime";
import { useAlert } from "../dialog";
import type { StorageFileItem } from "../../api/client";
import { fetchR2MusicFiles, fetchR2StorageStats, uploadR2AudioFile, type R2MusicFileItem, type R2StorageStats } from "../../services/music-api";

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type CopyFormat = "url" | "html" | "markdown" | "bbcode";

function getCodeForFormat(file: StorageFileItem, format: CopyFormat): string {
  const url = file.url;
  const fileName = file.key.split("/").pop() || file.key;
  switch (format) {
    case "url":
      return url;
    case "html":
      return `<img src="${url}" alt="${fileName}" />`;
    case "markdown":
      return `![${fileName}](${url})`;
    case "bbcode":
      return `[img]${url}[/img]`;
    default:
      return url;
  }
}

export function InSituMediaDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showAlert, AlertUI } = useAlert();
  const [activeTab, setActiveTab] = useState<"image" | "music" | "file">("image");
  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [musicTracks, setMusicTracks] = useState<R2MusicFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cardFormats, setCardFormats] = useState<Record<string, CopyFormat>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // R2 Capacity Stats
  const [storageStats, setStorageStats] = useState<R2StorageStats | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, musicList, statsData] = await Promise.allSettled([
        client.storage.listFiles({ limit: 100 }),
        fetchR2MusicFiles(),
        fetchR2StorageStats(),
      ]);

      if (filesRes.status === "fulfilled" && filesRes.value.data) {
        setFiles(filesRes.value.data.files || []);
      }
      if (musicList.status === "fulfilled") {
        setMusicTracks(musicList.value || []);
      }
      if (statsData.status === "fulfilled") {
        setStorageStats(statsData.value);
      }
    } catch (err) {
      console.error("Fetch media failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen, fetchFiles]);

  // Upload handler for files
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const list = Array.from(fileList);
    if (list.length === 0) return;

    setUploading(true);
    let count = 0;
    for (const f of list) {
      try {
        const { data } = await client.storage.upload(f, f.name);
        if (data?.url) count++;
      } catch (err) {
        console.error("Upload error:", err);
      }
    }
    setUploading(false);
    if (count > 0) {
      showAlert(`成功上传 ${count} 个媒体文件！`);
      fetchFiles();
    }
  };

  // Upload handler for audio
  const handleUploadAudio = async (fileList: FileList | File[]) => {
    const list = Array.from(fileList);
    if (list.length === 0) return;

    setUploading(true);
    let count = 0;
    for (const f of list) {
      try {
        const res = await uploadR2AudioFile(f);
        if (res?.success) count++;
      } catch (err) {
        console.error("Audio upload error:", err);
      }
    }
    setUploading(false);
    if (count > 0) {
      showAlert(`成功录入 ${count} 首音轨！`);
      fetchFiles();
    }
  };

  const handleCopy = (file: StorageFileItem) => {
    const fmt = cardFormats[file.key] || "url";
    const code = getCodeForFormat(file, fmt);
    navigator.clipboard.writeText(code);
    setCopiedKey(file.key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDeleteFile = (file: StorageFileItem) => {
    if (!confirm(`确定要从 R2 对象存储桶删除文件「${file.key}」吗？`)) return;
    client.storage.deleteFile(file.key).then(() => {
      setFiles((prev) => prev.filter((f) => f.key !== file.key));
      showAlert("文件已成功从 R2 移除");
    });
  };

  const filteredImages = useMemo(() => {
    return files.filter((f) => {
      const ext = f.key.split(".").pop()?.toLowerCase() || "";
      const isImg = f.contentType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext);
      const matches = !searchQuery.trim() || f.key.toLowerCase().includes(searchQuery.toLowerCase());
      return isImg && matches;
    });
  }, [files, searchQuery]);

  const filteredDocs = useMemo(() => {
    return files.filter((f) => {
      const ext = f.key.split(".").pop()?.toLowerCase() || "";
      const isImg = f.contentType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext);
      const matches = !searchQuery.trim() || f.key.toLowerCase().includes(searchQuery.toLowerCase());
      return !isImg && matches;
    });
  }, [files, searchQuery]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed top-0 bottom-0 right-0 z-50 w-full sm:w-[88vw] md:w-[780px] lg:w-[920px] bg-white dark:bg-[#12161f] shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transition-transform duration-300 ease-out select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5 bg-neutral-50/60 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base">
              <i className="ri-folder-image-line" />
            </span>
            <div>
              <h2 className="text-sm font-bold t-primary">星穹媒体暗房 · 资产聚合中心</h2>
              <p className="text-[10px] text-neutral-400">
                图床画廊与音廊曲库统一管理，支持拖拽直传与多种直链格式
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/admin/files"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-black/10 dark:border-white/10 hover:border-theme text-xs font-semibold t-primary transition"
              title="进入独立大屏全功能图床相册"
            >
              <i className="ri-external-link-line text-theme" />
              <span>全屏图床</span>
            </a>
            <a
              href="/admin/music"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
              title="进入全功能黑胶音廊工作台 (搜索/封面/播放列表/源配置)"
            >
              <i className="ri-music-2-line" />
              <span>全屏音廊</span>
            </a>
            <button
              type="button"
              onClick={fetchFiles}
              className="p-1.5 rounded-lg border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme hover:border-theme transition"
              title="刷新媒体"
            >
              <i className={`ri-refresh-line text-sm ${loading ? "animate-spin text-theme" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
        </div>

        {/* Storage stats banner */}
        {storageStats && (
          <div className="px-5 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 font-mono">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <i className="ri-image-line text-theme" />
                <span>图片: {storageStats.imageCount ?? files.length} 张</span>
              </span>
              <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <i className="ri-music-2-line text-emerald-500" />
                <span>音轨: {musicTracks.length} 首</span>
              </span>
              <span className="text-neutral-400">
                已用空间: {formatFileSize(storageStats.totalBytes || 0)} / 10 GB (R2免费额度)
              </span>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="px-5 py-2.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("image")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "image" ? "bg-white dark:bg-neutral-800 text-theme shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <i className="ri-image-line" />
              <span>画廊图库 ({filteredImages.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("music")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "music" ? "bg-white dark:bg-neutral-800 text-emerald-500 shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <i className="ri-music-2-line" />
              <span>黑胶音廊 ({musicTracks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("file")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "file" ? "bg-white dark:bg-neutral-800 text-sky-500 shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              <i className="ri-file-text-line" />
              <span>文档附件 ({filteredDocs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索媒体..."
              className="px-3 py-1 text-xs rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 outline-none focus:border-theme w-36 sm:w-48"
            />
            {activeTab === "music" ? (
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
              >
                <i className="ri-upload-cloud-line" />
                <span>上传音频</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1 rounded-xl bg-theme hover:bg-theme-hover text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
              >
                <i className="ri-upload-cloud-line" />
                <span>上传文件</span>
              </button>
            )}
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleUploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleUploadAudio(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Content area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              if (activeTab === "music") {
                handleUploadAudio(e.dataTransfer.files);
              } else {
                handleUploadFiles(e.dataTransfer.files);
              }
            }
          }}
          className={`flex-1 overflow-y-auto p-4 sm:p-5 transition-all ${
            isDragging ? "bg-theme/5 ring-2 ring-theme/40 ring-inset" : ""
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center py-24 text-neutral-400 text-xs">
              <i className="ri-loader-4-line animate-spin text-xl text-theme mr-2" />
              <span>正在加载 R2 媒体库…</span>
            </div>
          ) : activeTab === "image" ? (
            filteredImages.length === 0 ? (
              <div className="py-20 text-center text-xs text-neutral-400">
                暂未找到图片，可直接将图片拖拽至此上传
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredImages.map((file) => {
                  const fileName = file.key.split("/").pop() || file.key;
                  const isCopied = copiedKey === file.key;
                  const currentFormat = cardFormats[file.key] || "url";
                  return (
                    <div
                      key={file.key}
                      className="group relative flex flex-col justify-between rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-neutral-900 p-2.5 shadow-2xs hover:shadow-md transition"
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file)}
                        className="absolute right-3.5 top-3.5 z-10 h-6 w-6 rounded-lg bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xs"
                        title="删除此文件"
                      >
                        <i className="ri-delete-bin-line text-xs" />
                      </button>

                      <div
                        onClick={() => handleCopy(file)}
                        className="h-28 w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/60 mb-2 flex items-center justify-center cursor-pointer group-hover:scale-[1.02] transition"
                        title="点击一键复制链接"
                      >
                        <img
                          src={file.url}
                          alt={fileName}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 truncate" title={fileName}>
                          {fileName}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-neutral-400">
                          <span>{formatFileSize(file.size)}</span>
                          <span className="font-mono">{file.key.split(".").pop()}</span>
                        </div>
                      </div>

                      {/* Link code box: Displays the formatted code, click to copy */}
                      <div className="mt-2 mb-1.5">
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(file);
                          }}
                          title="点击一键复制当前格式代码"
                          className={`w-full select-none rounded-xl px-2 py-1 text-[10px] font-mono cursor-pointer transition-all duration-300 truncate ${
                            isCopied
                              ? "border-2 border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 font-semibold shadow-xs scale-[1.01]"
                              : "border border-black/10 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 hover:border-black/20"
                          }`}
                        >
                          {getCodeForFormat(file, currentFormat)}
                        </div>
                      </div>

                      {/* 4-Color Format Switcher Buttons (四色格式直观切换，经典鲜明配色) */}
                      <div className="grid grid-cols-4 gap-1 pt-1 border-t border-black/5 dark:border-white/5 text-[10px] font-mono">
                        {/* 1. Raw URL (Lime Green) */}
                        <button
                          type="button"
                          onClick={() => setCardFormats((prev) => ({ ...prev, [file.key]: "url" }))}
                          title="切换为 URL 格式"
                          className={`flex items-center justify-center rounded-lg py-1 transition text-[10px] font-semibold cursor-pointer ${
                            currentFormat === "url"
                              ? "bg-lime-500 text-white font-bold shadow-xs scale-[1.02]"
                              : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-lime-500 hover:text-lime-600"
                          }`}
                        >
                          <i className="ri-link text-xs" />
                        </button>

                        {/* 2. HTML (Amber Yellow) */}
                        <button
                          type="button"
                          onClick={() => setCardFormats((prev) => ({ ...prev, [file.key]: "html" }))}
                          title="切换为 HTML 格式"
                          className={`flex items-center justify-center rounded-lg py-1 transition text-[10px] font-bold cursor-pointer ${
                            currentFormat === "html"
                              ? "bg-amber-400 text-neutral-900 font-bold shadow-xs scale-[1.02]"
                              : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-amber-400 hover:text-amber-500"
                          }`}
                        >
                          &lt;/&gt;
                        </button>

                        {/* 3. Markdown (Sky Blue) */}
                        <button
                          type="button"
                          onClick={() => setCardFormats((prev) => ({ ...prev, [file.key]: "markdown" }))}
                          title="切换为 Markdown 格式"
                          className={`flex items-center justify-center rounded-lg py-1 transition text-[10px] font-bold cursor-pointer ${
                            currentFormat === "markdown"
                              ? "bg-sky-400 text-white font-bold shadow-xs scale-[1.02]"
                              : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-sky-400 hover:text-sky-500"
                          }`}
                        >
                          MD
                        </button>

                        {/* 4. BBCode (Rose Red) */}
                        <button
                          type="button"
                          onClick={() => setCardFormats((prev) => ({ ...prev, [file.key]: "bbcode" }))}
                          title="切换为 BBCode 格式"
                          className={`flex items-center justify-center rounded-lg py-1 transition text-[10px] font-bold cursor-pointer ${
                            currentFormat === "bbcode"
                              ? "bg-rose-400 text-white font-bold shadow-xs scale-[1.02]"
                              : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-rose-400 hover:text-rose-500"
                          }`}
                        >
                          BB
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === "music" ? (
            musicTracks.length === 0 ? (
              <div className="py-20 text-center text-xs text-neutral-400">
                暂未探测到 R2 音轨，可点击右上角上传 MP3/FLAC 音频
              </div>
            ) : (
              <div className="space-y-2">
                {musicTracks.map((track: any, idx: number) => (
                  <div
                    key={track.key || idx}
                    className="flex items-center justify-between p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-neutral-900/70 hover:border-theme/30 transition text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <i className="ri-music-2-line text-base" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-xs t-primary truncate">{track.name || track.key}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{track.artist || "随心漫游"} · {formatFileSize(track.size || 0)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {track.url && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(track.url);
                            showAlert("已复制音频直链！");
                          }}
                          className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 text-[11px] hover:border-theme"
                        >
                          复制直链
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredDocs.length === 0 ? (
              <div className="py-20 text-center text-xs text-neutral-400">
                暂无非图片附件，可直接拖入 PDF、ZIP 等文件
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((file) => (
                  <div
                    key={file.key}
                    className="flex items-center justify-between p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-neutral-900/70 hover:border-theme/30 transition text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
                        <i className="ri-file-text-line text-base" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-xs t-primary truncate">{file.key}</p>
                        <p className="text-[10px] text-neutral-400">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(file.url);
                          showAlert("已复制文件下载直链！");
                        }}
                        className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 text-[11px] hover:border-theme"
                      >
                        复制直链
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file)}
                        className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center"
                      >
                        <i className="ri-delete-bin-line text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <AlertUI />
    </>,
    document.body
  );
}
