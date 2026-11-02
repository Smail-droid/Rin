import { Modal, SettingsBadge, Spinner } from "@rin/ui";
import { useCallback, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
  const [actingType, setActingType] = useState<"retry" | "delete" | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // 状态筛选与排序状态 (Excel 级数据表格支持)
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 文章独立访问权限与加密控制状态
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
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  // 筛选与排序
  const filteredItems = useMemo(() => {
    let result = [...items];

    // 状态筛选
    if (statusFilter !== "all") {
      result = result.filter((it) => it.aiSummaryStatus === statusFilter);
    }

    // 关键词搜索
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (it) =>
          it.title?.toLowerCase().includes(q) ||
          String(it.id).includes(q) ||
          it.aiSummaryError?.toLowerCase().includes(q)
      );
    }

    // 时间排序
    result.sort((a, b) => {
      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [items, statusFilter, searchQuery, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((it) => it.id)));
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

  // 单条重试
  const handleSingleRetry = async (entry: QueueStatusItem) => {
    setActingId(entry.id);
    setActingType("retry");
    try {
      const { error: err } = await client.config.retryQueueTask(entry.id);
      if (err) {
        showAlert(String(err.value));
        return;
      }
      showAlert(t("queue_status.retry_success") || "已重新加入处理队列！");
      void reload();
    } finally {
      setActingId(null);
      setActingType(null);
    }
  };

  // 单条删除
  const handleSingleDelete = (entry: QueueStatusItem) => {
    showConfirm(
      t("queue_status.delete_confirm_title") || "删除确认",
      t("queue_status.delete_confirm_description", { id: entry.id }) || `确定要删除任务 #${entry.id} 吗？`,
      async () => {
        setActingId(entry.id);
        setActingType("delete");
        try {
          const { error: err } = await client.config.deleteQueueTask(entry.id);
          if (err) {
            showAlert(String(err.value));
            return;
          }
          showAlert(t("queue_status.delete_success") || "删除成功");
          void reload();
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

  return (
    <div className="flex w-full flex-col gap-5 ani-show">
      <Helmet>
        <title>{`队列与任务监控 - ${siteConfig.name}`}</title>
      </Helmet>

      <AlertUI />
      <ConfirmUI />

      {/* ====================================================================
          1. 顶部 5 大探针监控状态卡片 (带实时微折线与 Mac 终端指示)
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

        {/* 卡片 2: 排队中任务 */}
        <div className="relative flex flex-col justify-between p-4 rounded-2xl border border-black/10 bg-w shadow-xs dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>排队任务</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
              PENDING
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold t-primary font-mono text-amber-500">
              {summary.pending}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">等待 Worker 调度</p>
          </div>
          <ProbeSparkline tone="warning" active={summary.pending > 0} />
        </div>

        {/* 卡片 3: 处理中任务 */}
        <div className="relative flex flex-col justify-between p-4 rounded-2xl border border-black/10 bg-w shadow-xs dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-spin" />
              <span>处理中任务</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono">
              RUNNING
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold t-primary font-mono text-sky-500">
              {summary.processing}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">AI 正在深度分析中</p>
          </div>
          <ProbeSparkline tone="neutral" active={summary.processing > 0} />
        </div>

        {/* 卡片 4: 已完成任务 */}
        <div className="relative flex flex-col justify-between p-4 rounded-2xl border border-black/10 bg-w shadow-xs dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>已完成任务</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
              DONE
            </span>
          </div>
          <div className="my-2">
            <span className="text-2xl font-extrabold t-primary font-mono text-emerald-500">
              {summary.completed}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">导读与流水线正常交付</p>
          </div>
          <ProbeSparkline tone="success" active={false} />
        </div>

        {/* 卡片 5: 失败任务 */}
        <div className="relative flex flex-col justify-between p-4 rounded-2xl border border-black/10 bg-w shadow-xs dark:border-white/10 overflow-hidden col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${summary.failed > 0 ? "bg-rose-500 animate-ping" : "bg-neutral-400"}`} />
              <span>失败任务</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono">
              FAILED
            </span>
          </div>
          <div className="my-2">
            <span className={`text-2xl font-extrabold font-mono ${summary.failed > 0 ? "text-rose-500" : "t-primary"}`}>
              {summary.failed}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {summary.failed > 0 ? "需要人工排查或重试" : "无异常报错"}
            </p>
          </div>
          <ProbeSparkline tone={summary.failed > 0 ? "danger" : "neutral"} active={summary.failed > 0} />
        </div>
      </div>

      {/* ====================================================================
          2. 控制工具栏 (状态筛选胶囊、搜索、排序、批量操作)
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 select-none">
        {/* 左侧状态过滤胶囊 */}
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
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                statusFilter === tab.id
                  ? "bg-theme text-white shadow-xs"
                  : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-black/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 右侧搜索与排序 */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <i className="ri-search-line absolute left-2.5 text-neutral-400 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文章或ID..."
              className="rounded-xl border border-black/10 bg-transparent py-1.5 pl-8 pr-3 text-xs t-primary outline-none focus:border-theme dark:border-white/10 w-36 sm:w-44"
            />
          </div>

          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            className="flex h-8 items-center gap-1 px-2.5 rounded-xl border border-black/10 bg-transparent text-xs font-semibold t-primary hover:border-theme transition dark:border-white/10"
            title="切换更新时间升降序"
          >
            <i className={sortOrder === "desc" ? "ri-sort-desc text-theme" : "ri-sort-asc text-theme"} />
            <span className="hidden sm:inline">{sortOrder === "desc" ? "最新" : "最早"}</span>
          </button>

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

      {/* 批量操作提示条 (当勾选项目时呼出) */}
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
              批量删除
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          3. Excel 级超级多列数据表格 (告别空旷、单屏容纳数十条高效处理)
          ==================================================================== */}
      <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded accent-theme cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-16">ID</th>
                <th className="py-3 px-3">文章标题与别名</th>
                <th className="py-3 px-3 w-28 text-center">当前状态</th>
                <th className="py-3 px-3 w-44">最后更新时间</th>
                <th className="py-3 px-3 w-36 text-right pr-5">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 t-primary">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <Spinner label="正在读取队列..." />
                    <span className="ml-2">正在从边缘加载任务队列…</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <i className="ri-inbox-line text-2xl block mb-1 opacity-50" />
                    <span>暂无符合条件的队列任务</span>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isActing = actingId === item.id;
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
                        isSelected ? "bg-theme/[0.04]" : ""
                      }`}
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

                      {/* Title & Alias */}
                      <td className="py-3.5 px-3 max-w-[280px] sm:max-w-[360px]">
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/admin/writing?id=${item.id}`}
                            className="font-bold truncate t-primary hover:text-theme cursor-pointer transition"
                            title="点击直接在后台编辑此文章"
                          >
                            {item.title || "无标题文章"}
                          </Link>
                          {item.aiSummaryError ? (
                            <span className="text-[10px] text-rose-500 truncate mt-0.5" title={item.aiSummaryError || ""}>
                              ⚠ 错误: {item.aiSummaryError}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px]">
                              <span className="text-neutral-400">ID: {item.id}</span>
                              {articlePermissions[item.id]?.mode === "password" && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                                  🔐 独立密码访问
                                </span>
                              )}
                              {articlePermissions[item.id]?.mode === "token" && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                                  🎟️ 口令通行证保护
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
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

                      {/* Updated Time */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right pr-5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* 直接编辑文章入口 */}
                          <Link
                            href={`/admin/writing?id=${item.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 font-semibold transition text-[11px]"
                            title="在后台直接修改与编辑此文章"
                          >
                            <i className="ri-edit-line text-xs" />
                            <span>编辑</span>
                          </Link>

                          {/* 权限访问控制入口 */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionTarget(item);
                              const cfg = articlePermissions[item.id] || { mode: "public", password: "", tip: "" };
                              setCurrentPermMode(cfg.mode);
                              setCurrentPassword(cfg.password || "");
                              setCurrentTip(cfg.tip || "");
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition text-[11px] ${
                              articlePermissions[item.id]?.mode && articlePermissions[item.id].mode !== "public"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                                : "bg-black/5 hover:bg-black/10 dark:bg-white/5 text-neutral-600 dark:text-neutral-300"
                            }`}
                            title="配置此文章访问限制（公开/密码锁/通行证）"
                          >
                            <i className="ri-shield-keyhole-line text-xs" />
                            <span>{articlePermissions[item.id]?.mode && articlePermissions[item.id].mode !== "public" ? "已设限" : "权限"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSingleRetry(item)}
                            disabled={isActing || batchLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme font-semibold transition disabled:opacity-50 text-[11px]"
                            title="重新生成导读"
                          >
                            <i className={`ri-refresh-line ${isActing && actingType === "retry" ? "animate-spin" : ""}`} />
                            <span>{item.aiSummaryStatus === "completed" ? "重新生成" : "重试"}</span>
                          </button>

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

        {/* 表格底部汇总信息 */}
        {generatedAt && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] text-[11px] font-mono text-neutral-400 select-none">
            <span>显示 {filteredItems.length} / 共 {items.length} 条任务记录</span>
            <span>最近快照同步时间: {new Date(generatedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 文章访问控制与密码/口令配置弹窗 */}
      {permissionTarget && (
        <Modal
          isOpen={!!permissionTarget}
          onRequestClose={() => setPermissionTarget(null)}
          contentLabel={`文章 #${permissionTarget.id} 访问权限配置`}
          panelClassName="p-6 max-w-lg w-full"
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
