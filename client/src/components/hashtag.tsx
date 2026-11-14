import React, { useState } from "react";
import { useLocation } from "wouter";
import { client } from "../app/runtime";

interface HashTagProps {
  name: string;
  currentFeedId?: number | string;
  enableFlow?: boolean;
  variant?: "ribbon" | "compact";
  className?: string;
}

/**
 * 🌸 拟本书签式功能流转标签 (Bookmark Ribbon Tag Menu)
 * 美学：书签折角/缎带悬挂质感，兼具二次元微光与文具拟物
 * 功能：
 *  - 点击书签文字 -> 进入标签星云聚合
 *  - 点击「换一篇 🎲」 -> 智能顺签/全站换一篇（绝对不重复当前篇）
 *  - 点击「下一篇 ⏭」 -> 顺着同类灵感脉络切入下一篇随想
 */
export function HashTag({
  name,
  currentFeedId,
  enableFlow = true,
  variant = "ribbon",
  className = "",
}: HashTagProps) {
  const [, setLocation] = useLocation();
  const [isHopping, setIsHopping] = useState(false);
  const [hopAction, setHopAction] = useState<"random" | "next" | null>(null);

  // 顺标签随机换一篇 (严格排除当前篇，同标签暂无其他篇时自动全网漫游兜底)
  const handleRandomHop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHopping) return;
    setIsHopping(true);
    setHopAction("random");

    try {
      // 1. 优先请求服务端 /feed/random 接口
      const queryParams = new URLSearchParams();
      if (currentFeedId) queryParams.set("exclude", String(currentFeedId));
      if (name) queryParams.set("tag", name);

      const res = await fetch(`/api/feed/random?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.feed?.url || data.feed?.id) {
          const targetUrl = data.feed.url || `/feed/${data.feed.id}`;
          setLocation(targetUrl);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      // 2. 客户端接口降级兜底
      const tagRes = await client.tag.get(name);
      if (tagRes.data?.feeds && Array.isArray(tagRes.data.feeds)) {
        const pool = tagRes.data.feeds.filter(
          (f: any) => String(f.id) !== String(currentFeedId)
        );
        const candidates = pool.length > 0 ? pool : tagRes.data.feeds;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        if (target && String(target.id) !== String(currentFeedId)) {
          setLocation(`/feed/${target.id}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      // 3. 标签下仅此一篇，全站随机
      const fallbackRes = await fetch(`/api/feed/random?exclude=${currentFeedId || ""}`);
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        if (fbData.feed) {
          setLocation(fbData.feed.url || `/feed/${fbData.feed.id}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      setLocation(`/hashtag/${encodeURIComponent(name)}`);
    } catch {
      setLocation(`/hashtag/${encodeURIComponent(name)}`);
    } finally {
      setIsHopping(false);
      setHopAction(null);
    }
  };

  // 顺标签按时间进入下一篇
  const handleNextHop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHopping) return;
    setIsHopping(true);
    setHopAction("next");

    try {
      const tagRes = await client.tag.get(name);
      if (tagRes.data?.feeds && Array.isArray(tagRes.data.feeds)) {
        const sorted = [...tagRes.data.feeds].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const curIdx = sorted.findIndex((f: any) => String(f.id) === String(currentFeedId));
        if (curIdx !== -1 && curIdx < sorted.length - 1) {
          const nextFeed = sorted[curIdx + 1];
          setLocation(`/feed/${nextFeed.id}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        } else if (sorted.length > 0) {
          // 循环回第一篇
          const first = sorted[0];
          setLocation(`/feed/${first.id}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
      void handleRandomHop(e);
    } catch {
      setLocation(`/hashtag/${encodeURIComponent(name)}`);
    } finally {
      setIsHopping(false);
      setHopAction(null);
    }
  };

  if (variant === "compact") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-neutral-800/70 text-xs font-semibold group/tag hover:border-theme/40 select-none ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setLocation(`/hashtag/${encodeURIComponent(name)}`);
          }}
          className="text-neutral-600 dark:text-neutral-300 hover:text-theme transition cursor-pointer"
        >
          #{name}
        </button>
        {enableFlow && (
          <button
            type="button"
            onClick={handleRandomHop}
            disabled={isHopping}
            className="text-[10px] text-theme font-bold hover:scale-110 active:scale-95 transition cursor-pointer disabled:opacity-50"
            title="顺标签换一篇"
          >
            <i className={`ri-shuffle-line ${isHopping ? "animate-spin" : ""}`} />
          </button>
        )}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center rounded-xl bg-white/80 dark:bg-neutral-900/80 border border-black/10 dark:border-white/10 shadow-2xs hover:shadow-md hover:border-theme/40 transition-all duration-300 overflow-hidden font-sans select-none ${className}`}>
      {/* 书签彩带左标 (Bookmark Ribbon Tab) */}
      <div className="flex items-center gap-1 pl-2.5 pr-2 py-1 bg-theme/10 border-r border-theme/20 text-theme">
        <i className="ri-bookmark-3-fill text-xs" />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setLocation(`/hashtag/${encodeURIComponent(name)}`);
          }}
          className="font-bold text-xs hover:underline cursor-pointer tracking-tight"
          title={`点击查看 #${name} 标签聚合星云`}
        >
          #{name}
        </button>
      </div>

      {/* 功能性动作菜单 (Functional Roaming Menu) */}
      {enableFlow && (
        <div className="flex items-center divide-x divide-black/5 dark:divide-white/5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
          <button
            type="button"
            onClick={handleRandomHop}
            disabled={isHopping}
            className="flex items-center gap-0.5 px-2 py-1 hover:text-theme hover:bg-theme/5 transition cursor-pointer disabled:opacity-50"
            title={`顺着 #${name} 随机漫游换一篇（绝不重复当前篇）`}
          >
            <i className={`ri-shuffle-line ${isHopping && hopAction === "random" ? "animate-spin text-theme" : ""}`} />
            <span>{isHopping && hopAction === "random" ? "漫游中" : "换篇"}</span>
          </button>

          <button
            type="button"
            onClick={handleNextHop}
            disabled={isHopping}
            className="flex items-center gap-0.5 px-2 py-1 hover:text-theme hover:bg-theme/5 transition cursor-pointer disabled:opacity-50"
            title={`顺着 #${name} 顺序进入下一篇`}
          >
            <i className={`ri-skip-forward-line ${isHopping && hopAction === "next" ? "animate-spin text-theme" : ""}`} />
            <span>{isHopping && hopAction === "next" ? "寻访中" : "下一篇"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
