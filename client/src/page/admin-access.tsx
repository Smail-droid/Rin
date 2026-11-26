import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { client } from "../app/runtime";
import { getAuthToken } from "../utils/auth";
import { emitToast } from "../utils/toast";
import { Modal } from "@rin/ui";

export type LockMode = "public" | "password" | "token";

export interface RealArticleAccessRule {
  id: number;
  title: string;
  isLocked: boolean;
  lockMode: LockMode;
  lockTip?: string;
  hasPassword?: boolean;
}

export function AdminAccessPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "locked" | "public">("all");
  const [loading, setLoading] = useState(true);

  // 加锁/换锁交互弹窗状态
  const [modalOpen, setModalOpen] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<RealArticleAccessRule | null>(null);
  const [selectedLockMode, setSelectedLockMode] = useState<LockMode>("password");
  const [secretInput, setSecretInput] = useState<string>("");
  const [tipInput, setTipInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // 真实文章列表与其云端 D1 锁定状态
  const [articles, setArticles] = useState<RealArticleAccessRule[]>([]);
  const [savedArticleId, setSavedArticleId] = useState<number | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const markRowSaved = (articleId: number) => {
    setSavedArticleId(articleId);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      setSavedArticleId((curr) => (curr === articleId ? null : curr));
    }, 2200);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const token = getAuthToken() || "";
      const [feedsRes, permRes] = await Promise.all([
        client.feed.list({ limit: 100 }),
        fetch("/api/feed/permissions", {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
        }),
      ]);

      const permissions: Record<string, { mode: string; tip: string; hasPassword: boolean }> =
        permRes.ok ? await permRes.json().catch(() => ({})) : {};

      if (feedsRes.data?.data && Array.isArray(feedsRes.data.data)) {
        const merged: RealArticleAccessRule[] = feedsRes.data.data.map((f: any) => {
          const perm = permissions[String(f.id)];
          const isLocked = Boolean(perm && perm.mode && perm.mode !== "public");
          return {
            id: f.id,
            title: f.title || "无标题随想",
            isLocked,
            lockMode: (perm?.mode as LockMode) || "public",
            lockTip: perm?.tip || "",
            hasPassword: Boolean(perm?.hasPassword),
          };
        });
        setArticles(merged);
      }
    } catch (err: any) {
      showAlert(err.message || "加载文章权限数据异常");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // 1. 解锁文章 (直接切为完全公开并在 D1 物理清理锁)
  const handleUnlock = async (art: RealArticleAccessRule) => {
    try {
      const token = getAuthToken() || "";
      const res = await fetch(`/api/feed/permission/${art.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ mode: "public" }),
      });
      if (res.ok) {
        setArticles((prev) =>
          prev.map((a) => (a.id === art.id ? { ...a, isLocked: false, lockMode: "public", lockTip: "" } : a))
        );
        markRowSaved(art.id);
        emitToast(`已解除文章 #${art.id} 的访问锁定，恢复公开阅读`, "success");
      } else {
        showAlert("解除锁定失败，请检查鉴权凭证");
      }
    } catch {
      showAlert("网络异常，解除锁定失败");
    }
  };

  // 2. 打开加锁 / 换锁弹窗
  const openLockModal = async (art: RealArticleAccessRule) => {
    setCurrentArticle(art);
    setSelectedLockMode(art.isLocked ? art.lockMode : "password");
    setTipInput(art.lockTip || "");
    setSecretInput("");
    setModalOpen(true);

    // 从云端 D1 拉取最新已存密码
    try {
      const token = getAuthToken() || "";
      const res = await fetch(`/api/feed/permission/${art.id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedLockMode(data.mode || "password");
        setTipInput(data.tip || "");
        setSecretInput(data.password || "");
      }
    } catch {}
  };

  // 3. 提交加锁方案至服务端 D1
  const handleSubmitLock = async () => {
    if (!currentArticle) return;
    setIsSaving(true);
    try {
      const token = getAuthToken() || "";
      const res = await fetch(`/api/feed/permission/${currentArticle.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          mode: selectedLockMode,
          password: secretInput.trim(),
          tip: tipInput.trim(),
        }),
      });

      if (res.ok) {
        const isLocked = selectedLockMode !== "public";
        setArticles((prev) =>
          prev.map((a) =>
            a.id === currentArticle.id
              ? {
                  ...a,
                  isLocked,
                  lockMode: selectedLockMode,
                  lockTip: tipInput.trim(),
                  hasPassword: Boolean(secretInput.trim()),
                }
              : a
          )
        );
        setModalOpen(false);
        markRowSaved(currentArticle.id);
        emitToast(`文章 #${currentArticle.id} 权限锁定策略已保存并即时生效`, "success");
      } else {
        showAlert("保存策略失败，请检查登录凭据");
      }
    } catch (err: any) {
      showAlert(err.message || "请求异常");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (statusFilter === "locked" && !a.isLocked) return false;
      if (statusFilter === "public" && a.isLocked) return false;
      if (searchQuery.trim() && !a.title.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [articles, searchQuery, statusFilter]);

  const lockedCount = useMemo(() => articles.filter((a) => a.isLocked).length, [articles]);
  const publicCount = articles.length - lockedCount;

  return (
    <div className="flex w-full flex-col gap-4 ani-show select-none">
      <Helmet>
        <title>{`访问权限 · 文章隐私与锁定治理 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      {/* 顶部真实指标切片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-2xs flex items-center justify-between">
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

        <div className="p-3.5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[11px] font-mono text-neutral-400">已加密保护文章</span>
            </div>
            <span className="text-xl font-bold font-mono text-amber-500 mt-0.5 block">{lockedCount}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-bold">
            LOCKED
          </span>
        </div>

        <div className="p-3.5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-neutral-400 block">云端 D1 鉴权状态</span>
            <span className="text-sm font-bold font-mono text-emerald-500 mt-1 block">真强鉴权守护中</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme/10 text-theme font-mono font-bold">
            D1 ACTIVE
          </span>
        </div>
      </div>

      {/* 主体：文章可见性与锁定规则控制台超级表格 */}
      <div className="rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] overflow-hidden shadow-2xs">
        <div className="p-3.5 border-b border-[rgb(var(--rin-hairline-rgb)/0.7)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <i className="ri-shield-keyhole-line text-theme" />
            <h3 className="font-bold text-xs t-primary">文章可见性与权限控制台</h3>
            <div className="flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-0.5 text-[11px]">
              {[
                { id: "all" as const, label: `全部 (${articles.length})` },
                { id: "locked" as const, label: `已加锁 (${lockedCount})` },
                { id: "public" as const, label: `公开 (${publicCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-0.5 rounded-lg font-semibold transition cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-[rgb(var(--rin-surface-rgb))] text-theme shadow-2xs"
                      : "text-neutral-500 hover:text-[rgb(var(--rin-ink-rgb))]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="快速筛选文章..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rin-field w-44 sm:w-56 pl-7 pr-3 py-1"
              />
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-[rgb(var(--rin-hairline-rgb)/0.7)] bg-[rgb(var(--rin-surface-rgb))] select-none text-neutral-400 font-mono sticky top-0 z-10">
                <th className="py-2.5 px-3.5 w-16">ID</th>
                <th className="py-2.5 px-3">文章标题与直达</th>
                <th className="py-2.5 px-3 w-36">当前访问权限</th>
                <th className="py-2.5 px-3 w-48">提示说明</th>
                <th className="py-2.5 px-3 w-32 text-right pr-4">权限控制</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    <i className="ri-loader-4-line animate-spin text-lg" />
                    <span className="ml-2">正在从云端 D1 检验全站文章权限...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    未检索到符合条件的文章
                  </td>
                </tr>
              ) : (
                filtered.map((art) => (
                  <tr key={art.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition">
                    <td className="py-2.5 px-3.5 font-mono text-neutral-400">#{art.id}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold t-primary truncate max-w-[280px]" title={art.title}>
                          {art.title}
                        </span>
                        <a
                          href={`/feed/${art.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-400 hover:text-theme transition"
                          title="访问前台验证权限阻断"
                        >
                          <i className="ri-external-link-line text-xs" />
                        </a>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {art.isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <i className={art.lockMode === "token" ? "ri-key-2-line" : "ri-lock-2-line"} />
                          <span>{art.lockMode === "token" ? "口令通行证" : "独立密码锁"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <i className="ri-global-line" />
                          <span>公开访问</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 truncate max-w-[200px]">
                      {art.lockTip || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right pr-4">
                      <div className="inline-flex items-center gap-1.5">
                        {savedArticleId === art.id && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            ✓ 已保存
                          </span>
                        )}
                        {art.isLocked ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openLockModal(art)}
                              className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 hover:border-theme hover:text-theme text-[11px] font-semibold transition cursor-pointer"
                            >
                              修改密码
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnlock(art)}
                              className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold transition cursor-pointer"
                              title="解除访问锁定，恢复公开阅读"
                            >
                              解除锁定
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openLockModal(art)}
                            className="px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ml-auto"
                            title="为该文章设置查看密码"
                          >
                            <i className="ri-lock-2-line" />
                            <span>加锁</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 真实 D1 密码锁配置弹窗 (Modal) */}
      {modalOpen && currentArticle && (
        <Modal
          isOpen={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          contentLabel="文章密码锁定设置"
          panelClassName="p-5 max-w-md w-full bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <h4 className="font-bold text-sm t-primary flex items-center gap-1.5">
              <i className="ri-shield-keyhole-line text-theme" />
              <span>文章访问锁定 · #{currentArticle.id}</span>
            </h4>
            <button onClick={() => setModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { id: "public" as const, label: "公开访问", desc: "所有人均可畅读" },
              { id: "password" as const, label: "独立密码锁", desc: "指定密码解锁" },
              { id: "token" as const, label: "口令通行证", desc: "特约口令查阅" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedLockMode(m.id)}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                  selectedLockMode === m.id
                    ? "border-theme bg-theme/10 ring-1 ring-theme/30"
                    : "border-black/10 dark:border-white/10 hover:bg-black/5"
                }`}
              >
                <span className={`font-bold text-xs ${selectedLockMode === m.id ? "text-theme" : "t-primary"}`}>
                  {m.label}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1">{m.desc}</span>
              </button>
            ))}
          </div>

          {selectedLockMode !== "public" && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                  {selectedLockMode === "password" ? "设置查看密码" : "设置通行证口令"}
                </label>
                <input
                  type="text"
                  required
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder={selectedLockMode === "password" ? "输入此随想的阅读密码..." : "输入此随想的特约口令..."}
                  className="rin-field font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-500 mb-1">未解锁提示说明 (选填)</label>
                <input
                  type="text"
                  value={tipInput}
                  onChange={(e) => setTipInput(e.target.value)}
                  placeholder="如：本文为特约架构文档，需凭密码查阅。"
                  className="rin-field"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmitLock}
              disabled={isSaving || (selectedLockMode !== "public" && !secretInput.trim())}
              className="px-5 py-2 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "正在保存..." : "保存策略并在云端生效"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
