import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation, useSearch } from "wouter";
import { Modal } from "@rin/ui";
import { client } from "../app/runtime";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { useTranslation } from "react-i18next";
import { useAlert } from "../components/dialog";
import { R2MediaPickerModal } from "../components/r2-media-picker-modal";
import { VectorIcon } from "../components/vector-icon";

type FeedsData = {
    size: number;
    data: any[];
    hasNext: boolean;
};

type FeedType = "draft" | "unlisted" | "normal";

type FeedsMap = {
    [key in FeedType]: FeedsData;
};

function EmptyFeedsState({ listState, canWrite }: { listState: FeedType; canWrite?: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="w-full flex flex-col items-center justify-center py-24 px-4 text-center ani-show">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-100 text-neutral-400 dark:bg-white/5 dark:text-neutral-500 mb-4 shadow-inner">
                <i className="ri-article-line text-4xl" />
            </div>
            <h3 className="text-xl font-semibold t-primary mb-1">
                {listState === "draft" ? t("draft_bin") : listState === "unlisted" ? t("unlisted") : t("article.title")}
            </h3>
            <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                {listState === "draft"
                    ? t("draft_empty") || "暂无草稿"
                    : t("feed_empty") || "发布文章后将在此处自动呈现"}
            </p>
            {canWrite && (
                <Link
                    href="/admin/writing"
                    className="inline-flex items-center gap-2 rounded-full bg-theme px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-95"
                >
                    <i className="ri-quill-pen-line" />
                    <span>{t("writing")}</span>
                </Link>
            )}
        </div>
    );
}

// Dynamic organic tilt calculation based on configurable continuous degree slider (0° ~ 10°)
const getTiltStyle = (index: number, tiltOffset: number, baseDegree: number = 1.8): React.CSSProperties => {
    if (baseDegree <= 0) return { transform: "rotate(0deg)" };
    const factors = [-1.0, 0.8, -1.2, 1.1, -0.7, 0.9, -1.3, 0.6];
    const factor = factors[(index + tiltOffset) % factors.length];
    const angle = (factor * baseDegree).toFixed(2);
    return { "--card-tilt": `${angle}deg`, transform: `rotate(var(--card-tilt))` } as React.CSSProperties;
};

// Translucent washi-tape accent colors
const TAPE_COLORS = [
    "bg-amber-100/90 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    "bg-sky-100/90 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
    "bg-rose-100/90 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
    "bg-emerald-100/90 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    "bg-purple-100/90 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
];

/**
 * Pure Cover Art Card (No repetitive title/summary - the cover image IS the art!)
 */
function AtelierPhotoCard({
    feed,
    index,
    tiltOffset = 0,
    canManage = false,
    draggable = false,
    isDragging = false,
    isDragOver = false,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onToggleTop,
    onEditCover,
}: {
    feed: any;
    index: number;
    tiltOffset?: number;
    canManage?: boolean;
    draggable?: boolean;
    isDragging?: boolean;
    isDragOver?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    onToggleTop?: (feedId: number, top: number) => void;
    onEditCover?: (feed: any) => void;
}) {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const [imageError, setImageError] = useState(false);
    const tiltStyle = getTiltStyle(index, tiltOffset, siteConfig.galleryTiltDegree);
    const tapeColor = TAPE_COLORS[(index + tiltOffset) % TAPE_COLORS.length];
    const readingTime = feed.readingTime || Math.max(1, Math.ceil((feed.summary?.length || 100) / 100));

    const hasImage = Boolean(feed.avatar) && !imageError;
    const variant = siteConfig.feedCardVariant || "default";

    // 1. 紧凑文章列表 (Compact - 表格级高密单行，日期左置、标题满宽、操作悬浮显现)
    if (variant === "compact") {
        const dateObj = new Date(feed.createdAt);
        const shortDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

        return (
            <div className="relative group/card w-full">
                <Link
                    href={`/feed/${feed.id}`}
                    draggable={draggable && canManage}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    className={`group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 px-4 py-3 transition-colors hover:bg-theme/[0.04] dark:hover:bg-white/[0.03] ${
                        isDragging ? "opacity-35 bg-theme/5" : ""
                    } ${isDragOver ? "ring-2 ring-inset ring-theme/40" : ""}`}
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="hidden sm:inline-block w-[84px] shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">
                            {shortDate}
                        </span>
                        {feed.top === 1 ? (
                            <span className="shrink-0 rounded-md bg-theme/10 px-1.5 py-0.5 text-[10px] font-semibold text-theme">
                                {t("article.top.title")}
                            </span>
                        ) : null}
                        {feed.draft === 1 ? (
                            <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                {t("draft")}
                            </span>
                        ) : null}
                        <h2 className="text-[13px] sm:text-sm font-medium text-neutral-800 dark:text-neutral-100 line-clamp-1 sm:truncate group-hover:text-theme transition-colors flex-1 min-w-0">
                            {feed.title}
                        </h2>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-[11px] text-neutral-400">
                        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                            <span className="sm:hidden">{shortDate}</span>
                            <span>{readingTime} 分钟</span>
                        </div>
                        {canManage ? (
                            <div
                                className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onToggleTop?.(feed.id, feed.top === 1 ? 0 : 1);
                                    }}
                                    title={feed.top === 1 ? "取消置顶" : "置顶"}
                                    className={`h-6 w-6 rounded-md flex items-center justify-center text-xs transition cursor-pointer ${
                                        feed.top === 1 ? "bg-theme text-white" : "bg-neutral-100 dark:bg-white/10 hover:text-theme"
                                    }`}
                                >
                                    <i className={feed.top === 1 ? "ri-pushpin-fill" : "ri-pushpin-line"} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        window.dispatchEvent(
                                            new CustomEvent("rin:open-writing-drawer", { detail: { id: feed.id } })
                                        );
                                    }}
                                    title="就地编辑文章"
                                    className="h-6 w-6 rounded-md flex items-center justify-center text-xs bg-neutral-100 dark:bg-white/10 hover:text-theme transition cursor-pointer"
                                >
                                    <i className="ri-edit-line" />
                                </button>
                            </div>
                        ) : null}
                    </div>
                </Link>
            </div>
        );
    }

    // 2. 全幅沉浸画册 (Poster - 无白边满幅原图完整呈现，严禁强裁 + 贴底轻盈铭牌)
    if (variant === "poster") {
        return (
            <div className="relative group/card break-inside-avoid w-full mb-5">
                <Link
                    href={`/feed/${feed.id}`}
                    draggable={draggable && canManage}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    className={`group relative block w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-sm hover:shadow-xl transition-all duration-300 ${
                        isDragging ? "opacity-35 scale-95 ring-2 ring-theme" : ""
                    } ${isDragOver ? "ring-4 ring-theme/40" : ""}`}
                >
                    {canManage ? (
                        <div className="absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEditCover?.(feed);
                                }}
                                title="更换封面"
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md border border-white/15 transition hover:bg-theme"
                            >
                                <i className="ri-image-edit-line text-xs" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent("rin:open-writing-drawer", { detail: { id: feed.id } }));
                                }}
                                title="就地编辑文章"
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md border border-white/15 transition hover:bg-theme"
                            >
                                <i className="ri-edit-line text-xs" />
                            </button>
                        </div>
                    ) : null}

                    {hasImage ? (
                        <img
                            src={feed.avatar}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            onError={() => setImageError(true)}
                            className="block w-full h-auto transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                        />
                    ) : (
                        <div className="w-full min-h-48 bg-gradient-to-br from-theme/85 via-theme-secondary/75 to-neutral-900 p-5 flex items-start justify-end">
                            <i className="ri-gallery-line text-3xl text-white/25" />
                        </div>
                    )}

                    {/* 贴底轻盈铭牌：克制高度，完整让位给原图画作 */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3.5 pt-8 pb-2.5 text-white">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-white/75 mb-0.5">
                            <span className="flex items-center gap-1.5">
                                <span>{new Date(feed.createdAt).toLocaleDateString()}</span>
                                {feed.top === 1 ? <span className="px-1.5 py-0.2 rounded bg-theme/90 text-white font-sans font-semibold">置顶</span> : null}
                                {feed.draft === 1 ? <span className="px-1.5 py-0.2 rounded bg-amber-500/90 text-white font-sans font-semibold">草稿</span> : null}
                            </span>
                            <span>{readingTime} 分钟</span>
                        </div>
                        <h2 className="text-sm font-bold leading-snug line-clamp-1 tracking-tight drop-shadow-2xs">
                            {feed.title}
                        </h2>
                    </div>
                </Link>
            </div>
        );
    }

    // 3. 图文双栏杂志 (Editorial - 单列宽幅 6:4 左文右图，去白底厚卡片框，用细横线分隔)
    if (variant === "editorial") {
        return (
            <article className="relative group/card w-full">
                <Link
                    href={`/feed/${feed.id}`}
                    draggable={draggable && canManage}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    className={`group relative flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-5 sm:gap-8 py-6 sm:py-7 transition-colors ${
                        isDragging ? "opacity-35" : ""
                    } ${isDragOver ? "bg-theme/[0.04] rounded-xl px-3" : ""}`}
                >
                    {/* 左侧 60% 文字主区：刊号元信息 + 大号衬线标题 + 3 行摘要 */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="flex items-center gap-2.5 text-[11px] font-mono text-neutral-400">
                            <span className="tabular-nums">{new Date(feed.createdAt).toLocaleDateString()}</span>
                            <span>·</span>
                            <span>{readingTime} 分钟阅读</span>
                            {feed.top === 1 ? (
                                <span className="px-1.5 py-0.5 rounded bg-theme/10 text-theme font-sans font-semibold text-[10px]">
                                    置顶
                                </span>
                            ) : null}
                            {feed.draft === 1 ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-sans font-semibold text-[10px]">
                                    草稿
                                </span>
                            ) : null}
                        </div>

                        <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-neutral-900 dark:text-neutral-50 group-hover:text-theme transition-colors leading-snug">
                            {feed.title}
                        </h2>

                        {feed.summary ? (
                            <p className="line-clamp-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 max-w-2xl">
                                {feed.summary}
                            </p>
                        ) : null}

                        <div className="flex items-center justify-between pt-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-theme group-hover:gap-2 transition-all">
                                <span>阅读全文</span>
                                <i className="ri-arrow-right-line" />
                            </span>

                            {canManage ? (
                                <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onEditCover?.(feed);
                                        }}
                                        title="更换封面"
                                        className="h-6 w-6 rounded-md border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-500 hover:text-theme hover:border-theme transition"
                                    >
                                        <i className="ri-image-edit-line text-xs" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent("rin:open-writing-drawer", { detail: { id: feed.id } }));
                                        }}
                                        title="就地编辑文章"
                                        className="h-6 w-6 rounded-md border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-500 hover:text-theme hover:border-theme transition"
                                    >
                                        <i className="ri-edit-line text-xs" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* 右侧 40% 配图：简洁无杂饰的 16:10 摄影构图 */}
                    {hasImage ? (
                        <div className="w-full sm:w-56 md:w-72 shrink-0 aspect-[16/10] overflow-hidden rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-100 dark:bg-neutral-800">
                            <img
                                src={feed.avatar}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={() => setImageError(true)}
                                className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    ) : null}
                </Link>
            </article>
        );
    }

    // 4. 拟物拍立得手账 (Default Polaroid)
    return (
        <Link
            href={`/feed/${feed.id}`}
            draggable={draggable && canManage}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`group relative break-inside-avoid block w-full mb-5 sm:mb-6 rounded-[26px] border bg-white p-3 pb-3.5 shadow-md hover:shadow-2xl transition-all duration-400 transform hover:!rotate-0 hover:scale-[1.03] hover:z-30 dark:bg-neutral-900 ${
                isDragging ? "opacity-35 scale-95 border-theme border-dashed ring-2 ring-theme/40" : ""
            } ${
                isDragOver ? "ring-4 ring-theme/40 border-theme scale-[1.02] shadow-xl" : "border-black/10 dark:border-white/10"
            }`}
            style={tiltStyle}
        >
            <div
                className={`absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-4 ${tapeColor} rounded-xs shadow-2xs rotate-[-2deg] pointer-events-none z-10 opacity-90`}
            />

            {canManage && draggable && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    title="按住拖拽调整此文章在画廊中的摆放位置"
                    className="absolute left-4 top-4 z-20 hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white/95 dark:bg-neutral-800/95 text-neutral-600 dark:text-neutral-200 shadow-md backdrop-blur-xs transition hover:scale-110 hover:text-theme cursor-grab active:cursor-grabbing"
                >
                    <i className="ri-drag-move-2-line text-xs" />
                </div>
            )}

            {canManage && (
                <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEditCover?.(feed);
                        }}
                        title="快捷更换此文章封面"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 dark:bg-neutral-800/95 text-neutral-600 dark:text-neutral-200 shadow-md backdrop-blur-xs transition hover:scale-110 hover:text-theme active:scale-95"
                    >
                        <i className="ri-image-edit-line text-xs" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent("rin:open-writing-drawer", { detail: { id: feed.id } }));
                        }}
                        title="在场就地编辑文章"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 dark:bg-neutral-800/95 text-neutral-600 dark:text-neutral-200 shadow-md backdrop-blur-xs transition hover:scale-110 hover:text-theme"
                    >
                        <i className="ri-edit-line text-xs" />
                    </button>
                </div>
            )}

            <div className="relative w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 shadow-inner">
                {hasImage ? (
                    <img
                        src={feed.avatar}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        fetchPriority={index < 2 ? "high" : "low"}
                        onError={() => setImageError(true)}
                        className="w-full h-auto block object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 min-h-60 bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-950 text-center">
                        <i className="ri-quill-pen-line text-3xl mb-3 opacity-60 text-theme" />
                        <h2 className="text-xl font-bold t-primary line-clamp-3 leading-snug">
                            {feed.title}
                        </h2>
                    </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between text-white text-xs">
                    <span className="font-medium truncate max-w-[70%] drop-shadow-xs">
                        {feed.title}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] font-semibold">
                        <i className="ri-time-line text-xs" />
                        <span>{t("reading_time", { minutes: readingTime, defaultValue: `${readingTime} 分钟阅读` })}</span>
                    </span>
                </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                <span>{new Date(feed.createdAt).toLocaleDateString()}</span>
                {canManage ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleTop?.(feed.id, feed.top === 1 ? 0 : 1);
                        }}
                        title={feed.top === 1 ? "点击取消置顶此文章" : "点击置顶此文章至首位"}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition select-none ${
                            feed.top === 1
                                ? "bg-theme text-white shadow-2xs hover:bg-theme-hover"
                                : "bg-black/5 dark:bg-white/5 text-neutral-500 hover:text-theme hover:bg-theme/10"
                        }`}
                    >
                        <i className={feed.top === 1 ? "ri-pushpin-fill text-xs" : "ri-pushpin-line text-xs"} />
                        <span>{feed.top === 1 ? "已置顶" : "置顶"}</span>
                    </button>
                ) : feed.top === 1 ? (
                    <span className="text-theme font-semibold flex items-center gap-0.5">
                        <i className="ri-pushpin-line" />
                        <span>{t("article.top.title")}</span>
                    </span>
                ) : null}
            </div>
        </Link>
    );
}

/**
 * 📌 Scattered Atelier Artifacts (Customizable Sticky Notes with Custom Cover & Quick Edit)
 */
function StickyNoteItem({
    type,
    siteConfig,
    canManage = false,
    draggable = false,
    isDragging = false,
    isDragOver = false,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onMoveStep,
    onEditNote,
}: {
    type: "about" | "timeline" | "moments" | "friends" | "search";
    siteConfig: any;
    canManage?: boolean;
    draggable?: boolean;
    isDragging?: boolean;
    isDragOver?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    onMoveStep?: (type: string, direction: "prev" | "next") => void;
    onEditNote?: (type: string) => void;
}) {
    const [, setLocation] = useLocation();
    const [searchKeyword, setSearchKeyword] = useState("");

    const dragHandlers = draggable ? {
        draggable: true,
        onDragStart,
        onDragOver,
        onDrop,
        onDragEnd,
    } : {};

    const dragStyleClasses = `${isDragging ? "opacity-35 scale-95 transition-all" : ""} ${
        isDragOver ? "ring-2 ring-theme ring-offset-2 ring-dashed scale-102 transition-all shadow-xl" : ""
    }`;

    // 统一的便签右上角管理与拖拽/移动控制条（悬停显现，不遮挡封面图）
    const renderAdminControls = (_focusKey: string) => {
        if (!canManage) return null;
        return (
            <div className="absolute right-2.5 top-2.5 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMoveStep?.(type, "prev");
                    }}
                    title="向前移动一个槽位"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-500 hover:text-theme shadow-xs transition hover:scale-110 select-none"
                >
                    <i className="ri-arrow-left-s-line text-xs" />
                </button>
                <div
                    title="按住拖放重排次序"
                    draggable
                    onDragStart={onDragStart}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-500 hover:text-theme shadow-xs cursor-grab active:cursor-grabbing transition hover:scale-110 select-none"
                >
                    <i className="ri-drag-move-2-line text-xs" />
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMoveStep?.(type, "next");
                    }}
                    title="向后移动一个槽位"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-500 hover:text-theme shadow-xs transition hover:scale-110 select-none"
                >
                    <i className="ri-arrow-right-s-line text-xs" />
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditNote?.(type);
                    }}
                    title="就地编辑便签设置"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-xs transition hover:scale-110 hover:text-theme select-none"
                >
                    <i className="ri-settings-3-line text-xs" />
                </button>
            </div>
        );
    };

    // 紧凑文章列表 / 图文双栏杂志适配：便签自动收敛为克制横向导览条，避免破坏阅读流
    if (siteConfig?.feedCardVariant === "compact" || siteConfig?.feedCardVariant === "editorial") {
        const isEditorial = siteConfig?.feedCardVariant === "editorial";
        const meta = {
            about: { icon: "ri-user-smile-line", title: "关于我", url: siteConfig.atelierAboutUrl || "/about", desc: siteConfig.atelierAboutDesc || "记忆工坊与随笔空间" },
            timeline: { icon: "ri-time-line", title: "岁月轨迹", url: siteConfig.atelierTimelineUrl || "/timeline", desc: siteConfig.atelierTimelineDesc || "时间轴历程与脚印" },
            moments: { icon: "ri-chat-smile-2-line", title: "日常随想", url: siteConfig.atelierMomentsUrl || "/moments", desc: siteConfig.atelierMomentsDesc || "日常随笔与动态" },
            friends: { icon: "ri-links-line", title: "星廊友链", url: siteConfig.atelierFriendsUrl || "/friends", desc: siteConfig.atelierFriendsDesc || "友情链接与同行空间" },
            search: { icon: "ri-search-line", title: "站内检索", url: siteConfig.atelierSearchUrl || "/search", desc: siteConfig.atelierSearchDesc || "输入关键词快速检索" },
        }[type];

        return (
            <div
                className={`group flex items-center justify-between gap-3 transition-colors text-xs ${
                    isEditorial
                        ? "py-3.5 pl-4 border-l-2 border-theme/60 bg-theme/[0.025] hover:bg-theme/[0.05] pr-3 my-2 rounded-r-xl"
                        : "px-4 py-2.5 bg-neutral-50/70 dark:bg-white/[0.02] hover:bg-theme/[0.04]"
                } ${dragStyleClasses}`}
                {...dragHandlers}
            >
                <Link href={meta.url} className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-theme/10 text-theme shrink-0">
                        <i className={meta.icon} />
                    </span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-100 shrink-0">{meta.title}</span>
                    <span className="truncate text-neutral-500 dark:text-neutral-400">{meta.desc}</span>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                    <Link href={meta.url} className="text-[11px] font-medium text-theme hover:underline">
                        进入 &rarr;
                    </Link>
                    {canManage ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEditNote?.(type);
                            }}
                            className="text-neutral-400 hover:text-theme p-1 cursor-pointer"
                            title="编辑此导览卡片"
                        >
                            <i className="ri-settings-4-line text-xs" />
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }

    // 统一克制便签元数据（遵循《美化章程》第三章：体量克制 + 封面图默认悬停浮现文字）
    const noteSpecMap = {
        about: {
            url: siteConfig.atelierAboutUrl || "/about",
            bgImage: siteConfig.atelierAboutBg || "",
            style: siteConfig.atelierAboutStyle || "card",
            textMode: (siteConfig.atelierAboutTextMode || "hover") as "hover" | "hidden" | "always",
            icon: siteConfig.atelierAboutIcon,
            fallbackIcon: "ri-user-smile-line",
            title: siteConfig.name || "关于我",
            shortSub: "关于我",
            desc: siteConfig.atelierAboutDesc || "欢迎光临我的记忆工坊与随笔空间。",
            cta: "关于我",
            tiltClass: "rotate-[0.8deg]",
        },
        timeline: {
            url: siteConfig.atelierTimelineUrl || "/timeline",
            bgImage: siteConfig.atelierTimelineBg || "",
            style: siteConfig.atelierTimelineStyle || "card",
            textMode: (siteConfig.atelierTimelineTextMode || "hover") as "hover" | "hidden" | "always",
            icon: siteConfig.atelierTimelineIcon,
            fallbackIcon: "ri-time-line",
            title: "岁月轨迹",
            shortSub: "时光刻度",
            desc: siteConfig.atelierTimelineDesc || "以时间为轴，串联每一次灵感与足迹。",
            cta: "查看轨迹",
            tiltClass: "-rotate-[1deg]",
        },
        moments: {
            url: siteConfig.atelierMomentsUrl || "/moments",
            bgImage: siteConfig.atelierMomentsBg || "",
            style: siteConfig.atelierMomentsStyle || "card",
            textMode: (siteConfig.atelierMomentsTextMode || "hover") as "hover" | "hidden" | "always",
            icon: siteConfig.atelierMomentsIcon,
            fallbackIcon: "ri-chat-heart-line",
            title: "日常随想",
            shortSub: "随笔动态",
            desc: siteConfig.atelierMomentsDesc || "生活碎碎念与即兴灵感记录。",
            cta: "进入动态",
            tiltClass: "rotate-[1deg]",
        },
        friends: {
            url: siteConfig.atelierFriendsUrl || "/friends",
            bgImage: siteConfig.atelierFriendsBg || "",
            style: siteConfig.atelierFriendsStyle || "card",
            textMode: (siteConfig.atelierFriendsTextMode || "hover") as "hover" | "hidden" | "always",
            icon: siteConfig.atelierFriendsIcon,
            fallbackIcon: "ri-planet-line",
            title: "星廊友链",
            shortSub: "数字花园",
            desc: siteConfig.atelierFriendsDesc || "漫步同好博主的数字花园。",
            cta: "拜访朋友",
            tiltClass: "-rotate-[0.8deg]",
        },
        search: {
            url: siteConfig.atelierSearchUrl || "/search",
            bgImage: siteConfig.atelierSearchBg || "",
            style: siteConfig.atelierSearchStyle || "card",
            textMode: (siteConfig.atelierSearchTextMode || "hover") as "hover" | "hidden" | "always",
            icon: siteConfig.atelierSearchIcon,
            fallbackIcon: "ri-search-line",
            title: "随心探索",
            shortSub: "站内检索",
            desc: siteConfig.atelierSearchDesc || "输入关键词即刻检索全站文章。",
            cta: "站内检索",
            tiltClass: "rotate-[0.6deg]",
        },
    };

    const spec = noteSpecMap[type];
    const hasBg = Boolean(spec.bgImage && spec.bgImage.trim().length > 0);
    const showTextOverlay = !hasBg || spec.textMode !== "hidden";
    const overlayVisibilityClass =
        hasBg && spec.textMode === "hover"
            ? "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            : "opacity-100";

    // 1. 精致小圆盘样式（收敛为 128~144px 轻巧徽章，绝不膨胀）
    if (spec.style === "circle") {
        return (
            <div
                {...dragHandlers}
                onClick={() => setLocation(spec.url)}
                className={`group relative break-inside-avoid mb-5 flex flex-col items-center justify-center rounded-full aspect-square w-32 sm:w-36 mx-auto shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer select-none overflow-hidden border border-neutral-200/80 dark:border-white/10 ${
                    hasBg ? "bg-neutral-900" : "bg-w"
                } text-center ${dragStyleClasses}`}
            >
                {hasBg ? (
                    <img
                        src={spec.bgImage}
                        alt={spec.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : null}
                {renderAdminControls(type)}
                {showTextOverlay ? (
                    <div
                        className={`relative z-10 flex h-full w-full flex-col items-center justify-center p-3 ${
                            hasBg ? `bg-black/55 backdrop-blur-[1px] text-white ${overlayVisibilityClass}` : ""
                        }`}
                    >
                        <span className={`text-xl mb-1 ${hasBg ? "text-white" : "text-theme"}`}>
                            <VectorIcon name={spec.icon} fallback={spec.fallbackIcon} />
                        </span>
                        <p className={`font-bold text-xs truncate max-w-[96px] ${hasBg ? "text-white" : "t-primary"}`}>
                            {spec.title}
                        </p>
                        <span className={`text-[10px] mt-0.5 font-medium ${hasBg ? "text-white/80" : "text-theme"}`}>
                            {spec.cta} &rarr;
                        </span>
                    </div>
                ) : null}
            </div>
        );
    }

    // 2. 极简小胶囊样式（轻巧单行条，不臃肿）
    if (spec.style === "capsule") {
        return (
            <div
                {...dragHandlers}
                onClick={() => setLocation(spec.url)}
                className={`group relative break-inside-avoid mb-4 flex items-center justify-between px-4 py-2.5 rounded-full shadow-2xs hover:shadow-md transition-all duration-200 hover:scale-[1.01] cursor-pointer select-none overflow-hidden border border-neutral-200/80 dark:border-white/10 ${
                    hasBg ? "bg-neutral-900 min-h-[48px]" : "bg-w"
                } ${dragStyleClasses}`}
            >
                {hasBg ? (
                    <img
                        src={spec.bgImage}
                        alt={spec.title}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                ) : null}
                {renderAdminControls(type)}
                {showTextOverlay ? (
                    <div
                        className={`relative z-10 flex w-full items-center justify-between gap-2 ${
                            hasBg ? `bg-black/45 -mx-4 -my-2.5 px-4 py-2.5 text-white ${overlayVisibilityClass}` : ""
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-base shrink-0 ${hasBg ? "text-white" : "text-theme"}`}>
                                <VectorIcon name={spec.icon} fallback={spec.fallbackIcon} />
                            </span>
                            <div className="min-w-0 truncate">
                                <p className={`font-bold text-xs truncate ${hasBg ? "text-white" : "t-primary"}`}>{spec.title}</p>
                                <p className={`text-[10px] truncate ${hasBg ? "text-white/75" : "text-neutral-400"}`}>{spec.shortSub}</p>
                            </div>
                        </div>
                        <span className={`text-xs shrink-0 font-bold ${hasBg ? "text-white/90" : "text-theme"}`}>&rarr;</span>
                    </div>
                ) : null}
            </div>
        );
    }

    // 3. 紧凑卡片样式（有封面图时完整展示原图，默认仅悬停时浮现轻磨砂文字，常态零遮挡）
    if (hasBg) {
        return (
            <div
                {...dragHandlers}
                onClick={type === "search" ? undefined : () => setLocation(spec.url)}
                className={`group relative break-inside-avoid mb-5 block w-full rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 transform ${
                    siteConfig.feedCardVariant === "poster" ? "" : `${spec.tiltClass} hover:rotate-0`
                } hover:scale-[1.02] cursor-pointer select-none overflow-hidden border border-black/10 dark:border-white/10 bg-neutral-900 ${dragStyleClasses}`}
            >
                {renderAdminControls(type)}
                <img
                    src={spec.bgImage}
                    alt={spec.title}
                    className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {showTextOverlay ? (
                    <div
                        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3.5 pt-8 pb-3 text-white ${overlayVisibilityClass}`}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm text-white/90">
                                <VectorIcon name={spec.icon} fallback={spec.fallbackIcon} />
                            </span>
                            <p className="font-bold text-sm truncate">{spec.title}</p>
                        </div>
                        <p className="text-[11px] text-white/80 mt-0.5 line-clamp-2 leading-snug">{spec.desc}</p>
                        {type === "search" ? (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (searchKeyword.trim()) {
                                        setLocation(`/search/${encodeURIComponent(searchKeyword.trim())}`);
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 flex items-center gap-1.5"
                            >
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    placeholder="输入关键词按回车..."
                                    className="w-full rounded-lg border border-white/25 bg-black/45 px-2.5 py-1 text-[11px] text-white placeholder-white/60 backdrop-blur-sm focus:outline-none focus:border-white"
                                />
                                <button
                                    type="submit"
                                    className="shrink-0 rounded-lg bg-theme px-2.5 py-1 text-[11px] font-bold text-white"
                                >
                                    搜
                                </button>
                            </form>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }

    // 无封面图时的精致克制手账卡片（统一跟随主题色语义令牌，不再强塞五颜六色糖果底）
    return (
        <div
            {...dragHandlers}
            onClick={type === "search" ? undefined : () => setLocation(spec.url)}
            className={`group relative break-inside-avoid mb-5 block w-full rounded-2xl p-3.5 shadow-2xs hover:shadow-md transition-all duration-300 transform ${
                siteConfig.feedCardVariant === "poster" ? "" : `${spec.tiltClass} hover:rotate-0`
            } hover:scale-[1.01] cursor-pointer select-none overflow-hidden border border-neutral-200/80 dark:border-white/10 bg-w ${dragStyleClasses}`}
        >
            <div className="absolute -top-1.5 left-5 w-7 h-2.5 bg-theme/20 dark:bg-theme/30 rounded-xs rotate-[-4deg] pointer-events-none" />
            {renderAdminControls(type)}

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm shrink-0">
                        <VectorIcon name={spec.icon} fallback={spec.fallbackIcon} />
                    </span>
                    <p className="font-bold text-sm t-primary truncate">{spec.title}</p>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2">
                    {spec.desc}
                </p>

                {type === "search" ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (searchKeyword.trim()) {
                                setLocation(`/search/${encodeURIComponent(searchKeyword.trim())}`);
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2.5 flex items-center gap-1.5"
                    >
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="输入关键词按回车..."
                            className="rin-field !py-1.5"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-lg bg-theme px-3 py-1.5 text-[11px] font-bold text-white hover:bg-theme-hover transition"
                        >
                            搜索
                        </button>
                    </form>
                ) : (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-theme group-hover:underline">
                        <span>{spec.cta} &rarr;</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 🃏 Interactive Flip / Gallery Deck Card
 * 支持管理员直接拖拽图片上传至 R2 图床，并提供快速复制直链
 */
function NextDeckFlipCard({
    totalCount,
    siteConfig,
    canManage = false,
    onEditDeck,
}: {
    totalCount: number;
    siteConfig: any;
    canManage?: boolean;
    onEditDeck?: () => void;
}) {
    const bgImage = siteConfig?.atelierDeckBg;
    const deckUrl = siteConfig?.atelierDeckUrl || "/gallery";
    const deckDesc = siteConfig?.atelierDeckDesc || `共 ${totalCount} 张记忆相片已收录`;
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showAlert, AlertUI } = useAlert();

    const handleUpload = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            showAlert("请上传图片格式文件（jpg、png、webp 等）哦~");
            return;
        }
        setUploading(true);
        try {
            const { data, error } = await client.storage.upload(file);
            if (data?.url) {
                showAlert(`✨ 图片上传成功！直链已自动生成并复制到剪贴板：\n${data.url}`);
                try {
                    await navigator.clipboard.writeText(data.url);
                } catch {}
            } else {
                showAlert(`上传失败：${error?.value || "网络错误"}`);
            }
        } catch (err: any) {
            showAlert(`上传发生异常：${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    // 紧凑列表与图文杂志适配：画廊入口与列表节奏统一
    if (siteConfig?.feedCardVariant === "compact" || siteConfig?.feedCardVariant === "editorial") {
        const isEditorial = siteConfig?.feedCardVariant === "editorial";
        return (
            <div
                className={`group flex items-center justify-between gap-3 transition-colors text-xs ${
                    isEditorial
                        ? "py-4 pl-4 border-l-2 border-theme-secondary/70 bg-theme-secondary/[0.04] pr-3 my-2 rounded-r-xl"
                        : "px-4 py-2.5 bg-neutral-50/70 dark:bg-white/[0.02] hover:bg-theme/[0.04]"
                }`}
            >
                <Link href={deckUrl} className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-theme/10 text-theme shrink-0">
                        <i className="ri-gallery-line" />
                    </span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-100 shrink-0">图库相册</span>
                    <span className="truncate text-neutral-500 dark:text-neutral-400">{deckDesc}</span>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                    <Link href={deckUrl} className="text-[11px] font-medium text-theme hover:underline">
                        浏览 &rarr;
                    </Link>
                    {canManage ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEditDeck?.();
                            }}
                            className="text-neutral-400 hover:text-theme p-1 cursor-pointer"
                            title="编辑图库入口"
                        >
                            <i className="ri-settings-4-line text-xs" />
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }

    const deckTextMode = (siteConfig?.atelierDeckTextMode || "hover") as "hover" | "hidden" | "always";
    const deckHasBg = Boolean(bgImage && String(bgImage).trim().length > 0);
    const deckShowText = !deckHasBg || deckTextMode !== "hidden";
    const deckOverlayClass =
        deckHasBg && deckTextMode === "hover"
            ? "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            : "opacity-100";

    return (
        <div
            onDragOver={(e) => {
                if (!canManage) return;
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                if (!canManage) return;
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    void handleUpload(e.dataTransfer.files[0]);
                }
            }}
            className={`group relative break-inside-avoid mb-5 block w-full rounded-2xl text-center select-none shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] hover:rotate-0 ${
                siteConfig?.feedCardVariant === "poster" ? "" : "rotate-[0.6deg]"
            } overflow-hidden border ${
                isDragging
                    ? "border-theme ring-4 ring-theme/30 bg-theme/10 scale-105"
                    : deckHasBg
                    ? "bg-neutral-900 border-black/10 dark:border-white/10"
                    : "p-4 bg-w border-dashed border-theme/35"
            }`}
        >
            {deckHasBg ? (
                <img
                    src={bgImage}
                    alt="记忆翻动"
                    className="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.03]"
                />
            ) : null}

            {canManage && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditDeck?.();
                    }}
                    title="就地编辑图库便签设置"
                    className="absolute right-2.5 top-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-sm opacity-0 group-hover:opacity-100 transition hover:scale-110 hover:text-theme"
                >
                    <i className="ri-settings-3-line text-xs" />
                </button>
            )}

            {/* 隐藏的上传选择 input */}
            {canManage && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            void handleUpload(e.target.files[0]);
                        }
                    }}
                />
            )}

            {deckShowText ? (
                <div
                    className={
                        deckHasBg
                            ? `absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-3.5 text-white ${deckOverlayClass}`
                            : "relative z-10"
                    }
                >
                    <span className={`text-2xl block mb-1 ${deckHasBg ? "text-white" : "text-theme"}`}>
                        {isDragging ? <i className="ri-inbox-archive-line" /> : <VectorIcon name={siteConfig.atelierDeckIcon} fallback="ri-camera-lens-line" />}
                    </span>
                    <p className={`font-bold text-sm ${deckHasBg ? "text-white" : "t-primary"}`}>
                        {isDragging ? "松开即刻上传至 R2" : "图库相册"}
                    </p>
                    <p className={`text-[11px] mt-0.5 line-clamp-2 ${deckHasBg ? "text-white/80" : "text-neutral-500 dark:text-neutral-400"}`}>
                        {canManage ? "拖入图片极速上传至 R2" : deckDesc}
                    </p>

                    <div className="mt-2.5 flex items-center justify-center gap-2">
                        {canManage ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-theme px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition hover:bg-theme-hover active:scale-95 disabled:opacity-50"
                            >
                                <i className={uploading ? "ri-loader-4-line animate-spin" : "ri-upload-cloud-2-line"} />
                                <span>{uploading ? "上传中" : "传图"}</span>
                            </button>
                        ) : null}

                        <Link
                            href={deckUrl}
                            className={`inline-flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold transition active:scale-95 ${
                                deckHasBg
                                    ? "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
                                    : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 t-primary"
                            }`}
                        >
                            <i className="ri-folder-image-line" />
                            <span>浏览相册</span>
                        </Link>
                    </div>
                </div>
            ) : (
                <Link href={deckUrl} aria-label="漫游图库相册" className="absolute inset-0 z-10" />
            )}
            <AlertUI />
        </div>
    );
}

export function FeedsPage() {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const { showAlert, AlertUI } = useAlert();

    const [listState, _setListState] = useState<FeedType>((query.get("type") as FeedType) || "normal");
    const [status, setStatus] = useState<"loading" | "idle">("loading");
    const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false },
    });

    // 1. 文章快捷更换封面状态与弹窗
    const [editingCoverFeed, setEditingCoverFeed] = useState<any | null>(null);
    const [feedCoverUrl, setFeedCoverUrl] = useState("");
    const [isUploadingFeedCover, setIsUploadingFeedCover] = useState(false);
    const [isR2CoverPickerOpen, setIsR2CoverPickerOpen] = useState(false);
    const coverFileInputRef = useRef<HTMLInputElement>(null);

    // 2. 便签专属排版与内容前台就地编辑状态与弹窗
    const [editingNoteType, setEditingNoteType] = useState<string | null>(null);
    const [noteTitle, setNoteTitle] = useState("");
    const [noteDesc, setNoteDesc] = useState("");
    const [noteStyle, setNoteStyle] = useState("card");
    const [noteTextMode, setNoteTextMode] = useState<"hover" | "hidden" | "always">("hover");
    const [noteBg, setNoteBg] = useState("");
    const [noteUrl, setNoteUrl] = useState("");
    const [noteShow, setNoteShow] = useState(true);
    const [isR2NoteBgPickerOpen, setIsR2NoteBgPickerOpen] = useState(false);
    const [isUploadingNoteBg, setIsUploadingNoteBg] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [noteBgFileInputRef] = [useRef<HTMLInputElement>(null)];

    // 仅在桌面大屏 (非移动触控设备) 下允许管理员拖拽重排卡片，杜绝移动触屏产生手势竞争与卡顿
    const canDragCards = useMemo(() => {
        if (!profile?.permission) return false;
        if (typeof window === "undefined") return false;
        return window.innerWidth >= 768 && !window.matchMedia("(pointer: coarse)").matches;
    }, [profile?.permission]);

    // 3. 首页推荐标签高密超级表格管理 (Dense DataGrid)
    const [isTagSettingsOpen, setIsTagSettingsOpen] = useState(false);
    const [draggedTagId, setDraggedTagId] = useState<number | null>(null);
    const [dragOverTagId, setDragOverTagId] = useState<number | null>(null);
    const [editingTagAliasId, setEditingTagAliasId] = useState<number | null>(null);
    const [editingTagAliasText, setEditingTagAliasText] = useState("");

    const [homepageTagsConfig, setHomepageTagsConfig] = useState<{
        hiddenIds: number[];
        customOrder: number[];
        limit: number | "all";
        palette: "pastel" | "macaron" | "cyber" | "theme" | "mono";
        aliases: Record<number, string>;
    }>(() => {
        try {
            const saved = localStorage.getItem("rin_gallery_homepage_tags_config");
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    hiddenIds: parsed.hiddenIds || [],
                    customOrder: parsed.customOrder || [],
                    limit: parsed.limit ?? 8,
                    palette: parsed.palette || "pastel",
                    aliases: parsed.aliases || {},
                };
            }
        } catch {}
        return { hiddenIds: [], customOrder: [], limit: 8, palette: "pastel", aliases: {} };
    });

    const limit = 36;
    const shuffleSeed = 0;

    const currentFeeds = feeds[listState] ?? { size: 0, data: [], hasNext: false };
    const currentFeedData = Array.isArray(currentFeeds.data) ? currentFeeds.data : [];

    const isCentered = siteConfig.galleryAlign !== "fluid";
    const paddingSide = Math.max(0, siteConfig.galleryPadding ?? 24);
    const gapSize = Math.max(12, siteConfig.galleryCardGap ?? 24);

    const getColumnsClass = (cols: string) => {
        switch (cols) {
            case "2":
                return "columns-1 sm:columns-2";
            case "3":
                return "columns-1 sm:columns-2 lg:columns-3";
            case "4":
                return "columns-1 sm:columns-2 lg:columns-3 xl:columns-4";
            case "5":
                return "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5";
            case "auto":
            default:
                return "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-4";
        }
    };

    const getMainMaxWidth = () => {
        if (!isCentered) return "100%";
        switch (siteConfig.galleryColumns) {
            case "2":
                return "1080px";
            case "3":
                return "1440px";
            case "4":
                return "1820px";
            case "5":
                return "2200px";
            default:
                return "1820px";
        }
    };

    function fetchFeeds(type: FeedType, targetPage = 1, append = false) {
        if (!append) {
            setStatus("loading");
        }
        client.feed
            .list({
                page: targetPage,
                limit,
                type,
            })
            .then(({ data }) => {
                if (data) {
                    setFeeds((prev) => ({
                        ...prev,
                        [type]: {
                            size: data.size,
                            data: append ? [...prev[type].data, ...data.data] : data.data,
                            hasNext: data.hasNext,
                        },
                    }));
                }
            })
            .finally(() => {
                setStatus("idle");
            });
    }

    // Fetch popular tags for floating charms
    useEffect(() => {
        client.tag.list().then(({ data }) => {
            if (data && Array.isArray(data)) {
                setTags(data);
            }
        }).catch(() => {});
    }, []);

    // 画廊首页全流（文章 + 便签）自由混排拖拽与持久化排序
    const [draggedStreamItem, setDraggedStreamItem] = useState<string | null>(null);
    const [dragOverStreamItem, setDragOverStreamItem] = useState<string | null>(null);
    const [streamOrder, setStreamOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem("rin_gallery_stream_order");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {}
        return [];
    });

    const resetStreamOrder = () => {
        setStreamOrder([]);
        try {
            localStorage.removeItem("rin_gallery_stream_order");
            localStorage.removeItem("rin_atelier_notes_order");
        } catch {}
    };

    const getItemKey = (item: { type: "photo" | "note" | "deck"; data?: any; noteType?: any }) => {
        if (item.type === "photo") return `feed:${item.data.id}`;
        if (item.type === "note") return `note:${item.noteType}`;
        return "deck";
    };

    const handleStreamDrop = (targetKey: string, firstPageKeys: string[]) => {
        if (!draggedStreamItem || draggedStreamItem === targetKey) {
            setDraggedStreamItem(null);
            setDragOverStreamItem(null);
            return;
        }

        let effectiveKeys = [...firstPageKeys];
        const fromIdx = effectiveKeys.indexOf(draggedStreamItem);
        const toIdx = effectiveKeys.indexOf(targetKey);
        if (fromIdx !== -1 && toIdx !== -1) {
            const nextOrder = [...effectiveKeys];
            nextOrder.splice(fromIdx, 1);
            nextOrder.splice(toIdx, 0, draggedStreamItem);
            setStreamOrder(nextOrder);
            try {
                localStorage.setItem("rin_gallery_stream_order", JSON.stringify(nextOrder));
            } catch {}
        }
        setDraggedStreamItem(null);
        setDragOverStreamItem(null);
    };

    const moveNoteStep = (targetType: string, direction: "prev" | "next", currentKeys: string[]) => {
        const targetKey = `note:${targetType}`;
        const idx = currentKeys.indexOf(targetKey);
        if (idx === -1) return;
        const targetIdx = direction === "prev" ? Math.max(0, idx - 1) : Math.min(currentKeys.length - 1, idx + 1);
        if (targetIdx === idx) return;

        const nextOrder = [...currentKeys];
        const item = nextOrder.splice(idx, 1)[0];
        nextOrder.splice(targetIdx, 0, item);
        setStreamOrder(nextOrder);
        try {
            localStorage.setItem("rin_gallery_stream_order", JSON.stringify(nextOrder));
        } catch {}
    };

    // 快捷打开文章封面置换
    const openCoverModal = (feed: any) => {
        setEditingCoverFeed(feed);
        setFeedCoverUrl(feed.avatar || "");
    };

    const handleCoverFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showAlert("请选择图片格式文件");
            return;
        }
        setIsUploadingFeedCover(true);
        try {
            const { data, error } = await client.storage.upload(file);
            if (error || !data?.url) {
                showAlert(typeof error === "string" ? error : (error?.value as string) || "图片上传失败");
            } else {
                setFeedCoverUrl(data.url);
            }
        } catch (err: any) {
            showAlert(err.message || "上传异常");
        } finally {
            setIsUploadingFeedCover(false);
            if (coverFileInputRef.current) coverFileInputRef.current.value = "";
        }
    };

    const handleSaveFeedCover = async () => {
        if (!editingCoverFeed) return;
        const finalUrl = feedCoverUrl.trim();
        if (!finalUrl) {
            showAlert("请输入封面图片链接或上传本地图片");
            return;
        }

        try {
            const { error } = await client.feed.setCover(editingCoverFeed.id, finalUrl);
            if (error) {
                showAlert(typeof error === "string" ? error : (error.value as string) || "更换封面失败");
            } else {
                setFeeds((prev) => ({
                    ...prev,
                    [listState]: {
                        ...prev[listState],
                        data: prev[listState].data.map((f) =>
                            f.id === editingCoverFeed.id ? { ...f, avatar: finalUrl } : f
                        ),
                    },
                }));
                showAlert(`文章 #${editingCoverFeed.id}「${editingCoverFeed.title}」封面已成功更换！`);
                setEditingCoverFeed(null);
            }
        } catch (err: any) {
            showAlert(err.message || "更新封面异常");
        }
    };

    // 快捷打开便签前台就地设置
    const openNoteSettingsModal = (type: string) => {
        setEditingNoteType(type);
        if (type === "about") {
            setNoteTitle(siteConfig.name || "80hou");
            setNoteDesc(siteConfig.atelierAboutDesc || "");
            setNoteStyle(siteConfig.atelierAboutStyle || "card");
            setNoteTextMode(siteConfig.atelierAboutTextMode || "hover");
            setNoteBg(siteConfig.atelierAboutBg || "");
            setNoteUrl(siteConfig.atelierAboutUrl || "/about");
            setNoteShow(siteConfig.atelierAboutShow !== false);
        } else if (type === "timeline") {
            setNoteTitle("岁月轨迹");
            setNoteDesc(siteConfig.atelierTimelineDesc || "");
            setNoteStyle(siteConfig.atelierTimelineStyle || "card");
            setNoteTextMode(siteConfig.atelierTimelineTextMode || "hover");
            setNoteBg(siteConfig.atelierTimelineBg || "");
            setNoteUrl(siteConfig.atelierTimelineUrl || "/timeline");
            setNoteShow(siteConfig.atelierTimelineShow !== false);
        } else if (type === "moments") {
            setNoteTitle("朋友圈动态");
            setNoteDesc(siteConfig.atelierMomentsDesc || "");
            setNoteStyle(siteConfig.atelierMomentsStyle || "card");
            setNoteTextMode(siteConfig.atelierMomentsTextMode || "hover");
            setNoteBg(siteConfig.atelierMomentsBg || "");
            setNoteUrl(siteConfig.atelierMomentsUrl || "/moments");
            setNoteShow(siteConfig.atelierMomentsShow !== false);
        } else if (type === "friends") {
            setNoteTitle("星廊");
            setNoteDesc(siteConfig.atelierFriendsDesc || "");
            setNoteStyle(siteConfig.atelierFriendsStyle || "card");
            setNoteTextMode(siteConfig.atelierFriendsTextMode || "hover");
            setNoteBg(siteConfig.atelierFriendsBg || "");
            setNoteUrl(siteConfig.atelierFriendsUrl || "/friends");
            setNoteShow(siteConfig.atelierFriendsShow !== false);
        } else if (type === "search") {
            setNoteTitle("随心探索");
            setNoteDesc(siteConfig.atelierSearchDesc || "");
            setNoteStyle(siteConfig.atelierSearchStyle || "card");
            setNoteTextMode(siteConfig.atelierSearchTextMode || "hover");
            setNoteBg(siteConfig.atelierSearchBg || "");
            setNoteUrl(siteConfig.atelierSearchUrl || "/search");
            setNoteShow(siteConfig.atelierSearchShow !== false);
        } else if (type === "deck") {
            setNoteTitle("图库相册");
            setNoteDesc(siteConfig.atelierDeckDesc || "");
            setNoteStyle("card");
            setNoteTextMode(siteConfig.atelierDeckTextMode || "hover");
            setNoteBg(siteConfig.atelierDeckBg || "");
            setNoteUrl(siteConfig.atelierDeckUrl || "/gallery");
            setNoteShow(siteConfig.atelierDeckShow !== false);
        }
    };

    const handleNoteBgFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showAlert("请选择图片格式文件");
            return;
        }
        setIsUploadingNoteBg(true);
        try {
            const { data, error } = await client.storage.upload(file);
            if (error || !data?.url) {
                showAlert(typeof error === "string" ? error : (error?.value as string) || "图片上传失败");
            } else {
                setNoteBg(data.url);
            }
        } catch (err: any) {
            showAlert(err.message || "上传异常");
        } finally {
            setIsUploadingNoteBg(false);
            if (noteBgFileInputRef.current) noteBgFileInputRef.current.value = "";
        }
    };

    const handleSaveNoteSettings = async () => {
        if (!editingNoteType) return;
        setIsSavingNote(true);
        const updates: Record<string, any> = {};

        if (editingNoteType === "about") {
            updates["atelier.about_desc"] = noteDesc;
            updates["atelier.about_style"] = noteStyle;
            updates["atelier.about_text_mode"] = noteTextMode;
            updates["atelier.about_bg"] = noteBg;
            updates["atelier.about_url"] = noteUrl;
            updates["atelier.about_show"] = noteShow;
        } else if (editingNoteType === "timeline") {
            updates["atelier.timeline_desc"] = noteDesc;
            updates["atelier.timeline_style"] = noteStyle;
            updates["atelier.timeline_text_mode"] = noteTextMode;
            updates["atelier.timeline_bg"] = noteBg;
            updates["atelier.timeline_url"] = noteUrl;
            updates["atelier.timeline_show"] = noteShow;
        } else if (editingNoteType === "moments") {
            updates["atelier.moments_desc"] = noteDesc;
            updates["atelier.moments_style"] = noteStyle;
            updates["atelier.moments_text_mode"] = noteTextMode;
            updates["atelier.moments_bg"] = noteBg;
            updates["atelier.moments_url"] = noteUrl;
            updates["atelier.moments_show"] = noteShow;
        } else if (editingNoteType === "friends") {
            updates["atelier.friends_desc"] = noteDesc;
            updates["atelier.friends_style"] = noteStyle;
            updates["atelier.friends_text_mode"] = noteTextMode;
            updates["atelier.friends_bg"] = noteBg;
            updates["atelier.friends_url"] = noteUrl;
            updates["atelier.friends_show"] = noteShow;
        } else if (editingNoteType === "search") {
            updates["atelier.search_desc"] = noteDesc;
            updates["atelier.search_style"] = noteStyle;
            updates["atelier.search_text_mode"] = noteTextMode;
            updates["atelier.search_bg"] = noteBg;
            updates["atelier.search_url"] = noteUrl;
            updates["atelier.search_show"] = noteShow;
        } else if (editingNoteType === "deck") {
            updates["atelier.deck_desc"] = noteDesc;
            updates["atelier.deck_text_mode"] = noteTextMode;
            updates["atelier.deck_bg"] = noteBg;
            updates["atelier.deck_url"] = noteUrl;
            updates["atelier.deck_show"] = noteShow;
        }

        try {
            const cached = sessionStorage.getItem("config");
            const parsed = cached ? JSON.parse(cached) : {};
            sessionStorage.setItem("config", JSON.stringify({ ...parsed, ...updates }));
            window.dispatchEvent(new Event("rin:config-updated"));
            await client.config.update("client", updates);
            setEditingNoteType(null);
        } catch (e: any) {
            showAlert(e.message || "保存失败");
        } finally {
            setIsSavingNote(false);
        }
    };

    const updateTagsConfig = (updates: Partial<typeof homepageTagsConfig>) => {
        const next = { ...homepageTagsConfig, ...updates };
        setHomepageTagsConfig(next);
        try {
            localStorage.setItem("rin_gallery_homepage_tags_config", JSON.stringify(next));
        } catch {}
    };

    const getTagColorClass = (index: number) => {
        const p = homepageTagsConfig.palette || "pastel";
        if (p === "theme") {
            return "bg-theme/10 text-theme border-theme/20 hover:bg-theme/20";
        }
        if (p === "mono") {
            return "bg-black/5 text-neutral-700 border-black/10 dark:bg-white/5 dark:text-neutral-300 dark:border-white/10 hover:border-theme";
        }
        if (p === "macaron") {
            const macaron = [
                "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
                "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
                "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
                "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
            ];
            return macaron[index % macaron.length];
        }
        if (p === "cyber") {
            const cyber = [
                "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 shadow-xs",
                "bg-cyan-500/10 text-cyan-600 border-cyan-500/30 dark:bg-cyan-950/50 dark:text-cyan-300 shadow-xs",
                "bg-lime-500/10 text-lime-600 border-lime-500/30 dark:bg-lime-950/50 dark:text-lime-300 shadow-xs",
                "bg-pink-500/10 text-pink-600 border-pink-500/30 dark:bg-pink-950/50 dark:text-pink-300 shadow-xs",
            ];
            return cyber[index % cyber.length];
        }
        // "pastel" (和风五彩)
        const pastel = [
            "bg-amber-100/90 text-amber-900 border-amber-300/60 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/40",
            "bg-sky-100/90 text-sky-900 border-sky-300/60 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/40",
            "bg-rose-100/90 text-rose-900 border-rose-300/60 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/40",
            "bg-emerald-100/90 text-emerald-900 border-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/40",
            "bg-purple-100/90 text-purple-900 border-purple-300/60 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/40",
        ];
        return pastel[index % pastel.length];
    };

    const tagOrderList = useMemo(() => {
        const currentIds = (tags || []).map((t) => t.id);
        const orderList = homepageTagsConfig.customOrder.length > 0 ? [...homepageTagsConfig.customOrder] : [...currentIds];
        currentIds.forEach((id) => {
            if (!orderList.includes(id)) orderList.push(id);
        });
        return orderList;
    }, [tags, homepageTagsConfig.customOrder]);

    const orderedTagObjects = useMemo(() => {
        return tagOrderList
            .map((id) => (tags || []).find((t) => t.id === id))
            .filter(Boolean) as { id: number; name: string }[];
    }, [tagOrderList, tags]);

    const displayTags = useMemo(() => {
        if (!tags || tags.length === 0) return [];
        let list = orderedTagObjects.filter((t) => !homepageTagsConfig.hiddenIds.includes(t.id));
        const limitCount = homepageTagsConfig.limit === "all" ? list.length : (homepageTagsConfig.limit || 8);
        return list.slice(0, limitCount);
    }, [tags, orderedTagObjects, homepageTagsConfig.hiddenIds, homepageTagsConfig.limit]);

    // 核心排序：输入目标数字直接调序，被替换的位置项依次自动顺延下移
    const handleMoveTagToIndex = (fromIndex: number, targetNumStr: string) => {
        const targetNum = parseInt(targetNumStr.trim(), 10);
        if (isNaN(targetNum) || targetNum < 1) return;
        const targetIdx = Math.min(tagOrderList.length, targetNum) - 1;
        if (targetIdx === fromIndex) return;

        const nextOrder = [...tagOrderList];
        const [moved] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(targetIdx, 0, moved);
        updateTagsConfig({ customOrder: nextOrder });
    };

    // 首页展示数量预设：一步到位，点击 4个/6个/8个/12个/全部 时，严格根据当前表格真实排序，直接将前 N 个置为开启，其余置为隐藏
    const handleSelectTagLimit = (val: number | "all") => {
        if (val === "all") {
            updateTagsConfig({ limit: "all", hiddenIds: [] });
            return;
        }
        const targetCount = Math.max(1, Math.min(val, orderedTagObjects.length));
        const keepIds = new Set(orderedTagObjects.slice(0, targetCount).map((t) => t.id));
        const nextHidden = orderedTagObjects.filter((t) => !keepIds.has(t.id)).map((t) => t.id);
        updateTagsConfig({ limit: val, hiddenIds: nextHidden });
    };

    // 历史缓存自动纠偏自愈：若本地 localStorage 残留了历史旧版本的 3 个开启脏数据，自动按当前 limit 校准
    useEffect(() => {
        if (!orderedTagObjects || orderedTagObjects.length === 0) return;
        const currentLimit = homepageTagsConfig.limit;
        if (typeof currentLimit === "number") {
            const enabledCount = orderedTagObjects.filter((t) => !homepageTagsConfig.hiddenIds.includes(t.id)).length;
            if (enabledCount === 3 && currentLimit !== 3) {
                const keepIds = new Set(orderedTagObjects.slice(0, currentLimit).map((t) => t.id));
                const newHidden = orderedTagObjects.filter((t) => !keepIds.has(t.id)).map((t) => t.id);
                updateTagsConfig({ hiddenIds: newHidden });
            }
        }
    }, [orderedTagObjects.length]);

    // 全选：所有标签开启展示
    const handleSelectAllTags = () => {
        updateTagsConfig({ hiddenIds: [] });
    };

    // 反选：已开启的关闭，已关闭的开启
    const handleInvertTagsVisibility = () => {
        const currentHidden = new Set(homepageTagsConfig.hiddenIds);
        const nextHidden = tagOrderList.filter((id) => !currentHidden.has(id));
        updateTagsConfig({ hiddenIds: nextHidden });
    };

    // 全关：关闭所有标签展示
    const handleDisableAllTags = () => {
        updateTagsConfig({ hiddenIds: [...tagOrderList] });
    };

    const handleToggleTagVisibility = (tagId: number) => {
        const nextHidden = homepageTagsConfig.hiddenIds.includes(tagId)
            ? homepageTagsConfig.hiddenIds.filter((id) => id !== tagId)
            : [...homepageTagsConfig.hiddenIds, tagId];
        updateTagsConfig({ hiddenIds: nextHidden });
    };

    const handleMoveTagStep = (tagId: number, direction: "up" | "down", currentList: number[]) => {
        const orderList = homepageTagsConfig.customOrder.length > 0
            ? [...homepageTagsConfig.customOrder]
            : [...currentList];

        currentList.forEach((id) => {
            if (!orderList.includes(id)) orderList.push(id);
        });

        const idx = orderList.indexOf(tagId);
        if (idx === -1) return;
        const targetIdx = direction === "up" ? Math.max(0, idx - 1) : Math.min(orderList.length - 1, idx + 1);
        if (targetIdx === idx) return;

        const nextOrder = [...orderList];
        const [moved] = nextOrder.splice(idx, 1);
        nextOrder.splice(targetIdx, 0, moved);
        updateTagsConfig({ customOrder: nextOrder });
    };

    const handleTagRowDrop = (targetId: number, orderedIds: number[]) => {
        if (!draggedTagId || draggedTagId === targetId) {
            setDraggedTagId(null);
            setDragOverTagId(null);
            return;
        }
        const currentList = [...orderedIds];
        const fromIdx = currentList.indexOf(draggedTagId);
        const toIdx = currentList.indexOf(targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
            const nextOrder = [...currentList];
            nextOrder.splice(fromIdx, 1);
            nextOrder.splice(toIdx, 0, draggedTagId);
            updateTagsConfig({ customOrder: nextOrder });
        }
        setDraggedTagId(null);
        setDragOverTagId(null);
    };

    const handleResetTagsConfig = () => {
        const resetVal = { hiddenIds: [], customOrder: [], limit: 8, palette: "pastel" as const, aliases: {} };
        setHomepageTagsConfig(resetVal);
        try {
            localStorage.removeItem("rin_gallery_homepage_tags_config");
        } catch {}
    };

    const handleToggleTop = async (feedId: number, nextTop: number) => {
        try {
            await client.feed.setTop(feedId, nextTop);
            fetchFeeds(listState, 1, false);
        } catch {}
    };

    useEffect(() => {
        const type = (query.get("type") as FeedType) || "normal";
        if (type !== listState) {
            _setListState(type);
        }
        fetchFeeds(type, 1, false);
    }, [query.get("type")]);

    const interleavedItems = useMemo(() => {
        const items: Array<{ type: "photo" | "note" | "deck"; data?: any; noteType?: any }> = [];
        const allNoteTypes: Array<{ id: "about" | "timeline" | "moments" | "friends" | "search"; show: boolean }> = [
            { id: "about", show: siteConfig.atelierAboutShow !== false },
            { id: "timeline", show: siteConfig.atelierTimelineShow !== false },
            { id: "moments", show: siteConfig.atelierMomentsShow !== false },
            { id: "friends", show: siteConfig.atelierFriendsShow !== false },
            { id: "search", show: siteConfig.atelierSearchShow !== false },
        ];

        // 仅筛选出用户在后台设置为【在画廊首页展示】的便签！
        const activeNoteTypes = allNoteTypes.filter((n) => n.show).map((n) => n.id);

        // 仅在 normal 模式展示便签；非 normal 模式（草稿/未列出）100% 纯文章展示
        if (listState !== "normal" || currentFeedData.length === 0) {
            return currentFeedData.map((feed) => ({ type: "photo" as const, data: feed }));
        }

        // 核心边界：以第一页上限为分界线，无论后续加载更多追加了多少篇，便签坚决只排在第一页！
        const firstPageLimit = Math.max(1, siteConfig.pageSize || 12);
        const firstPageFeeds = currentFeedData.slice(0, firstPageLimit);
        const subsequentFeeds = currentFeedData.slice(firstPageLimit);

        const layoutMode = siteConfig.atelierNotesLayout || "grid";

        let orderedNotes = [...activeNoteTypes];
        if (layoutMode === "random") {
            orderedNotes = orderedNotes.sort(() => Math.sin(firstPageFeeds.length) - 0.5);
        }

        let noteIdx = 0;
        const totalNotes = orderedNotes.length;

        // 计算便签在首屏文章间的默认插入槽位索引
        const insertionSlots = new Set<number>();
        if (firstPageFeeds.length <= 2) {
            insertionSlots.add(0);
            insertionSlots.add(1);
        } else if (layoutMode === "grid") {
            // 九宫格分布：均衡挑选首屏文章前段、中段、后段槽位
            const step = Math.max(1, Math.floor(firstPageFeeds.length / (totalNotes + 1)));
            for (let i = 1; i <= totalNotes; i++) {
                insertionSlots.add(Math.min(firstPageFeeds.length - 1, i * step));
            }
        } else {
            [1, 4, 7, 11, 15].forEach((slot) => {
                if (slot < firstPageFeeds.length) insertionSlots.add(slot);
            });
        }

        const rawFirstPageItems: Array<{ type: "photo" | "note" | "deck"; data?: any; noteType?: any }> = [];

        // 将首屏文章与便签交错混合
        firstPageFeeds.forEach((feed, i) => {
            rawFirstPageItems.push({ type: "photo", data: feed });
            if (insertionSlots.has(i) && noteIdx < totalNotes) {
                rawFirstPageItems.push({ type: "note", noteType: orderedNotes[noteIdx] });
                noteIdx++;
            }
        });

        // 如果首屏文章太少没放完所有便签，在首屏末尾一次性补充完毕
        while (noteIdx < totalNotes) {
            rawFirstPageItems.push({ type: "note", noteType: orderedNotes[noteIdx] });
            noteIdx++;
        }

        // 记忆翻动卡片（仅当后台开启展示时，在首屏末尾呈现一次）
        if (siteConfig.atelierDeckShow !== false) {
            rawFirstPageItems.push({ type: "deck" });
        }

        // 如果开启了自定义全局混排（支持文章与便签跨界自由拖拽重排）
        if (streamOrder.length > 0) {
            rawFirstPageItems.sort((a, b) => {
                const keyA = getItemKey(a);
                const keyB = getItemKey(b);
                const idxA = streamOrder.indexOf(keyA);
                const idxB = streamOrder.indexOf(keyB);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
        }

        items.push(...rawFirstPageItems);

        // 第一页之后（翻页/加载更多追加进来的所有文章）：100% 纯照片文章卡片，绝无任何便签污染！
        subsequentFeeds.forEach((feed) => {
            items.push({ type: "photo", data: feed });
        });

        return items;
    }, [
        currentFeedData,
        listState,
        streamOrder,
        siteConfig.pageSize,
        siteConfig.atelierNotesLayout,
        siteConfig.atelierAboutShow,
        siteConfig.atelierTimelineShow,
        siteConfig.atelierMomentsShow,
        siteConfig.atelierFriendsShow,
        siteConfig.atelierSearchShow,
        siteConfig.atelierDeckShow,
    ]);

    return (
        <>
            <Helmet>
                <title>{`${siteConfig.name} - ${siteConfig.description || "随性画廊工坊"}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={siteConfig.name} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={document.URL} />
            </Helmet>

            <main
                style={{
                    paddingLeft: `${paddingSide}px`,
                    paddingRight: `${paddingSide}px`,
                    maxWidth: getMainMaxWidth(),
                }}
                className="w-full mx-auto py-4 sm:py-6 mb-16 transition-all duration-300"
            >
                {/* Atelier Mood Bar (Clean Title with Admin Tabs, NO standalone shuffle button) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight t-primary flex items-center gap-2">
                            <span className={`transition-all duration-300 art-title-${siteConfig.atelierTitleStyle || "aurora_flow"}`}>
                                {listState === "draft" ? t("draft_bin") : listState === "unlisted" ? t("unlisted") : siteConfig.atelierTitle || "画廊随想"}
                            </span>
                            <span className="text-base font-normal text-neutral-400 dark:text-neutral-500 font-mono">
                                ({currentFeeds.size})
                            </span>
                        </h1>
                        {Boolean(profile?.permission) && streamOrder.length > 0 && (
                            <button
                                type="button"
                                onClick={resetStreamOrder}
                                title="恢复文章与便签为默认排布次序"
                                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 shadow-2xs border border-amber-500/20 transition select-none active:scale-95"
                            >
                                <i className="ri-restart-line text-xs" />
                                <span>已启用画廊自定义混排顺序 · 点击恢复默认</span>
                            </button>
                        )}
                    </div>

                    {profile?.permission && (
                        <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5 text-xs self-start sm:self-auto">
                            <Link
                                href="/?type=normal"
                                className={`rounded-full px-3 py-1 transition ${
                                    listState === "normal"
                                        ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-800 dark:text-white font-bold"
                                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
                                }`}
                            >
                                {t("article.title")}
                            </Link>
                            <Link
                                href="/?type=draft"
                                className={`rounded-full px-3 py-1 transition ${
                                    listState === "draft"
                                        ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-800 dark:text-white font-bold"
                                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
                                }`}
                            >
                                {t("draft_bin")}
                            </Link>
                            <Link
                                href="/?type=unlisted"
                                className={`rounded-full px-3 py-1 transition ${
                                    listState === "unlisted"
                                        ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-800 dark:text-white font-bold"
                                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
                                }`}
                            >
                                {t("unlisted")}
                            </Link>
                        </div>
                    )}
                </div>

                {/* 🏷️ Floating Washi Tape Charms (Scattered delicately around the whitespace) */}
                {displayTags.length > 0 && listState === "normal" ? (
                    <div className="flex flex-wrap items-center justify-center gap-3 my-4 px-2 select-none ani-show">
                        {displayTags.map((tag, i) => {
                            const rot = [
                                "rotate-[-3deg]",
                                "rotate-[2.5deg]",
                                "-rotate-2",
                                "rotate-[3deg]",
                                "-rotate-1",
                                "rotate-[2deg]",
                                "rotate-[-2.5deg]",
                                "rotate-[1.5deg]",
                            ][i % 8];
                            const bg = getTagColorClass(i);
                            const tagData = (tags || []).find((t: any) => t.id === tag.id) as any;
                            const isSingleArticle = tagData?.feeds === 1 && Boolean(tagData?.singleFeedId);
                            const targetHref = isSingleArticle
                                ? `/feed/${tagData.singleFeedId}`
                                : `/hashtag/${encodeURIComponent(tag.name)}`;
                            const tagDisplayName = homepageTagsConfig.aliases?.[tag.id] || tag.name;
                            return (
                                <Link
                                    key={tag.id}
                                    href={targetHref}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-2xs text-xs font-semibold transform ${rot} hover:rotate-0 hover:scale-110 hover:shadow-md transition-all duration-300 ${bg}`}
                                    title={isSingleArticle ? `独家文章，点击直达正文！` : `浏览 #${tag.name} 标签聚合`}
                                >
                                    <span className="opacity-60 text-[10px]">🏷️</span>
                                    <span>#{tagDisplayName}</span>
                                </Link>
                            );
                        })}
                        {Boolean(profile?.permission) && (
                            <button
                                type="button"
                                onClick={() => setIsTagSettingsOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 hover:bg-theme/10 hover:text-theme text-xs font-semibold t-primary border border-black/10 dark:border-white/10 shadow-2xs transition select-none active:scale-95 cursor-pointer"
                                title="管理画廊首页推荐标签展示与顺序 (Dense DataGrid)"
                            >
                                <i className="ri-settings-3-line text-xs" />
                                <span>设置首页标签</span>
                            </button>
                        )}
                    </div>
                ) : (
                    listState === "normal" && Boolean(profile?.permission) && (
                        <div className="flex justify-center my-4 select-none ani-show">
                            <button
                                type="button"
                                onClick={() => setIsTagSettingsOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-dashed border-theme/40 text-theme text-xs font-semibold hover:bg-theme/5 transition cursor-pointer"
                                title="所有首页推荐标签已被隐藏，点击重新配置或启用"
                            >
                                <i className="ri-price-tag-3-line text-xs" />
                                <span>首页标签已全部隐藏 · 点击管理标签</span>
                            </button>
                        </div>
                    )
                )}

                {/* Main Atelier Canvas: Staggered, Organic Columns with Large Posters */}
                {status === "loading" && currentFeedData.length === 0 ? (
                    <div
                        style={{ columnGap: `${gapSize}px` }}
                        className={`${getColumnsClass(siteConfig.galleryColumns)} space-y-6`}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div
                                key={i}
                                className="break-inside-avoid rounded-3xl border border-black/5 bg-white p-3 dark:border-white/5 dark:bg-neutral-900 animate-pulse"
                            >
                                <div className="h-72 w-full rounded-2xl bg-neutral-200 dark:bg-neutral-800 mb-2" />
                                <div className="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
                            </div>
                        ))}
                    </div>
                ) : currentFeedData.length === 0 ? (
                    <EmptyFeedsState listState={listState} canWrite={Boolean(profile?.permission)} />
                ) : (
                    <div
                        style={
                            siteConfig.feedCardVariant === "poster" || siteConfig.feedCardVariant === "default"
                                ? { columnGap: `${gapSize}px` }
                                : undefined
                        }
                        className={`${
                            siteConfig.feedCardVariant === "compact"
                                ? "max-w-4xl mx-auto rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/90 divide-y divide-neutral-100 dark:divide-white/[0.06] overflow-hidden shadow-2xs"
                                : siteConfig.feedCardVariant === "editorial"
                                ? "max-w-4xl mx-auto divide-y divide-neutral-200/80 dark:divide-white/10"
                                : siteConfig.feedCardVariant === "poster"
                                ? `${getColumnsClass(siteConfig.galleryColumns)} space-y-5`
                                : `${getColumnsClass(siteConfig.galleryColumns)} space-y-6`
                        } ani-show`}
                    >
                        {interleavedItems.map((item, idx) => {
                            const currentFirstPageKeys = interleavedItems.map(getItemKey);

                            if (item.type === "photo") {
                                const itemK = `feed:${item.data.id}`;
                                return (
                                    <AtelierPhotoCard
                                        key={item.data.id}
                                        feed={item.data}
                                        index={idx}
                                        tiltOffset={shuffleSeed}
                                        canManage={Boolean(profile?.permission)}
                                        draggable={canDragCards}
                                        isDragging={draggedStreamItem === itemK}
                                        isDragOver={dragOverStreamItem === itemK}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData("text/plain", itemK);
                                            setDraggedStreamItem(itemK);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            if (dragOverStreamItem !== itemK) setDragOverStreamItem(itemK);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            handleStreamDrop(itemK, currentFirstPageKeys);
                                        }}
                                        onDragEnd={() => {
                                            setDraggedStreamItem(null);
                                            setDragOverStreamItem(null);
                                        }}
                                        onToggleTop={handleToggleTop}
                                        onEditCover={openCoverModal}
                                    />
                                );
                            }

                            if (item.type === "note") {
                                const itemK = `note:${item.noteType}`;
                                return (
                                    <StickyNoteItem
                                        key={`note-${item.noteType}-${idx}`}
                                        type={item.noteType}
                                        siteConfig={siteConfig}
                                        canManage={Boolean(profile?.permission)}
                                        draggable={canDragCards}
                                        isDragging={draggedStreamItem === itemK}
                                        isDragOver={dragOverStreamItem === itemK}
                                        onMoveStep={(nt, dir) => moveNoteStep(nt, dir, currentFirstPageKeys)}
                                        onEditNote={(nt) => openNoteSettingsModal(nt)}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData("text/plain", itemK);
                                            setDraggedStreamItem(itemK);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            if (dragOverStreamItem !== itemK) setDragOverStreamItem(itemK);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            handleStreamDrop(itemK, currentFirstPageKeys);
                                        }}
                                        onDragEnd={() => {
                                            setDraggedStreamItem(null);
                                            setDragOverStreamItem(null);
                                        }}
                                    />
                                );
                            }

                            return (
                                <NextDeckFlipCard
                                    key="next-deck-card"
                                    totalCount={currentFeeds.size}
                                    siteConfig={siteConfig}
                                    canManage={Boolean(profile?.permission)}
                                    onEditDeck={() => openNoteSettingsModal("deck")}
                                />
                            );
                        })}
                    </div>
                )}

                {/* 加载更多 / 浏览更多相片 */}
                {currentFeeds.hasNext && (
                    <div className="flex justify-center items-center py-8 w-full">
                        <button
                            type="button"
                            onClick={() => {
                                const nextPage = Math.floor(currentFeedData.length / limit) + 1;
                                fetchFeeds(listState, nextPage, true);
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-w px-6 py-2.5 text-xs font-bold t-primary shadow-xs hover:border-theme hover:text-theme hover:scale-105 active:scale-95 transition-all dark:border-white/10 select-none"
                        >
                            <i className="ri-arrow-down-line text-theme text-sm" />
                            <span>浏览下一页画廊相片</span>
                        </button>
                    </div>
                )}
            </main>

            {/* 1. 快捷更换文章封面 Modal (前台就地直接置换，不跳后台) */}
            {editingCoverFeed && (
                <Modal
                    isOpen={!!editingCoverFeed}
                    onRequestClose={() => !isUploadingFeedCover && setEditingCoverFeed(null)}
                    contentLabel="快捷更换文章封面"
                    panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-md w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
                >
                    <div className="flex flex-col gap-4 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                            <div>
                                <h3 className="text-sm font-bold t-primary">快捷更换文章封面</h3>
                                <p className="text-[11px] text-neutral-400 truncate max-w-xs mt-0.5">
                                    #{editingCoverFeed.id} {editingCoverFeed.title || "无标题文章"}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingCoverFeed(null)}
                                disabled={isUploadingFeedCover}
                                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                            >
                                <i className="ri-close-line text-lg" />
                            </button>
                        </div>

                        {/* 封面实时预览区 */}
                        <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02]">
                            {feedCoverUrl.trim() ? (
                                <div className="relative h-36 w-full rounded-lg overflow-hidden group/img">
                                    <img
                                        src={feedCoverUrl}
                                        alt="cover preview"
                                        className="h-full w-full object-cover rounded-lg shadow-inner"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">封面实时预览</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 flex flex-col items-center justify-center text-neutral-400">
                                    <i className="ri-image-line text-3xl mb-1 opacity-40" />
                                    <span>暂无封面，请输入网络链接或选择媒体图片</span>
                                </div>
                            )}
                        </div>

                        {/* 图片链接输入与来源选择 */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                                封面图片地址 (URL)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={feedCoverUrl}
                                    onChange={(e) => setFeedCoverUrl(e.target.value)}
                                    placeholder="https://example.com/cover.jpg"
                                    className="flex-1 rounded-xl border border-black/10 bg-transparent px-3 py-1.5 text-xs outline-none focus:border-theme dark:border-white/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsR2CoverPickerOpen(true)}
                                    disabled={isUploadingFeedCover}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold shrink-0 transition"
                                    title="从 Cloudflare R2 存储桶中点选已有相册图片"
                                >
                                    <i className="ri-folder-image-line" />
                                    <span>R2 相册</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => coverFileInputRef.current?.click()}
                                    disabled={isUploadingFeedCover}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 text-xs font-semibold shrink-0 transition"
                                >
                                    {isUploadingFeedCover ? (
                                        <i className="ri-loader-4-line animate-spin text-sm" />
                                    ) : (
                                        <i className="ri-upload-cloud-line text-sm" />
                                    )}
                                </button>
                                <input
                                    ref={coverFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCoverFileSelected}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                            <button
                                type="button"
                                onClick={() => setEditingCoverFeed(null)}
                                disabled={isUploadingFeedCover}
                                className="px-3.5 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveFeedCover}
                                disabled={isUploadingFeedCover || !feedCoverUrl.trim()}
                                className="px-5 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
                            >
                                更新封面
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* 2. 便签专属排版与内容前台就地设置 Modal (图6) */}
            {editingNoteType && (
                <Modal
                    isOpen={!!editingNoteType}
                    onRequestClose={() => !isSavingNote && setEditingNoteType(null)}
                    contentLabel={`便签设置 · ${noteTitle}`}
                    panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-lg w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
                >
                    <div className="flex flex-col gap-4 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shadow-2xs">
                                    <i className="ri-equalizer-line" />
                                </span>
                                <div>
                                    <h3 className="text-sm font-bold t-primary">便签专属排版与内容设置 · {noteTitle}</h3>
                                    <p className="text-[11px] text-neutral-400">在前台就地修改便签的文案、形态、背景与跳转链接</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingNoteType(null)}
                                disabled={isSavingNote}
                                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                            >
                                <i className="ri-close-line text-lg" />
                            </button>
                        </div>

                        {/* 首页展示开关 */}
                        <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
                            <div>
                                <span className="font-bold text-xs t-primary block">在画廊首页展示此便签</span>
                                <span className="text-[11px] text-neutral-400">开启后此便签将在首页首屏相纸流中呈现</span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={noteShow}
                                onClick={() => setNoteShow(!noteShow)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                                    noteShow ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                                }`}
                            >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                                    noteShow ? "translate-x-6" : "translate-x-1"
                                }`} />
                            </button>
                        </div>

                        {/* 视觉形态选择 (除 deck 外均可三段切换) */}
                        {editingNoteType !== "deck" && (
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                                    便签视觉形态
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: "card", label: "经典长条", icon: "ri-postcard-line", desc: "拍立得长纸质感" },
                                        { id: "circle", label: "精致小圆盘", icon: "ri-record-circle-line", desc: "立体微光徽章" },
                                        { id: "capsule", label: "极简小胶囊", icon: "ri-capsule-line", desc: "单行圆角药丸" },
                                    ].map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setNoteStyle(v.id)}
                                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition select-none ${
                                                noteStyle === v.id
                                                    ? "border-theme bg-theme/10 ring-1 ring-theme/30 text-theme font-bold shadow-2xs"
                                                    : "border-black/10 dark:border-white/10 bg-black/[0.01] hover:bg-black/5 text-neutral-600 dark:text-neutral-400"
                                            }`}
                                        >
                                            <i className={`${v.icon} text-base mb-0.5`} />
                                            <span className="text-xs">{v.label}</span>
                                            <span className="text-[9px] text-neutral-400 scale-90">{v.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 描述文案 */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                                情绪寄语 / 描述文案
                            </label>
                            <textarea
                                rows={2}
                                value={noteDesc}
                                onChange={(e) => setNoteDesc(e.target.value)}
                                placeholder="写下这篇便签的随想或引导语..."
                                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] px-3 py-2 text-xs t-primary outline-hidden focus:border-theme resize-none"
                            />
                        </div>

                        {/* 背景图片 */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                                专属背景图片 (支持R2相册/本地上传/URL)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={noteBg}
                                    onChange={(e) => setNoteBg(e.target.value)}
                                    placeholder="https://... 或留空使用默认清新纸张"
                                    className="flex-1 rounded-xl border border-black/10 bg-transparent px-3 py-1.5 text-xs outline-none focus:border-theme dark:border-white/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsR2NoteBgPickerOpen(true)}
                                    disabled={isUploadingNoteBg}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold shrink-0 transition"
                                    title="从 Cloudflare R2 存储桶中选取背景图片"
                                >
                                    <i className="ri-folder-image-line" />
                                    <span>R2 相册</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => noteBgFileInputRef.current?.click()}
                                    disabled={isUploadingNoteBg}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 text-xs font-semibold shrink-0 transition"
                                >
                                    {isUploadingNoteBg ? (
                                        <i className="ri-loader-4-line animate-spin text-sm" />
                                    ) : (
                                        <i className="ri-upload-cloud-line text-sm" />
                                    )}
                                </button>
                                <input
                                    ref={noteBgFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleNoteBgFileSelected}
                                    className="hidden"
                                />
                            </div>
                            {noteBg.trim() && (
                                <div className="relative h-20 w-full rounded-xl overflow-hidden border border-black/10 dark:border-white/10 mt-1">
                                    <img src={noteBg} alt="background preview" className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setNoteBg("")}
                                        className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] hover:bg-black/80 transition"
                                    >
                                        清空背景
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 封面图文字显隐策略（遵循《美化章程》第三章：避免文字常驻遮挡封面图） */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                                封面图文字显示方式（设置背景图时生效）
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "hover" as const, label: "悬停浮现", desc: "默认纯图无遮挡" },
                                    { id: "hidden" as const, label: "纯图无字", desc: "始终仅展封面" },
                                    { id: "always" as const, label: "常驻显示", desc: "底部始终显示文字" },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setNoteTextMode(opt.id)}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition select-none cursor-pointer ${
                                            noteTextMode === opt.id
                                                ? "border-theme bg-theme/10 text-theme font-bold"
                                                : "border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-theme/40"
                                        }`}
                                    >
                                        <span className="text-xs">{opt.label}</span>
                                        <span className="text-[10px] opacity-75">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 跳转目标链接 */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                                点击跳转目标链接 (URL)
                            </label>
                            <input
                                type="text"
                                value={noteUrl}
                                onChange={(e) => setNoteUrl(e.target.value)}
                                placeholder="/about 或 https://..."
                                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] px-3 py-1.5 text-xs t-primary outline-hidden focus:border-theme font-mono"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                            <button
                                type="button"
                                onClick={() => setEditingNoteType(null)}
                                disabled={isSavingNote}
                                className="px-3.5 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNoteSettings}
                                disabled={isSavingNote}
                                className="px-5 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
                            >
                                {isSavingNote ? "保存中..." : "保存并在前台生效"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* 3. 首页推荐标签高密超级表格管理 Modal (图4) */}
            {isTagSettingsOpen && (
                <Modal
                    isOpen={isTagSettingsOpen}
                    onRequestClose={() => setIsTagSettingsOpen(false)}
                    contentLabel="首页推荐标签管理 (Dense DataGrid)"
                    panelClassName="p-3 sm:p-6 max-w-[96vw] sm:max-w-2xl w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="flex flex-col gap-2.5 sm:gap-3.5 flex-1 min-h-0 overflow-hidden">
                        <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5 shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm sm:text-base shadow-2xs shrink-0">
                                    <i className="ri-price-tag-3-line" />
                                </span>
                                <div className="min-w-0">
                                    <h3 className="text-xs sm:text-sm font-bold t-primary truncate">画廊首页推荐标签管理 (Dense DataGrid)</h3>
                                    <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate hidden sm:block">支持输入数字直接跳位排序、展示上限与色彩方案联动</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsTagSettingsOpen(false)}
                                className="h-7 w-7 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 transition flex items-center justify-center cursor-pointer shrink-0"
                            >
                                <i className="ri-close-line text-lg font-bold" />
                            </button>
                        </div>

                        {/* 顶部预设与色彩方案联动控制区 */}
                        <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col gap-3">
                            {/* 1. 首页展示数量预设 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <span className="font-bold text-xs t-primary">首页展示数量上限</span>
                                    <span className="text-[11px] text-neutral-400 block sm:inline sm:ml-2">
                                        控制画廊首页前台最多推荐呈现的标签个数 (当前可用总数: {orderedTagObjects.length} 个)
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {[
                                        { label: "4 个", val: 4 },
                                        { label: "6 个", val: 6 },
                                        { label: "8 个 (默认)", val: 8 },
                                        { label: "12 个", val: 12 },
                                        { label: "全部", val: "all" as const },
                                    ].map((opt) => {
                                        const isSel = homepageTagsConfig.limit === opt.val;
                                        return (
                                            <button
                                                key={String(opt.val)}
                                                type="button"
                                                onClick={() => handleSelectTagLimit(opt.val)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition select-none cursor-pointer ${
                                                    isSel
                                                        ? "bg-theme text-white shadow-2xs font-bold"
                                                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-black/10"
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2. 色彩方案联动 (参考全局主题与色彩体系) */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                                <div>
                                    <span className="font-bold text-xs t-primary">色彩方案预设</span>
                                    <span className="text-[11px] text-neutral-400 block sm:inline sm:ml-2">前台标签卡片飘逸色彩搭配风格</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {[
                                        { id: "pastel" as const, label: "和风五彩" },
                                        { id: "macaron" as const, label: "柔和马卡龙" },
                                        { id: "cyber" as const, label: "赛博霓虹" },
                                        { id: "theme" as const, label: "画廊粉白" },
                                        { id: "mono" as const, label: "极简冷萃" },
                                    ].map((p) => {
                                        const isSel = (homepageTagsConfig.palette || "pastel") === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => updateTagsConfig({ palette: p.id })}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition select-none flex items-center gap-1 ${
                                                    isSel
                                                        ? "bg-theme text-white shadow-2xs font-bold"
                                                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-black/10"
                                                }`}
                                            >
                                                <span>{p.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 3. 标签展示状态与全选/反选快捷控制栏 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                                <span className="font-bold t-primary">标签展示状态：</span>
                                <span className="px-2.5 py-0.5 rounded-full bg-theme/10 text-theme font-mono font-bold text-xs">
                                    已开启 {orderedTagObjects.filter((t) => !homepageTagsConfig.hiddenIds.includes(t.id)).length} / {orderedTagObjects.length} 个
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
                                <button
                                    type="button"
                                    onClick={handleSelectAllTags}
                                    className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:border-theme hover:text-theme text-xs font-semibold t-primary transition shadow-2xs active:scale-95 cursor-pointer"
                                    title="开启所有标签的首页展示"
                                >
                                    全选 (全部启用)
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInvertTagsVisibility}
                                    className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:border-theme hover:text-theme text-xs font-semibold t-primary transition shadow-2xs active:scale-95 cursor-pointer"
                                    title="反转所有标签的展示开关"
                                >
                                    反选
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDisableAllTags}
                                    className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 text-xs text-neutral-400 hover:text-rose-500 transition shadow-2xs active:scale-95 cursor-pointer"
                                    title="关闭全部标签展示"
                                >
                                    全关
                                </button>
                            </div>
                        </div>

                        {/* 高密超级表格 (自适应纵向撑满，移动端 8~10 行尽览无阻) */}
                        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 bg-w flex-1 min-h-[220px] overflow-y-auto scrollbar-thin">
                            <table className="w-full text-left text-xs border-collapse min-w-full sm:min-w-[480px]">
                                <thead>
                                    <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-500 dark:text-neutral-400 font-mono text-[11px] sm:text-xs sticky top-0 bg-white dark:bg-neutral-900 z-10">
                                        <th className="py-2 px-1 sm:px-3 w-12 sm:w-24 text-center">序号</th>
                                        <th className="py-2 px-2 sm:px-3">标签预览与别名</th>
                                        <th className="py-2 px-1 sm:px-3 w-14 sm:w-24 text-center">首页展示</th>
                                        <th className="py-2 px-1 sm:px-3 w-14 sm:w-20 text-right pr-2 sm:pr-4">微调</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {orderedTagObjects.map((t, idx) => {
                                        const isHidden = homepageTagsConfig.hiddenIds.includes(t.id);
                                        const isDraggingRow = draggedTagId === t.id;
                                        const isDragOverRow = dragOverTagId === t.id;
                                        const currentAlias = homepageTagsConfig.aliases?.[t.id] || "";

                                        return (
                                            <tr
                                                key={t.id}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    if (dragOverTagId !== t.id) setDragOverTagId(t.id);
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    handleTagRowDrop(t.id, tagOrderList);
                                                }}
                                                className={`hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-all select-none ${
                                                    isDraggingRow ? "opacity-30 bg-theme/10" : ""
                                                } ${isDragOverRow ? "border-t-2 border-theme bg-theme/5" : ""}`}
                                            >
                                                {/* 序号与拖动手柄 (支持输入数字直接跳位调序，被替换项自动顺延) */}
                                                <td className="py-2 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span
                                                            draggable
                                                            onDragStart={(e) => {
                                                                e.dataTransfer.setData("text/plain", String(t.id));
                                                                setDraggedTagId(t.id);
                                                            }}
                                                            onDragEnd={() => {
                                                                setDraggedTagId(null);
                                                                setDragOverTagId(null);
                                                            }}
                                                            className="text-neutral-400 hover:text-theme cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 select-none shrink-0 hidden sm:inline-flex"
                                                            title="按住手柄自由拖放调整排序"
                                                        >
                                                            <i className="ri-drag-move-2-line text-sm" />
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={orderedTagObjects.length}
                                                            defaultValue={idx + 1}
                                                            key={`${t.id}_${idx + 1}`}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    handleMoveTagToIndex(idx, e.currentTarget.value);
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                handleMoveTagToIndex(idx, e.currentTarget.value);
                                                            }}
                                                            className="w-12 text-center rounded-lg bg-black/5 dark:bg-white/5 border border-transparent hover:border-theme/40 focus:border-theme focus:bg-w text-xs font-mono font-bold outline-none transition py-0.5"
                                                            title="输入目标序号敲回车，当前项直接调整至该位置，原位置项目自动下移"
                                                        />
                                                    </div>
                                                </td>

                                                {/* 标签预览与就地别名修改 (移动端点击直接编辑，防止输入框阻断滑动) */}
                                                <td className="py-2 px-3">
                                                    {editingTagAliasId === t.id ? (
                                                        <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={editingTagAliasText}
                                                                onChange={(e) => setEditingTagAliasText(e.target.value)}
                                                                placeholder={t.name}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        const newAliases = { ...homepageTagsConfig.aliases, [t.id]: editingTagAliasText.trim() };
                                                                        if (!editingTagAliasText.trim()) delete newAliases[t.id];
                                                                        updateTagsConfig({ aliases: newAliases });
                                                                        setEditingTagAliasId(null);
                                                                    } else if (e.key === "Escape") {
                                                                        setEditingTagAliasId(null);
                                                                    }
                                                                }}
                                                                className="w-32 sm:w-44 px-2 py-1 rounded-lg border border-theme text-xs bg-w outline-none font-semibold focus:ring-1 focus:ring-theme"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newAliases = { ...homepageTagsConfig.aliases, [t.id]: editingTagAliasText.trim() };
                                                                    if (!editingTagAliasText.trim()) delete newAliases[t.id];
                                                                    updateTagsConfig({ aliases: newAliases });
                                                                    setEditingTagAliasId(null);
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 transition"
                                                            >
                                                                确定
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingTagAliasId(null)}
                                                                className="px-2 py-1 rounded-lg text-neutral-400 hover:text-neutral-600 text-xs"
                                                            >
                                                                取消
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 group/tag">
                                                            <span
                                                                onClick={() => {
                                                                    setEditingTagAliasId(t.id);
                                                                    setEditingTagAliasText(currentAlias || t.name);
                                                                }}
                                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-xs border cursor-pointer hover:opacity-80 transition select-none ${getTagColorClass(idx)}`}
                                                                title="点击就地修改展示别名"
                                                            >
                                                                <span>🏷️</span>
                                                                <span>#{currentAlias || t.name}</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingTagAliasId(t.id);
                                                                    setEditingTagAliasText(currentAlias || t.name);
                                                                }}
                                                                className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 opacity-70 sm:opacity-0 sm:group-hover/tag:opacity-100 transition"
                                                                title="修改前台展示别名"
                                                            >
                                                                <i className="ri-edit-2-line text-xs" />
                                                            </button>
                                                            {currentAlias && (
                                                                <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">(原: #{t.name})</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 首页展示开关 (滑动开关) */}
                                                <td className="py-2 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={!isHidden}
                                                        onClick={() => handleToggleTagVisibility(t.id)}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                                                            !isHidden ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                                                        }`}
                                                        title={!isHidden ? "已开启首页展示" : "已隐藏"}
                                                    >
                                                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                                                            !isHidden ? "translate-x-4.5" : "translate-x-1"
                                                        }`} />
                                                    </button>
                                                </td>

                                                {/* 微调按钮组 */}
                                                <td className="py-2 px-3 text-right pr-4">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveTagStep(t.id, "up", tagOrderList)}
                                                            disabled={idx === 0}
                                                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition"
                                                            title="向前微调一位"
                                                        >
                                                            <i className="ri-arrow-up-s-line text-sm" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveTagStep(t.id, "down", tagOrderList)}
                                                            disabled={idx === orderedTagObjects.length - 1}
                                                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition"
                                                            title="向后微调一位"
                                                        >
                                                            <i className="ri-arrow-down-s-line text-sm" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                            <button
                                type="button"
                                onClick={handleResetTagsConfig}
                                className="text-xs text-neutral-400 hover:text-theme transition"
                            >
                                恢复系统默认排序
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsTagSettingsOpen(false)}
                                className="px-5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover transition"
                            >
                                完成
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* R2 媒体库选择器 (用于文章封面与便签背景) */}
            <R2MediaPickerModal
                isOpen={isR2CoverPickerOpen}
                onClose={() => setIsR2CoverPickerOpen(false)}
                onSelect={(url) => setFeedCoverUrl(url)}
                title="选择文章封面图片"
            />
            <R2MediaPickerModal
                isOpen={isR2NoteBgPickerOpen}
                onClose={() => setIsR2NoteBgPickerOpen(false)}
                onSelect={(url) => setNoteBg(url)}
                title="选择便签背景图片"
            />
            <AlertUI />
        </>
    );
}
