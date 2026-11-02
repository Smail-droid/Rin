import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

export function AdminOpenListPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const [saving, setSaving] = useState(false);

  // OpenList 挂载配置
  const [workerUrl, setWorkerUrl] = useState("");
  const [showInNav, setShowInNav] = useState(false);
  const [navTitle, setNavTitle] = useState("资源列表");

  useEffect(() => {
    // 读取已存储的 openlist 配置
    const url = (siteConfig as any).openlistWorkerUrl || "";
    const inNav = (siteConfig as any).openlistShowInNav ?? false;
    const title = (siteConfig as any).openlistNavTitle || "资源列表";
    setWorkerUrl(url);
    setShowInNav(inNav);
    setNavTitle(title);
  }, [siteConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.config.update("client", {
        "openlist.worker_url": workerUrl.trim(),
        "openlist.show_in_nav": showInNav ? "true" : "false",
        "openlist.nav_title": navTitle.trim() || "资源列表",
      });
      showAlert("✨ OpenList Worker 配置已保存！若开启前台显示，刷新后前台导航即可访问。");
    } catch (err: any) {
      showAlert(`保存失败: ${err.message || "网络异常"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 ani-show select-none">
      <Helmet>
        <title>{`资源列表 · OpenList Worker 挂载 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

      {/* 模块介绍卡片 */}
      <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme/10 text-theme text-lg">
            <i className="ri-hard-drive-2-line" />
          </span>
          <div>
            <h2 className="text-base font-bold t-primary">OpenList 边缘存储资源目录</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              参考官方 doc.oplist.org.cn/guide/installation/worker 部署的 Cloudflare Worker 目录索引
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-theme">
              OpenList Worker 部署地址 (URL)
            </label>
            <input
              type="url"
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
              placeholder="https://your-openlist.yourname.workers.dev"
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] p-2.5 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-white/[0.03]"
            />
            <span className="text-[10px] text-neutral-400">
              你在 Cloudflare 上部署的 OpenList Worker 完整访问 URL
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-theme">
              前台导航栏显示名称
            </label>
            <input
              type="text"
              value={navTitle}
              onChange={(e) => setNavTitle(e.target.value)}
              placeholder="资源列表 / 知识仓库"
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] p-2.5 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-white/[0.03]"
            />
            <span className="text-[10px] text-neutral-400">
              在前台顶栏导航显示的汉字名称（如：资源、网盘、相册等）
            </span>
          </div>
        </div>

        {/* 前台导航栏开关 */}
        <div className="mt-5 flex items-center justify-between p-3.5 rounded-xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.015]">
          <div>
            <span className="text-xs font-bold t-primary block">是否在前台导航栏显示入口</span>
            <span className="text-[11px] text-neutral-400">
              开启后，前台顶栏导航将自动挂载该链接，访客点击可无缝浏览资源文件
            </span>
          </div>
          <input
            type="checkbox"
            checked={showInNav}
            onChange={(e) => setShowInNav(e.target.checked)}
            className="h-4 w-4 rounded accent-theme cursor-pointer"
          />
        </div>

        {/* 底部保存与测试 */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-md hover:bg-theme-hover active:scale-95 transition disabled:opacity-50"
          >
            {saving ? "正在保存..." : "保存配置"}
          </button>

          {workerUrl && (
            <a
              href={workerUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl border border-black/10 bg-w text-xs font-semibold t-primary hover:border-theme hover:text-theme transition dark:border-white/10 inline-flex items-center gap-1.5"
            >
              <i className="ri-external-link-line" />
              <span>在新标签页测试访问 OpenList</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
