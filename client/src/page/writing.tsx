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
import mermaid from 'mermaid';
import { MarkdownEditor } from '../components/markdown_editor';
import { Markdown } from "../components/markdown";

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
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [autoRunOnPublish, setAutoRunOnPublish] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [pipelinePreviewData, setPipelinePreviewData] = useState<{ result: string; summary?: string } | null>(null);
  const { showAlert, AlertUI } = useAlert();

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
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
      });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_default")
      }).then(()=>{
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
        });
        mermaid.run({
          suppressErrors: true,
          nodes: document.querySelectorAll("pre.mermaid_dark")
        });
      })
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
          <div className="flex flex-row gap-4 border-b border-black/5 pb-5 dark:border-white/5 items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">{t('writing')}</p>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                {id !== undefined ? t("update.title") : t("publish.title")}
              </p>
            </div>
            <PublishButton className="w-auto" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Input
                id={id}
                value={title}
                setValue={setTitle}
                placeholder={t("title")}
                variant="flat"
                className="text-base"
              />
            </div>
            <Input
              id={id}
              value={summary}
              setValue={setSummary}
              placeholder={t("summary")}
              variant="flat"
            />
            <Input
              id={id}
              value={alias}
              setValue={setAlias}
              placeholder={t("alias")}
              variant="flat"
            />
            <Input
              id={id}
              value={tags}
              setValue={setTags}
              placeholder={t("tags")}
              variant="flat"
              className="lg:col-span-2"
            />
          </div>

          <div className="mt-5 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
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

        {/* AI Intelligent Pipeline Control Bar for Article Authoring */}
        <div className="rounded-2xl border border-black/10 bg-w p-3.5 sm:p-4 shadow-2xs dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/5 dark:border-white/5">
            <div>
              <div className="text-sm font-bold t-primary flex items-center gap-2">
                <i className="ri-sparkling-2-line text-theme" />
                <span>AI 智能流水线梳理（按需开关流程与一键整理）</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                支持针对当前文章自由开关 3 大阶段；点击立即梳理，或在发布时按需自动执行
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-300 select-none">
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-50"
              >
                {runningPipeline ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    <span>AI 正在梳理中…</span>
                  </>
                ) : (
                  <>
                    <i className="ri-magic-line" />
                    <span>立即一键梳理文章</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2.5">
            <span className="text-xs font-semibold text-neutral-400 mr-1">执行阶段勾选：</span>
            {[
              { id: "tech", label: "1. 教程与命令提炼", desc: "重点排查命令与配置代码块" },
              { id: "format", label: "2. 内容排版整理", desc: "规范标题层级与中英空格留白" },
              { id: "summary", label: "3. 顶部 AI 摘要", desc: "在最顶部插入精炼卡片摘要" },
            ].map((stage) => {
              const isChecked = pipelineStages.includes(stage.id);
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => togglePipelineStage(stage.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition select-none ${
                    isChecked
                      ? "border-theme bg-theme/10 text-theme shadow-2xs"
                      : "border-black/10 bg-black/[0.02] text-neutral-500 hover:bg-black/5 dark:border-white/10 dark:bg-white/5"
                  }`}
                  title={stage.desc}
                >
                  <i className={isChecked ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"} />
                  <span>{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <FlatPanel className="relative z-10 overflow-hidden p-0">
          <MarkdownEditor content={content} setContent={setContent} height='680px' defaultPreview="comparison" />
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

          {/* 生成的 AI 摘要卡片预览 */}
          {pipelinePreviewData?.summary && (
            <div className="p-3.5 rounded-xl bg-theme/5 border border-theme/20 text-xs">
              <span className="font-bold text-theme flex items-center gap-1 mb-1">
                <i className="ri-file-text-line" />
                <span>AI 提炼摘要 (将作为文章独立摘要卡片展示)：</span>
              </span>
              <p className="t-primary leading-relaxed">{pipelinePreviewData.summary}</p>
            </div>
          )}

          {/* 梳理后的文章内容预览 */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 rounded-xl border border-black/10 bg-neutral-50/70 dark:border-white/10 dark:bg-neutral-900/40 text-sm">
            <Markdown content={pipelinePreviewData?.result || ""} />
          </div>

          {/* 底部操作栏 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                if (pipelinePreviewData?.result) {
                  navigator.clipboard.writeText(pipelinePreviewData.result);
                  showAlert("已成功复制梳理后的文章内容到剪贴板！");
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-w px-4 py-2 text-xs font-semibold t-primary hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/5 transition"
            >
              <i className="ri-file-copy-line text-sm" />
              <span>复制梳理结果</span>
            </button>

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
                    setPreviewModalOpen(false);
                    showAlert("已成功应用 AI 梳理结果并更新到编辑器中！如需撤销可按 Ctrl+Z。");
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

      <AlertUI />
    </>
  );
}
