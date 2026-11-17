import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { client } from "../../app/runtime";
import { useAlert } from "../dialog";

export function InSituSettingsDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showAlert, AlertUI } = useAlert();
  const [activeTab, setActiveTab] = useState<"site" | "media" | "security" | "feature">("site");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Client & Server configs
  const [clientConfig, setClientConfig] = useState<Record<string, any>>({});
  const [serverConfig, setServerConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.allSettled([client.config.get("client"), client.config.get("server")])
      .then(([cRes, sRes]) => {
        if (cRes.status === "fulfilled" && cRes.value.data) {
          setClientConfig(cRes.value.data as any);
        }
        if (sRes.status === "fulfilled" && sRes.value.data) {
          setServerConfig(sRes.value.data as any);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSaveClientField = async (key: string, value: any) => {
    setSaving(true);
    try {
      await client.config.update("client", { [key]: value });
      setClientConfig((p) => ({ ...p, [key]: value }));
      window.dispatchEvent(new Event("rin:config-updated"));
      showAlert("配置项已即时更新保存！");
    } catch (err: any) {
      showAlert(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveServerField = async (key: string, value: any) => {
    setSaving(true);
    try {
      await client.config.update("server", { [key]: value });
      setServerConfig((p) => ({ ...p, [key]: value }));
      showAlert("服务端安全配置已即时更新保存！");
    } catch (err: any) {
      showAlert(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed top-0 bottom-0 right-0 z-50 w-full sm:w-[88vw] md:w-[700px] lg:w-[820px] bg-white dark:bg-[#12161f] shadow-2xl border-l border-black/10 dark:border-white/10 flex flex-col transition-transform duration-300 ease-out select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5 dark:border-white/5 bg-neutral-50/60 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base">
              <i className="ri-settings-4-line" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold t-primary">百宝箱 · 全站系统设置</h2>
                {saving && <span className="text-[10px] text-theme font-mono font-bold animate-pulse">保存中...</span>}
              </div>
              <p className="text-[10px] text-neutral-400">
                原地微调系统环境、API 与功能开关，调完即走
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="px-5 py-2.5 border-b border-black/5 dark:border-white/5 flex items-center gap-1.5 shrink-0 bg-white/80 dark:bg-[#12161f]/80 overflow-x-auto">
          {[
            { id: "site", label: "站点身份", icon: "ri-user-smile-line" },
            { id: "feature", label: "功能特性", icon: "ri-toggle-line" },
            { id: "media", label: "存储与API", icon: "ri-hard-drive-2-line" },
            { id: "security", label: "系统安全", icon: "ri-shield-keyhole-line" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-theme text-white shadow-2xs"
                  : "bg-black/[0.03] dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <i className={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-neutral-400">
              <i className="ri-loader-4-line animate-spin text-xl text-theme mr-2" />
              <span>正在读取全站配置...</span>
            </div>
          ) : activeTab === "site" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-neutral-50/60 dark:bg-white/[0.02] space-y-3">
                <span className="font-bold text-xs t-primary block border-b border-black/5 dark:border-white/5 pb-2">
                  基本身份标识
                </span>

                <div className="space-y-1">
                  <label className="text-neutral-500 font-medium">站点名称</label>
                  <input
                    type="text"
                    defaultValue={clientConfig["site.name"] || ""}
                    onBlur={(e) => handleSaveClientField("site.name", e.target.value.trim())}
                    className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs font-bold outline-none focus:border-theme"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-500 font-medium">头像链接 (Avatar URL)</label>
                  <input
                    type="text"
                    defaultValue={clientConfig["site.avatar"] || ""}
                    onBlur={(e) => handleSaveClientField("site.avatar", e.target.value.trim())}
                    placeholder="https://..."
                    className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs font-mono outline-none focus:border-theme"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-500 font-medium">站点副标题 / 简介描述</label>
                  <textarea
                    rows={2}
                    defaultValue={clientConfig["site.description"] || ""}
                    onBlur={(e) => handleSaveClientField("site.description", e.target.value.trim())}
                    className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs outline-none focus:border-theme"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-neutral-500 font-medium">分页文章数量 (Page Size)</label>
                  <input
                    type="number"
                    min="3"
                    max="50"
                    defaultValue={clientConfig["site.page_size"] || 5}
                    onBlur={(e) => handleSaveClientField("site.page_size", Number.parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs font-mono outline-none focus:border-theme"
                  />
                </div>
              </div>
            </div>
          ) : activeTab === "feature" ? (
            <div className="space-y-3">
              {[
                { key: "comment.enabled", label: "评论留言系统", desc: "允许访客在文章底部留言交流" },
                { key: "friend_apply_enable", label: "开放星标友链自助申请", desc: "访客可在星廊提交加入申请" },
                { key: "counter.enabled", label: "全站访问统计计数器 (PV/UV)", desc: "记录并展示页面浏览次数" },
                { key: "openlist.show_in_nav", label: "在导航条显示网盘链接", desc: "顶栏增加 OpenList 多源目录跳转" },
              ].map((item) => {
                const checked = clientConfig[item.key] !== false && clientConfig[item.key] !== "false";
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-neutral-50/60 dark:bg-white/[0.02]"
                  >
                    <div>
                      <p className="font-bold text-xs t-primary">{item.label}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      onClick={() => handleSaveClientField(item.key, !checked)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        checked ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                          checked ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : activeTab === "media" ? (
            <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-neutral-50/60 dark:bg-white/[0.02] space-y-3">
              <span className="font-bold text-xs t-primary block border-b border-black/5 dark:border-white/5 pb-2">
                OpenList 网盘多源目录挂载
              </span>
              <div className="space-y-1">
                <label className="text-neutral-500 font-medium">OpenList Worker 边缘代理 URL</label>
                <input
                  type="text"
                  defaultValue={clientConfig["openlist.worker_url"] || ""}
                  onBlur={(e) => handleSaveClientField("openlist.worker_url", e.target.value.trim())}
                  placeholder="https://openList.yourdomain.workers.dev"
                  className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs font-mono outline-none focus:border-theme"
                />
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-neutral-500 font-medium">图床对外直传专属 API Token</label>
                <input
                  type="text"
                  defaultValue={serverConfig["storage.api_token"] || "sk-7dd8-18e341d3b1c51710"}
                  onBlur={(e) => handleSaveServerField("storage.api_token", e.target.value.trim())}
                  className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w dark:bg-neutral-800 text-xs font-mono outline-none focus:border-theme"
                />
                <p className="text-[10px] text-neutral-400">
                  用于 Typora、PicGo 等外部写作工具直接免登录向 R2 桶上传插图
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-neutral-50/60 dark:bg-white/[0.02] space-y-3">
              <span className="font-bold text-xs t-primary block border-b border-black/5 dark:border-white/5 pb-2">
                系统通行证与安全策略
              </span>

              <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
                <div>
                  <p className="font-bold text-xs t-primary">开放前台账号登录</p>
                  <p className="text-[10px] text-neutral-400">关闭后仅保留管理员密钥登录</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={clientConfig["login.enabled"] !== false}
                  onClick={() => handleSaveClientField("login.enabled", clientConfig["login.enabled"] === false)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                    clientConfig["login.enabled"] !== false ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                      clientConfig["login.enabled"] !== false ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
                <div>
                  <p className="font-bold text-xs t-primary">友链申请自动免审通过</p>
                  <p className="text-[10px] text-neutral-400">开启后探针通过即可自动入驻星廊</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={serverConfig["friend_apply_auto_accept"] === true}
                  onClick={() => handleSaveServerField("friend_apply_auto_accept", serverConfig["friend_apply_auto_accept"] !== true)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                    serverConfig["friend_apply_auto_accept"] === true ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                      serverConfig["friend_apply_auto_accept"] === true ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertUI />
    </>,
    document.body
  );
}
