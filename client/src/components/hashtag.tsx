import React, { useState } from "react";
import { useLocation } from "wouter";
import { client } from "../app/runtime";

interface HashTagProps {
  name: string;
  currentFeedId?: number | string;
  enableFlow?: boolean;
  className?: string;
  colorClass?: string;
}

/**
 * 🌸 灵感流转标签 (Topic Flow Capsule)
 * 严格保留经典日系圆润极简胶囊美学（rounded-full、柔和边框与微光悬浮）
 * 属性升级：
 *  - 点击文字 -> 跳转至标签星云聚合汇总
 *  - 点击洗牌图标 🔀 -> 顺着同类灵感脉络无缝随机切入下一篇随想（严格排除当前篇，智能全站换篇兜底，杜绝原地打转）
 */
export function HashTag({
  name,
  currentFeedId,
  enableFlow = true,
  className = "",
  colorClass = "",
}: HashTagProps) {
  const [, setLocation] = useLocation();
  const [isHopping, setIsHopping] = useState(false);

  const handleHop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHopping) return;
    setIsHopping(true);

    try {
      // 1. 优先调用服务端 /feed/random，支持同标签过滤与排除当前文章
      const queryParams = new URLSearchParams();
      if (currentFeedId) queryParams.set("exclude", String(currentFeedId));
      if (name) queryParams.set("tag", name);

      const res = await fetch(`/api/feed/random?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.feed?.url || data.feed?.id) {
          setLocation(data.feed.url || `/feed/${data.feed.id}`);
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

      // 3. 同标签下仅此一篇，全站随机挑一篇
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
    }
  };

  const defaultStyle = "border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold group/tag hover:border-theme/40 hover:bg-theme/5 transition select-none ${
        colorClass || defaultStyle
      } ${className}`}
    >
      <button
        type="button"
        onClick={async (e) => {
          e.preventDefault();
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
        }}
        className="text-neutral-600 dark:text-neutral-300 hover:text-theme group-hover/tag:text-theme transition cursor-pointer"
        title={`查看 #${name} 标签星云 (单篇独家标签将直接直达正文)`}
      >
        #{name}
      </button>

      {enableFlow && (
        <button
          type="button"
          onClick={handleHop}
          disabled={isHopping}
          className="text-neutral-400 dark:text-neutral-500 hover:text-theme p-0.5 transition cursor-pointer disabled:opacity-50 flex items-center border-l border-black/10 dark:border-white/10 pl-1.5"
          title={`顺着 #${name} 随机换一篇随想`}
        >
          <i
            className={`ri-shuffle-line text-[11px] ${
              isHopping ? "animate-spin text-theme" : "hover:rotate-180 transition-transform"
            }`}
          />
        </button>
      )}
    </span>
  );
}
