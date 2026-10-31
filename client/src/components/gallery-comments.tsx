import { useEffect, useMemo, useState } from "react";
import { client } from "../app/runtime";
import { useAlert, useConfirm } from "./dialog";
import { timeago } from "../utils/timeago";
import type { Profile } from "../state/profile";

// 30+ 款考究的二次元萌系角色预设昵称
export const ANIME_NICKNAMES = [
  "樱落喵", "星野露露", "雾岛千夏", "浅川月", "风见幽香",
  "星守铃音", "雪平未来", "绫波之沫", "长门小憩", "紫苑羽",
  "白夜幽梦", "夏目聆风", "千反田微光", "椎名真昼", "御坂美夏",
  "逢坂大河", "加藤惠", "雪之下雪乃", "结城明日奈", "远坂凛",
  "伊莉雅", "早坂爱", "藤林杏", "古河渚", "立华奏",
  "小鸟游六花", "时崎狂三", "初音未来", "雷姆", "灰原哀"
];

// 生成 Dicebear lorelei 专属二次元头像 URL
export function getDicebearLoreleiAvatar(seed: string): string {
  const safeSeed = encodeURIComponent(seed.trim() || "rin-guest");
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${safeSeed}&backgroundColor=ffd1dc,ffdfba,baffc9,bae1ff,e8dff5&radius=50`;
}

export type CommentData = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  } | null;
  guestName?: string;
  guestEmail?: string;
  guestWebsite?: string;
};

// 预设二次元常用萌系快捷 Emoji 贴纸
const QUICK_EMOJIS = ["🌸", "✨", "🐾", "🍵", "🍰", "🐱", "🎉", "💭", "💡", "💌", "🌟", "🧸"];

export function GalleryComments({
  feedId,
  enabled,
  profile,
}: {
  feedId: string;
  enabled: boolean;
  profile?: Profile | null;
}) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const feedIdNum = Number.parseInt(feedId, 10);

  const loadComments = () => {
    if (Number.isNaN(feedIdNum)) return;
    client.comment.list(feedIdNum).then(({ data, error }) => {
      setLoading(false);
      if (error) {
        setError(error.value as string);
      } else if (data && Array.isArray(data)) {
        setComments(data as any);
      }
    });
  };

  useEffect(() => {
    loadComments();
  }, [feedId]);

  if (!enabled) return null;

  return (
    <div className="w-full max-w-4xl mx-auto my-8 px-2 sm:px-4">
      {/* 1. 评论区大标题与氛围感副标 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-theme/10 text-theme text-lg shadow-2xs">
            <i className="ri-chat-heart-line" />
          </span>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold t-primary flex items-center gap-2">
              <span>画廊留言板</span>
              <span className="text-xs font-mono font-bold text-neutral-400 dark:text-neutral-500">
                ({comments.length})
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              留下足迹与思想火花，免填邮箱网站，随机专属二次元萌娘头像
            </p>
          </div>
        </div>

        {/* 弹幕流模式标签 */}
        {comments.length > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme/5 border border-theme/20 text-xs font-semibold text-theme">
            <span className="h-2 w-2 rounded-full bg-theme animate-ping" />
            <span>实时画廊弹幕流已激活</span>
          </div>
        )}
      </div>

      {/* 2. 流动弹幕墙效果 (Danmaku Floating Stream) */}
      {comments.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] p-3 border border-black/5 dark:border-white/5 select-none">
          <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-neutral-400">
            <i className="ri-broadcast-line text-theme" />
            <span>留言弹幕飘窗</span>
          </div>
          <div className="relative flex overflow-x-hidden group">
            <div className="flex gap-3 animate-marquee whitespace-nowrap py-1 group-hover:[animation-play-state:paused]">
              {comments.slice(0, 15).map((c) => {
                const name = c.user?.username || c.guestName || "画廊访客";
                const avatar = c.user?.avatar || getDicebearLoreleiAvatar(name);
                return (
                  <div
                    key={`danmaku-${c.id}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-w/90 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 shadow-xs backdrop-blur-md text-xs t-primary shrink-0 transition hover:scale-105"
                  >
                    <img src={avatar} alt={name} className="h-5 w-5 rounded-full bg-theme/10 object-cover" />
                    <span className="font-bold text-theme">{name}:</span>
                    <span className="max-w-xs truncate">{c.content}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. 二次元留言板风格输入卡片 (Message Board Form) */}
      <GalleryCommentInput
        feedId={feedIdNum}
        profile={profile}
        onRefresh={loadComments}
      />

      {/* 4. 留言列表卡片流 (Message Wall Cards) */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs text-neutral-400">
          <i className="ri-loader-4-line animate-spin text-theme text-xl mr-2" />
          <span>正在漫游留言板数据…</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200 text-center text-xs text-rose-500 my-4">
          <p>{error}</p>
          <button onClick={loadComments} className="mt-2 text-theme underline font-bold">点击重试</button>
        </div>
      ) : comments.length === 0 ? (
        <div className="p-10 rounded-3xl border border-dashed border-black/10 dark:border-white/10 text-center my-6">
          <p className="text-3xl mb-2">🍃</p>
          <p className="text-sm font-bold t-primary">展厅长廊静悄悄的</p>
          <p className="text-xs text-neutral-400 mt-1">成为第一个在画廊留言板贴上便签的人吧~</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {comments.map((comment, index) => (
            <GalleryCommentItem
              key={comment.id}
              comment={comment}
              index={index}
              canDelete={Boolean(profile?.permission)}
              onRefresh={loadComments}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 留言板输入框组件
function GalleryCommentInput({
  feedId,
  profile,
  onRefresh,
}: {
  feedId: number;
  profile?: Profile | null;
  onRefresh: () => void;
}) {
  const { showAlert, AlertUI } = useAlert();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 随机二次元昵称
  const [nickname, setNickname] = useState(() => {
    if (profile?.name) return profile.name;
    const randomIdx = Math.floor(Math.random() * ANIME_NICKNAMES.length);
    return ANIME_NICKNAMES[randomIdx];
  });

  // 骰子换一换随机角色
  const handleRandomize = () => {
    let next = nickname;
    while (next === nickname) {
      const idx = Math.floor(Math.random() * ANIME_NICKNAMES.length);
      next = ANIME_NICKNAMES[idx];
    }
    setNickname(next);
  };

  // 生成的 Dicebear 专属头像
  const avatarUrl = useMemo(() => {
    if (profile?.avatar) return profile.avatar;
    return getDicebearLoreleiAvatar(nickname);
  }, [profile, nickname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      showAlert("请输入你想在留言板留下的文字~");
      return;
    }
    if (!profile && !nickname.trim()) {
      showAlert("请填写一个二次元昵称~");
      return;
    }

    setSubmitting(true);
    try {
      const payload = profile
        ? { content: content.trim() }
        : {
            content: content.trim(),
            guestName: nickname.trim(),
          };

      const { error } = await client.comment.create(feedId, payload);
      if (error) {
        showAlert(String(error.value || "发表留言失败"));
      } else {
        setContent("");
        showAlert("✨ 留言已成功贴在画廊留言板上！");
        onRefresh();
      }
    } catch (err: any) {
      showAlert(err.message || "发表异常");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative rounded-3xl border border-black/10 bg-w p-4 sm:p-6 shadow-md dark:border-white/10 transition-all">
      {/* 顶部胶带微动效装饰 */}
      <div className="absolute -top-2.5 left-12 w-14 h-4 bg-theme/20 dark:bg-theme/30 backdrop-blur-xs rounded-xs rotate-[-3deg] pointer-events-none" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Author Avatar & Nickname Bar (免填邮箱/网站) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            {/* Dicebear Avatar Preview */}
            <div className="relative h-11 w-11 shrink-0 rounded-2xl bg-black/[0.03] p-0.5 shadow-sm ring-2 ring-theme/20 dark:bg-white/[0.04] group">
              <img
                src={avatarUrl}
                alt={nickname}
                className="h-full w-full rounded-xl object-cover transition-transform group-hover:scale-110"
              />
            </div>

            {/* Nickname Capsule with Randomize Button */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="输入昵称..."
                  disabled={Boolean(profile)}
                  className="font-bold text-sm t-primary bg-transparent outline-none border-b border-dashed border-theme/40 focus:border-theme max-w-[140px] sm:max-w-[200px]"
                />
                {!profile && (
                  <button
                    type="button"
                    onClick={handleRandomize}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme/10 hover:bg-theme/20 text-theme text-[11px] font-semibold transition active:scale-95 select-none"
                    title="点击换一个二次元萌系昵称与头像"
                  >
                    <span>🎲 换一个</span>
                  </button>
                )}
              </div>
              <span className="text-[10px] text-neutral-400 mt-0.5">
                {profile ? "博主登录身份" : "已自动生成专属二次元头像 · 免填邮箱与网站"}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-neutral-400 text-xs">
            <i className="ri-shield-check-line text-emerald-500" />
            <span>极简无忧留言</span>
          </div>
        </div>

        {/* Content Textarea */}
        <div className="relative">
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在画廊留言板写下你的想法、提问或共鸣吧...（文明交流，言简意赅）"
            className="w-full resize-none rounded-2xl border border-black/10 bg-black/[0.015] p-3.5 text-xs sm:text-sm leading-relaxed t-primary placeholder-neutral-400 outline-none transition-colors focus:border-theme focus:ring-2 focus:ring-theme/15 dark:border-white/10 dark:bg-white/[0.02]"
          />
        </div>

        {/* Quick Emojis & Submit Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Quick Emoji bar */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setContent((prev) => `${prev}${emoji}`)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-sm hover:scale-125 transition-transform hover:bg-black/5 dark:hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-theme px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
          >
            {submitting ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                <span>正在贴便签…</span>
              </>
            ) : (
              <>
                <i className="ri-send-plane-fill" />
                <span>贴上画廊留言</span>
              </>
            )}
          </button>
        </div>
      </form>
      <AlertUI />
    </div>
  );
}

// 留言卡片组件 (二次元便签式)
function GalleryCommentItem({
  comment,
  index,
  canDelete,
  onRefresh,
}: {
  comment: CommentData;
  index: number;
  canDelete: boolean;
  onRefresh: () => void;
}) {
  const { showConfirm, ConfirmUI } = useConfirm();
  const { showAlert, AlertUI } = useAlert();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(() => Math.floor(Math.sin(comment.id) * 3) + 1);

  const commenterName = comment.user?.username || comment.guestName || "画廊访客";
  const avatarUrl = comment.user?.avatar || getDicebearLoreleiAvatar(commenterName);

  // 自然微倾角交错排布
  const tiltClass = index % 3 === 0 ? "rotate-[-0.6deg]" : index % 3 === 1 ? "rotate-[0.6deg]" : "rotate-0";

  const handleDelete = () => {
    showConfirm("删除留言确认", "确定要从画廊留言板移除这条评论吗？", async () => {
      const { error } = await client.comment.delete(comment.id);
      if (error) {
        showAlert(String(error.value || "删除失败"));
      } else {
        showAlert("已成功移除该留言！", () => onRefresh());
      }
    });
  };

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border border-black/10 bg-w p-4 shadow-2xs hover:shadow-xl hover:border-theme/40 transition-all duration-300 transform ${tiltClass} hover:rotate-0 hover:scale-[1.02] dark:border-white/10`}
    >
      {/* Tape decoration */}
      <div className="absolute -top-2 left-6 w-8 h-3 bg-theme/15 dark:bg-theme/25 rounded-xs rotate-[-2deg] pointer-events-none" />

      {/* Header: Avatar, Name, Time, Delete */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={avatarUrl}
            alt={commenterName}
            className="h-8 w-8 rounded-full bg-theme/10 object-cover ring-1 ring-black/10 dark:ring-white/10"
          />
          <div className="min-w-0">
            <p className="font-bold text-xs t-primary truncate flex items-center gap-1.5">
              <span>{commenterName}</span>
              {comment.user && (
                <span className="px-1.5 py-0.2 rounded-md bg-theme/10 text-theme text-[10px] font-semibold">
                  博主
                </span>
              )}
            </p>
            <span className="text-[10px] text-neutral-400 font-mono">
              {timeago(comment.createdAt)}
            </span>
          </div>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
            title="删除留言"
          >
            <i className="ri-delete-bin-line text-xs" />
          </button>
        )}
      </div>

      {/* Body Content */}
      <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed break-words py-1">
        {comment.content}
      </p>

      {/* Footer: Like Heart & Order badge */}
      <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-neutral-400">
        <span className="font-mono text-[10px] opacity-60">#{comment.id}</span>

        <button
          type="button"
          onClick={() => {
            setLiked((prev) => !prev);
            setLikes((prev) => (liked ? prev - 1 : prev + 1));
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition select-none ${
            liked
              ? "bg-rose-500/10 text-rose-500 font-bold"
              : "hover:bg-black/5 dark:hover:bg-white/5"
          }`}
          title="给这条留言点赞"
        >
          <i className={liked ? "ri-heart-fill text-rose-500" : "ri-heart-line"} />
          <span>{likes > 0 ? likes : ""}</span>
        </button>
      </div>

      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
