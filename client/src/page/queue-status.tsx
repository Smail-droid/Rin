import { Modal, SettingsBadge, Spinner } from "@rin/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import type { QueueStatusItem, QueueStatusResponse } from "../api/client";
import { client } from "../app/runtime";
import { useAlert, useConfirm } from "../components/dialog";
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

  // 排序与过滤计算
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

    // 排序
    return [...list].sort((a, b) => {
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

  // 单项重置状态为空闲 (清空异常报错并移出队列监控，绝不影响文章内容)
  const handleResetTaskStatus = (item: QueueStatusItem) => {
    showConfirm(
      "重置任务状态确认",
      `确定要将文章 #${item.id}「${item.title || "无标题"}」的任务调度状态重置为空闲吗？\n\n注意：此操作仅清空队列调度状态与错误标记，绝不会删除文章本身或正文内容。`,
      async () => {
        setActingId(item.id);
        setActingType("delete");
        try {
          const { error } = await client.config.deleteQueueTask(item.id);
          if (error) {
            showAlert(typeof error === "string" ? error : (error.value as string) || "重置失败");
          } else {
            showAlert("任务调度状态已重置为空闲！", () => void reload());
          }
        } catch (e: any) {
          showAlert(e.message || "重置失败");
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

  // 批量重置状态为空闲
  const handleBatchResetStatus = () => {
    if (selectedIds.size === 0) return;
    showConfirm(
      "批量重置确认",
      `确定要将选中的 ${selectedIds.size} 项任务调度状态重置为空闲吗？\n\n注意：此操作仅清空后台队列调度记录，绝不会删除或修改文章正文。`,
      async () => {
        setBatchLoading(true);
        let count = 0;
        try {
          for (const id of Array.from(selectedIds)) {
            const { error: err } = await client.config.deleteQueueTask(id);
            if (!err) count++;
          }
          showAlert(`批量重置完成，已重置 ${count} 项任务状态为空闲！`);
          setSelectedIds(new Set());
          void reload();
        } finally {
          setBatchLoading(false);
        }
      }
    );
  };

  // 详情弹窗中的任务列表
  const modalTasks = useMemo(() => {
    if (!statusModalType) return [];
    return items.filter(item => item.aiSummaryStatus === statusModalType);
  }, [items, statusModalType]);

  return (
    <div className="flex w-full flex-col gap-5 ani-show">
      <Helmet>
        <title>{`异步流水线与 AI 队列调度看板 - ${siteConfig.name}`}</title>
      </Helmet>

      <AlertUI />
      <ConfirmUI />

      {/* 职责隔离引导横幅：明确队列与概览的分工界限 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs select-none">
        <div className="flex items-center gap-2 t-secondary">
          <i className="ri-information-line text-theme text-sm shrink-0" />
          <span>
            本看板专职监控 <strong>Cloudflare Queue 异步流水线</strong> 与 AI 导读调度状态。
          </span>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-theme hover:underline font-bold shrink-0"
        >
          <span>管理文章发布、置顶与权限请前往「画廊概览中枢」</span>
          <i className="ri-arrow-right-line" />
        </Link>
      </div>

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
              onClick={handleBatchResetStatus}
              disabled={batchLoading}
              className="px-3 py-1.5 rounded-xl bg-neutral-600 hover:bg-neutral-700 text-white font-bold transition disabled:opacity-50 flex items-center gap-1"
              title="仅重置任务调度状态为空闲，绝不删除文章"
            >
              <i className="ri-eraser-line text-xs" />
              <span>批量重置为空闲</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          3. 异步任务调度明细表 (专注于流水线状态、任务类型、报错排查与调度重试)
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

                {/* 2. 任务/文章 ID */}
                <th
                  onClick={() => handleToggleSort("id")}
                  className="py-3 px-3 w-20 cursor-pointer hover:text-theme transition"
                  title="点击切换 ID 升降序"
                >
                  <div className="flex items-center gap-1">
                    <span>任务ID</span>
                    {sortField === "id" ? (
                      <i className={sortOrder === "asc" ? "ri-arrow-up-s-line text-theme text-sm" : "ri-arrow-down-s-line text-theme text-sm"} />
                    ) : (
                      <i className="ri-arrow-up-down-line opacity-30 text-xs" />
                    )}
                  </div>
                </th>

                {/* 3. 关联文章 */}
                <th className="py-3 px-3 min-w-[220px]">关联文章</th>

                {/* 4. 任务类型 */}
                <th className="py-3 px-3 w-32 text-center">任务流水线</th>

                {/* 5. 调度状态 */}
                <th className="py-3 px-3 w-28 text-center">调度状态</th>

                {/* 6. 异常排查与诊断信息 */}
                <th className="py-3 px-3 min-w-[200px]">诊断与调度日志</th>

                {/* 7. 调度更新时间 */}
                <th
                  onClick={() => handleToggleSort("updatedAt")}
                  className="py-3 px-3 w-40 cursor-pointer hover:text-theme transition"
                  title="点击切换最后更新时间升降序"
                >
                  <div className="flex items-center gap-1">
                    <span>调度时间</span>
                    {sortField === "updatedAt" ? (
                      <i className={sortOrder === "asc" ? "ri-arrow-up-s-line text-theme text-sm" : "ri-arrow-down-s-line text-theme text-sm"} />
                    ) : (
                      <i className="ri-arrow-up-down-line opacity-30 text-xs" />
                    )}
                  </div>
                </th>

                {/* 8. 队列操作 */}
                <th className="py-3 px-3 w-44 text-right pr-5">流水线操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 t-primary">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Spinner label="正在读取数据..." />
                    <span className="ml-2">正在从边缘加载任务调度队列…</span>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <i className="ri-checkbox-circle-line text-2xl block mb-1 opacity-50 text-emerald-500" />
                    <span>暂无符合条件的流水线任务</span>
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
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                        />
                      </td>

                      {/* 任务/文章 ID */}
                      <td className="py-3 px-3 font-mono font-bold text-neutral-400">
                        #{item.id}
                      </td>

                      {/* 关联文章 */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            href={`/feed/${item.id}`}
                            target="_blank"
                            className="text-xs font-semibold truncate t-primary hover:text-theme cursor-pointer transition max-w-xs sm:max-w-md"
                            title="在新窗口查看前台文章"
                          >
                            {item.title ? String(item.title).trim() : "无标题文章"}
                          </Link>
                          <i className="ri-external-link-line text-neutral-400 text-[10px] shrink-0" />
                        </div>
                      </td>

                      {/* 任务流水线类型 */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                          <i className="ri-sparkling-line text-theme" />
                          <span>AI 导读摘要</span>
                        </span>
                      </td>

                      {/* 调度状态 */}
                      <td className="py-3 px-3 text-center">
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

                      {/* 诊断与调度日志 */}
                      <td className="py-3 px-3">
                        {item.aiSummaryError ? (
                          <div className="flex items-center gap-1.5 text-rose-500 font-mono text-[11px]" title={item.aiSummaryError}>
                            <i className="ri-error-warning-line shrink-0" />
                            <span className="truncate max-w-xs">{item.aiSummaryError}</span>
                          </div>
                        ) : item.aiSummaryStatus === "processing" ? (
                          <div className="flex items-center gap-1.5 text-sky-500 font-mono text-[11px]">
                            <i className="ri-loader-4-line animate-spin shrink-0" />
                            <span>Worker 正在消费生成...</span>
                          </div>
                        ) : item.aiSummaryStatus === "pending" ? (
                          <div className="flex items-center gap-1.5 text-amber-500 font-mono text-[11px]">
                            <i className="ri-time-line shrink-0" />
                            <span>队列等待消费...</span>
                          </div>
                        ) : item.aiSummaryStatus === "completed" ? (
                          <span className="text-[11px] text-neutral-400 font-mono">
                            摘要生成完成 · 已同步前台
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-400 font-mono">
                            就绪空闲
                          </span>
                        )}
                      </td>

                      {/* 调度时间 */}
                      <td className="py-3 px-3 font-mono text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>

                      {/* 流水线操作 */}
                      <td className="py-3 px-3 text-right pr-5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* 1. 排队中 / 正在处理：中止 */}
                          {(item.aiSummaryStatus === "pending" || item.aiSummaryStatus === "processing") && (
                            <button
                              type="button"
                              onClick={() => handleCancelTask(item)}
                              disabled={isActing && actingType === "cancel"}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white font-semibold text-[11px] transition cursor-pointer"
                              title="中止此任务并移出队列"
                            >
                              <i className="ri-stop-circle-line" />
                              <span>中止</span>
                            </button>
                          )}

                          {/* 2. 失败任务：重试；已完成任务：重新生成 */}
                          {(item.aiSummaryStatus === "failed" || item.aiSummaryStatus === "completed") && (
                            <button
                              type="button"
                              onClick={() => handleSingleRetry(item)}
                              disabled={isActing || batchLoading}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition text-[11px] cursor-pointer ${
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

                          {/* 3. 清理状态并重置为空闲 (明确非删除文章) */}
                          <button
                            type="button"
                            onClick={() => handleResetTaskStatus(item)}
                            disabled={isActing || batchLoading}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition disabled:opacity-50 cursor-pointer"
                            title="重置此任务调度状态为空闲 (不影响文章正文)"
                          >
                            <i className="ri-eraser-line text-xs" />
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

    </div>
  );
}
