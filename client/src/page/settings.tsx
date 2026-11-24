import { Modal } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "wouter";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog.tsx";
import { type HeaderLayoutOption, normalizeHeaderLayout } from "../components/site-header/layout-options";
import { useSiteConfig } from "../hooks/useSiteConfig";
import {
  applyGalleryTiltDegree,
  applyThemeColor,
  applyThemeCustomCursor,
  applyThemeFontFamily,
  applyThemeFontSize,
  applyThemeOpacity,
  applyThemeTitleEffect,
  applyThemeTitleFont,
  applyThemeWallpaper,
} from "../utils/theme-color";
import { emitToast } from "../utils/toast";
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
type PageHeaderModeOption = "clean" | "banner" | "hidden";

function resolveCategory(param: string | null): SettingsCategory {
  if (param === "services") return "services";
  if (param === "general") return "general";
  if (param === "theme" || param === "atelier") return "theme";
  return "theme";
}

function HeaderLayoutThumb({ layout }: { layout: HeaderLayoutOption }) {
  if (layout === "dock") {
    return (
      <div className="h-11 w-full rounded-xl bg-neutral-100 dark:bg-white/[0.04] px-2 flex items-center justify-between gap-1.5">
        <div className="h-5 px-2 rounded-full bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 flex items-center gap-1 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-theme" />
          <span className="h-1.5 w-5 rounded bg-neutral-400/70" />
        </div>
        <div className="h-5 px-2.5 rounded-full bg-white dark:bg-neutral-800 border border-theme/30 flex items-center gap-1.5 shadow-2xs">
          <span className="h-1.5 w-3 rounded bg-theme/70" />
          <span className="h-1.5 w-3 rounded bg-neutral-300 dark:bg-neutral-600" />
          <span className="h-1.5 w-3 rounded bg-neutral-300 dark:bg-neutral-600" />
        </div>
        <div className="h-5 px-1.5 rounded-full bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 flex items-center gap-1 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-theme/50" />
          <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div className="h-11 w-full rounded-xl bg-neutral-100 dark:bg-white/[0.04] p-1.5 flex flex-col justify-start">
        <div className="h-6 w-full rounded-lg bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 px-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-theme" />
            <span className="h-1.5 w-6 rounded bg-neutral-500/70" />
            <span className="h-1.5 w-4 rounded bg-theme/50" />
            <span className="h-1.5 w-4 rounded bg-neutral-300 dark:bg-neutral-600" />
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            <span className="h-2 w-2 rounded-full bg-theme/40" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-11 w-full rounded-xl bg-neutral-100 dark:bg-white/[0.04] p-1.5 flex flex-col justify-center">
      <div className="w-full rounded-lg bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 py-1 px-2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-theme" />
          <span className="h-1.5 w-8 rounded bg-neutral-500/70" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded bg-theme/60" />
          <span className="h-1 w-4 rounded bg-neutral-300 dark:bg-neutral-600" />
          <span className="h-1 w-4 rounded bg-neutral-300 dark:bg-neutral-600" />
        </div>
      </div>
    </div>
  );
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestMessage, setWebhookTestMessage] = useState("");
  const [draft, setDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [initialDraft, setInitialDraft] = useState<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const [hasStoredAiApiKey, setHasStoredAiApiKey] = useState(false);
  const ref = useRef(false);
  const initialDraftRef = useRef<SettingsDraft>({ clientConfig: {}, serverConfig: {} });
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showAlert, AlertUI } = useAlert();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(() =>
    resolveCategory(initialCategoryParam),
  );

  // URL tab change synchronizer
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveCategory(resolveCategory(tabParam));
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
    };
  }, []);

  function applyDraftThemePreview(nextDraft: SettingsDraft) {
    const cc = nextDraft.clientConfig;
    applyThemeColor(
      typeof cc["theme.color"] === "string" ? cc["theme.color"] : undefined,
      typeof cc["theme.secondary_color"] === "string" ? cc["theme.secondary_color"] : undefined,
      typeof cc["theme.preset"] === "string" ? cc["theme.preset"] : undefined,
    );
    applyThemeOpacity(cc["theme.opacity"]);
    if (typeof cc["theme.font_family"] === "string") {
      applyThemeFontFamily(cc["theme.font_family"]);
    }
    if (cc["theme.font_size"] !== undefined) {
      applyThemeFontSize(cc["theme.font_size"]);
    }
    applyThemeTitleFont(typeof cc["theme.title_font"] === "string" ? cc["theme.title_font"] : "serif");
    applyThemeTitleEffect(
      typeof cc["theme.title_effect"] === "string"
        ? cc["theme.title_effect"]
        : typeof cc["atelier.title_style"] === "string"
        ? cc["atelier.title_style"]
        : "clean",
    );
    applyThemeWallpaper(
      typeof cc["theme.wallpaper"] === "string" ? cc["theme.wallpaper"] : undefined,
      typeof cc["theme.wallpaper_opacity"] === "number" ? cc["theme.wallpaper_opacity"] : undefined,
    );
    applyThemeCustomCursor(cc["theme.custom_cursor"] !== false && cc["theme.custom_cursor"] !== "false");
    if (cc["gallery.tilt_degree"] !== undefined) {
      const tilt = Number.parseFloat(String(cc["gallery.tilt_degree"]));
      if (!Number.isNaN(tilt)) applyGalleryTiltDegree(tilt);
    }
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
    setSaveSuccess(false);
    setDraft((current) => updateDraftConfig(current, type, key, value));
  }

  function handleReset() {
    setSaveSuccess(false);
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
      setSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => {
        setSaveSuccess(false);
      }, 2200);
      emitToast(t("settings.ai_summary.save_success"), "success");
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

      emitToast(t("settings.webhook.test.success"), "success");
    } finally {
      setTestingWebhook(false);
    }
  }

  const currentHeaderLayout = normalizeHeaderLayout(String(clientConfig.get("header.layout") || "classic"));
  const headerShowNav =
    clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false";
  const navFontSize = Number.parseInt(String(clientConfig.get("header.nav_font_size") ?? 15), 10) || 15;
  const navGap = Number.parseInt(String(clientConfig.get("header.nav_gap") ?? 12), 10) || 12;
  const navOrganicTilt =
    clientConfig.get("header.nav_organic_tilt") !== false && clientConfig.get("header.nav_organic_tilt") !== "false";
  const rawPageHeaderMode = String(clientConfig.get("page.header_mode") || "clean");
  const pageHeaderMode: PageHeaderModeOption =
    rawPageHeaderMode === "banner" || rawPageHeaderMode === "hidden" ? rawPageHeaderMode : "clean";

  return (
    <div className="flex w-full flex-col">
      <Helmet>
        <title>{`${t("settings.title")} - ${siteConfig.name}`}</title>
      </Helmet>
      <main className="w-full max-w-6xl mx-auto rounded-3xl bg-w pb-36 px-2 sm:px-4" aria-label={t("main_content")}>
        <div className="flex flex-col items-start space-y-4 w-full">
          {(loading || saving) && <ReactLoading width="1em" height="1em" type="spin" color="#d6336c" />}

          {/* 顶部 3 大清晰分类（外观与版式 / 基础与安全 / 扩展与服务） + 右上角紧凑保存操作区 */}
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

            <div className="flex items-center gap-2 shrink-0">
              {(hasUnsavedChanges || saving || saveSuccess) && (
                <div className="flex items-center gap-1.5">
                  {hasUnsavedChanges && !saving && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition cursor-pointer"
                    >
                      <span>{t("reset")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading || (!hasUnsavedChanges && saveSuccess)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-80 ${
                      saveSuccess && !hasUnsavedChanges
                        ? "bg-emerald-600 text-white"
                        : "bg-theme text-white hover:bg-theme-hover active:scale-95"
                    }`}
                  >
                    {saving ? (
                      <i className="ri-loader-4-line animate-spin text-xs" />
                    ) : saveSuccess && !hasUnsavedChanges ? (
                      <i className="ri-check-line text-xs" />
                    ) : (
                      <i className="ri-save-line text-xs" />
                    )}
                    <span>{saving ? "保存中..." : saveSuccess && !hasUnsavedChanges ? "✓ 已保存" : t("save")}</span>
                  </button>
                </div>
              )}

              <Link
                href="/"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme transition shrink-0"
              >
                <i className="ri-external-link-line" />
                <span>查看前台效果</span>
              </Link>
            </div>
          </div>

          {/* Tab 1: 外观与版式（Bento Grid 模块化卡片） */}
          {activeCategory === "theme" && (
            <SettingsAppearancePanel clientConfig={clientConfig} setConfigValue={setConfigValue} />
          )}

          {/* Tab 2: 基础与安全（Bento Grid 模块化分组） */}
          {activeCategory === "general" && (
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 ani-show">
              {/* Bento Card 1: 站点身份与展示规范 (Identity) */}
              <section className="col-span-1 lg:col-span-5 p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <i className="ri-user-smile-line text-theme text-base" />
                    <h3 className="font-bold text-sm t-primary">站点身份与展示规范</h3>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Identity</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold t-primary">{t("settings.site.name.title")}</label>
                      <span className="text-[10px] text-neutral-400 font-mono">site.name</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-1">{t("settings.site.name.desc")}</p>
                    <input
                      type="text"
                      value={String(clientConfig.get("site.name") ?? "")}
                      placeholder={String(clientConfig.default("site.name") ?? t("settings.site.name.label"))}
                      onChange={(e) => setConfigValue("client", "site.name", e.target.value)}
                      className="mt-1 rin-field"
                    />
                  </div>

                  <div className="flex flex-col gap-1 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold t-primary">{t("settings.site.page_size.title")}</label>
                      <span className="text-[10px] text-neutral-400 font-mono">page_size</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-1">{t("settings.site.page_size.desc")}</p>
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

                <div className="flex flex-col gap-1 p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
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
              </section>

              {/* Bento Card 2: 前台导航顶栏排布 & 页面页眉 (Navigation & PageHeader) */}
              <section className="col-span-1 lg:col-span-7 p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <i className="ri-layout-top-line text-theme text-base" />
                    <h3 className="text-sm font-bold t-primary">前台导航顶栏与页面页眉</h3>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="text-xs font-semibold t-primary">前台显示导航条</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={headerShowNav}
                      onClick={() => setConfigValue("client", "header.show_nav", !headerShowNav)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        headerShowNav ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                          headerShowNav ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 全部 3 套真实顶栏排布 */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    顶栏排布形态（3 套真实布局）
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        id: "classic" as HeaderLayoutOption,
                        title: "经典自然居中顶栏",
                        desc: "居中舒展自然嵌入顶端，无悬浮遮挡",
                      },
                      {
                        id: "compact" as HeaderLayoutOption,
                        title: "极简纯文本社论顶栏",
                        desc: "左标题右菜单，轻透杂志社论排版",
                      },
                      {
                        id: "dock" as HeaderLayoutOption,
                        title: "三岛悬浮微光托盘",
                        desc: "品牌・导航・工具三岛悬浮胶囊",
                      },
                    ].map((layout) => {
                      const isSelected = currentHeaderLayout === layout.id;
                      return (
                        <button
                          key={layout.id}
                          type="button"
                          onClick={() => {
                            setConfigValue("client", "header.position", "top");
                            setConfigValue("client", "header.layout", layout.id);
                          }}
                          className={`flex flex-col gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? "border-theme bg-theme/[0.06] ring-1 ring-theme/25"
                              : "border-black/10 dark:border-white/10 hover:border-theme/40"
                          }`}
                        >
                          <HeaderLayoutThumb layout={layout.id} />
                          <div>
                            <div className={`font-bold text-xs ${isSelected ? "text-theme" : "t-primary"}`}>
                              {layout.title}
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug">{layout.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 导航字号 / 间距 / 手账倾角微调 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-semibold t-primary">顶栏导航字号</span>
                      <span className="font-mono text-theme font-bold">{navFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={20}
                      step={1}
                      value={navFontSize}
                      onChange={(e) => setConfigValue("client", "header.nav_font_size", Number.parseInt(e.target.value, 10))}
                      className="w-full accent-theme cursor-pointer"
                      aria-label="顶栏导航字号"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-semibold t-primary">顶栏导航间距</span>
                      <span className="font-mono text-theme font-bold">{navGap}px</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={28}
                      step={2}
                      value={navGap}
                      onChange={(e) => setConfigValue("client", "header.nav_gap", Number.parseInt(e.target.value, 10))}
                      className="w-full accent-theme cursor-pointer"
                      aria-label="顶栏导航间距"
                    />
                  </div>

                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] cursor-pointer">
                    <div className="min-w-0">
                      <span className="font-bold t-primary block truncate">导航手账微倾角</span>
                      <span className="text-[10px] text-neutral-400 block truncate">灵动手绘斜角点缀</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={navOrganicTilt}
                      onChange={(e) => setConfigValue("client", "header.nav_organic_tilt", e.target.checked)}
                      className="accent-theme rounded h-4 w-4 cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* PageHeader 页面页眉模式 */}
                <div className="space-y-2.5 pt-3 border-t border-black/5 dark:border-white/5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-500 dark:text-neutral-400">
                      子页面页眉形态（page.header_mode）
                    </span>
                    <span className="font-mono text-[10px] text-theme font-bold">{pageHeaderMode}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "clean" as PageHeaderModeOption,
                        label: "极简文字",
                        desc: "干净分隔线页眉",
                        icon: "ri-text",
                      },
                      {
                        id: "banner" as PageHeaderModeOption,
                        label: "微光横幅",
                        desc: "圆角柔光展示横幅",
                        icon: "ri-landscape-line",
                      },
                      {
                        id: "hidden" as PageHeaderModeOption,
                        label: "彻底隐藏",
                        desc: "仅保留右侧操作键",
                        icon: "ri-eye-off-line",
                      },
                    ].map((modeOpt) => {
                      const selected = pageHeaderMode === modeOpt.id;
                      return (
                        <button
                          key={modeOpt.id}
                          type="button"
                          onClick={() => setConfigValue("client", "page.header_mode", modeOpt.id)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                            selected
                              ? "border-theme bg-theme/[0.08] ring-1 ring-theme/25"
                              : "border-black/10 dark:border-white/10 hover:border-theme/40"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${
                              selected ? "bg-theme text-white" : "bg-black/5 dark:bg-white/10 text-neutral-500"
                            }`}
                          >
                            <i className={modeOpt.icon} />
                          </span>
                          <div className="min-w-0">
                            <span className={`font-bold text-xs block truncate ${selected ? "text-theme" : "t-primary"}`}>
                              {modeOpt.label}
                            </span>
                            <span className="text-[10px] text-neutral-400 block truncate">{modeOpt.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {pageHeaderMode === "banner" && (
                    <div className="flex flex-col gap-1 pt-1">
                      <label className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        横幅背景图 URL（可选，留空则显示纯主题渐变微光）
                      </label>
                      <input
                        type="text"
                        value={String(clientConfig.get("page.header_banner_url") ?? "")}
                        placeholder="https://example.com/banner.jpg"
                        onChange={(e) => setConfigValue("client", "page.header_banner_url", e.target.value)}
                        className="rin-field font-mono"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Bento Card 3: 全站核心功能开关矩阵 (Feature Switches) */}
              <section className="col-span-1 lg:col-span-6 p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <i className="ri-toggle-line text-theme text-base" />
                    <h3 className="font-bold text-sm t-primary">全站核心功能开关</h3>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Feature Switches</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "login.enabled", label: "开放访客登录", desc: "允许前台账户登录入口" },
                    { key: "comment.enabled", label: "留言板与文章评论", desc: "全站统一画廊留言体系" },
                    { key: "counter.enabled", label: "阅读计数器 (PV/UV)", desc: "文章独立访客与浏览统计" },
                    { key: "rss", label: "原生 RSS 订阅源", desc: "提供 /feed 和 /rss.xml" },
                    { key: "openlist.show_in_nav", label: "顶栏显示网盘入口", desc: "在导航栏增加 OpenList 入口" },
                  ].map((item) => {
                    const checked = clientConfig.getBoolean(item.key);
                    return (
                      <div
                        key={item.key}
                        className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3"
                      >
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
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                              checked ? "translate-x-4.5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Bento Card 4: 图标上传与页脚 HTML (Favicon/Footer) */}
              <section className="col-span-1 lg:col-span-6 p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <i className="ri-code-box-line text-theme text-base" />
                    <h3 className="font-bold text-sm t-primary">站点图标 (Favicon) 与页脚自定义</h3>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Favicon & Footer</span>
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
              </section>
            </div>
          )}

          {/* Tab 3: 扩展与服务 */}
          {activeCategory === "services" && (
            <div className="w-full flex flex-col space-y-4 ani-show">
              <AISummarySettings
                value={aiValue}
                onSave={handleSave}
                onChange={(updates) => {
                  if (updates.enabled !== undefined) setConfigValue("server", "ai_summary.enabled", updates.enabled);
                  if (updates.provider !== undefined) setConfigValue("server", "ai_summary.provider", updates.provider);
                  if (updates.model !== undefined) setConfigValue("server", "ai_summary.model", updates.model);
                  if (updates.apiUrl !== undefined) setConfigValue("server", "ai_summary.api_url", updates.apiUrl);
                  if (updates.apiKey !== undefined) setConfigValue("server", "ai_summary.api_key", updates.apiKey);
                  if (updates.systemPrompt !== undefined) setConfigValue("server", "ai_summary.system_prompt", updates.systemPrompt);
                  if (updates.pipelineStages !== undefined) setConfigValue("server", "ai_summary.pipeline_stages", updates.pipelineStages);
                  if (updates.promptTech !== undefined) setConfigValue("server", "ai_summary.prompt_tech", updates.promptTech);
                  if (updates.promptFormat !== undefined) setConfigValue("server", "ai_summary.prompt_format", updates.promptFormat);
                  if (updates.promptSummary !== undefined) setConfigValue("server", "ai_summary.prompt_summary", updates.promptSummary);
                  if (updates.promptPresets !== undefined) setConfigValue("server", "ai_summary.prompt_presets", updates.promptPresets);
                }}
              />

              {/* Webhook 外部通知广播 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 gap-2">
                  <div className="flex items-center gap-2">
                    <i className="ri-broadcast-line text-theme text-base" />
                    <h3 className="font-bold text-sm t-primary">{t("settings.webhook.title")}</h3>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        serverConfig.get("webhook_url")
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-neutral-500/10 text-neutral-400"
                      }`}
                    >
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
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
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
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                          clientConfig.get("friend_apply_enable") ? "translate-x-4.5" : "translate-x-1"
                        }`}
                      />
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
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                          serverConfig.get("friend_crontab") ? "translate-x-4.5" : "translate-x-1"
                        }`}
                      />
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
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                            clientConfig.getBoolean("cache.enabled") ? "translate-x-4.5" : "translate-x-1"
                          }`}
                        />
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
                              emitToast("边缘 KV 缓存与预渲染结果已成功清空！", "success");
                            }
                          });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white font-bold text-xs transition cursor-pointer"
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

          {(hasUnsavedChanges || saving || saveSuccess) && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 ani-show select-none pointer-events-auto">
              <div
                className={`p-3 sm:p-3.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border shadow-2xl flex items-center justify-between gap-3 ${
                  saveSuccess && !hasUnsavedChanges ? "border-emerald-500/40" : "border-theme/30"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm ${
                      saveSuccess && !hasUnsavedChanges
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-theme/10 text-theme animate-pulse"
                    }`}
                  >
                    <i className={saveSuccess && !hasUnsavedChanges ? "ri-check-line" : "ri-save-line"} />
                  </span>
                  <div className="min-w-0 truncate">
                    <span className="font-bold text-xs t-primary block truncate">
                      {saveSuccess && !hasUnsavedChanges ? "配置已保存" : "配置有未保存改动"}
                    </span>
                    <span className="text-[10px] text-neutral-400 block truncate">
                      {saveSuccess && !hasUnsavedChanges ? "已同步至云端并实时生效" : "点击保存立即写入边缘存储"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasUnsavedChanges && (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition cursor-pointer"
                    >
                      {t("reset")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading || (!hasUnsavedChanges && saveSuccess)}
                    className={`px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-80 ${
                      saveSuccess && !hasUnsavedChanges
                        ? "bg-emerald-600"
                        : "bg-theme hover:bg-theme-hover active:scale-95"
                    }`}
                  >
                    {saving && <i className="ri-loader-4-line animate-spin text-xs" />}
                    <span>
                      {saving ? "保存中..." : saveSuccess && !hasUnsavedChanges ? "✓ 已保存" : t("save")}
                    </span>
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
