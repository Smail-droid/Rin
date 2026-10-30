import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { Waiting } from "../components/loading";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { useTranslation } from "react-i18next";

interface FeedItem {
    id: number;
    createdAt: Date;
    title: string | null;
}

function formatExactDate(date: Date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}年${month}月${day}日`;
}

export function TimelinePage() {
    const [timelineItems, setTimelineItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();

    useEffect(() => {
        client.feed
            .timeline()
            .then(({ data }) => {
                if (data && Array.isArray(data)) {
                    setTimelineItems(data as any);
                }
            })
            .catch((err) => {
                console.error("fetch timeline error:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Group items by Year
    const yearGroups = useMemo(() => {
        const groups: Record<number, FeedItem[]> = {};
        timelineItems.forEach((item) => {
            const yr = new Date(item.createdAt).getFullYear();
            if (!groups[yr]) groups[yr] = [];
            groups[yr].push(item);
        });
        return groups;
    }, [timelineItems]);

    const sortedYears = useMemo(() => {
        return Object.keys(yearGroups)
            .map(Number)
            .sort((a, b) => b - a);
    }, [yearGroups]);

    // Rotations for floating memory artifacts
    const rotations = ["-rotate-1.5", "rotate-2", "-rotate-2", "rotate-1.5", "-rotate-1", "rotate-2.5"];

    return (
        <>
            <Helmet>
                <title>{`时光长河 · 岁月轨迹 - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content="时光长河 · 岁月轨迹" />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>

            <Waiting for={!loading}>
                <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 mb-20 ani-show">
                    {/* Header: River of Time Introduction */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-14 pb-5 border-b border-black/10 dark:border-white/10">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme/10 text-theme text-xs font-bold mb-2">
                                <i className="ri-compass-3-line" />
                                <span>岁月长河刻度</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight t-primary">
                                时光长河 · 岁月轨迹
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                                岁月不语，惟石能言。每一篇随笔都是长河里静止的浮游微光。
                            </p>
                        </div>

                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900"
                        >
                            <i className="ri-arrow-left-line" />
                            <span>返回画廊</span>
                        </Link>
                    </div>

                    {/* Timeline River Container */}
                    <div className="relative">
                        {/* Central River Beam */}
                        <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 top-2 bottom-6 w-0.5 bg-gradient-to-b from-theme via-theme/40 to-theme/10 dark:from-theme dark:via-theme/30 dark:to-transparent pointer-events-none" />

                        {sortedYears.map((year) => {
                            const yearItems = yearGroups[year] || [];
                            return (
                                <div key={year} className="mb-14 relative">
                                    {/* Year Dial / Milestone Milestone */}
                                    <div className="flex items-center justify-start sm:justify-center mb-8 relative z-10 pl-1 sm:pl-0">
                                        <div className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 px-5 py-2 shadow-md">
                                            <span className="text-base">⏳</span>
                                            <span className="text-xl font-extrabold t-primary font-mono tracking-wider">
                                                {year}
                                            </span>
                                            <span className="text-xs text-neutral-400 font-medium">
                                                ({yearItems.length} 篇记事)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Floating Memory Fragment Items */}
                                    <div className="flex flex-col gap-8">
                                        {yearItems.map((item, idx) => {
                                            const isLeft = idx % 2 === 0;
                                            const rot = rotations[idx % rotations.length];
                                            const exactDate = formatExactDate(item.createdAt);

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`relative flex items-center w-full ${
                                                        isLeft
                                                            ? "sm:justify-start pl-10 sm:pl-0 sm:pr-[53%]"
                                                            : "sm:justify-end pl-10 sm:pl-[53%] sm:pr-0"
                                                    }`}
                                                >
                                                    {/* Glowing Node on the Central River Beam */}
                                                    <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 top-6 z-20 flex items-center justify-center">
                                                        <div className="h-3.5 w-3.5 rounded-full bg-theme ring-4 ring-white dark:ring-neutral-950 shadow-md animate-pulse" />
                                                    </div>

                                                    {/* Floating Memory Card */}
                                                    <Link
                                                        href={`/feed/${item.id}`}
                                                        className={`group w-full block rounded-2xl border border-black/10 bg-white p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-300 transform ${rot} hover:rotate-0 hover:scale-[1.02] hover:z-30 dark:border-white/10 dark:bg-neutral-900`}
                                                    >
                                                        {/* Temporal Scale: Exact Date */}
                                                        <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 mb-2">
                                                            <div className="inline-flex items-center gap-1.5 font-mono font-semibold text-theme">
                                                                <i className="ri-calendar-line text-xs" />
                                                                <span>{exactDate}</span>
                                                            </div>
                                                            <span className="text-[11px] opacity-75">
                                                                #{item.id}
                                                            </span>
                                                        </div>

                                                        {/* Article Title */}
                                                        <h2 className="text-base sm:text-lg font-bold t-primary group-hover:text-theme transition-colors line-clamp-2 leading-snug">
                                                            {item.title || t("unlisted")}
                                                        </h2>

                                                        {/* Footer Indicator */}
                                                        <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-black/5 dark:border-white/5">
                                                            <span>阅读此篇浮游记事</span>
                                                            <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform" />
                                                        </div>
                                                    </Link>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            </Waiting>
        </>
    );
}
