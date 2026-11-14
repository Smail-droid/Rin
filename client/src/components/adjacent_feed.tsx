import type { AdjacentFeed, AdjacentFeedResponse } from "@rin/api";
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { client } from "../app/runtime";
import { timeago } from "../utils/timeago";

interface AdjacentSectionProps {
  id: string;
  setError?: (error: string) => void;
}

/**
 * 文章正文文末：纯净双翼章节导航 (上一篇 & 下一篇)
 * 专司章节自然前后承接，杜绝在文末冗余堆砌推荐卡片与底部冲突
 */
export function AdjacentSection({ id, setError }: AdjacentSectionProps) {
  const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeedResponse>();

  useEffect(() => {
    client.feed
      .adjacent(id)
      .then(({ data, error }) => {
        if (error && setError) {
          setError(typeof error === "string" ? error : (error.value as string));
        } else if (data && typeof data !== "string") {
          setAdjacentFeeds(data);
        }
      })
      .catch(() => {});
  }, [id, setError]);

  return (
    <section aria-label="前后章节导航" className="mt-8 mb-6 ani-show">
      <div className="rounded-3xl bg-w grid grid-cols-1 sm:grid-cols-2 border border-black/5 dark:border-white/5 overflow-hidden shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-black/5 dark:divide-white/5">
        <AdjacentCard data={adjacentFeeds?.previousFeed} type="previous" />
        <AdjacentCard data={adjacentFeeds?.nextFeed} type="next" />
      </div>
    </section>
  );
}

export function AdjacentCard({
  data,
  type,
}: {
  data: AdjacentFeed | null | undefined;
  type: "previous" | "next";
}) {
  const isPrev = type === "previous";
  const direction = isPrev ? "text-start" : "text-end";
  const { t } = useTranslation();

  if (!data) {
    return (
      <div className={`w-full p-5 sm:p-6 duration-300 opacity-40 select-none ${direction}`}>
        <p className={`text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5 ${isPrev ? "justify-start" : "justify-end"}`}>
          {isPrev && <i className="ri-arrow-left-s-line text-sm" />}
          <span>{isPrev ? "前一章节 · 上一篇" : "后一章节 · 下一篇"}</span>
          {!isPrev && <i className="ri-arrow-right-s-line text-sm" />}
        </p>
        <p className="text-sm font-semibold t-primary mt-2">{t("no_more")}</p>
      </div>
    );
  }

  return (
    <Link
      href={`/feed/${data.id}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`group w-full p-5 sm:p-6 transition-all duration-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${direction}`}
    >
      <p
        className={`text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5 group-hover:text-theme transition ${
          isPrev ? "justify-start" : "justify-end"
        }`}
      >
        {isPrev && <i className="ri-arrow-left-s-line text-sm transition-transform group-hover:-translate-x-1" />}
        <span>{isPrev ? "前一章节 · 上一篇" : "后一章节 · 下一篇"}</span>
        {!isPrev && <i className="ri-arrow-right-s-line text-sm transition-transform group-hover:translate-x-1" />}
      </p>
      <h3 className="mt-2 text-base font-extrabold t-primary group-hover:text-theme transition truncate">
        {data.title}
      </h3>
      <div className={`flex items-center gap-2 mt-1 text-[11px] text-neutral-400 ${isPrev ? "justify-start" : "justify-end"}`}>
        <span>
          {data.createdAt === data.updatedAt
            ? timeago(data.createdAt)
            : t("feed_card.published$time", { time: timeago(data.createdAt) })}
        </span>
        {data.hashtags && data.hashtags.length > 0 && (
          <span className="text-[10px] text-theme font-medium">
            #{data.hashtags[0].name}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * 右侧侧边栏：文章漫游中枢 (停靠在标签漫游正下方)
 * 1. 显示这篇文章的上下文几篇 (开头显示后几篇，末尾显示前几篇，居中高亮标记当前正在阅读)
 * 2. 具备像播放器切歌一样的随机打乱刷新按钮与随机切篇按钮
 */
export function ArticleRoamSidebar({
  id,
}: {
  id: string;
  currentFeed?: any;
}) {
  const [, setLocation] = useLocation();
  const [feedsPool, setFeedsPool] = useState<any[]>([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledList, setShuffledList] = useState<any[]>([]);
  const [spinDegree, setSpinDegree] = useState(0);

  useEffect(() => {
    client.feed
      .list({ limit: 60, page: 1 })
      .then(({ data }) => {
        if (data?.data && Array.isArray(data.data)) {
          setFeedsPool(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // 计算上下文文章窗口 (若在开头显示后几篇，若在结尾显示前几篇，居中居中呈现)
  const contextualArticles = useMemo(() => {
    if (!feedsPool.length) return [];
    if (isShuffled && shuffledList.length > 0) {
      return shuffledList.slice(0, 5);
    }

    const currentIdStr = String(id);
    const currentIndex = feedsPool.findIndex(
      (f) => String(f.id) === currentIdStr || String(f.alias) === currentIdStr
    );

    const N = feedsPool.length;
    if (currentIndex === -1) {
      return feedsPool.slice(0, 5);
    }

    let start = 0;
    let end = 5;

    if (currentIndex <= 1) {
      // 处于开头篇目：向后顺延几篇
      start = 0;
      end = Math.min(N, 5);
    } else if (currentIndex >= N - 2) {
      // 处于末尾篇目：向前倒推几篇
      start = Math.max(0, N - 5);
      end = N;
    } else {
      // 处于中间链路：前后各展开 2 篇形成上下文
      start = Math.max(0, currentIndex - 2);
      end = Math.min(N, currentIndex + 3);
    }

    return feedsPool.slice(start, end);
  }, [feedsPool, id, isShuffled, shuffledList]);

  // 像播放器切歌一样的随机打乱排序按钮
  const handleShuffleToggle = () => {
    setSpinDegree((prev) => prev + 180);

    const currentIdStr = String(id);
    const pool = feedsPool.filter(
      (f) => String(f.id) !== currentIdStr && String(f.alias) !== currentIdStr
    );
    // Fisher-Yates 伪随机打乱重排
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setShuffledList(shuffled);
    setIsShuffled(true);
  };

  // 重置回时间上下文顺序
  const handleResetSequential = () => {
    setIsShuffled(false);
  };

  // 随机切跃到任意一篇文章 (类似播放器 Next Random Track)
  const handleRandomJump = () => {
    if (!feedsPool.length) return;
    const currentIdStr = String(id);
    const pool = feedsPool.filter(
      (f) => String(f.id) !== currentIdStr && String(f.alias) !== currentIdStr
    );
    const targetPool = pool.length > 0 ? pool : feedsPool;
    const target = targetPool[Math.floor(Math.random() * targetPool.length)];
    if (target) {
      setLocation(`/feed/${target.id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (feedsPool.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white/75 dark:bg-neutral-900/75 backdrop-blur-md shadow-2xs space-y-2.5 ani-show font-sans">
      {/* 顶部标题与播放器风格操作栏 */}
      <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-1.5 text-xs font-bold t-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-theme shrink-0" />
          <span>文章漫游</span>
          <span className="text-[10px] font-normal text-neutral-400">
            {isShuffled ? "· 随机发现" : "· 上下文"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isShuffled && (
            <button
              type="button"
              onClick={handleResetSequential}
              className="px-1.5 py-0.5 rounded text-[10px] text-neutral-400 hover:text-theme transition"
              title="恢复按文章时间上下文顺序排列"
            >
              顺序
            </button>
          )}

          {/* 类似播放器切歌随机打乱按钮 */}
          <button
            type="button"
            onClick={handleShuffleToggle}
            className={`p-1 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer select-none ${
              isShuffled
                ? "bg-theme/10 text-theme font-bold"
                : "text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            title="像播放器切歌一样随机刷新排序"
          >
            <i
              className="ri-shuffle-line transition-transform duration-500"
              style={{ transform: `rotate(${spinDegree}deg)` }}
            />
            <span className="text-[11px] font-bold">{isShuffled ? "换一批" : "打乱"}</span>
          </button>

          {/* 随机切跃一篇 */}
          <button
            type="button"
            onClick={handleRandomJump}
            className="p-1 rounded-lg text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5 text-xs transition cursor-pointer select-none"
            title="随机跳跃到全站任意一篇文章"
          >
            <i className="ri-dice-line text-sm" />
          </button>
        </div>
      </div>

      {/* 上下文列表 */}
      <div className="space-y-1">
        {contextualArticles.map((article, idx) => {
          const isCurrent = String(article.id) === String(id) || String(article.alias) === String(id);
          const firstTag = article.hashtags && article.hashtags.length > 0 ? article.hashtags[0].name : null;

          return (
            <Link
              key={article.id || idx}
              href={`/feed/${article.id}`}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className={`group flex items-start justify-between gap-2 p-2 rounded-xl transition text-xs select-none block ${
                isCurrent
                  ? "bg-theme/10 text-theme font-bold border-l-2 border-theme"
                  : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-neutral-600 dark:text-neutral-300"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-theme shrink-0 animate-pulse" />
                  )}
                  <span className="truncate leading-snug group-hover:text-theme transition" title={article.title}>
                    {article.title || "无标题随想"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                  <span className="font-mono">{timeago(article.createdAt)}</span>
                  {firstTag && (
                    <span className="text-theme opacity-80">#{firstTag}</span>
                  )}
                  {isCurrent && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-theme/15 text-theme font-bold">
                      正在阅读
                    </span>
                  )}
                </div>
              </div>

              {!isCurrent && (
                <i className="ri-arrow-right-s-line text-neutral-300 dark:text-neutral-600 group-hover:text-theme group-hover:translate-x-0.5 transition-transform text-xs shrink-0 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
