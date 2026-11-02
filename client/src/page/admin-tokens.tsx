import { useState } from "react";
import { Helmet } from "react-helmet";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

interface AccessTokenItem {
  id: string;
  code: string;
  type: "once" | "multi" | "permanent";
  allowedCount: number;
  usedCount: number;
  scope: string;
  createdAt: string;
  expiresAt: string; // ISO 格式或 "never"
  remark?: string;
}

const DEFAULT_INITIAL_TOKENS: AccessTokenItem[] = [
  {
    id: "tok_1",
    code: "RIN-ONCE-8848-A9F2",
    type: "once",
    allowedCount: 1,
    usedCount: 0,
    scope: "深度架构全景研析笔记",
    createdAt: new Date().toLocaleDateString(),
    expiresAt: new Date(Date.now() + 86400000 * 3).toLocaleDateString(),
    remark: "特邀读者单次阅后即焚",
  },
  {
    id: "tok_2",
    code: "RIN-PERM-VIP2026-X7K1",
    type: "permanent",
    allowedCount: 9999,
    usedCount: 42,
    scope: "全站私密画廊与专栏",
    createdAt: new Date().toLocaleDateString(),
    expiresAt: "永久有效",
    remark: "长期特约读者专属通行证",
  },
];

export function AdminTokensPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();

  // 从本地持久化存储加载通行证数据，避免刷新丢失
  const [tokens, setTokens] = useState<AccessTokenItem[]>(() => {
    try {
      const saved = localStorage.getItem("rin_admin_access_tokens");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_INITIAL_TOKENS;
  });

  // 保存数据至 localStorage
  const saveTokens = (next: AccessTokenItem[]) => {
    setTokens(next);
    try {
      localStorage.setItem("rin_admin_access_tokens", JSON.stringify(next));
    } catch {}
  };

  // 新建口令表单状态
  const [newCodeType, setNewCodeType] = useState<"once" | "multi" | "permanent">("once");
  const [customAllowedCount, setCustomAllowedCount] = useState<number>(5);
  const [expiryOption, setExpiryOption] = useState<string>("7d");
  const [codePrefix, setCodePrefix] = useState("PASS");
  const [codeScope, setCodeScope] = useState("全站锁定文章");
  const [codeRemark, setCodeRemark] = useState("");

  const handleGenerate = () => {
    // 使用密码学安全的随机数，杜绝猜测与撞库攻击
    const randomBytes = new Uint8Array(4);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 4; i++) randomBytes[i] = Math.floor(Math.random() * 256);
    }
    const secureRandomStr = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join("");

    const prefix = (codePrefix.trim() || "PASS").toUpperCase();
    const typeTag = newCodeType.toUpperCase();
    const generatedCode = `RIN-${prefix}-${typeTag}-${secureRandomStr}`;

    let expiresAtStr = "永久有效";
    if (expiryOption === "24h") {
      expiresAtStr = new Date(Date.now() + 86400000).toLocaleDateString();
    } else if (expiryOption === "7d") {
      expiresAtStr = new Date(Date.now() + 86400000 * 7).toLocaleDateString();
    } else if (expiryOption === "30d") {
      expiresAtStr = new Date(Date.now() + 86400000 * 30).toLocaleDateString();
    }

    const newItem: AccessTokenItem = {
      id: `tok_${Date.now()}_${secureRandomStr.slice(0, 4)}`,
      code: generatedCode,
      type: newCodeType,
      allowedCount: newCodeType === "once" ? 1 : newCodeType === "permanent" ? 9999 : Math.max(1, customAllowedCount),
      usedCount: 0,
      scope: codeScope.trim() || "全站锁定内容",
      createdAt: new Date().toLocaleDateString(),
      expiresAt: expiresAtStr,
      remark: codeRemark.trim() || (newCodeType === "once" ? "单次即焚口令" : "分享通行证"),
    };

    const nextList = [newItem, ...tokens];
    saveTokens(nextList);
    showAlert(`🎉 口令通行证生成成功！已复制到剪贴板：\n${generatedCode}`);
    try {
      void navigator.clipboard.writeText(generatedCode);
    } catch {}
  };

  const handleDelete = (id: string) => {
    showConfirm("作废口令确认", "确定要作废并删除该访问口令吗？删除后持有者将无法再通过此口令解锁文章。", () => {
      const nextList = tokens.filter((t) => t.id !== id);
      saveTokens(nextList);
      showAlert("口令已作废。");
    });
  };

  return (
    <div className="flex w-full flex-col gap-6 ani-show select-none">
      <Helmet>
        <title>{`口令生成 · 场景化访问通行证 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />
      <ConfirmUI />

      {/* 顶部场景规则配置与生成器 */}
      <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme/10 text-theme text-lg">
            <i className="ri-key-2-line" />
          </span>
          <div>
            <h2 className="text-base font-bold t-primary">口令通行证生成工坊</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              支持按生活与分享场景生成：临时查看单次即焚、固定次数分享、永久解锁激活码
            </p>
          </div>
        </div>

        {/* 表单切片 */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">1. 口令使用规则</label>
            <select
              value={newCodeType}
              onChange={(e: any) => setNewCodeType(e.target.value)}
              className="rounded-xl border border-black/10 bg-w p-2 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800 transition"
            >
              <option value="once" className="bg-white text-neutral-900 dark:bg-neutral-850 dark:text-neutral-100 py-1.5">
                临时查看（访问 1 次后即焚失效）
              </option>
              <option value="multi" className="bg-white text-neutral-900 dark:bg-neutral-850 dark:text-neutral-100 py-1.5">
                限次查看（允许访问指定次数）
              </option>
              <option value="permanent" className="bg-white text-neutral-900 dark:bg-neutral-850 dark:text-neutral-100 py-1.5">
                永久查看（激活后永久有效）
              </option>
            </select>
          </div>

          {newCodeType === "multi" ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-theme">最大查看次数</label>
              <input
                type="number"
                min={2}
                max={500}
                value={customAllowedCount}
                onChange={(e) => setCustomAllowedCount(parseInt(e.target.value, 10) || 5)}
                className="rounded-xl border border-black/10 bg-w p-2 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-theme">有效有效期限</label>
              <select
                value={expiryOption}
                onChange={(e) => setExpiryOption(e.target.value)}
                className="rounded-xl border border-black/10 bg-w p-2 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800 transition"
              >
                <option value="24h" className="bg-white text-neutral-900 dark:bg-neutral-850 dark:text-neutral-100 py-1.5">
                  24 小时内有效
                </option>
                <option value="7d" className="bg-white text-neutral-900 dark:bg-neutral-850 dark:text-neutral-100 py-1.5">
                  7 天内有效
                </option>
                <option value="30d" className="bg-white text-neutral-900 dark:bg-neutral-850 dark:text-neutral-100 py-1.5">
                  30 天内有效
                </option>
                <option value="never" className="bg-white text-neutral-900 dark:bg-neutral-850 dark:text-neutral-100 py-1.5">
                  永久有效 (不过期)
                </option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">2. 口令前缀标识</label>
            <input
              type="text"
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value)}
              placeholder="PASS / VIP / SHARE"
              className="rounded-xl border border-black/10 bg-w p-2 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">3. 适用授权范围</label>
            <input
              type="text"
              value={codeScope}
              onChange={(e) => setCodeScope(e.target.value)}
              placeholder="全站锁定文章 / 特定文章"
              className="rounded-xl border border-black/10 bg-w p-2 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">4. 用途备注说明</label>
            <input
              type="text"
              value={codeRemark}
              onChange={(e) => setCodeRemark(e.target.value)}
              placeholder="如：发给张三交流用"
              className="rounded-xl border border-black/10 bg-w p-2 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-neutral-800"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-theme text-white text-xs font-bold shadow-md hover:bg-theme-hover active:scale-95 transition"
          >
            <i className="ri-magic-line text-sm" />
            <span>立即生成场景口令通行证</span>
          </button>
        </div>
      </div>

      {/* 已生成口令超级表格 */}
      <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider t-primary">
            已生效口令列表 ({tokens.length})
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            支持一键复制给朋友解锁特定内容
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-400 font-mono">
                <th className="py-3 px-4">口令通行密钥 (Code)</th>
                <th className="py-3 px-3">规则模式</th>
                <th className="py-3 px-3 text-center">状态</th>
                <th className="py-3 px-3 text-center">使用次数</th>
                <th className="py-3 px-3">授权范围</th>
                <th className="py-3 px-3">有效截止</th>
                <th className="py-3 px-3">备注</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 t-primary">
              {tokens.map((t) => {
                const isExhausted = t.type !== "permanent" && t.usedCount >= t.allowedCount;
                return (
                  <tr key={t.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-theme">
                      {t.code}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          t.type === "once"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : t.type === "multi"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {t.type === "once" ? "单次即焚" : t.type === "multi" ? `限次 (${t.allowedCount}次)` : "永久通行"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isExhausted
                          ? "bg-neutral-500/10 text-neutral-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {isExhausted ? "已耗尽即焚" : "正常有效"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-neutral-400">
                      {t.usedCount} / {t.allowedCount}
                    </td>
                    <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                      {t.scope}
                    </td>
                    <td className="py-3 px-3 text-neutral-400 font-mono text-[11px]">
                      {t.expiresAt}
                    </td>
                    <td className="py-3 px-3 text-neutral-400 text-[11px]">
                      {t.remark}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(t.code);
                            showAlert("口令已成功复制到剪贴板！");
                          }}
                          className="px-2 py-1 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 font-semibold text-[11px] transition"
                        >
                          复制
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-rose-500 transition text-sm"
                          title="作废删除"
                        >
                          <i className="ri-delete-bin-line" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
