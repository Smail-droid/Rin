import React, { useState } from "react";
import { useLocation } from "wouter";
import { client } from "../app/runtime";

interface HashTagProps {
  name: string;
  currentFeedId?: number | string;
  className?: string;
  colorClass?: string;
}

/**
 * 🌸 纯净文章灵感标签 (Pure Topic Tag Capsule)
 * 纯粹圆润极简胶囊美学（rounded-full、柔和边框与微光悬浮）
 * 彻底消除每个标签后面突兀的重复洗牌图标，保持视觉干净统一
 * 属性：
 *  - 单篇独家标签 -> 点击直接直达文章正文
 *  - 多篇标签 -> 点击进入标签星云聚合列表
 */
export function HashTag({
  name,
  currentFeedId,
  className = "",
  colorClass = "",
}: HashTagProps) {
  const [, setLocation] = useLocation();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await client.tag.get(name);
      if (res.data?.feeds && res.data.feeds.length === 1) {
        const targetFeed = res.data.feeds[0];
        if (String(targetFeed.id) !== String(currentFeedId)) {
          setLocation(`/feed/${targetFeed.id}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
    } catch {}
    setLocation(`/hashtag/${encodeURIComponent(name)}`);
  };

  const defaultStyle = "border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]";

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold group/tag hover:border-theme/40 hover:bg-theme/5 transition select-none ${
        colorClass || defaultStyle
      } ${className}`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="text-neutral-600 dark:text-neutral-300 hover:text-theme group-hover/tag:text-theme transition cursor-pointer"
        title={`查看 #${name} 标签 (单篇独家标签点击将直达正文)`}
      >
        #{name}
      </button>
    </span>
  );
}

/**
 * 🏷️ 功能性按钮标签 (Functional Action Tag Capsule)
 * 与常规文章标签共享相同规格与圆润质感，但作为功能性导航菜单运作
 */
export function ActionTag({
  type,
  targetFeedId,
  currentFeedId,
  title,
  className = "",
}: {
  type: "prev" | "next" | "random";
  targetFeedId?: number | string;
  currentFeedId?: number | string;
  title?: string;
  className?: string;
}) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // 随机换一篇
  const handleRandom = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/feed/random?exclude=${currentFeedId || ""}`);
      if (res.ok) {
        const data = await res.json();
        if (data.feed?.url || data.feed?.id) {
          setLocation(data.feed.url || `/feed/${data.feed.id}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  if (type === "prev" && targetFeedId) {
    return (
      <button
        type="button"
        onClick={() => {
          setLocation(`/feed/${targetFeedId}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-black/10 dark:border-white/10 hover:border-theme/40 bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 hover:text-theme transition select-none cursor-pointer ${className}`}
        title={`上一篇: ${title || ""}`}
      >
        <i className="ri-arrow-left-s-line text-xs" />
        <span>上一篇</span>
      </button>
    );
  }

  if (type === "next" && targetFeedId) {
    return (
      <button
        type="button"
        onClick={() => {
          setLocation(`/feed/${targetFeedId}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-black/10 dark:border-white/10 hover:border-theme/40 bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 hover:text-theme transition select-none cursor-pointer ${className}`}
        title={`下一篇: ${title || ""}`}
      >
        <span>下一篇</span>
        <i className="ri-arrow-right-s-line text-xs" />
      </button>
    );
  }

  if (type === "random") {
    return (
      <button
        type="button"
        onClick={handleRandom}
        disabled={isLoading}
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-theme/20 bg-theme/5 hover:bg-theme/15 text-theme transition select-none cursor-pointer disabled:opacity-50 ${className}`}
        title="全站随机换一篇随想漫游"
      >
        <i className={`ri-shuffle-line text-xs ${isLoading ? "animate-spin" : ""}`} />
        <span>{isLoading ? "漫游中..." : "换一篇"}</span>
      </button>
    );
  }

  return null;
}

/**
 * 🏷️ 文章标签与功能动作组合栏 (Article Tag & Action Bar)
 * 优雅融合常规标签与可配置的附加功能按钮标签（上一篇、下一篇、换一篇）
 */
export function ArticleTagBar({
  tags,
  currentFeedId,
  previousFeed,
  nextFeed,
  className = "",
}: {
  tags: Array<{ name: string }>;
  currentFeedId?: number | string;
  previousFeed?: { id: number | string; title?: string } | null;
  nextFeed?: { id: number | string; title?: string } | null;
  className?: string;
}) {
  // 从本地配置获取允许附加的功能动作标签 (默认全开: prev, next, random)
  const enabledActions = (() => {
    try {
      const saved = localStorage.getItem("rin_feed_tag_actions");
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return ["prev", "next", "random"];
  })();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* 1. 常规文章主题标签（极简纯粹，无突兀洗牌按钮） */}
      {tags.map(({ name }, index) => (
        <HashTag key={index} name={name} currentFeedId={currentFeedId} />
      ))}

      {/* 2. 可配置附加的功能性按钮标签（与标签同规格微光圆润胶囊） */}
      {enabledActions.includes("prev") && previousFeed && (
        <ActionTag
          type="prev"
          targetFeedId={previousFeed.id}
          title={previousFeed.title}
        />
      )}
      {enabledActions.includes("next") && nextFeed && (
        <ActionTag
          type="next"
          targetFeedId={nextFeed.id}
          title={nextFeed.title}
        />
      )}
      {enabledActions.includes("random") && (
        <ActionTag
          type="random"
          currentFeedId={currentFeedId}
        />
      )}
    </div>
  );
}
