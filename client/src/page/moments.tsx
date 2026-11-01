import { useContext, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { useTranslation } from "react-i18next";
import { ProfileContext } from "../state/profile";
import { tryInt } from "../utils/int";
import { Link, useSearch } from "wouter";
import { useAlert, useConfirm } from "../components/dialog";
import { Waiting } from "../components/loading";
import { MomentItem } from "../components/moment_item";

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

const MOMENT_STATUSES = [
  { id: "cute", label: "🐱 卖萌中", text: "> 🐱 **状态：卖萌中**\n\n" },
  { id: "fish", label: "🍵 摸鱼中", text: "> 🍵 **状态：摸鱼日常**\n\n" },
  { id: "casual", label: "☕ 随言随笔", text: "> ☕ **状态：随言随笔**\n\n" },
  { id: "code", label: "💡 灵感代码", text: "> 💡 **状态：灵感代码**\n\n" },
  { id: "game", label: "🎮 宅家战斗", text: "> 🎮 **状态：宅家游戏中**\n\n" },
  { id: "debug", label: "💻 正在Debug", text: "> 💻 **状态：正在排查Bug**\n\n" },
  { id: "daily", label: "🌟 今日日常", text: "> 🌟 **状态：今日份记录**\n\n" },
  { id: "chill", label: "🍃 放空发呆", text: "> 🍃 **状态：放空中**\n\n" },
];

const MOMENT_KAOMOJIS = [
  "(*/ω＼*)",
  "(=^･ω･^=)",
  "੭ ᐕ)੭",
  "φ(>ω<*)",
  "ヾ(≧▽≦*)o",
  "(っ˘ڡ˘ς)",
  "(o゜▽゜)o☆",
  "(ง •_•)ง",
];

export function MomentsPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [length, setLength] = useState(0);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPublisherOpen, setIsPublisherOpen] = useState(false);
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null);
  const [activeStatusId, setActiveStatusId] = useState<string>("");
  const query = new URLSearchParams(useSearch());
  const ref = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const publisherRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const profile = useContext(ProfileContext);
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const limit = Math.max(10, tryInt(siteConfig.pageSize, query.get("limit")));

  function fetchMoments(page = 1, append = false) {
    if (loadingMore) return;

    const isInitialLoad = page === 1 && !append;
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    client.moments
      .list({
        page: page,
        limit: limit,
      })
      .then(({ data }) => {
        if (data) {
          const list: Moment[] = Array.isArray((data as any).data)
            ? (data as any).data
            : Array.isArray(data)
            ? (data as any)
            : [];
          if (append) {
            setMoments((prev) => [...prev, ...list]);
          } else {
            setMoments(list);
          }
          setLength((data as any).size ?? list.length);
          setCurrentPage(page);
          setHasNextPage(Boolean((data as any).hasNext ?? (list.length >= limit)));
        }
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }

  function loadMore() {
    if (hasNextPage && !loadingMore) {
      fetchMoments(currentPage + 1, true);
    }
  }

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

  const handleApplyStatus = (status: (typeof MOMENT_STATUSES)[0]) => {
    setActiveStatusId(status.id);
    const statusRegex = /^> [^\n]+\n\n/;
    if (statusRegex.test(content)) {
      setContent(content.replace(statusRegex, status.text));
    } else {
      setContent(`${status.text}${content}`);
    }
    textareaRef.current?.focus();
  };

  function handleSubmit() {
    if (!content.trim()) return;

    setLoading(true);

    if (editingMoment) {
      client.moments
        .update(editingMoment.id, { content: content.trim() })
        .then(({ error }) => {
          if (error) {
            showAlert(t("update.failed$message", { message: error.value }));
          } else {
            setContent("");
            setEditingMoment(null);
            setIsPublisherOpen(false);
            fetchMoments(1, false);
            showAlert(t("update.success"));
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      client.moments
        .create({ content: content.trim() })
        .then(({ error }) => {
          if (error) {
            showAlert(t("publish.failed$message", { message: error.value }));
          } else {
            setContent("");
            setIsPublisherOpen(false);
            fetchMoments(1, false);
            showAlert(t("publish.success"));
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }

  function handleEdit(moment: Moment) {
    setEditingMoment(moment);
    setContent(moment.content);
    setIsPublisherOpen(true);
    setTimeout(() => {
      publisherRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textareaRef.current?.focus();
    }, 100);
  }

  function handleDelete(id: number) {
    showConfirm(t("delete.title"), t("delete.confirm"), () => {
      client.moments.delete(id).then(({ error }) => {
        if (error) {
          showAlert(t("delete.failed$message", { message: error.value }));
        } else {
          fetchMoments(1, false);
          showAlert(t("delete.success"));
        }
      });
    });
  }

  function openCreatePublisher() {
    setEditingMoment(null);
    setContent("");
    setIsPublisherOpen(true);
    setTimeout(() => {
      publisherRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textareaRef.current?.focus();
    }, 100);
  }

  useEffect(() => {
    const key = `${limit}`;
    if (ref.current === key) return;
    fetchMoments(1, false);
    ref.current = key;
  }, [limit]);

  return (
    <>
      <Helmet>
        <title>{`${t("moments.title")} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t("moments.title")} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <Waiting for={!loading}>
        <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
          {/* Moments Top Header */}
          <div className="wauto text-start py-4 mb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/10 dark:border-white/10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold mb-2">
                  <i className="ri-chat-smile-2-line" />
                  <span>朋友圈 · 碎碎念日常</span>
                </div>
                <h1
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight art-title-${
                    siteConfig.momentsTitleStyle || siteConfig.atelierTitleStyle || "aurora_flow"
                  }`}
                >
                  日常随想
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  共收录 {length} 条生活随想与技术碎碎念
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold t-primary shadow-2xs transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900"
                >
                  <i className="ri-arrow-left-line" />
                  <span>返回画廊</span>
                </Link>
                {profile?.permission && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isPublisherOpen && !editingMoment) {
                        setIsPublisherOpen(false);
                      } else {
                        openCreatePublisher();
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 ${
                      isPublisherOpen ? "bg-neutral-700 hover:bg-neutral-800" : "bg-theme hover:bg-theme-hover"
                    }`}
                  >
                    <i className={isPublisherOpen ? "ri-close-line" : "ri-edit-line"} />
                    <span>{isPublisherOpen ? "收起编辑器" : "发朋友圈动态"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="wauto">
            {/* 管理员登录状态下的轻量级画廊留言板式发布面板 */}
            {profile?.permission && isPublisherOpen && (
              <div
                ref={publisherRef}
                className="relative mb-6 rounded-3xl border border-black/10 bg-w p-4 sm:p-6 shadow-md dark:border-white/10 ani-show overflow-hidden"
              >
                {/* 顶部胶带微装饰 */}
                <div className="absolute -top-2.5 left-10 w-12 h-3.5 bg-theme/20 dark:bg-theme/30 backdrop-blur-xs rounded-xs rotate-[-2deg] pointer-events-none" />

                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm">
                      <i className="ri-terminal-box-line" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold t-primary">
                        {editingMoment ? "编辑朋友圈动态" : "发布朋友圈动态 (画廊留言板样式)"}
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        支持 Markdown、代码块、二次元心情胶囊与颜文字
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPublisherOpen(false);
                      setEditingMoment(null);
                      setContent("");
                    }}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-xs px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
                  >
                    取消
                  </button>
                </div>

                {/* 心情 / 状态快速切换胶囊 */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[11px] font-semibold text-neutral-400 shrink-0 mr-1">
                      心情状态:
                    </span>
                    {MOMENT_STATUSES.map((st) => {
                      const isSelected = activeStatusId === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleApplyStatus(st)}
                          className={`px-2.5 py-1 rounded-full text-xs transition select-none shrink-0 font-medium ${
                            isSelected
                              ? "bg-theme text-white shadow-2xs font-bold"
                              : "bg-black/[0.04] text-neutral-600 hover:bg-black/[0.08] dark:bg-white/5 dark:text-neutral-300"
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lightweight Format Toolbar */}
                <div className="flex flex-col rounded-2xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] overflow-hidden focus-within:border-theme focus-within:ring-2 focus-within:ring-theme/15 transition-all">
                  <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 text-xs text-neutral-500 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
                    <button
                      type="button"
                      onClick={() => insertFormat("**", "**", "加粗文字")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                      title="加粗 (**)"
                    >
                      <i className="ri-bold font-bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormat("*", "*", "斜体文字")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                      title="斜体 (*)"
                    >
                      <i className="ri-italic" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormat("> ", "", "引用内容")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                      title="引用文段 (>)"
                    >
                      <i className="ri-double-quotes-l" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFormat("`", "`", "code")}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition"
                      title="行内代码 (`)"
                    >
                      <i className="ri-code-s-slash-line" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        insertFormat(
                          "```bash\n",
                          "\n```",
                          "#!/bin/bash\n# Terminal Command\necho 'Hello Moments'"
                        )
                      }
                      className="flex h-7 items-center gap-1 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 hover:text-theme transition text-[11px] font-mono"
                      title="Mac终端 Bash 代码块"
                    >
                      <i className="ri-terminal-box-line" />
                      <span>Bash</span>
                    </button>

                    <div className="h-3 w-[1px] bg-black/10 dark:bg-white/10 mx-1" />

                    {/* 颜文字快捷胶囊 */}
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                      {MOMENT_KAOMOJIS.map((km) => (
                        <button
                          key={km}
                          type="button"
                          onClick={() => insertFormat(` ${km} `)}
                          className="px-2 py-0.5 rounded-full bg-theme/5 hover:bg-theme/15 text-theme text-[11px] transition select-none shrink-0"
                          title="插入颜文字"
                        >
                          {km}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="分享你的今日碎碎念、技术心得上报或者随心随笔...（支持 Markdown 与 Bash 终端块）"
                    className="w-full resize-none border-0 bg-transparent p-3.5 text-xs sm:text-sm leading-relaxed t-primary placeholder-neutral-400 outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 mt-1">
                  <span className="text-[11px] text-neutral-400">
                    {content.length} 字
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPublisherOpen(false);
                        setEditingMoment(null);
                        setContent("");
                      }}
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/5 transition"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading || !content.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-theme px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-theme-hover active:scale-95 disabled:opacity-50"
                    >
                      <i className="ri-send-plane-fill" />
                      <span>
                        {loading ? t("saving") : editingMoment ? t("update.title") : "发布动态"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Moments 动态列表 */}
            {moments && moments.length > 0 ? (
              <div className="space-y-6">
                {moments.map((moment) => (
                  <MomentItem
                    key={moment.id}
                    moment={moment}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    canManage={profile?.permission || false}
                  />
                ))}
              </div>
            ) : null}

            <Waiting for={!loadingMore}>
              <div className="py-4 text-center">
                {!hasNextPage && moments && moments.length > 0 ? (
                  <div className="text-gray-500 pt-6">{t("no_more")}</div>
                ) : hasNextPage ? (
                  <button
                    onClick={loadMore}
                    className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme hover:bg-theme-hover transition"
                  >
                    {t("load_more")}
                  </button>
                ) : null}
              </div>
            </Waiting>
          </div>
        </main>
      </Waiting>

      <AlertUI />
      <ConfirmUI />
    </>
  );
}
