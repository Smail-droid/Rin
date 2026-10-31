import { SettingsBadge, SettingsCard, SettingsCardBody, SettingsCardHeader, Spinner } from "@rin/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import type { Tag } from "../api/client";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

export function AdminTagsPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTag, setEditingTag] = useState<{ id: number; name: string } | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const isLoadedRef = useRef(false);

  const fetchTags = useCallback(() => {
    setLoading(true);
    client.tag
      .list()
      .then(({ data, error }) => {
        if (data) {
          setTags(data);
        } else if (error) {
          showAlert(String(error.value || "加载标签列表失败"));
        }
      })
      .catch((err) => showAlert(err.message))
      .finally(() => setLoading(false));
  }, [showAlert]);

  useEffect(() => {
    if (isLoadedRef.current) return;
    isLoadedRef.current = true;
    fetchTags();
  }, [fetchTags]);

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  const totalFeeds = useMemo(() => {
    return tags.reduce((acc, tag) => acc + ((tag as any).feeds || 0), 0);
  }, [tags]);

  const handleStartEdit = (tag: Tag) => {
    setEditingTag({ id: tag.id, name: tag.name });
    setEditingName(tag.name);
  };

  const handleSaveEdit = async () => {
    if (!editingTag) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      showAlert("标签名称不能为空");
      return;
    }
    if (trimmed === editingTag.name) {
      setEditingTag(null);
      return;
    }

    setSavingId(editingTag.id);
    try {
      const { data, error } = await client.tag.update(editingTag.id, trimmed);
      if (data) {
        setTags((prev) =>
          prev.map((item) => (item.id === editingTag.id ? { ...item, name: trimmed } : item))
        );
        setEditingTag(null);
        showAlert("标签修改成功！关联文章已自动同步");
      } else if (error) {
        showAlert(String(error.value || "更新标签失败"));
      }
    } catch (err: any) {
      showAlert(err.message || "更新标签失败");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteTag = (tag: Tag) => {
    showConfirm(
      "删除标签确认",
      `确定要删除标签 “#${tag.name}” 吗？\n删除后关联文章的该标签将被解除，文章本身不受影响。`,
      async () => {
        setSavingId(tag.id);
        try {
          const { error } = await client.tag.delete(tag.id);
          if (!error) {
            setTags((prev) => prev.filter((item) => item.id !== tag.id));
            showAlert("标签删除成功");
          } else {
            showAlert(String(error.value || "删除标签失败"));
          }
        } catch (err: any) {
          showAlert(err.message || "删除标签失败");
        } finally {
          setSavingId(null);
        }
      }
    );
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    setCreating(true);
    try {
      const { data, error } = await client.tag.create(trimmed);
      if (data) {
        setNewTagName("");
        fetchTags();
        showAlert(`标签 “#${trimmed}” 创建成功！`);
      } else if (error) {
        showAlert(String(error.value || "创建标签失败"));
      }
    } catch (err: any) {
      showAlert(err.message || "创建标签失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{`标签分类管理 - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsCard tone="default">
            <SettingsCardHeader
              title={String(tags.length)}
              description="全站标签分类总数"
              badge={<SettingsBadge tone="neutral">分类字典</SettingsBadge>}
            />
          </SettingsCard>
          <SettingsCard tone="success">
            <SettingsCardHeader
              title={String(totalFeeds)}
              description="标签文章引用关联总量"
              badge={<SettingsBadge tone="success">有效关联</SettingsBadge>}
            />
          </SettingsCard>
        </div>

        {/* Toolbar: Create New Tag & Search */}
        <SettingsCard>
          <SettingsCardBody>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Create Tag Form */}
              <form onSubmit={handleCreateTag} className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="新建标签名称 (如: Linux / AI / 随笔)..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-w px-3.5 py-2 text-sm t-primary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-theme/20 dark:border-white/10"
                />
                <Button
                  title={creating ? "创建中…" : "添加标签"}
                  onClick={() => {}}
                  disabled={creating || !newTagName.trim()}
                  className="shrink-0 text-xs py-2 px-4"
                />
              </form>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm" />
                <input
                  type="text"
                  placeholder="搜索过滤标签..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-w pl-9 pr-3.5 py-2 text-sm t-primary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-theme/20 dark:border-white/10"
                />
              </div>
            </div>
          </SettingsCardBody>
        </SettingsCard>

        {/* Tags List */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Spinner size="2rem" label="加载标签列表中…" />
            </div>
          ) : filteredTags.length === 0 ? (
            <SettingsCard>
              <SettingsCardBody>
                <div className="flex flex-col items-center justify-center p-8 text-neutral-400">
                  <i className="ri-price-tag-3-line text-4xl mb-2" />
                  <p className="text-sm font-medium">未找到任何匹配的标签</p>
                </div>
              </SettingsCardBody>
            </SettingsCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTags.map((tag) => {
                const isEditing = editingTag?.id === tag.id;
                const isSaving = savingId === tag.id;
                const feedCount = (tag as any).feeds || 0;

                return (
                  <div
                    key={tag.id}
                    className="flex flex-col justify-between rounded-2xl border border-black/10 bg-w p-4 shadow-2xs hover:shadow-md transition-all dark:border-white/10"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full rounded-xl border border-theme bg-w px-3 py-1.5 text-sm font-bold t-primary focus:outline-none ring-2 ring-theme/20"
                          placeholder="输入修正后的标签名..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") setEditingTag(null);
                          }}
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingTag(null)}
                            className="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                            className="rounded-lg bg-theme px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-theme-hover disabled:opacity-50"
                          >
                            {isSaving ? "保存中…" : "确认修改"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-sm t-primary break-words flex items-center gap-1.5">
                              <i className="ri-hashtag text-theme text-sm shrink-0" />
                              <span>{tag.name}</span>
                            </span>
                            <p className="mt-1 text-xs text-neutral-400 font-medium">
                              关联 {feedCount} 篇文章
                            </p>
                          </div>
                          <Link
                            href={`/hashtag/${encodeURIComponent(tag.name)}`}
                            target="_blank"
                            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-theme hover:bg-theme/10 transition"
                            title="前台查看此标签"
                          >
                            <i className="ri-external-link-line text-sm" />
                          </Link>
                        </div>

                        <div className="mt-4 pt-3 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                          <span className="text-[11px] text-neutral-400 font-mono">
                            ID: {tag.id}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tag)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-white/5 transition"
                              title="重命名 / 修正标签"
                            >
                              <i className="ri-edit-2-line text-xs" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTag(tag)}
                              disabled={isSaving}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition disabled:opacity-50"
                              title="删除此标签"
                            >
                              <i className="ri-delete-bin-line text-xs" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <AlertUI />
      <ConfirmUI />
    </>
  );
}
