import i18n from 'i18next';
import _ from 'lodash';
import {useCallback, useEffect, useState} from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import Loading from 'react-loading';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
import { DateTimeInput, FlatMetaRow, FlatPanel } from "@rin/ui";
import { client } from "../app/runtime";
import {Cache} from '../utils/cache';
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants";
import mermaid from 'mermaid';
import { MarkdownEditor } from '../components/markdown_editor';

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
  const [pipelineStages, setPipelineStages] = useState<string[]>(["tech", "format", "summary"]);
  const [autoRunOnPublish, setAutoRunOnPublish] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);
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
        setContent(data.result);
        if (data.summary && (!summary || summary.trim().length === 0)) {
          setSummary(data.summary);
        }
        showAlert("✨ AI 流水线梳理完成！已按选中的流程优化文章排版与命令，并更新至编辑器。");
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
            if (title == "" && data.title) setTitle(data.title);
            if (tags == "" && Array.isArray(data.hashtags))
              setTags(data.hashtags.map(({ name }: {name: string}) => `#${name}`).join(" "));
            if (alias == "" && (data as any).alias) setAlias((data as any).alias);
            if (content == "") setContent(data.content);
            if (summary == "") setSummary((data as any).summary || "");
            setListed((data as any).listed === 1);
            setDraft((data as any).draft === 1);
            setCreatedAt(new Date(data.createdAt));
          }
        });
    }
  }, []);
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
      <AlertUI />
    </>
  );
}
