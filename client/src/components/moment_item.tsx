import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";
import { ImageWithFallback } from "./image-with-fallback";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { client } from "../app/runtime";
import { ProfileContext } from "../state/profile";
import {
  UnifiedCommentComposer,
  UnifiedCommentItem,
  type CommentData,
  type UnifiedCommentSubmitPayload,
  type UnifiedCommentSubmitResult,
} from "./gallery-comments";

interface MomentComment {
  id: number;
  content: string;
  guestName?: string;
  approved: number;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    avatar: string | null;
  } | null;
}

interface Moment {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  comments?: MomentComment[];
  commentsCount?: number;
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
  const profile = useContext(ProfileContext);
  const { createdAt, updatedAt } = moment;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // 弹幕与统一画廊留言板展开状态
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [showComments, setShowComments] = useState(false);

  const [commentsList, setCommentsList] = useState<MomentComment[]>(
    Array.isArray(moment.comments) ? moment.comments : []
  );

  const authorAvatar =
    moment.user.avatar && moment.user.avatar.trim().length > 0
      ? moment.user.avatar
      : siteConfig.avatar || "/avatar.png";

  const toggleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
  };

  const handlePostComment = async (
    payload: UnifiedCommentSubmitPayload
  ): Promise<UnifiedCommentSubmitResult> => {
    const { data, error } = await client.moments.createComment(moment.id, {
      content: payload.content,
      guestName: payload.guestName,
    });

    if (error) {
      return { ok: false, error: String(error.value || "留言失败") };
    }

    if (data) {
      const newCm: MomentComment = {
        id: data.id || Date.now(),
        content: payload.content,
        guestName: profile ? undefined : payload.guestName || "画廊访客",
        approved: data.approved ?? 1,
        createdAt: new Date().toISOString(),
        user: profile
          ? {
              id: profile.id,
              username: profile.name || "博主",
              avatar: profile.avatar || siteConfig.avatar || null,
            }
          : null,
      };
      if (newCm.approved === 1 || canManage) {
        setCommentsList((prev) => [newCm, ...prev]);
      }
      return {
        ok: true,
        message: data.message || "✨ 留言已发布！",
      };
    }

    return { ok: true, message: "✨ 留言已发布！" };
  };

  const handleApproveComment = async (commentId: number) => {
    await client.moments.approveComment(moment.id, commentId);
    setCommentsList((p) =>
      p.map((c) => (c.id === commentId ? { ...c, approved: 1 } : c))
    );
  };

  const handleDeleteComment = async (commentId: number) => {
    await client.moments.deleteComment(moment.id, commentId);
    setCommentsList((p) => p.filter((c) => c.id !== commentId));
  };

  const approvedComments = commentsList.filter((c) => c.approved === 1);

  return (
    <article className="group relative break-inside-avoid flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-w dark:border-white/[0.08] shadow-2xs hover:shadow-lg hover:border-theme/30 transition-all duration-300 p-3.5 sm:p-4 overflow-hidden">
      {/* 顶部手账和纸微光装饰条 */}
      <div className="absolute -top-1.5 left-7 w-8 h-2 bg-theme/20 dark:bg-theme/30 rounded-xs rotate-[-3deg] pointer-events-none z-10" />

      {/* 浮动飘屏弹幕轨道 (当开启且有留言时丝滑流转) */}
      {danmakuEnabled && approvedComments.length > 0 ? (
        <div className="absolute top-10 left-0 right-0 overflow-hidden pointer-events-none h-6 z-20">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-6">
            {approvedComments.map((cm) => (
              <span
                key={cm.id}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-theme/90 text-white font-medium shadow-xs backdrop-blur-xs"
              >
                <i className="ri-chat-voice-line text-[9px]" />
                <span className="opacity-90">{cm.user?.username || cm.guestName || "访客"}:</span>
                <span>{cm.content}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* 1. Header: 用户信息、发表时间与管理动作 */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <ImageWithFallback
            src={authorAvatar}
            alt={moment.user.username}
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl object-cover ring-1 ring-white dark:ring-white/10 shadow-2xs shrink-0"
          />
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-bold text-xs t-primary truncate">
              {moment.user.username}
            </span>
            <span
              className="font-mono text-[10px] text-neutral-400 shrink-0"
              title={new Date(createdAt).toLocaleString()}
            >
              {createdAt === updatedAt ? timeago(createdAt) : t("feed_card.published$time", { time: timeago(createdAt) })}
            </span>
          </div>
        </div>

        {canManage ? (
          <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              aria-label={t("edit")}
              onClick={() => onEdit(moment)}
              className="h-6 w-6 rounded-lg flex items-center justify-center text-neutral-400 hover:text-theme hover:bg-theme/10 transition cursor-pointer"
              title="编辑此动态"
            >
              <i className="ri-edit-2-line text-xs" />
            </button>
            <button
              type="button"
              aria-label={t("delete.title")}
              onClick={() => onDelete(moment.id)}
              className="h-6 w-6 rounded-lg flex items-center justify-center text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
              title="删除此动态"
            >
              <i className="ri-delete-bin-line text-xs" />
            </button>
          </div>
        ) : null}
      </div>

      {/* 2. Content: 紧凑纯净 Markdown 正文 */}
      <div className="flex-1 text-xs leading-normal sm:leading-relaxed text-neutral-800 dark:text-neutral-200 pl-0.5 my-1">
        <Markdown content={moment.content} />
      </div>

      {/* 3. Footer: 弹幕开关、留言展开与心动点赞 */}
      <div className="mt-2 pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/5 text-xs">
        <button
          type="button"
          onClick={() => setDanmakuEnabled((p) => !p)}
          title={danmakuEnabled ? "点击隐藏动态弹幕" : "点击开启飘屏弹幕"}
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg transition cursor-pointer ${
            danmakuEnabled
              ? "text-theme font-bold bg-theme/10"
              : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          }`}
        >
          <i className={danmakuEnabled ? "ri-chat-voice-line" : "ri-chat-off-line"} />
          <span>{danmakuEnabled ? "弹幕" : "静音"}</span>
          {approvedComments.length > 0 ? <span className="font-mono">({approvedComments.length})</span> : null}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowComments((p) => !p)}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] transition select-none cursor-pointer ${
              showComments
                ? "bg-theme text-white font-bold shadow-2xs"
                : "bg-black/[0.03] text-neutral-600 hover:text-theme hover:bg-black/5 dark:bg-white/5 dark:text-neutral-300"
            }`}
          >
            <i className="ri-chat-3-line" />
            <span>{commentsList.length > 0 ? `${commentsList.length} 留言` : "留言"}</span>
          </button>

          <button
            type="button"
            onClick={toggleLike}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] transition select-none cursor-pointer ${
              liked
                ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40 font-semibold shadow-2xs"
                : "bg-black/[0.03] text-neutral-500 hover:bg-black/5 hover:text-rose-500 dark:bg-white/5 dark:text-neutral-400"
            }`}
          >
            <i className={liked ? "ri-heart-fill text-rose-500" : "ri-heart-line"} />
            <span>{liked ? likeCount || 1 : "心动"}</span>
          </button>
        </div>
      </div>

      {/* 4. 联动复用全站统一画廊留言板（自动继承登录身份 / 随机头像 / 宽敞多行 Markdown 编辑器） */}
      {showComments ? (
        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-3 ani-show">
          {commentsList.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {commentsList.map((cm, index) => (
                <UnifiedCommentItem
                  key={cm.id}
                  comment={cm as CommentData}
                  floorNumber={commentsList.length - index}
                  canManage={canManage}
                  onApprove={handleApproveComment}
                  onDelete={handleDeleteComment}
                  compact
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400 py-1.5 text-center">暂无留言，快来留下第一句回复吧~</p>
          )}

          <UnifiedCommentComposer
            profile={profile}
            onSubmit={handlePostComment}
            placeholder="回复这条日常随想...（支持 Markdown，含外链将进入审核）"
            submitLabel="发送留言"
            compact
          />
        </div>
      ) : null}
    </article>
  );
}
