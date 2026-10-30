import { useEffect, useRef, useState } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { HashTag } from "../components/hashtag";
import { Waiting } from "../components/loading";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";

type Hashtag = {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    feeds: number;
}

export function HashtagsPage() {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const [hashtags, setHashtags] = useState<Hashtag[]>();
    const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
    const ref = useRef(false);

    useEffect(() => {
        if (ref.current) return;
        client.tag.list().then(({ data }) => {
            if (data) {
                setHashtags(data as any);
            }
        });
        ref.current = true;
    }, []);

    const sortedHashtags = hashtags
        ?.filter(({ feeds }) => feeds > 0)
        .sort((a, b) => {
            if (sortBy === 'popular') {
                if (b.feeds !== a.feeds) {
                    return b.feeds - a.feeds;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });

    return (
        <>
            <Helmet>
                <title>{`${t('hashtags')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('hashtags')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={hashtags}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start py-4 border-b border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-bold mb-2">
                                <i className="ri-price-tag-3-line" />
                                <span>灵感标签</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight t-primary">
                                {t('hashtags')}
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                {t('total_tags', { count: sortedHashtags?.length || 0 })}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 self-start sm:self-auto">
                            <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5 text-xs">
                                <button
                                    onClick={() => setSortBy('latest')}
                                    className={`rounded-full px-3 py-1 transition font-medium ${sortBy === 'latest' ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-800 dark:text-white font-bold" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"}`}
                                >
                                    {t('sort_latest')}
                                </button>
                                <button
                                    onClick={() => setSortBy('popular')}
                                    className={`rounded-full px-3 py-1 transition font-medium ${sortBy === 'popular' ? "bg-white text-neutral-900 shadow-2xs dark:bg-neutral-800 dark:text-white font-bold" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"}`}
                                >
                                    {t('sort_popular')}
                                </button>
                            </div>
                            <Link
                                href="/"
                                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900"
                            >
                                <i className="ri-arrow-left-line" />
                                <span>返回画廊</span>
                            </Link>
                        </div>
                    </div>

                    <div className="wauto flex flex-wrap items-center justify-start gap-2.5 sm:gap-3 mt-6">
                        {sortedHashtags?.map((hashtag, index) => {
                            return (
                                <Link
                                    key={index}
                                    href={`/hashtag/${hashtag.name}`}
                                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/5 dark:bg-white/5 hover:bg-theme/10 hover:text-theme dark:hover:bg-theme/20 border border-transparent hover:border-theme/30 transition-all text-sm font-medium group"
                                >
                                    <HashTag name={hashtag.name} />
                                    <span className="text-xs text-neutral-400 dark:text-neutral-500 group-hover:text-theme transition-colors">
                                        {t("article.total_short$count", { count: hashtag.feeds })}
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                </main>
            </Waiting>
        </>
    )
}
