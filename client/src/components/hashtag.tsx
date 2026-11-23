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

/** 16 套柔和明快、温润水灵的马卡龙多彩调色盘 (Macaron Pastel Palettes) */
export const TAG_COLOR_PALETTES: TagColorMeta[] = [
  {
    id: "sakura-pink",
    name: "樱粉马卡龙",
    iconColor: "#f472b6",
    textColor: "text-pink-600 dark:text-pink-300",
    bgLight: "bg-pink-400/10 border-pink-400/20 dark:bg-pink-400/15 dark:border-pink-300/25",
    badgeClass: "bg-pink-400/[0.08] text-pink-600 border-pink-300/30 hover:border-pink-400/50 hover:bg-pink-400/15 dark:bg-pink-400/[0.12] dark:text-pink-300 dark:border-pink-400/30",
    dotClass: "bg-pink-400",
  },
  {
    id: "sea-salt-blue",
    name: "海盐奶蓝",
    iconColor: "#38bdf8",
    textColor: "text-sky-600 dark:text-sky-300",
    bgLight: "bg-sky-400/10 border-sky-400/20 dark:bg-sky-400/15 dark:border-sky-300/25",
    badgeClass: "bg-sky-400/[0.08] text-sky-600 border-sky-300/30 hover:border-sky-400/50 hover:bg-sky-400/15 dark:bg-sky-400/[0.12] dark:text-sky-300 dark:border-sky-400/30",
    dotClass: "bg-sky-400",
  },
  {
    id: "mint-cream",
    name: "薄荷清乳",
    iconColor: "#34d399",
    textColor: "text-emerald-600 dark:text-emerald-300",
    bgLight: "bg-emerald-400/10 border-emerald-400/20 dark:bg-emerald-400/15 dark:border-emerald-300/25",
    badgeClass: "bg-emerald-400/[0.08] text-emerald-600 border-emerald-300/30 hover:border-emerald-400/50 hover:bg-emerald-400/15 dark:bg-emerald-400/[0.12] dark:text-emerald-300 dark:border-emerald-400/30",
    dotClass: "bg-emerald-400",
  },
  {
    id: "peach-coral",
    name: "蜜桃珊瑚",
    iconColor: "#fb923c",
    textColor: "text-orange-600 dark:text-orange-300",
    bgLight: "bg-orange-400/10 border-orange-400/20 dark:bg-orange-400/15 dark:border-orange-300/25",
    badgeClass: "bg-orange-400/[0.08] text-orange-600 border-orange-300/30 hover:border-orange-400/50 hover:bg-orange-400/15 dark:bg-orange-400/[0.12] dark:text-orange-300 dark:border-orange-400/30",
    dotClass: "bg-orange-400",
  },
  {
    id: "taro-purple",
    name: "香芋奶紫",
    iconColor: "#c084fc",
    textColor: "text-purple-600 dark:text-purple-300",
    bgLight: "bg-purple-400/10 border-purple-400/20 dark:bg-purple-400/15 dark:border-purple-300/25",
    badgeClass: "bg-purple-400/[0.08] text-purple-600 border-purple-300/30 hover:border-purple-400/50 hover:bg-purple-400/15 dark:bg-purple-400/[0.12] dark:text-purple-300 dark:border-purple-400/30",
    dotClass: "bg-purple-400",
  },
  {
    id: "cream-lemon",
    name: "奶油柠檬",
    iconColor: "#fbbf24",
    textColor: "text-amber-600 dark:text-amber-300",
    bgLight: "bg-amber-400/10 border-amber-400/20 dark:bg-amber-400/15 dark:border-amber-300/25",
    badgeClass: "bg-amber-400/[0.08] text-amber-600 border-amber-300/30 hover:border-amber-400/50 hover:bg-amber-400/15 dark:bg-amber-400/[0.12] dark:text-amber-300 dark:border-amber-400/30",
    dotClass: "bg-amber-400",
  },
  {
    id: "cyan-glaze",
    name: "冰滴湖青",
    iconColor: "#22d3ee",
    textColor: "text-cyan-600 dark:text-cyan-300",
    bgLight: "bg-cyan-400/10 border-cyan-400/20 dark:bg-cyan-400/15 dark:border-cyan-300/25",
    badgeClass: "bg-cyan-400/[0.08] text-cyan-600 border-cyan-300/30 hover:border-cyan-400/50 hover:bg-cyan-400/15 dark:bg-cyan-400/[0.12] dark:text-cyan-300 dark:border-cyan-400/30",
    dotClass: "bg-cyan-400",
  },
  {
    id: "lilac-violet",
    name: "丁香轻紫",
    iconColor: "#a78bfa",
    textColor: "text-violet-600 dark:text-violet-300",
    bgLight: "bg-violet-400/10 border-violet-400/20 dark:bg-violet-400/15 dark:border-violet-300/25",
    badgeClass: "bg-violet-400/[0.08] text-violet-600 border-violet-300/30 hover:border-violet-400/50 hover:bg-violet-400/15 dark:bg-violet-400/[0.12] dark:text-violet-300 dark:border-violet-400/30",
    dotClass: "bg-violet-400",
  },
  {
    id: "rose-petal",
    name: "落樱花瓣",
    iconColor: "#fb7185",
    textColor: "text-rose-600 dark:text-rose-300",
    bgLight: "bg-rose-400/10 border-rose-400/20 dark:bg-rose-400/15 dark:border-rose-300/25",
    badgeClass: "bg-rose-400/[0.08] text-rose-600 border-rose-300/30 hover:border-rose-400/50 hover:bg-rose-400/15 dark:bg-rose-400/[0.12] dark:text-rose-300 dark:border-rose-400/30",
    dotClass: "bg-rose-400",
  },
  {
    id: "matcha-lime",
    name: "抹茶微绿",
    iconColor: "#4ade80",
    textColor: "text-emerald-600 dark:text-emerald-300",
    bgLight: "bg-emerald-400/10 border-emerald-400/20 dark:bg-emerald-400/15 dark:border-emerald-300/25",
    badgeClass: "bg-emerald-400/[0.08] text-emerald-600 border-emerald-300/30 hover:border-emerald-400/50 hover:bg-emerald-400/15 dark:bg-emerald-400/[0.12] dark:text-emerald-300 dark:border-emerald-400/30",
    dotClass: "bg-emerald-400",
  },
  {
    id: "indigo-dew",
    name: "晨星靛蓝",
    iconColor: "#818cf8",
    textColor: "text-indigo-600 dark:text-indigo-300",
    bgLight: "bg-indigo-400/10 border-indigo-400/20 dark:bg-indigo-400/15 dark:border-indigo-300/25",
    badgeClass: "bg-indigo-400/[0.08] text-indigo-600 border-indigo-300/30 hover:border-indigo-400/50 hover:bg-indigo-400/15 dark:bg-indigo-400/[0.12] dark:text-indigo-300 dark:border-indigo-400/30",
    dotClass: "bg-indigo-400",
  },
  {
    id: "apricot-tea",
    name: "杏仁奶茶",
    iconColor: "#f59e0b",
    textColor: "text-amber-600 dark:text-amber-300",
    bgLight: "bg-amber-400/10 border-amber-400/20 dark:bg-amber-400/15 dark:border-amber-300/25",
    badgeClass: "bg-amber-400/[0.08] text-amber-600 border-amber-300/30 hover:border-amber-400/50 hover:bg-amber-400/15 dark:bg-amber-400/[0.12] dark:text-amber-300 dark:border-amber-400/30",
    dotClass: "bg-amber-400",
  },
  {
    id: "teal-mint",
    name: "琉璃湖绿",
    iconColor: "#2dd4bf",
    textColor: "text-teal-600 dark:text-teal-300",
    bgLight: "bg-teal-400/10 border-teal-400/20 dark:bg-teal-400/15 dark:border-teal-300/25",
    badgeClass: "bg-teal-400/[0.08] text-teal-600 border-teal-300/30 hover:border-teal-400/50 hover:bg-teal-400/15 dark:bg-teal-400/[0.12] dark:text-teal-300 dark:border-teal-400/30",
    dotClass: "bg-teal-400",
  },
  {
    id: "raspberry-velvet",
    name: "覆盆慕斯",
    iconColor: "#e879f9",
    textColor: "text-fuchsia-600 dark:text-fuchsia-300",
    bgLight: "bg-fuchsia-400/10 border-fuchsia-400/20 dark:bg-fuchsia-400/15 dark:border-fuchsia-300/25",
    badgeClass: "bg-fuchsia-400/[0.08] text-fuchsia-600 border-fuchsia-300/30 hover:border-fuchsia-400/50 hover:bg-fuchsia-400/15 dark:bg-fuchsia-400/[0.12] dark:text-fuchsia-300 dark:border-fuchsia-400/30",
    dotClass: "bg-fuchsia-400",
  },
  {
    id: "sunrise-amber",
    name: "晨曦柔橙",
    iconColor: "#fb923c",
    textColor: "text-orange-600 dark:text-orange-300",
    bgLight: "bg-orange-400/10 border-orange-400/20 dark:bg-orange-400/15 dark:border-orange-300/25",
    badgeClass: "bg-orange-400/[0.08] text-orange-600 border-orange-300/30 hover:border-orange-400/50 hover:bg-orange-400/15 dark:bg-orange-400/[0.12] dark:text-orange-300 dark:border-orange-400/30",
    dotClass: "bg-orange-400",
  },
  {
    id: "mist-blue",
    name: "云雾轻蓝",
    iconColor: "#60a5fa",
    textColor: "text-blue-600 dark:text-blue-300",
    bgLight: "bg-blue-400/10 border-blue-400/20 dark:bg-blue-400/15 dark:border-blue-300/25",
    badgeClass: "bg-blue-400/[0.08] text-blue-600 border-blue-300/30 hover:border-blue-400/50 hover:bg-blue-400/15 dark:bg-blue-400/[0.12] dark:text-blue-300 dark:border-blue-400/30",
    dotClass: "bg-blue-400",
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
