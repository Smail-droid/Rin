import type { Feed } from "@rin/api";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useAlert, useConfirm } from "../components/dialog";
import { HashTag } from "../components/hashtag";
import { ImageWithFallback } from "../components/image-with-fallback";
import { Waiting } from "../components/loading";
import { Markdown } from "../components/markdown";
import { client } from "../app/runtime";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { timeago } from "../utils/timeago";
import { Button } from "../components/button";
import { Tips } from "../components/tips";
import { renderMermaidElements } from "../utils/render-mermaid";
import { AdjacentSection } from "../components/adjacent_feed.tsx";
import { stripImageUrlMetadata } from "../utils/image-upload";
import { GalleryComments } from "../components/gallery-comments";
import { Modal } from "@rin/ui";

function extractFirstMarkdownImageUrl(content: string) {
  const match = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/.exec(content);
  if (!match) {
    return undefined;
  }

  return stripImageUrlMetadata(match[1]);
}

// 弹幕与诗意字幕纯文本清洗函数（彻底去除 Emoji、漫游精选/访客等前缀、URL链接）
function cleanCaptionText(raw: string): string {
  if (!raw) return "";
  let text = raw;
  // 1. 去除 URL 链接
  text = text.replace(/https?:\/\/[^\s]+/gi, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // 2. 去除所有 Emoji 与特殊字符
  text = text.replace(/[\u{1F300}-\u{1FAD6}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, "");
  // 3. 去除额外前缀与标签
  text = text.replace(/^(漫游精选|精选|访客|留言|评论|文章|随想)[:：\s]*/gi, "");
  text = text.replace(/^[\s#*~-]+/, "");
  return text.trim();
}

export function FeedPage({ id, TOC, clean }: { id: string, TOC: () => JSX.Element, clean: (id: string) => void }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

  // 就地极简文章快速编辑状态 (无需跳回后台，零额外重型分包开销)
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // PC 端右侧目录下方推荐标签
  const [recommendedTags, setRecommendedTags] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    client.tag.list().then(({ data }) => {
      if (data && Array.isArray(data)) {
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        setRecommendedTags(shuffled.slice(0, 8));
      }
    }).catch(() => {});
  }, []);

  const openQuickEdit = () => {
    if (!feed) return;
    setEditTitle(feed.title || "");
    setEditContent(feed.content || "");
    setIsQuickEditOpen(true);
  };

  const handleSaveQuickEdit = async () => {
    if (!feed) return;
    setIsSavingEdit(true);
    try {
      const { error } = await client.feed.update(feed.id, {
        title: editTitle,
        content: editContent,
        listed: true,
      });
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string));
      } else {
        setFeed({
          ...feed,
          title: editTitle,
          content: editContent,
        });
        setIsQuickEditOpen(false);
      }
    } catch (e: any) {
      showAlert(e.message || "更新失败");
    } finally {
      setIsSavingEdit(false);
    }
  };
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // 切换文章（上一篇/下一篇）时立即滚回顶部，解决停留在文末问题
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

  // 点击空白处收起分享菜单
  useEffect(() => {
    if (!isShareMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setIsShareMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isShareMenuOpen]);

  // 视频级海报弹幕控制状态
  const [isDanmakuEnabled, setIsDanmakuEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem("rin_poster_danmaku_enabled");
      return val !== "false";
    } catch {
      return true;
    }
  });

  // 纯净左右多维流弹幕模型 (取消生硬顶轨，随机倾角、随机速度、随机字号 12px~15px，相遇微光消融)
  const [dualFlankDanmaku, setDualFlankDanmaku] = useState<{
    leftItems: Array<{ text: string; delay: string; duration: string; color: string; rot: string; size: string; top: string }>;
    rightItems: Array<{ text: string; delay: string; duration: string; color: string; rot: string; size: string; top: string }>;
  }>({ leftItems: [], rightItems: [] });

  const toggleDanmaku = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDanmakuEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("rin_poster_danmaku_enabled", String(next));
      } catch {}
      return next;
    });
  };

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMarkdown = (title: string) => {
    const md = `[${title}](${window.location.href})`;
    void navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };
  const profile = useContext(ProfileContext);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState<string>();
  const [headImage, setHeadImage] = useState<string>();
  const ref = useRef("");
  const [, setLocation] = useLocation();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [top, setTop] = useState<number>(0);
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const config = useContext(ClientConfigContext);
  const counterEnabled = config.getBoolean('counter.enabled');
  const hasAISummary = Boolean(feed?.ai_summary?.trim());
  const showAISummaryState = feed?.ai_summary_status === "pending" || feed?.ai_summary_status === "processing" || feed?.ai_summary_status === "failed";
  const hashtags = Array.isArray(feed?.hashtags) ? feed.hashtags : [];

  const wordCount = useMemo(() => {
    return feed?.content?.replace(/\s+/g, "").length || 0;
  }, [feed?.content]);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 400));

  useEffect(() => {
    if (!feed?.id) return;
    const fetchDanmakuData = async () => {
      try {
        const commentRes = await client.comment.list(feed.id);

        // 1. 真实读者纯文字留言提取
        const commentsList: string[] = [];
        if (commentRes.data && Array.isArray(commentRes.data)) {
          commentRes.data.forEach((c: any) => {
            const clean = cleanCaptionText(c.content || "");
            if (clean && clean.length >= 2) {
              commentsList.push(clean.slice(0, 36));
            }
          });
        }
        if (commentsList.length === 0) {
          commentsList.push(
            "漫步在画廊随想记忆工坊",
            "留下足迹与思想火花",
            "每一篇随笔都是长河里静止的微光",
            "二次元微光美学真舒服",
            "随性画廊风采，静候知音"
          );
        }

        // 随机洗牌真实留言
        const shuffledComments = [...commentsList].sort(() => 0.5 - Math.random());

        // 2. 清爽开场白短语（彻底移除长篇大段文章内容，回归纯净）
        const aestheticIntros = [
          "一页一世界 · 随性画廊风采",
          "二次元微光美学 · 浮游微光",
          "岁月不语 · 惟石能言",
          "记录每一次灵感火花在此凝结",
        ];

        // 3. 区域 2 与 3：以清爽美学开场，后续 100% 衔接真实读者留言（绝不放长文章内容）
        const leftStream = [
          aestheticIntros[0],
          ...shuffledComments.slice(0, 3),
        ];

        const rightStream = [
          aestheticIntros[1],
          ...shuffledComments.slice(3, 6),
        ];

        // 3. 随机字号池与垂直纵向分布 (随机 12px ~ 15px，错开高度绝不重叠)
        const fontSizes = ["text-xs", "text-[13px]", "text-sm", "text-[15px] font-extrabold"];
        const verticalPositions = ["15%", "35%", "55%", "75%"];
        const leftColors = ["#f472b6", "#c084fc", "#38bdf8", "#ffffff", "#ffd166", "#4ade80"];
        const rightColors = ["#ffd166", "#4ade80", "#38bdf8", "#f472b6", "#c084fc", "#ffffff"];
        
        // 显著随机手绘错落大倾角 (随机 -6.5° ~ +6.5°)
        const randomRots = [
          "rotate-[-5.5deg]", "rotate-[4.8deg]", "rotate-[-6.2deg]", "rotate-[5.2deg]",
          "rotate-[-3.8deg]", "rotate-[6deg]", "rotate-[-4.5deg]", "rotate-[3.5deg]"
        ];

        // 提速后的灵动流速 (加快游动节奏，深入中心才消散，字号与倾角完全随机)
        setDualFlankDanmaku({
          leftItems: leftStream.map((text, i) => ({
            text,
            delay: `${(i * 2.2).toFixed(1)}s`,
            duration: `${(4.2 + (i % 3) * 1.2).toFixed(1)}s`,
            color: leftColors[i % leftColors.length],
            rot: randomRots[i % randomRots.length],
            size: fontSizes[i % fontSizes.length],
            top: verticalPositions[i % verticalPositions.length],
          })),
          rightItems: rightStream.map((text, i) => ({
            text,
            delay: `${(0.8 + i * 2.3).toFixed(1)}s`,
            duration: `${(4.5 + (i % 3) * 1.3).toFixed(1)}s`,
            color: rightColors[i % rightColors.length],
            rot: randomRots[(i + 3) % randomRots.length],
            size: fontSizes[(i + 1) % fontSizes.length],
            top: verticalPositions[(i + 2) % verticalPositions.length],
          })),
        });
      } catch {}
    };

    void fetchDanmakuData();
  }, [feed?.id]);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const current = (window.scrollY / totalScroll) * 100;
        setReadingProgress(Math.min(100, Math.max(0, current)));
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  function deleteFeed() {
    // Confirm
    showConfirm(
      t("article.delete.title"),
      t("article.delete.confirm"),
      () => {
        if (!feed) return;
        client.feed
          .delete(feed.id)
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(t("delete.success"));
              setLocation("/");
            }
          });
      })
  }
  function topFeed() {
    const isUnTop = !(top > 0)
    const topNew = isUnTop ? 1 : 0;
    // Confirm
    showConfirm(
      isUnTop ? t("article.top.title") : t("article.untop.title"),
      isUnTop ? t("article.top.confirm") : t("article.untop.confirm"),
      () => {
        if (!feed) return;
        client.feed
          .setTop(feed.id, topNew)
          .then(({ error }) => {
            if (error) {
              showAlert(error.value as string);
            } else {
              showAlert(isUnTop ? t("article.top.success") : t("article.untop.success"));
              setTop(topNew);
            }
          });
      })
  }
  useEffect(() => {
    if (ref.current == id) return;
    setFeed(undefined);
    setError(undefined);
    setHeadImage(undefined);
    client.feed
      .get(id)
      .then(({ data, error }) => {
        if (error) {
          setError(error.value as string);
        } else if (data && typeof data !== "string") {
          setTimeout(() => {
            setFeed(data as any);
            setTop(data.top || 0);
            const headImageUrl = extractFirstMarkdownImageUrl(data.content);
            if (headImageUrl) {
              setHeadImage(headImageUrl);
            }
            clean(id);
          }, 0);
        }
      });
    ref.current = id;
  }, [id]);
  useEffect(() => {
    void renderMermaidElements();
  }, [feed]);

  return (
    <Waiting for={feed || error}>
      {feed && (
        <Helmet>
          <title>{`${feed.title ?? "Unnamed"} - ${siteConfig.name}`}</title>
          <meta property="og:site_name" content={siteName} />
          <meta property="og:title" content={feed.title ?? ""} />
          <meta property="og:image" content={headImage ?? siteConfig.avatar} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={document.URL} />
          <meta
            name="og:description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
          <meta name="author" content={feed.user.username} />
          <meta
            name="keywords"
            content={hashtags.map(({ name }) => name).join(", ")}
          />
          <meta
            name="description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
        </Helmet>
      )}
      {/* 顶部微光极光渐变阅读进度条 */}
      <div
        className="fixed top-0 left-0 h-1 z-50 bg-gradient-to-r from-theme via-sky-400 to-purple-500 transition-all duration-150 pointer-events-none shadow-xs"
        style={{ width: `${readingProgress}%` }}
      />

      <div className="w-full flex flex-row justify-center ani-show">
        {error && (
          <>
            <div className="flex flex-col wauto rounded-2xl bg-w m-2 p-6 items-center justify-center space-y-2">
              <h1 className="text-xl font-bold t-primary">{error}</h1>
              {error === "Not found" && id === "about" && (
                <Tips value={t("about.notfound")} />
              )}
              <Button
                title={t("index.back")}
                onClick={() => (window.location.href = "/")}
              />
            </div>
          </>
        )}
        {feed && !error && (
          <>
            <div className="xl:w-64" />
            <main className="wauto">
              {/* Gallery Top SPA Navigation Bar */}
              <div className="mb-3 mx-2 flex items-center justify-between">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-w px-4 py-2 text-xs font-bold t-primary shadow-2xs hover:shadow-md hover:border-theme transition"
                >
                  <i className="ri-arrow-left-line text-theme" />
                  <span>返回画廊随想</span>
                </Link>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 text-xs text-neutral-400">
                  <i className="ri-gallery-line text-theme" />
                  <span>艺术画廊展厅</span>
                </div>
              </div>

              <article
                className="rounded-3xl bg-w m-2 px-6 py-6 sm:px-8 sm:py-8 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden"
                aria-label={feed.title ?? "Unnamed"}
              >
                {/* Adaptive Artistic Exhibition Poster Frame (自适应完整画幅，绝对无裁切，带环境弥散底色) */}
                {(() => {
                  const coverImage = (feed as any).avatar || (feed.content ? extractFirstMarkdownImageUrl(feed.content) : undefined);
                  if (!coverImage) return null;
                  return (
                    <div
                      onClick={() => setLightboxImage(coverImage)}
                      className="relative mb-6 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 max-h-[380px] overflow-hidden border-b border-black/10 dark:border-white/10 group cursor-zoom-in bg-black/[0.04] dark:bg-white/[0.03] flex items-center justify-center p-3 sm:p-5 select-none"
                    >
                      {/* 背景环境弥散光晕 (取自封面图本身) */}
                      <img
                        src={coverImage}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover filter blur-2xl opacity-40 scale-125 pointer-events-none select-none"
                      />
                      <div className="absolute inset-0 bg-black/15 dark:bg-black/35 pointer-events-none" />

                      {/* 顶层无损完整高清海报画幅 (自适应居中包含，绝不裁切文字与构图) */}
                      <div className="relative z-10 max-h-[340px] max-w-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-white/40 dark:border-white/20">
                        <img
                          src={coverImage}
                          alt={feed.title || "Cover"}
                          className="max-h-[340px] w-auto max-w-full object-contain transition-transform duration-700 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>

                      {/* 纯净左右双向微光流动弹幕系统：全端自适应流动，手机竖屏横屏均可随心漫游 */}
                      {isDanmakuEnabled && (
                        <div className="block absolute inset-0 z-20 pointer-events-none select-none overflow-hidden">
                          {/* 左翼微光灵感区 (显著随机手绘大倾角、随机字号 12~15px，向中心加速游动并粒子消散) */}
                          <div className="absolute left-1.5 sm:left-4 inset-y-6 sm:inset-y-10 w-36 sm:w-64 pointer-events-none">
                            {dualFlankDanmaku.leftItems.map((dm, i) => (
                              <div
                                key={`left-${i}`}
                                style={{
                                  top: dm.top,
                                  animation: `danmaku-collide-left ${
                                    siteConfig.danmakuSpeed === "fast" ? "3.2s" : siteConfig.danmakuSpeed === "slow" ? "6.5s" : dm.duration
                                  } ease-in-out infinite`,
                                  animationDelay: dm.delay,
                                  color: dm.color,
                                  textShadow: "0 2px 8px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.85)",
                                }}
                                className={`absolute left-0 transform ${dm.rot} ${dm.size} font-extrabold tracking-wide whitespace-nowrap pointer-events-auto hover:[animation-play-state:paused] hover:scale-105 transition-transform cursor-default`}
                                title="画廊随想读者灵感 · 悬停定格"
                              >
                                {dm.text}
                              </div>
                            ))}
                          </div>

                          {/* 右翼读者留言微光区 (显著随机手绘大倾角、随机字号 12~15px，向中心加速游动并粒子消散) */}
                          <div className="absolute right-1.5 sm:right-4 inset-y-6 sm:inset-y-10 w-36 sm:w-64 pointer-events-none text-right">
                            {dualFlankDanmaku.rightItems.map((dm, i) => (
                              <div
                                key={`right-${i}`}
                                style={{
                                  top: dm.top,
                                  animation: `danmaku-collide-right ${
                                    siteConfig.danmakuSpeed === "fast" ? "3.4s" : siteConfig.danmakuSpeed === "slow" ? "6.8s" : dm.duration
                                  } ease-in-out infinite`,
                                  animationDelay: dm.delay,
                                  color: dm.color,
                                  textShadow: "0 2px 8px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.85)",
                                }}
                                className={`absolute right-0 transform ${dm.rot} ${dm.size} font-extrabold tracking-wide whitespace-nowrap pointer-events-auto hover:[animation-play-state:paused] hover:scale-105 transition-transform cursor-default`}
                                title="画廊随想读者留言 · 悬停定格"
                              >
                                {dm.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 弹幕开关控制胶囊 (精致小巧圆盘，避开遮挡，移动端舒适) */}
                      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-30 flex items-center">
                        <button
                          type="button"
                          onClick={toggleDanmaku}
                          title={isDanmakuEnabled ? "点击关闭海报弹幕" : "点击开启海报弹幕"}
                          className={`h-7 px-2 sm:px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 backdrop-blur-md shadow-md transition-all select-none active:scale-95 ${
                            isDanmakuEnabled
                              ? "bg-theme/90 text-white hover:bg-theme"
                              : "bg-black/60 text-neutral-300 hover:bg-black/80 hover:text-white"
                          }`}
                        >
                          <i className={isDanmakuEnabled ? "ri-chat-voice-line text-xs" : "ri-chat-off-line text-xs"} />
                          <span className="hidden sm:inline">{isDanmakuEnabled ? "弹幕" : "静音"}</span>
                        </button>
                      </div>

                      {/* 左下角小展签 */}
                      <div className="absolute bottom-3 left-3 sm:left-4 z-20 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[10px] font-bold text-white shadow-2xs font-mono">
                          EXHIBIT #{String(feed.id).padStart(4, "0")}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-3">
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold t-primary [overflow-wrap:anywhere] leading-snug">
                    {feed.title}
                  </h1>
                    {/* 独立操作工具栏 (复制直链、分享、置顶、编辑、删除)，在小屏上自然独立成行，绝不压缩标题 */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/5 dark:border-white/5">
                      {/* 左侧元信息条 (字数、时间、阅读量) */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-neutral-400">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-theme">
                          #{String(feed.id).padStart(4, "0")}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-time-line text-theme" />
                          <span>约 {readingMinutes} 分钟</span>
                        </span>
                        <span>·</span>
                        <span
                          className="inline-flex items-center gap-1"
                          title={new Date(feed.createdAt).toLocaleString()}
                        >
                          <i className="ri-calendar-line text-theme" />
                          <span>{timeago(feed.createdAt)}</span>
                        </span>

                        {feed.createdAt !== feed.updatedAt && (
                          <>
                            <span>·</span>
                            <span
                              className="inline-flex items-center gap-1"
                              title={new Date(feed.updatedAt).toLocaleString()}
                            >
                              <i className="ri-refresh-line" />
                              <span>更新于 {timeago(feed.updatedAt)}</span>
                            </span>
                          </>
                        )}

                        {counterEnabled && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 font-mono text-[11px]">
                            <span>{t("count.pv")} {feed.pv}</span>
                            <span>·</span>
                            <span>{t("count.uv")} {feed.uv}</span>
                          </span>
                        )}
                      </div>

                      {/* 右侧独立操作按钮群 */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {/* 一键复制链接 */}
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          title={copiedLink ? "链接已复制到剪贴板！" : "点击复制文章直链"}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-theme/10 hover:text-theme text-neutral-600 dark:text-neutral-300 transition"
                        >
                          <i className={copiedLink ? "ri-check-line text-emerald-500 text-sm" : "ri-file-copy-line text-sm"} />
                        </button>

                        {/* 分享菜单浮层 */}
                        <div ref={shareMenuRef} className="relative">
                          <button
                            type="button"
                            onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
                            title="分享此文章"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-theme/10 hover:text-theme text-neutral-600 dark:text-neutral-300 transition"
                          >
                            <i className="ri-share-forward-line text-sm" />
                          </button>

                          {isShareMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-2 z-40 p-2.5 rounded-2xl bg-w shadow-2xl border border-black/10 dark:border-white/10 w-48 flex flex-col gap-1 ani-show"
                            >
                              <div className="text-[10px] font-mono text-neutral-400 px-2 py-1 uppercase tracking-wider">
                                分享文章至
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  handleCopyMarkdown(feed.title || "画廊随想");
                                  setIsShareMenuOpen(false);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-xs text-left text-neutral-700 dark:text-neutral-200 transition"
                              >
                                <i className="ri-markdown-line text-theme" />
                                <span>{copiedMarkdown ? "已复制 Markdown!" : "复制 Markdown 引用"}</span>
                              </button>
                              <a
                                href={`https://service.weibo.com/share/share.php?url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent(feed.title || "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsShareMenuOpen(false)}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-xs text-left text-neutral-700 dark:text-neutral-200 transition"
                              >
                                <i className="ri-weibo-line text-rose-500" />
                                <span>分享到新浪微博</span>
                              </a>
                              <a
                                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(feed.title || "")}&url=${encodeURIComponent(window.location.href)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsShareMenuOpen(false)}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-xs text-left text-neutral-700 dark:text-neutral-200 transition"
                              >
                                <i className="ri-twitter-x-line" />
                                <span>分享到 X (Twitter)</span>
                              </a>
                              <a
                                href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(feed.title || "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsShareMenuOpen(false)}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-xs text-left text-neutral-700 dark:text-neutral-200 transition"
                              >
                                <i className="ri-telegram-line text-sky-500" />
                                <span>分享到 Telegram</span>
                              </a>
                            </div>
                          )}
                        </div>

                        {profile?.permission && (
                          <div className="flex gap-1.5 ml-1">
                            <button
                              aria-label={top > 0 ? t("untop.title") : t("top.title")}
                              onClick={topFeed}
                              title={top > 0 ? "取消置顶" : "置顶文章"}
                              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${top > 0 ? "bg-theme text-white hover:bg-theme-hover active:bg-theme-active" : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300"}`}
                            >
                              <i className="ri-skip-up-line" />
                            </button>
                            <button
                              type="button"
                              aria-label={t("edit")}
                              onClick={openQuickEdit}
                              title="在前台就地快速修改编辑此文章"
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:text-theme transition"
                            >
                              <i className="ri-edit-2-line" />
                            </button>
                            <button
                              aria-label={t("delete.title")}
                              onClick={deleteFeed}
                              title="删除文章"
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-neutral-400 hover:text-rose-500 transition"
                            >
                              <i className="ri-delete-bin-7-line" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                {(hasAISummary || showAISummaryState) && (
                  <div className="my-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <i className="ri-sparkling-2-fill text-purple-500" />
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          {t('ai_summary.title')}
                        </span>
                      </div>
                      {showAISummaryState ? (
                        <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-white/10 dark:text-purple-300">
                          {t(`ai_summary.status.${feed.ai_summary_status}`)}
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed t-secondary [overflow-wrap:anywhere]">
                      {hasAISummary ? feed.ai_summary : t(`ai_summary.message.${feed.ai_summary_status}`)}
                    </p>
                    {feed.ai_summary_status === "failed" && feed.ai_summary_error ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-rose-600 dark:text-rose-300 [overflow-wrap:anywhere]">
                        {feed.ai_summary_error}
                      </p>
                    ) : null}
                  </div>
                )}
                <Markdown content={feed.content} />
                <div className="mt-6 flex flex-col gap-2">
                  {hashtags.length > 0 && (
                    <div className="flex flex-row flex-wrap gap-2">
                      {hashtags.map(({ name }, index) => (
                        <HashTag key={index} name={name} currentFeedId={feed.id} />
                      ))}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-row items-center">
                    <ImageWithFallback
                      src={feed.user.avatar || "/avatar.png"}
                      alt={feed.user.username}
                      className="h-8 w-8 rounded-full"
                    />
                    <div className="ml-2 min-w-0">
                      <span className="block truncate text-sm text-gray-400 cursor-default">
                        {feed.user.username}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 原创版权与底部分享条 */}
                <div className="mt-8 p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold t-primary">本文链接：{typeof window !== "undefined" ? window.location.href : ""}</span>
                    <span className="text-neutral-400 text-[11px]">本作品采用 CC BY-NC-SA 4.0 国际许可协议进行许可，转载请保留出处。</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 rounded-xl bg-theme text-white font-bold hover:bg-theme-hover active:scale-95 transition flex items-center gap-1 shadow-2xs"
                    >
                      <i className="ri-file-copy-line" />
                      <span>{copiedLink ? "已复制!" : "复制分享链接"}</span>
                    </button>
                  </div>
                </div>
              </article>
              {id !== "about" && <AdjacentSection id={id} setError={setError} />}
              {feed && (
                <GalleryComments
                  feedId={`${feed.id}`}
                  enabled={Boolean(config.getBoolean("comment.enabled"))}
                  profile={profile}
                />
              )}
              <div className="h-16" />
            </main>
            <div className="w-80 hidden lg:block relative">
              <div
                className={`start-0 end-0 top-[5.5rem] sticky flex flex-col gap-4 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none`}
              >
                <TOC />

                {/* 灵感标签漫游推荐卡片 (仅 PC 端右侧宽屏呈现，不破坏正文与移动端视觉) */}
                {recommendedTags.length > 0 && (
                  <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white/75 dark:bg-neutral-900/75 backdrop-blur-md shadow-2xs space-y-2.5 ani-show">
                    <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-1.5 text-xs font-bold t-primary">
                        <span className="text-theme">🏷️</span>
                        <span>灵感标签漫游</span>
                      </div>
                      <Link href="/hashtags" className="text-[11px] text-neutral-400 hover:text-theme transition">
                        星云 ➔
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {recommendedTags.map((tag, idx) => {
                        const pastel = [
                          "bg-amber-100/80 text-amber-900 border-amber-300/50 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/40",
                          "bg-sky-100/80 text-sky-900 border-sky-300/50 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/40",
                          "bg-rose-100/80 text-rose-900 border-rose-300/50 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/40",
                          "bg-emerald-100/80 text-emerald-900 border-emerald-300/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/40",
                          "bg-purple-100/80 text-purple-900 border-purple-300/50 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/40",
                        ];
                        const colorClass = pastel[idx % pastel.length];
                        return (
                          <Link
                            key={tag.id}
                            href={`/hashtag/${encodeURIComponent(tag.name)}`}
                            className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition hover:scale-105 select-none ${colorClass}`}
                          >
                            #{tag.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {/* Lightbox 大图全屏画廊预览 */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 ani-show cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl transition"
            title="关闭大图预览"
          >
            <i className="ri-close-line" />
          </button>
          <img
            src={lightboxImage}
            alt="Enlarged Cover"
            className="max-h-[90vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 就地文章快速编辑弹窗 (无需跳转后台，零额外重型分包开销) */}
      {isQuickEditOpen && (
        <Modal
          isOpen={isQuickEditOpen}
          onRequestClose={() => !isSavingEdit && setIsQuickEditOpen(false)}
          contentLabel="就地快速编辑文章"
          panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-3xl w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl"
        >
          <div className="flex flex-col gap-3.5 max-h-[85vh]">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shadow-2xs">
                  <i className="ri-quill-pen-line" />
                </span>
                <div>
                  <h3 className="text-sm font-bold t-primary">就地编辑文章 · #{feed?.id}</h3>
                  <p className="text-[11px] text-neutral-400">原地即时修改正文与概要，保存后秒级呈现，无需跳转离开</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickEditOpen(false)}
                disabled={isSavingEdit}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            {/* 标题 */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-500">文章标题</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs font-bold t-primary outline-none focus:border-theme"
                placeholder="输入文章标题..."
              />
            </div>

            {/* Markdown 正文 */}
            <div className="space-y-1 flex-1 flex flex-col min-h-0">
              <label className="text-[11px] font-bold text-neutral-500">Markdown 正文内容</label>
              <textarea
                rows={12}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full flex-1 rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] p-3 text-xs font-mono t-primary outline-none focus:border-theme resize-none scrollbar-thin"
                placeholder="在此输入或粘贴 Markdown 正文..."
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-xs">
              <Link
                href={`/admin/writing/${feed?.id}`}
                className="text-neutral-400 hover:text-theme transition"
              >
                前往完整后台工坊 ➔
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickEditOpen(false)}
                  disabled={isSavingEdit}
                  className="px-4 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickEdit}
                  disabled={isSavingEdit || !editTitle.trim()}
                  className="px-5 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1"
                >
                  {isSavingEdit && <i className="ri-loader-4-line animate-spin" />}
                  <span>{isSavingEdit ? "保存中..." : "保存并在前台生效"}</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <AlertUI />
      <ConfirmUI />
    </Waiting>
  );
}

export { TOCHeader } from "../components/toc-header";
