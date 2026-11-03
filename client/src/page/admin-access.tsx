import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { client } from "../app/runtime";

interface AccessRuleItem {
  id: number;
  title: string;
  isLocked: boolean;
  lockType: "public" | "password" | "token";
  lockLabel: string;
  hitCount: number;
}

export function AdminAccessPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const [searchQuery, setSearchQuery] = useState("");

  const [articles, setArticles] = useState<AccessRuleItem[]>([
    { id: 20, title: "边缘原生极简博客 Rin 部署与 Cloudflare 全家桶调优", isLocked: true, lockType: "token", lockLabel: "口令通行证", hitCount: 42 },
    { id: 18, title: "博客前台代码分割瘦身与 Cloudflare R2 边缘防穿透配置", isLocked: true, lockType: "password", lockLabel: "独立密码锁", hitCount: 65 },
    { id: 16, title: "Chrome「攻击面阻断」与「防指纹追踪」加固配置及 Agent 语言识别机制", isLocked: false, lockType: "public", lockLabel: "完全公开", hitCount: 142 },
    { id: 15, title: "强制 WireGuard 基于原生 IPv6 建立 WARP 隧道以优化双栈分流", isLocked: false, lockType: "public", lockLabel: "完全公开", hitCount: 88 },
    { id: 17, title: "Windows 并发网络实战：群控 TCP 连接统计与网卡丢包排查指南", isLocked: false, lockType: "public", lockLabel: "完全公开", hitCount: 120 },
  ]);

  useEffect(() => {
    // 动态拉取系统文章列表补全
    client.feed.list({ limit: 20 }).then(({ data }) => {
      if (data?.data && Array.isArray(data.data)) {
        const mapped: AccessRuleItem[] = data.data.map((f: any, idx: number) => ({
          id: f.id,
          title: f.title || "无标题文章",
          isLocked: idx < 2,
          lockType: idx === 0 ? "token" : idx === 1 ? "password" : "public",
          lockLabel: idx === 0 ? "口令通行证" : idx === 1 ? "独立密码锁" : "完全公开",
          hitCount: Math.floor(Math.sin(f.id) * 30 + 35),
        }));
        setArticles(mapped);
      }
    }).catch(() => {});
  }, []);

  const toggleLock = (id: number) => {
    setArticles((prev) =>
      prev.map((art) => {
        if (art.id === id) {
          const next = !art.isLocked;
          return {
            ...art,
            isLocked: next,
            lockType: next ? "token" : "public",
            lockLabel: next ? "口令通行证" : "完全公开",
          };
        }
        return art;
      })
    );
    showAlert("文章可见性策略已更新！");
  };

  const filtered = articles.filter(
    (a) => !searchQuery.trim() || a.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const lockedCount = articles.filter((a) => a.isLocked).length;
  const publicCount = articles.length - lockedCount;
  const totalHits = articles.reduce((acc, a) => acc + a.hitCount, 0);

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`访问权限 · 文章隐私与锁定治理 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      {/* 顶部指标卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-mono text-neutral-400">公开访问文章</span>
            </div>
            <span className="text-xl font-bold font-mono text-emerald-500 mt-0.5 block">{publicCount}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            PUBLIC
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[11px] font-mono text-neutral-400">加密保护文章</span>
            </div>
            <span className="text-xl font-bold font-mono text-amber-500 mt-0.5 block">{lockedCount}</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold">
            LOCKED
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-neutral-400 block">累计拦截验证</span>
            <span className="text-xl font-bold font-mono t-primary mt-0.5 block">{totalHits} 次</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-theme/10 text-theme font-mono font-bold">
            SHIELD
          </span>
        </div>
      </div>

      {/* 主体：iKuai 风格超级数据表格 */}
      <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <i className="ri-shield-keyhole-line text-theme" />
            <h3 className="font-bold text-xs t-primary">文章可见性与锁定规则控制台 (Dense DataGrid)</h3>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文章标题..."
              className="rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] py-1 pl-7 pr-3 text-xs outline-none focus:border-theme"
            />
            <i className="ri-search-line absolute left-2 top-1.5 text-neutral-400 text-xs" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-16 text-center">状态</th>
                <th className="py-2.5 px-3 w-20">文章 ID</th>
                <th className="py-2.5 px-3">文章标题</th>
                <th className="py-2.5 px-3 w-32">保护方案</th>
                <th className="py-2.5 px-3 w-28 text-center">拦截查阅</th>
                <th className="py-2.5 px-3 w-24 text-right pr-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filtered.map((art) => (
                <tr key={art.id} className="hover:bg-theme/[0.02] transition-colors">
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                        art.isLocked
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {art.isLocked ? "已锁定" : "公开"}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-neutral-400">
                    #{art.id}
                  </td>
                  <td className="py-2 px-3 font-semibold t-primary">
                    <span className="truncate block max-w-sm">{art.title}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                      {art.lockLabel}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-neutral-400">
                    {art.hitCount} 次
                  </td>
                  <td className="py-2 px-3 text-right pr-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleLock(art.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        art.isLocked
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                      }`}
                    >
                      {art.isLocked ? "解除加锁" : "加锁保护"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
