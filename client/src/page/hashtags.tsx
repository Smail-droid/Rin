import { Modal, Spinner } from "@rin/ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useAlert, useConfirm } from "../components/dialog";
import { Waiting } from "../components/loading";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { ProfileContext } from "../state/profile";
import { siteName } from "../utils/constants";

type Hashtag = {
  id: number;
  name: string;
  count?: number;
  feeds?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  singleFeedId?: number | null;
};

const getTagFeeds = (t: Hashtag): number => t.feeds ?? t.count ?? 0;

const TAG_ROTATIONS = [
  "-rotate-[2deg] translate-y-0",
  "rotate-[1.5deg] translate-y-1",
  "-rotate-[1deg] -translate-y-0.5",
  "rotate-[2.2deg] translate-y-0.5",
  "-rotate-[1.8deg] translate-y-1",
  "rotate-[1.2deg] -translate-y-0.5",
  "-rotate-[2.4deg] translate-y-0.5",
  "rotate-[2deg] translate-y-0",
  "-rotate-[1.2deg] translate-y-1",
  "rotate-[0.8deg] -translate-y-0.5",
];

// 清亮明快的晶透书签色系
const TAG_BOOKMARK_STYLES = [
  {
    card: "bg-sky-50/90 text-sky-700 border-sky-200/80 hover:border-sky-300 dark:bg-sky-950/45 dark:text-sky-300 dark:border-sky-800/50",
    dot: "bg-sky-400",
  },
  {
    card: "bg-rose-50/90 text-rose-600 border-rose-200/80 hover:border-rose-300 dark:bg-rose-950/45 dark:text-rose-300 dark:border-rose-800/50",
    dot: "bg-rose-400",
  },
  {
    card: "bg-emerald-50/90 text-emerald-700 border-emerald-200/80 hover:border-emerald-300 dark:bg-emerald-950/45 dark:text-emerald-300 dark:border-emerald-800/50",
    dot: "bg-emerald-400",
  },
  {
    card: "bg-violet-50/90 text-violet-700 border-violet-200/80 hover:border-violet-300 dark:bg-violet-950/45 dark:text-violet-300 dark:border-violet-800/50",
    dot: "bg-violet-400",
  },
  {
    card: "bg-amber-50/90 text-amber-700 border-amber-200/80 hover:border-amber-300 dark:bg-amber-950/45 dark:text-amber-300 dark:border-amber-800/50",
    dot: "bg-amber-400",
  },
  {
    card: "bg-cyan-50/90 text-cyan-700 border-cyan-200/80 hover:border-cyan-300 dark:bg-cyan-950/45 dark:text-cyan-300 dark:border-cyan-800/50",
    dot: "bg-cyan-400",
  },
];

export function HashtagsPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const profile = useContext(ProfileContext);
  const isAdmin = Boolean(profile?.permission);
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [hashtags, setHashtags] = useState<Hashtag[]>();

  // 视图模式：书签星云 (cloud) / 高密单屏超级数据表格 (datagrid)
  const [viewMode, setViewMode] = useState<"cloud" | "datagrid">("cloud");

  // 排序与筛选状态
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "custom">("latest");
  const [showEmptyTags, setShowEmptyTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "linked" | "unlinked">("all");
  const [isCleaning, setIsCleaning] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 新建与编辑状态
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<{ id: number; name: string } | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  // 表格多选与排序
  const [sortField, setSortField] = useState<"id" | "name" | "feeds">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 关联文章弹窗状态
  const [associatingTag, setAssociatingTag] = useState<Hashtag | null>(null);
  const [allFeeds, setAllFeeds] = useState<Array<{ id: number; title: string; createdAt: string }>>([]);
  const [associatedFeedIds, setAssociatedFeedIds] = useState<Set<number>>(new Set());
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [savingAssociation, setSavingAssociation] = useState(false);
  const [feedSearchQuery, setFeedSearchQuery] = useState("");

  // 文章正文页附加标签栏按钮配置
  const [feedTagActions, setFeedTagActions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("rin_feed_tag_actions");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["prev", "next", "random"];
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const loadTags = useCallback(async () => {
    try {
      const { data } = await client.tag.list();
      if (data && Array.isArray(data)) {
        try {
          const savedOrderStr = localStorage.getItem("rin_admin_tags_order");
          if (savedOrderStr) {
            const orderIds: number[] = JSON.parse(savedOrderStr);
            const orderMap = new Map<number, number>();
            orderIds.forEach((id, idx) => orderMap.set(id, idx));
            data.sort((a, b) => {
              const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
              const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
              return idxA - idxB;
            });
          }
        } catch {}
        setHashtags(data as Hashtag[]);
      }
    } catch (err: any) {
      console.error("加载标签列表失败:", err);
    }
  }, []);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const toggleTagAction = (action: string) => {
    const next = feedTagActions.includes(action)
      ? feedTagActions.filter((a) => a !== action)
      : [...feedTagActions, action];
    setFeedTagActions(next);
    try {
      localStorage.setItem("rin_feed_tag_actions", JSON.stringify(next));
    } catch {}
    showToast("✓ 文章页附加按钮标签配置已保存！");
  };

  // 统计数据
  const unlinkedCount = useMemo(() => {
    return hashtags?.filter((h) => getTagFeeds(h) === 0).length || 0;
  }, [hashtags]);

  const totalFeedsCount = useMemo(() => {
    return hashtags?.reduce((acc, h) => acc + getTagFeeds(h), 0) || 0;
  }, [hashtags]);

  // 新建标签
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
        await loadTags();
        showToast(`✨ 标签 “#${trimmed}” 添加成功！`);
      } else if (error) {
        showAlert(String(error.value || "创建标签失败"));
      }
    } catch (err: any) {
      showAlert(err.message || "创建标签异常");
    } finally {
      setCreating(false);
    }
  };

  // 编辑重命名
  const handleStartEdit = (tag: Hashtag) => {
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
        setHashtags((prev) =>
          prev ? prev.map((item) => (item.id === editingTag.id ? { ...item, name: trimmed } : item)) : []
        );
        setEditingTag(null);
        showToast(`✓ 标签已重命名为 “#${trimmed}”`);
      } else if (error) {
        showAlert(String(error.value || "更新标签失败"));
      }
    } catch (err: any) {
      showAlert(err.message || "更新标签异常");
    } finally {
      setSavingId(null);
    }
  };

  // 单个删除
  const handleDeleteTag = (id: number, name: string) => {
    showConfirm(
      `删除标签 “#${name}” 确认`,
      "删除后关联文章的该标签将被解除，文章本身不受影响。",
      async () => {
        setSavingId(id);
        try {
          const { error } = await client.tag.delete(id);
          if (error) {
            showAlert(String(error.value || "删除标签失败"));
          } else {
            showToast(`✓ 已删除标签 #${name}`);
            await loadTags();
          }
        } catch (err: any) {
          showAlert(err.message || "删除标签异常");
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
      `批量删除 ${selectedIds.size} 个标签确认`,
      "将批量永久移除选中的标签体系，关联文章的该标签将被同步解除。",
      async () => {
        try {
          await Promise.all(Array.from(selectedIds).map((id) => client.tag.delete(id)));
          setSelectedIds(new Set());
          showToast(`✓ 成功批量删除 ${selectedIds.size} 个标签！`);
          await loadTags();
        } catch (err: any) {
          showAlert(err.message || "批量删除标签异常");
        }
      }
    );
  };

  // 一键清理孤儿空标签
  const handleCleanUnlinkedTags = () => {
    if (!unlinkedCount) return;
    showConfirm(
      `确认一键清理 ${unlinkedCount} 个空标签吗？`,
      "该操作将从数据库中安全删除未关联任何文章的孤儿标签，关联有文章的标签不受影响。",
      async () => {
        setIsCleaning(true);
        try {
          const res = await client.tag.deleteUnlinked();
          if (res.data?.success) {
            showToast(`✓ 成功清理 ${res.data.count} 个无文章孤儿标签！`);
          } else {
            showToast("✓ 清理完成");
          }
          await loadTags();
        } catch (err: any) {
          showToast("清理失败: " + (err?.message || "未知错误"));
        } finally {
          setIsCleaning(false);
        }
      }
    );
  };

  // 直接按数字输入调序
  const handleMoveTagToIndex = (fromIndex: number, targetNumStr: string) => {
    if (!hashtags) return;
    const targetNum = parseInt(targetNumStr.trim(), 10);
    if (isNaN(targetNum) || targetNum < 1) return;
    const targetIdx = Math.min(hashtags.length, targetNum) - 1;
    if (targetIdx === fromIndex) return;

    const list = [...hashtags];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(targetIdx, 0, moved);
    setHashtags(list);

    try {
      localStorage.setItem("rin_admin_tags_order", JSON.stringify(list.map((t) => t.id)));
      showToast(`✓ 标签已调至第 ${targetNum} 位`);
    } catch {}
  };

  // 关联文章弹窗
  const handleOpenAssociation = async (tag: Hashtag) => {
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
        showToast(`🎉 标签「${associatingTag.name}」文章关联已更新！`);
        setAssociatingTag(null);
        await loadTags();
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

  // 数据表格全选与单选
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

  const handleSortField = (field: "id" | "name" | "feeds") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "feeds" ? "desc" : "asc");
    }
  };

  // 书签星云模式下的过滤与排序
  const sortedHashtagsForCloud = useMemo(() => {
    if (!hashtags) return [];
    const list = showEmptyTags ? [...hashtags] : hashtags.filter((h) => getTagFeeds(h) > 0);
    return list.sort((a, b) => {
      if (sortBy === "popular") {
        const feedsA = getTagFeeds(a);
        const feedsB = getTagFeeds(b);
        if (feedsB !== feedsA) return feedsB - feedsA;
      }
      if (sortBy === "latest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0; // 自定义顺序按当前数组顺序
    });
  }, [hashtags, showEmptyTags, sortBy]);

  // 数据表格模式下的过滤与分页
  const sortedAndFilteredTags = useMemo(() => {
    if (!hashtags) return [];
    let result = [...hashtags];

    if (filterMode === "linked") {
      result = result.filter((t) => getTagFeeds(t) > 0);
    } else if (filterMode === "unlinked") {
      result = result.filter((t) => getTagFeeds(t) === 0);
    }

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
        const feedsA = getTagFeeds(a);
        const feedsB = getTagFeeds(b);
        return sortOrder === "asc" ? feedsA - feedsB : feedsB - feedsA;
      }
      return sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });

    return result;
  }, [hashtags, searchQuery, filterMode, sortField, sortOrder]);

  const totalItems = sortedAndFilteredTags.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedTags = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredTags.slice(start, start + pageSize);
  }, [sortedAndFilteredTags, currentPage, pageSize]);

  return (
    <>
      <Helmet>
        <title>{`${t("hashtags")} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t("hashtags")} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <AlertUI />
      <ConfirmUI />

      {/* Toast 提示条 */}
      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-900 border border-theme/30 backdrop-blur-md shadow-2xl text-xs font-bold ani-show flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-theme" />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      <Waiting for={hashtags}>
        <main className="w-full flex flex-col justify-center items-center mb-10 ani-show">
          {/* 顶栏信息、统计与视图模式切换 */}
          <div className="wauto text-start py-5 border-b border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight art-title-${
                    siteConfig.hashtagsTitleStyle || siteConfig.atelierTitleStyle || "aurora_flow"
                  }`}
                >
                  {t("hashtags")}
                </h1>
                {isAdmin ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-theme/10 text-theme text-xs font-bold border border-theme/20 shadow-2xs">
                    前台管理中枢
                  </span>
                ) : null}
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-2 flex-wrap font-mono">
                <span>共 {hashtags?.length || 0} 个标签</span>
                <span>·</span>
                <span>总关联 {totalFeedsCount} 篇次文章</span>
                {unlinkedCount > 0 ? (
                  <>
                    <span>·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      含 {unlinkedCount} 个空标签
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
              {/* 管理员视图切换：书签星云 vs 数据表格 */}
              {isAdmin ? (
                <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("cloud")}
                    className={`rounded-full px-3 py-1.5 transition select-none cursor-pointer flex items-center gap-1.5 ${
                      viewMode === "cloud"
                        ? "bg-white text-theme shadow-xs dark:bg-neutral-800 dark:text-white font-bold scale-105"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 font-medium"
                    }`}
                  >
                    <i className="ri-bookmark-3-line" />
                    <span>晶透书签流</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("datagrid")}
                    className={`rounded-full px-3 py-1.5 transition select-none cursor-pointer flex items-center gap-1.5 ${
                      viewMode === "datagrid"
                        ? "bg-white text-theme shadow-xs dark:bg-neutral-800 dark:text-white font-bold scale-105"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 font-medium"
                    }`}
                  >
                    <i className="ri-table-line" />
                    <span>超级数据盘</span>
                  </button>
                </div>
              ) : (
                /* 访客排序器 */
                <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSortBy("latest")}
                    className={`rounded-full px-3.5 py-1.5 transition select-none cursor-pointer ${
                      sortBy === "latest"
                        ? "bg-white text-theme shadow-xs dark:bg-neutral-800 dark:text-white font-bold scale-105"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 font-medium"
                    }`}
                  >
                    <i className="ri-time-line mr-1" />
                    <span>{t("sort_latest")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("popular")}
                    className={`rounded-full px-3.5 py-1.5 transition select-none cursor-pointer ${
                      sortBy === "popular"
                        ? "bg-white text-theme shadow-xs dark:bg-neutral-800 dark:text-white font-bold scale-105"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 font-medium"
                    }`}
                  >
                    <i className="ri-fire-line mr-1 text-rose-500" />
                    <span>{t("sort_popular")}</span>
                  </button>
                </div>
              )}

              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-full border border-black/10 bg-w px-4 py-2 text-xs font-bold t-primary shadow-xs hover:shadow-md hover:border-theme transition transform hover:-translate-y-0.5 active:scale-95"
              >
                <i className="ri-arrow-left-line text-theme transition-transform group-hover:-translate-x-1" />
                <span>返回画廊</span>
              </Link>
            </div>
          </div>

          {/* 管理员前台创作与操作中枢 */}
          {isAdmin ? (
            <div className="wauto mt-4 p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/60 border border-theme/20 shadow-xs backdrop-blur-md flex flex-col gap-3.5 text-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* 快速新建标签输入栏 */}
                <form onSubmit={handleCreateTag} className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <i className="ri-hashtag absolute left-2.5 top-2 text-neutral-400 text-xs" />
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="创建新标签名称（回车即刻创建）..."
                      className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] pl-7 pr-3 py-1.5 text-xs t-primary outline-hidden focus:border-theme"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creating || !newTagName.trim()}
                    className="px-3.5 py-1.5 rounded-xl bg-theme text-white font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-40 transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    {creating ? <i className="ri-loader-4-line animate-spin text-xs" /> : <i className="ri-add-line text-xs" />}
                    <span>新建</span>
                  </button>
                </form>

                {/* 快捷批量与清理操作 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowEmptyTags((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl font-medium border transition cursor-pointer select-none flex items-center gap-1.5 ${
                      showEmptyTags
                        ? "bg-theme text-white border-theme shadow-2xs font-bold"
                        : "bg-white dark:bg-neutral-800 border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-theme"
                    }`}
                  >
                    <i className={showEmptyTags ? "ri-eye-line" : "ri-eye-off-line"} />
                    <span>{showEmptyTags ? "已透出空标签" : "透出0篇空标签"}</span>
                  </button>

                  {unlinkedCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleCleanUnlinkedTags}
                      disabled={isCleaning}
                      className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      title="一键彻底清理未关联任何文章的孤儿标签"
                    >
                      <i className={`ri-delete-bin-line ${isCleaning ? "animate-spin" : ""}`} />
                      <span>{isCleaning ? "清理中..." : `清理空标签 (${unlinkedCount})`}</span>
                    </button>
                  ) : null}

                  {selectedIds.size > 0 ? (
                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold shadow-2xs hover:bg-rose-700 active:scale-95 transition cursor-pointer flex items-center gap-1"
                    >
                      <i className="ri-delete-bin-6-line" />
                      <span>批量删除 ({selectedIds.size})</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* 标签栏功能性按钮开关 */}
              <div className="pt-2.5 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-[11px]">文章正文底部标签栏附加快捷按钮：</span>
                <div className="flex items-center gap-3.5 flex-wrap text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-theme transition">
                    <input
                      type="checkbox"
                      checked={feedTagActions.includes("prev")}
                      onChange={() => toggleTagAction("prev")}
                      className="accent-theme cursor-pointer"
                    />
                    <span>上一篇</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-theme transition">
                    <input
                      type="checkbox"
                      checked={feedTagActions.includes("next")}
                      onChange={() => toggleTagAction("next")}
                      className="accent-theme cursor-pointer"
                    />
                    <span>下一篇</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-theme transition">
                    <input
                      type="checkbox"
                      checked={feedTagActions.includes("random")}
                      onChange={() => toggleTagAction("random")}
                      className="accent-theme cursor-pointer"
                    />
                    <span>随机换篇</span>
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {/* 视图 1：晶透书签星云流 (Artistic Bookmark Cloud) */}
          {viewMode === "cloud" ? (
            <div className="wauto flex flex-wrap items-center justify-start gap-x-3 gap-y-3.5 mt-8 pb-14">
              {sortedHashtagsForCloud?.map((hashtag, index) => {
                const rot = TAG_ROTATIONS[index % TAG_ROTATIONS.length];
                const feedCount = getTagFeeds(hashtag);
                const isSingleArticle = feedCount === 1 && Boolean(hashtag.singleFeedId);
                const isEmptyTag = feedCount === 0;

                const bookmarkStyle = isEmptyTag
                  ? {
                      card: "bg-neutral-100/80 text-neutral-400 border-dashed border-neutral-300 dark:bg-neutral-800/40 dark:text-neutral-500 dark:border-neutral-700/60",
                      dot: "bg-neutral-300 dark:bg-neutral-600",
                    }
                  : TAG_BOOKMARK_STYLES[index % TAG_BOOKMARK_STYLES.length];

                const targetHref = isSingleArticle
                  ? `/feed/${hashtag.singleFeedId}`
                  : `/hashtag/${encodeURIComponent(hashtag.name)}`;

                return (
                  <div
                    key={hashtag.id || index}
                    className={`group relative inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-md rounded-r-2xl border shadow-2xs text-xs font-medium transform ${rot} hover:rotate-0 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 select-none ${bookmarkStyle.card}`}
                  >
                    {/* 书签穿孔小圆点 */}
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 opacity-80 ${bookmarkStyle.dot}`} aria-hidden="true" />

                    <Link
                      href={targetHref}
                      className="inline-flex items-center gap-1.5 cursor-pointer"
                      title={isSingleArticle ? "包含 1 篇文章，点击直达正文" : `包含 ${feedCount} 篇文章`}
                    >
                      <span className="font-bold tracking-tight">#{hashtag.name}</span>
                      <span className="text-[10px] font-mono font-semibold opacity-70 px-1 py-0.2 rounded-full bg-black/5 dark:bg-white/10">
                        {feedCount}
                      </span>
                    </Link>

                    {/* 管理员就地悬浮操作条 */}
                    {isAdmin ? (
                      <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(hashtag)}
                          className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/10 transition"
                          title="重命名标签"
                        >
                          <i className="ri-edit-line text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAssociation(hashtag)}
                          className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/10 transition"
                          title="挂载/解绑关联文章"
                        >
                          <i className="ri-link text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(hashtag.id, hashtag.name)}
                          className="p-1 rounded-md text-neutral-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/10 transition"
                          title={`删除标签 #${hashtag.name}`}
                        >
                          <i className="ri-delete-bin-line text-xs" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            /* 视图 2：高密单屏超级数据表格 (Dense DataGrid) */
            <div className="wauto mt-6 pb-16 flex flex-col gap-3">
              {/* 表格搜索与过滤工具栏 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索标签名称或ID..."
                      className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] pl-8 pr-3 py-1.5 text-xs outline-hidden focus:border-theme w-48 sm:w-64"
                    />
                    <i className="ri-search-line absolute left-2.5 top-2 text-neutral-400" />
                  </div>

                  <div className="flex items-center rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
                    {[
                      { id: "all", label: "全部" },
                      { id: "linked", label: "有文章" },
                      { id: "unlinked", label: "空标签" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterMode(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                          filterMode === f.id
                            ? "bg-white text-theme shadow-2xs font-bold dark:bg-neutral-800"
                            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400 font-mono">
                  显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} 项（共 {totalItems} 项）
                </div>
              </div>

              {/* 超级数据表格主体 */}
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-neutral-900/90 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] text-neutral-500 font-semibold select-none">
                        <th className="py-2.5 px-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === paginatedTags.length && paginatedTags.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded accent-theme cursor-pointer"
                          />
                        </th>
                        <th
                          className="py-2.5 px-3 w-16 cursor-pointer hover:text-theme"
                          onClick={() => handleSortField("id")}
                        >
                          <div className="flex items-center gap-1 font-mono">
                            <span>ID</span>
                            {sortField === "id" ? <i className={sortOrder === "asc" ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} /> : null}
                          </div>
                        </th>
                        <th
                          className="py-2.5 px-3 cursor-pointer hover:text-theme"
                          onClick={() => handleSortField("name")}
                        >
                          <div className="flex items-center gap-1">
                            <span>标签名称</span>
                            {sortField === "name" ? <i className={sortOrder === "asc" ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} /> : null}
                          </div>
                        </th>
                        <th
                          className="py-2.5 px-3 w-28 text-center cursor-pointer hover:text-theme"
                          onClick={() => handleSortField("feeds")}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>关联文章</span>
                            {sortField === "feeds" ? <i className={sortOrder === "asc" ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} /> : null}
                          </div>
                        </th>
                        <th className="py-2.5 px-3 w-28 text-center">次序调优</th>
                        <th className="py-2.5 px-4 w-36 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {paginatedTags.map((tag, idx) => {
                        const globalIndex = (currentPage - 1) * pageSize + idx + 1;
                        const isChecked = selectedIds.has(tag.id);
                        const isEditingThis = editingTag?.id === tag.id;

                        return (
                          <tr
                            key={tag.id}
                            className={`hover:bg-theme/[0.02] dark:hover:bg-white/[0.02] transition-colors ${
                              isChecked ? "bg-theme/[0.04]" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectOne(tag.id)}
                                className="rounded accent-theme cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-400">
                              #{tag.id}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditingThis ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="rounded-lg border border-theme px-2 py-0.5 text-xs outline-none bg-transparent"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveEdit();
                                      if (e.key === "Escape") setEditingTag(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    disabled={savingId === tag.id}
                                    className="text-theme font-bold hover:underline"
                                  >
                                    保存
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTag(null)}
                                    className="text-neutral-400 hover:text-neutral-600"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <Link
                                  href={`/hashtag/${encodeURIComponent(tag.name)}`}
                                  className="font-bold text-neutral-800 dark:text-neutral-200 hover:text-theme transition flex items-center gap-1.5"
                                >
                                  <span>#{tag.name}</span>
                                  {getTagFeeds(tag) === 0 ? (
                                    <span className="text-[10px] text-neutral-400 font-normal scale-90">
                                      (空)
                                    </span>
                                  ) : null}
                                </Link>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  getTagFeeds(tag) > 0
                                    ? "bg-theme/10 text-theme"
                                    : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                                }`}
                              >
                                {getTagFeeds(tag)} 篇
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                defaultValue={globalIndex}
                                onBlur={(e) => handleMoveTagToIndex(globalIndex - 1, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleMoveTagToIndex(globalIndex - 1, (e.target as HTMLInputElement).value);
                                  }
                                }}
                                className="w-14 rounded-md border border-black/10 dark:border-white/10 px-1.5 py-0.5 text-center font-mono text-[11px] outline-none focus:border-theme bg-transparent"
                                title="输入目标数字回车直接调序"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(tag)}
                                  className="p-1 rounded-md text-neutral-500 hover:text-theme hover:bg-theme/10 transition"
                                  title="重命名"
                                >
                                  <i className="ri-edit-line text-sm" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssociation(tag)}
                                  className="p-1 rounded-md text-neutral-500 hover:text-theme hover:bg-theme/10 transition"
                                  title="管理关联文章"
                                >
                                  <i className="ri-link text-sm" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTag(tag.id, tag.name)}
                                  className="p-1 rounded-md text-neutral-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                  title="删除标签"
                                >
                                  <i className="ri-delete-bin-line text-sm" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 分页控制条 */}
                <div className="px-4 py-3 border-t border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">每页</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs outline-none focus:border-theme"
                    >
                      <option value={15}>15 条</option>
                      <option value={20}>20 条</option>
                      <option value={50}>50 条</option>
                      <option value={100}>100 条</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 font-mono">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:border-theme disabled:opacity-40 transition"
                    >
                      上一页
                    </button>
                    <span className="px-2 text-neutral-500">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:border-theme disabled:opacity-40 transition"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </Waiting>

      {/* 关联/解绑文章弹窗 */}
      {associatingTag && (
        <Modal
          isOpen={!!associatingTag}
          onRequestClose={() => setAssociatingTag(null)}
          contentLabel={`管理标签「${associatingTag.name}」关联文章`}
          panelClassName="p-6 max-w-xl w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
        >
          <div className="flex flex-col gap-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div>
                <h3 className="text-sm font-bold t-primary flex items-center gap-2">
                  <span>管理关联文章:</span>
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
                  .filter(
                    (f) =>
                      !feedSearchQuery.trim() ||
                      f.title.toLowerCase().includes(feedSearchQuery.trim().toLowerCase())
                  )
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
                          <span
                            className={`font-medium truncate ${
                              isChecked ? "text-theme font-bold" : "text-neutral-700 dark:text-neutral-200"
                            }`}
                          >
                            {feed.title}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-neutral-400 shrink-0 ml-2">
                          {new Date(feed.createdAt).toLocaleDateString()}
                        </span>
                      </label>
                    );
                  })}
              </div>
            )}

            {/* 弹窗底部操作条 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setAssociatingTag(null)}
                className="px-3.5 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveAssociation}
                disabled={savingAssociation}
                className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
              >
                {savingAssociation ? "保存中..." : "保存关联"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
