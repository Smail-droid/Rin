import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import type { StorageFileItem } from "../api/client";

function formatFileSize(bytes: number): string {
    if (bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    } catch {
        return isoString.slice(0, 10);
    }
}

function getFileCategory(contentType: string, key: string): "image" | "document" | "video" | "other" {
    if (contentType?.startsWith("image/")) return "image";
    if (contentType?.startsWith("video/")) return "video";
    const ext = key.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) return "image";
    if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv"].includes(ext)) return "document";
    return "other";
}

type CopyFormat = "url" | "html" | "markdown" | "bbcode";

export function AdminFilesPage({ readOnly = false }: { readOnly?: boolean } = {}) {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig() as any;
    const [files, setFiles] = useState<StorageFileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    // Upload state
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filters and sorting
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "image" | "document" | "other">("all");
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "largest" | "smallest">("newest");

    // Per-card format selection: key -> "url" | "html" | "markdown" | "bbcode"
    const [cardFormats, setCardFormats] = useState<Record<string, CopyFormat>>({});
    // Recently copied card key (for highlight animation)
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // Fullscreen image preview lightbox
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    // Toast state
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    }, []);

    const fetchFiles = useCallback(async (isRefresh = false, appendCursor?: string) => {
        if (isRefresh) {
            setRefreshing(true);
        } else if (!appendCursor) {
            setLoading(true);
        }

        try {
            const { data, error } = await client.storage.listFiles({
                cursor: appendCursor,
                limit: 60,
            });

            if (data) {
                if (appendCursor) {
                    setFiles((prev) => [...prev, ...data.files]);
                } else {
                    setFiles(data.files);
                }
                setCursor(data.cursor);
                setHasMore(Boolean(data.truncated && data.cursor));
            } else if (error) {
                console.error("List files error:", error);
            }
        } catch (err) {
            console.error("Fetch files failed:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    // Handle file upload
    const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
        const filesToUpload = Array.from(fileList);
        if (filesToUpload.length === 0) return;

        setIsUploading(true);
        let successCount = 0;
        let lastUrl = "";

        for (const file of filesToUpload) {
            try {
                const { data, error } = await client.storage.upload(file, file.name);
                if (data && data.url) {
                    lastUrl = data.url;
                    successCount++;
                    const newItem: StorageFileItem = {
                        key: file.name,
                        size: file.size,
                        uploaded: new Date().toISOString(),
                        contentType: file.type || "application/octet-stream",
                        url: data.url,
                    };
                    setFiles((prev) => [newItem, ...prev]);
                } else if (error) {
                    console.error("Upload error:", error);
                }
            } catch (err) {
                console.error("Upload failed:", err);
            }
        }

        setIsUploading(false);

        if (successCount > 0) {
            if (lastUrl) {
                navigator.clipboard.writeText(lastUrl);
                showToast(`上传成功 (${successCount} 个文件)，链接已复制！`);
            } else {
                showToast(`上传成功 (${successCount} 个文件)`);
            }
        }
    }, [showToast]);

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadFiles(e.target.files);
            e.target.value = "";
        }
    };

    // Global Paste (Ctrl+V) handler
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!e.clipboardData) return;
            const items = e.clipboardData.items;
            const imageFiles: File[] = [];

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith("image/")) {
                    const file = items[i].getAsFile();
                    if (file) {
                        imageFiles.push(file);
                    }
                }
            }

            if (imageFiles.length > 0) {
                uploadFiles(imageFiles);
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [uploadFiles]);

    const handleRefresh = () => {
        setSelectedKeys(new Set());
        fetchFiles(true);
    };

    const handleLoadMore = () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        fetchFiles(false, cursor);
    };

    // Filter & Sort
    const filteredFiles = useMemo(() => {
        return files
            .filter((file) => {
                const fileName = file.key.split("/").pop() || file.key;
                const matchesSearch = searchQuery.trim() === "" || fileName.toLowerCase().includes(searchQuery.toLowerCase());
                const category = getFileCategory(file.contentType, file.key);
                const matchesType = typeFilter === "all" || category === typeFilter;
                return matchesSearch && matchesType;
            })
            .sort((a, b) => {
                if (sortBy === "newest") {
                    return new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
                }
                if (sortBy === "oldest") {
                    return new Date(a.uploaded).getTime() - new Date(b.uploaded).getTime();
                }
                if (sortBy === "largest") {
                    return b.size - a.size;
                }
                if (sortBy === "smallest") {
                    return a.size - b.size;
                }
                return 0;
            });
    }, [files, searchQuery, typeFilter, sortBy]);

    // Statistics
    const totalCount = files.length;
    const totalSize = useMemo(() => {
        return files.reduce((acc, f) => acc + (f.size || 0), 0);
    }, [files]);

    // Selection handlers
    const toggleSelectAll = () => {
        if (selectedKeys.size === filteredFiles.length && filteredFiles.length > 0) {
            setSelectedKeys(new Set());
        } else {
            setSelectedKeys(new Set(filteredFiles.map((f) => f.key)));
        }
    };

    const toggleSelectKey = (key: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Delete single file
    const handleDeleteSingle = async (file: StorageFileItem) => {
        const fileName = file.key.split("/").pop() || file.key;
        if (!window.confirm(t("admin_files.delete_confirm", `确定要删除此文件吗？ (${fileName})`))) {
            return;
        }

        try {
            const { data } = await client.storage.deleteFile(file.key);
            if (data?.success) {
                setFiles((prev) => prev.filter((f) => f.key !== file.key));
                setSelectedKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(file.key);
                    return next;
                });
                showToast(t("admin_files.deleted", "文件已删除"));
            }
        } catch (err: any) {
            alert(`Delete failed: ${err?.message || "Unknown error"}`);
        }
    };

    // Delete batch
    const handleDeleteBatch = async () => {
        const count = selectedKeys.size;
        if (count === 0) return;

        if (!window.confirm(t("admin_files.delete_batch_confirm", `确定要删除选中的 ${count} 个文件吗？`))) {
            return;
        }

        try {
            const keysArray = Array.from(selectedKeys);
            const { data } = await client.storage.deleteFiles(keysArray);
            if (data?.success) {
                setFiles((prev) => prev.filter((f) => !selectedKeys.has(f.key)));
                setSelectedKeys(new Set());
                showToast(t("admin_files.batch_deleted", `已成功删除 ${data.deleted} 个文件`));
            }
        } catch (err: any) {
            alert(`Batch delete failed: ${err?.message || "Unknown error"}`);
        }
    };

    // Helper: generate code for a file and format
    const getCodeForFormat = (file: StorageFileItem, format: CopyFormat): string => {
        const fileName = file.key.split("/").pop() || file.key;
        const rawUrl = file.url;
        switch (format) {
            case "url":
                return rawUrl;
            case "html":
                return `<img src="${rawUrl}" alt="${fileName}">`;
            case "markdown":
                return `![${fileName}](${rawUrl})`;
            case "bbcode":
                return `[img]${rawUrl}[/img]`;
        }
    };

    const handleCopy = (file: StorageFileItem) => {
        const format = cardFormats[file.key] || "html";
        const code = getCodeForFormat(file, format);
        navigator.clipboard.writeText(code);
        setCopiedKey(file.key);
        showToast(`${format.toUpperCase()} 格式已复制！`);
        setTimeout(() => {
            setCopiedKey((curr) => (curr === file.key ? null : curr));
        }, 1500);
    };

    return (
        <div className="relative flex flex-col gap-6 ani-show">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex max-w-[90vw] items-center gap-2 rounded-xl bg-neutral-900/90 text-white px-4 py-2.5 text-sm shadow-xl backdrop-blur-md dark:bg-white/90 dark:text-neutral-900 animate-bounce">
                    <i className="ri-check-line text-emerald-400 dark:text-emerald-600 font-bold" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 沉浸式画廊全屏翻图灯箱 (Lightbox - 挂载至 document.body 杜绝父级容器样式裁切) */}
            {previewIndex !== null && filteredFiles[previewIndex] && typeof document !== "undefined" && createPortal(
                <div
                    onClick={() => setPreviewIndex(null)}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 p-4 backdrop-blur-md select-none ani-show"
                >
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
                        <span className="text-xs font-mono text-white/80 bg-white/10 px-3.5 py-1 rounded-full border border-white/10">
                            {previewIndex + 1} / {filteredFiles.length}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPreviewIndex(null)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition"
                        >
                            <i className="ri-close-line text-xl" />
                        </button>
                    </div>

                    {previewIndex > 0 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewIndex((prev) => (prev !== null ? prev - 1 : null));
                            }}
                            className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur-sm transition"
                            title="上一张 (Left Arrow)"
                        >
                            <i className="ri-arrow-left-s-line text-2xl" />
                        </button>
                    )}

                    {previewIndex < filteredFiles.length - 1 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewIndex((prev) => (prev !== null ? prev + 1 : null));
                            }}
                            className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur-sm transition"
                            title="下一张 (Right Arrow)"
                        >
                            <i className="ri-arrow-right-s-line text-2xl" />
                        </button>
                    )}

                    <div onClick={(e) => e.stopPropagation()} className="relative max-h-[88vh] max-w-[90vw] flex items-center justify-center">
                        <img
                            src={filteredFiles[previewIndex].url}
                            alt={filteredFiles[previewIndex].key}
                            className="max-h-[88vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Read-only gallery mode header */}
            {readOnly && (
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/10">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight t-primary flex items-center gap-2">
                            <span>📷</span>
                            <span>图床漫游 · 记忆画廊</span>
                        </h1>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            浏览全站图库与素材原图，点击图片或输入框即可快速复制多种格式链接
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900"
                    >
                        <i className="ri-arrow-left-line" />
                        <span>返回主页</span>
                    </Link>
                </div>
            )}

            {/* Hidden file input */}
            {!readOnly && (
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileInputChange}
                />
            )}

            {/* 1. OpenList Worker 紧凑折叠挂载条 (不到一屏绝不独占路由，与图床无缝整合) */}
            {!readOnly && (
                <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] p-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-theme text-sm">
                                <i className="ri-hard-drive-2-line" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs t-primary">OpenList 边缘目录挂载</span>
                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                        siteConfig.openlistWorkerUrl ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
                                    }`}>
                                        {siteConfig.openlistWorkerUrl ? "已挂载" : "未挂载"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                                    {siteConfig.openlistWorkerUrl ? siteConfig.openlistWorkerUrl : "基于 doc.oplist.org.cn 规范的 Cloudflare Worker 网盘多源目录索引"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            {siteConfig.openlistWorkerUrl && (
                                <a
                                    href={siteConfig.openlistWorkerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold t-primary hover:border-theme transition flex items-center gap-1"
                                >
                                    <i className="ri-external-link-line text-theme" />
                                    <span>浏览网盘</span>
                                </a>
                            )}
                            <Link
                                href="/admin/openlist"
                                className="px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold transition"
                            >
                                挂载配置
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Upload History & Management */}
            <div className="flex flex-col gap-3">
                {/* Section Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-2.5 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <h2 className="flex items-center gap-2 text-base font-bold t-primary">
                            <i className="ri-folder-image-line text-theme" />
                            <span>R2 媒体资产相册</span>
                        </h2>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="rounded-full bg-neutral-100 dark:bg-white/10 px-2 py-0.5 font-semibold text-neutral-600 dark:text-neutral-300 text-[11px]">
                                {totalCount} 个文件
                            </span>
                            <span className="rounded-full bg-neutral-100 dark:bg-white/10 px-2 py-0.5 font-semibold text-neutral-600 dark:text-neutral-300 text-[11px]">
                                {formatFileSize(totalSize)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-theme px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-theme-hover active:scale-95 transition disabled:opacity-50"
                            >
                                <i className="ri-upload-cloud-line text-sm" />
                                <span>{isUploading ? "正在上传..." : "上传媒体图片"}</span>
                            </button>
                        )}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-w px-2.5 py-1.5 text-xs font-semibold t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                            <i className={`ri-refresh-line text-xs ${refreshing ? "animate-spin" : ""}`} />
                            <span>{t("admin_files.refresh", "刷新")}</span>
                        </button>
                    </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="relative flex-1">
                        <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("admin_files.search_placeholder", "搜索文件名...")}
                            className="w-full rounded-xl border border-black/10 bg-w pl-9 pr-3 py-2 text-sm t-primary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-theme/30 dark:border-white/10 dark:bg-white/5"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                                <i className="ri-close-line text-sm" />
                            </button>
                        )}
                    </div>

                    {/* Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                        className="rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary focus:outline-none dark:border-white/10 dark:bg-neutral-900 cursor-pointer"
                    >
                        <option value="all">{t("admin_files.filter_all", "全部类型")}</option>
                        <option value="image">{t("admin_files.filter_images", "图片")}</option>
                        <option value="document">{t("admin_files.filter_documents", "文档")}</option>
                        <option value="other">{t("admin_files.filter_other", "其他")}</option>
                    </select>

                    {/* Sort Dropdown */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary focus:outline-none dark:border-white/10 dark:bg-neutral-900 cursor-pointer"
                    >
                        <option value="newest">{t("admin_files.sort_newest", "最新上传")}</option>
                        <option value="oldest">{t("admin_files.sort_oldest", "最早上传")}</option>
                        <option value="largest">{t("admin_files.sort_largest", "最大文件")}</option>
                        <option value="smallest">{t("admin_files.sort_smallest", "最小文件")}</option>
                    </select>
                </div>

                {/* Batch selection bar */}
                <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-300 select-none">
                        <input
                            type="checkbox"
                            checked={filteredFiles.length > 0 && selectedKeys.size === filteredFiles.length}
                            onChange={toggleSelectAll}
                            className="rounded text-theme focus:ring-theme"
                        />
                        <span>{t("admin_files.select_all", "全选")}</span>
                        {selectedKeys.size > 0 && (
                            <span className="text-theme font-semibold">({selectedKeys.size})</span>
                        )}
                    </label>

                    {selectedKeys.size > 0 && (
                        <button
                            onClick={handleDeleteBatch}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40"
                        >
                            <i className="ri-delete-bin-line" />
                            <span>{t("admin_files.delete_selected", "删除所选")} ({selectedKeys.size})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 3. Cards Grid (首格虚线嵌入上传 + 统一步骤冷灰卡片) */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 animate-pulse">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <div key={i} className="rounded-xl border border-black/5 bg-w p-3 dark:border-white/5">
                            <div className="h-44 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800 mb-2" />
                            <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800 mb-2" />
                            <div className="h-6 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
                    {/* 首格虚线内嵌上传卡片 (跟图片等高，点击或拖拽直接上传，彻底消灭巨型占位框) */}
                    {!readOnly && (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`group relative flex flex-col items-center justify-center min-h-[290px] rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 p-4 select-none ${
                                isDragging
                                    ? "border-theme bg-theme/5 scale-[1.01]"
                                    : "border-black/15 bg-black/[0.01] hover:border-theme hover:bg-theme/[0.02] dark:border-white/15 dark:bg-white/[0.01]"
                            }`}
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 text-neutral-400 group-hover:text-theme group-hover:scale-110 transition-all mb-2 shadow-2xs">
                                <i className={`text-2xl ${isUploading ? "ri-loader-4-line animate-spin text-theme" : "ri-upload-cloud-2-line"}`} />
                            </div>
                            <span className="font-bold text-xs t-primary group-hover:text-theme transition-colors">
                                {isUploading ? "上传处理中..." : "上传或拖拽图片"}
                            </span>
                            <span className="text-[10px] text-neutral-400 mt-1 text-center">
                                支持 JPG/PNG/WebP，可直接 Ctrl+V 粘贴
                            </span>
                        </div>
                    )}
                    {filteredFiles.map((file) => {
                        const fileName = file.key.split("/").pop() || file.key;
                        const isImage = getFileCategory(file.contentType, file.key) === "image";
                        const isSelected = selectedKeys.has(file.key);
                        const currentFormat = cardFormats[file.key] || "html";
                        const displayCode = getCodeForFormat(file, currentFormat);
                        const isCopied = copiedKey === file.key;

                        return (
                            <div
                                key={file.key}
                                className={`group relative flex flex-col justify-between rounded-2xl border bg-w p-3.5 shadow-2xs transition hover:shadow-md dark:border-white/10 dark:bg-neutral-900 ${
                                    isSelected
                                        ? "border-theme ring-2 ring-theme/20"
                                        : "border-black/10"
                                }`}
                            >
                                {/* Top Overlay Controls: Checkbox, Zoom, Delete */}
                                <div className="absolute left-4 top-4 z-10">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectKey(file.key)}
                                        className="h-4 w-4 rounded text-theme focus:ring-theme cursor-pointer shadow-xs"
                                    />
                                </div>
                                <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5">
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSingle(file);
                                            }}
                                            title={t("admin_files.delete", "删除")}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-rose-500 shadow-xs backdrop-blur-xs transition hover:bg-rose-500 hover:text-white dark:bg-neutral-800/90"
                                        >
                                            <i className="ri-delete-bin-line text-xs" />
                                        </button>
                                    )}
                                </div>

                                {/* Preview Area (点击直接画廊大图预览并翻页) */}
                                <div
                                    onClick={() => {
                                        const idx = filteredFiles.findIndex((f) => f.key === file.key);
                                        if (idx !== -1) setPreviewIndex(idx);
                                    }}
                                    className="h-44 sm:h-48 w-full overflow-hidden rounded-xl bg-neutral-50/70 dark:bg-neutral-950/40 mb-2.5 flex items-center justify-center relative cursor-pointer group/img border border-black/5 dark:border-white/5"
                                    title="点击画廊大图全屏预览 (支持左右切换翻页)"
                                >
                                    {isImage ? (
                                        <img
                                            src={file.url}
                                            alt={fileName}
                                            loading="lazy"
                                            className="max-h-full max-w-full object-contain p-1 transition duration-300 group-hover/img:scale-105"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = "none";
                                            }}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-neutral-400">
                                            <i className="ri-file-text-line text-3xl" />
                                            <span className="text-[10px] uppercase font-semibold mt-1 tracking-wider">
                                                {file.key.split(".").pop() || "FILE"}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Metadata: Filename, size, date */}
                                <div className="px-0.5 mb-2">
                                    <p
                                        className="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                                        title={fileName}
                                    >
                                        {fileName}
                                    </p>
                                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-neutral-400">
                                        <span>{formatDate(file.uploaded)}</span>
                                        <span>{formatFileSize(file.size)}</span>
                                    </div>
                                </div>

                                {/* Link code box: Click to copy & turns green on copy (prevents translation plugin popup) */}
                                <div className="mb-2">
                                    <div
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleCopy(file);
                                        }}
                                        title="点击一键复制当前格式代码"
                                        className={`w-full select-none rounded-xl px-2.5 py-1.5 text-[11px] font-mono cursor-pointer transition-all duration-300 truncate ${
                                            isCopied
                                                ? "border-2 border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 font-semibold shadow-xs scale-[1.01]"
                                                : "border border-black/10 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 hover:border-black/20"
                                        }`}
                                    >
                                        {displayCode}
                                    </div>
                                </div>

                                {/* 4-Color Format Switcher Buttons (统一冷灰工业级线框，消除刺眼黄色) */}
                                <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-black/5 dark:border-white/5 text-xs">
                                    {/* 1. Raw URL */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCardFormats((prev) => ({
                                                ...prev,
                                                [file.key]: "url",
                                            }))
                                        }
                                        title="切换为 URL 格式"
                                        className={`flex items-center justify-center rounded-lg py-1 transition text-[11px] font-semibold ${
                                            currentFormat === "url"
                                                ? "bg-theme text-white font-bold shadow-2xs"
                                                : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-theme hover:text-theme"
                                        }`}
                                    >
                                        <i className="ri-link text-xs" />
                                    </button>

                                    {/* 2. HTML */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCardFormats((prev) => ({
                                                ...prev,
                                                [file.key]: "html",
                                            }))
                                        }
                                        title="切换为 HTML 格式"
                                        className={`flex items-center justify-center rounded-lg py-1 transition text-[11px] font-bold ${
                                            currentFormat === "html"
                                                ? "bg-theme text-white font-bold shadow-2xs"
                                                : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-theme hover:text-theme"
                                        }`}
                                    >
                                        &lt;/&gt;
                                    </button>

                                    {/* 3. Markdown */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCardFormats((prev) => ({
                                                ...prev,
                                                [file.key]: "markdown",
                                            }))
                                        }
                                        title="切换为 Markdown 格式"
                                        className={`flex items-center justify-center rounded-lg py-1 transition text-[11px] font-bold ${
                                            currentFormat === "markdown"
                                                ? "bg-theme text-white font-bold shadow-2xs"
                                                : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-theme hover:text-theme"
                                        }`}
                                    >
                                        M&darr;
                                    </button>

                                    {/* 4. BBCode */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCardFormats((prev) => ({
                                                ...prev,
                                                [file.key]: "bbcode",
                                            }))
                                        }
                                        title="切换为 BBCode 格式"
                                        className={`flex items-center justify-center rounded-lg py-1 transition text-[10px] font-bold ${
                                            currentFormat === "bbcode"
                                                ? "bg-theme text-white font-bold shadow-2xs"
                                                : "border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-theme hover:text-theme"
                                        }`}
                                    >
                                        BB
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Load more button */}
            {hasMore && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-w px-6 py-2.5 text-sm font-medium t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5 disabled:opacity-50"
                    >
                        {loadingMore && <i className="ri-loader-4-line animate-spin" />}
                        <span>{t("admin_files.load_more", "加载更多")}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
