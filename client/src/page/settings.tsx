import { Modal } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "wouter";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog.tsx";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { applyThemeColor, applyThemeOpacity } from "../utils/theme-color";
import { AISummarySettings } from "./settings-ai";
import { SettingsAppearancePanel } from "./settings-appearance";
import { ItemImageInput, ItemWithUpload } from "./settings-items";
import {
  areSettingsDraftsEqual,
  buildAIConfigDraftValue,
  createSettingsConfigWrappers,
  importWordPressFile,
  loadSettingsConfigState,
  mergeSessionConfig,
  saveSettingsConfigState,
  type SettingsDraft,
  updateDraftConfig,
  uploadFavicon,
} from "./settings-helpers";

import "../utils/thumb.css";

const WEBHOOK_METHOD_OPTIONS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((value) => ({
  label: value,
  value,
}));

type SettingsCategory = "theme" | "general" | "services";

function resolveCategory(param: string | null): SettingsCategory {
  if (param === "services") return "services";
  if (param === "general") return "general";
  if (param === "theme" || param === "atelier") return "theme";
  return "theme";
}

export function Settings() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const initialCategoryParam = searchParams.get("tab");

  const [isOpen, setIsOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgList, setMsgList] = useState<{ title: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestMessage, setWebhookTestMessage] = useState("");
  const [draft, setDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [initialDraft, setInitialDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [hasStoredAiApiKey, setHasStoredAiApiKey] = useState(false);
  const ref = useRef(false);
  const initialDraftRef = useRef<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const { showAlert, AlertUI } = useAlert();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(() =>
    resolveCategory(initialCategoryParam)
  );

  // URL tab change synchronizer
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveCategory(resolveCategory(tabParam));
    }
  }, [searchParams]);

  function applyDraftThemePreview(nextDraft: SettingsDraft) {
    applyThemeColor(
      typeof nextDraft.clientConfig["theme.color"] === "string" ? nextDraft.clientConfig["theme.color"] : undefined,
      typeof nextDraft.clientConfig["theme.secondary_color"] === "string"
        ? nextDraft.clientConfig["theme.secondary_color"]
        : undefined,
      typeof nextDraft.clientConfig["theme.preset"] === "string" ? nextDraft.clientConfig["theme.preset"] : undefined
    );
    applyThemeOpacity(nextDraft.clientConfig["theme.opacity"]);
  }

  useEffect(() => {
    if (ref.current) return;
    loadSettingsConfigState()
      .then((state) => {
        setDraft(state.draft);
        setInitialDraft(state.draft);
        initialDraftRef.current = state.draft;
        setHasStoredAiApiKey(state.hasStoredAiApiKey);
        mergeSessionConfig(state.draft.clientConfig);
        applyDraftThemePreview(state.draft);
      })
      .catch((err: any) => {
        showAlert(t("settings.get_config_failed$message", { message: err.message }));
      })
      .finally(() => {
        setLoading(false);
      });
    ref.current = true;

    return () => {
      applyDraftThemePreview(initialDraftRef.current);
    };
  }, [showAlert, t]);

  const { clientConfig, serverConfig } = useMemo(() => createSettingsConfigWrappers(draft), [draft]);
  const aiValue = useMemo(() => buildAIConfigDraftValue(draft, hasStoredAiApiKey), [draft, hasStoredAiApiKey]);
  const hasUnsavedChanges = !areSettingsDraftsEqual(draft, initialDraft);

  function setConfigValue(type: "client" | "server", key: string, value: unknown) {
    setDraft((current) => updateDraftConfig(current, type, key, value));
  }

  function handleReset() {
    setDraft(initialDraft);
    applyDraftThemePreview(initialDraft);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const state = await saveSettingsConfigState(draft);
      setDraft(state.draft);
      setInitialDraft(state.draft);
      initialDraftRef.current = state.draft;
      setHasStoredAiApiKey(state.hasStoredAiApiKey || aiValue.apiKey.trim().length > 0);
      mergeSessionConfig(state.draft.clientConfig);
      window.dispatchEvent(new Event("rin:config-updated"));
      window.dispatchEvent(new Event("storage"));
      showAlert(t("settings.ai_summary.save_success"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showAlert(t("settings.update_failed$message", { message }));
    } finally {
      setSaving(false);
    }
  }

  async function handleFaviconChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFavicon(file, t, showAlert);
    }
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const { data, error } = await importWordPressFile(file);
      if (data) {
        setMsg(t("settings.import_success$success$skipped", { success: data.imported, skipped: 0 }));
        setMsgList([]);
        setIsOpen(true);
      } else if (error) {
        showAlert(t("settings.import_failed$message", { message: error.value }));
      }
    }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true);
    try {
      const { data, error } = await client.config.testWebhook({
        webhook_url: String(serverConfig.get("webhook_url") ?? ""),
        "webhook.method": String(serverConfig.get("webhook.method") ?? ""),
        "webhook.content_type": String(serverConfig.get("webhook.content_type") ?? ""),
        "webhook.headers": String(serverConfig.get("webhook.headers") ?? ""),
        "webhook.body_template": String(serverConfig.get("webhook.body_template") ?? ""),
        test_message: webhookTestMessage,
      });

      if (error || !data?.success) {
        const message = error?.value || data?.error || t("settings.webhook.test.failed");
        const details = data?.details ? `\n${data.details}` : "";
        showAlert(`${message}${details}`);
        return;
      }

      showAlert(t("settings.webhook.test.success"));
    } finally {
      setTestingWebhook(false);
    }
  }

  return (
    <div className="flex w-full flex-col">
      <Helmet>
        <title>{`${t("settings.title")} - ${siteConfig.name}`}</title>
      </Helmet>
      <main className="w-full max-w-5xl mx-auto rounded-3xl bg-w pb-36 px-2 sm:px-4" aria-label={t("main_content")}>
        <div className="flex flex-col items-start space-y-4 w-full">
          {(loading || saving) && <ReactLoading width="1em" height="1em" type="spin" color="#d6336c" />}

          {/* 顶部 3 大清晰分类（外观与版式 / 基础与安全 / 扩展与服务） */}
          <div className="flex w-full items-center justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {[
                { id: "theme" as const, label: "外观与版式", icon: "ri-palette-line" },
                { id: "general" as const, label: "基础与安全", icon: "ri-settings-4-line" },
                { id: "services" as const, label: "扩展与服务", icon: "ri-apps-2-line" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition select-none cursor-pointer ${
                    activeCategory === tab.id
                      ? "bg-theme text-white shadow-xs"
                      : "bg-black/5 hover:bg-black/10 text-neutral-600 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                  }`}
                >
                  <i className={`${tab.icon} text-sm`} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme transition shrink-0"
            >
              <i className="ri-external-link-line" />
              <span>查看前台效果</span>
            </Link>
          </div>

          {/* Tab 1: 外观与版式（分块直觉卡片，点击实时生效） */}
          {activeCategory === "theme" && (
            <SettingsAppearancePanel clientConfig={clientConfig} setConfigValue={setConfigValue} />
          )}

          {/* Tab 2: 基础与安全 */}
          {activeCategory === "general" && (
            <div className="w-full flex flex-col space-y-4 ani-show">
              {/* 切片 1: 站点基本身份工坊 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-user-smile-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">站点身份与展示规范</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold t-primary">{t("settings.site.name.title")}</label>
                      <span className="text-[10px] text-neutral-400 font-mono">site.name</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">{t("settings.site.name.desc")}</p>
                    <input
                      type="text"
                      value={String(clientConfig.get("site.name") ?? "")}
                      placeholder={String(clientConfig.default("site.name") ?? t("settings.site.name.label"))}
                      onChange={(e) => setConfigValue("client", "site.name", e.target.value)}
                      className="mt-1 rin-field"
                    />
                  </div>

                  <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold t-primary">{t("settings.site.page_size.title")}</label>
                      <span className="text-[10px] text-neutral-400 font-mono">site.page_size</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">{t("settings.site.page_size.desc")}</p>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={String(clientConfig.get("site.page_size") ?? "")}
                      placeholder={String(clientConfig.default("site.page_size") ?? "12")}
                      onChange={(e) => setConfigValue("client", "site.page_size", parseInt(e.target.value, 10) || 12)}
                      className="mt-1 rin-field font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold t-primary">{t("settings.site.description.title")}</label>
                    <span className="text-[10px] text-neutral-400 font-mono">site.description</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">{t("settings.site.description.desc")}</p>
                  <textarea
                    rows={2}
                    value={String(clientConfig.get("site.description") ?? "")}
                    placeholder={String(clientConfig.default("site.description") ?? t("settings.site.description.label"))}
                    onChange={(e) => setConfigValue("client", "site.description", e.target.value)}
                    className="mt-1 rin-field resize-none"
                  />
                </div>

                <ItemImageInput
                  title={t("settings.site.avatar.title")}
                  description={t("settings.site.avatar.desc")}
                  configKeyTitle={t("settings.site.avatar.label")}
                  value={String(clientConfig.get("site.avatar") ?? "")}
                  placeholder={String(clientConfig.default("site.avatar") ?? t("settings.site.avatar.label"))}
                  onChange={(value) => {
                    setConfigValue("client", "site.avatar", value);
                  }}
                  onError={showAlert}
                />
              </div>

              {/* 切片 2: 前台顶栏排布 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <i className="ri-layout-top-line text-theme text-base" />
                    <h3 className="text-sm font-bold t-primary">前台导航顶栏排布</h3>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="text-xs font-semibold t-primary">前台显示导航条</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false"}
                      onClick={() => {
                        const cur = clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false";
                        setConfigValue("client", "header.show_nav", !cur);
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false"
                          ? "bg-theme"
                          : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                          clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false"
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {[
                    {
                      id: "classic",
                      title: "经典自然居中顶栏",
                      desc: "居中舒展自然嵌入网页顶端，无悬浮遮挡",
                      icon: "ri-layout-top-line",
                    },
                    {
                      id: "compact",
                      title: "极简纯文本社论顶栏",
                      desc: "左标题右菜单，轻透杂志社论排版",
                      icon: "ri-font-sans-serif",
                    },
                  ].map((layout) => {
                    const currentLayout = String(clientConfig.get("header.layout") || "classic");
                    const isSelected = currentLayout === layout.id;
                    return (
                      <button
                        key={layout.id}
                        type="button"
                        onClick={() => {
                          setConfigValue("client", "header.position", "top");
                          setConfigValue("client", "header.layout", layout.id);
                        }}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? "border-theme bg-theme/[0.06] ring-1 ring-theme/25"
                            : "border-black/10 dark:border-white/10 hover:border-theme/40"
                        }`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-theme text-white" : "bg-black/5 dark:bg-white/10 text-neutral-500"}`}>
                          <i className={`${layout.icon} text-base`} />
                        </span>
                        <div className="min-w-0">
                          <div className={`font-bold text-xs ${isSelected ? "text-theme" : "t-primary"}`}>{layout.title}</div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{layout.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 切片 3: 全站核心功能开关矩阵 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-toggle-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">全站核心功能开关</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: "login.enabled", label: "开放访客登录", desc: "允许前台账户登录入口" },
                    { key: "comment.enabled", label: "留言板与文章评论", desc: "全站统一画廊留言体系" },
                    { key: "counter.enabled", label: "阅读计数器 (PV/UV)", desc: "文章独立访客与浏览统计" },
                    { key: "rss", label: "原生 RSS 订阅源", desc: "提供 /feed 和 /rss.xml" },
                    { key: "openlist.show_in_nav", label: "顶栏显示网盘入口", desc: "在导航栏增加 OpenList 入口" },
                  ].map((item) => {
                    const checked = clientConfig.getBoolean(item.key);
                    return (
                      <div key={item.key} className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-bold text-xs t-primary block truncate">{item.label}</span>
                          <span className="text-[11px] text-neutral-400 block truncate">{item.desc}</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={checked}
                          onClick={() => setConfigValue("client", item.key, !checked)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                            checked ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                            checked ? "translate-x-4.5" : "translate-x-1"
                          }`} />
                        </button>
                      </div>
                    );
                  })}

                  <div className="p-3.5 rounded-xl border border-theme/20 bg-theme/[0.04] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-theme block truncate">首页便签就地编辑</span>
                      <span className="text-[11px] text-neutral-400 block truncate">封面文字模式与拖拽排序</span>
                    </div>
                    <Link
                      href="/"
                      className="px-2.5 py-1 rounded-lg bg-theme text-white font-bold text-xs shadow-2xs hover:bg-theme-hover transition shrink-0"
                    >
                      前往首页 &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* 切片 4: 图标上传与页脚 HTML */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-code-box-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">站点图标 (Favicon) 与页脚自定义</h3>
                </div>

                <ItemWithUpload
                  title={t("settings.favicon.title")}
                  description={t("settings.favicon.desc")}
                  accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon"
                  onFileChange={handleFaviconChange}
                />

                <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold t-primary">{t("settings.footer.title")}</label>
                    <span className="text-[10px] text-neutral-400 font-mono">Footer HTML</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">{t("settings.footer.desc")}</p>
                  <textarea
                    rows={3}
                    value={String(clientConfig.get("footer") ?? "")}
                    placeholder="<div>Custom footer content, scripts, or badges...</div>"
                    onChange={(e) => setConfigValue("client", "footer", e.target.value)}
                    className="mt-1 rin-field font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: 扩展与服务 */}
          {activeCategory === "services" && (
            <div className="w-full flex flex-col space-y-4 ani-show">
              <AISummarySettings
                value={aiValue}
                onChange={(updates) => {
                  if (updates.enabled !== undefined) setConfigValue("server", "ai_summary.enabled", updates.enabled);
                  if (updates.provider !== undefined) setConfigValue("server", "ai_summary.provider", updates.provider);
                  if (updates.model !== undefined) setConfigValue("server", "ai_summary.model", updates.model);
                  if (updates.apiUrl !== undefined) setConfigValue("server", "ai_summary.api_url", updates.apiUrl);
                  if (updates.apiKey !== undefined) setConfigValue("server", "ai_summary.api_key", updates.apiKey);
                }}
              />

              {/* Webhook 外部通知广播 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 gap-2">
                  <div className="flex items-center gap-2">
                    <i className="ri-broadcast-line text-theme text-base" />
                    <h3 className="font-bold text-sm t-primary">{t("settings.webhook.title")}</h3>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      serverConfig.get("webhook_url") ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
                    }`}>
                      {serverConfig.get("webhook_url") ? "已配置" : "未启用"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">文章发布、友链申请与新评论实时外部 Webhook 推送</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 min-w-0 flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold t-primary">{t("settings.webhook.url.title")}</label>
                      <span className="text-[10px] text-neutral-400 font-mono">WEBHOOK_URL</span>
                    </div>
                    <input
                      type="text"
                      value={String(serverConfig.get("webhook_url") ?? "")}
                      placeholder="https://example.com/webhook"
                      onChange={(e) => setConfigValue("server", "webhook_url", e.target.value)}
                      className="mt-1 rin-field font-mono"
                    />
                  </div>

                  <div className="w-full sm:w-44 shrink-0 flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <label className="text-xs font-bold t-primary">{t("settings.webhook.method.title")}</label>
                    <select
                      value={String(serverConfig.get("webhook.method") ?? "POST")}
                      onChange={(e) => setConfigValue("server", "webhook.method", e.target.value)}
                      className="mt-1 rin-field font-bold cursor-pointer"
                    >
                      {WEBHOOK_METHOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <label className="text-xs font-bold t-primary">{t("settings.webhook.content_type.title")}</label>
                    <input
                      type="text"
                      value={String(serverConfig.get("webhook.content_type") ?? "")}
                      placeholder={String(serverConfig.default("webhook.content_type") ?? "application/json")}
                      onChange={(e) => setConfigValue("server", "webhook.content_type", e.target.value)}
                      className="mt-1 rin-field font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <label className="text-xs font-bold t-primary">{t("settings.webhook.headers.title")}</label>
                    <input
                      type="text"
                      value={String(serverConfig.get("webhook.headers") ?? "")}
                      placeholder={String(serverConfig.default("webhook.headers") ?? "{}")}
                      onChange={(e) => setConfigValue("server", "webhook.headers", e.target.value)}
                      className="mt-1 rin-field font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-bold t-primary">{t("settings.webhook.body_template.title")}</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {["${event}", "${title}", "${message}", "${url}", "${username}"].map((v) => (
                        <span
                          key={v}
                          onClick={() => {
                            const cur = String(serverConfig.get("webhook.body_template") ?? "");
                            setConfigValue("server", "webhook.body_template", cur + (cur ? " " : "") + v);
                          }}
                          className="cursor-pointer px-1.5 py-0.5 rounded-md bg-theme/10 hover:bg-theme/20 text-theme font-mono text-[10px] font-semibold transition"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={String(serverConfig.get("webhook.body_template") ?? "")}
                    placeholder={String(serverConfig.default("webhook.body_template") ?? '{"content":"{{message}}"}')}
                    onChange={(e) => setConfigValue("server", "webhook.body_template", e.target.value)}
                    className="mt-1 rin-field font-mono"
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="text"
                    value={webhookTestMessage}
                    placeholder={t("settings.webhook.test.placeholder")}
                    onChange={(e) => setWebhookTestMessage(e.target.value)}
                    className="rin-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook || !serverConfig.get("webhook_url")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition shrink-0"
                  >
                    <i className={testingWebhook ? "ri-loader-4-line animate-spin" : "ri-send-plane-fill"} />
                    <span>{testingWebhook ? t("settings.webhook.test.sending") : t("settings.webhook.test.button")}</span>
                  </button>
                </div>
              </div>

              {/* 友链巡检与申请治理 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-heart-pulse-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">{t("settings.friend.title")}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">{t("settings.friend.apply.title")}</span>
                      <span className="text-[11px] text-neutral-400 block truncate">{t("settings.friend.apply.desc")}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(clientConfig.get("friend_apply_enable"))}
                      onClick={() => setConfigValue("client", "friend_apply_enable", !clientConfig.get("friend_apply_enable"))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        clientConfig.get("friend_apply_enable") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                        clientConfig.get("friend_apply_enable") ? "translate-x-4.5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">{t("settings.friend.health.title")}</span>
                      <span className="text-[11px] text-neutral-400 block truncate">{t("settings.friend.health.desc")}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(serverConfig.get("friend_crontab"))}
                      onClick={() => setConfigValue("server", "friend_crontab", !serverConfig.get("friend_crontab"))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        serverConfig.get("friend_crontab") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                        serverConfig.get("friend_crontab") ? "translate-x-4.5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-2">
                    <span className="font-bold text-xs t-primary block truncate">{t("settings.friend.health.ua.title")}</span>
                    <input
                      type="text"
                      value={String(serverConfig.get("friend_ua") ?? "")}
                      placeholder={String(serverConfig.default("friend_ua") ?? "User-Agent")}
                      onChange={(e) => setConfigValue("server", "friend_ua", e.target.value)}
                      className="rin-field font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 边缘性能维护与数据迁移 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-tools-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">{t("settings.maintenance.title")}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs t-primary">{t("settings.cache.enabled.title")}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(clientConfig.getBoolean("cache.enabled"))}
                        onClick={() => setConfigValue("client", "cache.enabled", !clientConfig.getBoolean("cache.enabled"))}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                          clientConfig.getBoolean("cache.enabled") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                          clientConfig.getBoolean("cache.enabled") ? "translate-x-4.5" : "translate-x-1"
                        }`} />
                      </button>
                    </div>
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400 font-mono">强制刷新边缘节点</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await client.config.clearCache().then(({ error }) => {
                            if (error) {
                              showAlert(t("settings.cache.clear_failed$message", { message: error.value }));
                            } else {
                              showAlert("边缘 KV 缓存与预渲染结果已成功清空！");
                            }
                          });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white font-bold text-xs transition"
                      >
                        <i className="ri-delete-bin-line" />
                        <span>{t("clear")}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-3">
                    <div>
                      <span className="font-bold text-xs t-primary">{t("settings.wordpress.title")}</span>
                      <p className="text-[11px] text-neutral-400 mt-1">从 WordPress WXR .xml 导出文件导入文章与标签</p>
                    </div>
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400 font-mono">支持 50MB 以内 XML</span>
                      <ItemWithUpload title="" description="" accept="application/xml" onFileChange={onFileChange} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasUnsavedChanges && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 ani-show select-none pointer-events-auto">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-theme/30 shadow-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm animate-pulse">
                    <i className="ri-save-line" />
                  </span>
                  <div className="min-w-0 truncate">
                    <span className="font-bold text-xs t-primary block truncate">配置有未保存改动</span>
                    <span className="text-[10px] text-neutral-400 block truncate">点击保存立即写入边缘存储</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition cursor-pointer"
                  >
                    {t("reset")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="px-4 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {saving && <i className="ri-loader-4-line animate-spin text-xs" />}
                    <span>{saving ? "保存中..." : t("save")}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={isOpen}
        onRequestClose={() => setIsOpen(false)}
        contentLabel={t("settings.import_result")}
        panelClassName="p-6"
      >
        <div className="flex flex-col items-start">
          <h1 className="text-xl font-bold tracking-[-0.02em] t-primary">{t("settings.import_result")}</h1>
          <p className="mt-2 text-base t-primary">{msg}</p>
          <div className="flex w-full flex-col items-start">
            <p className="mt-4 text-base font-bold t-primary">{t("settings.import_skipped")}</p>
            <ul className="flex max-h-64 w-full flex-col items-start overflow-auto">
              {msgList.map((item, idx) => (
                <li key={idx} className="text-sm t-primary">
                  {t("settings.import_skipped_item$title$reason", { title: item.title, reason: item.reason })}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex w-full flex-col items-center">
            <button onClick={() => setIsOpen(false)} className="h-min rounded-xl bg-theme px-8 py-2 text-white">
              {t("close")}
            </button>
          </div>
        </div>
      </Modal>
      <AlertUI />
    </div>
  );
}
