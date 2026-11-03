import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { enrichMarkdownImageMetadata } from "../utils/image-upload";

export function CompatTasksPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [generatedAt, setGeneratedAt] = useState("");
  const [status, setStatus] = useState<{
    aiSummary: { enabled: boolean; queueConfigured: boolean; eligible: number; forceEligible: number };
    blurhash: { eligible: number };
  }>({
    aiSummary: { enabled: false, queueConfigured: false, eligible: 0, forceEligible: 0 },
    blurhash: { eligible: 0 },
  });
  const [runningTask, setRunningTask] = useState<"ai-summary" | "blurhash" | null>(null);
  const { showAlert, AlertUI } = useAlert();

  const loadStatus = () => {
    client.config.getCompatTasks().then(({ data, error }) => {
      if (error) {
        showAlert(error.value);
        return;
      }
      if (data) {
        setGeneratedAt(data.generatedAt);
        setStatus(data);
      }
    });
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const runAISummaryBackfill = async (force = false) => {
    setRunningTask("ai-summary");
    try {
      const { data, error } = await client.config.runCompatAISummary(force);
      if (error) {
        showAlert(error.value);
        return;
      }
      if (data) {
        showAlert(t(
          data.forced ? "compat_tasks.ai_summary.result_force" : "compat_tasks.ai_summary.result",
          { queued: data.queued, skipped: data.skipped },
        ));
        loadStatus();
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
        showAlert(error.value);
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
            if (response.error) {
              failed += 1;
            } else {
              updated += 1;
            }
          }
          failed += result.failed > 0 ? 1 : 0;
        } catch {
          failed += 1;
        }
      }

      showAlert(t("compat_tasks.blurhash.result", { updated, failed, total: items.length }));
      loadStatus();
    } catch {
      showAlert("执行 Blurhash 回填异常");
    } finally {
      setRunningTask(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`${t("compat_tasks.title")} - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      {/* 顶部指标切片中枢 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${status.aiSummary.eligible > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-[11px] font-mono text-neutral-400">待补填 AI 导读</span>
            </div>
            <span className="text-xl font-bold font-mono t-primary mt-0.5 block">{status.aiSummary.eligible} 篇</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-theme/10 text-theme font-mono font-bold">
            AI_TASK
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${status.blurhash.eligible > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-[11px] font-mono text-neutral-400">待计算 Blurhash</span>
            </div>
            <span className="text-xl font-bold font-mono t-primary mt-0.5 block">{status.blurhash.eligible} 篇</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold">
            BLURHASH
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-neutral-400 block">最近扫描时间</span>
            <span className="text-xs font-mono t-primary font-semibold mt-0.5 block truncate">
              {generatedAt ? new Date(generatedAt).toLocaleTimeString() : "--:--:--"}
            </span>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-theme/10 hover:text-theme transition"
            title="刷新状态"
          >
            <i className="ri-refresh-line text-sm" />
          </button>
        </div>
      </div>

      {/* 主体：iKuai 风格任务执行超级表格 */}
      <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-history-line text-theme" />
            <h3 className="font-bold text-xs t-primary">兼容性与离线数据批量回填控制台 (Dense DataGrid)</h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">一屏直达 · 增量补偿</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-28 text-center">状态</th>
                <th className="py-2.5 px-3 w-48">任务名称与协议</th>
                <th className="py-2.5 px-3">任务作用说明</th>
                <th className="py-2.5 px-3 w-36 text-center">待回填文章数</th>
                <th className="py-2.5 px-3 w-48 text-right pr-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {/* Task 1: AI Summary */}
              <tr className="hover:bg-theme/[0.02] transition-colors">
                <td className="py-3 px-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                    status.aiSummary.eligible > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {status.aiSummary.eligible > 0 ? "需回填" : "全部就绪"}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-col">
                    <span className="font-bold t-primary">{t("compat_tasks.ai_summary.title")}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">CF Queue Worker AI</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                  {t("compat_tasks.ai_summary.description")}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold t-primary">
                  {status.aiSummary.eligible} 篇
                </td>
                <td className="py-3 px-3 text-right pr-4 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={runningTask !== null || status.aiSummary.eligible === 0}
                      onClick={() => runAISummaryBackfill(false)}
                      className="px-2.5 py-1 rounded-lg bg-theme text-white text-xs font-semibold shadow-2xs hover:bg-theme-hover disabled:opacity-50 transition flex items-center gap-1"
                    >
                      {runningTask === "ai-summary" && <ReactLoading width="0.8rem" height="0.8rem" type="spin" color="#fff" />}
                      <span>执行增量回填</span>
                    </button>
                    <button
                      type="button"
                      disabled={runningTask !== null || status.aiSummary.forceEligible === 0}
                      onClick={() => runAISummaryBackfill(true)}
                      className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:border-theme text-xs font-semibold t-primary disabled:opacity-50 transition"
                      title="全量强制重新生成所有文章的 AI 导读"
                    >
                      强制重刷
                    </button>
                  </div>
                </td>
              </tr>

              {/* Task 2: Blurhash */}
              <tr className="hover:bg-theme/[0.02] transition-colors">
                <td className="py-3 px-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                    status.blurhash.eligible > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {status.blurhash.eligible > 0 ? "需计算" : "全部就绪"}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-col">
                    <span className="font-bold t-primary">{t("compat_tasks.blurhash.title")}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">Blurhash Compact AST</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                  {t("compat_tasks.blurhash.description")}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold t-primary">
                  {status.blurhash.eligible} 篇
                </td>
                <td className="py-3 px-3 text-right pr-4 whitespace-nowrap">
                  <button
                    type="button"
                    disabled={runningTask !== null || status.blurhash.eligible === 0}
                    onClick={runBlurhashBackfill}
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-2xs hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {runningTask === "blurhash" && <ReactLoading width="0.8rem" height="0.8rem" type="spin" color="#fff" />}
                    <span>开始计算生成</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
