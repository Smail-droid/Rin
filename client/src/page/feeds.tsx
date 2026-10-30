import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { client } from "../app/runtime"
import { ProfileContext } from "../state/profile"
import { useSiteConfig } from "../hooks/useSiteConfig"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next"

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

function FeedSkeletonCard() {
    return (
        <div className="my-2.5 w-full break-inside-avoid rounded-2xl border border-black/5 bg-w p-5 shadow-sm dark:border-white/5 animate-pulse">
            <div className="h-44 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800 mb-4" />
            <div className="h-6 w-3/4 rounded-md bg-neutral-200 dark:bg-neutral-800 mb-2.5" />
            <div className="flex gap-2 mb-3">
                <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="space-y-2 mb-4">
                <div className="h-3.5 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-3.5 w-5/6 rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <div className="flex gap-2">
                <div className="h-5 w-14 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-5 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            </div>
        </div>
    );
}

function EmptyFeedsState({ listState, canWrite }: { listState: FeedType; canWrite?: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="wauto flex flex-col items-center justify-center py-16 px-4 text-center ani-show">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-100 text-neutral-400 dark:bg-white/5 dark:text-neutral-500 mb-4 shadow-inner">
                <i className="ri-article-line text-4xl" />
            </div>
            <h3 className="text-xl font-semibold t-primary mb-1">
                {listState === 'draft' ? t('draft_bin') : listState === 'unlisted' ? t('unlisted') : t('article.title')}
            </h3>
            <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                {listState === 'draft'
                    ? (t('draft_empty') || 'No drafts found')
                    : (t('feed_empty') || 'Articles will appear here once published')}
            </p>
            {canWrite && (
                <Link
                    href="/admin/writing"
                    className="inline-flex items-center gap-2 rounded-full bg-theme px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-95"
                >
                    <i className="ri-quill-pen-line" />
                    <span>{t('writing')}</span>
                </Link>
            )}
        </div>
    );
}

function HeroGalleryShowcase({ feeds }: { feeds: any[] }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const photoFeeds = useMemo(() => {
        return feeds.filter((f) => Boolean(f.avatar)).slice(0, 8);
    }, [feeds]);

    if (photoFeeds.length === 0) return null;

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const offset = direction === 'left' ? -300 : 300;
        scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    };

    const rotations = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2', '-rotate-0.5', 'rotate-1.5'];

    return (
        <div className="wauto mb-8 ani-show">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-theme/10 text-theme text-xs">
                        <i className="ri-polaroid-line" />
                    </span>
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                        画廊随想
                    </span>
                    <span className="text-xs text-neutral-400">· 发现精选</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => scroll('left')}
                        title="向左翻动"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-w text-neutral-600 shadow-2xs transition hover:bg-neutral-100 hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                        <i className="ri-arrow-left-s-line text-sm" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        title="向右翻动"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-w text-neutral-600 shadow-2xs transition hover:bg-neutral-100 hover:scale-105 active:scale-95 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                        <i className="ri-arrow-right-s-line text-sm" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 scrollbar-none snap-x snap-mandatory"
            >
                {photoFeeds.map((feed, index) => {
                    const rot = rotations[index % rotations.length];
                    return (
                        <Link
                            key={feed.id}
                            href={`/feed/${feed.id}`}
                            className={`group relative shrink-0 w-60 sm:w-72 snap-start rounded-2xl border border-black/10 bg-w p-2.5 pb-3.5 shadow-xs hover:shadow-xl transition-all duration-300 transform ${rot} hover:rotate-0 hover:scale-[1.03] hover:z-20 dark:border-white/10 dark:bg-neutral-900`}
                        >
                            {/* Washi tape accent on top */}
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-amber-100/80 dark:bg-amber-900/40 rounded-xs shadow-2xs rotate-[-3deg] pointer-events-none" />

                            {/* Photo area */}
                            <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 relative">
                                <img
                                    src={feed.avatar}
                                    alt={feed.title}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                                />
                            </div>

                            {/* Title & Meta */}
                            <div className="px-1 mt-2.5">
                                <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-100 line-clamp-1 group-hover:text-theme transition">
                                    {feed.title}
                                </h3>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400">
                                    <span>{new Date(feed.createdAt).toLocaleDateString()}</span>
                                    {feed.readingTime && (
                                        <span className="flex items-center gap-1">
                                            <i className="ri-time-line text-xs" />
                                            <span>{feed.readingTime} 分钟阅读</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

function Pagination({
    currentPage,
    totalCount,
    pageSize,
    hasNext,
    listState,
}: {
    currentPage: number;
    totalCount: number;
    pageSize: number;
    hasNext: boolean;
    listState: FeedType;
}) {
    const { t } = useTranslation();
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    if (totalPages <= 1 && !hasNext) {
        return null;
    }

    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    return (
        <div className="wauto flex items-center justify-center gap-3 my-10 ani-show select-none text-sm">
            {currentPage > 1 ? (
                <Link
                    href={`/?type=${listState}&page=${currentPage - 1}`}
                    className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition py-1 px-2"
                >
                    <span>&larr;</span>
                    <span>{t('previous')}</span>
                </Link>
            ) : (
                <span className="flex items-center gap-1 text-neutral-300 dark:text-neutral-700 cursor-not-allowed py-1 px-2">
                    <span>&larr;</span>
                    <span>{t('previous')}</span>
                </span>
            )}

            <div className="flex items-center gap-1.5">
                {pages.map((p) => {
                    const isActive = p === currentPage;
                    return isActive ? (
                        <span
                            key={p}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-black/30 dark:border-white/30 text-xs font-semibold t-primary shadow-2xs"
                        >
                            {p}
                        </span>
                    ) : (
                        <Link
                            key={p}
                            href={`/?type=${listState}&page=${p}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            {p}
                        </Link>
                    );
                })}
            </div>

            {hasNext || currentPage < totalPages ? (
                <Link
                    href={`/?type=${listState}&page=${currentPage + 1}`}
                    className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition py-1 px-2"
                >
                    <span>{t('next')}</span>
                    <span>&rarr;</span>
                </Link>
            ) : (
                <span className="flex items-center gap-1 text-neutral-300 dark:text-neutral-700 cursor-not-allowed py-1 px-2">
                    <span>{t('next')}</span>
                    <span>&rarr;</span>
                </span>
            )}
        </div>
    );
}

export function FeedsPage() {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle'>('loading')
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 ani-show sm:columns-2 lg:columns-3 xl:columns-4" : "wauto flex flex-col gap-4 ani-show";
    const currentFeeds = feeds[listState] ?? { size: 0, data: [], hasNext: false };
    const currentFeedData = Array.isArray(currentFeeds.data) ? currentFeeds.data : [];
    const ref = useRef("")

    function fetchFeeds(type: FeedType) {
        client.feed.list({
            page: page,
            limit: limit,
            type: type
        }).then(({ data }) => {
            if (data) {
                setFeeds((prev) => ({
                    ...prev,
                    [type]: data
                }))
            }
        }).finally(() => {
            setStatus('idle')
        })
    }

    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")} ${limit}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [limit, query.get("page"), query.get("type")])

    return (
        <>
            <Helmet>
                <title>{`${t('article.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <main className="w-full flex flex-col justify-center items-center mb-8">
                {/* Header section with clean, elegant visual hierarchy */}
                <div className="wauto text-start py-4">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
                                {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                                <i className="ri-article-line text-xs" />
                                {currentFeeds.size}
                            </span>
                        </div>

                        {profile?.permission && (
                            <div className="flex items-center gap-2 self-start sm:self-auto rounded-full bg-neutral-100 p-1 dark:bg-white/5">
                                <Link
                                    href="/?type=normal"
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                        listState === 'normal'
                                            ? 'bg-w text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                                            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                                    }`}
                                >
                                    {t('article.title')}
                                </Link>
                                <Link
                                    href="/?type=draft"
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                        listState === 'draft'
                                            ? 'bg-w text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                                            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                                    }`}
                                >
                                    {t('draft_bin')}
                                </Link>
                                <Link
                                    href="/?type=unlisted"
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                        listState === 'unlisted'
                                            ? 'bg-w text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                                            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                                    }`}
                                >
                                    {t('unlisted')}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Hero Polaroid / Gallery Showcase (only on page 1 of normal feeds) */}
                {listState === 'normal' && page === 1 && currentFeedData.length > 0 && (
                    <HeroGalleryShowcase feeds={currentFeedData} />
                )}

                {/* Content: Skeleton, Empty State, or Feed List */}
                {status === 'loading' ? (
                    <div className={feedListClass}>
                        <FeedSkeletonCard />
                        <FeedSkeletonCard />
                        <FeedSkeletonCard />
                        <FeedSkeletonCard />
                    </div>
                ) : currentFeedData.length === 0 ? (
                    <EmptyFeedsState listState={listState} canWrite={Boolean(profile?.permission)} />
                ) : (
                    <>
                        <div className={feedListClass}>
                            {currentFeedData.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <Pagination
                            currentPage={page}
                            totalCount={currentFeeds.size}
                            pageSize={limit}
                            hasNext={currentFeeds.hasNext}
                            listState={listState}
                        />
                    </>
                )}
            </main>
        </>
    )
}
