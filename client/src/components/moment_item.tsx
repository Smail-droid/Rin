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
    <article className="group relative rounded-3xl border border-black/10 bg-[#fdfdfd] dark:bg-[#18181b] dark:border-white/10 shadow-sm hover:shadow-xl hover:border-theme/40 transition-all duration-300 overflow-hidden">
      {/* 顶部胶带微动效装饰 (画廊便签感) */}
      <div className="absolute -top-2.5 left-10 w-12 h-3.5 bg-theme/20 dark:bg-theme/30 backdrop-blur-xs rounded-xs rotate-[-2deg] pointer-events-none z-10" />

      {/* 1. Mac Terminal Header Bar (Bash 代码块风格顶栏) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/5 dark:border-white/5 bg-black/[0.025] dark:bg-white/[0.025] select-none">
        {/* Left: 3 Mac Traffic Light Capsule Dots */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] inline-block shadow-2xs hover:scale-110 transition-transform" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] inline-block shadow-2xs hover:scale-110 transition-transform" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] inline-block shadow-2xs hover:scale-110 transition-transform" />
          </div>
          <span className="ml-2 font-mono text-[11px] font-bold tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
            <i className="ri-terminal-box-line text-theme" />
            <span>bash ~ moments/log_{moment.id}.sh</span>
          </span>
        </div>

        {/* Right: Author / Timestamp / Admin actions */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-neutral-400 hidden sm:inline-block" title={new Date(createdAt).toLocaleString()}>
            {createdAt === updatedAt ? timeago(createdAt) : t("feed_card.published$time", { time: timeago(createdAt) })}
          </span>

          {canManage && (
            <div className="flex items-center gap-1">
              <button
                aria-label={t("edit")}
                onClick={() => onEdit(moment)}
                className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-800 hover:bg-black/5 dark:hover:bg-white/10 transition"
                title="编辑"
              >
                <i className="ri-edit-2-line text-xs" />
              </button>
              <button
                aria-label={t("delete.title")}
                onClick={() => onDelete(moment.id)}
                className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                title="删除"
              >
                <i className="ri-delete-bin-line text-xs" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Terminal Window Body */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-3.5 mb-3">
          <ImageWithFallback
            src={authorAvatar}
            alt={moment.user.username}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl object-cover shadow-xs ring-2 ring-black/5 dark:ring-white/10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm sm:text-base text-[#576b95] dark:text-[#8ea2c6] hover:underline cursor-pointer flex items-center gap-1.5">
                <span>{moment.user.username}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-theme/10 text-theme font-mono font-semibold">
                  Author
                </span>
              </span>
              <span className="font-mono text-[10px] text-neutral-400 sm:hidden" title={new Date(createdAt).toLocaleString()}>
                {timeago(createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 pl-1 sm:pl-2">
          <Markdown content={moment.content} />
        </div>

        {/* Footer: Terminal like interaction bar */}
        <div className="mt-4 pt-3 flex items-center justify-between border-t border-black/5 dark:border-white/5 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-neutral-400 opacity-60">
              $ exit code 0
            </span>
          </div>

          <button
            type="button"
            onClick={toggleLike}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition duration-200 select-none ${
              liked
                ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40 font-semibold shadow-2xs"
                : "bg-black/[0.03] text-neutral-500 hover:bg-black/5 dark:bg-white/5 dark:text-neutral-400"
            }`}
          >
            <i className={liked ? "ri-heart-fill text-rose-500" : "ri-heart-line"} />
            <span>{liked ? likeCount || 1 : "赞"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
