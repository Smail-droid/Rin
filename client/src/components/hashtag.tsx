import React, { useState } from "react";
import { useLocation } from "wouter";
import { client } from "../app/runtime";

export interface TagColorMeta {
  id: string;
  name: string;
  iconColor: string;
  textColor: string;
  bgLight: string;
  badgeClass: string;
  dotClass: string;
}

/** 8 套高辨识度、纯净柔和的彩色标签调色盘 (完美契合 Apple Finder / 现代化笔记系统) */
export const TAG_COLOR_PALETTES: TagColorMeta[] = [
  {
    id: "blue",
    name: "深海群青",
    iconColor: "#0284c7",
    textColor: "text-sky-700 dark:text-sky-300",
    bgLight: "bg-sky-500/10 border-sky-500/20 dark:bg-sky-500/15 dark:border-sky-400/25",
    badgeClass: "bg-sky-500/[0.08] text-sky-700 border-sky-400/25 hover:border-sky-400/50 hover:bg-sky-500/15 dark:bg-sky-400/[0.12] dark:text-sky-300 dark:border-sky-400/30",
    dotClass: "bg-sky-500",
  },
  {
    id: "orange",
    name: "落日暖橙",
    iconColor: "#ea580c",
    textColor: "text-orange-700 dark:text-orange-300",
    bgLight: "bg-orange-500/10 border-orange-500/20 dark:bg-orange-500/15 dark:border-orange-400/25",
    badgeClass: "bg-orange-500/[0.08] text-orange-700 border-orange-400/25 hover:border-orange-400/50 hover:bg-orange-500/15 dark:bg-orange-400/[0.12] dark:text-orange-300 dark:border-orange-400/30",
    dotClass: "bg-orange-500",
  },
  {
    id: "amber",
    name: "晨曦亮金",
    iconColor: "#d97706",
    textColor: "text-amber-700 dark:text-amber-300",
    bgLight: "bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/15 dark:border-amber-400/25",
    badgeClass: "bg-amber-500/[0.08] text-amber-700 border-amber-400/25 hover:border-amber-400/50 hover:bg-amber-500/15 dark:bg-amber-400/[0.12] dark:text-amber-300 dark:border-amber-400/30",
    dotClass: "bg-amber-500",
  },
  {
    id: "emerald",
    name: "薄荷翠绿",
    iconColor: "#16a34a",
    textColor: "text-emerald-700 dark:text-emerald-300",
    bgLight: "bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-500/15 dark:border-emerald-400/25",
    badgeClass: "bg-emerald-500/[0.08] text-emerald-700 border-emerald-400/25 hover:border-emerald-400/50 hover:bg-emerald-500/15 dark:bg-emerald-400/[0.12] dark:text-emerald-300 dark:border-emerald-400/30",
    dotClass: "bg-emerald-500",
  },
  {
    id: "purple",
    name: "薰衣草紫",
    iconColor: "#9333ea",
    textColor: "text-purple-700 dark:text-purple-300",
    bgLight: "bg-purple-500/10 border-purple-500/20 dark:bg-purple-500/15 dark:border-purple-400/25",
    badgeClass: "bg-purple-500/[0.08] text-purple-700 border-purple-400/25 hover:border-purple-400/50 hover:bg-purple-500/15 dark:bg-purple-400/[0.12] dark:text-purple-300 dark:border-purple-400/30",
    dotClass: "bg-purple-500",
  },
  {
    id: "rose",
    name: "蔷薇樱粉",
    iconColor: "#e11d48",
    textColor: "text-rose-700 dark:text-rose-300",
    bgLight: "bg-rose-500/10 border-rose-500/20 dark:bg-rose-500/15 dark:border-rose-400/25",
    badgeClass: "bg-rose-500/[0.08] text-rose-700 border-rose-400/25 hover:border-rose-400/50 hover:bg-rose-500/15 dark:bg-rose-400/[0.12] dark:text-rose-300 dark:border-rose-400/30",
    dotClass: "bg-rose-500",
  },
  {
    id: "cyan",
    name: "青空湖蓝",
    iconColor: "#0891b2",
    textColor: "text-cyan-700 dark:text-cyan-300",
    bgLight: "bg-cyan-500/10 border-cyan-500/20 dark:bg-cyan-500/15 dark:border-cyan-400/25",
    badgeClass: "bg-cyan-500/[0.08] text-cyan-700 border-cyan-400/25 hover:border-cyan-400/50 hover:bg-cyan-500/15 dark:bg-cyan-400/[0.12] dark:text-cyan-300 dark:border-cyan-400/30",
    dotClass: "bg-cyan-500",
  },
  {
    id: "indigo",
    name: "星夜靛蓝",
    iconColor: "#4f46e5",
    textColor: "text-indigo-700 dark:text-indigo-300",
    bgLight: "bg-indigo-500/10 border-indigo-500/20 dark:bg-indigo-500/15 dark:border-indigo-400/25",
    badgeClass: "bg-indigo-500/[0.08] text-indigo-700 border-indigo-400/25 hover:border-indigo-400/50 hover:bg-indigo-500/15 dark:bg-indigo-400/[0.12] dark:text-indigo-300 dark:border-indigo-400/30",
    dotClass: "bg-indigo-500",
  },
];

/** 确定性字符串哈希：同一标签在全站任何视口下保持完全一致的色彩映射 */
export function getTagColorTheme(name: string): TagColorMeta {
  if (!name) return TAG_COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TAG_COLOR_PALETTES.length;
  return TAG_COLOR_PALETTES[index];
}

/**
 * 🏷️ 苹果 Finder / 现代笔记同款彩色实心倾斜标签图标
 */
export function SolidTagIcon({
  color,
  className = "w-3.5 h-3.5 shrink-0",
}: {
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={color || "currentColor"}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: color ? `drop-shadow(0 1px 2px ${color}35)` : undefined,
      }}
    >
      <path d="M10.9 2.1c-.6-.6-1.4-.9-2.2-.9H3.5C2.1 1.2 1 2.3 1 3.7v5.2c0 .8.3 1.6.9 2.2l9.8 9.8c1.2 1.2 3.2 1.2 4.4 0l6-6c1.2-1.2 1.2-3.2 0-4.4L10.9 2.1zM5.5 7C4.7 7 4 6.3 4 5.5S4.7 4 5.5 4 7 4.7 7 5.5 6.3 7 5.5 7z" />
    </svg>
  );
}

interface HashTagProps {
  name: string;
  currentFeedId?: number | string;
  className?: string;
  colorClass?: string;
  showIcon?: boolean;
}

/**
 * 🌸 现代彩色灵感标签 (Finder / Modern Notes Styled Topic Tag)
 * - 左侧内嵌彩色实心倾斜标签小图标 (Finder 质感)
 * - 纯净圆润极简胶囊美学（rounded-full、自适应对应温润浅色底与细微边界）
 * - 属性：
 *   - 单篇独家标签 -> 点击直接直达文章正文
 *   - 多篇标签 -> 点击进入标签星云聚合列表
 */
export function HashTag({
  name,
  currentFeedId,
  className = "",
  colorClass = "",
  showIcon = true,
}: HashTagProps) {
  const [, setLocation] = useLocation();
  const theme = getTagColorTheme(name);

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

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 select-none cursor-pointer group/tag hover:scale-105 active:scale-95 shadow-2xs ${
        colorClass || theme.badgeClass
      } ${className}`}
      title={`查看「${name}」标签所有随想`}
    >
      {showIcon && <SolidTagIcon color={theme.iconColor} className="w-3.5 h-3.5" />}
      <span className="tracking-tight">{name}</span>
    </button>
  );
}

/**
 * 🏷️ 功能性按钮标签 (Functional Action Tag Capsule)
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
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-neutral-200/80 dark:border-white/10 hover:border-theme/40 bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 hover:text-theme transition select-none cursor-pointer ${className}`}
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
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-neutral-200/80 dark:border-white/10 hover:border-theme/40 bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 hover:text-theme transition select-none cursor-pointer ${className}`}
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
  const enabledActions = (() => {
    try {
      const saved = localStorage.getItem("rin_feed_tag_actions");
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return [];
  })();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {tags.map(({ name }, index) => (
        <HashTag key={index} name={name} currentFeedId={currentFeedId} />
      ))}

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
