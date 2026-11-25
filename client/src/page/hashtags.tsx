import { Modal, Spinner } from "@rin/ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useAlert, useConfirm } from "../components/dialog";
import { Waiting } from "../components/loading";
import { GALLERY_CONTAINER_CLASS, PageHeader } from "../components/page-header";
import { SolidTagIcon, getTagColorTheme } from "../components/hashtag";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { ProfileContext } from "../state/profile";
import { siteName } from "../utils/constants";
import { emitToast } from "../utils/toast";

type Hashtag = {
  id: number;
  name: string;
  count?: number;
  feeds?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  singleFeedId?: number | null;
};

type CloudStyle = "hairline" | "washi" | "minimal" | "pill";

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

const CLOUD_STYLE_OPTIONS: Array<{ id: CloudStyle; label: string }> = [
  { id: "hairline", label: "素雅描边" },
  { id: "washi", label: "晶透书签" },
  { id: "minimal", label: "极简排印" },
  { id: "pill", label: "微光胶囊" },
];

export function HashtagsPage({ embeddedInAdmin = false }: { embeddedInAdmin?: boolean }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const profile = useContext(ProfileContext);
  const isAdmin = Boolean(profile?.permission);
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [hashtags, setHashtags] = useState<Hashtag[]>();

  // 视图模式：云图 (cloud) / 表格 (datagrid)
  const [viewMode, setViewMode] = useState<"cloud" | "datagrid">("cloud");

  // 云图风格：素雅描边 (hairline) / 晶透书签 (washi) / 极简排印 (minimal) / 微光胶囊 (pill)
  const [cloudStyle, setCloudStyle] = useState<CloudStyle>(() => {
    try {
      const saved = localStorage.getItem("rin_tag_cloud_style");
      if (saved === "hairline" || saved === "washi" || saved === "minimal" || saved === "pill") {
        return saved;
      }
      return "hairline";
    } catch {
      return "hairline";
    }
  });

  const handleCloudStyleChange = (st: CloudStyle) => {
    setCloudStyle(st);
    try {
      localStorage.setItem("rin_tag_cloud_style", st);
    } catch {}
  };

  // 排序与筛选状态
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "custom">("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "linked" | "unlinked">("all");
  const [isCleaning, setIsCleaning] = useState(false);

  // 新建与编辑状态
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  const loadTags = useCallback(async () => {
    try {
      const { data } = await client.tag.list();
      if (data && Array.isArray(data)) {
        const list = [...(data as Hashtag[])];
        try {
          const savedOrderStr = localStorage.getItem("rin_admin_tags_order");
          if (savedOrderStr) {
            const orderIds: number[] = JSON.parse(savedOrderStr);
            const orderMap = new Map<number, number>();
            orderIds.forEach((id, idx) => orderMap.set(id, idx));
            list.sort((a, b) => {
              const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
              const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
              return idxA - idxB;
            });
          }
        } catch {}
        setHashtags(list);
      }
    } catch (err: any) {
      console.error("加载标签列表失败:", err);
    }
  }, []);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const effectiveViewMode = isAdmin ? viewMode : "cloud";

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
    const formEl = e?.currentTarget || (e?.target as HTMLFormElement | null);
    const domVal = formEl?.querySelector?.("input")?.value || "";
    const trimmed = newTagName.trim() || domVal.trim();
    if (!trimmed) {
      showAlert("请输入想要添加的标签名称~");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await client.tag.create(trimmed);
      if (data) {
        setNewTagName("");
        setIsCreateOpen(false);
        await loadTags();
        emitToast(`标签 “#${trimmed}” 添加成功`, "success");
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
        emitToast(`标签已重命名为 “#${trimmed}”`, "success");
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
            emitToast(`已删除标签 #${name}`, "success");
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
    const targetCount = selectedIds.size;
    showConfirm(
      `批量删除 ${targetCount} 个标签确认`,
      "将批量永久移除选中的标签体系，关联文章的该标签将被同步解除。",
      async () => {
        try {
          await Promise.all(Array.from(selectedIds).map((id) => client.tag.delete(id)));
          setSelectedIds(new Set());
          emitToast(`已批量删除 ${targetCount} 个标签`, "success");
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
            emitToast(`已清理 ${res.data.count} 个空标签`, "success");
          } else {
            emitToast("空标签清理完成", "success");
          }
          await loadTags();
        } catch (err: any) {
          showAlert("清理失败: " + (err?.message || "未知错误"));
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
      emitToast(`标签已调至第 ${targetNum} 位`, "success");
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
        emitToast(`标签「${associatingTag.name}」文章关联已更新`, "success");
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

  const handleSortField = (field: "id" | "name" | "feeds") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "feeds" ? "desc" : "asc");
    }
  };

  // 云图模式下的过滤与排序（统一复用 searchQuery 与 filterMode）
  const sortedHashtagsForCloud = useMemo(() => {
    if (!hashtags) return [];
    let list = [...hashtags];

    if (isAdmin) {
      if (filterMode === "linked") {
        list = list.filter((h) => getTagFeeds(h) > 0);
      } else if (filterMode === "unlinked") {
        list = list.filter((h) => getTagFeeds(h) === 0);
      }
    } else {
      list = list.filter((h) => getTagFeeds(h) > 0);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) => h.name.toLowerCase().includes(q) || String(h.id).includes(q)
      );
    }

    return list.sort((a, b) => {
      if (sortBy === "popular") {
        const feedsA = getTagFeeds(a);
        const feedsB = getTagFeeds(b);
        if (feedsB !== feedsA) return feedsB - feedsA;
      }
      if (sortBy === "latest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }, [hashtags, isAdmin, filterMode, searchQuery, sortBy]);

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
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTags = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedAndFilteredTags.slice(start, start + pageSize);
  }, [sortedAndFilteredTags, safeCurrentPage, pageSize]);

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

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  return (
    <>
      <Helmet>
        <title>{`${t("hashtags_index", { defaultValue: "标签索引" })} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t("hashtags_index", { defaultValue: "标签索引" })} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <AlertUI />
      <ConfirmUI />

      <Waiting for={hashtags}>
        <main className={embeddedInAdmin ? "w-full ani-show" : `${GALLERY_CONTAINER_CLASS} py-6 sm:py-8 mb-16 ani-show`}>
          {!embeddedInAdmin && (
            <PageHeader
              eyebrow={`HASHTAG ARCHIVE · ${hashtags?.length || 0}`}
              title={t("hashtags_index", { defaultValue: "标签索引" })}
              subtitle={`万象归卷，随引而遇 · 共 ${hashtags?.length || 0} 个话题，关联 ${totalFeedsCount} 篇次`}
              mode={siteConfig.pageHeaderMode}
              titleFont={siteConfig.themeTitleFont as any}
              titleEffect={siteConfig.themeTitleEffect}
              bannerUrl={siteConfig.pageHeaderBannerUrl}
            />
          )}

          {/* 单层均衡控制工具栏 */}
          <section
            data-hashtags-toolbar="true"
            className="w-full mb-6 pb-4 border-b border-[rgb(var(--rin-hairline-rgb)/0.8)] space-y-2.5"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              {/* 左侧：检索 + 分段筛选/排序 */}
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <div className="relative w-full sm:w-52">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--rin-ink-muted-rgb))] text-xs pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="搜索标签或 ID..."
                    className="w-full rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] pl-8 pr-7 py-1.5 text-xs text-[rgb(var(--rin-ink-rgb))] placeholder:text-[rgb(var(--rin-ink-muted-rgb))] outline-none focus:border-theme/55 transition-colors"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] cursor-pointer"
                      aria-label="清空搜索"
                    >
                      <i className="ri-close-circle-line text-xs" />
                    </button>
                  ) : null}
                </div>

                {isAdmin ? (
                  <>
                    <div className="inline-flex items-center rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-0.5 text-xs">
                      {[
                        { id: "all" as const, label: "全部" },
                        { id: "linked" as const, label: "有文章" },
                        { id: "unlinked" as const, label: "空标签" },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setFilterMode(f.id);
                            setCurrentPage(1);
                          }}
                          className={`rounded-full px-2.5 py-1 text-[11px] transition cursor-pointer select-none whitespace-nowrap ${
                            filterMode === f.id
                              ? "bg-theme text-white font-semibold shadow-2xs"
                              : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {effectiveViewMode === "cloud" ? (
                      <div className="inline-flex items-center rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setSortBy("latest")}
                          className={`rounded-full px-2.5 py-1 text-[11px] transition cursor-pointer select-none whitespace-nowrap ${
                            sortBy === "latest"
                              ? "bg-theme/15 text-theme font-semibold"
                              : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                          }`}
                        >
                          {t("sort_latest", { defaultValue: "最新" })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSortBy("popular")}
                          className={`rounded-full px-2.5 py-1 text-[11px] transition cursor-pointer select-none whitespace-nowrap ${
                            sortBy === "popular"
                              ? "bg-theme/15 text-theme font-semibold"
                              : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                          }`}
                        >
                          {t("sort_popular", { defaultValue: "热门" })}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="inline-flex items-center rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSortBy("latest")}
                      className={`rounded-full px-3 py-1 text-[11px] transition cursor-pointer select-none whitespace-nowrap inline-flex items-center gap-1 ${
                        sortBy === "latest"
                          ? "bg-theme text-white font-semibold shadow-2xs"
                          : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                      }`}
                    >
                      <i className="ri-time-line text-xs" />
                      <span>{t("sort_latest", { defaultValue: "最新" })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy("popular")}
                      className={`rounded-full px-3 py-1 text-[11px] transition cursor-pointer select-none whitespace-nowrap inline-flex items-center gap-1 ${
                        sortBy === "popular"
                          ? "bg-theme text-white font-semibold shadow-2xs"
                          : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                      }`}
                    >
                      <i className="ri-fire-line text-xs" />
                      <span>{t("sort_popular", { defaultValue: "热门" })}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 右侧：视图切换 + 云图风格 + 管理员紧凑操作组 */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isAdmin ? (
                  <div className="inline-flex items-center rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode("cloud")}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition cursor-pointer select-none inline-flex items-center gap-1 whitespace-nowrap ${
                        viewMode === "cloud"
                          ? "bg-theme text-white font-semibold shadow-2xs"
                          : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                      }`}
                    >
                      <i className="ri-bookmark-3-line text-xs" />
                      <span>{t("hashtags_view_cloud_short", { defaultValue: "云图" })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("datagrid")}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition cursor-pointer select-none inline-flex items-center gap-1 whitespace-nowrap ${
                        viewMode === "datagrid"
                          ? "bg-theme text-white font-semibold shadow-2xs"
                          : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                      }`}
                    >
                      <i className="ri-table-line text-xs" />
                      <span>{t("hashtags_view_table_short", { defaultValue: "表格" })}</span>
                    </button>
                  </div>
                ) : null}

                {effectiveViewMode === "cloud" ? (
                  <div
                    role="group"
                    aria-label="云图风格"
                    className="inline-flex items-center rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-0.5 text-xs"
                  >
                    {CLOUD_STYLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleCloudStyleChange(opt.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] transition cursor-pointer select-none whitespace-nowrap ${
                          cloudStyle === opt.id
                            ? "bg-theme/15 text-theme font-semibold"
                            : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen((prev) => !prev)}
                      aria-expanded={isCreateOpen}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                        isCreateOpen
                          ? "border-theme/45 bg-theme/10 text-theme font-semibold"
                          : "border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] hover:border-theme/45 hover:text-theme"
                      }`}
                    >
                      <span>{isCreateOpen ? "收起新建" : "+ 新建标签"}</span>
                    </button>

                    {unlinkedCount > 0 ? (
                      <button
                        type="button"
                        onClick={handleCleanUnlinkedTags}
                        disabled={isCleaning}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-300/60 dark:border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        title="一键彻底清理未关联任何文章的孤儿标签"
                      >
                        <i className={`ri-delete-bin-line text-xs ${isCleaning ? "animate-spin" : ""}`} />
                        <span>{isCleaning ? "清理中..." : `清理空标签 (${unlinkedCount})`}</span>
                      </button>
                    ) : null}

                    {selectedIds.size > 0 ? (
                      <button
                        type="button"
                        onClick={handleBatchDelete}
                        className="inline-flex items-center gap-1 rounded-full bg-rose-600 text-white hover:bg-rose-700 px-3 py-1.5 text-xs font-semibold shadow-2xs active:scale-95 transition cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-delete-bin-6-line text-xs" />
                        <span>批量删除 ({selectedIds.size})</span>
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {/* 管理员按需展开的紧凑内联新建条 */}
            {isAdmin && isCreateOpen ? (
              <form
                onSubmit={handleCreateTag}
                className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-[rgb(var(--rin-hairline-rgb)/0.6)] text-xs ani-show-fast"
              >
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <i className="ri-hashtag absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--rin-ink-muted-rgb))] text-xs pointer-events-none" />
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="输入新标签名称（回车创建）..."
                    autoFocus
                    className="w-full rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] pl-8 pr-3 py-1.5 text-xs text-[rgb(var(--rin-ink-rgb))] placeholder:text-[rgb(var(--rin-ink-muted-rgb))] outline-none focus:border-theme/55"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-full bg-theme px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-theme-hover active:scale-95 disabled:opacity-40 transition cursor-pointer inline-flex items-center gap-1"
                >
                  {creating ? <i className="ri-loader-4-line animate-spin text-xs" /> : <i className="ri-check-line text-xs" />}
                  <span>{creating ? "创建中..." : "确认创建"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setNewTagName("");
                  }}
                  className="rounded-full px-3 py-1.5 text-xs text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] transition cursor-pointer"
                >
                  取消
                </button>
              </form>
            ) : null}
          </section>

          {/* 视图 1：标签云图 (Cloud View) */}
          {effectiveViewMode === "cloud" ? (
            <div className="w-full pb-12">
              {sortedHashtagsForCloud.length === 0 ? (
                <div className="py-20 text-center text-sm text-[rgb(var(--rin-ink-muted-rgb))]">
                  暂无匹配的标签
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  {sortedHashtagsForCloud.map((hashtag, index) => {
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
                    const tagTheme = getTagColorTheme(hashtag.name);

                    if (cloudStyle === "hairline") {
                      return (
                        <Link
                          key={hashtag.id || index}
                          href={targetHref}
                          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] hover:border-theme/50 hover:text-theme shadow-2xs transition-all select-none cursor-pointer group ${
                            isEmptyTag ? "opacity-65 border-dashed" : ""
                          }`}
                          title={isSingleArticle ? "包含 1 篇文章，点击直达正文" : `包含 ${feedCount} 篇文章`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isEmptyTag ? "bg-neutral-300 dark:bg-neutral-600" : tagTheme.dotClass
                            }`}
                          />
                          <span className="text-xs font-medium tracking-tight">{hashtag.name}</span>
                          <span className="text-[10px] font-mono text-[rgb(var(--rin-ink-muted-rgb))]">
                            {feedCount}
                          </span>
                        </Link>
                      );
                    }

                    if (cloudStyle === "pill") {
                      return (
                        <Link
                          key={hashtag.id || index}
                          href={targetHref}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-2xs hover:scale-105 active:scale-95 transition-all select-none cursor-pointer group ${
                            isEmptyTag ? bookmarkStyle.card : tagTheme.badgeClass
                          }`}
                          title={isSingleArticle ? "包含 1 篇文章，点击直达正文" : `包含 ${feedCount} 篇文章`}
                        >
                          <SolidTagIcon color={isEmptyTag ? undefined : tagTheme.iconColor} className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-bold tracking-tight text-xs">{hashtag.name}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 opacity-80">
                            {feedCount}
                          </span>
                        </Link>
                      );
                    }

                    if (cloudStyle === "minimal") {
                      return (
                        <Link
                          key={hashtag.id || index}
                          href={targetHref}
                          className="inline-flex items-baseline gap-1 text-sm font-medium text-[rgb(var(--rin-ink-rgb))] hover:text-theme transition-all select-none cursor-pointer group px-2.5 py-1 hover:bg-theme/5 rounded-lg"
                          title={isSingleArticle ? "包含 1 篇文章，点击直达正文" : `包含 ${feedCount} 篇文章`}
                        >
                          <span className="text-theme font-bold">#</span>
                          <span className="font-semibold">{hashtag.name}</span>
                          <span className="text-[10px] font-mono text-[rgb(var(--rin-ink-muted-rgb))] ml-0.5">
                            ({feedCount})
                          </span>
                        </Link>
                      );
                    }

                    return (
                      <Link
                        key={hashtag.id || index}
                        href={targetHref}
                        className={`inline-flex items-center gap-1.5 pl-2.5 pr-2.5 py-1.5 rounded-md rounded-r-2xl border shadow-2xs text-xs font-medium transform ${rot} hover:rotate-0 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 select-none cursor-pointer ${
                          isEmptyTag ? bookmarkStyle.card : tagTheme.badgeClass
                        }`}
                        title={isSingleArticle ? "包含 1 篇文章，点击直达正文" : `包含 ${feedCount} 篇文章`}
                      >
                        <SolidTagIcon color={isEmptyTag ? undefined : tagTheme.iconColor} className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold tracking-tight">{hashtag.name}</span>
                        <span className="text-[10px] font-mono font-semibold opacity-70 px-1 py-0.2 rounded-full bg-black/5 dark:bg-white/10">
                          {feedCount}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 视图 2：管理数据表格 (DataGrid View) */
            <div className="w-full pb-14">
              <div className="rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[rgb(var(--rin-hairline-rgb)/0.8)] bg-black/[0.015] dark:bg-white/[0.02] text-[rgb(var(--rin-ink-muted-rgb))] font-semibold select-none">
                        <th className="py-2.5 px-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === paginatedTags.length && paginatedTags.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded accent-theme cursor-pointer"
                            aria-label="全选当前页标签"
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
                    <tbody className="divide-y divide-[rgb(var(--rin-hairline-rgb)/0.6)]">
                      {paginatedTags.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-xs text-[rgb(var(--rin-ink-muted-rgb))]">
                            暂无匹配的标签记录
                          </td>
                        </tr>
                      ) : (
                        paginatedTags.map((tag, idx) => {
                          const globalIndex = (safeCurrentPage - 1) * pageSize + idx + 1;
                          const isChecked = selectedIds.has(tag.id);
                          const isEditingThis = editingTag?.id === tag.id;
                          const feedCount = getTagFeeds(tag);

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
                              <td className="py-2.5 px-3 font-mono text-[11px] text-[rgb(var(--rin-ink-muted-rgb))]">
                                #{tag.id}
                              </td>
                              <td className="py-2.5 px-3">
                                {isEditingThis ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      className="rounded-lg border border-theme px-2 py-0.5 text-xs outline-none bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))]"
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
                                      className="text-theme font-bold hover:underline cursor-pointer"
                                    >
                                      保存
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingTag(null)}
                                      className="text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] cursor-pointer"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <Link
                                    href={`/hashtag/${encodeURIComponent(tag.name)}`}
                                    className="font-semibold text-[rgb(var(--rin-ink-rgb))] hover:text-theme transition flex items-center gap-1.5"
                                  >
                                    <SolidTagIcon color={getTagColorTheme(tag.name).iconColor} className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tag.name}</span>
                                    {feedCount === 0 ? (
                                      <span className="text-[10px] text-[rgb(var(--rin-ink-muted-rgb))] font-normal">
                                        (空)
                                      </span>
                                    ) : null}
                                  </Link>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    feedCount > 0
                                      ? "bg-theme/10 text-theme"
                                      : "bg-black/5 dark:bg-white/5 text-[rgb(var(--rin-ink-muted-rgb))]"
                                  }`}
                                >
                                  {feedCount} 篇
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
                                  className="w-14 rounded-md border border-[rgb(var(--rin-hairline-rgb))] px-1.5 py-0.5 text-center font-mono text-[11px] outline-none focus:border-theme bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))]"
                                  title="输入目标数字回车直接调序"
                                />
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(tag)}
                                    className="p-1 rounded-md text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme hover:bg-theme/10 transition cursor-pointer"
                                    title="重命名"
                                  >
                                    <i className="ri-edit-line text-sm" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssociation(tag)}
                                    className="p-1 rounded-md text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme hover:bg-theme/10 transition cursor-pointer"
                                    title="管理关联文章"
                                  >
                                    <i className="ri-link text-sm" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTag(tag.id, tag.name)}
                                    className="p-1 rounded-md text-[rgb(var(--rin-ink-muted-rgb))] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                    title="删除标签"
                                  >
                                    <i className="ri-delete-bin-line text-sm" />
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

                {/* 底部统一分页脚注栏 */}
                <div
                  data-hashtags-pagination-footer="true"
                  className="px-3 sm:px-4 py-2.5 border-t border-[rgb(var(--rin-hairline-rgb)/0.8)] bg-black/[0.015] dark:bg-white/[0.02] flex flex-wrap items-center justify-between text-xs select-none gap-2"
                >
                  <div className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] font-mono">
                    {totalItems === 0
                      ? "共 0 项"
                      : `显示第 ${startItem} - ${endItem} 项 (共 ${totalItems} 项)`}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      aria-label="每页条数"
                      className="rounded-lg border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] px-2 py-1 text-xs outline-none focus:border-theme cursor-pointer"
                    >
                      <option value={15}>15 条/页</option>
                      <option value={20}>20 条/页</option>
                      <option value={50}>50 条/页</option>
                      <option value={100}>100 条/页</option>
                    </select>

                    <div className="flex items-center gap-1 font-mono shrink-0">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safeCurrentPage <= 1}
                        className="px-2 sm:px-2.5 py-1 rounded-lg border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] hover:border-theme disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-0.5 text-xs cursor-pointer"
                        title="上一页"
                      >
                        <i className="ri-arrow-left-s-line" />
                        <span className="hidden sm:inline">上一页</span>
                      </button>
                      <span className="px-1.5 sm:px-2 text-[rgb(var(--rin-ink-muted-rgb))] text-[11px] sm:text-xs whitespace-nowrap">
                        {safeCurrentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safeCurrentPage >= totalPages}
                        className="px-2 sm:px-2.5 py-1 rounded-lg border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] hover:border-theme disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-0.5 text-xs cursor-pointer"
                        title="下一页"
                      >
                        <span className="hidden sm:inline">下一页</span>
                        <i className="ri-arrow-right-s-line" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </Waiting>

      {/* 关联/解绑文章弹窗 */}
      {associatingTag ? (
        <Modal
          isOpen={!!associatingTag}
          onRequestClose={() => setAssociatingTag(null)}
          contentLabel={`管理标签「${associatingTag.name}」关联文章`}
          panelClassName="p-6 max-w-xl w-full bg-[rgb(var(--rin-elevated-rgb))] border border-[rgb(var(--rin-hairline-rgb))] rounded-2xl shadow-2xl"
        >
          <div className="flex flex-col gap-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[rgb(var(--rin-hairline-rgb)/0.6)]">
              <div>
                <h3 className="text-sm font-bold t-primary flex items-center gap-2">
                  <span>管理关联文章:</span>
                  <span className="text-theme font-mono">#{associatingTag.name}</span>
                </h3>
                <p className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] mt-0.5">
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
                className="w-full rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-theme"
              />
              <i className="ri-search-line absolute left-2.5 top-2 text-[rgb(var(--rin-ink-muted-rgb))]" />
            </div>

            {/* 文章列表 */}
            {loadingFeeds ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[rgb(var(--rin-hairline-rgb)/0.5)]">
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
                              isChecked ? "text-theme font-bold" : "text-[rgb(var(--rin-ink-rgb))]"
                            }`}
                          >
                            {feed.title}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[rgb(var(--rin-ink-muted-rgb))] shrink-0 ml-2">
                          {new Date(feed.createdAt).toLocaleDateString()}
                        </span>
                      </label>
                    );
                  })}
              </div>
            )}

            {/* 弹窗底部操作条 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgb(var(--rin-hairline-rgb)/0.6)]">
              <button
                type="button"
                onClick={() => setAssociatingTag(null)}
                className="px-3.5 py-1.5 rounded-xl text-[rgb(var(--rin-ink-muted-rgb))] hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveAssociation}
                disabled={savingAssociation}
                className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition cursor-pointer"
              >
                {savingAssociation ? "保存中..." : "保存关联"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
