import { useContext, useEffect, useMemo, useState } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { Waiting } from "../components/loading";
import { useConfirm } from "../components/dialog";
import { client } from "../app/runtime";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";

type Hashtag = {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    feeds: number;
    singleFeedId?: number | null;
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
    const profile = useContext(ProfileContext);
    const [, setLocation] = useLocation();
    const { showConfirm, ConfirmUI } = useConfirm();

    const [hashtags, setHashtags] = useState<Hashtag[]>();
    const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
    const [showEmptyTags, setShowEmptyTags] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [isWandering, setIsWandering] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const [feedTagActions, setFeedTagActions] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem("rin_feed_tag_actions");
            if (saved) return JSON.parse(saved);
        } catch {}
        return ["prev", "next", "random"];
    });

    const toggleTagAction = (action: string) => {
        const next = feedTagActions.includes(action)
            ? feedTagActions.filter((a) => a !== action)
            : [...feedTagActions, action];
        setFeedTagActions(next);
        try {
            localStorage.setItem("rin_feed_tag_actions", JSON.stringify(next));
        } catch {}
        showToast("✓ 文章页附加按钮标签配置已保存！");
    };

    const loadTags = async () => {
        try {
            const { data } = await client.tag.list();
            if (data) {
                setHashtags(data as any);
            }
        } catch {}
    };

    useEffect(() => {
        void loadTags();
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(""), 3500);
    };

    // 统计无文章关联的空孤儿标签数量
    const unlinkedCount = useMemo(() => {
        return hashtags?.filter((h) => (h.feeds || 0) === 0).length || 0;
    }, [hashtags]);

    // 一键清理所有无文章关联的空孤儿标签
    const handleCleanUnlinkedTags = () => {
        if (!unlinkedCount) return;
        showConfirm(
            `确认一键清理 ${unlinkedCount} 个空标签吗？`,
            "该操作将从数据库中安全删除未关联任何文章的孤儿标签，关联有文章的标签不受影响。",
            async () => {
                setIsCleaning(true);
                try {
                    const res = await client.tag.deleteUnlinked();
                    if (res.data?.success) {
                        showToast(`✓ 成功清理 ${res.data.count} 个无文章孤儿标签！`);
                    } else {
                        showToast("✓ 清理完成");
                    }
                    await loadTags();
                } catch (err: any) {
                    showToast("清理失败: " + (err?.message || "未知错误"));
                } finally {
                    setIsCleaning(false);
                }
            }
        );
    };

    // 单个删除空标签
    const handleDeleteSingleTag = (id: number, name: string) => {
        showConfirm(
            `删除标签 #${name} 吗？`,
            "该标签当前未关联任何文章，删除后可保持标签星云整洁。",
            async () => {
                try {
                    await client.tag.delete(id);
                    showToast(`✓ 已删除标签 #${name}`);
                    await loadTags();
                } catch {}
            }
        );
    };

    // 全站随机漫游换一篇
    const handleRandomHop = async () => {
        if (isWandering) return;
        setIsWandering(true);
        try {
            const res = await fetch("/api/feed/random");
            if (res.ok) {
                const data = await res.json();
                if (data.feed?.url || data.feed?.id) {
                    setLocation(data.feed.url || `/feed/${data.feed.id}`);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                }
            }
            showToast("暂未找到可漫游的文章");
        } catch {
            showToast("漫游请求失败");
        } finally {
            setIsWandering(false);
        }
    };

    // 过滤与排序
    const sortedHashtags = useMemo(() => {
        if (!hashtags) return [];
        let list = [...hashtags];
        if (!showEmptyTags) {
            list = list.filter(({ feeds }) => feeds > 0);
        }
        return list.sort((a, b) => {
            if (sortBy === 'popular') {
                if (b.feeds !== a.feeds) {
                    return b.feeds - a.feeds;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });
    }, [hashtags, showEmptyTags, sortBy]);

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
            <ConfirmUI />

            {/* Toast 提示条 */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-900 border border-theme/30 backdrop-blur-md shadow-2xl text-xs font-bold ani-show flex items-center gap-2">
                    <i className="ri-checkbox-circle-fill text-theme" />
                    <span>{toastMessage}</span>
                </div>
            )}

            <Waiting for={hashtags}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    {/* 顶栏信息与排序 */}
                    <div className="wauto text-start py-4 border-b border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-bold mb-2">
                                <i className="ri-price-tag-3-line" />
                                <span>灵感星云</span>
                            </div>
                            <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight art-title-${siteConfig.hashtagsTitleStyle || siteConfig.atelierTitleStyle || "aurora_flow"}`}>
                                {t('hashtags')}
                            </h1>
                            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span>{t('total_tags', { count: sortedHashtags?.length || 0 })}</span>
                                {unlinkedCount > 0 && (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-mono font-medium">
                                        含 {unlinkedCount} 个空标签
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                            {/* 排序器 */}
                            <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs shadow-2xs">
                                <button
                                    onClick={() => setSortBy('latest')}
                                    className={`rounded-full px-3.5 py-1.5 transition select-none cursor-pointer ${
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
                                    className={`rounded-full px-3.5 py-1.5 transition select-none cursor-pointer ${
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

                    {/* 管理员专属：前台快捷管理控制台 */}
                    {profile?.permission && (
                        <div className="wauto mt-4 p-3.5 rounded-2xl bg-theme/5 border border-theme/15 flex flex-col gap-3 text-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 text-theme font-medium">
                                    <i className="ri-shield-user-line text-sm" />
                                    <span>站长管理视角：共 {hashtags?.length || 0} 个标签 (其中 {unlinkedCount} 个空标签)</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => setShowEmptyTags((prev) => !prev)}
                                        className={`px-2.5 py-1 rounded-xl font-medium border transition cursor-pointer select-none ${
                                            showEmptyTags
                                                ? "bg-theme text-white border-theme shadow-2xs font-bold"
                                                : "bg-white dark:bg-neutral-800 border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-theme"
                                        }`}
                                    >
                                        <i className="ri-eye-line mr-1" />
                                        <span>{showEmptyTags ? "已显示空标签" : "透出0篇空标签"}</span>
                                    </button>

                                    {unlinkedCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleCleanUnlinkedTags}
                                            disabled={isCleaning}
                                            className="px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                            title="一键彻底清理未关联任何文章的孤儿标签"
                                        >
                                            <i className={`ri-delete-bin-line ${isCleaning ? "animate-spin" : ""}`} />
                                            <span>{isCleaning ? "正在清理..." : `🧹 清理空标签 (${unlinkedCount})`}</span>
                                        </button>
                                    )}

                                    <Link
                                        href="/admin/tags"
                                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:text-theme hover:border-theme font-medium transition"
                                    >
                                        <span>⚙️ 标签深度管理 ➔</span>
                                    </Link>
                                </div>
                            </div>

                            {/* 附加功能性按钮标签管理 */}
                            <div className="pt-2.5 border-t border-theme/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                                    文章正文标签栏附加功能按钮：
                                </span>
                                <div className="flex items-center gap-3.5 flex-wrap">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-theme transition">
                                        <input
                                            type="checkbox"
                                            checked={feedTagActions.includes("prev")}
                                            onChange={() => toggleTagAction("prev")}
                                            className="accent-theme cursor-pointer"
                                        />
                                        <span>上一篇 (⏮)</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-theme transition">
                                        <input
                                            type="checkbox"
                                            checked={feedTagActions.includes("next")}
                                            onChange={() => toggleTagAction("next")}
                                            className="accent-theme cursor-pointer"
                                        />
                                        <span>下一篇 (⏭)</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-theme transition">
                                        <input
                                            type="checkbox"
                                            checked={feedTagActions.includes("random")}
                                            onChange={() => toggleTagAction("random")}
                                            className="accent-theme cursor-pointer"
                                        />
                                        <span>随机换篇 (🎲)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 功能性动作标签与便签墙前导菜单 (Functional Action Capsules) */}
                    <div className="wauto flex items-center gap-2.5 mt-6 mb-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleRandomHop}
                            disabled={isWandering}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-theme to-purple-600 text-white font-bold text-xs shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer disabled:opacity-50"
                            title="全站随机漫游换一篇随想阅读"
                        >
                            <i className={`ri-shuffle-line ${isWandering ? "animate-spin" : ""}`} />
                            <span>{isWandering ? "漫游中..." : "🎲 全站随机换一篇"}</span>
                        </button>
                        <span className="text-[11px] text-neutral-400 font-sans">
                            💡 单篇独家标签点击将<strong>直接送入正文</strong>，多篇标签点击进入聚合星云
                        </span>
                    </div>

                    {/* Organic Scattered Gallery Tag Notes Wall (二次元彩色散落便签墙) */}
                    <div className="wauto flex flex-wrap items-center justify-start gap-3 sm:gap-4 mt-4 pb-12">
                        {sortedHashtags?.map((hashtag, index) => {
                            const rot = TAG_ROTATIONS[index % TAG_ROTATIONS.length];
                            const isSingleArticle = hashtag.feeds === 1 && Boolean(hashtag.singleFeedId);
                            const isEmptyTag = (hashtag.feeds || 0) === 0;

                            const colorScheme = isEmptyTag
                                ? "bg-neutral-100/80 text-neutral-400 border-dashed border-neutral-300 dark:bg-neutral-800/40 dark:text-neutral-500 dark:border-neutral-700/50"
                                : TAG_COLOR_SCHEMES[index % TAG_COLOR_SCHEMES.length];

                            // 单篇标签直达文章 / 多篇进入列表聚合
                            const targetHref = isSingleArticle
                                ? `/feed/${hashtag.singleFeedId}`
                                : `/hashtag/${encodeURIComponent(hashtag.name)}`;

                            const tooltip = isSingleArticle
                                ? `包含 1 篇独家随想，点击直接直达正文阅读！`
                                : isEmptyTag
                                ? `当前未关联任何文章 (0篇)`
                                : `包含 ${hashtag.feeds} 篇随想，点击查看星云列表`;

                            return (
                                <div
                                    key={hashtag.id || index}
                                    className={`group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border shadow-2xs text-xs sm:text-sm font-semibold transform ${rot} hover:rotate-0 hover:scale-110 hover:shadow-lg transition-all duration-300 select-none ${colorScheme}`}
                                >
                                    <Link
                                        href={targetHref}
                                        className="inline-flex items-center gap-1.5 cursor-pointer"
                                        title={tooltip}
                                    >
                                        <span className="opacity-70 text-xs">
                                            {isSingleArticle ? "📖" : isEmptyTag ? "⚪" : "🏷️"}
                                        </span>
                                        <span className="font-bold">#{hashtag.name}</span>

                                        {/* 单篇直接直达徽章 / 多篇数量徽标 */}
                                        {isSingleArticle ? (
                                            <span className="ml-0.5 rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-mono font-bold flex items-center gap-0.5 text-theme">
                                                <span>直达</span>
                                                <i className="ri-arrow-right-up-line text-[10px]" />
                                            </span>
                                        ) : (
                                            <span className="ml-0.5 rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-mono">
                                                {hashtag.feeds}
                                            </span>
                                        )}
                                    </Link>

                                    {/* 管理员模式下针对空标签的单项删除快捷叉 */}
                                    {profile?.permission && isEmptyTag && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleDeleteSingleTag(hashtag.id, hashtag.name);
                                            }}
                                            className="text-neutral-400 hover:text-rose-500 p-0.5 ml-1 transition cursor-pointer"
                                            title={`删除空标签 #${hashtag.name}`}
                                        >
                                            <i className="ri-close-line text-xs" />
                                        </button>
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
