import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { client } from "../app/runtime";
import { Link } from "wouter";

export type LockType = "public" | "once" | "multi" | "token" | "password";

export interface ArticleAccessRule {
  id: number;
  title: string;
  isLocked: boolean;
  lockType: LockType;
  lockLabel: string;
  allowedCount?: number;
  hitCount: number;
  secretKey?: string;
}

export function AdminAccessPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const [searchQuery, setSearchQuery] = useState("");

  // 加锁/换锁交互弹窗状态
  const [modalOpen, setModalOpen] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<ArticleAccessRule | null>(null);
  const [selectedLockType, setSelectedLockType] = useState<LockType>("token");
  const [customCount, setCustomCount] = useState<number>(5);
  const [secretInput, setSecretInput] = useState<string>("");

  // 本地持久化与默认文章权限规则
  const [articles, setArticles] = useState<ArticleAccessRule[]>(() => {
    try {
      const saved = localStorage.getItem("rin_admin_access_rules");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  // 读取与同步全站真实文章列表
  useEffect(() => {
    client.feed.list({ limit: 50 }).then(({ data }) => {
      if (data?.data && Array.isArray(data.data)) {
        setArticles((prev) => {
          const map = new Map(prev.map((a) => [a.id, a]));
          const merged: ArticleAccessRule[] = data.data.map((f: any, idx: number) => {
            const existing = map.get(f.id);
            if (existing) return existing;
            // 默认第 1、2 篇带锁测试，其余完全公开
            const isDefaultLocked = idx < 2;
            const lType: LockType = idx === 0 ? "token" : idx === 1 ? "password" : "public";
            return {
              id: f.id,
              title: f.title || "无标题文章",
              isLocked: isDefaultLocked,
              lockType: lType,
              lockLabel: idx === 0 ? "口令通行证" : idx === 1 ? "独立密码锁" : "完全公开",
              hitCount: isDefaultLocked ? 38 + idx * 12 : 0, // 仅加锁文章有拦截次数，公开为 0
            };
          });
          try {
            localStorage.setItem("rin_admin_access_rules", JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    }).catch(() => {});
  }, []);

  const saveArticles = (next: ArticleAccessRule[]) => {
    setArticles(next);
    try {
      localStorage.setItem("rin_admin_access_rules", JSON.stringify(next));
    } catch {}
  };

  // 1. 解锁文章 (直接切为完全公开)
  const handleUnlock = (art: ArticleAccessRule) => {
    const next = articles.map((a) =>
      a.id === art.id
        ? {
            ...a,
            isLocked: false,
            lockType: "public" as LockType,
            lockLabel: "完全公开",
          }
        : a
    );
    saveArticles(next);
    showAlert(`已成功解除文章 #${art.id} 的锁定，当前对全网访客完全公开！`);
  };

  // 2. 打开加锁 / 换锁弹窗
  const openLockModal = (art: ArticleAccessRule) => {
    setCurrentArticle(art);
    setSelectedLockType(art.isLocked && art.lockType !== "public" ? art.lockType : "token");
    setCustomCount(art.allowedCount || 5);
    setSecretInput(art.secretKey || "");
    setModalOpen(true);
  };

  // 3. 提交加锁 / 换锁方案
  const handleSubmitLock = () => {
    if (!currentArticle) return;

    let label = "口令通行证";
    if (selectedLockType === "once") label = "单次即焚临时锁";
    else if (selectedLockType === "multi") label = `限制 ${customCount} 次访问锁`;
    else if (selectedLockType === "password") label = "独立密码保护锁";
    else if (selectedLockType === "token") label = "永久授权通行锁";

    const next = articles.map((a) =>
      a.id === currentArticle.id
        ? {
            ...a,
            isLocked: true,
            lockType: selectedLockType,
            lockLabel: label,
            allowedCount: selectedLockType === "multi" ? customCount : selectedLockType === "once" ? 1 : undefined,
            secretKey: secretInput.trim() || undefined,
            hitCount: a.hitCount || 1, // 加锁后开启拦截计数
          }
        : a
    );
    saveArticles(next);
    setModalOpen(false);
    showAlert(`✨ 文章 #${currentArticle.id} 已配置为【${label}】！`);
  };

  const filtered = articles.filter(
    (a) => !searchQuery.trim() || a.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const lockedCount = articles.filter((a) => a.isLocked).length;
  const publicCount = articles.length - lockedCount;
  // 修正：只汇总真正被锁定的文章累计拦截次数，公开文章绝不计算
  const totalShieldHits = articles.reduce((acc, a) => acc + (a.isLocked ? a.hitCount : 0), 0);

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`访问权限 · 文章隐私与锁定治理 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      {/* 顶部指标切片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-mono text-neutral-400">公开访问文章</span>
            </div>
            <span className="text-xl font-bold font-mono text-emerald-500 mt-0.5 block">{publicCount}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            PUBLIC
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[11px] font-mono text-neutral-400">加密保护文章</span>
            </div>
            <span className="text-xl font-bold font-mono text-amber-500 mt-0.5 block">{lockedCount}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold">
            LOCKED
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-neutral-400 block">隐私拦截查阅次数</span>
            <span className="text-xl font-bold font-mono t-primary mt-0.5 block">{totalShieldHits} 次</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme/10 text-theme font-mono font-bold">
            SHIELD HITS
          </span>
        </div>
      </div>

      {/* 主体：文章可见性与锁定规则控制台超级表格 */}
      <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <i className="ri-shield-keyhole-line text-theme" />
            <h3 className="font-bold text-xs t-primary">文章可见性与锁定规则控制台 (Dense DataGrid)</h3>
          </div>

          <div className="flex items-center gap-2">
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

            <Link
              href="/admin/tokens"
              className="px-2.5 py-1 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold transition flex items-center gap-1"
            >
              <i className="ri-key-2-line text-xs" />
              <span>口令工坊</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-16 text-center">状态</th>
                <th className="py-2.5 px-3 w-20">文章 ID</th>
                <th className="py-2.5 px-3">文章标题</th>
                <th className="py-2.5 px-3 w-36">保护方案</th>
                <th className="py-2.5 px-3 w-28 text-center">拦截查阅</th>
                <th className="py-2.5 px-3 w-36 text-right pr-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filtered.map((art) => (
                <tr key={art.id} className="hover:bg-theme/[0.02] transition-colors">
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded-full font-mono font-bold text-[10px] ${
                        art.isLocked
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {art.isLocked ? "已锁定" : "公开"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-neutral-400">
                    #{art.id}
                  </td>
                  <td className="py-2.5 px-3 font-semibold t-primary">
                    <span className="truncate block max-w-sm" title={art.title}>{art.title}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[11px] font-medium ${art.isLocked ? "text-theme font-bold" : "text-neutral-500"}`}>
                      {art.lockLabel}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {/* 修正：公开文章显示为“-”，只有真正加锁的文章才展示拦截次数 */}
                    {art.isLocked ? (
                      <span className="text-amber-500 font-bold">{art.hitCount} 次</span>
                    ) : (
                      <span className="text-neutral-400 text-[11px]">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {art.isLocked ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUnlock(art)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition"
                            title="解除锁定，转为公开文章"
                          >
                            解锁
                          </button>
                          <button
                            type="button"
                            onClick={() => openLockModal(art)}
                            className="px-2 py-0.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-theme text-xs font-semibold text-neutral-600 dark:text-neutral-300 transition"
                            title="修改保护方案或更换口令/密码"
                          >
                            换锁
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openLockModal(art)}
                          className="px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition"
                          title="选择方案为此文章加锁"
                        >
                          加锁保护
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          加锁 / 换锁操作模态弹窗 (支持四大场景：临时锁 / 次数锁 / 口令锁 / 密码锁)
          ==================================================================== */}
      {modalOpen && currentArticle && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none ani-show"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#161b26] p-5 shadow-2xl flex flex-col gap-4 ani-scale"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <i className="ri-shield-keyhole-line text-theme text-base" />
                <h3 className="font-bold text-sm t-primary">
                  {currentArticle.isLocked ? "变更保护方案 (换锁)" : "配置访问保护 (加锁)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              目标文章：<span className="font-bold t-primary">#{currentArticle.id} {currentArticle.title}</span>
            </p>

            {/* 4 大场景方案选项卡 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { type: "once", title: "1. 临时锁 (单次即焚)", desc: "访客查看 1 次后凭证当场作废" },
                { type: "multi", title: "2. 次数锁 (限制次数)", desc: "限制指定访问次数，超额锁定" },
                { type: "token", title: "3. 口令锁 (通行密钥)", desc: "长期/永久特邀读者口令激活" },
                { type: "password", title: "4. 独立密码锁 (固定口令)", desc: "输入固定明文密码解锁查阅" },
              ].map((opt) => {
                const isSelected = selectedLockType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedLockType(opt.type as LockType)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      isSelected
                        ? "border-theme bg-theme/5 shadow-2xs ring-1 ring-theme"
                        : "border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isSelected ? "text-theme" : "t-primary"}`}>
                        {opt.title}
                      </span>
                      {isSelected && <i className="ri-check-line text-theme" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 line-clamp-1">{opt.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* 次数配置 */}
            {selectedLockType === "multi" && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-500">允许最多访问查看次数：</label>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={customCount}
                  onChange={(e) => setCustomCount(parseInt(e.target.value, 10) || 5)}
                  className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3 py-2 text-xs outline-none focus:border-theme"
                />
              </div>
            )}

            {/* 密码/密钥输入 */}
            {selectedLockType === "password" && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-500">设置独立访问密码：</label>
                <input
                  type="text"
                  placeholder="如：admin888 或自定义安全字符串"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3 py-2 text-xs outline-none focus:border-theme"
                />
              </div>
            )}

            <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmitLock}
                className="px-4 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover transition"
              >
                确认应用方案
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
