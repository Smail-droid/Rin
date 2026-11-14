import { useState } from "react";
import { useLocation } from "wouter";
import { client } from "../app/runtime";

interface HashTagProps {
  name: string;
  currentFeedId?: number | string;
  enableFlow?: boolean;
}

/**
 * 灵感流转标签 (Topic Flow Capsule)
 * 点击标签文字 -> 跳转至标签星云聚合汇总
 * 点击「换一篇」 -> 顺着同类灵感脉络无缝切入下一篇随想，实现沉浸式漫游探索
 */
export function HashTag({ name, currentFeedId, enableFlow = true }: HashTagProps) {
  const [, setLocation] = useLocation();
  const [isHopping, setIsHopping] = useState(false);

  const handleHop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHopping) return;
    setIsHopping(true);
    try {
      const res = await client.tag.get(name);
      if (res.data?.feeds && Array.isArray(res.data.feeds)) {
        const pool = res.data.feeds.filter(
          (f: any) => String(f.id) !== String(currentFeedId)
        );
        const candidates = pool.length > 0 ? pool : res.data.feeds;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        if (target) {
          setLocation(`/feed/${target.id}`);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    } catch {
      setLocation(`/hashtag/${encodeURIComponent(name)}`);
    } finally {
      setIsHopping(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-semibold group/tag hover:border-theme/40 hover:bg-theme/5 transition select-none">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setLocation(`/hashtag/${encodeURIComponent(name)}`);
        }}
        className="text-neutral-600 dark:text-neutral-300 hover:text-theme group-hover/tag:text-theme transition cursor-pointer"
      >
        #{name}
      </button>

      {enableFlow && (
        <button
          type="button"
          onClick={handleHop}
          disabled={isHopping}
          className="flex items-center gap-0.5 text-[10px] text-theme hover:text-theme-hover font-bold border-l border-black/10 dark:border-white/10 pl-1.5 transition cursor-pointer"
          title={`顺着 #${name} 换一篇随想`}
        >
          <i className={`ri-shuffle-line ${isHopping ? "animate-spin" : ""}`} />
          <span>{isHopping ? "寻找中" : "换一篇"}</span>
        </button>
      )}
    </span>
  );
}
