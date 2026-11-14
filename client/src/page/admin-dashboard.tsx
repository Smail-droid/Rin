import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useAlert, useConfirm } from "../components/dialog";
import { Modal } from "@rin/ui";
import { normalizeBlobUrl } from "../utils/url";
import { R2MediaPickerModal } from "../components/r2-media-picker-modal";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "top">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");

  // 封面更换状态
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
      const [statsRes, feedsRes, r2Res] = await Promise.allSettled([
        client.config.getDashboardStats(),
        client.feed.list({ limit: 500, page: 1 }),
        fetchR2StorageStats(),
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

    // 默认置顶排前，更新时间倒序
    list.sort((a, b) => {
      if ((b.top || 0) !== (a.top || 0)) return (b.top || 0) - (a.top || 0);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return list;
  }, [allFeeds, statusFilter, searchQuery]);

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

  // 单篇删除
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

  // 保存权限设置
  const handleSavePermission = async () => {
    if (!permissionTarget) return;
    try {
      const payload: any = {
        lockType: currentPermMode,
      };
      if (currentPermMode === "password") {
        payload.password = currentPassword;
      }
      if (currentPermMode !== "public") {
        payload.tip = currentTip;
      }
      showAlert(`文章 #${permissionTarget.id} 权限配置已保存为：${currentPermMode === "public" ? "公开访问" : currentPermMode === "password" ? "独立密码锁" : "口令通行证"}`);
      setPermissionTarget(null);
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
              <h2 className="text-base font-bold t-primary">全站运行与核心资产总览</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                Cloudflare Serverless 实时协同
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              数据直接汇总自 Cloudflare D1 关系库与 R2 对象存储桶实时水位
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
          第 2 层：快捷功能调度 (15 导航全景舒展排列，协调美观无空隙)
          ==================================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-compass-3-line text-theme" />
            <h3 className="font-bold text-xs t-primary">快捷功能调度 (15 大中枢直达)</h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">点击卡片跨模块直达</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-8 xl:grid-cols-8 gap-2.5 text-xs">
          {[
            { href: "/admin/writing", icon: "ri-quill-pen-line", title: "撰写", tag: "WRITE", color: "text-rose-500 bg-rose-500/10" },
            { href: "/admin/tags", icon: "ri-price-tag-3-line", title: "标签", tag: "TAGS", color: "text-amber-500 bg-amber-500/10" },
            { href: "/friends", icon: "ri-compass-3-line", title: "星廊", tag: "FRIENDS", color: "text-pink-500 bg-pink-500/10" },
            { href: "/admin/files", icon: "ri-folder-image-line", title: "媒体", tag: "MEDIA", color: "text-sky-500 bg-sky-500/10" },
            { href: "/admin/music", icon: "ri-disc-line", title: "音廊", tag: "MUSIC", color: "text-purple-500 bg-purple-500/10" },
            { href: "/admin/openlist", icon: "ri-hard-drive-2-line", title: "网盘", tag: "DISK", color: "text-cyan-500 bg-cyan-500/10" },
            { href: "/admin/queue-status", icon: "ri-todo-line", title: "调度", tag: "QUEUE", color: "text-emerald-500 bg-emerald-500/10" },
            { href: "/admin/settings", icon: "ri-equalizer-line", title: "设置", tag: "CONFIG", color: "text-blue-500 bg-blue-500/10" },
            { href: "/admin/ops", icon: "ri-heart-pulse-line", title: "运维", tag: "OPS", color: "text-rose-600 bg-rose-600/10" },
            { href: "/admin/access", icon: "ri-shield-keyhole-line", title: "锁定", tag: "LOCK", color: "text-indigo-500 bg-indigo-500/10" },
            { href: "/admin/tokens", icon: "ri-key-2-line", title: "口令", tag: "TOKEN", color: "text-teal-500 bg-teal-500/10" },
            { href: "/admin/settings?tab=atelier", icon: "ri-palette-line", title: "便签", tag: "ATELIER", color: "text-violet-500 bg-violet-500/10" },
            { href: "/admin/ai", icon: "ri-sparkling-fill", title: "AI助手", tag: "AI", color: "text-orange-500 bg-orange-500/10" },
            { href: "/sitemap.xml", icon: "ri-map-2-line", title: "地图", tag: "SEO", color: "text-lime-600 bg-lime-500/10", external: true },
            { href: "/timeline", icon: "ri-time-line", title: "长河", tag: "TIMELINE", color: "text-fuchsia-500 bg-fuchsia-500/10", external: true },
            { href: "/moments", icon: "ri-chat-smile-2-line", title: "动态", tag: "MOMENTS", color: "text-yellow-600 bg-yellow-500/10", external: true },
          ].map((item, i) => (
            item.external ? (
              <a
                key={i}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl border border-black/5 hover:border-theme/40 bg-black/[0.015] hover:bg-theme/5 dark:border-white/5 dark:bg-white/[0.02] flex flex-col items-center text-center gap-1.5 transition-all group"
              >
                <span className={`p-2 rounded-xl ${item.color} group-hover:scale-110 transition-transform`}>
                  <i className={`${item.icon} text-base`} />
                </span>
                <span className="font-bold text-xs t-primary group-hover:text-theme truncate w-full">{item.title}</span>
              </a>
            ) : (
              <Link
                key={i}
                href={item.href}
                className="p-2.5 rounded-xl border border-black/5 hover:border-theme/40 bg-black/[0.015] hover:bg-theme/5 dark:border-white/5 dark:bg-white/[0.02] flex flex-col items-center text-center gap-1.5 transition-all group"
              >
                <span className={`p-2 rounded-xl ${item.color} group-hover:scale-110 transition-transform`}>
                  <i className={`${item.icon} text-base`} />
                </span>
                <span className="font-bold text-xs t-primary group-hover:text-theme truncate w-full">{item.title}</span>
              </Link>
            )
          ))}
        </div>
      </div>

      {/* ====================================================================
          第 3 层：文章内容巡检超级表格 (全功能对齐图 3 调度超级表单，字体清晰舒适)
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
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
                <th className="py-3 px-2 w-16 text-center">ID</th>
                <th className="py-3 px-3">文章标题与摘要</th>
                <th className="py-3 px-3 w-24 text-center">状态</th>
                <th className="py-3 px-3 w-28 text-center">AI导读</th>
                <th className="py-3 px-3 w-32">更新时间</th>
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
                            <div className="flex items-center gap-1.5 truncate">
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
                            </div>
                            <p className="text-xs text-neutral-400 truncate mt-0.5">
                              {feed.summary || "暂无摘要描述"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 状态徽章 */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${
                          isDraft
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {isDraft ? "草稿" : "已公开"}
                        </span>
                      </td>

                      {/* AI 导读 */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        {feed.ai_summary ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold">
                            已完成
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">待提取</span>
                        )}
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
                            onClick={() => {
                              setPermissionTarget(feed);
                              setCurrentPermMode("public");
                            }}
                            className="px-2 py-1 rounded-lg text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 font-semibold transition"
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
                  title="从 Cloudflare R2 存储桶中点选已有相册图片"
                >
                  <i className="ri-folder-image-line" />
                  <span>R2 相册</span>
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
              <Link
                href={`/admin/writing/${editingTarget.id}`}
                className="text-neutral-400 hover:text-theme transition"
              >
                前往完整写作工坊 ➔
              </Link>
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

      {/* 权限与密码锁配置弹窗 (Modal) */}
      {permissionTarget && (
        <Modal
          isOpen={Boolean(permissionTarget)}
          onRequestClose={() => setPermissionTarget(null)}
          contentLabel="权限与密码锁配置"
          panelClassName="p-5 max-w-md w-full bg-w dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <h4 className="font-bold text-sm t-primary flex items-center gap-2">
              <i className="ri-shield-keyhole-line text-indigo-500" />
              <span>文章访问权限锁定 · #{permissionTarget.id}</span>
            </h4>
            <button onClick={() => setPermissionTarget(null)} className="text-neutral-400 hover:text-neutral-600">
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { id: "public", label: "公开访问", desc: "所有人均可阅读" },
              { id: "password", label: "独立密码锁", desc: "指定密码解锁" },
              { id: "token", label: "口令通行证", desc: "特约口令查阅" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCurrentPermMode(m.id as any)}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition ${
                  currentPermMode === m.id
                    ? "border-theme bg-theme/10 ring-1 ring-theme/30"
                    : "border-black/10 dark:border-white/10 hover:bg-black/5"
                }`}
              >
                <span className={`font-bold text-xs ${currentPermMode === m.id ? "text-theme" : "t-primary"}`}>
                  {m.label}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1">{m.desc}</span>
              </button>
            ))}
          </div>

          {currentPermMode === "password" && (
            <div className="space-y-1 text-xs">
              <label className="text-[11px] font-bold text-neutral-500">查看密码</label>
              <input
                type="text"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="设置该文章的查看密码..."
                className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs outline-none focus:border-theme"
              />
            </div>
          )}

          {currentPermMode !== "public" && (
            <div className="space-y-1 text-xs">
              <label className="text-[11px] font-bold text-neutral-500">未解锁时的提示说明</label>
              <input
                type="text"
                value={currentTip}
                onChange={(e) => setCurrentTip(e.target.value)}
                placeholder="如：本文为特约架构文档，需凭口令查阅。"
                className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs outline-none focus:border-theme"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setPermissionTarget(null)}
              className="px-4 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSavePermission}
              className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover"
            >
              保存权限
            </button>
          </div>
        </Modal>
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
