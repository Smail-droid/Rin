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

    // 记录折叠/展开状态，默认全部展开
    const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

    const toggleMonthCollapse = (key: string) => {
        setCollapsedMonths((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

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

    // 显著可见且自然的左右错落倾角 (避免水平死板)
    const rotations = [
        "-rotate-[1.8deg]",
        "rotate-[1.6deg]",
        "-rotate-[1.4deg]",
        "rotate-[1.9deg]",
        "-rotate-[1.6deg]",
        "rotate-[1.5deg]",
    ];

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
                <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 mb-16 ani-show select-none">
                    {/* Header */}
                    <div className="mb-6 pb-3 border-b border-black/10 dark:border-white/10">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme/10 text-theme text-xs font-bold mb-1.5">
                            <i className="ri-compass-3-line" />
                            <span>岁月长河刻度</span>
                        </div>
                        <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight art-title-${siteConfig.timelineTitleStyle || siteConfig.atelierTitleStyle || "aurora_flow"}`}>
                            时光长河 · 岁月轨迹
                        </h1>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            岁月不语，惟石能言。每一篇随笔都是长河里静止的浮游微光。
                        </p>
                    </div>

                    {/* Timeline River Container */}
                    <div className="relative">
                        {/* Central Flowing River Beam (动态光晕流动线条) */}
                        <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-3 bottom-4 w-1 rounded-full bg-gradient-to-b from-theme via-theme/40 to-theme/10 dark:from-theme/80 dark:via-theme/30 dark:to-transparent pointer-events-none shadow-[0_0_8px_rgba(var(--theme-rgb),0.35)] animate-pulse" />

                        {sortedMonthKeys.map((key) => {
                            const group = monthGroups[key];
                            const monthItems = group.items;
                            const isCollapsed = Boolean(collapsedMonths[key]);

                            return (
                                <div key={key} className="mb-6 relative">
                                    {/* Year-Month Dial: 移除沙漏 Emoji，左侧年月，右侧月份篇幅，点击支持折叠展开 */}
                                    <div className="flex items-center justify-center mb-3.5 relative z-10">
                                        <button
                                            type="button"
                                            onClick={() => toggleMonthCollapse(key)}
                                            className="group inline-flex items-center gap-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 px-4 py-1.5 shadow-xs hover:shadow-md hover:border-theme/40 transition-all cursor-pointer"
                                            title={isCollapsed ? "点击展开该月记事" : "点击折叠该月记事"}
                                        >
                                            <div className="flex items-center gap-1 text-theme font-bold">
                                                <i className="ri-calendar-event-line text-sm" />
                                                <span className="text-sm sm:text-base font-extrabold font-mono tracking-wider t-primary">
                                                    {group.label}
                                                </span>
                                            </div>

                                            <span className="h-3 w-[1px] bg-black/10 dark:bg-white/10" />

                                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                                {group.month}月份 · {monthItems.length} 篇记事
                                            </span>

                                            <i
                                                className={`ri-arrow-down-s-line text-sm text-neutral-400 group-hover:text-theme transition-transform duration-200 ${
                                                    isCollapsed ? "rotate-[-90deg]" : "rotate-0 text-theme"
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* 展开/折叠的文章卡片网格 */}
                                    {!isCollapsed && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative z-10 ani-show">
                                            {monthItems.map((item, idx) => {
                                                const rot = rotations[idx % rotations.length];
                                                const exactDate = formatExactDate(item.createdAt);

                                                return (
                                                    <Link
                                                        key={item.id}
                                                        href={`/feed/${item.id}`}
                                                        className={`group block rounded-2xl border border-black/10 bg-white p-3.5 shadow-2xs hover:shadow-xl transition-all duration-300 transform ${rot} hover:rotate-0 hover:scale-[1.02] hover:z-20 dark:border-white/10 dark:bg-neutral-900`}
                                                    >
                                                        {/* Top Date & ID Header */}
                                                        <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 mb-1.5">
                                                            <div className="inline-flex items-center gap-1.5 font-mono font-semibold text-theme">
                                                                <i className="ri-calendar-line text-xs" />
                                                                <span>{exactDate}</span>
                                                            </div>
                                                            <span className="text-[11px] font-mono opacity-60">
                                                                #{item.id}
                                                            </span>
                                                        </div>

                                                        {/* Article Title With Inline Arrow (移除底部占高度行，箭头与标题共存同行) */}
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h2 className="text-sm font-bold t-primary group-hover:text-theme transition-colors line-clamp-2 leading-snug flex-1">
                                                                {item.title || t("unlisted")}
                                                            </h2>
                                                            <span className="text-neutral-400 group-hover:text-theme group-hover:translate-x-1 transition-all shrink-0 text-base font-bold leading-snug">
                                                                &rarr;
                                                            </span>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </main>
            </Waiting>
        </>
    );
}
