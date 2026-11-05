import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";

export function AdminOpenListPage() {
  const siteConfig = useSiteConfig();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // OpenList 挂载配置
  const [workerUrl, setWorkerUrl] = useState(() => siteConfig.openlistWorkerUrl || "");
  const [showInNav, setShowInNav] = useState(() => siteConfig.openlistShowInNav ?? false);
  const [navTitle, setNavTitle] = useState(() => siteConfig.openlistNavTitle || "资源列表");

  // 仅在基本类型配置真正变更时同步，避免对象引用引发每字输入重置
  useEffect(() => {
    setWorkerUrl(siteConfig.openlistWorkerUrl || "");
    setShowInNav(siteConfig.openlistShowInNav ?? false);
    setNavTitle(siteConfig.openlistNavTitle || "资源列表");
  }, [
    siteConfig.openlistWorkerUrl,
    siteConfig.openlistShowInNav,
    siteConfig.openlistNavTitle,
  ]);

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMessage("");
    try {
      await client.config.update("client", {
        "openlist.worker_url": workerUrl.trim(),
        "openlist.show_in_nav": showInNav ? "true" : "false",
        "openlist.nav_title": navTitle.trim() || "资源列表",
      });
      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2500);
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.message || "网络异常");
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show">
      <Helmet>
        <title>{`资源列表 · OpenList 挂载中心 - ${siteConfig.name}`}</title>
      </Helmet>

      {/* 顶部运行状态切片中枢 */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-theme/10 text-theme text-2xl shadow-2xs">
            <i className="ri-hard-drive-2-line" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold t-primary">OpenList 边缘存储资源目录挂载</h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                workerUrl ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
              }`}>
                {workerUrl ? "已绑定 Worker" : "未挂载"}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              基于 doc.oplist.org.cn 规范的 Cloudflare Worker 网盘聚合与文件目录多源索引
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {errorMessage && (
            <span className="text-xs text-rose-500 font-semibold ani-show">
              {errorMessage}
            </span>
          )}
          {workerUrl && (
            <a
              href={workerUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl border border-black/10 bg-w hover:border-theme text-xs font-semibold t-primary transition flex items-center gap-1 shadow-2xs dark:border-white/10"
            >
              <i className="ri-external-link-line text-theme" />
              <span>测试访问网盘</span>
            </a>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60 ${
              saveStatus === "saved"
                ? "bg-emerald-500 text-white shadow-emerald-500/20"
                : saveStatus === "error"
                ? "bg-rose-500 text-white"
                : "bg-theme text-white hover:bg-theme-hover"
            }`}
          >
            {saveStatus === "saving" && <i className="ri-loader-4-line animate-spin" />}
            {saveStatus === "saved" && <i className="ri-check-line" />}
            <span>
              {saveStatus === "saving"
                ? "保存中..."
                : saveStatus === "saved"
                ? "配置已保存 ✓"
                : saveStatus === "error"
                ? "保存失败，点击重试"
                : "保存配置"}
            </span>
          </button>
        </div>
      </div>

      {/* 模块化配置切片 (2 列网格排布) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
          <i className="ri-settings-4-line text-theme" />
          <h3 className="font-bold text-xs t-primary">核心端点与导航栏展示参数</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">
              OpenList Worker 部署端点 (URL)
            </label>
            <input
              type="url"
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
              placeholder="https://your-openlist.workers.dev"
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3.5 py-2.5 text-xs font-mono t-primary outline-none focus:border-theme focus:ring-1 focus:ring-theme/30 transition select-text"
            />
            <span className="text-[10px] text-neutral-400 block">
              填写在 Cloudflare Workers 上独立部署的 OpenList 路由完整访问地址
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">
              前台顶栏导航显示名称
            </label>
            <input
              type="text"
              value={navTitle}
              onChange={(e) => setNavTitle(e.target.value)}
              placeholder="资源列表 / 资源仓库 / 知识库"
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3.5 py-2.5 text-xs t-primary outline-none focus:border-theme focus:ring-1 focus:ring-theme/30 transition select-text"
            />
            <span className="text-[10px] text-neutral-400 block">
              在前台顶栏导航显示的汉字名称（如：资源、网盘、文件库等）
            </span>
          </div>
        </div>

        {/* 前台导航栏显示开关切片 */}
        <div className="p-3.5 rounded-xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02] flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold t-primary block">在前台顶栏导航挂载入口</span>
            <span className="text-[11px] text-neutral-400 block mt-0.5">
              开启后，全站顶部导航将自动增加该链接入口，读者点击可无缝浏览并下载外链资源
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showInNav}
            onClick={() => setShowInNav(!showInNav)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
              showInNav ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
              showInNav ? "translate-x-4.5" : "translate-x-1"
            }`} />
          </button>
        </div>
      </div>

      {/* 官方文档与 Cloudflare Workers 分离式部署指引卡片 */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
          <i className="ri-book-read-line text-theme" />
          <h3 className="font-bold text-xs t-primary">OpenList 官方文档与部署指南</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <a
            href="https://doc.oplist.org/"
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col justify-between p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] hover:border-theme/40 hover:bg-theme/[0.03] transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 font-bold t-primary text-xs group-hover:text-theme transition">
                  <i className="ri-book-2-line text-theme" />
                  <span>OpenList 官方全功能文档</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-neutral-400">
                  DOCS
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                查阅 OpenList 网盘系统架构、多驱动存储接入指南、账号权限控制及高级设置手册。
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] text-theme font-semibold">
              <span>https://doc.oplist.org</span>
              <i className="ri-arrow-right-up-line text-xs" />
            </div>
          </a>

          <a
            href="https://doc.oplist.org/ecosystem/official_worker/guide_cfw"
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col justify-between p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] hover:border-theme/40 hover:bg-theme/[0.03] transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 font-bold t-primary text-xs group-hover:text-theme transition">
                  <i className="ri-cloud-line text-amber-500" />
                  <span>Deploy to Cloudflare Workers 分离式指南</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  SERVERLESS
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                学习如何将 OpenList 作为独立 Serverless Worker 部署在 Cloudflare 边缘端并绑定 KV/D1 与 Google Drive。
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              <span>查看 CF Worker 分离部署指南</span>
              <i className="ri-arrow-right-up-line text-xs" />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
