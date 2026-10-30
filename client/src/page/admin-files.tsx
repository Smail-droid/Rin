import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { client } from "../app/runtime";
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

export function AdminFilesPage() {
    const { t } = useTranslation();
    const [files, setFiles] = useState<StorageFileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    // Filters and sorting
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "image" | "document" | "other">("all");
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "largest" | "smallest">("newest");

    // Toast state
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2000);
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

    // Copy format helpers
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${label} ${t("admin_files.copied", "已复制！")}`);
    };

    return (
        <div className="relative flex flex-col gap-5 ani-show">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex max-w-[90vw] items-center gap-2 rounded-xl bg-neutral-900/90 text-white px-4 py-2.5 text-sm shadow-xl backdrop-blur-md dark:bg-white/90 dark:text-neutral-900 animate-bounce">
                    <i className="ri-check-line text-emerald-400 dark:text-emerald-600 font-bold" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Top Toolbar / Stats Bar */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Stats pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/5 shadow-xs">
                            <i className="ri-file-text-line text-neutral-400" />
                            <span className="text-neutral-500 dark:text-neutral-400">{t("admin_files.total_files_label", "文件")}</span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">{totalCount}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/5 shadow-xs">
                            <i className="ri-database-2-line text-amber-500" />
                            <span className="text-neutral-500 dark:text-neutral-400">{t("admin_files.total_size_label", "空间")}</span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">{formatFileSize(totalSize)}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/5 shadow-xs">
                            <i className="ri-pie-chart-line text-indigo-500" />
                            <span className="text-neutral-500 dark:text-neutral-400">{t("admin_files.filter_label", "类型")}</span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">
                                {typeFilter === "all" ? t("admin_files.filter_all", "全部类型") : typeFilter === "image" ? t("admin_files.filter_images", "图片文件") : typeFilter === "document" ? t("admin_files.filter_documents", "文档") : t("admin_files.filter_other", "其他")}
                            </span>
                        </div>
                    </div>

                    {/* Refresh button */}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-w px-3.5 py-2 text-xs font-semibold t-primary shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5 disabled:opacity-50"
                    >
                        <i className={`ri-refresh-line text-sm ${refreshing ? "animate-spin" : ""}`} />
                        <span>{t("admin_files.refresh", "刷新")}</span>
                    </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {/* Search Input */}
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
                        className="rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary focus:outline-none dark:border-white/10 dark:bg-neutral-900"
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
                        className="rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary focus:outline-none dark:border-white/10 dark:bg-neutral-900"
                    >
                        <option value="newest">{t("admin_files.sort_newest", "最新上传")}</option>
                        <option value="oldest">{t("admin_files.sort_oldest", "最早上传")}</option>
                        <option value="largest">{t("admin_files.sort_largest", "最大文件")}</option>
                        <option value="smallest">{t("admin_files.sort_smallest", "最小文件")}</option>
                    </select>
                </div>

                {/* Batch selection bar */}
                <div className="flex items-center justify-between border-b border-black/5 pb-2 dark:border-white/5">
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

            {/* File List / Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="rounded-2xl border border-black/5 bg-w p-3 dark:border-white/5">
                            <div className="aspect-[16/10] w-full rounded-xl bg-neutral-200 dark:bg-neutral-800 mb-2.5" />
                            <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800 mb-2" />
                            <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800 mb-2.5" />
                            <div className="h-7 w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
                        </div>
                    ))}
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-white/5 dark:text-neutral-500 mb-3">
                        <i className="ri-folder-open-line text-3xl" />
                    </div>
                    <p className="text-base font-semibold t-primary">{t("admin_files.no_files", "暂无文件")}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
                        {t("admin_files.no_files_desc", "通过编辑器上传图片或文件后将在此处自动呈现与管理")}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredFiles.map((file) => {
                        const fileName = file.key.split("/").pop() || file.key;
                        const isImage = getFileCategory(file.contentType, file.key) === "image";
                        const isSelected = selectedKeys.has(file.key);

                        // Formats for copy
                        const rawUrl = file.url;
                        const htmlTag = `<img src="${rawUrl}" alt="${fileName}">`;
                        const markdownTag = `![${fileName}](${rawUrl})`;
                        const bbcodeTag = `[img]${rawUrl}[/img]`;

                        return (
                            <div
                                key={file.key}
                                className={`group relative flex flex-col justify-between rounded-2xl border bg-w p-3 shadow-xs transition hover:shadow-md dark:border-white/10 dark:bg-neutral-900 ${
                                    isSelected
                                        ? "border-theme ring-2 ring-theme/20"
                                        : "border-black/10"
                                }`}
                            >
                                {/* Top Overlay Controls: Checkbox & Delete */}
                                <div className="absolute left-4 top-4 z-10">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectKey(file.key)}
                                        className="h-4 w-4 rounded text-theme focus:ring-theme cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => handleDeleteSingle(file)}
                                    title={t("admin_files.delete", "删除")}
                                    className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-rose-500 shadow-sm backdrop-blur-xs transition hover:bg-rose-500 hover:text-white dark:bg-neutral-800/80"
                                >
                                    <i className="ri-delete-bin-line text-sm" />
                                </button>

                                {/* Preview Area */}
                                <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/50 mb-2.5 flex items-center justify-center relative">
                                    {isImage ? (
                                        <img
                                            src={file.url}
                                            alt={fileName}
                                            loading="lazy"
                                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
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

                                {/* Link input preview with click-to-copy */}
                                <div className="mb-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={htmlTag}
                                        onClick={(e) => {
                                            (e.target as HTMLInputElement).select();
                                            copyToClipboard(htmlTag, "HTML");
                                        }}
                                        title={t("admin_files.click_to_copy", "点击复制")}
                                        className="w-full rounded-lg border border-black/5 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500 font-mono focus:outline-none dark:border-white/5 dark:bg-white/5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/10 transition"
                                    />
                                </div>

                                {/* Quick format copy buttons (URL, HTML, Markdown, BBCode) */}
                                <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-black/5 dark:border-white/5 text-xs">
                                    {/* 1. Raw URL */}
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(rawUrl, "URL")}
                                        title={t("admin_files.copy_url", "复制链接")}
                                        className="flex items-center justify-center rounded-lg py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-neutral-300 transition"
                                    >
                                        <i className="ri-link text-xs" />
                                    </button>

                                    {/* 2. HTML */}
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(htmlTag, "HTML")}
                                        title={t("admin_files.copy_html", "复制 HTML 标签")}
                                        className="flex items-center justify-center rounded-lg py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-400 font-bold transition text-[11px]"
                                    >
                                        &lt;/&gt;
                                    </button>

                                    {/* 3. Markdown */}
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(markdownTag, "Markdown")}
                                        title={t("admin_files.copy_markdown", "复制 Markdown 格式")}
                                        className="flex items-center justify-center rounded-lg py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-neutral-300 font-bold transition text-[11px]"
                                    >
                                        M&darr;
                                    </button>

                                    {/* 4. BBCode */}
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(bbcodeTag, "BBCode")}
                                        title={t("admin_files.copy_bbcode", "复制 BBCode 格式")}
                                        className="flex items-center justify-center rounded-lg py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-neutral-300 font-semibold transition text-[10px]"
                                    >
                                        [BB]
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
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-w px-6 py-2.5 text-sm font-medium t-primary shadow-xs transition hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5 disabled:opacity-50"
                    >
                        {loadingMore && <i className="ri-loader-4-line animate-spin" />}
                        <span>{t("admin_files.load_more", "加载更多")}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
