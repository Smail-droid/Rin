import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { Waiting } from "../components/loading";
import { PageHeader, GALLERY_CONTAINER_CLASS } from "../components/page-header";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { useTranslation } from "react-i18next";

interface TimelineUnifiedItem {
    id: number | string;
    type: "feed" | "moment";
    title?: string | null;
    content?: string;
    createdAt: any;
    updatedAt?: any;
}

function parseSafeDate(val: any): Date {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === "number") {
        return new Date(val < 10000000000 ? val * 1000 : val);
    }
    if (typeof val === "string") {
        const trimmed = val.trim();
        if (/^\d+$/.test(trimmed)) {
            const num = parseInt(trimmed, 10);
            return new Date(num < 10000000000 ? num * 1000 : num);
        }
        // 关键时区防丢算法：SQLite 经常输出形如 "2026-10-31 22:28:26" 缺失时区标识的 UTC 字符串
        // 必须规范化为 "2026-10-31T22:28:26Z"，防止浏览器作为本地时间解析而损失 8 小时导致被误归为 10 月份
        let normalized = trimmed;
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(normalized)) {
            normalized = normalized.replace(" ", "T") + "Z";
        } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
            normalized = normalized + "Z";
        }
        const parsed = new Date(normalized);
        return isNaN(parsed.getTime()) ? new Date(val) : parsed;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
}

// 获取在时间轴上的有效展示时间（优先取最新更新或发表时间）
function getEffectiveDate(item: TimelineUnifiedItem): Date {
    const cDate = parseSafeDate(item.createdAt);
    if (!item.updatedAt) return cDate;
    const uDate = parseSafeDate(item.updatedAt);
    return uDate > cDate ? uDate : cDate;
}

function formatExactDate(date: any) {
    const d = parseSafeDate(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}年${month}月${day}日`;
}

export function TimelinePage() {
    const [timelineItems, setTimelineItems] = useState<TimelineUnifiedItem[]>([]);
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
        // 聚合全站文章与朋友圈记事动态，完整还原岁月长河刻度
        Promise.all([
            client.feed.timeline(),
            client.moments.list({ limit: 60 }).catch(() => ({ data: [] })),
        ])
            .then(([feedRes, momentRes]) => {
                const combined: TimelineUnifiedItem[] = [];
                if (feedRes.data && Array.isArray(feedRes.data)) {
                    feedRes.data.forEach((f: any) => {
                        combined.push({
                            id: f.id,
                            type: "feed",
                            title: f.title,
                            createdAt: f.createdAt,
                            updatedAt: f.updatedAt,
                        });
                    });
                }
                const momentList = Array.isArray((momentRes.data as any)?.data)
                    ? (momentRes.data as any).data
                    : Array.isArray(momentRes.data)
                    ? momentRes.data
                    : [];
                momentList.forEach((m: any) => {
                    combined.push({
                        id: `m_${m.id}`,
                        type: "moment",
                        title: m.content?.slice(0, 36) || t("moments.default_entry_title", { defaultValue: "生活记事" }),
                        content: m.content,
                        createdAt: m.createdAt,
                    });
                });
                setTimelineItems(combined);
            })
            .catch((err) => {
                console.error("fetch timeline error:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Group items by Year-Month (以本地有效发表/更新时间为基准，确保 11 月独立成组)
    const monthGroups = useMemo(() => {
        const groups: Record<string, { year: number; month: number; label: string; items: TimelineUnifiedItem[] }> = {};
        timelineItems.forEach((item) => {
            const d = getEffectiveDate(item);
            const yr = d.getFullYear();
            const mo = d.getMonth() + 1;
            const moStr = String(mo).padStart(2, "0");
            const key = `${yr}-${moStr}`;
            if (!groups[key]) {
                groups[key] = {
                    year: yr,
                    month: mo,
                    label: key,
                    items: [],
                };
            }
            groups[key].items.push(item);
        });

        // 组内按最新时间倒序排列
        Object.values(groups).forEach((g) => {
            g.items.sort((a, b) => getEffectiveDate(b).getTime() - getEffectiveDate(a).getTime());
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
                <title>{`${t("timeline_title", { defaultValue: "时光长河" })} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t("timeline_title", { defaultValue: "时光长河" })} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>

            <Waiting for={!loading}>
                <main className={`${GALLERY_CONTAINER_CLASS} py-6 sm:py-8 mb-16 ani-show select-none`}>
                    <PageHeader
                        eyebrow={`CHRONICLE · ${timelineItems.length}`}
                        title={t("timeline_title", { defaultValue: "时光长河" })}
                        subtitle={t("timeline_desc", { defaultValue: "流年有声，岁序常易。静候每一程漫行与落笔。" })}
                        mode={siteConfig.pageHeaderMode}
                        titleFont={siteConfig.themeTitleFont as any}
                        titleEffect={siteConfig.themeTitleEffect}
                        bannerUrl={siteConfig.pageHeaderBannerUrl}
                    />

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
                                            className="group inline-flex items-center gap-2.5 rounded-2xl bg-[rgb(var(--rin-surface-rgb))] border border-[rgb(var(--rin-hairline-rgb))] px-4 py-1.5 shadow-xs hover:shadow-md hover:border-theme/40 transition-all cursor-pointer dark:shadow-none"
                                            title={isCollapsed ? "点击展开该月记事" : "点击折叠该月记事"}
                                        >
                                            <div className="flex items-center gap-1 text-theme font-bold">
                                                <i className="ri-calendar-event-line text-sm" />
                                                <span className="text-sm sm:text-base font-extrabold font-mono tracking-wider text-[rgb(var(--rin-ink-rgb))]">
                                                    {group.label}
                                                </span>
                                            </div>

                                            <span className="h-3 w-[1px] bg-[rgb(var(--rin-hairline-rgb))]" />

                                            <span className="text-xs text-[rgb(var(--rin-ink-muted-rgb))] font-medium">
                                                {group.month}月份 · {monthItems.length} 篇记事
                                            </span>

                                            <i
                                                className={`ri-arrow-down-s-line text-sm text-[rgb(var(--rin-ink-muted-rgb))] group-hover:text-theme transition-transform duration-200 ${
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
                                                const exactDate = formatExactDate(getEffectiveDate(item));
                                                const isFeed = item.type === "feed";

                                                return (
                                                    <Link
                                                        key={item.id}
                                                        href={isFeed ? `/feed/${item.id}` : "/moments"}
                                                        className={`group block rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-3.5 shadow-2xs hover:shadow-xl hover:border-theme/40 transition-all duration-300 transform ${rot} hover:rotate-0 hover:scale-[1.02] hover:z-20 dark:hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)] select-none`}
                                                    >
                                                        {/* Top Date & ID Header */}
                                                        <div className="flex items-center justify-between text-xs text-[rgb(var(--rin-ink-muted-rgb))] mb-1.5">
                                                            <div className="inline-flex items-center gap-1.5 font-mono font-semibold text-theme">
                                                                <i className={isFeed ? "ri-article-line text-xs" : "ri-chat-smile-2-line text-xs text-emerald-500"} />
                                                                <span>{exactDate}</span>
                                                            </div>
                                                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                                                isFeed ? "bg-theme/10 text-theme" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                            }`}>
                                                                {isFeed ? `文章 #${item.id}` : "岁月记事"}
                                                            </span>
                                                        </div>

                                                        {/* Article / Moment Title With Inline Arrow */}
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h2 className="text-sm font-bold text-[rgb(var(--rin-ink-rgb))] group-hover:text-theme transition-colors line-clamp-2 leading-snug flex-1">
                                                                {item.title || (isFeed ? t("unlisted") : "生活随笔记录")}
                                                            </h2>
                                                            <span className="text-[rgb(var(--rin-ink-muted-rgb))] group-hover:text-theme group-hover:translate-x-1 transition-all shrink-0 text-base font-bold leading-snug">
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
