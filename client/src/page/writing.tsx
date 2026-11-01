import i18n from 'i18next';
import _ from 'lodash';
import {useCallback, useEffect, useState} from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import Loading from 'react-loading';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
import { DateTimeInput, FlatMetaRow, FlatPanel, Modal } from "@rin/ui";
import { client } from "../app/runtime";
import {Cache} from '../utils/cache';
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants";
import { renderMermaidElements } from "../utils/render-mermaid";
import { MarkdownEditor } from '../components/markdown_editor';
import { Markdown } from "../components/markdown";
import { WritingAICopilotDrawer } from "../components/writing-ai-copilot-drawer";

async function publish({
  title,
  alias,
  listed,
  content,
  summary,
  tags,
  draft,
  createdAt,
  onCompleted,
  showAlert
}: {
  title: string;
  listed: boolean;
  content: string;
  summary: string;
  tags: string[];
  draft: boolean;
  alias?: string;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
  const t = i18n.t
  const { data, error } = await client.feed.create(
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
  }
  if (data) {
    showAlert(t("publish.success"), () => {
      Cache.with().clear();
      window.location.href = "/feed/" + data.insertedId;
    });
  }
}

async function update({
  id,
  title,
  alias,
  content,
  summary,
  tags,
  listed,
  draft,
  createdAt,
  onCompleted,
  showAlert
}: {
  id: number;
  listed: boolean;
  title?: string;
  alias?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  draft?: boolean;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
  const t = i18n.t
  const { error } = await client.feed.update(
    id,
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
  } else {
    showAlert(t("update.success"), () => {
      Cache.with(id).clear();
      window.location.href = "/feed/" + id;
    });
  }
}

// 写作页面
export function WritingPage({ id }: { id?: number }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const cache = Cache.with(id);
  const [title, setTitle] = cache.useCache("title", "");
  const [summary, setSummary] = cache.useCache("summary", "");
  const [tags, setTags] = cache.useCache("tags", "");
  const [alias, setAlias] = cache.useCache("alias", "");
  const [draft, setDraft] = useState(false);
  const [listed, setListed] = useState(true);
  const [content, setContent] = cache.useCache("content", "");
  const [createdAt, setCreatedAt] = useState<Date | undefined>(new Date());
  const [publishing, setPublishing] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [autoRunOnPublish, setAutoRunOnPublish] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [pipelinePreviewData, setPipelinePreviewData] = useState<{ result: string; summary?: string } | null>(null);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  useEffect(() => {
    const handleToggle = () => setCopilotOpen((p) => !p);
    window.addEventListener("toggle-ai-copilot", handleToggle);
    return () => window.removeEventListener("toggle-ai-copilot", handleToggle);
  }, []);

  const togglePipelineStage = (stage: string) => {
    setPipelineStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  const handleRunPipeline = async () => {
    if (!content.trim()) {
      showAlert("请先在编辑器中输入需要梳理的文章内容");
      return;
    }
    if (pipelineStages.length === 0) {
      showAlert("请至少勾选一个需要执行的 AI 阶段流程");
      return;
    }

    setRunningPipeline(true);
    try {
      const { data, error } = await client.config.runAIPipeline({
        content,
        stages: pipelineStages,
      });
      if (data?.success && data.result) {
        setPipelinePreviewData({
          result: data.result,
          summary: data.summary,
        });
        setPreviewModalOpen(true);
      } else {
        showAlert(data?.error || String(error?.value || "AI 流水线处理失败"));
      }
    } catch (err: any) {
      showAlert(err.message || "AI 处理异常");
    } finally {
      setRunningPipeline(false);
    }
  };
  async function publishButton() {
    if (publishing) return;
    if (!title && id === undefined) {
      showAlert(t("title_empty"));
      return;
    }
    if (!content && id === undefined) {
      showAlert(t("content.empty"));
      return;
    }

    let finalContent = content;
    let finalSummary = summary;

    if (autoRunOnPublish && pipelineStages.length > 0) {
      setPublishing(true);
      try {
        const { data } = await client.config.runAIPipeline({
          content,
          stages: pipelineStages,
        });
        if (data?.success && data.result) {
          finalContent = data.result;
          setContent(data.result);
          if (data.summary && (!summary || summary.trim().length === 0)) {
            finalSummary = data.summary;
            setSummary(data.summary);
          }
        }
      } catch {
        // Fallback to original content if pipeline fails
      }
    }

    const tagsplit =
      tags
        .split("#")
        .filter((tag) => tag !== "")
        .map((tag) => tag.trim()) || [];

    setPublishing(true);
    if (id !== undefined) {
      update({
        id,
        title,
        content: finalContent,
        summary: finalSummary,
        alias,
        tags: tagsplit,
        draft,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false);
        },
        showAlert,
      });
    } else {
      publish({
        title,
        content: finalContent,
        summary: finalSummary,
        tags: tagsplit,
        draft,
        alias,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false);
        },
        showAlert,
      });
    }
  }

  useEffect(() => {
    if (id) {
      client.feed
        .get(id)
        .then(({ data }) => {
          if (data) {
            // 编辑已有文章时，权威覆盖并更新为服务端最新文章内容，杜绝被本地陈旧缓存覆盖
            setTitle(data.title || "");
            if (Array.isArray(data.hashtags)) {
              setTags(data.hashtags.map(({ name }: { name: string }) => `#${name}`).join(" "));
            }
            setAlias((data as any).alias || "");
            setContent(data.content || "");
            setSummary((data as any).summary || "");
            setListed((data as any).listed === 1);
            setDraft((data as any).draft === 1);
            setCreatedAt(new Date(data.createdAt));
          }
        });
    }
  }, [id]);
  const debouncedUpdate = useCallback(
    _.debounce(() => {
      void renderMermaidElements();
    }, 100),
    []
  );
  useEffect(() => {
    debouncedUpdate();
  }, [content, debouncedUpdate]);
  function PublishButton({ className }: { className?: string }) {
    return (
      <button
        onClick={publishButton}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-theme px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-theme-hover active:bg-theme-active disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
        disabled={publishing}
      >
        {publishing && <Loading type="spin" height={16} width={16} />}
        <span>{t('publish.title')}</span>
      </button>
    );
  }

  function MetaInput({ className }: { className?: string }) {
    return (
        <FlatPanel className={className}>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <div className="flex-1 w-full min-w-0">
              <Input
                id={id}
                value={title}
                setValue={setTitle}
                placeholder={t("title") || "在此输入文章标题..."}
                variant="flat"
                className="text-base font-bold w-full"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsMetaExpanded((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition select-none ${
                  isMetaExpanded
                    ? "border-theme bg-theme/10 text-theme shadow-2xs"
                    : "border-black/10 bg-w text-neutral-600 hover:border-theme hover:text-theme dark:border-white/10 dark:text-neutral-300"
                }`}
                title={isMetaExpanded ? "收起文章属性面板" : "展开文章属性设置 (简介、别名、标签、可见性)"}
              >
                <i className="ri-settings-4-line text-sm" />
                <span className="hidden sm:inline">{isMetaExpanded ? "收起属性" : "属性设置"}</span>
                <i className={`ri-arrow-down-s-line text-xs transition-transform ${isMetaExpanded ? "rotate-180" : ""}`} />
              </button>
              <PublishButton className="w-auto" />
            </div>
          </div>

          {/* 可折叠的文章属性面板 (默认收起，点击展开) */}
          {isMetaExpanded && (
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 ani-show">
              <div className="grid gap-3 lg:grid-cols-2">
                <Input
                  id={id}
                  value={summary}
                  setValue={setSummary}
                  placeholder={t("summary") || "文章简介 / 导读摘要"}
                  variant="flat"
                />
                <Input
                  id={id}
                  value={alias}
                  setValue={setAlias}
                  placeholder={t("alias") || "文章自定义别名 (如 /about)"}
                  variant="flat"
                />
                <Input
                  id={id}
                  value={tags}
                  setValue={setTags}
                  placeholder={t("tags") || "文章标签 (空格或逗号分隔，如 #React #Vite)"}
                  variant="flat"
                  className="lg:col-span-2"
                />
              </div>

              <div className="mt-4 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
                <FlatMetaRow
                  className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
                  onClick={() => setDraft(!draft)}
                >
                  <p>{t('visible.self_only')}</p>
                  <Checkbox
                    id="draft"
                    value={draft}
                    setValue={setDraft}
                    placeholder={t('draft')}
                  />
                </FlatMetaRow>
                <FlatMetaRow
                  className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
                  onClick={() => setListed(!listed)}
                >
                  <p>{t('listed')}</p>
                  <Checkbox
                    id="listed"
                    value={listed}
                    setValue={setListed}
                    placeholder={t('listed')}
                  />
                </FlatMetaRow>
                <FlatMetaRow className="gap-3 rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3 xl:col-span-1">
                  <p className="mr-2 whitespace-nowrap">
                    {t('created_at')}
                  </p>
                  <DateTimeInput value={createdAt} onChange={setCreatedAt} className="w-full max-w-[16rem]" />
                </FlatMetaRow>
              </div>
            </div>
          )}
        </FlatPanel>
    )
  }

  return (
    <>
      <Helmet>
        <title>{`${t('writing')} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('writing')} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <div className="mt-2 flex flex-col gap-4 t-primary sm:gap-6">
        {MetaInput({ className: "relative z-20 p-4 sm:p-5 md:p-6" })}

        {/* Mac 终端 Bash 风格单行 AI 智能流水线工具条 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 rounded-2xl border border-black/10 bg-[#f8fafc] dark:bg-[#161b26] dark:border-white/10 text-xs shadow-2xs select-none">
          {/* 左侧 Mac Traffic Light 圆点与终端路径 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <span className="font-mono text-[11px] font-bold text-neutral-400 flex items-center gap-1">
              <i className="ri-terminal-box-line text-theme" />
              <span>bash ~ ai-pipeline</span>
            </span>
          </div>

          {/* 中间 3 阶段勾选胶囊 */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {[
              { id: "tech", label: "1. 教程提炼" },
              { id: "format", label: "2. 正文排版" },
              { id: "summary", label: "3. 导读生成" },
            ].map((stage) => {
              const isChecked = pipelineStages.includes(stage.id);
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => togglePipelineStage(stage.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    isChecked
                      ? "bg-theme text-white shadow-2xs"
                      : "bg-black/5 dark:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  <i className={isChecked ? "ri-check-line text-xs" : "ri-add-line text-xs"} />
                  <span>{stage.label}</span>
                </button>
              );
            })}
          </div>

          {/* 右侧自动执行开关与立即梳理按钮 */}
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={autoRunOnPublish}
                onChange={(e) => setAutoRunOnPublish(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
              />
              <span>发布时自动执行</span>
            </label>

            <button
              type="button"
              onClick={handleRunPipeline}
              disabled={runningPipeline || !content.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
            >
              {runningPipeline ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-xs" />
                  <span>梳理中…</span>
                </>
              ) : (
                <>
                  <i className="ri-magic-line text-xs" />
                  <span>立即梳理</span>
                </>
              )}
            </button>
          </div>
        </div>

        <FlatPanel className="relative z-10 overflow-hidden p-0 border border-black/10 dark:border-white/10 rounded-2xl shadow-sm">
          <MarkdownEditor content={content} setContent={setContent} height="calc(100vh - 240px)" defaultPreview="comparison" />
        </FlatPanel>
      </div>

      {/* AI Pipeline Result Preview Modal (供博主决定是否应用替换、复制或仅作参考) */}
      <Modal
        isOpen={previewModalOpen}
        onRequestClose={() => setPreviewModalOpen(false)}
        size="lg"
        contentLabel="AI 流水线梳理建议与结果预览"
        panelClassName="p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 max-h-[82vh]">
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
            <div>
              <h2 className="text-lg font-bold t-primary flex items-center gap-2">
                <i className="ri-sparkling-fill text-theme" />
                <span>AI 流水线梳理建议与结果预览</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                AI 梳理结果仅供参考对比，您可以复制、确认替换当前编辑器，或直接关闭保留原稿
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewModalOpen(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-white/5"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {/* 分区 1: 生成的 AI 摘要卡片 (独立分区，支持独立复制与独立设为简介) */}
          {pipelinePreviewData?.summary && !pipelinePreviewData.summary.includes("请提供") && !pipelinePreviewData.summary.includes("请发送") && (
            <div className="p-4 rounded-2xl bg-theme/5 border border-theme/20 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-theme flex items-center gap-1.5">
                  <i className="ri-sparkling-fill" />
                  <span>分区 A · AI 精炼摘要（文章独立卡片）</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pipelinePreviewData.summary || "");
                      showAlert("已复制 AI 摘要纯文本到剪贴板！");
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-theme/30 bg-w text-[11px] font-semibold text-theme hover:bg-theme/10 transition"
                  >
                    <i className="ri-file-copy-line" />
                    <span>仅复制摘要</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pipelinePreviewData.summary) {
                        setSummary(pipelinePreviewData.summary);
                        showAlert("已将 AI 摘要填入文章简介！");
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme text-white text-[11px] font-semibold hover:bg-theme-hover transition"
                  >
                    <i className="ri-check-line" />
                    <span>设为文章简介</span>
                  </button>
                </div>
              </div>
              <p className="t-primary text-xs leading-relaxed bg-white/60 dark:bg-black/30 p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                {pipelinePreviewData.summary}
              </p>
            </div>
          )}

          {/* 分区 2: 梳理后的文章正文结果 (独立分区，绝不混入摘要) */}
          <div className="flex-1 min-h-0 flex flex-col gap-2 rounded-2xl border border-black/10 bg-neutral-50/70 p-4 dark:border-white/10 dark:bg-neutral-900/40">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/5">
              <span className="font-bold text-xs t-primary flex items-center gap-1.5">
                <i className="ri-file-text-line text-theme" />
                <span>分区 B · 优化排版后的文章正文</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (pipelinePreviewData?.result) {
                    navigator.clipboard.writeText(pipelinePreviewData.result);
                    showAlert("已复制正文纯 Markdown 内容到剪贴板！");
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/10 bg-w text-[11px] font-semibold t-primary hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/5 transition"
              >
                <i className="ri-file-copy-line" />
                <span>仅复制正文</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 text-sm">
              <Markdown content={pipelinePreviewData?.result || ""} />
            </div>
          </div>

          {/* 底部操作栏：直接静默应用，绝不弹二次 Confirm 弹窗打断写作 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-black/5 dark:border-white/5">
            <p className="text-[11px] text-neutral-400">
              💡 提示：点击确认替换后将直接写入编辑器，绝不弹窗打扰写作，如需撤销可随时按 Ctrl+Z。
            </p>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 transition"
              >
                仅作参考 · 保留原稿
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pipelinePreviewData?.result) {
                    setContent(pipelinePreviewData.result);
                    if (pipelinePreviewData.summary && (!summary || summary.trim().length === 0)) {
                      setSummary(pipelinePreviewData.summary);
                    }
                    // 静默关闭弹窗，不弹任何二次阻塞 Alert！
                    setPreviewModalOpen(false);
                  }
                }}
                className="rounded-xl bg-theme px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-theme-hover transition"
              >
                ✍️ 确认应用并替换当前编辑器
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <WritingAICopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onToggle={() => setCopilotOpen((p) => !p)}
        articleContent={content}
        onInsertText={(text) => {
          setContent(content ? `${content}\n\n${text}` : text);
        }}
        onReplaceContent={(newContent) => {
          setContent(newContent);
        }}
        onApplySummary={(sum) => {
          setSummary(sum);
        }}
      />

      <AlertUI />
    </>
  );
}
