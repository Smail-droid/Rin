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
}: {
    feed: any;
    index: number;
    tiltOffset?: number;
}) {
    const { t } = useTranslation();
    const [imageError, setImageError] = useState(false);
    const tilt = TILT_ANGLES[(index + tiltOffset) % TILT_ANGLES.length];
    const tapeColor = TAPE_COLORS[(index + tiltOffset) % TAPE_COLORS.length];
    const readingTime = feed.readingTime || Math.max(1, Math.ceil((feed.summary?.length || 100) / 100));

    // Has cover image or generate artistic fallback
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
                    // Elegant artistic typography poster for posts without cover
                    <div className="flex flex-col items-center justify-center p-8 min-h-60 bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-950 text-center">
                        <span className="text-3xl mb-3 opacity-60">✍️</span>
                        <h2 className="text-xl font-bold t-primary line-clamp-3 leading-snug">
                            {feed.title}
                        </h2>
                    </div>
                )}

                {/* Subtle hover overlay badge: only appears on hover, keeping image 100% clean by default! */}
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
 * 📌 Scattered Atelier Artifacts (Navigation Notes, Stamps, Washi Tapes interspersed among photos)
 */
function StickyNoteItem({
    type,
}: {
    type: "about" | "timeline" | "moments" | "friends" | "search";
    index?: number;
}) {
    const [, setLocation] = useLocation();

    if (type === "about") {
        return (
            <div
                onClick={() => setLocation("/profile")}
                className="group relative break-inside-avoid block w-full rounded-2xl bg-amber-100 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 p-5 shadow-md hover:shadow-xl transition-all duration-300 transform rotate-1 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none"
            >
                <div className="absolute -top-2 left-6 w-8 h-3.5 bg-amber-200/80 dark:bg-amber-800/50 rounded-xs rotate-[-5deg]" />
                <span className="text-2xl mb-1 block">🐾</span>
                <p className="font-bold text-base text-amber-900 dark:text-amber-200">80hou's Home</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-1 leading-relaxed">
                    欢迎光临我的记忆工坊与随笔空间，点击了解更多。
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 group-hover:underline">
                    <span>关于我 &rarr;</span>
                </div>
            </div>
        );
    }

    if (type === "timeline") {
        return (
            <div
                onClick={() => setLocation("/timeline")}
                className="group relative break-inside-avoid block w-full rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/40 p-5 shadow-md hover:shadow-xl transition-all duration-300 transform -rotate-2 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none"
            >
                <div className="absolute -top-2.5 right-6 w-10 h-3.5 bg-orange-200/70 dark:bg-orange-800/50 rounded-xs rotate-[3deg]" />
                <span className="text-2xl mb-1 block">⏳</span>
                <p className="font-bold text-base text-orange-900 dark:text-orange-200">岁月轨迹</p>
                <p className="text-xs text-orange-700/80 dark:text-orange-300/70 mt-1 leading-relaxed">
                    以时间为轴，串联起每一次灵感与技术实践。
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-orange-800 dark:text-orange-300 group-hover:underline">
                    <span>时间轴足迹 &rarr;</span>
                </div>
            </div>
        );
    }

    if (type === "moments") {
        return (
            <div
                onClick={() => setLocation("/moments")}
                className="group relative break-inside-avoid block w-full rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40 p-5 shadow-md hover:shadow-xl transition-all duration-300 transform rotate-2 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none"
            >
                <div className="absolute -top-2 left-8 w-10 h-3.5 bg-emerald-200/70 dark:bg-emerald-800/50 rounded-xs rotate-[-3deg]" />
                <span className="text-2xl mb-1 block">💭</span>
                <p className="font-bold text-base text-emerald-900 dark:text-emerald-200">日常随想</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/70 mt-1 leading-relaxed">
                    生活碎碎念、灵感火花与不设限的日常记录。
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 group-hover:underline">
                    <span>探索动态 &rarr;</span>
                </div>
            </div>
        );
    }

    if (type === "friends") {
        return (
            <div
                onClick={() => setLocation("/friends")}
                className="group relative break-inside-avoid block w-full rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/40 p-5 shadow-md hover:shadow-xl transition-all duration-300 transform -rotate-1 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none"
            >
                <div className="absolute -top-2 right-8 w-10 h-3.5 bg-rose-200/70 dark:bg-rose-800/50 rounded-xs rotate-[4deg]" />
                <span className="text-2xl mb-1 block">🌸</span>
                <p className="font-bold text-base text-rose-900 dark:text-rose-200">邻家友链</p>
                <p className="text-xs text-rose-700/80 dark:text-rose-300/70 mt-1 leading-relaxed">
                    漫步在同好博主的数字花园，交换思想火花。
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-rose-800 dark:text-rose-300 group-hover:underline">
                    <span>拜访朋友们 &rarr;</span>
                </div>
            </div>
        );
    }

    // Search note
    return (
        <div
            onClick={() => {
                const searchBtn = document.querySelector("button[aria-label='Search'], button[title='Search'], button[title*='搜索']") as HTMLButtonElement;
                if (searchBtn) searchBtn.click();
            }}
            className="group relative break-inside-avoid block w-full rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/40 p-5 shadow-md hover:shadow-xl transition-all duration-300 transform rotate-1.5 hover:rotate-0 hover:scale-[1.03] cursor-pointer select-none"
        >
            <div className="absolute -top-2.5 left-10 w-10 h-3.5 bg-sky-200/70 dark:bg-sky-800/50 rounded-xs rotate-[-4deg]" />
            <span className="text-2xl mb-1 block">🔍</span>
            <p className="font-bold text-base text-sky-900 dark:text-sky-200">随心探索</p>
            <p className="text-xs text-sky-700/80 dark:text-sky-300/70 mt-1 leading-relaxed">
                输入任意关键词，探寻技术实战与解决方案。
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-sky-800 dark:text-sky-300 group-hover:underline">
                <span>开启搜索 &rarr;</span>
            </div>
        </div>
    );
}

/**
 * 🃏 Interactive Flip / Next Deck Card (replaces rigid pagination buttons!)
 */
function NextDeckFlipCard({
    onFlipNext,
    onShuffle,
    hasMore,
    totalCount,
}: {
    onFlipNext: () => void;
    onShuffle: () => void;
    hasMore: boolean;
    totalCount: number;
}) {
    return (
        <div className="break-inside-avoid block w-full rounded-3xl border-2 border-dashed border-theme/40 bg-theme/5 p-6 text-center select-none shadow-sm hover:shadow-xl transition-all duration-300 transform hover:scale-[1.03] hover:rotate-0 rotate-1">
            <span className="text-4xl block mb-2">🃏</span>
            <p className="font-extrabold text-base t-primary">记忆翻动</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                共 {totalCount} 张记忆相片已收录
            </p>
            <div className="mt-4 flex flex-col gap-2">
                {hasMore && (
                    <button
                        onClick={onFlipNext}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-theme px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
                    >
                        <i className="ri-folder-open-line text-sm" />
                        <span>翻开下一叠相片</span>
                    </button>
                )}
                <button
                    onClick={onShuffle}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold t-primary shadow-xs transition hover:bg-neutral-50 active:scale-95 dark:border-white/10 dark:bg-neutral-900"
                >
                    <i className="ri-shuffle-line text-sm text-theme" />
                    <span>随性洗牌重排</span>
                </button>
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
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false },
    });

    // Page state (supports seamless deck appending!)
    const [page, setPage] = useState<number>(1);
    const limit = 24; // Load generous cards for rich scattered atelier view!

    // Shuffle state (re-rotates cards randomly on user click!)
    const [shuffleSeed, setShuffleSeed] = useState(0);

    const currentFeeds = feeds[listState] ?? { size: 0, data: [], hasNext: false };
    const currentFeedData = Array.isArray(currentFeeds.data) ? currentFeeds.data : [];

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

    useEffect(() => {
        const type = (query.get("type") as FeedType) || "normal";
        if (type !== listState) {
            _setListState(type);
        }
        setPage(1);
        fetchFeeds(type, 1, false);
    }, [query.get("type")]);

    // Handle seamless next deck
    const handleFlipNext = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchFeeds(listState, nextPage, true);
    };

    // Re-shuffle random tilt angles and order
    const handleShuffle = () => {
        setShuffleSeed((prev) => prev + 1);
    };

    // Interleave scattered sticky notes among the photos
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
            // Every 3-4 cards, insert an organic sticky note artifact!
            if (listState === "normal" && (i === 1 || i === 4 || i === 7 || i === 11 || i === 15)) {
                if (noteIndex < noteTypes.length) {
                    items.push({ type: "note", noteType: noteTypes[noteIndex] });
                    noteIndex++;
                }
            }
        });

        // Always end with the interactive flip/shuffle deck card
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

            <main className="w-full max-w-[1780px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 mb-16">
                {/* Atelier Mood Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-2 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight t-primary flex items-center gap-2">
                            <span>{listState === "draft" ? t("draft_bin") : listState === "unlisted" ? t("unlisted") : t("atelier_gallery", "画廊随想")}</span>
                            <span className="text-base font-normal text-neutral-400 dark:text-neutral-500 font-mono">
                                ({currentFeeds.size})
                            </span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        {/* 🎲 Shuffle button */}
                        <button
                            onClick={handleShuffle}
                            title="随性打乱角度与排列"
                            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs transition hover:bg-neutral-50 active:scale-95 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200"
                        >
                            <i className="ri-shuffle-line text-theme" />
                            <span>随性洗牌</span>
                        </button>

                        {/* Admin status tabs */}
                        {profile?.permission && (
                            <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5 text-xs">
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
                </div>

                {/* Main Atelier Canvas: Staggered, Organic Columns with Large Posters */}
                {status === "loading" && currentFeedData.length === 0 ? (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-4 gap-6 space-y-6">
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
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-4 gap-6 space-y-6 ani-show">
                        {interleavedItems.map((item, idx) => {
                            if (item.type === "photo") {
                                return (
                                    <AtelierPhotoCard
                                        key={item.data.id}
                                        feed={item.data}
                                        index={idx}
                                        tiltOffset={shuffleSeed}
                                    />
                                );
                            }

                            if (item.type === "note") {
                                return (
                                    <StickyNoteItem
                                        key={`note-${item.noteType}-${idx}`}
                                        type={item.noteType}
                                        index={idx + shuffleSeed}
                                    />
                                );
                            }

                            // Interactive Deck Card
                            return (
                                <NextDeckFlipCard
                                    key="next-deck-card"
                                    onFlipNext={handleFlipNext}
                                    onShuffle={handleShuffle}
                                    hasMore={currentFeeds.hasNext}
                                    totalCount={currentFeeds.size}
                                />
                            );
                        })}
                    </div>
                )}
            </main>
        </>
    );
}
