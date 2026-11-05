import { Modal, SettingsBadge, Spinner } from "@rin/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import type { QueueStatusItem, QueueStatusResponse } from "../api/client";
import { client } from "../app/runtime";
import { useAlert, useConfirm } from "../components/dialog";
import { ImageWithFallback } from "../components/image-with-fallback";
import { useApiResource } from "../hooks/use-api-resource";
import { useSiteConfig } from "../hooks/useSiteConfig";

// 探针微波动 SVG 折线组件
function ProbeSparkline({
  tone = "success",
  active = false,
}: {
  tone?: "success" | "warning" | "danger" | "neutral";
  active?: boolean;
}) {
  const strokeColor =
    tone === "success"
      ? "#10b981"
      : tone === "warning"
      ? "#f59e0b"
      : tone === "danger"
      ? "#f43f5e"
      : "#6366f1";

  return (
    <div className="relative w-full h-8 overflow-hidden select-none">
      <svg viewBox="0 0 100 24" className="w-full h-full preserve-3d" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d="M0,18 Q15,4 30,16 T60,8 T85,14 L100,10 L100,24 L0,24 Z"
          fill={`url(#grad-${tone})`}
        />
        <path
          d="M0,18 Q15,4 30,16 T60,8 T85,14 L100,10"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          className={active ? "animate-pulse" : ""}
        />
      </svg>
    </div>
  );
}

export function QueueStatusPage() {
  const siteConfig = useSiteConfig();
  const emptySummary: QueueStatusResponse["summary"] = {
    idle: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  const loadQueueStatus = useCallback(() => client.config.getQueueStatus(), []);
  const { data, loading, reload } = useApiResource<QueueStatusResponse>(loadQueueStatus);
  const queueConfigured = data?.queueConfigured ?? false;
  const generatedAt = data?.generatedAt ?? "";
  const summary = data?.summary ?? emptySummary;
  const items = Array.isArray(data?.items) ? data.items : [];

  const [actingId, setActingId] = useState<number | null>(null);
  const [actingType, setActingType] = useState<"retry" | "cancel" | "delete" | "top" | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // 状态筛选与排序状态
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<"id" | "updatedAt">("updatedAt");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 分页控制状态 (默认 20 条/页)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [jumpPageInput, setJumpPageInput] = useState<string>("");

  // 状态详情清单弹窗 (Modal)
  const [statusModalType, setStatusModalType] = useState<"pending" | "processing" | "completed" | "failed" | null>(null);

  // 大图预览状态
  const [previewCover, setPreviewCover] = useState<{ title: string; url: string } | null>(null);

  // 更换封面状态
  const [coverTarget, setCoverTarget] = useState<QueueStatusItem | null>(null);
  const [newCoverUrl, setNewCoverUrl] = useState<string>("");
  const [isUploadingCover, setIsUploadingCover] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文章独立访问权限配置状态
  interface ArticlePermissionConfig {
    mode: "public" | "password" | "token";
    password?: string;
    tip?: string;
  }

  const [permissionTarget, setPermissionTarget] = useState<QueueStatusItem | null>(null);
  const [articlePermissions, setArticlePermissions] = useState<Record<number, ArticlePermissionConfig>>(() => {
    try {
      const saved = localStorage.getItem("rin_article_permissions");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      20: { mode: "token", tip: "需要持有特约读者通行证方可阅读" },
    };
  });

  const [currentPermMode, setCurrentPermMode] = useState<"public" | "password" | "token">("public");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentTip, setCurrentTip] = useState("");

  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  // 切换表头排序
  const handleToggleSort = (field: "id" | "updatedAt") => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // 排序与过滤计算（置顶文章永远优先排在最前）
  const filteredAndSortedItems = useMemo(() => {
    let list = items;

    // 状态分类筛选
    if (statusFilter !== "all") {
      list = list.filter((item) => item.aiSummaryStatus === statusFilter);
    }

    // 关键词搜索
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const titleMatch = (item.title || "").toLowerCase().includes(q);
        const idMatch = item.id.toString().includes(q);
        return titleMatch || idMatch;
      });
    }

    // 排序：置顶文章 (top > 0) 固定优先，之后按选定的字段排序
    return [...list].sort((a, b) => {
      const topA = a.top ?? 0;
      const topB = b.top ?? 0;
      if (topA !== topB) {
        return topB - topA;
      }

      if (sortField === "id") {
        return sortOrder === "asc" ? a.id - b.id : b.id - a.id;
      }

      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  }, [items, statusFilter, searchQuery, sortField, sortOrder]);

  // 切换筛选 Tab 或搜索时自动重置页码为 1
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortField, sortOrder]);

  const totalCount = filteredAndSortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // 当前分页切片数据
  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedItems.slice(start, start + pageSize);
  }, [filteredAndSortedItems, safeCurrentPage, pageSize]);

  // 动态生成页码列表（带省略号）
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages];
  }, [safeCurrentPage, totalPages]);

  // 前往指定页码
  const handleJumpPage = () => {
    const p = parseInt(jumpPageInput.trim(), 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
    setJumpPageInput("");
  };

  // 全选 / 取消全选（针对当前分页数据）
  const isAllCurrentPageSelected = paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.has(item.id));
  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllCurrentPageSelected) {
      paginatedItems.forEach((item) => next.delete(item.id));
    } else {
      paginatedItems.forEach((item) => next.add(item.id));
    }
    setSelectedIds(next);
  };

  // 单选
  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // 置顶 / 取消置顶
  const handleToggleTop = async (item: QueueStatusItem) => {
    const nextTop = (item.top && item.top > 0) ? 0 : 1;
    setActingId(item.id);
    setActingType("top");
    try {
      const { error } = await client.feed.setTop(item.id, nextTop);
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string) || "操作失败");
      } else {
        showAlert(nextTop > 0 ? `文章 #${item.id}「${item.title || ""}」已置顶！` : `文章 #${item.id} 已取消置顶！`, () => {
          void reload();
        });
      }
    } catch (e: any) {
      showAlert(e.message || "操作失败");
    } finally {
      setActingId(null);
      setActingType(null);
    }
  };

  // 取消/中止排队或处理中的任务
  const handleCancelTask = (item: QueueStatusItem) => {
    showConfirm(
      "中止任务确认",
      `确定要中止文章 #${item.id}「${item.title || "无标题"}」正在执行的任务吗？中止后将重置为已就绪空闲状态。`,
      async () => {
        setActingId(item.id);
        setActingType("cancel");
        try {
          const { error } = await client.config.cancelQueueTask(item.id);
          if (error) {
            showAlert(typeof error === "string" ? error : (error.value as string) || "中止失败");
          } else {
            showAlert("任务已成功中止并移出队列！", () => void reload());
          }
        } catch (e: any) {
          showAlert(e.message || "中止失败");
        } finally {
          setActingId(null);
          setActingType(null);
        }
      }
    );
  };

  // 单项重试/重新生成
  const handleSingleRetry = async (item: QueueStatusItem) => {
    setActingId(item.id);
    setActingType("retry");
    try {
      const { error } = await client.config.retryQueueTask(item.id);
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string) || "重试失败");
      } else {
        showAlert("已重新加入队列！后台 Worker 正在调度生成中...", () => void reload());
      }
    } catch (e: any) {
      showAlert(e.message || "重试失败");
    } finally {
      setActingId(null);
      setActingType(null);
    }
  };

  // 单项删除
  const handleSingleDelete = (item: QueueStatusItem) => {
    showConfirm(
      "删除任务确认",
      `确定要从监控列表中移除文章 #${item.id}「${item.title || "无标题"}」的任务记录吗？`,
      async () => {
        setActingId(item.id);
        setActingType("delete");
        try {
          const { error } = await client.config.deleteQueueTask(item.id);
          if (error) {
            showAlert(typeof error === "string" ? error : (error.value as string) || "删除失败");
          } else {
            showAlert("任务记录已清除！", () => void reload());
          }
        } catch (e: any) {
          showAlert(e.message || "删除失败");
        } finally {
          setActingId(null);
          setActingType(null);
        }
      }
    );
  };

  // 批量重新生成
  const handleBatchRetry = async () => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    let successCount = 0;
    try {
      for (const id of Array.from(selectedIds)) {
        const { error: err } = await client.config.retryQueueTask(id);
        if (!err) successCount++;
      }
      showAlert(`批量重试完成：成功加入队列 ${successCount} 个任务！`);
      setSelectedIds(new Set());
      void reload();
    } finally {
      setBatchLoading(false);
    }
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    showConfirm(
      "批量删除确认",
      `确定要从队列监控中批量删除选中的 ${selectedIds.size} 个任务吗？`,
      async () => {
        setBatchLoading(true);
        let count = 0;
        try {
          for (const id of Array.from(selectedIds)) {
            const { error: err } = await client.config.deleteQueueTask(id);
            if (!err) count++;
          }
          showAlert(`批量删除完成，已移除 ${count} 个任务！`);
          setSelectedIds(new Set());
          void reload();
        } finally {
          setBatchLoading(false);
        }
      }
    );
  };

  // 打开更换封面弹窗
  const handleOpenCoverModal = (item: QueueStatusItem) => {
    setCoverTarget(item);
    setNewCoverUrl(item.coverImage || "");
  };

  // 本地图片上传
  const handleCoverFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showAlert("请选择图片格式文件");
      return;
    }

    setIsUploadingCover(true);
    try {
      const { data: uploadRes, error } = await client.storage.upload(file);
      if (error || !uploadRes?.url) {
        showAlert(typeof error === "string" ? error : (error?.value as string) || "图片上传失败");
      } else {
        setNewCoverUrl(uploadRes.url);
      }
    } catch (err: any) {
      showAlert(err.message || "图片上传异常");
    } finally {
      setIsUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 确认更换文章封面
  const handleSaveCover = async () => {
    if (!coverTarget) return;
    const finalUrl = newCoverUrl.trim();
    if (!finalUrl) {
      showAlert("请输入封面图片链接或上传本地图片");
      return;
    }

    try {
      const { error } = await client.feed.setCover(coverTarget.id, finalUrl);
      if (error) {
        showAlert(typeof error === "string" ? error : (error.value as string) || "更换封面失败");
      } else {
        showAlert(`文章 #${coverTarget.id} 封面已成功更换！`, () => {
          setCoverTarget(null);
          void reload();
        });
      }
    } catch (err: any) {
      showAlert(err.message || "更新异常");
    }
  };

  // 保存访问控制权限
  const handleSavePermission = () => {
    if (!permissionTarget) return;
    const next = {
      ...articlePermissions,
      [permissionTarget.id]: {
        mode: currentPermMode,
        password: currentPassword.trim(),
        tip: currentTip.trim(),
      },
    };
    setArticlePermissions(next);
    try {
      localStorage.setItem("rin_article_permissions", JSON.stringify(next));
    } catch {}
    showAlert(`🎉 文章 #${permissionTarget.id}「${permissionTarget.title}」访问权限策略已更新！`);
    setPermissionTarget(null);
  };

  // 详情弹窗中的任务列表
  const modalTasks = useMemo(() => {
    if (!statusModalType) return [];
    return items.filter(item => item.aiSummaryStatus === statusModalType);
  }, [items, statusModalType]);

  return (
    <div className="flex w-full flex-col gap-5 ani-show">
      <Helmet>
        <title>{`文章管理与任务队列看板 - ${siteConfig.name}`}</title>
      </Helmet>

      <AlertUI />
      <ConfirmUI />

      {/* ====================================================================
          1. 顶部 5 大探针任务看板卡片 (支持实时联动与查看详情清单)
          ==================================================================== */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 select-none">
        {/* 卡片 1: 队列绑定状态 */}
        <div className="relative flex flex-col justify-between p-4 rounded-2xl border border-black/10 bg-w shadow-xs dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${queueConfigured ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span>队列绑定</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-mono text-neutral-500">
              ENV
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold t-primary font-mono">
              {queueConfigured ? "已绑定" : "未配置"}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {queueConfigured ? "Cloudflare Queue 正常" : "请在 Worker 绑定队列"}
            </p>
          </div>
          <ProbeSparkline tone={queueConfigured ? "success" : "danger"} active={queueConfigured} />
        </div>

        {/* 卡片 2: 排队任务 (可点击联动 & 查看清单) */}
        <div
          onClick={() => setStatusFilter("pending")}
          className={`relative flex flex-col justify-between p-4 rounded-2xl border bg-w shadow-xs cursor-pointer transition-all duration-200 overflow-hidden group hover:-translate-y-0.5 ${
            statusFilter === "pending"
              ? "border-amber-500 ring-2 ring-amber-500/20 shadow-amber-500/10 shadow-md"
              : "border-black/10 dark:border-white/10 hover:border-amber-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>排队任务</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatusModalType("pending");
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-600 dark:text-amber-400 font-mono transition flex items-center gap-0.5"
              title="查看排队任务实时清单"
            >
              <i className="ri-list-check text-xs" />
              <span>清单</span>
            </button>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold t-primary font-mono text-amber-500">
              {summary.pending}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">等待 Worker 调度</p>
          </div>
          <ProbeSparkline tone="warning" active={summary.pending > 0} />
        </div>

        {/* 卡片 3: 处理中任务 (可点击联动 & 查看清单) */}
        <div
          onClick={() => setStatusFilter("processing")}
          className={`relative flex flex-col justify-between p-4 rounded-2xl border bg-w shadow-xs cursor-pointer transition-all duration-200 overflow-hidden group hover:-translate-y-0.5 ${
            statusFilter === "processing"
              ? "border-sky-500 ring-2 ring-sky-500/20 shadow-sky-500/10 shadow-md"
              : "border-black/10 dark:border-white/10 hover:border-sky-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-spin" />
              <span>处理中任务</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatusModalType("processing");
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500 hover:text-white text-sky-600 dark:text-sky-400 font-mono transition flex items-center gap-0.5"
              title="查看处理中任务实时清单"
            >
              <i className="ri-list-check text-xs" />
              <span>清单</span>
            </button>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold t-primary font-mono text-sky-500">
              {summary.processing}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">AI 正在深度分析中</p>
          </div>
          <ProbeSparkline tone="neutral" active={summary.processing > 0} />
        </div>

        {/* 卡片 4: 已完成任务 (可点击联动 & 查看清单) */}
        <div
          onClick={() => setStatusFilter("completed")}
          className={`relative flex flex-col justify-between p-4 rounded-2xl border bg-w shadow-xs cursor-pointer transition-all duration-200 overflow-hidden group hover:-translate-y-0.5 ${
            statusFilter === "completed"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10 shadow-md"
              : "border-black/10 dark:border-white/10 hover:border-emerald-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>已完成任务</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatusModalType("completed");
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 font-mono transition flex items-center gap-0.5"
              title="查看已完成任务清单"
            >
              <i className="ri-list-check text-xs" />
              <span>清单</span>
            </button>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold t-primary font-mono text-emerald-500">
              {summary.completed}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">导读与摘要正常交付</p>
          </div>
          <ProbeSparkline tone="success" active={false} />
        </div>

        {/* 卡片 5: 失败任务 (可点击联动 & 查看清单) */}
        <div
          onClick={() => setStatusFilter("failed")}
          className={`relative flex flex-col justify-between p-4 rounded-2xl border bg-w shadow-xs cursor-pointer transition-all duration-200 overflow-hidden group hover:-translate-y-0.5 col-span-2 sm:col-span-1 ${
            statusFilter === "failed"
              ? "border-rose-500 ring-2 ring-rose-500/20 shadow-rose-500/10 shadow-md"
              : "border-black/10 dark:border-white/10 hover:border-rose-500/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${summary.failed > 0 ? "bg-rose-500 animate-ping" : "bg-neutral-400"}`} />
              <span>失败任务</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatusModalType("failed");
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 font-mono transition flex items-center gap-0.5"
              title="查看失败任务清单与报错"
            >
              <i className="ri-list-check text-xs" />
              <span>清单</span>
            </button>
          </div>
          <div className="my-2">
            <span className={`text-2xl font-extrabold font-mono ${summary.failed > 0 ? "text-rose-500" : "t-primary"}`}>
              {summary.failed}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {summary.failed > 0 ? "需人工排查或一键重试" : "无异常报错"}
            </p>
          </div>
          <ProbeSparkline tone={summary.failed > 0 ? "danger" : "neutral"} active={summary.failed > 0} />
        </div>
      </div>

      {/* ====================================================================
          2. 控制工具栏 (状态分类胶囊与卡片双向同步、实时搜索、多列排序、批量操作)
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 select-none">
        {/* 状态分类胶囊 (与顶部看板数量实时双向一致) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: "all", label: `全部 (${items.length})` },
            { id: "completed", label: `已完成 (${summary.completed})` },
            { id: "processing", label: `处理中 (${summary.processing})` },
            { id: "pending", label: `排队中 (${summary.pending})` },
            { id: "failed", label: `失败 (${summary.failed})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition select-none ${
                statusFilter === tab.id
                  ? "bg-theme text-white shadow-xs font-bold scale-[1.02]"
                  : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-black/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 搜索与快捷刷新 */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <i className="ri-search-line absolute left-2.5 text-neutral-400 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文章标题或ID..."
              className="rounded-xl border border-black/10 bg-transparent py-1.5 pl-8 pr-3 text-xs t-primary outline-none focus:border-theme dark:border-white/10 w-40 sm:w-52 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <i className="ri-close-circle-fill text-xs" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => reload()}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-transparent text-neutral-500 hover:text-theme hover:border-theme transition dark:border-white/10"
            title="手动刷新队列数据"
          >
            <i className={`ri-refresh-line text-sm ${loading ? "animate-spin text-theme" : ""}`} />
          </button>
        </div>
      </div>

      {/* 批量操作工具条 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-theme/10 border border-theme/20 text-xs text-theme ani-show">
          <div className="flex items-center gap-2 font-semibold">
            <i className="ri-checkbox-circle-fill text-base" />
            <span>已选中 {selectedIds.size} 项任务</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchRetry}
              disabled={batchLoading}
              className="px-3 py-1.5 rounded-xl bg-theme text-white font-bold hover:bg-theme-hover transition disabled:opacity-50"
            >
              {batchLoading ? "处理中..." : "批量重新生成"}
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={batchLoading}
              className="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition disabled:opacity-50"
            >
              批量删除记录
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          3. 文章管理表格 (封面预览、排版优化、列顺序前移、表头排序、固定置顶)
          ==================================================================== */}
      <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono">
                {/* 1. 多选框 */}
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                  />
                </th>

                {/* 2. ID (支持表头点击升降序) */}
                <th
                  onClick={() => handleToggleSort("id")}
                  className="py-3 px-3 w-20 cursor-pointer hover:text-theme transition"
                  title="点击切换 ID 升降序"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    {sortField === "id" ? (
                      <i className={sortOrder === "asc" ? "ri-arrow-up-s-line text-theme text-sm" : "ri-arrow-down-s-line text-theme text-sm"} />
                    ) : (
                      <i className="ri-arrow-up-down-line opacity-30 text-xs" />
                    )}
                  </div>
                </th>

                {/* 3. 精简为「文章标题」（含封面缩略图与快捷更换） */}
                <th className="py-3 px-3 min-w-[260px]">文章标题</th>

                {/* 4. 「最后更新时间」列前移至标题之后 (支持表头点击升降序) */}
                <th
                  onClick={() => handleToggleSort("updatedAt")}
                  className="py-3 px-3 w-48 cursor-pointer hover:text-theme transition"
                  title="点击切换最后更新时间升降序"
                >
                  <div className="flex items-center gap-1">
                    <span>最后更新时间</span>
                    {sortField === "updatedAt" ? (
                      <i className={sortOrder === "asc" ? "ri-arrow-up-s-line text-theme text-sm" : "ri-arrow-down-s-line text-theme text-sm"} />
                    ) : (
                      <i className="ri-arrow-up-down-line opacity-30 text-xs" />
                    )}
                  </div>
                </th>

                {/* 5. 当前状态 */}
                <th className="py-3 px-3 w-28 text-center">当前状态</th>

                {/* 6. 操作栏 */}
                <th className="py-3 px-3 w-48 text-right pr-5">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 t-primary">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <Spinner label="正在读取数据..." />
                    <span className="ml-2">正在从边缘加载文章队列…</span>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <i className="ri-inbox-line text-2xl block mb-1 opacity-50" />
                    <span>暂无符合条件的数据</span>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isActing = actingId === item.id;
                  const isTop = Boolean(item.top && item.top > 0);
                  const statusTone =
                    item.aiSummaryStatus === "completed"
                      ? "success"
                      : item.aiSummaryStatus === "failed"
                      ? "danger"
                      : item.aiSummaryStatus === "processing"
                      ? "neutral"
                      : "warning";

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors ${
                        isTop ? "bg-amber-500/[0.02]" : ""
                      } ${isSelected ? "bg-theme/[0.04]" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="py-3.5 px-3 font-mono font-bold text-neutral-400">
                        #{item.id}
                      </td>

                      {/* 文章标题（整合封面缩略图、大图预览、快捷更换与置顶标识） */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* 封面缩略图容器 (悬浮显示更换图标，点击预览大图) */}
                          <div className="relative group/cover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden shadow-2xs">
                            {item.coverImage ? (
                              <ImageWithFallback
                                src={item.coverImage}
                                alt={item.title || "cover"}
                                className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => setPreviewCover({ title: item.title || `文章 #${item.id}`, url: item.coverImage! })}
                              />
                            ) : (
                              <div
                                onClick={() => handleOpenCoverModal(item)}
                                className="h-full w-full flex flex-col items-center justify-center text-neutral-400 hover:text-theme cursor-pointer"
                                title="点击设置封面"
                              >
                                <i className="ri-image-add-line text-base" />
                              </div>
                            )}

                            {/* 悬浮遮罩：快捷更换封面入口 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCoverModal(item);
                              }}
                              className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity backdrop-blur-[1px]"
                              title="快捷更换此文章封面"
                            >
                              <i className="ri-image-edit-line text-sm" />
                            </button>
                          </div>

                          {/* 标题主体与徽标 (纯净无多余数字拼接) */}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* 仅置顶文章展示「置顶」Badge，严格布尔三元运算，绝对无多余数字 0 或 1 */}
                              {isTop ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs shrink-0 border border-amber-500/25 shadow-2xs">
                                  <i className="ri-pushpin-2-fill text-xs" />
                                  <span>置顶</span>
                                </span>
                              ) : null}

                              {/* 标题文字字号调整为 14px~15px / text-[15px] font-medium，纯净展示标题 */}
                              <Link
                                href={`/admin/writing?id=${item.id}`}
                                className="text-[15px] font-medium tracking-tight truncate t-primary hover:text-theme cursor-pointer transition max-w-xs sm:max-w-md lg:max-w-lg"
                                title="点击直接在后台编辑此文章"
                              >
                                {item.title ? String(item.title).trim() : "无标题文章"}
                              </Link>
                            </div>

                            {/* 异常错误或访问权限策略提示 */}
                            {item.aiSummaryError ? (
                              <span className="text-[11px] text-rose-500 truncate mt-0.5" title={item.aiSummaryError || ""}>
                                ⚠ 任务报错: {item.aiSummaryError}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px]">
                                {articlePermissions[item.id]?.mode === "password" && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                                    🔐 独立密码访问
                                  </span>
                                )}
                                {articlePermissions[item.id]?.mode === "token" && (
                                  <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                                    🎟️ 通行证保护
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 最后更新时间 (字号微调放大至 13px，文本对比度提升为中深色) */}
                      <td className="py-3.5 px-3 font-mono text-[13px] text-neutral-600 dark:text-neutral-300 font-medium whitespace-nowrap">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>

                      {/* 当前状态 */}
                      <td className="py-3.5 px-3 text-center">
                        <SettingsBadge tone={statusTone}>
                          {item.aiSummaryStatus === "completed"
                            ? "已完成"
                            : item.aiSummaryStatus === "processing"
                            ? "处理中"
                            : item.aiSummaryStatus === "pending"
                            ? "排队中"
                            : item.aiSummaryStatus === "failed"
                            ? "失败"
                            : "空闲"}
                        </SettingsBadge>
                      </td>

                      {/* 操作栏 */}
                      <td className="py-3.5 px-3 text-right pr-5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* 1. 置顶 / 取消置顶 */}
                          <button
                            type="button"
                            onClick={() => handleToggleTop(item)}
                            disabled={isActing && actingType === "top"}
                            className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                              isTop
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                                : "bg-black/5 hover:bg-black/10 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:text-theme"
                            }`}
                            title={isTop ? "点击取消置顶" : "点击置顶此文章"}
                          >
                            <i className={isTop ? "ri-pushpin-2-fill text-amber-500" : "ri-pushpin-2-line"} />
                            <span>{isTop ? "取消置顶" : "置顶"}</span>
                          </button>

                          {/* 2. 针对排队与正在处理任务：取消任务 / 中止 */}
                          {(item.aiSummaryStatus === "pending" || item.aiSummaryStatus === "processing") && (
                            <button
                              type="button"
                              onClick={() => handleCancelTask(item)}
                              disabled={isActing && actingType === "cancel"}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white font-semibold text-[11px] transition"
                              title="中止此任务并移出排队队列"
                            >
                              <i className="ri-stop-circle-line" />
                              <span>中止</span>
                            </button>
                          )}

                          {/* 3. 针对失败任务：优化「重试」入口；已完成任务：重新生成 */}
                          {(item.aiSummaryStatus === "failed" || item.aiSummaryStatus === "completed") && (
                            <button
                              type="button"
                              onClick={() => handleSingleRetry(item)}
                              disabled={isActing || batchLoading}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition text-[11px] ${
                                item.aiSummaryStatus === "failed"
                                  ? "bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white"
                                  : "bg-theme/10 hover:bg-theme/20 text-theme"
                              }`}
                              title={item.aiSummaryStatus === "failed" ? "立即重新加入队列重试" : "重新触发摘要生成"}
                            >
                              <i className={`ri-refresh-line ${isActing && actingType === "retry" ? "animate-spin" : ""}`} />
                              <span>{item.aiSummaryStatus === "failed" ? "重试" : "重新生成"}</span>
                            </button>
                          )}

                          {/* 4. 撰写编辑 */}
                          <Link
                            href={`/admin/writing?id=${item.id}`}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 font-semibold transition text-[11px]"
                            title="在后台直接修改与编辑此文章"
                          >
                            <i className="ri-edit-line text-xs" />
                            <span>编辑</span>
                          </Link>

                          {/* 5. 访问控制 */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionTarget(item);
                              const cfg = articlePermissions[item.id] || { mode: "public", password: "", tip: "" };
                              setCurrentPermMode(cfg.mode);
                              setCurrentPassword(cfg.password || "");
                              setCurrentTip(cfg.tip || "");
                            }}
                            className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg font-semibold transition text-[11px] ${
                              articlePermissions[item.id]?.mode && articlePermissions[item.id].mode !== "public"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                                : "bg-black/5 hover:bg-black/10 dark:bg-white/5 text-neutral-600 dark:text-neutral-300"
                            }`}
                            title="配置此文章访问限制"
                          >
                            <i className="ri-shield-keyhole-line text-xs" />
                            <span>{articlePermissions[item.id]?.mode && articlePermissions[item.id].mode !== "public" ? "已设限" : "权限"}</span>
                          </button>

                          {/* 6. 删除记录 */}
                          <button
                            type="button"
                            onClick={() => handleSingleDelete(item)}
                            disabled={isActing || batchLoading}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition disabled:opacity-50"
                            title="删除此任务记录"
                          >
                            <i className="ri-delete-bin-line text-xs" />
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

        {/* 表格底部标准分页栏 (Pagination) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] text-xs select-none">
          {/* 左侧：总条数统计与每页条数切换下拉 */}
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1.5">
              <span>共 <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{totalCount}</span> 条</span>
              {generatedAt && (
                <span className="text-[11px] text-neutral-400 font-mono hidden lg:inline">
                  (同步于 {new Date(generatedAt).toLocaleTimeString()})
                </span>
              )}
            </span>

            <div className="relative flex items-center">
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                className="appearance-none rounded-lg border border-black/10 bg-white dark:bg-neutral-800 py-1 pl-2.5 pr-7 text-xs font-medium text-neutral-700 dark:text-neutral-200 outline-none focus:border-theme dark:border-white/10 cursor-pointer shadow-2xs hover:border-black/20 dark:hover:border-white/20 transition"
              >
                <option value={10}>10 条/页</option>
                <option value={20}>20 条/页</option>
                <option value={50}>50 条/页</option>
              </select>
              <i className="ri-arrow-down-s-line absolute right-2 pointer-events-none text-neutral-400 text-xs" />
            </div>
          </div>

          {/* 右侧：翻页按钮、动态页码与快速跳转 */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
            {/* 上一页 */}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme disabled:opacity-30 disabled:pointer-events-none transition shadow-2xs text-xs dark:border-white/10"
              title="上一页"
            >
              <i className="ri-arrow-left-s-line" />
            </button>

            {/* 页码与省略号 */}
            {pageNumbers.map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="flex h-7 w-5 items-center justify-center text-neutral-400 text-xs">
                    ...
                  </span>
                );
              }
              const pageNum = p as number;
              const isActive = pageNum === safeCurrentPage;
              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`flex h-7 min-w-[28px] px-2 items-center justify-center rounded-lg text-xs font-mono font-medium transition ${
                    isActive
                      ? "bg-theme text-white font-bold shadow-2xs shadow-theme/20"
                      : "border border-black/10 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-theme hover:text-theme shadow-2xs dark:border-white/10"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* 下一页 */}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme disabled:opacity-30 disabled:pointer-events-none transition shadow-2xs text-xs dark:border-white/10"
              title="下一页"
            >
              <i className="ri-arrow-right-s-line" />
            </button>

            {/* 快速前往 */}
            <div className="flex items-center gap-1.5 ml-2 text-neutral-500 dark:text-neutral-400">
              <span>前往</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleJumpPage();
                  }
                }}
                onBlur={handleJumpPage}
                placeholder={String(safeCurrentPage)}
                className="h-7 w-12 rounded-lg border border-black/10 bg-white dark:bg-neutral-800 text-center font-mono text-xs text-neutral-700 dark:text-neutral-200 outline-none focus:border-theme dark:border-white/10 shadow-2xs"
              />
              <span>页</span>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. 弹窗与抽屉交互 (状态清单、封面预览、封面更换、权限策略)
          ==================================================================== */}

      {/* 4.1 状态任务实时清单弹窗 (Modal) */}
      {statusModalType && (
        <Modal
          isOpen={!!statusModalType}
          onRequestClose={() => setStatusModalType(null)}
          contentLabel={`${statusModalType.toUpperCase()} 状态任务清单`}
          panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-2xl w-full"
        >
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${
                  statusModalType === "completed" ? "bg-emerald-500" :
                  statusModalType === "processing" ? "bg-sky-500 animate-spin" :
                  statusModalType === "pending" ? "bg-amber-500" : "bg-rose-500"
                }`} />
                <h3 className="text-sm font-bold t-primary">
                  {statusModalType === "completed" ? "已完成任务清单" :
                   statusModalType === "processing" ? "正在处理中任务清单" :
                   statusModalType === "pending" ? "正在排队中任务清单" : "失败任务清单与报错诊断"}
                </h3>
                <span className="font-mono text-xs text-neutral-400">({modalTasks.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalType(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            {/* 清单列表流 */}
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
              {modalTasks.length === 0 ? (
                <div className="py-12 text-center text-neutral-400">
                  <i className="ri-checkbox-circle-line text-2xl block mb-1 opacity-50" />
                  <span>当前分类下暂无运行中的任务</span>
                </div>
              ) : (
                modalTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-neutral-400">#{t.id}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold t-primary truncate">{t.title || "无标题文章"}</p>
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          更新于: {new Date(t.updatedAt).toLocaleString()}
                        </p>
                        {t.aiSummaryError && (
                          <p className="text-[10px] text-rose-500 mt-1">⚠ 报错: {t.aiSummaryError}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {(statusModalType === "pending" || statusModalType === "processing") && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCancelTask(t);
                            setStatusModalType(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white font-semibold text-[11px] transition flex items-center gap-1"
                        >
                          <i className="ri-stop-circle-line" />
                          <span>取消/中止</span>
                        </button>
                      )}

                      {(statusModalType === "failed" || statusModalType === "completed") && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleSingleRetry(t);
                            setStatusModalType(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme text-theme hover:text-white font-semibold text-[11px] transition flex items-center gap-1"
                        >
                          <i className="ri-refresh-line" />
                          <span>重试</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setStatusModalType(null)}
                className="px-4 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 font-semibold"
              >
                关闭
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4.2 封面大图预览 Modal */}
      {previewCover && (
        <Modal
          isOpen={!!previewCover}
          onRequestClose={() => setPreviewCover(null)}
          contentLabel="封面大图预览"
          panelClassName="p-3 sm:p-4 max-w-[94vw] sm:max-w-2xl w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <h4 className="font-bold text-xs t-primary truncate">{previewCover.title}</h4>
              <button
                onClick={() => setPreviewCover(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="relative max-h-[70vh] flex items-center justify-center rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 p-1">
              <img
                src={previewCover.url}
                alt={previewCover.title}
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span className="truncate max-w-md">{previewCover.url}</span>
              <a
                href={previewCover.url}
                target="_blank"
                rel="noreferrer"
                className="text-theme hover:underline flex items-center gap-1 shrink-0 ml-2"
              >
                <span>原图外链</span>
                <i className="ri-external-link-line" />
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* 4.3 快捷更换封面 Modal */}
      {coverTarget && (
        <Modal
          isOpen={!!coverTarget}
          onRequestClose={() => !isUploadingCover && setCoverTarget(null)}
          contentLabel="快捷更换文章封面"
          panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-md w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl"
        >
          <div className="flex flex-col gap-4 text-xs">
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

            {/* 封面预览区 */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02]">
              {newCoverUrl.trim() ? (
                <div className="relative h-36 w-full rounded-lg overflow-hidden group/img">
                  <img
                    src={newCoverUrl}
                    alt="cover preview"
                    className="h-full w-full object-cover rounded-lg shadow-inner"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                    <span className="text-white text-xs font-bold">封面实时预览</span>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-neutral-400">
                  <i className="ri-image-line text-3xl mb-1 opacity-40" />
                  <span>暂无封面，请输入链接或选择本地图片</span>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileSelected}
                  className="hidden"
                />
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

      {/* 4.4 文章访问控制与密码/口令配置弹窗 */}
      {permissionTarget && (
        <Modal
          isOpen={!!permissionTarget}
          onRequestClose={() => setPermissionTarget(null)}
          contentLabel={`文章 #${permissionTarget.id} 访问权限配置`}
          panelClassName="p-4 sm:p-6 max-w-[94vw] sm:max-w-lg w-full"
        >
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div>
                <h3 className="text-sm font-bold t-primary flex items-center gap-2">
                  <span>文章访问权限与场景锁定:</span>
                  <span className="text-theme font-mono">#{permissionTarget.id}</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-sm">
                  {permissionTarget.title || "无标题文章"}
                </p>
              </div>
            </div>

            {/* 三大约束模式选择卡片 */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-theme">选择访问保护场景</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "public", label: "公开访问", desc: "所有人均可自由浏览" },
                  { id: "password", label: "独立密码锁", desc: "输入指定密码解锁" },
                  { id: "token", label: "口令通行证", desc: "输入通行密钥验证" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setCurrentPermMode(mode.id as any)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition select-none ${
                      currentPermMode === mode.id
                        ? "border-theme bg-theme/10 ring-1 ring-theme/30"
                        : "border-black/10 dark:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <span className={`font-bold text-xs ${currentPermMode === mode.id ? "text-theme" : "t-primary"}`}>
                      {mode.label}
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-1">
                      {mode.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 密码模式下的专属配置 */}
            {currentPermMode === "password" && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 ani-show">
                <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                  设置该文章的查看密码
                </label>
                <input
                  type="text"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="输入解锁密码（如 80hou-vip）..."
                  className="rounded-lg border border-black/10 bg-w px-3 py-1.5 text-xs outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
                />
              </div>
            )}

            {/* 提示语说明 */}
            {currentPermMode !== "public" && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 ani-show">
                <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                  前台读者未解锁时的提示说明
                </label>
                <input
                  type="text"
                  value={currentTip}
                  onChange={(e) => setCurrentTip(e.target.value)}
                  placeholder="如：本文为特约架构文档，需凭口令或联系博主获取凭证查阅。"
                  className="rounded-lg border border-black/10 bg-w px-3 py-1.5 text-xs outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
                />
              </div>
            )}

            {/* 底部确认操作 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setPermissionTarget(null)}
                className="px-3.5 py-1.5 rounded-xl border border-black/10 text-neutral-600 dark:border-white/10 dark:text-neutral-300 font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSavePermission}
                className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover transition"
              >
                保存策略
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
