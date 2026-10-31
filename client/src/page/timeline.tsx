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

    // Group items by Year-Month (e.g. 2026-10)
    const monthGroups = useMemo(() => {
        const groups: Record<string, { year: number; month: number; label: string; items: FeedItem[] }> = {};
        timelineItems.forEach((item) => {
            const d = new Date(item.createdAt);
            const yr = d.getFullYear();
            const mo = d.getMonth() + 1;
            const moStr = String(mo).padStart(2, "0");
            const key = `${yr}-${moStr}`;
            if (!groups[key]) {
                groups[key] = {
                    year: yr,
                    month: mo,
                    label: key, // e.g. 2026-10
                    items: [],
                };
            }
            groups[key].items.push(item);
        });
        return groups;
    }, [timelineItems]);

    const sortedMonthKeys = useMemo(() => {
        return Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));
    }, [monthGroups]);

    // Natural alternating tilt angles
    const rotations = ["-rotate-1", "rotate-1", "-rotate-1.5", "rotate-1.5", "-rotate-0.5", "rotate-0.5"];

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
                <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 mb-20 ani-show">
                    {/* Header: Clean Introduction (NO return button, avatar leads to home) */}
                    <div className="mb-8 pb-4 border-b border-black/10 dark:border-white/10">
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

                    {/* Timeline River Container */}
                    <div className="relative">
                        {/* Central River Beam */}
                        <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-4 bottom-6 w-0.5 bg-gradient-to-b from-theme via-theme/40 to-theme/10 dark:from-theme dark:via-theme/30 dark:to-transparent pointer-events-none" />

                        {sortedMonthKeys.map((key) => {
                            const group = monthGroups[key];
                            const monthItems = group.items;
                            return (
                                <div key={key} className="mb-12 relative">
                                    {/* Year-Month Milestone Dial (e.g. 2026-10) */}
                                    <div className="flex items-center justify-center mb-6 relative z-10">
                                        <div className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 px-5 py-2 shadow-sm hover:shadow-md transition">
                                            <span className="text-base">⏳</span>
                                            <span className="text-lg font-extrabold t-primary font-mono tracking-wider">
                                                {group.label}
                                            </span>
                                            <span className="text-xs text-neutral-400 font-medium">
                                                ({group.month}月份 · {monthItems.length} 篇记事)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Compact, Staggered 2-Column Interlocking Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5 relative z-10">
                                        {monthItems.map((item, idx) => {
                                            const rot = rotations[idx % rotations.length];
                                            const exactDate = formatExactDate(item.createdAt);

                                            return (
                                                <Link
                                                    key={item.id}
                                                    href={`/feed/${item.id}`}
                                                    className={`group block rounded-2xl border border-black/10 bg-white p-4 shadow-2xs hover:shadow-xl transition-all duration-300 transform ${rot} hover:rotate-0 hover:scale-[1.02] hover:z-20 dark:border-white/10 dark:bg-neutral-900`}
                                                >
                                                    {/* Exact Date & ID Header */}
                                                    <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 mb-2">
                                                        <div className="inline-flex items-center gap-1.5 font-mono font-semibold text-theme">
                                                            <i className="ri-calendar-line text-xs" />
                                                            <span>{exactDate}</span>
                                                        </div>
                                                        <span className="text-[11px] opacity-70">
                                                            #{item.id}
                                                        </span>
                                                    </div>

                                                    {/* Article Title */}
                                                    <h2 className="text-sm sm:text-base font-bold t-primary group-hover:text-theme transition-colors line-clamp-2 leading-snug">
                                                        {item.title || t("unlisted")}
                                                    </h2>

                                                    {/* Footer Indicator */}
                                                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-black/5 dark:border-white/5">
                                                        <span>阅读浮游记事</span>
                                                        <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform" />
                                                    </div>
                                                </Link>
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
