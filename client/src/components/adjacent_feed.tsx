import type { AdjacentFeed, AdjacentFeedResponse } from "@rin/api";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { client } from "../app/runtime";
import { timeago } from "../utils/timeago";

interface AdjacentSectionProps {
  id: string;
  setError?: (error: string) => void;
}

/**
 * 文章正文文末：纯净双翼章节导航 (上一篇 & 下一篇)
 * 专司章节自然前后承接，形式极简纯净，杜绝多余组件堆叠
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
