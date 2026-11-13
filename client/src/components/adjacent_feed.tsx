import type { AdjacentFeed, AdjacentFeedResponse } from "@rin/api";
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { client } from "../app/runtime";
import { timeago } from "../utils/timeago";
import { stripImageUrlMetadata } from "../utils/image-upload";

// 精雕日系二次元微光手绘矢量 SVG 小书本
function KawaiiBookSvg({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: "drop-shadow(0 2px 6px rgba(255, 126, 149, 0.4))",
      }}
    >
      <defs>
        <linearGradient id="roam-book-cover" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4D79" />
          <stop offset="50%" stopColor="#FF7E95" />
          <stop offset="100%" stopColor="#FFA6B7" />
        </linearGradient>
        <linearGradient id="roam-book-pages" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFF2F5" />
        </linearGradient>
        <linearGradient id="roam-book-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d="M3.5 19.5C5.5 18.5 8.5 18.5 12 20.2C15.5 18.5 18.5 18.5 20.5 19.5V5.5C18.5 4.5 15.5 4.5 12 6.2C8.5 4.5 5.5 4.5 3.5 5.5V19.5Z"
        fill="url(#roam-book-cover)"
        stroke="#FF4D79"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 18.5C6.5 17.5 9 17.5 12 19V5.5C9 4 6.5 4 4.5 5V18.5Z"
        fill="url(#roam-book-pages)"
        stroke="#FFD0DA"
        strokeWidth="0.8"
      />
      <path
        d="M19.5 18.5C17.5 17.5 15 17.5 12 19V5.5C15 4 17.5 4 19.5 5V18.5Z"
        fill="url(#roam-book-pages)"
        stroke="#FFD0DA"
        strokeWidth="0.8"
      />
      <path d="M11 5V12L12 11L13 12V5H11Z" fill="url(#roam-book-ribbon)" />
      <circle cx="6.5" cy="8.5" r="0.75" fill="#FFFFFF" opacity="0.9" />
      <circle cx="17.5" cy="8.5" r="0.75" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

function extractFirstImage(content?: string): string | undefined {
  if (!content) return undefined;
  const match = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/.exec(content);
  if (!match) return undefined;
  return stripImageUrlMetadata(match[1]);
}

interface AdjacentSectionProps {
  id: string;
  currentFeed?: any;
  setError?: (error: string) => void;
}

export function AdjacentSection({ id, currentFeed, setError }: AdjacentSectionProps) {
  const [, setLocation] = useLocation();
  const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeedResponse>();
  const [feedsPool, setFeedsPool] = useState<any[]>([]);

  // 1. 获取前后相邻章节
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

  // 2. 加载全站公开随想池（供随机漫游与智能关联推荐）
  useEffect(() => {
    client.feed
      .list({ limit: 40, page: 1 })
      .then(({ data }) => {
        if (data?.data && Array.isArray(data.data)) {
          setFeedsPool(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // 3. 随机漫游跳文章
  const handleRandomRoam = () => {
    if (!feedsPool.length) return;
    const candidates = feedsPool.filter(
      (f) => String(f.id) !== String(id) && String(f.alias) !== String(id)
    );
    const pool = candidates.length > 0 ? candidates : feedsPool;
    const target = pool[Math.floor(Math.random() * pool.length)];
    if (target) {
      setLocation(`/feed/${target.id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // 4. 计算智能关联推荐文章列表（优先匹配相同标签，其次推荐最新随想，排除当前篇与前后篇）
  const relatedFeeds = useMemo(() => {
    if (!feedsPool.length) return [];

    const prevId = adjacentFeeds?.previousFeed?.id ? String(adjacentFeeds.previousFeed.id) : null;
    const nextId = adjacentFeeds?.nextFeed?.id ? String(adjacentFeeds.nextFeed.id) : null;
    const currentIdStr = String(id);

    // 过滤掉当前文章以及已在前后章节中出现的文章（避免卡片内容重复）
    const candidates = feedsPool.filter((f) => {
      const fid = String(f.id);
      const falias = String(f.alias || "");
      if (fid === currentIdStr || falias === currentIdStr) return false;
      if (prevId && fid === prevId) return false;
      if (nextId && fid === nextId) return false;
      return true;
    });

    // 提取当前文章的标签集合
    const currentTags = new Set<string>();
    if (currentFeed?.hashtags && Array.isArray(currentFeed.hashtags)) {
      currentFeed.hashtags.forEach((h: any) => {
        const name = typeof h === "string" ? h : h?.name;
        if (name) currentTags.add(name.toLowerCase());
      });
    }

    // 相关度打分排序
    const scored = candidates.map((feed) => {
      let score = 0;
      if (feed.hashtags && Array.isArray(feed.hashtags)) {
        feed.hashtags.forEach((h: any) => {
          const name = typeof h === "string" ? h : h?.name;
          if (name && currentTags.has(name.toLowerCase())) {
            score += 10;
          }
        });
      }
      return { feed, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.feed.createdAt).getTime() - new Date(a.feed.createdAt).getTime();
    });

    return scored.slice(0, 3).map((s) => s.feed);
  }, [feedsPool, id, currentFeed, adjacentFeeds]);

  return (
    <section aria-label="文章漫游与推荐导航" className="mt-8 mb-6 space-y-4 ani-show">
      {/* 顶部标题与随机换一篇操作栏 */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <KawaiiBookSvg className="w-5 h-5" />
          <h3 className="font-extrabold text-sm t-primary flex items-center gap-1.5">
            <span>文章漫游</span>
            <span className="text-[11px] font-normal text-neutral-400">· 章节衔接与随想推荐</span>
          </h3>
        </div>

        {/* 随机换一篇按钮 */}
        <button
          type="button"
          onClick={handleRandomRoam}
          className="px-3 py-1 rounded-full border border-theme/25 bg-theme/5 hover:bg-theme hover:text-white text-theme text-xs font-bold transition flex items-center gap-1.5 shadow-2xs group active:scale-95 cursor-pointer"
          title="随机换一篇文章漫游 (如同随机播放)"
        >
          <i className="ri-shuffle-line transition-transform duration-500 group-hover:rotate-180" />
          <span>随机换一篇</span>
        </button>
      </div>

      {/* 1. 前后章节双翼导航 (上一篇 & 下一篇) */}
      <div className="rounded-3xl bg-w grid grid-cols-1 sm:grid-cols-2 border border-black/5 dark:border-white/5 overflow-hidden shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-black/5 dark:divide-white/5">
        <AdjacentCard data={adjacentFeeds?.previousFeed} type="previous" />
        <AdjacentCard data={adjacentFeeds?.nextFeed} type="next" />
      </div>

      {/* 2. 灵感漫游 · 相关推荐文章卡片 (自适应展开，自然融入文章末尾) */}
      {relatedFeeds.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs pb-1.5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-1.5 font-bold t-primary">
              <i className="ri-sparkling-fill text-theme" />
              <span>灵感漫游 · 关联推荐</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono">
              RECOMMENDED ESSAYS
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedFeeds.map((item) => (
              <RelatedArticleCard key={item.id} feed={item} />
            ))}
          </div>
        </div>
      )}
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

function RelatedArticleCard({ feed }: { feed: any }) {
  const coverImage = feed.avatar || extractFirstImage(feed.content);
  const tagList = Array.isArray(feed.hashtags)
    ? feed.hashtags.slice(0, 2).map((h: any) => (typeof h === "string" ? h : h.name))
    : [];

  return (
    <Link
      href={`/feed/${feed.id}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="group relative rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] hover:bg-white dark:hover:bg-neutral-800/80 p-3 flex flex-col justify-between hover:border-theme/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
    >
      <div>
        {coverImage && (
          <div className="w-full h-24 rounded-xl overflow-hidden mb-2.5 bg-neutral-100 dark:bg-neutral-800">
            <img
              src={coverImage}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.parentElement?.remove();
              }}
            />
          </div>
        )}

        <h4 className="font-bold text-xs t-primary group-hover:text-theme transition line-clamp-2 leading-snug">
          {feed.title || "无标题随想"}
        </h4>

        {feed.summary && (
          <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1.5 leading-relaxed">
            {feed.summary}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 text-[10px] text-neutral-400">
        <span className="font-mono">{timeago(feed.createdAt)}</span>
        <div className="flex items-center gap-1">
          {tagList.map((tag: string) => (
            <span
              key={tag}
              className="px-1.5 py-0.2 rounded-md bg-theme/10 text-theme font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
