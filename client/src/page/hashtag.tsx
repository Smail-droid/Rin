import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link } from "wouter"
import { useTranslation } from "react-i18next"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"


type FeedsData = {
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    feeds: {
        hashtags: {
            name: string;
            id: number;
        }[];
        id: number;
        title: string | null;
        summary: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        user: {
            id: number;
            username: string;
            avatar: string | null;
        };
    }[] | undefined;
}

export function HashtagPage({ name }: { name: string }) {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [hashtag, setHashtag] = useState<FeedsData>()
    const [isSmartSearch, setIsSmartSearch] = useState(false)
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 md:columns-2" : "wauto flex flex-col";
    const hashtagFeeds = Array.isArray(hashtag?.feeds) ? hashtag.feeds : [];
    const ref = useRef("")

    function fetchFeeds() {
        const nameDecoded = decodeURI(name).trim()
        setIsSmartSearch(false)

        client.tag.get(nameDecoded).then(async ({ data }) => {
            if (data && Array.isArray(data.feeds) && data.feeds.length > 0) {
                setHashtag(data as any)
                setStatus('idle')
                return
            }

            // 智能多词关联聚合：当精确标签没有直接匹配到文章，或属于复合标签时，智能拆词联合检索相关内容
            const tokens = nameDecoded
                .split(/[、,，\s+]+/)
                .map((s) => s.trim().replace(/^#+/, ""))
                .filter((s) => s.length > 0)

            if (tokens.length > 0) {
                try {
                    const searchResults = await Promise.all(
                        tokens.map((token) => client.search.search(token, { page: 1, limit: 20 }))
                    )

                    const feedMap = new Map<number, any>()
                    for (const res of searchResults) {
                        if (res.data?.data && Array.isArray(res.data.data)) {
                            for (const feed of res.data.data) {
                                if (!feedMap.has(feed.id)) {
                                    feedMap.set(feed.id, feed)
                                }
                            }
                        }
                    }

                    const combinedFeeds = Array.from(feedMap.values())
                    setHashtag({
                        name: nameDecoded,
                        id: 0,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        feeds: combinedFeeds as any,
                    })
                    setIsSmartSearch(combinedFeeds.length > 0)
                } catch {
                    setHashtag(data as any || { name: nameDecoded, id: 0, createdAt: new Date(), updatedAt: new Date(), feeds: [] })
                }
            } else {
                setHashtag(data as any)
            }
            setStatus('idle')
        }).catch(() => {
            setStatus('idle')
        })
    }
    useEffect(() => {
        if (ref.current === name) return
        setStatus('loading')
        fetchFeeds()
        ref.current = name
    }, [name])
    return (
        <>
            <Helmet>
                <title>{`${hashtag?.name} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={hashtag?.name} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={hashtag || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-bold mb-2">
                                <i className="ri-price-tag-3-line" />
                                <span>标签分类</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight t-primary">
                                #{hashtag?.name}
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-2">
                                <span>{t('article.total$count', { count: hashtagFeeds.length })}</span>
                                {isSmartSearch && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-theme/10 text-theme px-2.5 py-0.5 text-xs font-semibold">
                                        <i className="ri-sparkling-fill" />
                                        <span>已智能关联匹配复合标签内容</span>
                                    </span>
                                )}
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
                            {hashtagFeeds.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
