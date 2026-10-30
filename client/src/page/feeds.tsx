import { useContext, useEffect, useRef, useState } from "react"
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

export function FeedsPage() {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle'>('loading')
    const [tags, setTags] = useState<{ id: number; name: string }[]>([])
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

    // Fetch popular tags once for tag cloud
    useEffect(() => {
        client.tag.list().then(({ data }) => {
            if (data && Array.isArray(data)) {
                setTags(data);
            }
        }).catch(() => {});
    }, []);

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
                {/* Header section with enhanced visual hierarchy */}
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

                    {/* Tag Cloud Summary Bar */}
                    {tags.length > 0 && listState === 'normal' && (
                        <div className="flex items-center gap-2 overflow-x-auto pt-4 pb-1 scrollbar-none ani-show">
                            <span className="shrink-0 text-xs font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                                <i className="ri-price-tag-3-line text-xs" />
                            </span>
                            {tags.slice(0, 10).map((tag) => (
                                <Link
                                    key={tag.id}
                                    href={`/hashtag/${encodeURIComponent(tag.name)}`}
                                    className="shrink-0 rounded-full border border-black/5 bg-neutral-100/70 px-2.5 py-0.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200 dark:border-white/5 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                                >
                                    #{tag.name}
                                </Link>
                            ))}
                            {tags.length > 10 && (
                                <Link
                                    href="/hashtags"
                                    className="shrink-0 text-xs text-theme hover:underline px-1"
                                >
                                    &rarr;
                                </Link>
                            )}
                        </div>
                    )}
                </div>

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
                        <div className="wauto flex flex-row items-center mt-6 ani-show">
                            {page > 1 && (
                                <Link
                                    href={`/?type=${listState}&page=${page - 1}`}
                                    className="text-sm font-medium rounded-full px-5 py-2 text-white bg-theme shadow-sm transition hover:opacity-90"
                                >
                                    {t('previous')}
                                </Link>
                            )}
                            <div className="flex-1" />
                            {currentFeeds.hasNext && (
                                <Link
                                    href={`/?type=${listState}&page=${page + 1}`}
                                    className="text-sm font-medium rounded-full px-5 py-2 text-white bg-theme shadow-sm transition hover:opacity-90"
                                >
                                    {t('next')}
                                </Link>
                            )}
                        </div>
                    </>
                )}
            </main>
        </>
    )
}
