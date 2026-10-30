import { useContext, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation, useSearch } from "wouter";
import { client } from "../app/runtime";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { useTranslation } from "react-i18next";

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

// Random organic tilt angles for the scattered atelier cards
const TILT_ANGLES = [
    "-rotate-1.5",
    "rotate-1",
    "-rotate-2",
    "rotate-2",
    "-rotate-0.5",
    "rotate-1.5",
    "-rotate-2.5",
    "rotate-0.5",
];

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
}: {
    feed: any;
    index: number;
    tiltOffset?: number;
    canManage?: boolean;
}) {
    const { t } = useTranslation();
    const [imageError, setImageError] = useState(false);
    const tilt = TILT_ANGLES[(index + tiltOffset) % TILT_ANGLES.length];
    const tapeColor = TAPE_COLORS[(index + tiltOffset) % TAPE_COLORS.length];
    const readingTime = feed.readingTime || Math.max(1, Math.ceil((feed.summary?.length || 100) / 100));

    const hasImage = Boolean(feed.avatar) && !imageError;

    return (
        <Link
            href={`/feed/${feed.id}`}
            className={`group relative break-inside-avoid block w-full rounded-[26px] border border-black/10 bg-white p-3 pb-3.5 shadow-md hover:shadow-2xl transition-all duration-400 transform ${tilt} hover:rotate-0 hover:scale-[1.03] hover:z-30 dark:border-white/10 dark:bg-neutral-900`}
        >
            {/* Washi tape pin on top */}
            <div
                className={`absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-4 ${tapeColor} rounded-xs shadow-2xs rotate-[-2deg] pointer-events-none z-10 opacity-90`}
            />

            {/* Quick Admin Edit Button on top-right (Screenshot 4) */}
            {canManage && (
                <Link
                    href={`/admin/writing/${feed.id}`}
                    onClick={(e) => e.stopPropagation()}
                    title="编辑文章与更换封面"
                    className="absolute right-4 top-4 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 dark:bg-neutral-800/95 text-neutral-600 dark:text-neutral-200 shadow-md backdrop-blur-xs transition hover:scale-110 hover:text-theme"
                >
                    <i className="ri-edit-line text-xs" />
                </Link>
            )}

            {/* Poster area: high-res, crisp, large image */}
            <div className="relative w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 shadow-inner">
                {hasImage ? (
                    <img
                        src={feed.avatar}
                        alt=""
                        loading="lazy"
                        onError={() => setImageError(true)}
                        className="w-full h-auto max-h-[580px] object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 min-h-60 bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-950 text-center">
                        <span className="text-3xl mb-3 opacity-60">✍️</span>
                        <h2 className="text-xl font-bold t-primary line-clamp-3 leading-snug">
                            {feed.title}
                        </h2>
                    </div>
                )}

                {/* Subtle hover overlay badge */}
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

            {/* Subtle bottom accent line */}
            <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                <span>{new Date(feed.createdAt).toLocaleDateString()}</span>
                {feed.top === 1 && (
                    <span className="text-theme font-semibold flex items-center gap-0.5">
                        <i className="ri-pushpin-line" />
                        <span>{t("article.top.title")}</span>
                    </span>
                )}
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
}: {
    type: "about" | "timeline" | "moments" | "friends" | "search";
    siteConfig: any;
    canManage?: boolean;
}) {
    const [, setLocation] = useLocation();
    const [searchKeyword, setSearchKeyword] = useState("");

    if (type === "about") {
        const aboutUrl = siteConfig.atelierAboutUrl || "/about";
        const bgImage = siteConfig.atelierAboutBg;
        return (
            <div
                onClick={() => setLocation(aboutUrl)}
                style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
                className={`group relative break-inside-avoid block w-full rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 transform rotate-1 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none overflow-hidden ${
                    bgImage
                        ? "bg-cover bg-center border border-black/10 dark:border-white/10"
                        : "bg-amber-100 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40"
                }`}
            >
                {bgImage && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 backdrop-blur-[0.5px]" />}
                <div className="absolute -top-2 left-6 w-8 h-3.5 bg-amber-200/80 dark:bg-amber-800/50 rounded-xs rotate-[-5deg] z-20" />

                {canManage && (
                    <Link
                        href="/admin/settings?tab=atelier&focus=about"
                        onClick={(e) => e.stopPropagation()}
                        title="在设置中修改此便签背景、图标或文字"
                        className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-sm transition hover:scale-110 hover:text-theme"
                    >
                        <i className="ri-settings-3-line text-xs" />
                    </Link>
                )}

                <div className={`relative z-10 ${bgImage ? "text-white" : ""}`}>
                    <span className="text-2xl mb-1 block">{siteConfig.atelierAboutIcon || "🐾"}</span>
                    <p className={`font-bold text-base ${bgImage ? "text-white" : "text-amber-900 dark:text-amber-200"}`}>
                        {siteConfig.name || "80hou's Home"}
                    </p>
                    <p className={`text-xs mt-1 leading-relaxed ${bgImage ? "text-neutral-200" : "text-amber-700/80 dark:text-amber-300/70"}`}>
                        {siteConfig.atelierAboutDesc || "欢迎光临我的记忆工坊与随笔空间，点击了解更多。"}
                    </p>
                    <div className={`mt-3 flex items-center gap-1 text-xs font-semibold group-hover:underline ${bgImage ? "text-amber-300" : "text-amber-800 dark:text-amber-300"}`}>
                        <span>关于我 &rarr;</span>
                    </div>
                </div>
            </div>
        );
    }

    if (type === "timeline") {
        const targetUrl = siteConfig.atelierTimelineUrl || "/timeline";
        const bgImage = siteConfig.atelierTimelineBg;
        return (
            <div
                onClick={() => setLocation(targetUrl)}
                style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
                className={`group relative break-inside-avoid block w-full rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 transform -rotate-2 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none overflow-hidden ${
                    bgImage
                        ? "bg-cover bg-center border border-black/10 dark:border-white/10"
                        : "bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/40"
                }`}
            >
                {bgImage && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 backdrop-blur-[0.5px]" />}
                <div className="absolute -top-2.5 right-6 w-10 h-3.5 bg-orange-200/70 dark:bg-orange-800/50 rounded-xs rotate-[3deg] z-20" />

                {canManage && (
                    <Link
                        href="/admin/settings?tab=atelier&focus=timeline"
                        onClick={(e) => e.stopPropagation()}
                        title="在设置中修改此便签背景、图标或文字"
                        className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-sm transition hover:scale-110 hover:text-theme"
                    >
                        <i className="ri-settings-3-line text-xs" />
                    </Link>
                )}

                <div className={`relative z-10 ${bgImage ? "text-white" : ""}`}>
                    <span className="text-2xl mb-1 block">{siteConfig.atelierTimelineIcon || "⏳"}</span>
                    <p className={`font-bold text-base ${bgImage ? "text-white" : "text-orange-900 dark:text-orange-200"}`}>岁月轨迹</p>
                    <p className={`text-xs mt-1 leading-relaxed ${bgImage ? "text-neutral-200" : "text-orange-700/80 dark:text-orange-300/70"}`}>
                        {siteConfig.atelierTimelineDesc || "以时间为轴，串联起每一次灵感与技术实践。"}
                    </p>
                    <div className={`mt-3 flex items-center gap-1 text-xs font-semibold group-hover:underline ${bgImage ? "text-orange-300" : "text-orange-800 dark:text-orange-300"}`}>
                        <span>时光长河足迹 &rarr;</span>
                    </div>
                </div>
            </div>
        );
    }

    if (type === "moments") {
        const targetUrl = siteConfig.atelierMomentsUrl || "/moments";
        const bgImage = siteConfig.atelierMomentsBg;
        return (
            <div
                onClick={() => setLocation(targetUrl)}
                style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
                className={`group relative break-inside-avoid block w-full rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 transform rotate-2 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none overflow-hidden ${
                    bgImage
                        ? "bg-cover bg-center border border-black/10 dark:border-white/10"
                        : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40"
                }`}
            >
                {bgImage && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 backdrop-blur-[0.5px]" />}
                <div className="absolute -top-2 left-8 w-10 h-3.5 bg-emerald-200/70 dark:bg-emerald-800/50 rounded-xs rotate-[-3deg] z-20" />

                {canManage && (
                    <Link
                        href="/admin/settings?tab=atelier&focus=moments"
                        onClick={(e) => e.stopPropagation()}
                        title="在设置中修改此便签背景、图标或文字"
                        className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-sm transition hover:scale-110 hover:text-theme"
                    >
                        <i className="ri-settings-3-line text-xs" />
                    </Link>
                )}

                <div className={`relative z-10 ${bgImage ? "text-white" : ""}`}>
                    <span className="text-2xl mb-1 block">{siteConfig.atelierMomentsIcon || "💭"}</span>
                    <p className={`font-bold text-base ${bgImage ? "text-white" : "text-emerald-900 dark:text-emerald-200"}`}>日常随想</p>
                    <p className={`text-xs mt-1 leading-relaxed ${bgImage ? "text-neutral-200" : "text-emerald-700/80 dark:text-emerald-300/70"}`}>
                        {siteConfig.atelierMomentsDesc || "生活碎碎念、朋友圈动态与不设限的日常记录。"}
                    </p>
                    <div className={`mt-3 flex items-center gap-1 text-xs font-semibold group-hover:underline ${bgImage ? "text-emerald-300" : "text-emerald-800 dark:text-emerald-300"}`}>
                        <span>朋友圈随笔 &rarr;</span>
                    </div>
                </div>
            </div>
        );
    }

    if (type === "friends") {
        const targetUrl = siteConfig.atelierFriendsUrl || "/friends";
        const bgImage = siteConfig.atelierFriendsBg;
        return (
            <div
                onClick={() => setLocation(targetUrl)}
                style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
                className={`group relative break-inside-avoid block w-full rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 transform -rotate-1 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none overflow-hidden ${
                    bgImage
                        ? "bg-cover bg-center border border-black/10 dark:border-white/10"
                        : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/40"
                }`}
            >
                {bgImage && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 backdrop-blur-[0.5px]" />}
                <div className="absolute -top-2 right-8 w-10 h-3.5 bg-rose-200/70 dark:bg-rose-800/50 rounded-xs rotate-[4deg] z-20" />

                {canManage && (
                    <Link
                        href="/admin/settings?tab=atelier&focus=friends"
                        onClick={(e) => e.stopPropagation()}
                        title="在设置中修改此便签背景、图标或文字"
                        className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-sm transition hover:scale-110 hover:text-theme"
                    >
                        <i className="ri-settings-3-line text-xs" />
                    </Link>
                )}

                <div className={`relative z-10 ${bgImage ? "text-white" : ""}`}>
                    <span className="text-2xl mb-1 block">{siteConfig.atelierFriendsIcon || "🌸"}</span>
                    <p className={`font-bold text-base ${bgImage ? "text-white" : "text-rose-900 dark:text-rose-200"}`}>邻家友链</p>
                    <p className={`text-xs mt-1 leading-relaxed ${bgImage ? "text-neutral-200" : "text-rose-700/80 dark:text-rose-300/70"}`}>
                        {siteConfig.atelierFriendsDesc || "漫步在同好博主的数字花园，交换思想火花。"}
                    </p>
                    <div className={`mt-3 flex items-center gap-1 text-xs font-semibold group-hover:underline ${bgImage ? "text-rose-300" : "text-rose-800 dark:text-rose-300"}`}>
                        <span>拜访朋友们 &rarr;</span>
                    </div>
                </div>
            </div>
        );
    }

    // Direct Search Sticky Note
    const bgImage = siteConfig.atelierSearchBg;
    return (
        <div
            style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
            className={`group relative break-inside-avoid block w-full rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 transform rotate-1.5 hover:rotate-0 hover:scale-[1.03] select-none overflow-hidden ${
                bgImage
                    ? "bg-cover bg-center border border-black/10 dark:border-white/10"
                    : "bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/40"
            }`}
        >
            {bgImage && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 backdrop-blur-[0.5px]" />}
            <div className="absolute -top-2.5 left-10 w-10 h-3.5 bg-sky-200/70 dark:bg-sky-800/50 rounded-xs rotate-[-4deg] z-20" />

            {canManage && (
                <Link
                    href="/admin/settings?tab=atelier&focus=search"
                    onClick={(e) => e.stopPropagation()}
                    title="在设置中修改此便签背景、图标或文字"
                    className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-sm transition hover:scale-110 hover:text-theme"
                >
                    <i className="ri-settings-3-line text-xs" />
                </Link>
            )}

            <div className={`relative z-10 ${bgImage ? "text-white" : ""}`}>
                <span className="text-2xl mb-1 block">{siteConfig.atelierSearchIcon || "🔍"}</span>
                <p className={`font-bold text-base ${bgImage ? "text-white" : "text-sky-900 dark:text-sky-200"}`}>随心探索</p>
                <p className={`text-xs mt-1 leading-relaxed ${bgImage ? "text-neutral-200" : "text-sky-700/80 dark:text-sky-300/70"}`}>
                    输入关键词即刻检索文章与解决方案。
                </p>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (searchKeyword.trim()) {
                            setLocation(`/search/${encodeURIComponent(searchKeyword.trim())}`);
                        }
                    }}
                    className="mt-3 flex items-center gap-1.5"
                >
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="输入关键词按回车..."
                        className="w-full rounded-xl border border-sky-300/70 bg-white/90 px-3 py-1.5 text-xs text-sky-950 placeholder-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-700 dark:bg-neutral-900 dark:text-sky-100"
                    />
                    <button
                        type="submit"
                        className="shrink-0 rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-600 transition"
                    >
                        搜索
                    </button>
                </form>
            </div>
        </div>
    );
}

/**
 * 🃏 Interactive Flip / Gallery Deck Card
 */
function NextDeckFlipCard({
    totalCount,
    siteConfig,
    canManage = false,
}: {
    totalCount: number;
    siteConfig: any;
    canManage?: boolean;
}) {
    const bgImage = siteConfig?.atelierDeckBg;
    const deckUrl = siteConfig?.atelierDeckUrl || "/gallery";
    const deckDesc = siteConfig?.atelierDeckDesc || `共 ${totalCount} 张记忆相片已收录`;
    return (
        <div
            style={bgImage ? { backgroundImage: `url(${bgImage})` } : undefined}
            className={`group relative break-inside-avoid block w-full rounded-3xl p-6 text-center select-none shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.03] hover:rotate-0 rotate-1 overflow-hidden border border-black/10 dark:border-white/10 ${
                bgImage ? "bg-cover bg-center" : "bg-theme/5 border-2 border-dashed border-theme/40"
            }`}
        >
            {bgImage && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 backdrop-blur-[0.5px]" />}

            {canManage && (
                <Link
                    href="/admin/settings?tab=atelier&focus=deck"
                    onClick={(e) => e.stopPropagation()}
                    title="在设置中修改此卡片背景、图标或文字"
                    className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-200 shadow-sm transition hover:scale-110 hover:text-theme"
                >
                    <i className="ri-settings-3-line text-xs" />
                </Link>
            )}

            <div className={`relative z-10 ${bgImage ? "text-white" : ""}`}>
                <span className="text-4xl block mb-2">🃏</span>
                <p className={`font-extrabold text-base ${bgImage ? "text-white" : "t-primary"}`}>记忆翻动</p>
                <p className={`text-xs mt-1 ${bgImage ? "text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}`}>
                    {deckDesc}
                </p>
                <div className="mt-4">
                    <Link
                        href={deckUrl}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-theme px-4 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-95"
                    >
                        <i className="ri-folder-image-line text-base" />
                        <span>漫游图床画廊 (仅浏览)</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export function FeedsPage() {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);

    const [listState, _setListState] = useState<FeedType>((query.get("type") as FeedType) || "normal");
    const [status, setStatus] = useState<"loading" | "idle">("loading");
    const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false },
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

    useEffect(() => {
        const type = (query.get("type") as FeedType) || "normal";
        if (type !== listState) {
            _setListState(type);
        }
        fetchFeeds(type, 1, false);
    }, [query.get("type")]);

    const interleavedItems = useMemo(() => {
        const items: Array<{ type: "photo" | "note" | "deck"; data?: any; noteType?: any }> = [];
        const noteTypes: Array<"about" | "timeline" | "moments" | "friends" | "search"> = [
            "about",
            "timeline",
            "moments",
            "friends",
            "search",
        ];

        let noteIndex = 0;
        currentFeedData.forEach((feed, i) => {
            items.push({ type: "photo", data: feed });
            if (listState === "normal" && (i === 1 || i === 4 || i === 7 || i === 11 || i === 15)) {
                if (noteIndex < noteTypes.length) {
                    items.push({ type: "note", noteType: noteTypes[noteIndex] });
                    noteIndex++;
                }
            }
        });

        items.push({ type: "deck" });

        return items;
    }, [currentFeedData, listState]);

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
                            <span>{listState === "draft" ? t("draft_bin") : listState === "unlisted" ? t("unlisted") : siteConfig.atelierTitle || "画廊随想"}</span>
                            <span className="text-base font-normal text-neutral-400 dark:text-neutral-500 font-mono">
                                ({currentFeeds.size})
                            </span>
                        </h1>
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
                {tags.length > 0 && listState === "normal" && (
                    <div className="flex flex-wrap items-center justify-center gap-3 my-4 px-2 select-none ani-show">
                        {tags.slice(0, 8).map((tag, i) => {
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
                            const bg = [
                                "bg-amber-100/90 text-amber-900 border-amber-300/60 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/40",
                                "bg-sky-100/90 text-sky-900 border-sky-300/60 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/40",
                                "bg-rose-100/90 text-rose-900 border-rose-300/60 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/40",
                                "bg-emerald-100/90 text-emerald-900 border-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/40",
                                "bg-purple-100/90 text-purple-900 border-purple-300/60 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/40",
                            ][i % 5];
                            return (
                                <Link
                                    key={tag.id}
                                    href={`/hashtag/${encodeURIComponent(tag.name)}`}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-2xs text-xs font-semibold transform ${rot} hover:rotate-0 hover:scale-110 hover:shadow-md transition-all duration-300 ${bg}`}
                                >
                                    <span className="opacity-60 text-[10px]">🏷️</span>
                                    <span>#{tag.name}</span>
                                </Link>
                            );
                        })}
                    </div>
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
                        style={{ columnGap: `${gapSize}px` }}
                        className={`${getColumnsClass(siteConfig.galleryColumns)} space-y-6 ani-show`}
                    >
                        {interleavedItems.map((item, idx) => {
                            if (item.type === "photo") {
                                return (
                                    <AtelierPhotoCard
                                        key={item.data.id}
                                        feed={item.data}
                                        index={idx}
                                        tiltOffset={shuffleSeed}
                                        canManage={Boolean(profile?.permission)}
                                    />
                                );
                            }

                            if (item.type === "note") {
                                return (
                                    <StickyNoteItem
                                        key={`note-${item.noteType}-${idx}`}
                                        type={item.noteType}
                                        siteConfig={siteConfig}
                                        canManage={Boolean(profile?.permission)}
                                    />
                                );
                            }

                            return (
                                <NextDeckFlipCard
                                    key="next-deck-card"
                                    totalCount={currentFeeds.size}
                                    siteConfig={siteConfig}
                                    canManage={Boolean(profile?.permission)}
                                />
                            );
                        })}
                    </div>
                )}
            </main>
        </>
    );
}
