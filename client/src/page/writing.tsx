import i18n from 'i18next';
import _ from 'lodash';
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import {useSearch} from "wouter";
import Loading from 'react-loading';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
import { DateTimeInput, FlatPanel, Modal } from "@rin/ui";
import { client } from "../app/runtime";
import {Cache} from '../utils/cache';
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants";
import { renderMermaidElements } from "../utils/render-mermaid";
import { MarkdownEditor } from '../components/markdown_editor';
import { Markdown } from "../components/markdown";
import { WritingAICopilotDrawer } from "../components/writing-ai-copilot-drawer";
import { emitToast } from "../utils/toast";

function getFileIcon(key: string, contentType?: string) {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "ri-file-zip-line text-amber-500";
  if (["pdf"].includes(ext)) return "ri-file-pdf-line text-rose-500";
  if (["mp3", "flac", "wav", "m4a", "ogg"].includes(ext)) return "ri-music-2-line text-pink-500";
  if (["mp4", "mkv", "mov", "webm"].includes(ext)) return "ri-film-line text-violet-500";
  if (["doc", "docx", "txt", "md"].includes(ext)) return "ri-file-text-line text-blue-500";
  if (["exe", "bin", "apk", "dmg", "iso"].includes(ext)) return "ri-cpu-line text-emerald-500";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext) || contentType?.startsWith("image/")) return "ri-image-2-line text-theme";
  return "ri-file-3-line text-neutral-400";
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

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
  onSuccess,
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
  onSuccess?: () => void;
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
    Cache.with().clear();
    emitToast(t("publish.success"), "success");
    onSuccess?.();
    setTimeout(() => {
      window.location.href = "/feed/" + data.insertedId;
    }, 600);
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
  onSuccess,
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
  onSuccess?: () => void;
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
    Cache.with(id).clear();
    emitToast(t("update.success"), "success");
    onSuccess?.();
    setTimeout(() => {
      window.location.href = "/feed/" + id;
    }, 600);
  }
}

// 写作页面
export function WritingPage({ id: propId }: { id?: number }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const searchString = useSearch();

  // 双模兼容解析：既支持 /admin/writing/:id 路径参数，也无缝兼容 /admin/writing?id= 查询参数
  const id = useMemo(() => {
    if (typeof propId === "number" && propId > 0) return propId;
    try {
      const sp = new URLSearchParams(searchString);
      const qId = sp.get("id");
      if (qId && /^\d+$/.test(qId)) {
        const num = parseInt(qId, 10);
        if (num > 0) return num;
      }
    } catch {}
    return undefined;
  }, [propId, searchString]);

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
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [appliedSummary, setAppliedSummary] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const feedbackTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [autoRunOnPublish, setAutoRunOnPublish] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [pipelinePreviewData, setPipelinePreviewData] = useState<{ result: string; summary?: string } | null>(null);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const { showAlert, AlertUI } = useAlert();
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<"images" | "files">("images");
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // 仅过滤图片格式素材供文章插图使用，避免非图片混入其中造成破图
  const imageFiles = useMemo(() => {
    return mediaFiles.filter((file) => {
      const ext = file.key?.split(".").pop()?.toLowerCase() || "";
      const isImgExt = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext);
      return Boolean(file.contentType?.startsWith("image/") || isImgExt);
    });
  }, [mediaFiles]);

  const filteredImageFiles = useMemo(() => {
    if (!mediaSearchQuery.trim()) return imageFiles;
    const q = mediaSearchQuery.toLowerCase();
    return imageFiles.filter((file) => file.key?.toLowerCase().includes(q));
  }, [imageFiles, mediaSearchQuery]);

  const filteredAllFiles = useMemo(() => {
    if (!mediaSearchQuery.trim()) return mediaFiles;
    const q = mediaSearchQuery.toLowerCase();
    return mediaFiles.filter((file) => file.key?.toLowerCase().includes(q));
  }, [mediaFiles, mediaSearchQuery]);

  // 从后台读取自定义提示词预设库
  const [presetsList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("rin_ai_prompt_presets");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "preset_tech_std", stage: "tech", name: "教程提炼", stageLabel: "① 提炼" },
      { id: "preset_format_std", stage: "format", name: "排版整理", stageLabel: "② 排版" },
      { id: "preset_summary_std", stage: "summary", name: "导读生成", stageLabel: "③ 导读" },
      { id: "preset_custom_anime", stage: "custom", name: "二次元随笔", stageLabel: "④ 随笔" },
    ];
  });

  const loadMediaLibrary = () => {
    setLoadingMedia(true);
    client.storage
      .listFiles()
      .then(({ data }) => {
        if (data?.files && Array.isArray(data.files)) {
          setMediaFiles(data.files);
        }
      })
      .finally(() => setLoadingMedia(false));
  };

  const insertImageToContent = (url: string, name?: string) => {
    const mdImg = `\n\n![${name || "图片"}](${url})\n\n`;
    setContent(content ? `${content}${mdImg}` : mdImg);
    setImagePickerOpen(false);
  };

  const insertFileLinkToContent = (url: string, name?: string, asDownloadCard = true) => {
    const fileName = name || url.split("/").pop() || "附件文件";
    const insertText = asDownloadCard
      ? `\n\n<a href="${url}" download="${fileName}">📥 下载 ${fileName}</a>\n\n`
      : `\n\n[${fileName}](${url})\n\n`;
    setContent(content ? `${content}${insertText}` : insertText);
    setImagePickerOpen(false);
  };

  useEffect(() => {
    const handleToggle = () => setCopilotOpen((p) => !p);
    window.addEventListener("toggle-ai-copilot", handleToggle);
    const timers = feedbackTimersRef.current;
    return () => {
      window.removeEventListener("toggle-ai-copilot", handleToggle);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const scheduleFeedbackReset = useCallback((fn: () => void, ms = 2000) => {
    const timer = setTimeout(() => {
      feedbackTimersRef.current.delete(timer);
      fn();
    }, ms);
    feedbackTimersRef.current.add(timer);
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
    setPublishSuccess(false);
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
        onSuccess: () => {
          setPublishSuccess(true);
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
        onSuccess: () => {
          setPublishSuccess(true);
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
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-2xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 transition-all ${
          publishSuccess ? "bg-emerald-600" : "bg-theme hover:bg-theme-hover"
        } ${className ?? ""}`}
        disabled={publishing}
      >
        {publishing ? (
          <Loading type="spin" height={14} width={14} />
        ) : publishSuccess ? (
          <i className="ri-check-line text-sm" />
        ) : null}
        <span>{publishSuccess ? "✓ 已保存" : t('publish.title') || "发布文章"}</span>
      </button>
    );
  }

  function MetaInput({ className: _className }: { className?: string }) {
    return (
        <div className="w-full flex flex-col gap-2">
          {/* 48px 单行沉浸式顶栏：左侧返回画廊与标题，右侧属性设置 + 紧凑发布按钮 */}
          <div className="flex items-center justify-between gap-2.5 w-full h-12 px-3 rounded-xl border border-neutral-200/80 bg-white/90 dark:border-white/10 dark:bg-[#12141a]/90 backdrop-blur-md shadow-2xs select-none">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = "/";
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200/80 dark:border-white/10 hover:border-theme hover:text-theme text-xs font-semibold text-neutral-600 dark:text-neutral-300 transition shrink-0"
              title="返回前台画廊"
            >
              <i className="ri-arrow-left-line text-sm" />
              <span className="hidden sm:inline">返回画廊</span>
            </button>
            <div className="h-4 w-px bg-neutral-200 dark:bg-white/10 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("title") || "在此输入文章标题..."}
                className="w-full bg-transparent text-sm sm:text-base font-extrabold t-primary outline-none placeholder:text-neutral-400 placeholder:font-normal"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCopilotOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition select-none ${
                  copilotOpen
                    ? "border-theme bg-theme text-white shadow-2xs font-bold"
                    : "border-theme/30 bg-theme/5 text-theme hover:bg-theme/10"
                }`}
                title="呼出 / 收起画廊文字侍从"
              >
                <i className="ri-sparkling-fill text-xs" />
                <span>文字侍从</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMetaExpanded((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition select-none ${
                  isMetaExpanded
                    ? "border-theme bg-theme/10 text-theme"
                    : "border-black/10 bg-black/[0.02] text-neutral-600 hover:border-theme hover:text-theme dark:border-white/10 dark:bg-white/[0.02] dark:text-neutral-300"
                }`}
                title={isMetaExpanded ? "收起文章属性面板" : "展开文章属性设置 (简介、别名、标签、可见性)"}
              >
                <i className="ri-equalizer-line text-xs" />
                <span className="hidden sm:inline">{isMetaExpanded ? "收起属性" : "属性设置"}</span>
                <i className={`ri-arrow-down-s-line text-xs transition-transform ${isMetaExpanded ? "rotate-180" : ""}`} />
              </button>
              <PublishButton className="w-auto" />
            </div>
          </div>

          {/* 可折叠的文章属性面板 (默认收起，点击展开) */}
          {isMetaExpanded && (
            <div className="p-3.5 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] shadow-xs ani-show">
              <div className="grid gap-3 lg:grid-cols-2">
                <Input
                  id={id}
                  value={summary}
                  setValue={setSummary}
                  placeholder={t("summary") || "文章简介 / 导读摘要"}
                  variant="flat"
                  className="w-full"
                />
                <Input
                  id={id}
                  value={alias}
                  setValue={setAlias}
                  placeholder={t("alias") || "文章自定义别名 (如 /about)"}
                  variant="flat"
                  className="w-full"
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

              <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-5">
                  {/* 1. 草稿状态开关 */}
                  <label
                    htmlFor="draft"
                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                    title={draft ? "当前为【草稿】：仅博主在后台草稿箱可见，前台不公开发布" : "当前为【正式】：发布后将正式呈现给访客"}
                  >
                    <Checkbox
                      id="draft"
                      placeholder={t("draft") || "草稿"}
                      title={draft ? "草稿箱模式 (点击切换为正式发布)" : "正式文章模式 (点击存为草稿)"}
                      value={draft}
                      setValue={setDraft}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs t-primary flex items-center gap-1 group-hover:text-theme transition-colors">
                        <i className={`text-xs ${draft ? "ri-draft-line text-amber-500" : "ri-article-line text-emerald-500"}`} />
                        <span>草稿模式</span>
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {draft ? "草稿箱 (仅后台可见)" : "正式发布 (公开展现)"}
                      </span>
                    </div>
                  </label>

                  {/* 2. 首页列表可见性开关 */}
                  <label
                    htmlFor="listed"
                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                    title={listed ? "当前为【公开显示】：文章将正常出现在首页流与分类列表中" : "当前为【未列出】：不在首页流展示，仅知晓具体链接的人可访问 (轻量私密)"}
                  >
                    <Checkbox
                      id="listed"
                      placeholder={t("listed") || "列出在文章中"}
                      title={listed ? "公开列出模式 (点击切换为隐藏未列出)" : "未列出隐藏模式 (点击切换为首页公开)"}
                      value={listed}
                      setValue={setListed}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs t-primary flex items-center gap-1 group-hover:text-theme transition-colors">
                        <i className={`text-xs ${listed ? "ri-eye-line text-theme" : "ri-eye-off-line text-neutral-400"}`} />
                        <span>列表可见</span>
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {listed ? "在首页列表中公开" : "未列出 (仅知直链可访)"}
                      </span>
                    </div>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 font-mono text-[11px]">发表时间:</span>
                  <DateTimeInput value={createdAt} onChange={setCreatedAt} className="w-full max-w-[15rem]" />
                </div>
              </div>
            </div>
          )}
        </div>
    );
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

        {/* Mac 终端 Bash 风格单行 AI 智能流水线工具条 + 图床选图插图入口 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-1.5 rounded-xl border border-black/10 bg-[#f8fafc] dark:bg-[#161b26] dark:border-white/10 text-xs shadow-2xs select-none">
          {/* 左侧 Mac Traffic Light 圆点与终端路径 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <span className="font-mono text-[11px] font-bold text-neutral-400 flex items-center gap-1">
              <i className="ri-terminal-box-line text-theme" />
              <span>ai-pipeline</span>
            </span>
          </div>

          {/* 中间：联动后台提示词预设库的流水线阶段勾选 */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {presetsList.map((preset) => {
              const isChecked = pipelineStages.includes(preset.stage);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => togglePipelineStage(preset.stage)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    isChecked
                      ? "bg-theme text-white shadow-2xs"
                      : "bg-black/5 dark:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                  title={preset.name}
                >
                  <i className={isChecked ? "ri-check-line text-xs" : "ri-add-line text-xs"} />
                  <span>{preset.stageLabel || preset.name}</span>
                </button>
              );
            })}
          </div>

          {/* 右侧：图床选图/文件链接按钮 + 自动执行开关与立即梳理按钮 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 图床插图快捷按钮 */}
            <button
              type="button"
              onClick={() => {
                setMediaPickerTab("images");
                setImagePickerOpen(true);
                loadMediaLibrary();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme text-xs font-semibold transition cursor-pointer"
              title="挑选图库照片并插入文章"
            >
              <i className="ri-image-add-line text-xs text-theme" />
              <span>图床插图</span>
            </button>

            {/* 插入文件链接快捷按钮 */}
            <button
              type="button"
              onClick={() => {
                setMediaPickerTab("files");
                setImagePickerOpen(true);
                loadMediaLibrary();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme text-xs font-semibold transition cursor-pointer"
              title="挑选云端文件并插入下载链接"
            >
              <i className="ri-attachment-2 text-xs text-theme" />
              <span>插入文件链接</span>
            </button>

            <label className="flex items-center gap-1 cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={autoRunOnPublish}
                onChange={(e) => setAutoRunOnPublish(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
              />
              <span className="hidden sm:inline">自动执行</span>
            </label>

            <button
              type="button"
              onClick={handleRunPipeline}
              disabled={runningPipeline || !content.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme px-3 py-1 text-xs font-bold transition disabled:opacity-50"
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
                      void navigator.clipboard.writeText(pipelinePreviewData.summary || "");
                      setCopiedSummary(true);
                      scheduleFeedbackReset(() => setCopiedSummary(false), 2000);
                      emitToast("已复制 AI 摘要纯文本到剪贴板！", "success");
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-theme/30 bg-w text-[11px] font-semibold text-theme hover:bg-theme/10 transition"
                  >
                    <i className={copiedSummary ? "ri-check-line text-emerald-500" : "ri-file-copy-line"} />
                    <span>{copiedSummary ? "✓ 已复制" : "仅复制摘要"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pipelinePreviewData.summary) {
                        setSummary(pipelinePreviewData.summary);
                        setAppliedSummary(true);
                        scheduleFeedbackReset(() => setAppliedSummary(false), 2000);
                        emitToast("已将 AI 摘要填入文章简介！", "success");
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold transition ${
                      appliedSummary ? "bg-emerald-600" : "bg-theme hover:bg-theme-hover"
                    }`}
                  >
                    <i className="ri-check-line" />
                    <span>{appliedSummary ? "✓ 已设为简介" : "设为文章简介"}</span>
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
                    void navigator.clipboard.writeText(pipelinePreviewData.result);
                    setCopiedBody(true);
                    scheduleFeedbackReset(() => setCopiedBody(false), 2000);
                    emitToast("已复制正文纯 Markdown 内容到剪贴板！", "success");
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/10 bg-w text-[11px] font-semibold t-primary hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/5 transition"
              >
                <i className={copiedBody ? "ri-check-line text-emerald-500" : "ri-file-copy-line"} />
                <span>{copiedBody ? "✓ 已复制" : "仅复制正文"}</span>
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
                确认应用并替换当前编辑器
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 图库素材挑选与文件链接插入 Modal */}
      <Modal
        isOpen={imagePickerOpen}
        onRequestClose={() => setImagePickerOpen(false)}
        size="lg"
        contentLabel="挑选图库素材与文件链接"
        panelClassName="p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 max-h-[82vh]">
          {/* 顶栏：标题 + 关闭 */}
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <i className="ri-folder-shared-line text-theme text-base" />
              <h3 className="font-bold text-sm t-primary">挑选图库素材与文件链接</h3>
            </div>
            <button
              type="button"
              onClick={() => setImagePickerOpen(false)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          {/* Tab 切换与搜索框 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setMediaPickerTab("images")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  mediaPickerTab === "images"
                    ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs font-bold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <i className="ri-image-line text-xs" />
                <span>相册图片 ({imageFiles.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaPickerTab("files")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  mediaPickerTab === "files"
                    ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs font-bold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <i className="ri-file-3-line text-xs" />
                <span>所有文件与附件 ({mediaFiles.length})</span>
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
              <input
                type="text"
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                placeholder="搜索文件名..."
                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg bg-black/5 dark:bg-white/5 border border-transparent focus:border-theme/40 outline-hidden transition"
              />
            </div>
          </div>

          {/* 素材列表区域 */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-[240px]">
            {loadingMedia ? (
              <div className="flex items-center justify-center py-20 text-neutral-400 text-xs">
                <i className="ri-loader-4-line animate-spin text-xl text-theme mr-2" />
                <span>正在加载素材库…</span>
              </div>
            ) : mediaPickerTab === "images" ? (
              filteredImageFiles.length === 0 ? (
                <div className="py-14 text-center text-xs text-neutral-400">
                  {mediaSearchQuery ? "未检索到匹配的图片素材" : "暂无图片素材，可前往图库相册上传"}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredImageFiles.map((file) => {
                    const fileName = file.key.split("/").pop() || file.key;
                    return (
                      <div
                        key={file.key}
                        className="group relative flex flex-col items-center justify-between rounded-xl border border-black/10 dark:border-white/10 p-2 bg-black/[0.015] dark:bg-white/[0.02] hover:border-theme hover:shadow-xs transition"
                      >
                        <div
                          onClick={() => insertImageToContent(file.url, fileName)}
                          className="h-24 w-full flex items-center justify-center overflow-hidden rounded-lg bg-black/5 dark:bg-white/5 cursor-pointer relative"
                          title="点击以 Markdown 图片语法直接插入文章"
                        >
                          <img
                            src={file.url}
                            alt={file.key}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-200"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate w-full mt-1.5 text-center" title={fileName}>
                          {fileName}
                        </span>
                        <div className="flex items-center gap-1 w-full mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => insertImageToContent(file.url, fileName)}
                            className="flex-1 py-0.5 rounded bg-theme/10 hover:bg-theme text-theme hover:text-white text-[10px] font-medium transition cursor-pointer text-center"
                            title="插入为图片 ![图片](url)"
                          >
                            插图
                          </button>
                          <button
                            type="button"
                            onClick={() => insertFileLinkToContent(file.url, fileName, false)}
                            className="flex-1 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-theme/10 text-neutral-600 dark:text-neutral-300 hover:text-theme text-[10px] font-medium transition cursor-pointer text-center"
                            title="插入为普通超链接 [链接](url)"
                          >
                            链接
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : filteredAllFiles.length === 0 ? (
              <div className="py-14 text-center text-xs text-neutral-400">
                {mediaSearchQuery ? "未检索到匹配的文件素材" : "暂无文件素材，可前往图库相册上传"}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredAllFiles.map((file) => {
                  const fileName = file.key.split("/").pop() || file.key;
                  return (
                    <div
                      key={file.key}
                      className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] hover:border-theme/40 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <i className={`text-xl shrink-0 ${getFileIcon(file.key, file.contentType)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate" title={fileName}>
                            {fileName}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => insertFileLinkToContent(file.url, fileName, true)}
                          className="px-2 py-1 rounded-md bg-theme text-white text-[10px] font-semibold hover:bg-theme-hover transition shadow-2xs cursor-pointer flex items-center gap-0.5"
                          title="插入 HTML 下载框卡片语法"
                        >
                          <i className="ri-download-2-line text-xs" />
                          <span>下载卡片</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFileLinkToContent(file.url, fileName, false)}
                          className="px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 hover:bg-theme/10 text-neutral-600 dark:text-neutral-300 hover:text-theme text-[10px] font-medium transition cursor-pointer flex items-center gap-0.5"
                          title="插入标准 Markdown 链接 [文件名](url)"
                        >
                          <i className="ri-link text-xs" />
                          <span>链接</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
