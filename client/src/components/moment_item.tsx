import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";
import { ImageWithFallback } from "./image-with-fallback";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { client } from "../app/runtime";

interface MomentComment {
  id: number;
  content: string;
  guestName?: string;
  approved: number;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    avatar: string;
  };
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
  const { createdAt, updatedAt } = moment;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // 弹幕与留言展开状态
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<string | null>(null);

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

  const handlePostComment = async () => {
    if (!commentContent.trim()) return;

    setSubmittingComment(true);
    setCommentFeedback(null);
    try {
      const { data, error } = await client.moments.createComment(moment.id, {
        content: commentContent.trim(),
        guestName: guestName.trim() || undefined,
      });

      if (error) {
        setCommentFeedback(String(error.value || "留言失败"));
      } else if (data) {
        setCommentFeedback(data.message);
        if (data.approved === 1) {
          const newCm: MomentComment = {
            id: data.id,
            content: commentContent.trim(),
            guestName: guestName.trim() || "访客",
            approved: 1,
            createdAt: new Date().toISOString(),
          };
          setCommentsList((p) => [newCm, ...p]);
        }
        setCommentContent("");
        setTimeout(() => setCommentFeedback(null), 3000);
      }
    } catch (err: any) {
      setCommentFeedback(err.message || "网络异常");
    } finally {
      setSubmittingComment(false);
    }
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
    <article className="group relative break-inside-avoid flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white/85 dark:bg-[#18181b]/85 dark:border-white/[0.08] shadow-2xs hover:shadow-lg hover:border-theme/30 transition-all duration-300 p-3.5 sm:p-4 backdrop-blur-md overflow-hidden">
      {/* 顶部手账和纸微光装饰条 */}
      <div className="absolute -top-1.5 left-7 w-8 h-2 bg-theme/20 dark:bg-theme/30 rounded-xs rotate-[-3deg] pointer-events-none z-10" />

      {/* 浮动飘屏弹幕轨道 (当开启且有留言时丝滑流转) */}
      {danmakuEnabled && approvedComments.length > 0 && (
        <div className="absolute top-10 left-0 right-0 overflow-hidden pointer-events-none h-6 z-20">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-6">
            {approvedComments.map((cm) => (
              <span
                key={cm.id}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-theme/90 text-white font-medium shadow-xs backdrop-blur-xs"
              >
                <i className="ri-chat-voice-line text-[9px]" />
                <span className="opacity-90">{cm.guestName || cm.user?.username || "访客"}:</span>
                <span>{cm.content}</span>
              </span>
            ))}
          </div>
        </div>
      )}

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

        {canManage && (
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
        )}
      </div>

      {/* 2. Content: 紧凑纯净 Markdown 正文 (收紧行距，告别冗余空白) */}
      <div className="flex-1 text-xs leading-normal sm:leading-relaxed text-neutral-800 dark:text-neutral-200 pl-0.5 my-1">
        <Markdown content={moment.content} />
      </div>

      {/* 3. Footer: 弹幕开关、留言展开与心动点赞 (紧凑单行，消灭占位符) */}
      <div className="mt-2 pt-2 flex items-center justify-between border-t border-black/5 dark:border-white/5 text-xs">
        {/* 左侧：弹幕飘字开关 */}
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
          {approvedComments.length > 0 && <span className="font-mono">({approvedComments.length})</span>}
        </button>

        {/* 右侧：留言与心动按钮 */}
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

      {/* 4. 原地展开的动态留言抽屉与输入面板 */}
      {showComments && (
        <div className="mt-2.5 pt-2.5 border-t border-black/5 dark:border-white/5 space-y-2 ani-show">
          {/* 留言列表 */}
          {commentsList.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {commentsList.map((cm) => (
                <div
                  key={cm.id}
                  className={`p-2 rounded-xl text-[11px] flex flex-col gap-0.5 ${
                    cm.approved === 0
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200"
                      : "bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-700 dark:text-neutral-300">
                      {cm.guestName || cm.user?.username || "访客"}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[9px] text-neutral-400">
                      {cm.approved === 0 && (
                        <span className="text-amber-600 font-bold bg-amber-500/20 px-1 rounded">
                          待审批 (外链/敏感)
                        </span>
                      )}
                      <span>{timeago(cm.createdAt)}</span>
                      {canManage && (
                        <div className="flex items-center gap-1 ml-1">
                          {cm.approved === 0 && (
                            <button
                              type="button"
                              onClick={() => handleApproveComment(cm.id)}
                              className="text-emerald-600 hover:underline font-bold"
                              title="审核通过"
                            >
                              通过
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(cm.id)}
                            className="text-rose-500 hover:underline"
                            title="删除"
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-300 leading-snug">{cm.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-neutral-400 py-1 text-center">暂无留言，快来留下第一句回复吧~</p>
          )}

          {/* 留言输入栏 */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="昵称 (可选)"
                className="w-24 px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-neutral-800 text-[10px] outline-none focus:border-theme"
              />
              <input
                type="text"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
                placeholder="回复这条动态 (含外链将进入审批)..."
                className="flex-1 px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-neutral-800 text-[11px] outline-none focus:border-theme"
              />
              <button
                type="button"
                onClick={handlePostComment}
                disabled={submittingComment || !commentContent.trim()}
                className="px-3 py-1 rounded-lg bg-theme text-white text-[10px] font-bold shadow-2xs hover:bg-theme-hover transition disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {submittingComment ? "发送中..." : "发送"}
              </button>
            </div>
            {commentFeedback && (
              <p className="text-[10px] text-theme font-medium animate-fade-in pl-1">
                {commentFeedback}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
