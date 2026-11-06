import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  storageStatus: string;
  loading: boolean;
}

export function AdminDashboardPage() {
  const siteConfig = useSiteConfig();
  const [stats, setStats] = useState<RealtimeStats>({
    feedsTotal: 0,
    feedsPublished: 0,
    feedsDraft: 0,
    momentsTotal: 0,
    commentsTotal: 0,
    commentsPending: 0,
    storageCount: 0,
    storageBytes: 0,
    storageStatus: "检测中…",
    loading: true,
  });

  const [recentFeeds, setRecentFeeds] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadRealtimeDashboard() {
      try {
        const [statsRes, feedsRes] = await Promise.allSettled([
          client.config.getDashboardStats(),
          client.feed.list({ limit: 8, page: 1 }),
        ]);

        if (!isMounted) return;

        let total = 0, pub = 0, drt = 0, mom = 0, comTot = 0, comPend = 0;
        let r2Count = 0, r2Bytes = 0, r2Stat = "已就绪";

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
          r2Stat = d.storage?.status || "已连接";
        }

        let recent: any[] = [];
        if (feedsRes.status === "fulfilled" && feedsRes.value.data?.data) {
          recent = feedsRes.value.data.data;
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
          storageStatus: r2Stat,
          loading: false,
        });
        setRecentFeeds(recent);
      } catch {
        if (isMounted) setStats((prev) => ({ ...prev, loading: false }));
      }
    }

    void loadRealtimeDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`概览 · 全站运行与管理中枢 - ${siteConfig.name}`}</title>
      </Helmet>

      {/* ====================================================================
          第 1 层：全站核心资产真实统计指标切片条 (全栈实时联动，绝非假数据)
          ==================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-theme/10 text-theme text-base shadow-2xs">
            <i className="ri-dashboard-3-line" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold t-primary">全站运行与核心资产总览</h2>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                Cloudflare Serverless 实时协同
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              数据直接汇总自 Cloudflare D1 关系库与 R2 对象存储桶实时水位
            </p>
          </div>
        </div>

        {/* 核心真实资产指标胶囊 */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">公开文章:</span>
            <span className="font-bold text-theme">{stats.loading ? "..." : stats.feedsPublished}</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">草稿箱:</span>
            <span className={`font-bold ${stats.feedsDraft > 0 ? "text-amber-500 font-extrabold" : "text-neutral-400"}`}>
              {stats.loading ? "..." : stats.feedsDraft}
            </span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">生活记事:</span>
            <span className="font-bold text-sky-500">{stats.loading ? "..." : stats.momentsTotal}</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">读者留言:</span>
            <span className="font-bold text-pink-500">{stats.loading ? "..." : stats.commentsTotal}</span>
            {stats.commentsPending > 0 && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-white font-bold animate-pulse">
                {stats.commentsPending} 待审
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">R2媒体:</span>
            <span className="font-bold text-amber-500">
              {stats.loading ? "..." : `${stats.storageCount} 张 (${formatFileSize(stats.storageBytes)})`}
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          第 2 层：全站快捷中枢与 URL 核心入口高密矩阵 (一键直达各个功能与页面)
          ==================================================================== */}
      <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] p-3.5 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-compass-3-line text-theme" />
            <h3 className="font-bold text-xs t-primary">快捷功能调度</h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">点击图标跨模块直达</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1.5 text-xs">
          {[
            { href: "/admin/writing", icon: "ri-quill-pen-line", title: "撰写", color: "text-rose-500 bg-rose-500/10" },
            { href: "/admin/tags", icon: "ri-price-tag-3-line", title: "标签", color: "text-amber-500 bg-amber-500/10" },
            { href: "/admin/files", icon: "ri-folder-image-line", title: "媒体", color: "text-sky-500 bg-sky-500/10" },
            { href: "/admin/queue-status", icon: "ri-todo-line", title: "调度", color: "text-emerald-500 bg-emerald-500/10" },
            { href: "/admin/settings?tab=general", icon: "ri-equalizer-line", title: "设置", color: "text-blue-500 bg-blue-500/10" },
            { href: "/admin/settings?tab=atelier", icon: "ri-palette-line", title: "便签", color: "text-purple-500 bg-purple-500/10" },
            { href: "/admin/music", icon: "ri-disc-line", title: "音乐", color: "text-rose-500 bg-rose-500/10" },
            { href: "/admin/openlist", icon: "ri-hard-drive-2-line", title: "网盘", color: "text-cyan-500 bg-cyan-500/10" },
            { href: "/admin/ops", icon: "ri-heart-pulse-line", title: "运维", color: "text-pink-500 bg-pink-500/10" },
            { href: "/admin/access", icon: "ri-shield-keyhole-line", title: "锁定", color: "text-indigo-500 bg-indigo-500/10" },
            { href: "/admin/tokens", icon: "ri-key-2-line", title: "口令", color: "text-teal-500 bg-teal-500/10" },
            { href: "/admin/ai", icon: "ri-sparkling-fill", title: "AI助手", color: "text-orange-500 bg-orange-500/10" },
            { href: "/sitemap.xml", icon: "ri-map-2-line", title: "地图", color: "text-lime-600 bg-lime-500/10", external: true },
            { href: "/timeline", icon: "ri-time-line", title: "长河", color: "text-violet-500 bg-violet-500/10", external: true },
            { href: "/moments", icon: "ri-chat-smile-2-line", title: "动态", color: "text-yellow-600 bg-yellow-500/10", external: true },
          ].map((item, i) => (
            item.external ? (
              <a
                key={i}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-xl border border-black/5 hover:border-theme/40 bg-black/[0.015] hover:bg-theme/5 dark:border-white/5 dark:bg-white/[0.02] flex flex-col items-center text-center gap-1 transition-all group"
              >
                <span className={`p-1.5 rounded-lg ${item.color} group-hover:scale-110 transition-transform`}>
                  <i className={`${item.icon} text-xs`} />
                </span>
                <span className="font-semibold text-[11px] t-primary group-hover:text-theme truncate w-full">{item.title}</span>
              </a>
            ) : (
              <Link
                key={i}
                href={item.href}
                className="p-1.5 rounded-xl border border-black/5 hover:border-theme/40 bg-black/[0.015] hover:bg-theme/5 dark:border-white/5 dark:bg-white/[0.02] flex flex-col items-center text-center gap-1 transition-all group"
              >
                <span className={`p-1.5 rounded-lg ${item.color} group-hover:scale-110 transition-transform`}>
                  <i className={`${item.icon} text-xs`} />
                </span>
                <span className="font-semibold text-[11px] t-primary group-hover:text-theme truncate w-full">{item.title}</span>
              </Link>
            )
          ))}
        </div>
      </div>

      {/* ====================================================================
          第 3 层：最近发布文章真实状态与内容巡检超级表格 (Dense DataGrid)
          ==================================================================== */}
      <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <i className="ri-article-line text-theme" />
            <span className="font-bold text-xs t-primary">文章状态与内容巡检超级表格 (Dense DataGrid)</span>
            <span className="text-[10px] font-mono text-neutral-400">一眼看清发布/草稿/锁状态</span>
          </div>

          <Link
            href="/admin/writing"
            className="px-2.5 py-1 rounded-lg bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover transition flex items-center gap-1"
          >
            <i className="ri-add-line" />
            <span>撰写新文章</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-16 text-center">状态</th>
                <th className="py-2.5 px-3 w-20">ID</th>
                <th className="py-2.5 px-3">文章标题与摘要</th>
                <th className="py-2.5 px-3 w-28 text-center">AI 导读</th>
                <th className="py-2.5 px-3 w-28">发布时间</th>
                <th className="py-2.5 px-3 w-24 text-right pr-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {stats.loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400 text-xs">
                    正在拉取真实文章巡检数据...
                  </td>
                </tr>
              ) : recentFeeds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400 text-xs">
                    暂无文章记录，点击上方按钮开始创作
                  </td>
                </tr>
              ) : (
                recentFeeds.map((feed) => {
                  const isDraft = feed.draft === 1;
                  const isTop = feed.top === 1;
                  return (
                    <tr key={feed.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                          isDraft ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {isDraft ? "草稿" : "已公开"}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-neutral-400">
                        #{feed.id}
                        {isTop && <span className="ml-1 text-[9px] text-theme font-bold">📌</span>}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col min-w-0 max-w-md">
                          <Link
                            href={`/feed/${feed.id}`}
                            className="font-semibold t-primary hover:text-theme transition truncate"
                            title={feed.title}
                          >
                            {feed.title || "无标题草稿"}
                          </Link>
                          <span className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {feed.summary || "暂无摘要描述"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {feed.ai_summary ? (
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                            已生成
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">未提取</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-neutral-400 font-mono text-[11px]">
                        {new Date(feed.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-right pr-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/admin/writing/${feed.id}`}
                            className="px-2 py-0.5 rounded bg-theme/10 hover:bg-theme/20 text-theme font-semibold text-[11px] transition"
                          >
                            编辑
                          </Link>
                          <Link
                            href={`/feed/${feed.id}`}
                            className="px-2 py-0.5 rounded border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme hover:border-theme text-[11px] transition"
                          >
                            浏览
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
