import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { useTranslation } from "react-i18next"
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

export function SearchPage({ keyword }: { keyword: string }) {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsData>()
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 md:columns-2" : "wauto flex flex-col";
    const feedData = Array.isArray(feeds?.data) ? feeds.data : [];
    const ref = useRef("")
    function fetchFeeds() {
        if (!keyword) return
        client.search.search(keyword, {
            page,
            limit,
        }).then(({ data }) => {
            if (data) {
                setFeeds(data)
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${page} ${limit} ${keyword}`
        if (ref.current == key) return
        setStatus('loading')
        fetchFeeds()
        ref.current = key
    }, [page, limit, keyword])
    const title = t('article.search.title$keyword', { keyword })
    return (
        <>
            <Helmet>
                <title>{`${title} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={title} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 text-xs font-bold mb-2">
                                <i className="ri-search-line" />
                                <span>搜索探索</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight t-primary">
                                {t('article.search.title')}: <span className="text-theme font-normal">{keyword}</span>
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                {t('article.total$count', { count: feeds?.size || 0 })}
                            </p>
                        </div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900"
                        >
                            <i className="ri-arrow-left-line" />
                            <span>返回画廊</span>
                        </Link>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className={feedListClass}>
                            {feedData.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <div className="wauto flex items-center justify-center gap-3 my-8 ani-show select-none text-sm">
                            {page > 1 ? (
                                <Link
                                    href={`?page=${page - 1}&limit=${limit}`}
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
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/30 dark:border-white/30 text-xs font-semibold t-primary">
                                {page}
                            </span>
                            {feeds?.hasNext ? (
                                <Link
                                    href={`?page=${page + 1}&limit=${limit}`}
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
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
