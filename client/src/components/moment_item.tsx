import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";
import { ImageWithFallback } from "./image-with-fallback";
import { useSiteConfig } from "../hooks/useSiteConfig";

interface Moment {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    username: string;
    avatar: string;
  };
}

export function MomentItem({
  moment,
  onDelete,
  onEdit,
  canManage,
}: {
  moment: Moment;
  onDelete: (id: number) => void;
  onEdit: (moment: Moment) => void;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const { createdAt, updatedAt } = moment;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const authorAvatar =
    moment.user.avatar && moment.user.avatar.trim().length > 0
      ? moment.user.avatar
      : siteConfig.avatar || "/avatar.png";

  const toggleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
  };

  return (
    <article className="group relative break-inside-avoid flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white/85 dark:bg-[#18181b]/85 dark:border-white/[0.08] shadow-2xs hover:shadow-lg hover:border-theme/30 transition-all duration-300 p-4 sm:p-5 backdrop-blur-md">
      {/* 顶部手账小和纸微光装饰条 (极细致、无突兀) */}
      <div className="absolute -top-1.5 left-7 w-8 h-2.5 bg-theme/20 dark:bg-theme/30 rounded-xs rotate-[-3deg] pointer-events-none z-10" />

      {/* 1. Header: 用户信息、发表时间与管理动作 */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ImageWithFallback
            src={authorAvatar}
            alt={moment.user.username}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-cover ring-2 ring-white dark:ring-white/10 shadow-2xs shrink-0"
          />
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm t-primary truncate">
                {moment.user.username}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-theme/10 text-theme font-medium shrink-0">
                博主
              </span>
            </div>
            <span
              className="font-mono text-[10px] text-neutral-400 mt-0.5"
              title={new Date(createdAt).toLocaleString()}
            >
              {createdAt === updatedAt ? timeago(createdAt) : t("feed_card.published$time", { time: timeago(createdAt) })}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              aria-label={t("edit")}
              onClick={() => onEdit(moment)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-theme hover:bg-theme/10 transition"
              title="编辑此动态"
            >
              <i className="ri-edit-2-line text-xs" />
            </button>
            <button
              type="button"
              aria-label={t("delete.title")}
              onClick={() => onDelete(moment.id)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
              title="删除此动态"
            >
              <i className="ri-delete-bin-line text-xs" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Content: 纯净 Markdown 正文内容 */}
      <div className="flex-1 text-xs sm:text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
        <Markdown content={moment.content} />
      </div>

      {/* 3. Footer: 互动微动效与心情标记 */}
      <div className="mt-3.5 pt-2.5 flex items-center justify-between border-t border-black/5 dark:border-white/5 text-xs text-neutral-400">
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400">
          <i className="ri-sparkling-line text-theme/80 text-xs" />
          <span>随想记录</span>
        </span>

        <button
          type="button"
          onClick={toggleLike}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition duration-200 select-none ${
            liked
              ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40 font-semibold shadow-2xs"
              : "bg-black/[0.03] text-neutral-500 hover:bg-black/5 hover:text-rose-500 dark:bg-white/5 dark:text-neutral-400"
          }`}
        >
          <i className={liked ? "ri-heart-fill text-rose-500" : "ri-heart-line"} />
          <span>{liked ? likeCount || 1 : "心动"}</span>
        </button>
      </div>
    </article>
  );
}
