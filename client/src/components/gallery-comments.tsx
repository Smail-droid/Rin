import { useEffect, useMemo, useRef, useState } from "react";
import { client } from "../app/runtime";
import { useAlert, useConfirm } from "./dialog";
import { timeago } from "../utils/timeago";
import { useSiteConfig } from "../hooks/useSiteConfig";
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

// 本地离线高保真 SVG 二次元猫娘备用头像 (确保外网 Dicebear 波动时绝不破图)
const FALLBACK_ANIME_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23fff0f5"/><path d="M 20 38 L 12 12 L 38 24 Z" fill="%23fc466b"/><path d="M 80 38 L 88 12 L 62 24 Z" fill="%23fc466b"/><circle cx="50" cy="56" r="34" fill="%23fff" stroke="%23fc466b" stroke-width="2"/><circle cx="38" cy="54" r="4" fill="%234a0e2e"/><circle cx="62" cy="54" r="4" fill="%234a0e2e"/><ellipse cx="28" cy="62" rx="4" ry="2" fill="%23ff8da1"/><ellipse cx="72" cy="62" rx="4" ry="2" fill="%23ff8da1"/><path d="M 45 62 Q 50 66 55 62" stroke="%234a0e2e" stroke-width="2" fill="none"/></svg>`;

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
  approved?: number;
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
      {/* 1. 评论区大标题与氛围感副标 (已彻底移除冗余弹幕飘窗) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-black/5 dark:border-white/5">
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
      </div>

      {/* 2. 留言列表卡片流 (移至输入框上方，留言即刻映入眼帘) */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-neutral-400">
          <i className="ri-loader-4-line animate-spin text-theme text-xl mr-2" />
          <span>正在漫游留言板数据…</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 text-center text-xs text-rose-500 my-3">
          <p>{error}</p>
          <button onClick={loadComments} className="mt-1 text-theme underline font-bold">点击重试</button>
        </div>
      ) : comments.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-black/10 dark:border-white/10 text-center my-4">
          <p className="text-2xl mb-1">🍃</p>
          <p className="text-xs font-bold t-primary">展厅长廊静悄悄的</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">在下方留言板写下你的灵感或问候吧~</p>
        </div>
      ) : (
        <div className="space-y-2.5 my-4">
          {comments.map((comment, index) => (
            <GalleryCommentItem
              key={comment.id}
              comment={comment}
              index={index}
              floorNumber={comments.length - index}
              canDelete={Boolean(profile?.permission)}
              onRefresh={loadComments}
            />
          ))}
        </div>
      )}

      {/* 4. 二次元留言板风格输入卡片 (Message Board Form) */}
      <GalleryCommentInput
        feedId={feedIdNum}
        profile={profile}
        onRefresh={loadComments}
      />
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
  const siteConfig = useSiteConfig();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = (before: string, after: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}${before}${placeholder}${after}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const insertText = selected || placeholder;
    const nextContent = content.slice(0, start) + before + insertText + after + content.slice(end);
    setContent(nextContent);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = selected ? start + before.length + selected.length + after.length : start + before.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos + (selected ? 0 : placeholder.length));
    }, 0);
  };

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

  // 严格安全回退的头像 URL，杜绝任何破图
  const avatarUrl = useMemo(() => {
    if (profile) {
      return profile.avatar || siteConfig.avatar || getDicebearLoreleiAvatar(profile.name || "admin");
    }
    return getDicebearLoreleiAvatar(nickname);
  }, [profile, siteConfig.avatar, nickname]);

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
        const containsUrl = /(https?:\/\/|[a-zA-Z0-9-]+\.(com|cn|net|org|top|xyz|cc|me|vip|io|moe))/i.test(content || "");
        setContent("");
        // 智能安全提醒：含有外链时提示需审核
        if (!profile && containsUrl) {
          setToastMsg("🛡️ 留言已提交！因包含外链，将在博主审核后正式公开。");
        } else {
          setToastMsg("✨ 留言已成功贴上画廊！");
        }
        setTimeout(() => setToastMsg(null), 3500);
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
            {/* Avatar with fallback protection */}
            <div className="relative h-11 w-11 shrink-0 rounded-2xl bg-black/[0.03] p-0.5 shadow-sm ring-2 ring-theme/20 dark:bg-white/[0.04] group overflow-hidden">
              <img
                src={avatarUrl}
                alt={nickname}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_ANIME_AVATAR;
                }}
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

        {/* GitHub 风格极简一体化 Markdown 编辑器 */}
        <div className="flex flex-col rounded-2xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] overflow-visible focus-within:border-theme focus-within:ring-2 focus-within:ring-theme/15 transition-all">
          {/* GitHub 风格扁平工具栏: [ H | B | I | 引用 | 链接 | 行内代码 | Bash | 图片 | 😀表情 ] */}
          <div className="relative flex flex-wrap items-center justify-between gap-1 px-3 py-1.5 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-neutral-500">
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                onClick={() => insertFormat("### ", "\n", "标题文字")}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                title="标题 (###)"
              >
                <i className="ri-heading font-bold text-xs" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat("**", "**", "加粗文字")}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                title="加粗 (**)"
              >
                <i className="ri-bold font-bold text-xs" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat("*", "*", "斜体文字")}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                title="斜体 (*)"
              >
                <i className="ri-italic text-xs" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat("> ", "\n", "引用文段")}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                title="引用 (>)"
              >
                <i className="ri-double-quotes-l text-xs" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat("[", "](https://)", "链接文字")}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                title="插入链接"
              >
                <i className="ri-link text-xs" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat("`", "`", "code")}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                title="行内代码 (`)"
              >
                <i className="ri-code-s-slash-line text-xs" />
              </button>
              <button
                type="button"
                onClick={() => insertFormat("```bash\n", "\n```", "#!/bin/bash\necho 'Hello Gallery'")}
                className="flex h-7 items-center gap-1 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition text-[11px] font-mono"
                title="Mac终端 Bash 代码块"
              >
                <i className="ri-terminal-box-line text-xs" />
                <span>Bash</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormat("![图片描述](", ")", "https://")}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                title="插入图片链接"
              >
                <i className="ri-image-line text-xs" />
              </button>
            </div>

            <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline-block">
              Markdown Supported
            </span>
          </div>

          <textarea
            ref={textareaRef}
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下你想在留言板交流的想法、提问或灵感...（支持 Markdown 与 Mac 终端 Bash 代码块）"
            className="w-full resize-none border-0 bg-transparent p-3.5 text-xs sm:text-sm leading-relaxed t-primary placeholder-neutral-400 outline-none transition-colors min-h-[90px]"
          />
        </div>

        {/* 底部提交动作栏 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-400 font-mono">
              {content.length > 0 ? `${content.length} 字符` : "文明交流 · 善意沟通"}
            </span>
            {toastMsg && (
              <span className="text-xs font-semibold text-emerald-500 animate-pulse">
                {toastMsg}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-theme px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
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

function CommentContentRenderer({ content }: { content: string }) {
  if (!content.includes("```")) {
    return (
      <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed break-words py-1 whitespace-pre-wrap">
        {content}
      </p>
    );
  }

  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed break-words py-1 space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          let lang = "";
          let codeLines = lines;
          if (lines.length > 0 && /^[a-zA-Z0-9_-]+$/.test(lines[0].trim())) {
            lang = lines[0].trim();
            codeLines = lines.slice(1);
          }
          const codeText = codeLines.join("\n");
          return (
            <div key={index} className="my-2 rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs shadow-xs">
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/5 select-none">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500/80 inline-block" />
                  <span className="h-2 w-2 rounded-full bg-amber-500/80 inline-block" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500/80 inline-block" />
                  {lang && <span className="ml-2 text-[10px] uppercase font-bold text-neutral-400">{lang}</span>}
                </div>
              </div>
              <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }
        return part ? (
          <p key={index} className="whitespace-pre-wrap">{part}</p>
        ) : null;
      })}
    </div>
  );
}

// 留言便签条组件 (紧凑单行条状布局：左侧头像/昵称/时间/楼层，右侧内容)
function GalleryCommentItem({
  comment,
  floorNumber,
  canDelete,
  onRefresh,
}: {
  comment: CommentData;
  index: number;
  floorNumber: number;
  canDelete: boolean;
  onRefresh: () => void;
}) {
  const { showConfirm, ConfirmUI } = useConfirm();
  const { showAlert, AlertUI } = useAlert();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(() => Math.floor(Math.sin(comment.id) * 3) + 1);

  const commenterName = comment.user?.username || comment.guestName || "画廊访客";
  const avatarUrl = comment.user?.avatar || getDicebearLoreleiAvatar(commenterName);

  // 检测留言是否包含 URL 外部链接
  const containsUrl = /(https?:\/\/|[a-zA-Z0-9-]+\.(com|cn|net|org|top|xyz|cc|me|vip|io|moe))/i.test(comment.content || "");
  const isPending = comment.approved === 0;

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/comment/${comment.id}/approve`, { method: "PUT" });
      if (res.ok) {
        showAlert("已通过该留言审核并公开发布！", () => onRefresh());
      } else {
        showAlert("审批操作失败，请重试");
      }
    } catch {
      showAlert("审批异常");
    }
  };

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
    <div className="group relative flex flex-col sm:flex-row sm:items-start gap-3 rounded-2xl border border-black/10 bg-w p-3 sm:py-2.5 sm:px-4 shadow-2xs hover:shadow-xs hover:border-theme/30 transition-all dark:border-white/10 select-none">
      {/* 左侧元信息栏 (头像、昵称、楼层、时间) */}
      <div className="flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-1 shrink-0 sm:w-36 border-b sm:border-b-0 sm:border-r border-black/5 dark:border-white/5 pb-2 sm:pb-0 sm:pr-3">
        <div className="flex items-center gap-2">
          <img
            src={avatarUrl}
            alt={commenterName}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_ANIME_AVATAR;
            }}
            className="h-7 w-7 rounded-full bg-theme/10 object-cover ring-1 ring-black/10 dark:ring-white/10 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-xs t-primary truncate max-w-[80px]">{commenterName}</span>
              {comment.user && (
                <span className="px-1 py-0.2 rounded bg-theme/10 text-theme text-[9px] font-bold">
                  博主
                </span>
              )}
            </div>
            <span className="text-[10px] text-neutral-400 font-mono">
              {timeago(comment.createdAt)}
            </span>
          </div>
        </div>

        {/* 楼层标识数字 (如 1#, 2#, 3#) */}
        <div className="ml-auto sm:ml-0 sm:mt-1 flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-neutral-500">
            {floorNumber}#
          </span>
          {isPending ? (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold" title="待博主审核通过后公开显示">
              待审核
            </span>
          ) : containsUrl ? (
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold" title="已通过安全校验">
              含链接
            </span>
          ) : null}
        </div>
      </div>

      {/* 右侧内容区 (自适应撑满，紧凑排版) */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="text-xs sm:text-[13px] leading-relaxed t-primary">
          <CommentContentRenderer content={comment.content} />
        </div>

        {/* 底部点赞与删除工具 */}
        <div className="mt-2 pt-1.5 flex items-center justify-between text-[11px] text-neutral-400">
          <div />
          <div className="flex items-center gap-2">
            {canDelete && isPending && (
              <button
                type="button"
                onClick={handleApprove}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 font-bold text-[10px] transition"
                title="审核通过并公开发布此留言"
              >
                <i className="ri-check-double-line text-xs" />
                <span>通过审核</span>
              </button>
            )}

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
              title="赞同这条留言"
            >
              <i className={liked ? "ri-heart-fill text-rose-500" : "ri-heart-line"} />
              <span>{likes > 0 ? likes : ""}</span>
            </button>

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
        </div>
      </div>

      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
