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
    canManage
}: { 
    moment: Moment, 
    onDelete: (id: number) => void,
    onEdit: (moment: Moment) => void,
    canManage: boolean
}) {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const { createdAt, updatedAt } = moment;
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    const authorAvatar = (moment.user.avatar && moment.user.avatar.trim().length > 0)
        ? moment.user.avatar
        : siteConfig.avatar || "/avatar.png";

    const toggleLike = () => {
        setLiked((prev) => !prev);
        setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
    };

    return (
        <div className="flex gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/5 shadow-2xs hover:shadow-md transition duration-300">
            {/* Left: Square-rounded avatar like WeChat (fallback to site avatar) */}
            <div className="shrink-0">
                <ImageWithFallback
                    src={authorAvatar}
                    alt={moment.user.username}
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-cover shadow-xs border border-black/5 dark:border-white/10"
                />
            </div>

            {/* Right: Author, Content, Actions */}
            <div className="min-w-0 flex-1">
                {/* WeChat Moments blue nickname */}
                <div className="flex items-center justify-between">
                    <span className="font-bold text-[15px] text-[#576b95] dark:text-[#7d90b8] hover:underline cursor-pointer">
                        {moment.user.username}
                    </span>
                    {canManage && (
                        <div className="flex items-center gap-1">
                            <button
                                aria-label={t("edit")}
                                onClick={() => onEdit(moment)}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-white/5 transition"
                                title="编辑"
                            >
                                <i className="ri-edit-2-line text-sm" />
                            </button>
                            <button
                                aria-label={t("delete.title")}
                                onClick={() => onDelete(moment.id)}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                title="删除"
                            >
                                <i className="ri-delete-bin-line text-sm" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Content body */}
                <div className="mt-2 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                    <Markdown content={moment.content} />
                </div>

                {/* Footer: Timestamp & WeChat-style like interaction */}
                <div className="mt-3 pt-2 flex items-center justify-between text-xs text-neutral-400">
                    <span title={new Date(createdAt).toLocaleString()}>
                        {createdAt === updatedAt
                            ? timeago(createdAt)
                            : t("feed_card.published$time", { time: timeago(createdAt) })}
                    </span>

                    {/* WeChat like button */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={toggleLike}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition duration-200 ${
                                liked
                                    ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40 font-semibold"
                                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-400"
                            }`}
                        >
                            <i className={liked ? "ri-heart-fill text-rose-500" : "ri-heart-line"} />
                            <span>{liked ? likeCount || 1 : "赞"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
