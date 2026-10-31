import { useEffect, useRef, useState } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
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

const TAG_ROTATIONS = [
    "rotate-[-2.5deg]", "rotate-[2deg]", "-rotate-1", "rotate-[2.5deg]",
    "rotate-[-1.5deg]", "rotate-[1.5deg]", "-rotate-2", "rotate-[3deg]",
    "rotate-[-2deg]", "rotate-[1deg]"
];

const TAG_COLOR_SCHEMES = [
    "bg-amber-100/90 text-amber-900 border-amber-300/70 hover:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/40",
    "bg-sky-100/90 text-sky-900 border-sky-300/70 hover:border-sky-400 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/40",
    "bg-rose-100/90 text-rose-900 border-rose-300/70 hover:border-rose-400 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/40",
    "bg-emerald-100/90 text-emerald-900 border-emerald-300/70 hover:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/40",
    "bg-purple-100/90 text-purple-900 border-purple-300/70 hover:border-purple-400 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/40",
    "bg-teal-100/90 text-teal-900 border-teal-300/70 hover:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800/40",
];

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
                            <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight art-title-${siteConfig.hashtagsTitleStyle || siteConfig.atelierTitleStyle || "aurora_flow"}`}>
                                {t('hashtags')}
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                {t('total_tags', { count: sortedHashtags?.length || 0 })}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 self-start sm:self-auto">
                            <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs shadow-2xs">
                                <button
                                    onClick={() => setSortBy('latest')}
                                    className={`rounded-full px-3.5 py-1.5 transition select-none ${
                                        sortBy === 'latest'
                                            ? "bg-white text-theme shadow-xs dark:bg-neutral-800 dark:text-white font-bold scale-105"
                                            : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 font-medium"
                                    }`}
                                >
                                    <i className="ri-time-line mr-1" />
                                    <span>{t('sort_latest')}</span>
                                </button>
                                <button
                                    onClick={() => setSortBy('popular')}
                                    className={`rounded-full px-3.5 py-1.5 transition select-none ${
                                        sortBy === 'popular'
                                            ? "bg-white text-theme shadow-xs dark:bg-neutral-800 dark:text-white font-bold scale-105"
                                            : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 font-medium"
                                    }`}
                                >
                                    <i className="ri-fire-line mr-1 text-rose-500" />
                                    <span>{t('sort_popular')}</span>
                                </button>
                            </div>
                            <Link
                                href="/"
                                className="group inline-flex items-center gap-2 rounded-full border border-black/10 bg-w px-4 py-2 text-xs font-bold t-primary shadow-xs hover:shadow-md hover:border-theme transition transform hover:-translate-y-0.5 active:scale-95"
                            >
                                <i className="ri-arrow-left-line text-theme transition-transform group-hover:-translate-x-1" />
                                <span>返回画廊</span>
                            </Link>
                        </div>
                    </div>

                    {/* Organic Scattered Gallery Tag Notes Wall (二次元彩色散落便签墙) */}
                    <div className="wauto flex flex-wrap items-center justify-start gap-3 sm:gap-4 mt-8 pb-12">
                        {sortedHashtags?.map((hashtag, index) => {
                            const rot = TAG_ROTATIONS[index % TAG_ROTATIONS.length];
                            const colorScheme = TAG_COLOR_SCHEMES[index % TAG_COLOR_SCHEMES.length];
                            return (
                                <Link
                                    key={index}
                                    href={`/hashtag/${encodeURIComponent(hashtag.name)}`}
                                    className={`group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border shadow-2xs text-xs sm:text-sm font-semibold transform ${rot} hover:rotate-0 hover:scale-110 hover:shadow-lg transition-all duration-300 select-none ${colorScheme}`}
                                    title={`浏览包含 #${hashtag.name} 的全部文章`}
                                >
                                    <span className="opacity-70 text-xs">🏷️</span>
                                    <span className="font-bold">#{hashtag.name}</span>
                                    <span className="ml-0.5 rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-mono">
                                        {hashtag.feeds}
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
