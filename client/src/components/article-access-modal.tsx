import { Modal, Spinner } from "@rin/ui";
import { useEffect, useState } from "react";
import { getAuthToken } from "../utils/auth";

export function ArticleAccessModal({
  feedId,
  feedTitle,
  isOpen,
  onClose,
  onPermissionUpdated,
}: {
  feedId: number | null;
  feedTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onPermissionUpdated?: (feedId: number, isLocked: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lockMode, setLockMode] = useState<"public" | "password">("password");
  const [password, setPassword] = useState("");
  const [tip, setTip] = useState("");
  const [isCurrentlyLocked, setIsCurrentlyLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !feedId) return;
    setLoading(true);
    setPassword("");
    setTip("");
    const token = getAuthToken() || "";
    fetch(`/api/feed/${feedId}/permission`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => r.json())
      .then((data: any) => {
        if (data && data.mode && data.mode !== "public") {
          setIsCurrentlyLocked(true);
          setLockMode(data.mode);
          setPassword(data.password || "");
          setTip(data.tip || "");
        } else {
          setIsCurrentlyLocked(false);
          setLockMode("public");
        }
      })
      .catch(() => {
        setIsCurrentlyLocked(false);
        setLockMode("public");
      })
      .finally(() => setLoading(false));
  }, [isOpen, feedId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = async () => {
    if (!feedId) return;
    if (lockMode === "password" && !password.trim()) {
      showToast("请输入密码锁的访问密码");
      return;
    }
    setSaving(true);
    try {
      const token = getAuthToken() || "";
      const res = await fetch(`/api/feed/${feedId}/permission`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: lockMode,
          password: password.trim(),
          tip: tip.trim(),
        }),
      });
      if (res.ok) {
        const locked = lockMode !== "public";
        setIsCurrentlyLocked(locked);
        onPermissionUpdated?.(feedId, locked);
        showToast(locked ? "✓ 文章已成功加锁保护！" : "✓ 已设为公开开放阅读！");
        setTimeout(() => onClose(), 800);
      } else {
        showToast("保存权限失败，请重试");
      }
    } catch {
      showToast("网络请求异常");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async () => {
    if (!feedId) return;
    setSaving(true);
    try {
      const token = getAuthToken() || "";
      const res = await fetch(`/api/feed/${feedId}/permission`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        setIsCurrentlyLocked(false);
        setLockMode("public");
        setPassword("");
        setTip("");
        onPermissionUpdated?.(feedId, false);
        showToast("✓ 已解除权限锁，文章恢复公开！");
        setTimeout(() => onClose(), 800);
      } else {
        showToast("解除加锁失败");
      }
    } catch {
      showToast("网络请求异常");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !feedId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel={`文章权限设置 · ${feedTitle}`}
      panelClassName="p-5 sm:p-6 max-w-md w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-2xl"
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl text-base shadow-2xs ${
                isCurrentlyLocked
                  ? "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
              }`}
            >
              <i className={isCurrentlyLocked ? "ri-lock-2-fill" : "ri-lock-unlock-line"} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold t-primary truncate">文章访问权限与密码锁</h3>
              <p className="text-[11px] text-neutral-400 font-mono truncate max-w-[260px]">
                #{feedId} {feedTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="p-2.5 rounded-xl bg-theme/10 text-theme border border-theme/20 font-bold text-center text-xs ani-show">
            {toast}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 权限模式切换 */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 block">
                选择访问防护级别
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLockMode("public")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer select-none ${
                    lockMode === "public"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs ring-1 ring-emerald-500/30"
                      : "border-black/10 dark:border-white/10 bg-black/[0.01] hover:bg-black/5 text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  <i className="ri-earth-line text-lg mb-1" />
                  <span className="text-xs">完全公开</span>
                  <span className="text-[10px] opacity-75">全网访客自由浏览</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLockMode("password")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer select-none ${
                    lockMode === "password"
                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-2xs ring-1 ring-amber-500/30"
                      : "border-black/10 dark:border-white/10 bg-black/[0.01] hover:bg-black/5 text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  <i className="ri-key-2-line text-lg mb-1" />
                  <span className="text-xs">专属密码锁</span>
                  <span className="text-[10px] opacity-75">输入密码后才可解锁</span>
                </button>
              </div>
            </div>

            {/* 密码锁参数 */}
            {lockMode === "password" && (
              <div className="p-3.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 space-y-3 ani-show">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center justify-between">
                    <span>访问查看密码 (必填)</span>
                    <span className="font-mono text-[10px] opacity-80">Key Protect</span>
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入解锁密码（如 80hou-vip）..."
                    className="w-full rounded-xl border border-amber-500/30 bg-white/80 dark:bg-neutral-900/80 px-3 py-1.5 text-xs t-primary outline-hidden focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center justify-between">
                    <span>访客加锁提示说明 (选填)</span>
                    <span className="text-[10px] opacity-80">Hint Tip</span>
                  </label>
                  <input
                    type="text"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    placeholder="例如：输入公众号暗号获取、或特定社群通行证..."
                    className="w-full rounded-xl border border-amber-500/30 bg-white/80 dark:bg-neutral-900/80 px-3 py-1.5 text-xs t-primary outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* 状态指示说明 */}
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5 px-1">
              <i className="ri-shield-check-line text-theme text-sm" />
              <span>由边缘 Cloudflare D1 权限中心强校验保护，防泄露</span>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
              {isCurrentlyLocked ? (
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold transition cursor-pointer"
                >
                  解除密码锁
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 font-semibold transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition cursor-pointer flex items-center gap-1"
                >
                  {saving && <i className="ri-loader-4-line animate-spin text-xs" />}
                  <span>{saving ? "保存中..." : "保存权限"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
