import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { client } from "../../app/runtime";
import { useAlert } from "../dialog";
import { MarkdownEditor } from "../markdown_editor";
import { Checkbox, Input } from "../input";
import { Modal } from "@rin/ui";
import { Cache } from "../../utils/cache";
import { Markdown } from "../markdown";
import { WritingAICopilotDrawer } from "../writing-ai-copilot-drawer";

export function InSituWritingDrawer({
  isOpen,
  onClose,
  editId,
}: {
  isOpen: boolean;
  onClose: () => void;
  editId?: number | null;
}) {
  const { showAlert, AlertUI } = useAlert();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [alias, setAlias] = useState("");
  const [tags, setTags] = useState("");
  const [draft, setDraft] = useState(false);
  const [listed, setListed] = useState(true);
  const [isTop, setIsTop] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);
  const [isWideMode, setIsWideMode] = useState(false);

  // 随行文字侍从
  const [copilotOpen, setCopilotOpen] = useState(false);

  // AI 流水线状态
  const [pipelineStages, setPipelineStages] = useState<string[]>(["tech", "format", "summary"]);
  const [autoRunOnPublish, setAutoRunOnPublish] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [pipelinePreviewData, setPipelinePreviewData] = useState<{ result: string; summary?: string } | null>(null);

  // 全站既有标签候选池 (供博主点击快速选标，杜绝重复创建拼写不一的标签)
  const [availableTags, setAvailableTags] = useState<Array<{ id: number; name: string; count?: number }>>([]);

  // R2 图床相册快速挑选与插图（非阻塞水平胶卷模式，杜绝黑幕弹窗遮挡写作视线）
  const [showPhotoFilmstrip, setShowPhotoFilmstrip] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ESC 退出
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !previewModalOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, previewModalOpen, onClose]);

  // 加载全站既有标签库
  useEffect(() => {
    if (!isOpen) return;
    client.tag.list().then(({ data }) => {
      if (data && Array.isArray(data)) {
        setAvailableTags(data);
      }
    }).catch(() => {});
  }, [isOpen]);

  // 加载已有文章数据 (编辑模式)
  useEffect(() => {
    if (!isOpen) return;

    if (editId && editId > 0) {
      setLoading(true);
      client.feed
        .get(editId)
        .then(({ data }) => {
          if (data) {
            setTitle(data.title || "");
            setContent(data.content || "");
            setSummary((data as any).summary || "");
            setAlias((data as any).alias || "");
            setDraft((data as any).draft === 1);
            setListed((data as any).listed === 1);
            setIsTop((data as any).top === 1);
            if (Array.isArray(data.hashtags)) {
              setTags(data.hashtags.map((h: any) => `#${h.name}`).join(" "));
            }
          }
        })
        .finally(() => setLoading(false));

      fetch(`/api/feed/permission/${editId}`)
        .then((r) => r.json())
        .then((perm) => {
          if (perm?.password) setPassword(perm.password);
        })
        .catch(() => {});
    } else {
      // 创作新文章
      setTitle("");
      setContent("");
      setSummary("");
      setAlias("");
      setTags("");
      setDraft(false);
      setListed(true);
      setIsTop(false);
      setPassword("");
      setIsMetaExpanded(false);
    }
  }, [isOpen, editId]);

  const loadMediaLibrary = () => {
    setLoadingMedia(true);
    client.storage
      .listFiles({ limit: 40 })
      .then(({ data }) => {
        if (data?.files && Array.isArray(data.files)) {
          const imgs = data.files.filter((file: any) => {
            const ext = file.key?.split(".").pop()?.toLowerCase() || "";
            return (
              file.contentType?.startsWith("image/") ||
              ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext)
            );
          });
          setMediaFiles(imgs);
        }
      })
      .finally(() => setLoadingMedia(false));
  };

  const handleToggleFilmstrip = () => {
    const next = !showPhotoFilmstrip;
    setShowPhotoFilmstrip(next);
    if (next && mediaFiles.length === 0) {
      loadMediaLibrary();
    }
  };

  const insertImageToContent = (url: string, name?: string) => {
    const mdImg = `\n\n![${name || "插图"}](${url})\n\n`;
    setContent(content ? `${content}${mdImg}` : mdImg);
  };

  // 本地极速直传至 R2 并插入
  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoadingMedia(true);
      const { data, error } = await client.storage.upload(file);
      if (data?.url) {
        insertImageToContent(data.url, file.name);
        loadMediaLibrary();
      } else {
        showAlert(String(error?.value || "图片上传失败"));
      }
    } catch (err: any) {
      showAlert(err.message || "上传异常");
    } finally {
      setLoadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 标签交互：点击候选标签切换入/出
  const currentTagList = useMemo(() => {
    return tags
      .split(/[\s,#]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }, [tags]);

  const toggleTagPill = (tagName: string) => {
    const cleanName = tagName.trim().replace(/^#/, "");
    if (!cleanName) return;
    if (currentTagList.includes(cleanName)) {
      const next = currentTagList.filter((t) => t !== cleanName);
      setTags(next.map((t) => `#${t}`).join(" "));
    } else {
      const next = [...currentTagList, cleanName];
      setTags(next.map((t) => `#${t}`).join(" "));
    }
  };

  // AI 流水线阶段切换
  const togglePipelineStage = (stage: string) => {
    setPipelineStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    );
  };

  // 手动触发 AI 流水线梳理
  const handleRunPipeline = async () => {
    if (!content.trim()) {
      showAlert("请先在正文编辑器中输入需要梳理的内容");
      return;
    }
    if (pipelineStages.length === 0) {
      showAlert("请至少勾选一个需要执行的 AI 阶段");
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

  // 发布 / 保存
  const handlePublish = async () => {
    if (!title.trim()) {
      showAlert("请输入文章标题后再发布哦~");
      return;
    }
    if (!content.trim()) {
      showAlert("文章正文内容不能为空哦~");
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
      } catch {}
    }

    const tagArray = tags
      .split(/[\s,#]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setPublishing(true);

    try {
      if (editId && editId > 0) {
        const { error } = await client.feed.update(editId, {
          title: title.trim(),
          alias: alias.trim() || undefined,
          summary: finalSummary.trim(),
          content: finalContent,
          tags: tagArray,
          draft,
          listed,
          top: isTop ? 1 : 0,
        } as any);

        // 同步密码锁
        await fetch(`/api/feed/permission/${editId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: password.trim() ? "password" : "public",
            password: password.trim(),
            tip: "本文受专属访问密码保护，请输入密码查阅完整随想。",
          }),
        }).catch(() => {});

        if (error) {
          showAlert(String(error.value || "更新失败"));
        } else {
          showAlert("✓ 文章与权限策略已成功在场更新！", () => {
            Cache.with().clear();
            onClose();
            window.location.reload();
          });
        }
      } else {
        const { data, error } = await client.feed.create({
          title: title.trim(),
          alias: alias.trim() || undefined,
          summary: finalSummary.trim(),
          content: finalContent,
          tags: tagArray,
          draft,
          listed,
          top: isTop ? 1 : 0,
        } as any);

        if (data?.insertedId && password.trim()) {
          await fetch(`/api/feed/permission/${data.insertedId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "password",
              password: password.trim(),
              tip: "本文受专属访问密码保护，请输入密码查阅完整随想。",
            }),
          }).catch(() => {});
        }
        if (error) {
          showAlert(String(error.value || "发布失败"));
        } else if (data) {
          showAlert("✨ 新文章已在场成功发布！", () => {
            Cache.with().clear();
            onClose();
            window.location.href = `/feed/${data.insertedId}`;
          });
        }
      }
    } catch (err: any) {
      showAlert(err.message || "网络异常");
    } finally {
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-50 bg-black/30 dark:bg-black/50 backdrop-blur-xs ani-overlay-in"
        onClick={onClose}
      />

      {/* 右侧滑出写作抽屉（支持宽屏与最大化展开） */}
      <div
        className={`fixed top-0 bottom-0 right-0 z-50 w-full transition-all duration-300 ${
          isWideMode
            ? "max-w-6xl w-full"
            : "sm:w-[88vw] md:w-[840px] lg:w-[960px] max-w-full"
        } bg-white dark:bg-neutral-900 shadow-[-12px_0_40px_-8px_rgba(15,23,42,0.2)] dark:shadow-[-12px_0_40px_-8px_rgba(0,0,0,0.6)] border-l border-neutral-200/80 dark:border-white/[0.08] flex flex-col ani-drawer-in`}
      >
        {/* 1. 顶部操作栏 */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-neutral-200/60 dark:border-white/[0.06] bg-gradient-to-r from-neutral-50/90 to-neutral-100/50 dark:from-white/[0.03] dark:to-white/[0.015] shrink-0 select-none">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm ring-1 ring-theme/20 shadow-2xs">
              <i className="ri-quill-pen-line" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold tracking-tight text-neutral-800 dark:text-neutral-100 truncate">
                {editId ? `编辑文章 #${editId}` : "撰写新文章"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 随行文字侍从按钮 */}
            <button
              type="button"
              onClick={() => setCopilotOpen((p) => !p)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer select-none ${
                copilotOpen
                  ? "bg-theme text-white border-theme shadow-xs ring-1 ring-theme/20"
                  : "border-theme/30 bg-theme/5 text-theme hover:bg-theme/10"
              }`}
              title="呼出随行文字侍从 (AI 写作助理)"
            >
              <i className="ri-sparkling-fill" />
              <span>文字侍从</span>
            </button>

            {/* 非阻塞照片胶卷开关 */}
            <button
              type="button"
              onClick={handleToggleFilmstrip}
              className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer select-none ${
                showPhotoFilmstrip
                  ? "border-theme bg-theme/10 text-theme font-bold"
                  : "border-neutral-200/80 dark:border-white/[0.08] text-neutral-600 dark:text-neutral-300 hover:border-theme/60 hover:text-theme"
              }`}
              title="展开最近图片胶卷（就地插入配图，不挡写作）"
            >
              <i className="ri-image-add-line" />
              <span className="hidden sm:inline">图库配图</span>
            </button>

            {/* 宽屏切换按钮 */}
            <button
              type="button"
              onClick={() => setIsWideMode((p) => !p)}
              className="h-7 w-7 rounded-lg border border-neutral-200/80 dark:border-white/10 hidden sm:flex items-center justify-center text-neutral-500 hover:text-theme transition"
              title={isWideMode ? "恢复正常抽屉宽度" : "展开宽屏沉浸模式"}
            >
              <i className={isWideMode ? "ri-contract-left-right-line" : "ri-expand-left-right-line"} />
            </button>

            {/* 发布 / 更新保存按钮 */}
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || loading}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-[0.97] transition disabled:opacity-50 cursor-pointer"
            >
              <i className={publishing ? "ri-loader-4-line animate-spin" : "ri-send-plane-fill"} />
              <span>{publishing ? "提交中..." : editId ? "更新保存" : "即刻发布"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
            >
              <i className="ri-close-line text-base" />
            </button>
          </div>
        </div>

        {/* 2. 照片胶卷水平栏（非阻塞，轻量就地展开，绝不黑幕弹窗） */}
        {showPhotoFilmstrip && (
          <div className="px-4 py-2 bg-neutral-50/80 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none ani-show select-none shrink-0">
            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-400 shrink-0 mr-1">
              <i className="ri-film-line text-theme" />
              <span>最近图片素材:</span>
            </div>

            {/* 快速本地直传按钮 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-11 px-2.5 rounded-lg border border-dashed border-theme/40 hover:border-theme bg-theme/[0.04] text-theme text-[10px] font-bold flex flex-col items-center justify-center shrink-0 transition"
              title="上传本地图片并插入"
            >
              <i className="ri-upload-cloud-line text-sm" />
              <span>上传</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQuickUpload}
            />

            {loadingMedia ? (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 py-2 px-4">
                <i className="ri-loader-4-line animate-spin text-theme" />
                <span>加载媒体库…</span>
              </div>
            ) : mediaFiles.length === 0 ? (
              <span className="text-[11px] text-neutral-400 py-2">暂无图片素材</span>
            ) : (
              mediaFiles.slice(0, 16).map((file) => (
                <button
                  key={file.key}
                  type="button"
                  onClick={() => insertImageToContent(file.url, file.key.split("/").pop())}
                  className="group relative h-11 w-11 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 shrink-0 hover:scale-105 hover:border-theme transition cursor-pointer shadow-2xs"
                  title={`点击插入: ${file.key.split("/").pop()}`}
                >
                  <img src={file.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs">
                    <i className="ri-add-line" />
                  </div>
                </button>
              ))
            )}

            <button
              type="button"
              onClick={() => setShowPhotoFilmstrip(false)}
              className="p-1 rounded text-neutral-400 hover:text-neutral-600 shrink-0 ml-auto"
              title="收起胶卷"
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        )}

        {/* 3. Mac 终端风格 AI 流水线 (ai-pipeline: 提炼 / 排版 / 导读) */}
        <div className="px-4 py-2 border-b border-black/5 dark:border-white/5 bg-[#f8fafc]/90 dark:bg-[#151922] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
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

          {/* 中间流水线阶段勾选 */}
          <div className="flex items-center gap-1.5">
            {[
              { id: "tech", label: "① 提炼" },
              { id: "format", label: "② 排版" },
              { id: "summary", label: "③ 导读" },
            ].map((p) => {
              const isChecked = pipelineStages.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePipelineStage(p.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                    isChecked
                      ? "bg-theme text-white shadow-2xs"
                      : "bg-black/5 dark:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  <i className={isChecked ? "ri-check-line text-[10px]" : "ri-add-line text-[10px]"} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* 右侧执行按钮 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-neutral-500">
              <input
                type="checkbox"
                checked={autoRunOnPublish}
                onChange={(e) => setAutoRunOnPublish(e.target.checked)}
                className="h-3 w-3 rounded accent-theme cursor-pointer"
              />
              <span className="hidden sm:inline">发布时自动执行</span>
            </label>

            <button
              type="button"
              onClick={handleRunPipeline}
              disabled={runningPipeline || !content.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-40 cursor-pointer"
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

        {/* 4. 标题与属性区 */}
        <div className="p-3 sm:p-4 border-b border-neutral-200/60 dark:border-white/[0.06] space-y-2.5 shrink-0 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文章标题..."
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-neutral-200/90 dark:border-white/10 bg-white dark:bg-white/[0.04] text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 outline-none focus:border-theme focus:ring-2 focus:ring-theme/15 transition"
            />
            <button
              type="button"
              onClick={() => setIsMetaExpanded((p) => !p)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                isMetaExpanded
                  ? "border-theme bg-theme/10 text-theme"
                  : "border-neutral-200/90 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme"
              }`}
              title="展开更多属性"
            >
              <i className="ri-equalizer-line" />
              <span>{isMetaExpanded ? "收起属性" : "属性设置"}</span>
              <i className={`ri-arrow-down-s-line transition-transform ${isMetaExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* 折叠属性面板 */}
          {isMetaExpanded && (
            <div className="p-3 rounded-2xl border border-black/[0.06] bg-neutral-50/50 dark:border-white/[0.06] dark:bg-white/[0.02] space-y-2.5 ani-show text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  id={editId ?? 0}
                  value={summary}
                  setValue={setSummary}
                  placeholder="文章简介 / 导读摘要..."
                  variant="flat"
                  className="w-full text-xs"
                />
                <Input
                  id={editId ?? 0}
                  value={alias}
                  setValue={setAlias}
                  placeholder="自定义别名 (如 /about)..."
                  variant="flat"
                  className="w-full text-xs"
                />
              </div>

              {/* 标签栏与全站标签候选池 */}
              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    id={editId ?? 0}
                    value={tags}
                    setValue={setTags}
                    placeholder="输入或点击下方已有标签 (#React #边缘架构)..."
                    variant="flat"
                    className="w-full text-xs"
                  />
                </div>

                {/* 候选标签胶囊池 */}
                {availableTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[10px] text-neutral-400 font-mono mr-1">常用标签:</span>
                    {availableTags.slice(0, 14).map((t) => {
                      const isSelected = currentTagList.includes(t.name);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTagPill(t.name)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-theme text-white shadow-2xs font-bold"
                              : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:text-theme hover:bg-theme/10"
                          }`}
                        >
                          #{t.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                <div className="relative flex items-center">
                  <i className="ri-lock-line absolute left-3 text-neutral-400 text-xs" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="文章访问密码 (留空为公开)..."
                    className="rin-field pl-8 !py-1 text-xs"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <label htmlFor="drawer-top" className="flex items-center gap-1.5 cursor-pointer select-none group">
                    <Checkbox id="drawer-top" placeholder="置顶推荐" value={isTop} setValue={setIsTop} />
                    <span className="font-semibold text-[11px] t-primary">{isTop ? "已置顶" : "置顶"}</span>
                  </label>

                  <label htmlFor="drawer-draft" className="flex items-center gap-1.5 cursor-pointer select-none group">
                    <Checkbox id="drawer-draft" placeholder="草稿模式" value={draft} setValue={setDraft} />
                    <span className="font-semibold text-[11px] t-primary">{draft ? "草稿箱" : "正式发布"}</span>
                  </label>

                  <label htmlFor="drawer-listed" className="flex items-center gap-1.5 cursor-pointer select-none group">
                    <Checkbox id="drawer-listed" placeholder="列表可见" value={listed} setValue={setListed} />
                    <span className="font-semibold text-[11px] t-primary">{listed ? "公开列出" : "未列出"}</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. Markdown 编辑器主体 (纯单行工具栏，自适应最大高度) */}
        <div className="flex-1 min-h-0 overflow-hidden p-2.5 sm:p-3">
          <div className="h-full min-h-0 rounded-2xl overflow-hidden border border-neutral-200/70 dark:border-white/[0.06] shadow-inner bg-white dark:bg-neutral-900">
            <MarkdownEditor
              content={content}
              setContent={setContent}
              height="100%"
              defaultPreview="edit"
            />
          </div>
        </div>
      </div>

      {/* 文字侍从抽屉 */}
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
          showAlert("已将侍从提炼的摘要填入文章简介！");
        }}
      />

      {/* AI 流水线结果双分区预览 Modal */}
      <Modal
        isOpen={previewModalOpen}
        onRequestClose={() => setPreviewModalOpen(false)}
        size="lg"
        contentLabel="AI 流水线梳理建议与结果预览"
        panelClassName="p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 max-h-[82vh] text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
            <div>
              <h3 className="text-sm font-bold t-primary flex items-center gap-2">
                <i className="ri-sparkling-fill text-theme" />
                <span>AI 流水线梳理结果</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                双分区独立校验：您可以分别复制或决定是否一键应用到当前稿件
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

          {/* 分区 A: 生成的 AI 摘要卡片 */}
          {pipelinePreviewData?.summary && (
            <div className="p-3.5 rounded-2xl bg-theme/5 border border-theme/20 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-theme flex items-center gap-1.5">
                  <i className="ri-sparkling-fill" />
                  <span>分区 A · AI 精炼摘要</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pipelinePreviewData.summary || "");
                      showAlert("已复制摘要到剪贴板！");
                    }}
                    className="px-2.5 py-1 rounded-lg border border-theme/30 bg-w text-[11px] font-semibold text-theme hover:bg-theme/10 transition"
                  >
                    复制摘要
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (pipelinePreviewData.summary) {
                        setSummary(pipelinePreviewData.summary);
                        showAlert("已将 AI 摘要填入文章简介！");
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-theme text-white text-[11px] font-semibold hover:bg-theme-hover transition"
                  >
                    设为文章简介
                  </button>
                </div>
              </div>
              <p className="t-primary text-xs leading-relaxed bg-white/60 dark:bg-black/30 p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                {pipelinePreviewData.summary}
              </p>
            </div>
          )}

          {/* 分区 B: 优化排版后的文章正文 */}
          <div className="flex-1 min-h-0 flex flex-col gap-2 rounded-2xl border border-black/10 bg-neutral-50/70 p-3.5 dark:border-white/10 dark:bg-neutral-900/40">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/5">
              <span className="font-bold text-xs t-primary flex items-center gap-1.5">
                <i className="ri-file-text-line text-theme" />
                <span>分区 B · 优化排版后的正文内容</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (pipelinePreviewData?.result) {
                    navigator.clipboard.writeText(pipelinePreviewData.result);
                    showAlert("已复制优化后的 Markdown 文本！");
                  }
                }}
                className="px-2.5 py-1 rounded-lg border border-black/10 bg-w text-[11px] font-semibold t-primary hover:bg-neutral-100 transition"
              >
                复制正文
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 text-sm">
              <Markdown content={pipelinePreviewData?.result || ""} />
            </div>
          </div>

          {/* 底部操作条 */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(false)}
              className="rounded-xl px-4 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 transition"
            >
              保留原稿
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
                  showAlert("✓ 已应用 AI 优化正文到编辑器！");
                }
              }}
              className="rounded-xl bg-theme px-5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-theme-hover transition"
            >
              确认应用替换
            </button>
          </div>
        </div>
      </Modal>

      <AlertUI />
    </>,
    document.body
  );
}
