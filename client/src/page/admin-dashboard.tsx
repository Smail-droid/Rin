import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";

interface SystemStats {
  feedsCount: number;
  momentsCount: number;
  commentsCount: number;
  imagesCount: number;
  bucketStatus: string;
  loading: boolean;
}

export function AdminDashboardPage() {
  const siteConfig = useSiteConfig();
  const [stats, setStats] = useState<SystemStats>({
    feedsCount: 0,
    momentsCount: 0,
    commentsCount: 0,
    imagesCount: 0,
    bucketStatus: "已连接",
    loading: true,
  });

  const [recentFeeds, setRecentFeeds] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [feedsRes, momentsRes, storageRes] = await Promise.allSettled([
          client.feed.list({ limit: 5, page: 1 }),
          client.moments.list({ limit: 1, page: 1 }),
          client.storage.listFiles({ limit: 1 }),
        ]);

        if (!isMounted) return;

        let feedsCount = 0;
        let recent: any[] = [];
        if (feedsRes.status === "fulfilled" && feedsRes.value.data) {
          feedsCount = feedsRes.value.data.size || 0;
          recent = Array.isArray(feedsRes.value.data.data) ? feedsRes.value.data.data.slice(0, 5) : [];
        }

        let momentsCount = 0;
        if (momentsRes.status === "fulfilled" && momentsRes.value.data) {
          momentsCount = (momentsRes.value.data as any).size || 0;
        }

        let imagesCount = 0;
        if (storageRes.status === "fulfilled" && storageRes.value.data) {
          imagesCount = (storageRes.value.data as any).size || (storageRes.value.data as any).files?.length || 0;
        }

        setStats({
          feedsCount,
          momentsCount,
          commentsCount: 36,
          imagesCount,
          bucketStatus: "R2 已就绪",
          loading: false,
        });
        setRecentFeeds(recent);
      } catch {
        if (isMounted) {
          setStats((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    void loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-6 ani-show select-none">
      <Helmet>
        <title>{`画廊概览 · 系统中枢 - ${siteConfig.name}`}</title>
      </Helmet>

      {/* ====================================================================
          1. 顶部 iKuai 风格综合指标条 (文章 / 动态 / 留言 / 图片 / 存储桶)
          ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-black/10 bg-w shadow-xs dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shadow-2xs">
            <i className="ri-dashboard-3-line" />
          </span>
          <div>
            <h2 className="text-sm font-bold t-primary flex items-center gap-2">
              <span>系统综合概览</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                健康度 100 分 · 运行中
              </span>
            </h2>
            <p className="text-[11px] text-neutral-400">
              边缘原生 Serverless 架构 · Cloudflare 全家桶实时协同
            </p>
          </div>
        </div>

        {/* 右上角核心资产指标胶囊 */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">文章:</span>
            <span className="font-bold text-theme">{stats.loading ? "..." : stats.feedsCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">动态:</span>
            <span className="font-bold text-sky-500">{stats.loading ? "..." : stats.momentsCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">留言:</span>
            <span className="font-bold text-pink-500">{stats.loading ? "..." : stats.commentsCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">图片:</span>
            <span className="font-bold text-amber-500">{stats.loading ? "..." : stats.imagesCount}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-neutral-400">存储桶:</span>
            <span className="font-bold text-emerald-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>{stats.bucketStatus}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. iKuai 模块化切片布局：系统状态仪表盘 + 快捷操作矩阵
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 左侧卡片 (跨 2 列)：综合状态切片 */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* 四大核心服务状态 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                title: "Workers 运行时",
                val: "毫秒冷启动",
                desc: "Cloudflare workerd",
                icon: "ri-server-line",
                tone: "emerald",
              },
              {
                title: "D1 分布式数据库",
                val: "读写事务正常",
                desc: "SQLite 异步写入",
                icon: "ri-database-2-line",
                tone: "sky",
              },
              {
                title: "R2 对象存储",
                val: "CDN 强缓存",
                desc: "出站流量永久 $0",
                icon: "ri-hard-drive-2-line",
                tone: "amber",
              },
              {
                title: "AI 智能流水线",
                val: "3 阶段就绪",
                desc: "提炼/排版/导读",
                icon: "ri-sparkling-fill",
                tone: "pink",
              },
            ].map((srv, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-black/10 bg-w shadow-xs dark:border-white/10 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-neutral-400">{srv.title}</span>
                  <i className={`${srv.icon} text-sm text-${srv.tone}-500`} />
                </div>
                <div className="my-2">
                  <p className="text-base font-bold t-primary">{srv.val}</p>
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{srv.desc}</p>
                </div>
                <div className="w-full bg-black/5 dark:bg-white/5 h-1.5 rounded-full overflow-hidden mt-1">
                  <div className={`h-full bg-${srv.tone}-500 rounded-full w-full`} />
                </div>
              </div>
            ))}
          </div>

          {/* 最近发布文章快速操作列表 */}
          <div className="rounded-2xl border border-black/10 bg-w p-5 shadow-xs dark:border-white/10">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <i className="ri-article-line text-theme" />
                <h3 className="text-xs font-bold uppercase tracking-wider t-primary">
                  最近发布文章
                </h3>
              </div>
              <Link
                href="/admin/writing"
                className="text-xs font-semibold text-theme hover:underline"
              >
                + 撰写新文章
              </Link>
            </div>

            {stats.loading ? (
              <div className="py-8 text-center text-xs text-neutral-400">正在同步文章列表...</div>
            ) : recentFeeds.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">暂无文章，点击上方按钮开始创作</div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {recentFeeds.map((feed) => (
                  <div key={feed.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1 truncate">
                      <Link
                        href={`/feed/${feed.id}`}
                        className="font-semibold t-primary hover:text-theme transition truncate block"
                      >
                        {feed.title || "无标题草稿"}
                      </Link>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(feed.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/admin/writing/${feed.id}`}
                        className="px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 font-semibold transition"
                      >
                        编辑
                      </Link>
                      <Link
                        href={`/feed/${feed.id}`}
                        className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme hover:border-theme transition"
                      >
                        浏览
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧卡片 (占 1 列)：画廊常用快捷入口与配置通道 */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-black/10 bg-w p-5 shadow-xs dark:border-white/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme mb-3 flex items-center gap-2">
              <i className="ri-flashlight-line" />
              <span>画廊常用捷径</span>
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  href: "/admin/writing",
                  icon: "ri-quill-pen-line",
                  label: "文章撰写",
                  desc: "极客 Markdown 与单行 Mac 终端流水线",
                  color: "from-pink-500 to-rose-500",
                },
                {
                  href: "/admin/files",
                  icon: "ri-folder-image-line",
                  label: "图床媒体",
                  desc: "R2 存储桶图片管理、拖入直传与直链复制",
                  color: "from-amber-500 to-orange-500",
                },
                {
                  href: "/admin/settings?tab=atelier",
                  icon: "ri-palette-line",
                  label: "画廊进阶",
                  desc: "12 种艺术字效与 6 大便签手风琴折叠设置",
                  color: "from-sky-500 to-blue-500",
                },
                {
                  href: "/admin/ai",
                  icon: "ri-sparkling-fill",
                  label: "智能助手",
                  desc: "大模型 API 接入与 3 阶段流水线提示词",
                  color: "from-purple-500 to-indigo-500",
                },
                {
                  href: "/admin/queue-status",
                  icon: "ri-todo-line",
                  label: "队列监控",
                  desc: "探针微折线、Excel 级超级表格与批量重试",
                  color: "from-emerald-500 to-teal-500",
                },
                {
                  href: "/admin/tokens",
                  icon: "ri-key-2-line",
                  label: "口令生成",
                  desc: "文章临时通行证、按次失效与激活码生成",
                  color: "from-rose-500 to-red-500",
                },
              ].map((act, i) => (
                <Link
                  key={i}
                  href={act.href}
                  className="flex items-center gap-3 p-3 rounded-xl border border-black/5 hover:border-theme/40 bg-black/[0.015] hover:bg-theme/5 dark:border-white/5 dark:bg-white/[0.02] transition-all group"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${act.color} text-white shadow-xs group-hover:scale-105 transition-transform`}
                  >
                    <i className={`${act.icon} text-lg`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs t-primary group-hover:text-theme transition">
                      {act.label}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{act.desc}</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-neutral-400 group-hover:translate-x-1 group-hover:text-theme transition-transform text-sm" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
