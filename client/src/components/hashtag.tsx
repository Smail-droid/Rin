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
 * 点击微光洗牌 🔀 -> 顺着同类灵感脉络无缝切入下一篇随想，实现沉浸式漫游探索
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
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-semibold group/tag hover:border-theme/40 hover:bg-theme/5 transition select-none">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setLocation(`/hashtag/${encodeURIComponent(name)}`);
        }}
        className="text-neutral-500 hover:text-theme group-hover/tag:text-theme transition"
      >
        #{name}
      </button>

      {enableFlow && (
        <button
          type="button"
          onClick={handleHop}
          disabled={isHopping}
          className="text-neutral-300 dark:text-neutral-600 hover:text-theme p-0.5 transition cursor-pointer"
          title={`顺着 #${name} 漫游下一篇`}
        >
          <i className={`ri-shuffle-line text-[11px] ${isHopping ? "animate-spin text-theme" : ""}`} />
        </button>
      )}
    </span>
  );
}
