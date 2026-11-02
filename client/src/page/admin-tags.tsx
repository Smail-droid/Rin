import { Modal, Spinner } from "@rin/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import type { Tag } from "../api/client";
import { client } from "../app/runtime";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

export function AdminTagsPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 关联文章状态
  const [associatingTag, setAssociatingTag] = useState<Tag | null>(null);
  const [allFeeds, setAllFeeds] = useState<Array<{ id: number; title: string; createdAt: string }>>([]);
  const [associatedFeedIds, setAssociatedFeedIds] = useState<Set<number>>(new Set());
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [savingAssociation, setSavingAssociation] = useState(false);
  const [feedSearchQuery, setFeedSearchQuery] = useState("");

  const handleOpenAssociation = async (tag: Tag) => {
    setAssociatingTag(tag);
    setLoadingFeeds(true);
    setFeedSearchQuery("");
    try {
      const [feedsRes, associatedRes] = await Promise.all([
        client.feed.list({ limit: 100 }),
        fetch(`/api/tag/${tag.id}/feeds`).then((r) => r.json()).catch(() => []),
      ]);
      if (feedsRes.data?.data) {
        setAllFeeds(feedsRes.data.data as any);
      }
      if (Array.isArray(associatedRes)) {
        setAssociatedFeedIds(new Set(associatedRes));
      } else {
        setAssociatedFeedIds(new Set());
      }
    } catch (e: any) {
      showAlert(e.message || "加载文章关联数据失败");
    } finally {
      setLoadingFeeds(false);
    }
  };

  const handleSaveAssociation = async () => {
    if (!associatingTag) return;
    setSavingAssociation(true);
    try {
      const res = await fetch(`/api/tag/${associatingTag.id}/feeds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedIds: Array.from(associatedFeedIds) }),
      });
      if (res.ok) {
        showAlert(`🎉 标签「${associatingTag.name}」文章关联已更新！`);
        setAssociatingTag(null);
        fetchTags();
      } else {
        showAlert("保存关联失败，请稍后重试");
      }
    } catch (e: any) {
      showAlert(e.message || "保存关联出现异常");
    } finally {
      setSavingAssociation(false);
    }
  };

  const toggleFeedAssociation = (feedId: number) => {
    const next = new Set(associatedFeedIds);
    if (next.has(feedId)) {
      next.delete(feedId);
    } else {
      next.add(feedId);
    }
    setAssociatedFeedIds(next);
  };
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<{ id: number; name: string } | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  // 排序与选择状态 (iKuai 风格超级数据表格)
  const [sortField, setSortField] = useState<"id" | "name" | "feeds">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 紧凑分页状态
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
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

  // 搜索与排序
  const sortedAndFilteredTags = useMemo(() => {
    let result = [...tags];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || String(t.id).includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortField === "id") {
        return sortOrder === "asc" ? a.id - b.id : b.id - a.id;
      }
      if (sortField === "feeds") {
        const feedsA = (a as any).feeds || 0;
        const feedsB = (b as any).feeds || 0;
        return sortOrder === "asc" ? feedsA - feedsB : feedsB - feedsA;
      }
      return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });

    return result;
  }, [tags, searchQuery, sortField, sortOrder]);

  // 分页切片
  const totalItems = sortedAndFilteredTags.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedTags = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredTags.slice(start, start + pageSize);
  }, [sortedAndFilteredTags, currentPage, pageSize]);

  const totalFeeds = useMemo(() => {
    return tags.reduce((acc, tag) => acc + ((tag as any).feeds || 0), 0);
  }, [tags]);

  // 表格全选与单选
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTags.length && paginatedTags.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTags.map((t) => t.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // 排序切换辅助函数
  const handleSort = (field: "id" | "name" | "feeds") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "feeds" ? "desc" : "asc");
    }
  };

  // 创建新标签
  const handleCreateTag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) {
      showAlert("请输入想要添加的标签名称~");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await client.tag.create(trimmed);
      if (data) {
        setNewTagName("");
        fetchTags();
        showAlert(`✨ 标签 “#${trimmed}” 添加成功！`);
      } else if (error) {
        showAlert(String(error.value || "创建标签失败"));
      }
    } catch (err: any) {
      showAlert(err.message || "创建标签失败");
    } finally {
      setCreating(false);
    }
  };

  // 开始编辑标签
  const handleStartEdit = (tag: Tag) => {
    setEditingTag({ id: tag.id, name: tag.name });
    setEditingName(tag.name);
  };

  // 保存重命名
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

  // 单条删除
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
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(tag.id);
              return next;
            });
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

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    showConfirm(
      "批量删除确认",
      `确定要删除选中的 ${selectedIds.size} 个标签吗？\n关联文章中的对应标签将一并解除。`,
      async () => {
        setLoading(true);
        let count = 0;
        try {
          for (const id of Array.from(selectedIds)) {
            const { error } = await client.tag.delete(id);
            if (!error) count++;
          }
          showAlert(`批量操作完成：成功删除 ${count} 个标签！`);
          setSelectedIds(new Set());
          fetchTags();
        } finally {
          setLoading(false);
        }
      }
    );
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`分类标签管理 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />
      <ConfirmUI />

      {/* ====================================================================
          1. 顶部 iKuai 风格操作与批量工具栏
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs">
        {/* 左侧动作组: [添加] [批量删除] [统计信息] */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 添加标签输入组 */}
          <form onSubmit={handleCreateTag} className="flex items-center gap-1.5">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="输入新标签名 (如: Linux / AI / 随笔)..."
              className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-1.5 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-white/[0.03] w-48 sm:w-64"
            />
            <button
              type="submit"
              disabled={creating || !newTagName.trim()}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 transition disabled:opacity-50"
            >
              <i className="ri-add-line text-sm" />
              <span>{creating ? "添加中…" : "添加"}</span>
            </button>
          </form>

          {/* 批量删除按钮 (选中有高亮) */}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBatchDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 active:scale-95 transition"
            >
              <i className="ri-delete-bin-line text-xs" />
              <span>删除选中 ({selectedIds.size})</span>
            </button>
          )}

          {/* 总体统计徽章 */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono pl-2 text-neutral-400">
            <span>共 {tags.length} 个标签</span>
            <span>·</span>
            <span>关联 {totalFeeds} 篇内容</span>
          </div>
        </div>

        {/* 右侧搜索过滤与刷新 */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <i className="ri-search-line absolute left-2.5 text-neutral-400 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="请输入搜索内容..."
              className="rounded-xl border border-black/10 bg-transparent py-1.5 pl-8 pr-3 text-xs t-primary outline-none focus:border-theme dark:border-white/10 w-40 sm:w-52"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-neutral-400 hover:text-neutral-600 text-xs"
              >
                <i className="ri-close-line" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={fetchTags}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-transparent text-neutral-500 hover:text-theme hover:border-theme transition dark:border-white/10"
            title="刷新标签列表"
          >
            <i className={`ri-refresh-line text-sm ${loading ? "animate-spin text-theme" : ""}`} />
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. iKuai 风格超级数据表格 (Dense DataGrid)
          ==================================================================== */}
      <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-500 dark:text-neutral-400 font-mono">
                {/* Checkbox 全选 */}
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paginatedTags.length && paginatedTags.length > 0}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                  />
                </th>

                {/* 序号 / ID (支持点击排序) */}
                <th
                  onClick={() => handleSort("id")}
                  className="py-3 px-3 w-20 cursor-pointer hover:text-theme transition"
                >
                  <div className="flex items-center gap-1">
                    <span>序号</span>
                    <i
                      className={`text-xs ${
                        sortField === "id"
                          ? sortOrder === "asc"
                            ? "ri-arrow-up-s-line text-theme"
                            : "ri-arrow-down-s-line text-theme"
                          : "ri-arrow-up-down-line opacity-40"
                      }`}
                    />
                  </div>
                </th>

                {/* 名称 (支持点击排序) */}
                <th
                  onClick={() => handleSort("name")}
                  className="py-3 px-3 cursor-pointer hover:text-theme transition"
                >
                  <div className="flex items-center gap-1">
                    <span>名称</span>
                    <i
                      className={`text-xs ${
                        sortField === "name"
                          ? sortOrder === "asc"
                            ? "ri-arrow-up-s-line text-theme"
                            : "ri-arrow-down-s-line text-theme"
                          : "ri-arrow-up-down-line opacity-40"
                      }`}
                    />
                  </div>
                </th>

                {/* 分流/分类方式 */}
                <th className="py-3 px-3 w-32">分类模式</th>

                {/* 关联文章数 (支持点击排序) */}
                <th
                  onClick={() => handleSort("feeds")}
                  className="py-3 px-3 w-32 cursor-pointer hover:text-theme transition"
                >
                  <div className="flex items-center gap-1">
                    <span>关联文章</span>
                    <i
                      className={`text-xs ${
                        sortField === "feeds"
                          ? sortOrder === "asc"
                            ? "ri-arrow-up-s-line text-theme"
                            : "ri-arrow-down-s-line text-theme"
                          : "ri-arrow-up-down-line opacity-40"
                      }`}
                    />
                  </div>
                </th>

                {/* 前台直达预览 */}
                <th className="py-3 px-3 w-28 text-center">前台直达</th>

                {/* 操作列 (固定右侧) */}
                <th className="py-3 px-4 w-36 text-right pr-6">操作</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/5 dark:divide-white/5 t-primary">
              {loading && tags.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <Spinner size="1.5rem" label="正在读取标签列表中…" />
                    <span className="ml-2">正在从 D1 边缘数据库拉取标签…</span>
                  </td>
                </tr>
              ) : paginatedTags.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <i className="ri-price-tag-3-line text-3xl block mb-1 opacity-50" />
                    <span>未找到任何匹配的标签分类</span>
                  </td>
                </tr>
              ) : (
                paginatedTags.map((tag, idx) => {
                  const isSelected = selectedIds.has(tag.id);
                  const isEditing = editingTag?.id === tag.id;
                  const isSaving = savingId === tag.id;
                  const feedCount = (tag as any).feeds || 0;
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={tag.id}
                      className={`h-11 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors ${
                        isSelected ? "bg-theme/[0.04]" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(tag.id)}
                          className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                        />
                      </td>

                      {/* 序号 / ID */}
                      <td className="py-2.5 px-3 font-mono text-neutral-400">
                        {rowNumber}
                      </td>

                      {/* 标签名称 (支持行内就地重命名编辑) */}
                      <td className="py-2.5 px-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 max-w-sm">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="w-full rounded-lg border border-theme bg-w px-2.5 py-1 text-xs font-bold t-primary focus:outline-none ring-1 ring-theme"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") setEditingTag(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={isSaving}
                              className="px-2 py-1 rounded bg-theme text-white font-semibold text-[11px] shrink-0"
                            >
                              {isSaving ? "…" : "保存"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTag(null)}
                              className="px-2 py-1 rounded bg-black/5 dark:bg-white/5 text-neutral-500 text-[11px] shrink-0"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 text-xs">
                              <i className="ri-play-fill text-[10px]" />
                            </span>
                            <span
                              onClick={() => handleStartEdit(tag)}
                              className="font-bold text-xs t-primary hover:text-theme cursor-pointer"
                              title="点击可直接编辑重命名"
                            >
                              {tag.name}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 分流/模式 */}
                      <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px]">
                        公共分类
                      </td>

                      {/* 关联文章数量 */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            feedCount > 0
                              ? "bg-theme/10 text-theme"
                              : "bg-black/5 text-neutral-400 dark:bg-white/5"
                          }`}
                        >
                          <i className="ri-article-line text-[10px]" />
                          <span>{feedCount} 篇</span>
                        </span>
                      </td>

                      {/* 前台直达 */}
                      <td className="py-2.5 px-3 text-center">
                        <Link
                          href={`/hashtag/${encodeURIComponent(tag.name)}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-theme transition"
                          title="在画廊前台查看包含该标签的所有文章"
                        >
                          <i className="ri-external-link-line" />
                          <span>查看</span>
                        </Link>
                      </td>

                      {/* 操作列: [关联文章] [编辑] [删除] */}
                      <td className="py-2.5 px-4 text-right pr-6 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenAssociation(tag)}
                            className="text-theme hover:underline font-semibold text-xs flex items-center gap-0.5"
                            title="为该标签批量关联或取消关联文章"
                          >
                            <i className="ri-links-line" />
                            <span>关联文章</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tag)}
                            className="text-neutral-600 dark:text-neutral-300 hover:text-theme hover:underline font-semibold text-xs"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(tag)}
                            disabled={isSaving}
                            className="text-rose-500 hover:underline font-semibold text-xs disabled:opacity-50"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ====================================================================
            3. iKuai 风格紧凑底部数据分页栏 (共X条 / 20条/页 / 数字翻页器)
            ==================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] text-xs select-none">
          {/* 左侧总数统计 */}
          <div className="text-neutral-500 dark:text-neutral-400 font-mono">
            共 <span className="font-bold text-theme">{totalItems}</span> 条记录
          </div>

          {/* 右侧密度与翻页器 */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 每页条数下拉选择 */}
            <div className="flex items-center gap-1">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number.parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-black/10 bg-w px-2 py-1 text-xs t-primary outline-none dark:border-white/10 dark:bg-neutral-900 cursor-pointer"
              >
                <option value={10}>10 条/页</option>
                <option value={20}>20 条/页</option>
                <option value={50}>50 条/页</option>
                <option value={100}>100 条/页</option>
              </select>
            </div>

            {/* 数字翻页按钮组 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 hover:border-theme text-neutral-600 dark:text-neutral-300 dark:border-white/10 disabled:opacity-40 transition"
                title="上一页"
              >
                <i className="ri-arrow-left-s-line" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold transition ${
                        currentPage === page
                          ? "bg-theme text-white shadow-2xs"
                          : "border border-black/10 hover:border-theme text-neutral-600 dark:text-neutral-300 dark:border-white/10"
                      }`}
                    >
                      {page}
                    </button>
                  );
                }
                if (page === currentPage - 3 || page === currentPage + 3) {
                  return (
                    <span key={page} className="px-1 text-neutral-400">
                      …
                    </span>
                  );
                }
                return null;
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 hover:border-theme text-neutral-600 dark:text-neutral-300 dark:border-white/10 disabled:opacity-40 transition"
                title="下一页"
              >
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 关联/解绑文章弹窗 */}
      {associatingTag && (
        <Modal
          isOpen={!!associatingTag}
          onRequestClose={() => setAssociatingTag(null)}
          contentLabel={`管理标签「${associatingTag.name}」关联文章`}
          panelClassName="p-6 max-w-xl w-full"
        >
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div>
                <h3 className="text-sm font-bold t-primary flex items-center gap-2">
                  <span>管理标签关联文章:</span>
                  <span className="text-theme font-mono">#{associatingTag.name}</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  勾选文章即挂载此标签，取消勾选即从该文章解绑
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-theme/10 text-theme">
                已选 {associatedFeedIds.size} 篇
              </span>
            </div>

            {/* 搜索框 */}
            <div className="relative">
              <input
                type="text"
                value={feedSearchQuery}
                onChange={(e) => setFeedSearchQuery(e.target.value)}
                placeholder="快速筛选文章标题..."
                className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-theme"
              />
              <i className="ri-search-line absolute left-2.5 top-2 text-neutral-400" />
            </div>

            {/* 文章列表 */}
            {loadingFeeds ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-black/5 dark:divide-white/5">
                {allFeeds
                  .filter((f) => !feedSearchQuery.trim() || f.title.toLowerCase().includes(feedSearchQuery.trim().toLowerCase()))
                  .map((feed) => {
                    const isChecked = associatedFeedIds.has(feed.id);
                    return (
                      <label
                        key={feed.id}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition select-none ${
                          isChecked ? "bg-theme/[0.06]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleFeedAssociation(feed.id)}
                            className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold truncate t-primary">{feed.title || "无标题文章"}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">ID: #{feed.id}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          isChecked ? "bg-theme text-white" : "text-neutral-400"
                        }`}>
                          {isChecked ? "已关联" : "未关联"}
                        </span>
                      </label>
                    );
                  })}
              </div>
            )}

            {/* 底部按钮 */}
            <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  if (associatedFeedIds.size === allFeeds.length) {
                    setAssociatedFeedIds(new Set());
                  } else {
                    setAssociatedFeedIds(new Set(allFeeds.map((f) => f.id)));
                  }
                }}
                className="text-neutral-500 hover:text-theme font-medium"
              >
                {associatedFeedIds.size === allFeeds.length ? "取消全选" : "全选所有文章"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssociatingTag(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-black/10 text-neutral-600 dark:border-white/10 dark:text-neutral-300 font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssociation}
                  disabled={savingAssociation}
                  className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover disabled:opacity-50 flex items-center gap-1"
                >
                  {savingAssociation && <Spinner />}
                  <span>保存关联变更</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
