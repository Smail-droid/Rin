import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useApiResource } from "../hooks/use-api-resource";
import { enrichMarkdownImageMetadata } from "../utils/image-upload";
import type { ConfigHealthResponse } from "../api/client";

function getFixLink(id: string): string {
  if (id.includes("login")) return "/admin/settings?tab=general";
  if (id.includes("webhook") || id.includes("storage") || id.includes("s3")) return "/admin/settings?tab=services";
  if (id.includes("ai")) return "/admin/ai-hub";
  return "/admin/settings?tab=general";
}

export function AdminOpsHubPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();

  // 1. 健康诊断探针状态
  const loadHealth = useCallback(() => client.config.getHealth(), []);
  const { data: healthData, loading: healthLoading, reload: reloadHealth } = useApiResource<ConfigHealthResponse>(loadHealth);
  const healthItems = Array.isArray(healthData?.items) ? healthData.items : [];
  const healthSummary = healthData?.summary ?? { success: 0, warning: 0, danger: 0 };

  const orderedHealthItems = useMemo(() => {
    const score = { danger: 0, warning: 1, success: 2 } as const;
    return [...healthItems].sort((left, right) => score[left.status] - score[right.status]);
  }, [healthItems]);

  // 2. 增量补偿回填状态
  const [compatGeneratedAt, setCompatGeneratedAt] = useState("");
  const [compatStatus, setCompatStatus] = useState<{
    aiSummary: { enabled: boolean; queueConfigured: boolean; eligible: number; forceEligible: number };
    blurhash: { eligible: number };
  }>({
    aiSummary: { enabled: false, queueConfigured: false, eligible: 0, forceEligible: 0 },
    blurhash: { eligible: 0 },
  });
  const [runningTask, setRunningTask] = useState<"ai-summary" | "blurhash" | null>(null);

  const loadCompatStatus = () => {
    client.config.getCompatTasks().then(({ data }) => {
      if (data) {
        setCompatGeneratedAt(data.generatedAt);
        setCompatStatus(data);
      }
    });
  };

  useEffect(() => {
    loadCompatStatus();
  }, []);

  const runAISummaryBackfill = async (force = false) => {
    setRunningTask("ai-summary");
    try {
      const { data, error } = await client.config.runCompatAISummary(force);
      if (error) {
        showAlert(String(error.value));
        return;
      }
      if (data) {
        showAlert(t(
          data.forced ? "compat_tasks.ai_summary.result_force" : "compat_tasks.ai_summary.result",
          { queued: data.queued, skipped: data.skipped },
        ));
        loadCompatStatus();
      }
    } finally {
      setRunningTask(null);
    }
  };

  const runBlurhashBackfill = async () => {
    setRunningTask("blurhash");
    try {
      const { data, error } = await client.config.getCompatBlurhashCandidates();
      if (error) {
        showAlert(String(error.value));
        return;
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      let updated = 0;
      let failed = 0;

      for (const item of items) {
        try {
          const result = await enrichMarkdownImageMetadata(item.content);
          if (result.updated > 0 && result.content !== item.content) {
            const response = await client.config.applyCompatBlurhash(item.id, result.content);
            if (response.error) failed += 1;
            else updated += 1;
          }
          failed += result.failed > 0 ? 1 : 0;
        } catch {
          failed += 1;
        }
      }

      showAlert(t("compat_tasks.blurhash.result", { updated, failed, total: items.length }));
      loadCompatStatus();
    } catch {
      showAlert("执行 Blurhash 回填异常");
    } finally {
      setRunningTask(null);
    }
  };

  // 3. SEO 基础信息与复制
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://你的域名";
  const sitemapUrl = `${siteUrl}/sitemap.xml`;

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    showAlert(`🎉 已复制 ${label} 到剪贴板：\n${text}`);
  };

  return (
    <div className="flex w-full flex-col gap-3.5 ani-show select-none">
      <Helmet>
        <title>{`运维与巡检监控台 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      {/* ====================================================================
          第 1 层：顶部通栏 SEO 引擎直达卡片 + Sitemap 快速操作 (高 80px 紧凑)
          ==================================================================== */}
      <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-theme text-lg">
            <i className="ri-search-eye-line" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs t-primary">SEO 引擎与全网收录广播</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Sitemap 自动更新
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
              自动暴露 /sitemap.xml 与 /robots.txt，支持 Cloudflare Crawler Hints (IndexNow) 边缘主动推送
            </p>
          </div>
        </div>

        {/* 三大站长直达胶囊与复制 */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => copyToClipboard(sitemapUrl, "Sitemap 地址")}
            className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-[11px] font-semibold t-primary hover:border-theme transition flex items-center gap-1"
          >
            <i className="ri-file-copy-line text-theme" />
            <span>复制 Sitemap</span>
          </button>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[11px] transition flex items-center gap-1"
            title="前往 Google 站长提交 Sitemap"
          >
            <i className="ri-google-fill" />
            <span>Google</span>
          </a>
          <a
            href="https://www.bing.com/webmasters"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] transition flex items-center gap-1"
            title="前往 Bing 必应站长提交 Sitemap"
          >
            <i className="ri-microsoft-fill" />
            <span>Bing</span>
          </a>
          <a
            href="https://ziyuan.baidu.com/"
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition flex items-center gap-1"
            title="前往百度搜索资源平台提交"
          >
            <i className="ri-baidu-fill" />
            <span>百度</span>
          </a>
        </div>
      </div>

      {/* ====================================================================
          第 2 层：左右 50% / 50% 双拼爱快工业级监控表格 (高密工整，单屏全览)
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        {/* 左半屏：系统健康诊断 Dense DataGrid */}
        <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] overflow-hidden shadow-2xs flex flex-col">
          {/* 表头操作栏 */}
          <div className="p-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <i className="ri-heart-pulse-line text-theme" />
              <span className="font-bold text-xs t-primary">系统健康与运行环境诊断 ({healthItems.length})</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                healthSummary.danger > 0 ? "bg-rose-500/10 text-rose-500" : healthSummary.warning > 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
              }`}>
                {healthSummary.danger > 0 ? `${healthSummary.danger} 项异常` : healthSummary.warning > 0 ? `${healthSummary.warning} 项关注` : "全部就绪"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => reloadHealth()}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-theme transition"
              title="重新探测健康状态"
            >
              <i className="ri-refresh-line text-xs" />
            </button>
          </div>

          {/* 表格内容 */}
          <div className="overflow-x-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px] sticky top-0 bg-white dark:bg-[#161b26] z-10">
                  <th className="py-2 px-3 w-16 text-center">状态</th>
                  <th className="py-2 px-3 w-32">巡检项目</th>
                  <th className="py-2 px-3">现状诊断摘要</th>
                  <th className="py-2 px-3 w-20 text-right pr-3">调控</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {healthLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-400 text-xs">
                      <div className="flex items-center justify-center gap-2">
                        <ReactLoading width="1rem" height="1rem" type="spin" color="#fc466b" />
                        <span>正在进行全站探针诊断…</span>
                      </div>
                    </td>
                  </tr>
                ) : orderedHealthItems.map((item) => (
                  <tr key={item.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                        item.status === "danger"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : item.status === "warning"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {item.status === "danger" ? "异常" : item.status === "warning" ? "需关注" : "正常"}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold t-primary">
                      {t(item.title.key, item.title.values)}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                      {item.summary ? (
                        <span className="font-mono">{t(item.summary.key, item.summary.values)}</span>
                      ) : (
                        <span>正常</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right pr-3 whitespace-nowrap">
                      {item.status !== "success" ? (
                        <Link
                          href={getFixLink(item.id)}
                          className="px-2 py-0.5 rounded bg-theme/10 hover:bg-theme/20 text-theme font-bold text-[10px] transition inline-flex items-center gap-0.5"
                        >
                          <span>前往</span>
                          <i className="ri-arrow-right-s-line text-xs" />
                        </Link>
                      ) : (
                        <span className="text-[10px] font-mono text-neutral-400">已闭环</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右半屏：增量数据回填与异步任务 Dense DataGrid */}
        <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] overflow-hidden shadow-2xs flex flex-col">
          {/* 表头操作栏 */}
          <div className="p-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <i className="ri-history-line text-theme" />
              <span className="font-bold text-xs t-primary">增量补偿与离线数据回填控制台</span>
              <span className="text-[10px] font-mono text-neutral-400">
                {compatGeneratedAt ? new Date(compatGeneratedAt).toLocaleTimeString() : "--:--"}
              </span>
            </div>
            <button
              type="button"
              onClick={loadCompatStatus}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-theme transition"
              title="刷新回填状态"
            >
              <i className="ri-refresh-line text-xs" />
            </button>
          </div>

          {/* 表格内容 */}
          <div className="overflow-x-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px] sticky top-0 bg-white dark:bg-[#161b26] z-10">
                  <th className="py-2 px-3 w-16 text-center">状态</th>
                  <th className="py-2 px-3 w-32">回填任务</th>
                  <th className="py-2 px-3">待处理 / 说明</th>
                  <th className="py-2 px-3 w-36 text-right pr-3">执行通道</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {/* 任务 1: AI 导读生成 */}
                <tr className="hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                      compatStatus.aiSummary.eligible > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {compatStatus.aiSummary.eligible > 0 ? "待补偿" : "已就绪"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold t-primary">AI 智能导读回填</span>
                      <span className="text-[10px] text-neutral-400 font-mono">CF Queue AI</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs font-mono font-bold text-theme">
                      {compatStatus.aiSummary.eligible} 篇待处理
                    </span>
                    <span className="text-[11px] text-neutral-400 block line-clamp-1">
                      为未生成导读的文章增量补充 AI 摘要
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right pr-3 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={runningTask !== null || compatStatus.aiSummary.eligible === 0}
                        onClick={() => runAISummaryBackfill(false)}
                        className="px-2 py-1 rounded bg-theme text-white text-[10px] font-bold shadow-2xs hover:bg-theme-hover disabled:opacity-40 transition flex items-center gap-1"
                      >
                        {runningTask === "ai-summary" && <ReactLoading width="0.7rem" height="0.7rem" type="spin" color="#fff" />}
                        <span>增量回填</span>
                      </button>
                      <button
                        type="button"
                        disabled={runningTask !== null}
                        onClick={() => runAISummaryBackfill(true)}
                        className="px-2 py-1 rounded border border-black/10 dark:border-white/10 text-[10px] font-semibold t-primary hover:border-theme disabled:opacity-40 transition"
                        title="全量重刷"
                      >
                        重刷
                      </button>
                    </div>
                  </td>
                </tr>

                {/* 任务 2: Blurhash 占位图生成 */}
                <tr className="hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                      compatStatus.blurhash.eligible > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {compatStatus.blurhash.eligible > 0 ? "待补偿" : "已就绪"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold t-primary">图片 Blurhash 计算</span>
                      <span className="text-[10px] text-neutral-400 font-mono">AST Pre-render</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs font-mono font-bold text-blue-500">
                      {compatStatus.blurhash.eligible} 篇待处理
                    </span>
                    <span className="text-[11px] text-neutral-400 block line-clamp-1">
                      为 Markdown 插图自动生成模糊渐变微占位
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right pr-3 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={runningTask !== null || compatStatus.blurhash.eligible === 0}
                      onClick={runBlurhashBackfill}
                      className="px-2.5 py-1 rounded bg-blue-600 text-white text-[10px] font-bold shadow-2xs hover:bg-blue-700 disabled:opacity-40 transition flex items-center gap-1"
                    >
                      {runningTask === "blurhash" && <ReactLoading width="0.7rem" height="0.7rem" type="spin" color="#fff" />}
                      <span>执行生成</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
