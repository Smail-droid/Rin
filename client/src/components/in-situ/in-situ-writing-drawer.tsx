import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { client } from "../../app/runtime";
import { useAlert } from "../dialog";
import { MarkdownEditor } from "../markdown_editor";
import { Checkbox, Input } from "../input";
import { Modal } from "@rin/ui";
import { Cache } from "../../utils/cache";

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
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(false);

  // R2 图床相册快速挑选与插图
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // ESC 退出
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !imagePickerOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, imagePickerOpen, onClose]);

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
            if (Array.isArray(data.hashtags)) {
              setTags(data.hashtags.map((h: any) => `#${h.name}`).join(" "));
            }
          }
        })
        .finally(() => setLoading(false));
    } else {
      // 创作新文章
      setTitle("");
      setContent("");
      setSummary("");
      setAlias("");
      setTags("");
      setDraft(false);
      setListed(true);
      setIsMetaExpanded(false);
    }
  }, [isOpen, editId]);

  const loadMediaLibrary = () => {
    setLoadingMedia(true);
    client.storage
      .listFiles()
      .then(({ data }) => {
        if (data?.files && Array.isArray(data.files)) {
          // 仅过滤图片格式
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

  const insertImageToContent = (url: string, name?: string) => {
    const mdImg = `\n\n![${name || "插图"}](${url})\n\n`;
    setContent(content ? `${content}${mdImg}` : mdImg);
    setImagePickerOpen(false);
    showAlert("已成功将图片 Markdown 语法插入到文章中！");
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      showAlert("请输入文章标题后再发布哦~");
      return;
    }
    if (!content.trim()) {
      showAlert("文章正文内容不能为空哦~");
      return;
    }

    const tagArray = tags
      .split(/[\s,]+/)
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => t.length > 0);

    setPublishing(true);

    try {
      if (editId && editId > 0) {
        const { error } = await client.feed.update(editId, {
          title: title.trim(),
          alias: alias.trim() || undefined,
          summary: summary.trim(),
          content,
          tags: tagArray,
          draft,
          listed,
        });
        if (error) {
          showAlert(String(error.value || "更新失败"));
        } else {
          showAlert("文章已成功在场更新！", () => {
            Cache.with().clear();
            onClose();
            window.location.reload();
          });
        }
      } else {
        const { data, error } = await client.feed.create({
          title: title.trim(),
          alias: alias.trim() || undefined,
          summary: summary.trim(),
          content,
          tags: tagArray,
          draft,
          listed,
        });
        if (error) {
          showAlert(String(error.value || "发布失败"));
        } else if (data) {
          showAlert("新文章已在场成功发布！", () => {
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
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* 右侧滑出沉浸式在场写作工坊抽屉 */}
      <div className="fixed top-0 bottom-0 right-0 z-50 w-full sm:w-[88vw] md:w-[780px] lg:w-[920px] bg-white dark:bg-[#12161f] shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transition-transform duration-300 ease-out select-none">
        {/* 1. 顶部操作栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5 bg-neutral-50/60 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base">
              <i className="ri-quill-pen-line" />
            </span>
            <div>
              <h2 className="text-sm font-bold t-primary">
                {editId ? `在场编辑文章 #${editId}` : "灵感笔筒 · 在场创作工坊"}
              </h2>
              <p className="text-[10px] text-neutral-400">
                原地创作与排版，无需跳转独立后台页面
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setImagePickerOpen(true);
                loadMediaLibrary();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme text-xs font-semibold transition"
              title="从图床中挑选照片或上传插入"
            >
              <i className="ri-image-add-line text-theme" />
              <span>图库选图</span>
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 transition disabled:opacity-50"
            >
              <i className={publishing ? "ri-loader-4-line animate-spin" : "ri-send-plane-fill"} />
              <span>{publishing ? "提交中..." : editId ? "更新保存" : "即刻发布"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
        </div>

        {/* 2. 标题与属性折叠区 */}
        <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/5 space-y-3 shrink-0 bg-white/80 dark:bg-[#12161f]/80">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文章标题..."
              className="flex-1 px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] text-sm sm:text-base font-bold t-primary outline-none focus:border-theme focus:ring-2 focus:ring-theme/20 transition"
            />
            <button
              type="button"
              onClick={() => setIsMetaExpanded((p) => !p)}
              className={`px-3 py-2.5 rounded-2xl border text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                isMetaExpanded
                  ? "border-theme bg-theme/10 text-theme"
                  : "border-black/10 dark:border-white/10 text-neutral-500 hover:border-theme hover:text-theme"
              }`}
              title="展开更多属性 (简介、别名、标签、可见性)"
            >
              <i className="ri-equalizer-line" />
              <span>{isMetaExpanded ? "收起属性" : "属性设置"}</span>
              <i className={`ri-arrow-down-s-line transition-transform ${isMetaExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* 折叠属性面板 */}
          {isMetaExpanded && (
            <div className="p-3.5 rounded-2xl border border-black/10 bg-neutral-50/60 dark:border-white/10 dark:bg-[#161b26] space-y-3 ani-show">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  placeholder="文章自定义别名 (如 /about)..."
                  variant="flat"
                  className="w-full text-xs"
                />
                <Input
                  id={editId ?? 0}
                  value={tags}
                  setValue={setTags}
                  placeholder="文章标签 (空格分隔，如 #React #Vite)..."
                  variant="flat"
                  className="sm:col-span-2 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                {/* 1. 草稿状态开关 */}
                <label
                  htmlFor="drawer-draft"
                  className="flex items-center gap-2 cursor-pointer select-none group"
                >
                  <Checkbox
                    id="drawer-draft"
                    placeholder="草稿模式"
                    value={draft}
                    setValue={setDraft}
                  />
                  <span className="font-semibold text-xs t-primary flex items-center gap-1 group-hover:text-theme transition-colors">
                    <i className={`text-xs ${draft ? "ri-draft-line text-amber-500" : "ri-article-line text-emerald-500"}`} />
                    <span>{draft ? "草稿箱 (仅后台可见)" : "正式发布 (公开展现)"}</span>
                  </span>
                </label>

                {/* 2. 列表可见性开关 */}
                <label
                  htmlFor="drawer-listed"
                  className="flex items-center gap-2 cursor-pointer select-none group"
                >
                  <Checkbox
                    id="drawer-listed"
                    placeholder="列表可见"
                    value={listed}
                    setValue={setListed}
                  />
                  <span className="font-semibold text-xs t-primary flex items-center gap-1 group-hover:text-theme transition-colors">
                    <i className={`text-xs ${listed ? "ri-eye-line text-theme" : "ri-eye-off-line text-neutral-400"}`} />
                    <span>{listed ? "公开列出在首页流" : "未列出 (仅知直链可访)"}</span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* 3. Markdown 编辑器主体 */}
        <div className="flex-1 overflow-hidden p-3 sm:p-4">
          <div className="h-full rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-inner">
            <MarkdownEditor
              content={content}
              setContent={setContent}
              height="100%"
              defaultPreview="edit"
            />
          </div>
        </div>
      </div>

      {/* 图床相册快速挑选与插入 Modal */}
      <Modal
        isOpen={imagePickerOpen}
        onRequestClose={() => setImagePickerOpen(false)}
        size="lg"
        contentLabel="从图床中挑选插图"
        panelClassName="p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 max-h-[80vh]">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <i className="ri-folder-image-line text-theme text-base" />
              <h3 className="font-bold text-sm t-primary">从 R2 图床相册挑选插图并一键插入</h3>
            </div>
            <button
              type="button"
              onClick={() => setImagePickerOpen(false)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {loadingMedia ? (
              <div className="flex items-center justify-center py-16 text-neutral-400 text-xs">
                <i className="ri-loader-4-line animate-spin text-xl text-theme mr-2" />
                <span>正在加载 R2 图床相册…</span>
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                暂未获取到图片素材，您可以前往【图库相册】上传
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {mediaFiles.map((file) => (
                  <div
                    key={file.key}
                    onClick={() => insertImageToContent(file.url, file.key.split("/").pop())}
                    className="group relative flex flex-col items-center justify-center rounded-xl border border-black/10 dark:border-white/10 p-2 cursor-pointer hover:border-theme hover:shadow-xs transition bg-black/[0.015] dark:bg-white/[0.02]"
                    title="点击将该图片插入到正文编辑器"
                  >
                    <div className="h-24 w-full flex items-center justify-center overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
                      <img
                        src={file.url}
                        alt={file.key}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-200"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate w-full mt-1.5 text-center">
                      {file.key.split("/").pop()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <AlertUI />
    </>,
    document.body
  );
}
