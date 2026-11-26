import { Modal } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "wouter";
import { client } from "../app/runtime";
import { AdminSwitch } from "../components/admin-switch";
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
import { SettingsAppearancePanel } from "./settings-appearance";
import { ItemImageInput, ItemWithUpload } from "./settings-items";
import {
  AI_PROVIDER_PRESETS,
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
  const [faviconKey, setFaviconKey] = useState(() => Date.now());
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [faviconSaved, setFaviconSaved] = useState(false);
  const ref = useRef(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const faviconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (faviconTimerRef.current) clearTimeout(faviconTimerRef.current);
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
    if (!file) return;
    setUploadingFavicon(true);
    try {
      const ok = await uploadFavicon(file, t, showAlert);
      if (ok) {
        setFaviconKey(Date.now());
        setFaviconSaved(true);
        if (faviconTimerRef.current) clearTimeout(faviconTimerRef.current);
        faviconTimerRef.current = setTimeout(() => setFaviconSaved(false), 2200);
      }
    } finally {
      setUploadingFavicon(false);
      if (faviconInputRef.current) faviconInputRef.current.value = "";
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
  const footerByText = String(clientConfig.get("footer.by_text") ?? "80hou");
  const footerByUrl = String(
    clientConfig.get("footer.by_url") ?? "https://www.nodeseek.com/space/39375#/general",
  );
  const aiProviderLabel =
    AI_PROVIDER_PRESETS.find((p) => p.value === aiValue.provider)?.label ?? aiValue.provider;

  return (
    <div className="flex w-full flex-col">
      <Helmet>
        <title>{`${t("settings.title")} - ${siteConfig.name}`}</title>
      </Helmet>
      <div className="w-full flex flex-col gap-4 pb-10">
        {/* 顶部 3 大清晰分类 + 唯一粘性保存操作栏 */}
        <div className="sticky top-16 z-20 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb)/0.92)] px-3 py-2 shadow-2xs backdrop-blur-xl">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
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

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--rin-ink-muted-rgb))]">
                <i className="ri-loader-4-line animate-spin text-theme" />
                <span>读取配置…</span>
              </span>
            ) : null}

            {hasUnsavedChanges && !saving ? (
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>有未保存改动</span>
              </span>
            ) : null}

            {(hasUnsavedChanges || saving || saveSuccess) && (
              <div className="flex items-center gap-1.5">
                {hasUnsavedChanges && !saving && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition cursor-pointer"
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
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgb(var(--rin-hairline-rgb))] text-xs font-semibold text-[rgb(var(--rin-ink-muted-rgb))] hover:border-theme hover:text-theme transition shrink-0"
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
            <section className="col-span-1 lg:col-span-5 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
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
              <section className="col-span-1 lg:col-span-7 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <i className="ri-layout-top-line text-theme text-base" />
                    <h3 className="text-sm font-bold t-primary">前台导航顶栏与页面页眉</h3>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="text-xs font-semibold t-primary">前台显示导航条</span>
                    <AdminSwitch
                      checked={headerShowNav}
                      ariaLabel="前台显示导航条"
                      onChange={(next) => setConfigValue("client", "header.show_nav", next)}
                    />
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

                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <div className="min-w-0">
                      <span className="font-bold t-primary block truncate">导航手账微倾角</span>
                      <span className="text-[10px] text-neutral-400 block truncate">灵动手绘斜角点缀</span>
                    </div>
                    <AdminSwitch
                      checked={navOrganicTilt}
                      ariaLabel="导航手账微倾角"
                      onChange={(next) => setConfigValue("client", "header.nav_organic_tilt", next)}
                    />
                  </div>
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
              <section className="col-span-1 lg:col-span-6 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
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
                        <AdminSwitch
                          checked={checked}
                          ariaLabel={item.label}
                          onChange={(next) => setConfigValue("client", item.key, next)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Bento Card 4: 站点图标 (Favicon) 与页脚署名/自定义 HTML */}
              <section className="col-span-1 lg:col-span-6 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <i className="ri-code-box-line text-theme text-base" />
                    <h3 className="font-bold text-sm t-primary">站点图标 (Favicon) 与页脚自定义</h3>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Favicon & Footer</span>
                </div>

                {/* Favicon 实时预览 + 一键上传 */}
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon,image/webp"
                  onChange={handleFaviconChange}
                  className="hidden"
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => faviconInputRef.current?.click()}
                      title="点击上传更换站点图标"
                      className="relative h-12 w-12 shrink-0 rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] flex items-center justify-center overflow-hidden group cursor-pointer"
                    >
                      <img
                        key={faviconKey}
                        src={`/favicon?t=${faviconKey}`}
                        alt="Favicon"
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">
                        <i className="ri-upload-cloud-2-line" />
                      </span>
                    </button>
                    <div className="min-w-0">
                      <div className="text-xs font-bold t-primary">{t("settings.favicon.title")}</div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                        推荐 512×512 透明底 PNG 或 SVG，边缘会自动生成多规格适配。
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploadingFavicon}
                    onClick={() => faviconInputRef.current?.click()}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-2xs transition shrink-0 self-start sm:self-auto cursor-pointer disabled:opacity-60 ${
                      faviconSaved ? "bg-emerald-600" : "bg-theme hover:bg-theme-hover active:scale-95"
                    }`}
                  >
                    {uploadingFavicon ? (
                      <i className="ri-loader-4-line animate-spin text-xs" />
                    ) : faviconSaved ? (
                      <i className="ri-check-line text-xs" />
                    ) : (
                      <i className="ri-upload-cloud-2-line text-xs" />
                    )}
                    <span>{uploadingFavicon ? "上传中..." : faviconSaved ? "✓ 已更新" : "上传图标"}</span>
                  </button>
                </div>

                {/* 页脚 Powered by 署名可视化定制 */}
                <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold t-primary">页脚 Powered by 署名与链接</span>
                    <span className="text-[11px] text-neutral-400 truncate max-w-[220px]">
                      © {new Date().getFullYear()} Powered by{" "}
                      <a href={footerByUrl} target="_blank" rel="noreferrer" className="text-theme font-semibold hover:underline">
                        {footerByText || "80hou"}
                      </a>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={footerByText}
                      placeholder="署名文本 (如 80hou)"
                      onChange={(e) => setConfigValue("client", "footer.by_text", e.target.value)}
                      className="rin-field font-semibold"
                      aria-label="页脚署名文字"
                    />
                    <input
                      type="url"
                      value={footerByUrl}
                      placeholder="https://example.com"
                      onChange={(e) => setConfigValue("client", "footer.by_url", e.target.value)}
                      className="rin-field font-mono"
                      aria-label="页脚署名链接"
                    />
                  </div>
                </div>

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

          {/* Tab 3: 扩展与服务（Bento Grid 整合：AI 入口收口至 /admin/ai + 缓存迁移 + 友链 + Webhook） */}
          {activeCategory === "services" && (
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 ani-show">
              {/* Bento Card 1: AI 智能导读总览（详细模型与提示词工坊统一收口于 /admin/ai） */}
              <section className="col-span-1 lg:col-span-6 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="ri-sparkling-2-line text-theme text-base shrink-0" />
                    <h3 className="font-bold text-sm t-primary truncate">AI 智能导读与写作助手</h3>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      aiValue.enabled
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-neutral-500/10 text-neutral-400"
                    }`}
                  >
                    {aiValue.enabled ? "已开启" : "已关闭"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-bold text-xs t-primary block truncate">发布时自动生成文章导读</span>
                    <span className="text-[11px] text-neutral-400 block truncate">
                      新文章发布或触发队列回填时自动提炼摘要
                    </span>
                  </div>
                  <AdminSwitch
                    checked={aiValue.enabled}
                    ariaLabel="发布时自动生成文章导读"
                    onChange={(next) => setConfigValue("server", "ai_summary.enabled", next)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <span className="text-[10px] text-neutral-400 block">当前服务商</span>
                    <span className="font-bold t-primary block truncate mt-0.5">{aiProviderLabel}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <span className="text-[10px] text-neutral-400 block">默认模型</span>
                    <span className="font-mono font-bold t-primary block truncate mt-0.5">{aiValue.model}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                    <span className="text-[10px] text-neutral-400 block">鉴权密钥</span>
                    <span
                      className={`font-mono font-bold block truncate mt-0.5 ${
                        aiValue.apiKeySet ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"
                      }`}
                    >
                      {aiValue.apiKeySet ? "已安全托管" : "未填写密钥"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-400">
                    模型选择、API 端点、连通性测试与提示词预设已统一收口于 AI 助手
                  </span>
                  <Link
                    href="/admin/ai"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover transition shrink-0"
                  >
                    <i className="ri-sparkling-2-line" />
                    <span>前往 AI 助手工作台</span>
                    <i className="ri-arrow-right-line" />
                  </Link>
                </div>
              </section>

              {/* Bento Card 2: 边缘性能维护与数据迁移 */}
              <section className="col-span-1 lg:col-span-6 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <i className="ri-tools-line text-theme text-base" />
                    <h3 className="font-bold text-sm t-primary">{t("settings.maintenance.title")}</h3>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Cache & Migration</span>
                </div>

                <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block">{t("settings.cache.enabled.title")}</span>
                      <span className="text-[11px] text-neutral-400 block truncate">
                        开启后对文章与首页渲染结果启用边缘缓存加速
                      </span>
                    </div>
                    <AdminSwitch
                      checked={Boolean(clientConfig.getBoolean("cache.enabled"))}
                      ariaLabel={t("settings.cache.enabled.title")}
                      onChange={(next) => setConfigValue("client", "cache.enabled", next)}
                    />
                  </div>
                  <div className="pt-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-neutral-400 font-mono">强制刷新边缘节点缓存</span>
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

                <ItemWithUpload
                  title={t("settings.wordpress.title")}
                  description="从 WordPress WXR .xml 导出文件导入文章与标签（支持 50MB 以内 XML）"
                  accept="application/xml"
                  buttonLabel="选择 XML 导入"
                  onFileChange={onFileChange}
                />
              </section>

              {/* Bento Card 3: 友链巡检与申请治理 */}
              <section className="col-span-1 lg:col-span-12 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
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
                    <AdminSwitch
                      checked={Boolean(clientConfig.get("friend_apply_enable"))}
                      ariaLabel={t("settings.friend.apply.title")}
                      onChange={(next) => setConfigValue("client", "friend_apply_enable", next)}
                    />
                  </div>

                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">{t("settings.friend.health.title")}</span>
                      <span className="text-[11px] text-neutral-400 block truncate">{t("settings.friend.health.desc")}</span>
                    </div>
                    <AdminSwitch
                      checked={Boolean(serverConfig.get("friend_crontab"))}
                      ariaLabel={t("settings.friend.health.title")}
                      onChange={(next) => setConfigValue("server", "friend_crontab", next)}
                    />
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
              </section>

              {/* Bento Card 4: Webhook 外部通知广播 */}
              <section className="col-span-1 lg:col-span-12 p-5 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-xs space-y-4">
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
              </section>
            </div>
          )}
      </div>

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
