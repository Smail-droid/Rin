import { Spinner } from "@rin/ui";
import type { ConfigHealthItem, ConfigHealthResponse } from "../api/client";
import { client } from "../app/runtime";
import { useCallback, useMemo } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useApiResource } from "../hooks/use-api-resource";
import { useSiteConfig } from "../hooks/useSiteConfig";

function renderHealthText(
  t: ReturnType<typeof useTranslation>["t"],
  text: ConfigHealthItem["title"],
) {
  return t(text.key, text.values);
}

// 快速跳转至对应设置项的映射
function getFixLink(id: string): string | null {
  if (id.includes("login")) return "/admin/settings?tab=general";
  if (id.includes("webhook")) return "/admin/settings?tab=services";
  if (id.includes("storage") || id.includes("s3")) return "/admin/settings?tab=services";
  if (id.includes("ai")) return "/admin/ai";
  if (id.includes("comment")) return "/admin/settings?tab=general";
  return "/admin/settings?tab=general";
}

export function HealthPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const loadHealth = useCallback(() => client.config.getHealth(), []);
  const { data, loading, error, reload } = useApiResource<ConfigHealthResponse>(loadHealth);
  const items = Array.isArray(data?.items) ? data.items : [];
  const summary = data?.summary ?? { success: 0, warning: 0, danger: 0 };
  const generatedAt = data?.generatedAt ?? "";

  const orderedItems = useMemo(() => {
    const score = { danger: 0, warning: 1, success: 2 } as const;
    return [...items].sort((left, right) => score[left.status] - score[right.status]);
  }, [items]);

  return (
    <div className="flex w-full flex-col gap-3.5 ani-show select-none">
      <Helmet>
        <title>{`${t("health.title")} - ${siteConfig.name}`}</title>
      </Helmet>

      {/* 顶部指标卡片 (紧凑切片排布，节省 60% 高度) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono text-neutral-400">已就绪正常</span>
            </div>
            <span className="text-xl font-bold font-mono text-emerald-500 mt-0.5 block">{summary.success}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            OK
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-mono text-neutral-400">待检查关注</span>
            </div>
            <span className="text-xl font-bold font-mono text-amber-500 mt-0.5 block">{summary.warning}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold">
            WARN
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${summary.danger > 0 ? "bg-rose-500 animate-ping" : "bg-neutral-400"}`} />
              <span className="text-[11px] font-mono text-neutral-400">严重阻断项</span>
            </div>
            <span className={`text-xl font-bold font-mono mt-0.5 block ${summary.danger > 0 ? "text-rose-500" : "t-primary"}`}>
              {summary.danger}
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
            summary.danger > 0 ? "bg-rose-500/10 text-rose-500" : "bg-neutral-500/10 text-neutral-400"
          }`}>
            ERROR
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-neutral-400 block">检测探针时钟</span>
            <span className="text-xs font-mono t-primary font-semibold mt-0.5 block truncate max-w-[140px]">
              {generatedAt ? new Date(generatedAt).toLocaleTimeString() : "--:--:--"}
            </span>
          </div>
          <button
            type="button"
            onClick={reload}
            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-theme/10 hover:text-theme transition"
            title="重新检测健康探针"
          >
            <i className="ri-refresh-line text-sm" />
          </button>
        </div>
      </div>

      {/* 主体：高密单屏超级诊断表格 (Dense DataGrid)，单屏直达 */}
      <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ri-stethoscope-line text-theme" />
            <span className="font-bold text-xs t-primary">系统健康与运行环境诊断清单 ({items.length})</span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">单屏集中排布 · 即时检测</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-xs text-neutral-400">
            <Spinner />
            <span>正在进行全站探针诊断…</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-500">
            <p>加载诊断数据失败: {error}</p>
            <button onClick={reload} className="mt-2 text-theme underline font-bold">点击重新检测</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-500 dark:text-neutral-400 font-mono">
                  <th className="py-2.5 px-3 w-24 text-center">状态级别</th>
                  <th className="py-2.5 px-3 w-36">检测项目</th>
                  <th className="py-2.5 px-3 w-48">现状诊断摘要</th>
                  <th className="py-2.5 px-3">影响与处置建议</th>
                  <th className="py-2.5 px-3 w-24 text-right pr-4">快捷处置</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {orderedItems.map((item) => {
                  const badgeTone = item.status === "success" ? "success" : item.status === "warning" ? "warning" : "danger";
                  const badgeLabel =
                    item.status === "success"
                      ? "正常"
                      : item.status === "warning"
                      ? "需关注"
                      : "严重异常";
                  const fixLink = getFixLink(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-theme/[0.02] transition-colors ${
                        item.status === "danger" ? "bg-rose-500/[0.02]" : ""
                      }`}
                    >
                      {/* 状态徽章 */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                          badgeTone === "success"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : badgeTone === "warning"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}>
                          {badgeLabel}
                        </span>
                      </td>

                      {/* 项目名称 */}
                      <td className="py-2.5 px-3 font-semibold t-primary">
                        <div className="flex flex-col">
                          <span>{renderHealthText(t, item.title)}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{item.id}</span>
                        </div>
                      </td>

                      {/* 现状诊断 */}
                      <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                        {renderHealthText(t, item.summary)}
                      </td>

                      {/* 影响与建议 */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5 text-neutral-500 dark:text-neutral-400">
                          <span>{renderHealthText(t, item.impact)}</span>
                          {item.suggestion && (
                            <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                              💡 {renderHealthText(t, item.suggestion)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 快捷跳转 */}
                      <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                        {fixLink && item.status !== "success" ? (
                          <Link
                            href={fixLink}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme text-white text-[11px] font-bold shadow-2xs hover:bg-theme-hover transition"
                          >
                            <span>前往调控</span>
                            <i className="ri-arrow-right-line text-xs" />
                          </Link>
                        ) : (
                          <span className="text-neutral-300 dark:text-neutral-600 font-mono text-[11px]">无需处置</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
