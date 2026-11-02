import { useState } from "react";
import { Helmet } from "react-helmet";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

export function AdminAccessPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();

  // 模拟文章权限状态数据
  const [lockedArticles, setLockedArticles] = useState([
    { id: 1, title: "深度思考：个人画廊美学体系与技术选型", isLocked: true, lockType: "口令保护", hitCount: 28 },
    { id: 2, title: "Linux VPS 部署脚本箱与多节点管理经验", isLocked: false, lockType: "完全公开", hitCount: 142 },
    { id: 3, title: "边缘原生 Serverless 与 Cloudflare D1 读写优化", isLocked: true, lockType: "密码锁定", hitCount: 65 },
  ]);

  const toggleLock = (id: number) => {
    setLockedArticles(
      lockedArticles.map((art) => {
        if (art.id === id) {
          const next = !art.isLocked;
          return {
            ...art,
            isLocked: next,
            lockType: next ? "口令保护" : "完全公开",
          };
        }
        return art;
      })
    );
    showAlert("文章可见性锁状态已切换！");
  };

  return (
    <div className="flex w-full flex-col gap-6 ani-show select-none">
      <Helmet>
        <title>{`访问权限 · 文章隐私与锁定治理 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme/10 text-theme text-lg">
            <i className="ri-shield-keyhole-line" />
          </span>
          <div>
            <h2 className="text-base font-bold t-primary">文章访问权限治理</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              对私密或不想公开展示的特定文章进行加锁，访客需输入访问口令或密码方可查阅
            </p>
          </div>
        </div>

        {/* 模块化文章锁列表 */}
        <div className="mt-4 divide-y divide-black/5 dark:divide-white/5">
          {lockedArticles.map((art) => (
            <div key={art.id} className="py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-xs sm:text-sm t-primary block truncate">
                  {art.title}
                </span>
                <span className="text-[11px] text-neutral-400 font-mono mt-0.5 inline-block">
                  文章 ID: #{art.id} · 累计查阅拦截: {art.hitCount} 次
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                    art.isLocked
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {art.lockType}
                </span>

                <button
                  type="button"
                  onClick={() => toggleLock(art.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    art.isLocked
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-rose-500 text-white hover:bg-rose-600"
                  }`}
                >
                  {art.isLocked ? "解锁文章" : "锁定文章"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
