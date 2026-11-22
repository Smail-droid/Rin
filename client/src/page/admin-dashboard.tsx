import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useAlert, useConfirm } from "../components/dialog";
import { Modal } from "@rin/ui";
import { normalizeBlobUrl } from "../utils/url";
import { R2MediaPickerModal } from "../components/r2-media-picker-modal";
import { getAuthToken } from "../utils/auth";
import { fetchR2StorageStats, type R2StorageStats } from "../services/music-api";

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface RealtimeStats {
  feedsTotal: number;
  feedsPublished: number;
  feedsDraft: number;
  momentsTotal: number;
  commentsTotal: number;
  commentsPending: number;
  storageCount: number;
  storageBytes: number;
  loading: boolean;
}

export function AdminDashboardPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  const [stats, setStats] = useState<RealtimeStats>({
    feedsTotal: 0,
    feedsPublished: 0,
    feedsDraft: 0,
    momentsTotal: 0,
    commentsTotal: 0,
    commentsPending: 0,
    storageCount: 0,
    storageBytes: 0,
    loading: true,
  });

  const [r2Stats, setR2Stats] = useState<R2StorageStats | null>(null);

  // 文章全量数据与筛选状态 (对齐图 3 调度超级表单全套交互)
  const [allFeeds, setAllFeeds] = useState<any[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "top" | "locked">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [permissionsMap, setPermissionsMap] = useState<Record<string, { mode: string; tip: string; hasPassword: boolean }>>({});

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");

  // 排序字段与方向 (表头点击切换正反序)
  const [sortField, setSortField] = useState<"createdAt" | "id" | "title" | "pv">("createdAt");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  // 行内标题重命名状态
  const [inlineEditingFeedId, setInlineEditingFeedId] = useState<number | null>(null);
  const [inlineTitleValue, setInlineTitleValue] = useState("");

  // AI 导读重新生成中状态
  const [regeneratingAiFeedId, setRegeneratingAiFeedId] = useState<number | null>(null);
  const [coverTarget, setCoverTarget] = useState<any | null>(null);
  const [newCoverUrl, setNewCoverUrl] = useState<string>("");
  const [isUploadingCover, setIsUploadingCover] = useState<boolean>(false);
  const [isR2PickerOpen, setIsR2PickerOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 就地快速编辑状态 (无需跳回后台，零额外重型分包开销)
  const [editingTarget, setEditingTarget] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 权限锁定管理状态
  const [permissionTarget, setPermissionTarget] = useState<any | null>(null);
  const [currentPermMode, setCurrentPermMode] = useState<"public" | "password" | "token">("public");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentTip, setCurrentTip] = useState("");

  const loadDashboardData = async () => {
    try {
      const token = getAuthToken() || "";
      const [statsRes, feedsRes, r2Res, permsRes] = await Promise.allSettled([
        client.config.getDashboardStats(),
        client.feed.list({ limit: 500, page: 1 }),
        fetchR2StorageStats(),
        fetch("/api/feed/permissions", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        }).then((r) => (r.ok ? r.json() : {})),
      ]);

      let total = 0, pub = 0, drt = 0, mom = 0, comTot = 0, comPend = 0;
      let r2Count = 0, r2Bytes = 0;

      if (statsRes.status === "fulfilled" && statsRes.value.data) {
        const d = statsRes.value.data;
        total = d.feeds?.total || 0;
        pub = d.feeds?.published || 0;
        drt = d.feeds?.draft || 0;
        mom = d.moments || 0;
        comTot = d.comments?.total || 0;
        comPend = d.comments?.pending || 0;
        r2Count = d.storage?.count || 0;
        r2Bytes = d.storage?.totalBytes || 0;
      }

      if (r2Res.status === "fulfilled" && r2Res.value) {
        setR2Stats(r2Res.value);
      }

      if (permsRes.status === "fulfilled" && permsRes.value) {
        setPermissionsMap(permsRes.value);
      }

      let feedsList: any[] = [];
      if (feedsRes.status === "fulfilled" && feedsRes.value.data?.data) {
        feedsList = feedsRes.value.data.data;
      }

      setStats({
        feedsTotal: total,
        feedsPublished: pub,
        feedsDraft: drt,
        momentsTotal: mom,
        commentsTotal: comTot,
        commentsPending: comPend,
        storageCount: r2Count,
        storageBytes: r2Bytes,
        loading: false,
      });

      setAllFeeds(feedsList);
    } catch {
      setStats((prev) => ({ ...prev, loading: false }));
    } finally {
      setLoadingFeeds(false);
    }
  };

  useEffect(() => {
    void loadDashboardData();
  }, []);

  // 过滤后的文章列表
  const filteredFeeds = useMemo(() => {
    let list = [...allFeeds];

    if (statusFilter === "published") {
      list = list.filter((f) => f.draft === 0);
    } else if (statusFilter === "draft") {
      list = list.filter((f) => f.draft === 1);
    } else if (statusFilter === "top") {
      list = list.filter((f) => f.top > 0);
    } else if (statusFilter === "locked") {
      list = list.filter((f) => Boolean(permissionsMap[f.id]?.mode && permissionsMap[f.id].mode !== "public"));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (f) =>
          String(f.id).includes(q) ||
          (f.title && f.title.toLowerCase().includes(q)) ||
          (f.summary && f.summary.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      // 默认置顶排前
      if ((b.top || 0) !== (a.top || 0)) return (b.top || 0) - (a.top || 0);

      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "createdAt") {
        valA = new Date(a.createdAt || 0).getTime();
        valB = new Date(b.createdAt || 0).getTime();
      }

      if (typeof valA === "string") {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortDirection === "asc" ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });

    return list;
  }, [allFeeds, statusFilter, searchQuery, sortField, sortDirection, permissionsMap]);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(filteredFeeds.length / pageSize));
  const paginatedFeeds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFeeds.slice(start, start + pageSize);
  }, [filteredFeeds, currentPage, pageSize]);

  // 全选 / 取消全选
  const isAllCurrentSelected = paginatedFeeds.length > 0 && paginatedFeeds.every((f) => selectedIds.has(f.id));
  const toggleSelectAll = () => {
    if (isAllCurrentSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedFeeds.forEach((f) => next.delete(f.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedFeeds.forEach((f) => next.add(f.id));
        return next;
      });
    }
  };

  // 置顶 / 取消置顶
  const handleToggleTop = async (feed: any) => {
    const nextTop = feed.top > 0 ? 0 : 1;
    try {
      const { error } = await client.feed.setTop(feed.id, nextTop);
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string) || "置顶状态更新失败");
      } else {
        setAllFeeds((prev) =>
          prev.map((f) => (f.id === feed.id ? { ...f, top: nextTop } : f))
        );
      }
    } catch (e: any) {
      showAlert(e.message || "更新失败");
    }
  };

  // 表头排序切换
  const toggleSort = (field: "createdAt" | "id" | "title" | "pv") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection(field === "createdAt" || field === "pv" ? "desc" : "asc");
    }
  };

  // 原地切换 公开 ↔ 草稿
  const handleToggleDraft = async (feed: any) => {
    const nextDraft = feed.draft === 1 ? 0 : 1;
    try {
      const { error } = await client.feed.update(feed.id, {
        draft: nextDraft === 1,
        listed: feed.listed !== 0,
      });
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string) || "状态切换失败");
      } else {
        setAllFeeds((prev) =>
          prev.map((f) => (f.id === feed.id ? { ...f, draft: nextDraft } : f))
        );
        setStats((prev) => ({
          ...prev,
          feedsPublished: nextDraft === 0 ? prev.feedsPublished + 1 : Math.max(0, prev.feedsPublished - 1),
          feedsDraft: nextDraft === 1 ? prev.feedsDraft + 1 : Math.max(0, prev.feedsDraft - 1),
        }));
        showAlert(`文章 #${feed.id} 状态已变更为：${nextDraft === 1 ? "草稿箱" : "已公开"}`);
      }
    } catch (e: any) {
      showAlert(e.message || "切换失败");
    }
  };

  // 重新触发 AI 智能导读提炼
  const handleRegenerateAISummary = async (feed: any) => {
    setRegeneratingAiFeedId(feed.id);
    try {
      const { data, error } = await client.config.runAIPipeline({
        content: feed.content || feed.summary || "",
        stages: ["summary"],
      });
      if (error || (data && !data.success && data.error)) {
        const rawErr = String(error?.value || data?.error || "");
        if (rawErr.includes("User location is not supported") || rawErr.includes("FAILED_PRECONDITION") || rawErr.includes("Google Gemini 地区限制")) {
          showAlert("⚠️ Google Gemini 地区限制：当前服务端 IP（如中国香港/大陆或部分边缘节点）不受 Google 官方直接支持。\n\n解决办法：请前往「后台设置 -> 扩展服务 -> AI设置」：\n1. 将 Provider 切换为原生免翻墙的 Cloudflare Workers AI（如 llama-3.1-8b / deepseek-coder）或 DeepSeek；\n2. 或为 Gemini 配置可用的反向代理/中转 API URL。");
        } else {
          showAlert(rawErr || "AI导读生成失败");
        }
      } else if (data && data.summary) {
        await client.feed.update(feed.id, {
          summary: data.summary,
          listed: feed.listed !== 0,
        });
        setAllFeeds((prev) =>
          prev.map((f) => (f.id === feed.id ? { ...f, ai_summary: data.summary, summary: data.summary, ai_summary_status: "done" } : f))
        );
        showAlert(`文章 #${feed.id} AI 智能导读重新生成成功！`);
      }
    } catch (e: any) {
      showAlert(e.message || "生成异常");
    } finally {
      setRegeneratingAiFeedId(null);
    }
  };

  // 行内标题重命名保存
  const handleSaveInlineTitle = async (id: number) => {
    if (!inlineTitleValue.trim()) {
      setInlineEditingFeedId(null);
      return;
    }
    const targetFeed = allFeeds.find((f) => f.id === id);
    try {
      const { error } = await client.feed.update(id, {
        title: inlineTitleValue.trim(),
        listed: targetFeed?.listed !== 0,
      });
      if (error) {
        showAlert(String(error.value || "重命名失败"));
      } else {
        setAllFeeds((prev) =>
          prev.map((f) => (f.id === id ? { ...f, title: inlineTitleValue.trim() } : f))
        );
        setInlineEditingFeedId(null);
        showAlert("文章标题已成功更新！");
      }
    } catch (e: any) {
      showAlert(e.message || "重命名异常");
    }
  };
  const handleDeleteFeed = (feed: any) => {
    showConfirm(
      "删除文章确认",
      `确定要永久删除文章 #${feed.id}「${feed.title || "无标题"}」吗？此操作不可逆！`,
      async () => {
        try {
          const { error } = await client.feed.delete(feed.id);
          if (error) {
            showAlert(typeof error === "string" ? error : (error.value as string) || "删除失败");
          } else {
            setAllFeeds((prev) => prev.filter((f) => f.id !== feed.id));
            showAlert("文章已永久删除！");
          }
        } catch (e: any) {
          showAlert(e.message || "删除失败");
        }
      }
    );
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    showConfirm(
      "批量删除确认",
      `确定要批量删除已选中的 ${selectedIds.size} 篇文章吗？`,
      async () => {
        let count = 0;
        for (const id of Array.from(selectedIds)) {
          const { error } = await client.feed.delete(id);
          if (!error) count++;
        }
        showAlert(`批量删除完成，已移除 ${count} 篇文章！`);
        setSelectedIds(new Set());
        void loadDashboardData();
      }
    );
  };

  // 快捷更换封面
  const handleSaveCover = async () => {
    if (!coverTarget || !newCoverUrl.trim()) return;
    try {
      const { error } = await client.feed.setCover(coverTarget.id, newCoverUrl.trim());
      if (error) {
        showAlert(typeof error === "string" ? error : (error?.value as string) || "更换封面失败");
      } else {
        showAlert(`文章 #${coverTarget.id} 封面已成功置换！`);
        setAllFeeds((prev) =>
          prev.map((f) =>
            f.id === coverTarget.id
              ? { ...f, coverImage: newCoverUrl.trim(), avatar: newCoverUrl.trim() }
              : f
          )
        );
        setCoverTarget(null);
        setNewCoverUrl("");
      }
    } catch (e: any) {
      showAlert(e.message || "更换异常");
    }
  };

  // 本地图片上传
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const { data, error } = await client.storage.upload(file);
      if (data && data.url) {
        setNewCoverUrl(data.url);
      } else {
        showAlert(typeof error === "string" ? error : (error?.value as string) || "上传失败");
      }
    } catch (err: any) {
      showAlert(err.message || "上传异常");
    } finally {
      setIsUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 就地快速编辑打开
  const openQuickEdit = (feed: any) => {
    setEditingTarget(feed);
    setEditTitle(feed.title || "");
    setEditContent(feed.content || "");
  };

  // 保存就地编辑
  const handleSaveQuickEdit = async () => {
    if (!editingTarget) return;
    setIsSavingEdit(true);
    try {
      const { error } = await client.feed.update(editingTarget.id, {
        title: editTitle,
        content: editContent,
        listed: true,
      });
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string));
      } else {
        setAllFeeds((prev) =>
          prev.map((f) =>
            f.id === editingTarget.id
              ? { ...f, title: editTitle, content: editContent }
              : f
          )
        );
        setEditingTarget(null);
        showAlert("文章就地修改成功！");
      }
    } catch (e: any) {
      showAlert(e.message || "更新失败");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 打开权限配置并从服务端拉取真实锁定状态
  const openPermissionForFeed = async (feed: any) => {
    setPermissionTarget(feed);
    setCurrentPermMode("public");
    setCurrentPassword("");
    setCurrentTip("");
    try {
      const token = getAuthToken() || "";
      const res = await fetch(`/api/feed/permission/${feed.id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentPermMode(data.mode || "public");
        setCurrentPassword(data.password || "");
        setCurrentTip(data.tip || "");
      }
    } catch {}
  };

  // 保存权限设置至 D1 数据库
  const handleSavePermission = async () => {
    if (!permissionTarget) return;
    try {
      const token = getAuthToken() || "";
      const res = await fetch(`/api/feed/permission/${permissionTarget.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          mode: currentPermMode,
          password: currentPassword.trim(),
          tip: currentTip.trim(),
        }),
      });
      if (res.ok) {
        setPermissionsMap((prev) => {
          const next = { ...prev };
          if (currentPermMode === "public" || !currentPermMode) {
            delete next[permissionTarget.id];
          } else {
            next[permissionTarget.id] = {
              mode: currentPermMode,
              tip: currentTip.trim(),
              hasPassword: Boolean(currentPassword.trim()),
            };
          }
          return next;
        });
        showAlert(`文章 #${permissionTarget.id} 权限配置已保存并即时生效！`);
        setPermissionTarget(null);
      } else {
        showAlert("保存权限策略失败，请检查登录凭证");
      }
    } catch (e: any) {
      showAlert(e.message || "权限设置异常");
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`概览 · 全站运行与管理中枢 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />
      <ConfirmUI />

      {/* 隐藏的封面本地上传 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverUpload}
        className="hidden"
      />

      {/* ====================================================================
          第 1 层：全站核心资产总览 (音廊与媒体分开，透出剩余容量，无无效留白)
          ==================================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-theme/10 text-theme text-2xl shadow-2xs">
            <i className="ri-dashboard-3-line" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold t-primary">画廊概览中枢</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              全站文章、随笔、留言与云端资产实时统计
            </p>
          </div>
        </div>

        {/* 核心真实资产指标胶囊 (音廊与媒体完全独立分开，透出 10GB 剩余配额) */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">公开:</span>
            <span className="font-bold text-theme">{stats.loading ? "..." : stats.feedsPublished}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">草稿:</span>
            <span className={`font-bold ${stats.feedsDraft > 0 ? "text-amber-500 font-extrabold" : "text-neutral-400"}`}>
              {stats.loading ? "..." : stats.feedsDraft}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">动态:</span>
            <span className="font-bold text-sky-500">{stats.loading ? "..." : stats.momentsTotal}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">留言:</span>
            <span className="font-bold text-pink-500">{stats.loading ? "..." : stats.commentsTotal}</span>
            {stats.commentsPending > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-white font-bold animate-pulse">
                {stats.commentsPending} 待审
              </span>
            )}
          </div>

          {/* 媒体资产单独呈现 */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">媒体:</span>
            <span className="font-bold text-amber-500">
              {r2Stats ? `${r2Stats.imageCount} 张 (${formatFileSize(r2Stats.imageBytes)})` : `${stats.storageCount} 张`}
            </span>
          </div>

          {/* 音廊资产单独呈现 */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">音廊:</span>
            <span className="font-bold text-purple-500">
              {r2Stats ? `${r2Stats.musicCount} 首 (${formatFileSize(r2Stats.musicBytes)})` : "0 首"}
            </span>
          </div>

          {/* R2 剩余免费额度 */}
          {r2Stats && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
              <span>剩余容量:</span>
              <span>{(r2Stats.remainingBytes / (1024 * 1024 * 1024)).toFixed(2)} GB / 10 GB</span>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          第 2 层：文章内容巡检超级表格 (全功能对齐调度超级表单，字体清晰舒适)
          ==================================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        {/* 工具栏：状态筛选、搜索框、写文章 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === "all" ? "bg-theme text-white shadow-2xs" : "bg-black/5 dark:bg-white/5 text-neutral-500"
              }`}
            >
              全部 ({allFeeds.length})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter("published"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === "published" ? "bg-theme text-white shadow-2xs" : "bg-black/5 dark:bg-white/5 text-neutral-500"
              }`}
            >
              已公开 ({stats.feedsPublished})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter("draft"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === "draft" ? "bg-theme text-white shadow-2xs" : "bg-black/5 dark:bg-white/5 text-neutral-500"
              }`}
            >
              草稿箱 ({stats.feedsDraft})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter("top"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === "top" ? "bg-theme text-white shadow-2xs" : "bg-black/5 dark:bg-white/5 text-neutral-500"
              }`}
            >
              📌 已置顶
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter("locked"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                statusFilter === "locked" ? "bg-theme text-white shadow-2xs" : "bg-black/5 dark:bg-white/5 text-neutral-500"
              }`}
            >
              <i className="ri-lock-line" />
              <span>已加锁 ({Object.keys(permissionsMap).length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 顶栏紧凑分页微控制器 */}
            <div className="flex items-center gap-1 font-mono text-xs select-none">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-neutral-500 hover:text-theme disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 transition"
                title="上一页"
              >
                <i className="ri-arrow-left-s-line" />
              </button>
              <span className="px-1.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.03] text-neutral-700 dark:text-neutral-300 font-bold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 w-7 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-neutral-500 hover:text-theme disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 transition"
                title="下一页"
              >
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>

            <div className="relative flex-1 sm:w-64">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="搜索文章标题或ID..."
                className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] pl-8 pr-7 py-1.5 text-xs t-primary outline-none focus:border-theme"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              )}
            </div>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold shadow-2xs hover:bg-rose-600 transition flex items-center gap-1"
              >
                <i className="ri-delete-bin-line" />
                <span>批量删除 ({selectedIds.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadDashboardData}
              className="p-2 rounded-xl border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme transition"
              title="刷新数据"
            >
              <i className="ri-refresh-line text-sm" />
            </button>

            <Link
              href="/admin/writing"
              className="px-3.5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 transition flex items-center gap-1"
            >
              <i className="ri-add-line" />
              <span>撰写新文章</span>
            </Link>
          </div>
        </div>

        {/* 超级数据表格 (字体升级为 13px/14px，加入 44x44 封面预览与快捷更换、置顶、权限联动) */}
        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-w">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentSelected}
                    onChange={toggleSelectAll}
                    className="accent-theme cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => toggleSort("id")}
                  className="py-3 px-2 w-16 text-center cursor-pointer hover:text-theme transition"
                  title="点击切换 ID 升降序"
                >
                  <span className="inline-flex items-center gap-0.5">
                    ID
                    {sortField === "id" ? (
                      <i className={sortDirection === "asc" ? "ri-arrow-up-s-fill text-theme" : "ri-arrow-down-s-fill text-theme"} />
                    ) : (
                      <i className="ri-arrow-up-down-line opacity-30 text-[10px]" />
                    )}
                  </span>
                </th>
                <th
                  onClick={() => toggleSort("title")}
                  className="py-3 px-3 cursor-pointer hover:text-theme transition"
                  title="点击按标题字母排序"
                >
                  <span className="inline-flex items-center gap-0.5">
                    文章标题与摘要
                    {sortField === "title" ? (
                      <i className={sortDirection === "asc" ? "ri-arrow-up-s-fill text-theme" : "ri-arrow-down-s-fill text-theme"} />
                    ) : (
                      <i className="ri-arrow-up-down-line opacity-30 text-[10px]" />
                    )}
                  </span>
                </th>
                <th className="py-3 px-3 w-24 text-center">状态</th>
                <th className="py-3 px-3 w-28 text-center">访问权限</th>
                <th className="py-3 px-3 w-28 text-center">AI导读</th>
                <th
                  onClick={() => toggleSort("createdAt")}
                  className="py-3 px-3 w-32 cursor-pointer hover:text-theme transition"
                  title="点击切换时间最新/最旧排序"
                >
                  <span className="inline-flex items-center gap-0.5">
                    更新时间
                    {sortField === "createdAt" ? (
                      <i className={sortDirection === "asc" ? "ri-arrow-up-s-fill text-theme" : "ri-arrow-down-s-fill text-theme"} />
                    ) : (
                      <i className="ri-arrow-up-down-line opacity-30 text-[10px]" />
                    )}
                  </span>
                </th>
                <th className="py-3 px-3 text-right pr-4 w-52">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {loadingFeeds ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-neutral-400">
                    <i className="ri-loader-4-line animate-spin text-xl block mb-1 text-theme" />
                    <span>正在读取文章数据...</span>
                  </td>
                </tr>
              ) : paginatedFeeds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-neutral-400">
                    未检索到任何符合条件的文章
                  </td>
                </tr>
              ) : (
                paginatedFeeds.map((feed) => {
                  const isDraft = feed.draft === 1;
                  const isTop = feed.top > 0;
                  const isSelected = selectedIds.has(feed.id);
                  const cover = normalizeBlobUrl(feed.avatar || feed.coverImage) || "";

                  return (
                    <tr
                      key={feed.id}
                      className={`transition ${
                        isSelected ? "bg-theme/[0.04]" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                      }`}
                    >
                      {/* 复选框 */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(feed.id)) next.delete(feed.id);
                              else next.add(feed.id);
                              return next;
                            });
                          }}
                          className="accent-theme cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-neutral-400 text-xs">
                        #{feed.id}
                      </td>

                      {/* 封面 44x44 预览 + 文章标题与摘要 (对齐图 3) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-3 min-w-0 max-w-xl">
                          {/* 44x44 圆角封面与快捷更换 */}
                          <div
                            onClick={() => {
                              setCoverTarget(feed);
                              setNewCoverUrl(cover);
                            }}
                            className="relative h-11 w-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 overflow-hidden shrink-0 border border-black/10 dark:border-white/10 group cursor-pointer"
                            title="快捷更换此文章封面"
                          >
                            {cover ? (
                              <img
                                src={cover}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-neutral-400">
                                <i className="ri-image-line text-lg" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">
                              <i className="ri-image-edit-line" />
                            </div>
                          </div>

                          <div className="truncate flex-1 min-w-0">
                            {inlineEditingFeedId === feed.id ? (
                              <div className="flex items-center gap-1.5 my-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={inlineTitleValue}
                                  onChange={(e) => setInlineTitleValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveInlineTitle(feed.id);
                                    if (e.key === "Escape") setInlineEditingFeedId(null);
                                  }}
                                  autoFocus
                                  className="flex-1 rounded-lg border border-theme bg-w px-2 py-1 text-xs font-bold outline-none shadow-xs dark:bg-neutral-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineTitle(feed.id)}
                                  className="p-1 rounded-md bg-theme text-white text-xs hover:bg-theme-hover shrink-0"
                                  title="保存标题"
                                >
                                  <i className="ri-check-line" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineEditingFeedId(null)}
                                  className="p-1 rounded-md bg-black/5 dark:bg-white/5 text-neutral-400 hover:text-neutral-600 text-xs shrink-0"
                                  title="取消"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 truncate group/title">
                                {isTop && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/30 shrink-0 select-none">
                                    📌 置顶
                                  </span>
                                )}
                                <Link
                                  href={`/feed/${feed.id}`}
                                  className="font-bold t-primary hover:text-theme transition truncate text-xs sm:text-sm"
                                  title={feed.title}
                                >
                                  {feed.title || "无标题文章"}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInlineEditingFeedId(feed.id);
                                    setInlineTitleValue(feed.title || "");
                                  }}
                                  className="opacity-0 group-hover/title:opacity-100 text-neutral-400 hover:text-theme transition p-0.5"
                                  title="点击快速重命名标题"
                                >
                                  <i className="ri-edit-line text-xs" />
                                </button>
                              </div>
                            )}
                            <p className="text-xs text-neutral-400 truncate mt-0.5">
                              {feed.summary || "暂无摘要描述"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 状态徽章 (点击原地一键切换 公开 ↔ 草稿) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleDraft(feed)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-xs transition cursor-pointer select-none hover:scale-105 active:scale-95 ${
                            isDraft
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                          }`}
                          title={isDraft ? "当前为草稿，点击立即转为公开" : "当前已公开，点击立即下架为草稿"}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isDraft ? "bg-amber-500" : "bg-emerald-500"}`} />
                          <span>{isDraft ? "草稿" : "已公开"}</span>
                        </button>
                      </td>

                      {/* 访问权限微光状态胶囊 (可直接点击呼出抽屉快速配置) */}
                      <td className="py-2.5 px-3 text-center">
                        {(() => {
                          const perm = permissionsMap[feed.id];
                          if (perm?.mode === "password") {
                            return (
                              <button
                                type="button"
                                onClick={() => openPermissionForFeed(feed)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-theme/10 text-theme font-bold text-xs border border-theme/20 hover:bg-theme/20 hover:scale-105 active:scale-95 transition cursor-pointer select-none"
                                title={`独立密码锁 · 提示: ${perm.tip || "无"}`}
                              >
                                <i className="ri-lock-line text-[11px]" />
                                <span>密码锁</span>
                              </button>
                            );
                          }
                          if (perm?.mode === "token") {
                            return (
                              <button
                                type="button"
                                onClick={() => openPermissionForFeed(feed)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs border border-purple-500/20 hover:bg-purple-500/20 hover:scale-105 active:scale-95 transition cursor-pointer select-none"
                                title={`口令通行证 · 提示: ${perm.tip || "无"}`}
                              >
                                <i className="ri-key-2-line text-[11px]" />
                                <span>口令证</span>
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => openPermissionForFeed(feed)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5 font-medium text-xs transition cursor-pointer select-none"
                              title="点击为此文章配置密码锁或口令"
                            >
                              <i className="ri-global-line text-[11px]" />
                              <span>公开</span>
                            </button>
                          );
                        })()}
                      </td>

                      {/* AI 导读 (点击由 AI 智能重新生成摘要) */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        <button
                          type="button"
                          onClick={() => handleRegenerateAISummary(feed)}
                          disabled={regeneratingAiFeedId === feed.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition cursor-pointer select-none hover:scale-105 active:scale-95 ${
                            feed.ai_summary || feed.ai_summary_status === "done"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
                              : "bg-black/5 dark:bg-white/5 text-neutral-400 hover:text-theme"
                          }`}
                          title="点击由 AI 智能重新提炼核心导读摘要"
                        >
                          {regeneratingAiFeedId === feed.id ? (
                            <i className="ri-loader-4-line animate-spin text-[10px]" />
                          ) : (
                            <i className="ri-sparkling-fill text-[10px]" />
                          )}
                          <span>
                            {regeneratingAiFeedId === feed.id
                              ? "生成中..."
                              : feed.ai_summary || feed.ai_summary_status === "done"
                              ? "已就绪"
                              : "生成导读"}
                          </span>
                        </button>
                      </td>

                      {/* 更新时间 */}
                      <td className="py-2.5 px-3 text-neutral-400 font-mono text-xs">
                        {new Date(feed.updatedAt || feed.createdAt).toLocaleDateString()}
                      </td>

                      {/* 操作列 (对齐图 3：置顶、编辑弹窗、权限、删除) */}
                      <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 text-xs">
                          {/* 置顶/取消置顶按钮 */}
                          <button
                            type="button"
                            onClick={() => handleToggleTop(feed)}
                            className={`px-2 py-1 rounded-lg font-semibold transition ${
                              isTop
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                                : "text-neutral-500 hover:text-theme hover:bg-black/5"
                            }`}
                            title={isTop ? "取消置顶" : "置顶到首页首位"}
                          >
                            <span>{isTop ? "取消置顶" : "置顶"}</span>
                          </button>

                          {/* 就地快速编辑弹窗 (Modal) */}
                          <button
                            type="button"
                            onClick={() => openQuickEdit(feed)}
                            className="px-2 py-1 rounded-lg text-theme hover:bg-theme/10 font-semibold transition"
                            title="就地编辑此文章"
                          >
                            <span>编辑</span>
                          </button>

                          {/* 权限锁定管理 */}
                          <button
                            type="button"
                            onClick={() => openPermissionForFeed(feed)}
                            className="px-2 py-1 rounded-lg text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 font-semibold transition cursor-pointer"
                            title="权限与密码锁设置"
                          >
                            <span>权限</span>
                          </button>

                          {/* 删除 */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFeed(feed)}
                            className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 transition"
                            title="删除"
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

        {/* 标准工业级分页控制器 (对齐图 3) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5 text-xs text-neutral-500">
          <div className="flex items-center gap-3">
            <span>共 {filteredFeeds.length} 篇文章</span>
            <div className="flex items-center gap-1">
              <span>每页</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-black/10 bg-w px-2 py-1 text-xs outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
              >
                <option value={10}>10 条</option>
                <option value={20}>20 条</option>
                <option value={50}>50 条</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 disabled:opacity-30 transition"
            >
              上一页
            </button>

            <span className="px-2 font-mono font-bold text-neutral-700 dark:text-neutral-300">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 disabled:opacity-30 transition"
            >
              下一页
            </button>

            {/* 跳转页面 */}
            <div className="flex items-center gap-1 ml-2">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const p = parseInt(jumpPageInput.trim(), 10);
                    if (!isNaN(p) && p >= 1 && p <= totalPages) setCurrentPage(p);
                    setJumpPageInput("");
                  }
                }}
                placeholder="跳转"
                className="w-12 text-center rounded-lg border border-black/10 bg-w px-1.5 py-1 text-xs outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => {
                  const p = parseInt(jumpPageInput.trim(), 10);
                  if (!isNaN(p) && p >= 1 && p <= totalPages) setCurrentPage(p);
                  setJumpPageInput("");
                }}
                className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white transition font-semibold"
              >
                前往
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 快捷更换文章封面弹窗 (对齐前台就地置换统一规范) */}
      {coverTarget && (
        <Modal
          isOpen={Boolean(coverTarget)}
          onRequestClose={() => !isUploadingCover && setCoverTarget(null)}
          contentLabel="快捷更换文章封面"
          panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-md w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
        >
          <div className="flex flex-col gap-4 text-xs font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div>
                <h3 className="text-sm font-bold t-primary">快捷更换文章封面</h3>
                <p className="text-[11px] text-neutral-400 truncate max-w-xs mt-0.5">
                  #{coverTarget.id} {coverTarget.title || "无标题文章"}
                </p>
              </div>
              <button
                onClick={() => setCoverTarget(null)}
                disabled={isUploadingCover}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            {/* 封面实时预览区 */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02]">
              {newCoverUrl.trim() ? (
                <div className="relative h-36 w-full rounded-lg overflow-hidden group/img">
                  <img
                    src={normalizeBlobUrl(newCoverUrl.trim()) || newCoverUrl.trim()}
                    alt="cover preview"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover rounded-lg shadow-inner"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                    <span className="text-white text-xs font-bold">封面实时预览</span>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-neutral-400">
                  <i className="ri-image-line text-3xl mb-1 opacity-40" />
                  <span>暂无封面，请输入网络链接或选择媒体图片</span>
                </div>
              )}
            </div>

            {/* 图片链接输入 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                图片网络 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCoverUrl}
                  onChange={(e) => setNewCoverUrl(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="flex-1 rounded-xl border border-black/10 bg-transparent px-3 py-1.5 text-xs outline-none focus:border-theme dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setIsR2PickerOpen(true)}
                  disabled={isUploadingCover}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold shrink-0 transition"
                  title="从图库相册中挑选已有图片"
                >
                  <i className="ri-folder-image-line" />
                  <span>图库相册</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 text-xs font-semibold shrink-0 transition"
                >
                  {isUploadingCover ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      <span>上传中...</span>
                    </>
                  ) : (
                    <>
                      <i className="ri-upload-cloud-line" />
                      <span>本地图床</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setCoverTarget(null)}
                disabled={isUploadingCover}
                className="px-3.5 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCover}
                disabled={isUploadingCover || !newCoverUrl.trim()}
                className="px-5 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
              >
                更新封面
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 就地快速编辑文章弹窗 (Modal) */}
      {editingTarget && (
        <Modal
          isOpen={Boolean(editingTarget)}
          onRequestClose={() => !isSavingEdit && setEditingTarget(null)}
          contentLabel="就地快速编辑文章"
          panelClassName="p-5 sm:p-6 max-w-3xl w-full bg-w dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl"
        >
          <div className="flex flex-col gap-3.5 max-h-[85vh]">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shadow-2xs">
                  <i className="ri-quill-pen-line" />
                </span>
                <div>
                  <h3 className="text-sm font-bold t-primary">就地编辑文章 · #{editingTarget.id}</h3>
                  <p className="text-xs text-neutral-400">原地即时修改标题与正文，保存后秒级生效，无需跳转后台</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                disabled={isSavingEdit}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500">文章标题</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs sm:text-sm font-bold t-primary outline-none focus:border-theme"
                placeholder="输入文章标题..."
              />
            </div>

            <div className="space-y-1 flex-1 flex flex-col min-h-0">
              <label className="text-xs font-bold text-neutral-500">Markdown 正文内容</label>
              <textarea
                rows={12}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full flex-1 rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] p-3 text-xs font-mono t-primary outline-none focus:border-theme resize-none scrollbar-thin"
                placeholder="在此输入或粘贴 Markdown 正文..."
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-xs">
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/writing/${editingTarget.id}`}
                  className="text-neutral-400 hover:text-theme transition"
                >
                  前往完整写作工坊 ➔
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const target = editingTarget;
                    setEditingTarget(null);
                    openPermissionForFeed(target);
                  }}
                  className="text-indigo-500 hover:underline flex items-center gap-1"
                >
                  <i className="ri-lock-line text-xs" />
                  <span>管理访问口令</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickEdit}
                  disabled={isSavingEdit || !editTitle.trim()}
                  className="px-5 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1"
                >
                  {isSavingEdit && <i className="ri-loader-4-line animate-spin" />}
                  <span>{isSavingEdit ? "保存中..." : "保存并即时生效"}</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 权限与密码锁配置抽屉 (Slide-over Drawer) */}
      {permissionTarget && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity ani-show"
            onClick={() => setPermissionTarget(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-w dark:bg-[#12161f] border-l border-black/10 dark:border-white/10 shadow-2xl p-6 flex flex-col justify-between select-none">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-theme/10 text-theme text-lg">
                    <i className="ri-shield-keyhole-line" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold t-primary">文章访问控制 · #{permissionTarget.id}</h3>
                    <p className="text-xs text-neutral-400 truncate max-w-[240px]">{permissionTarget.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPermissionTarget(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  <i className="ri-close-line text-lg" />
                </button>
              </div>

              {/* 三态模式卡片 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500">访问控制模式</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: "public", label: "公开访问", icon: "ri-global-line", desc: "所有人可读" },
                    { id: "password", label: "独立密码锁", icon: "ri-lock-line", desc: "专属密码解锁" },
                    { id: "token", label: "口令通行证", icon: "ri-key-2-line", desc: "特约口令查阅" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCurrentPermMode(m.id as any)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        currentPermMode === m.id
                          ? "border-theme bg-theme/10 ring-2 ring-theme/30 text-theme shadow-xs"
                          : "border-black/10 dark:border-white/10 hover:border-black/20 text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      <i className={`${m.icon} text-base mb-2`} />
                      <span className="font-bold text-xs">{m.label}</span>
                      <span className="text-[10px] text-neutral-400 mt-0.5">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {currentPermMode !== "public" && (
                <div className="space-y-3.5 pt-2 ani-show">
                  <div className="space-y-1 text-xs">
                    <label className="text-xs font-bold text-neutral-500">
                      {currentPermMode === "password" ? "访问查看密码" : "通行证口令"}
                    </label>
                    <input
                      type="text"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={currentPermMode === "password" ? "设置独立解锁密码..." : "设置特约口令..."}
                      className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3.5 py-2.5 text-xs outline-none focus:border-theme font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="text-xs font-bold text-neutral-500">读者端解锁提示词 (选填)</label>
                    <input
                      type="text"
                      value={currentTip}
                      onChange={(e) => setCurrentTip(e.target.value)}
                      placeholder="如：密码为博主生日，或加微信获取..."
                      className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3.5 py-2.5 text-xs outline-none focus:border-theme"
                    />
                  </div>

                  <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-[11px] text-neutral-500 leading-relaxed">
                    💡 <strong>真实物理脱敏保护</strong>：当设置为密码锁或口令时，Cloudflare Worker 在边缘端将对未授权访客<strong>物理置空正文（0 字节传输）</strong>，无论通过 DevTools 还是网络抓包均无法获取原文。
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPermissionTarget(null)}
                className="px-4 py-2 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSavePermission}
                className="px-5 py-2 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover active:scale-95 transition"
              >
                保存权限并即时生效
              </button>
            </div>
          </div>
        </>
      )}

      {/* R2 媒体库相册挑选器 */}
      {isR2PickerOpen && (
        <R2MediaPickerModal
          isOpen={isR2PickerOpen}
          onClose={() => setIsR2PickerOpen(false)}
          onSelect={(url) => {
            setNewCoverUrl(url);
            setIsR2PickerOpen(false);
          }}
          title="从媒体相册挑选文章封面"
        />
      )}
    </div>
  );
}
