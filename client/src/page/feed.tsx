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

  // 空间隔离三区弹幕数据模型 (顶部天花板双向轨道、左右大倾角浮动、中央微光破碎消散)
  const [triZoneDanmaku, setTriZoneDanmaku] = useState<{
    topTrack: Array<{ text: string; delay: string; duration: string; color: string; direction: "rtl" | "ltr" }>;
    leftFlank: Array<{ text: string; delay: string; duration: string; color: string; rot: string }>;
    rightFlank: Array<{ text: string; delay: string; duration: string; color: string; rot: string }>;
  }>({ topTrack: [], leftFlank: [], rightFlank: [] });

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
        const [feedRes, commentRes] = await Promise.all([
          client.feed.list({ limit: 12 }),
          client.comment.list(feed.id),
        ]);

        // 1. 区域 1：顶上天花板轨道 (真实读者留言)
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
          commentsList.push("漫步在画廊随想记忆工坊", "留下足迹与思想火花", "每一篇随笔都是长河里静止的微光");
        }

        // 2. 动态全站文章池洗牌（每次打开随机抽取不同文章，彻底告别固定）
        const allFetchedArticles: string[] = [];
        if (feedRes.data?.data && Array.isArray(feedRes.data.data)) {
          feedRes.data.data.forEach((f: any) => {
            if (f.id !== feed.id && f.title?.trim()) {
              const clean = cleanCaptionText(f.title.trim());
              if (clean) allFetchedArticles.push(clean);
            }
          });
        }

        // 随机洗牌算法 (Fisher-Yates Shuffle)
        const shuffledArticles = [...allFetchedArticles].sort(() => 0.5 - Math.random());

        // 3. 区域 2：左翼灵感风采区 (随机文章标题 + 二次元灵感短语交替)
        const leftBaseQuotes = [
          "一页一世界 · 随性画廊风采",
          "二次元微光美学与浮游微光",
          "岁月不语 惟石能言",
          "每一次灵感火花在此凝结",
        ];
        const leftSelected = [
          ...shuffledArticles.slice(0, 2),
          ...leftBaseQuotes.sort(() => 0.5 - Math.random()).slice(0, 2),
        ];

        // 4. 区域 3：右翼精选区 (动态随机抽取的其他精选文章标题)
        const rightSelected = shuffledArticles.length >= 4 
          ? shuffledArticles.slice(2, 6) 
          : ["边缘原生全栈架构", "时光长河岁月足迹", "Cloudflare Serverless", "极客终端代码高亮"];

        const topColors = ["#ffffff", "#38bdf8", "#facc15", "#4ade80", "#c084fc", "#ffd166"];
        const leftColors = ["#f472b6", "#c084fc", "#38bdf8", "#ffffff", "#ffd166"];
        const rightColors = ["#ffd166", "#4ade80", "#38bdf8", "#f472b6", "#c084fc"];
        
        // 显著放大的手绘错落大倾角 (肉眼清晰可见，极富灵动随性美感)
        const leftRots = ["rotate-[-5.5deg]", "rotate-[4.8deg]", "rotate-[-6.2deg]", "rotate-[5deg]"];
        const rightRots = ["rotate-[5.5deg]", "rotate-[-4.8deg]", "rotate-[6.2deg]", "rotate-[-5deg]"];

        // 提速后的灵动流速 (加快游动节奏，深入中心才消散)
        setTriZoneDanmaku({
          topTrack: commentsList.slice(0, 8).map((text, i) => ({
            text,
            delay: `${(1.2 + i * 3.8).toFixed(1)}s`,
            duration: `${(13 + (i % 3) * 2.5).toFixed(1)}s`,
            color: topColors[i % topColors.length],
            direction: i % 2 === 0 ? "rtl" : "ltr", // 奇偶双向交替对向飞越
          })),
          leftFlank: leftSelected.map((text, i) => ({
            text,
            delay: `${(i * 2.4).toFixed(1)}s`,
            duration: `${(4.8 + (i % 3) * 1.4).toFixed(1)}s`,
            color: leftColors[i % leftColors.length],
            rot: leftRots[i % leftRots.length],
          })),
          rightFlank: rightSelected.map((text, i) => ({
            text,
            delay: `${(0.6 + i * 2.5).toFixed(1)}s`,
            duration: `${(5.2 + (i % 3) * 1.5).toFixed(1)}s`,
            color: rightColors[i % rightColors.length],
            rot: rightRots[i % rightRots.length],
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
                      className="relative mb-6 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 max-h-[380px] overflow-hidden border-b border-black/10 dark:border-white/10 group cursor-zoom-in bg-black/[0.04] dark:bg-white/[0.03] flex items-center justify-center p-3 sm:p-5"
                      title="点击展开全屏画廊大图预览"
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

                      {/* 三区隔离画廊弹幕系统：顶部双向交替轨道、两侧显著大倾角、相遇晶体破碎消散 */}
                      {isDanmakuEnabled && (
                        <div className="absolute inset-0 z-20 pointer-events-none select-none overflow-hidden">
                          {/* 区域 1: 顶上轨道 (读者留言双向交替滑过：从左到右与从右到左对穿，避开左侧开关与右侧标签) */}
                          <div className="absolute top-3 inset-x-32 sm:inset-x-36 h-7 overflow-hidden">
                            {triZoneDanmaku.topTrack.map((dm, i) => (
                              <span
                                key={`top-${i}`}
                                style={{
                                  animation: `${dm.direction === "rtl" ? "danmaku-top-rtl" : "danmaku-top-ltr"} ${
                                    siteConfig.danmakuSpeed === "fast" ? "10s" : siteConfig.danmakuSpeed === "slow" ? "18s" : dm.duration
                                  } linear infinite`,
                                  animationDelay: dm.delay,
                                  color: dm.color,
                                  textShadow: "0 2px 8px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.85)",
                                }}
                                className={`absolute ${dm.direction === "rtl" ? "right-0" : "left-0"} whitespace-nowrap font-extrabold text-sm sm:text-base tracking-wide pointer-events-auto hover:[animation-play-state:paused] transition-transform cursor-default`}
                                title="读者留言弹幕 · 鼠标悬停定格"
                              >
                                {dm.text}
                              </span>
                            ))}
                          </div>

                          {/* 区域 2: 左翼灵感风采区 (显著手绘大倾角，向中心游动并粒子破碎消散，绝对禁止折行) */}
                          <div className="absolute left-2 sm:left-4 top-16 bottom-12 flex flex-col justify-around pointer-events-none">
                            {triZoneDanmaku.leftFlank.map((dm, i) => (
                              <div
                                key={`left-${i}`}
                                style={{
                                  animation: `danmaku-collide-left ${dm.duration} ease-in-out infinite`,
                                  animationDelay: dm.delay,
                                  color: dm.color,
                                  textShadow: "0 2px 8px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.85)",
                                }}
                                className={`transform ${dm.rot} text-xs sm:text-[13px] font-extrabold tracking-wide whitespace-nowrap pointer-events-auto hover:[animation-play-state:paused] hover:scale-105 transition-transform cursor-default`}
                                title="画廊随想美学风采"
                              >
                                {dm.text}
                              </div>
                            ))}
                          </div>

                          {/* 区域 3: 右翼精选标题区 (显著手绘大倾角，向中心游动并粒子破碎消散，绝对禁止折行) */}
                          <div className="absolute right-2 sm:right-4 top-16 bottom-12 flex flex-col justify-around items-end pointer-events-none text-right">
                            {triZoneDanmaku.rightFlank.map((dm, i) => (
                              <div
                                key={`right-${i}`}
                                style={{
                                  animation: `danmaku-collide-right ${dm.duration} ease-in-out infinite`,
                                  animationDelay: dm.delay,
                                  color: dm.color,
                                  textShadow: "0 2px 8px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.85)",
                                }}
                                className={`transform ${dm.rot} text-xs sm:text-[13px] font-extrabold tracking-wide whitespace-nowrap pointer-events-auto hover:[animation-play-state:paused] hover:scale-105 transition-transform cursor-default`}
                                title="全站漫游精选文章"
                              >
                                {dm.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 弹幕开关控制胶囊 (右上角快捷切换) */}
                      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleDanmaku}
                          title={isDanmakuEnabled ? "点击关闭海报弹幕" : "点击开启海报弹幕"}
                          className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md shadow-md transition-all select-none ${
                            isDanmakuEnabled
                              ? "bg-theme/90 text-white hover:bg-theme"
                              : "bg-black/60 text-neutral-300 hover:bg-black/80 hover:text-white"
                          }`}
                        >
                          <i className={isDanmakuEnabled ? "ri-chat-voice-line text-sm" : "ri-chat-off-line text-sm"} />
                          <span>{isDanmakuEnabled ? "弹幕: 开启" : "弹幕: 关闭"}</span>
                        </button>
                      </div>

                      {/* 浮动全屏查看标签 */}
                      <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-300 shadow-md">
                        <i className="ri-fullscreen-line text-sm" />
                        <span>全屏画廊大图</span>
                      </div>

                      {/* 左下角小展签 */}
                      <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[11px] font-bold text-white shadow-2xs">
                          EXHIBIT #{String(feed.id).padStart(4, "0")}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold t-primary break-all mb-2 leading-tight">
                      {feed.title}
                    </h1>
                    <div className="mt-1 mb-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-theme">
                        #{String(feed.id).padStart(4, "0")}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-time-line text-theme" />
                        <span>约 {readingMinutes} 分钟 ({wordCount} 字)</span>
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
                        <span
                          className="inline-flex items-center gap-1"
                          title={new Date(feed.updatedAt).toLocaleString()}
                        >
                          <i className="ri-refresh-line" />
                          <span>更新于 {timeago(feed.updatedAt)}</span>
                        </span>
                      )}

                      {counterEnabled && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5">
                          <span>{t("count.pv")} {feed.pv}</span>
                          <span>·</span>
                          <span>{t("count.uv")} {feed.uv}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-1.5 shrink-0">
                    {/* 一键复制链接 (纯矢量图标，观感清爽) */}
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      title={copiedLink ? "链接已复制到剪贴板！" : "点击复制文章直链"}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-theme/10 hover:text-theme text-neutral-600 dark:text-neutral-300 transition"
                    >
                      <i className={copiedLink ? "ri-check-line text-emerald-500 text-sm" : "ri-file-copy-line text-sm"} />
                    </button>

                    {/* 分享菜单浮层 (点击空白处自动收回) */}
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
                        <Link
                          aria-label={t("edit")}
                          href={`/admin/writing?id=${feed.id}`}
                          title="在后台修改编辑此文章"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:text-theme transition"
                        >
                          <i className="ri-edit-2-line" />
                        </Link>
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
                    <div className="flex flex-row flex-wrap gap-x-2">
                      {hashtags.map(({ name }, index) => (
                        <HashTag key={index} name={name} />
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
                className={`start-0 end-0 top-[5.5rem] sticky`}
              >
                <TOC />
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

      <AlertUI />
      <ConfirmUI />
    </Waiting>
  );
}

export { TOCHeader } from "../components/toc-header";

