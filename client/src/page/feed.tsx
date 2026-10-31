import type { Feed } from "@rin/api";
import { Modal } from "@rin/ui";
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
import mermaid from "mermaid";
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

export function FeedPage({ id, TOC, clean }: { id: string, TOC: () => JSX.Element, clean: (id: string) => void }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
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
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
    });
    mermaid.run({
      suppressErrors: true,
      nodes: document.querySelectorAll("pre.mermaid_default")
    }).then(() => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
      });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_dark")
      });
    })
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
                  <div className="pt-2">
                    {profile?.permission && (
                      <div className="flex gap-2">
                        <button
                          aria-label={top > 0 ? t("untop.title") : t("top.title")}
                          onClick={topFeed}
                          className={`flex-1 flex flex-col items-end justify-center px-2 py rounded-full transition ${top > 0 ? "bg-theme text-white hover:bg-theme-hover active:bg-theme-active" : "bg-secondary bg-button dark:text-neutral-400"}`}
                        >
                          <i className="ri-skip-up-line" />
                        </button>
                        <Link
                          aria-label={t("edit")}
                          href={`/admin/writing/${feed.id}`}
                          className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                        >
                          <i className="ri-edit-2-line dark:text-neutral-400" />
                        </Link>
                        <button
                          aria-label={t("delete.title")}
                          onClick={deleteFeed}
                          className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                        >
                          <i className="ri-delete-bin-7-line text-red-500" />
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

export function TOCHeader({ TOC }: { TOC: () => JSX.Element }) {
  const [isOpened, setIsOpened] = useState(false);

  return (
    <div className="shrink-0 lg:hidden">
      <button
        onClick={() => setIsOpened(true)}
        className="w-10 h-10 rounded-full flex flex-row items-center justify-center"
      >
        <i className="ri-menu-2-line text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 ri-lg md:ri-sm md:t-secondary"></i>
      </button>
      <Modal
        isOpen={isOpened}
        onRequestClose={() => setIsOpened(false)}
        contentLabel="Table of contents"
        size="lg"
        panelClassName="p-4"
      >
        <div className="relative max-h-[75vh] overflow-auto t-primary">
          <TOC />
        </div>
      </Modal>
    </div>
  );
}
