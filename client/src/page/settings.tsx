import { Modal, SearchableSelect, SettingsBadge, SettingsCard, SettingsCardBody, SettingsCardHeader, SettingsCardRow } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { client, oauth_url } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog.tsx";
import { HeaderLayoutPreview } from "../components/site-header/layout-preview";
import {
  HEADER_BEHAVIOR_OPTIONS,
  HEADER_LAYOUT_OPTIONS,
  normalizeHeaderBehavior,
  normalizeHeaderLayout,
} from "../components/site-header/layout-options";
import { FEED_CARD_VARIANTS, normalizeFeedCardVariant } from "../components/feed-card-options";
import { FeedCardPreview } from "../components/feed-card-preview";
import { FEED_LAYOUT_OPTIONS, normalizeFeedLayout } from "../components/feed-layout-options";
import { useSiteConfig } from "../hooks/useSiteConfig";
import {
  applyThemeColor,
  normalizeThemeColor,
  applyThemeOpacity,
  normalizeThemeOpacity,
  THEME_PRESETS,
  ACCENT_COLOR_PRESETS,
  OPACITY_SHORTCUTS,
} from "../utils/theme-color";
import { getStoredThemeMode, setThemeMode, type ThemeMode } from "../utils/darkModeUtils";
import { AISummarySettings } from "./settings-ai";
import { ItemButton, ItemImageInput, ItemInput, ItemSwitch, ItemTitle, ItemWithUpload } from "./settings-items";
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

export function Settings() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
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
  const [activeCategory, setActiveCategory] = useState<"general" | "theme" | "atelier" | "services">("general");
  const [activeThemeMode, setActiveThemeMode] = useState<ThemeMode>(getStoredThemeMode());

  function getDraftThemeColor(nextDraft: SettingsDraft) {
    return typeof nextDraft.clientConfig["theme.color"] === "string" ? nextDraft.clientConfig["theme.color"] : undefined;
  }

  function getDraftThemeOpacity(nextDraft: SettingsDraft) {
    return nextDraft.clientConfig["theme.opacity"];
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
        applyThemeColor(getDraftThemeColor(state.draft));
        applyThemeOpacity(getDraftThemeOpacity(state.draft));
      })
      .catch((err: any) => {
        showAlert(t("settings.get_config_failed$message", { message: err.message }));
      })
      .finally(() => {
        setLoading(false);
      });
    ref.current = true;

    return () => {
      applyThemeColor(getDraftThemeColor(initialDraftRef.current));
      applyThemeOpacity(getDraftThemeOpacity(initialDraftRef.current));
    };
  }, [showAlert, t]);

  const { clientConfig, serverConfig } = useMemo(() => createSettingsConfigWrappers(draft), [draft]);
  const aiValue = useMemo(() => buildAIConfigDraftValue(draft, hasStoredAiApiKey), [draft, hasStoredAiApiKey]);
  const hasUnsavedChanges = !areSettingsDraftsEqual(draft, initialDraft);
  const themeColorValue = normalizeThemeColor(String(clientConfig.get("theme.color") ?? "#fc466b"));
  const themeOpacityValue = normalizeThemeOpacity(clientConfig.get("theme.opacity"));
  const themePresetValue = String(clientConfig.get("theme.preset") ?? "sakura");
  const themeCustomColorEnabled = clientConfig.getBoolean("theme.custom_color_enabled");
  const feedLayoutValue = normalizeFeedLayout(String(clientConfig.get("feed.layout") ?? "list"));
  const feedCardVariantValue = normalizeFeedCardVariant(String(clientConfig.get("feed.card_variant") ?? "default"));
  const previewSiteName = String(clientConfig.get("site.name") ?? clientConfig.default("site.name") ?? "Rin");
  const previewSiteAvatar = String(clientConfig.get("site.avatar") ?? clientConfig.default("site.avatar") ?? "");

  function setConfigValue(type: "client" | "server", key: string, value: unknown) {
    setDraft((current) => updateDraftConfig(current, type, key, value));
  }

  function handleReset() {
    setDraft(initialDraft);
    applyThemeColor(getDraftThemeColor(initialDraft));
    applyThemeOpacity(getDraftThemeOpacity(initialDraft));
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
      <main className="w-full rounded-2xl bg-w" aria-label={t("main_content")}>
        <div className="flex flex-col items-start space-y-4 w-full">
          {(loading || saving) && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}

          {/* Top Category Tabs (Modular Settings Navigation) */}
          <div className="flex w-full items-center gap-2 overflow-x-auto pb-2 border-b border-black/10 dark:border-white/10 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory("general")}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition select-none ${
                activeCategory === "general"
                  ? "bg-theme text-white shadow-xs scale-[1.02]"
                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600 dark:bg-white/5 dark:text-neutral-300"
              }`}
            >
              <i className="ri-settings-4-line text-sm" />
              <span>基础设置</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("theme")}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition select-none ${
                activeCategory === "theme"
                  ? "bg-theme text-white shadow-xs scale-[1.02]"
                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600 dark:bg-white/5 dark:text-neutral-300"
              }`}
            >
              <i className="ri-palette-line text-sm" />
              <span>主题与布局</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("atelier")}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition select-none ${
                activeCategory === "atelier"
                  ? "bg-theme text-white shadow-xs scale-[1.02]"
                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600 dark:bg-white/5 dark:text-neutral-300"
              }`}
            >
              <i className="ri-magic-line text-sm" />
              <span>进阶设置</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("services")}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition select-none ${
                activeCategory === "services"
                  ? "bg-theme text-white shadow-xs scale-[1.02]"
                  : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600 dark:bg-white/5 dark:text-neutral-300"
              }`}
            >
              <i className="ri-apps-2-line text-sm" />
              <span>扩展服务与集成</span>
            </button>
          </div>

          {/* Tab 1: General Settings */}
          {activeCategory === "general" && (
            <div className="w-full flex flex-col space-y-3 ani-show">
              <ItemTitle title={t("settings.site.title")} />
              <ItemInput
                title={t("settings.site.name.title")}
                description={t("settings.site.name.desc")}
                configKeyTitle={t("settings.site.name.label")}
                value={String(clientConfig.get("site.name") ?? "")}
                placeholder={String(clientConfig.default("site.name") ?? t("settings.site.name.label"))}
                onChange={(value) => {
                  setConfigValue("client", "site.name", value);
                }}
              />
              <ItemInput
                title={t("settings.site.description.title")}
                description={t("settings.site.description.desc")}
                configKeyTitle={t("settings.site.description.label")}
                value={String(clientConfig.get("site.description") ?? "")}
                placeholder={String(clientConfig.default("site.description") ?? t("settings.site.description.label"))}
                onChange={(value) => {
                  setConfigValue("client", "site.description", value);
                }}
              />
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
              <ItemInput
                title={t("settings.site.page_size.title")}
                description={t("settings.site.page_size.desc")}
                configKeyTitle={t("settings.site.page_size.label")}
                value={String(clientConfig.get("site.page_size") ?? "")}
                placeholder={String(clientConfig.default("site.page_size") ?? t("settings.site.page_size.label"))}
                onChange={(value) => {
                  setConfigValue("client", "site.page_size", value);
                }}
              />
              <ItemWithUpload
                title={t("settings.favicon.title")}
                description={t("settings.favicon.desc")}
                accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon"
                onFileChange={handleFaviconChange}
              />
              <ItemSwitch
                title="显示顶部导航栏"
                description="开启后在首页显示顶部导航栏；关闭后首页将隐藏顶部导航栏，呈现完全沉浸式画廊视觉"
                checked={clientConfig.get("header.show_nav") === true || clientConfig.get("header.show_nav") === "true"}
                onChange={(checked) => {
                  setConfigValue("client", "header.show_nav", checked);
                }}
              />
              <ItemSwitch
                title={t("settings.login.enable.title")}
                description={t("settings.login.enable.desc", { url: oauth_url })}
                checked={clientConfig.getBoolean("login.enabled")}
                onChange={(checked) => {
                  setConfigValue("client", "login.enabled", checked);
                }}
              />
              <ItemSwitch
                title={t("settings.comment.enable.title")}
                description={t("settings.comment.enable.desc")}
                checked={clientConfig.getBoolean("comment.enabled")}
                onChange={(checked) => {
                  setConfigValue("client", "comment.enabled", checked);
                }}
              />
              <ItemSwitch
                title={t("settings.counter.enable.title")}
                description={t("settings.counter.enable.desc")}
                checked={clientConfig.getBoolean("counter.enabled")}
                onChange={(checked) => {
                  setConfigValue("client", "counter.enabled", checked);
                }}
              />
              <ItemSwitch
                title={t("settings.rss.title")}
                description={t("settings.rss.desc")}
                checked={clientConfig.getBoolean("rss")}
                onChange={(checked) => {
                  setConfigValue("client", "rss", checked);
                }}
              />
              <ItemInput
                title={t("settings.footer.title")}
                description={t("settings.footer.desc")}
                configKeyTitle="Footer HTML"
                value={String(clientConfig.get("footer") ?? "")}
                onChange={(value) => {
                  setConfigValue("client", "footer", value);
                }}
              />
            </div>
          )}

          {/* Tab 2: Theme & Layout Settings */}
          {activeCategory === "theme" && (
            <div className="w-full flex flex-col space-y-3 ani-show">
              <ItemTitle title={t("settings.personalization.title")} />
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.header_layout.title")}
                    description={t("settings.header_layout.desc")}
                  />
                }
                action={
                  <SearchableSelect
                    value={normalizeHeaderLayout(String(clientConfig.get("header.layout") ?? "classic"))}
                    onChange={(value) => {
                      setConfigValue("client", "header.layout", value);
                    }}
                    options={HEADER_LAYOUT_OPTIONS.map((value) => ({
                      value,
                      label: t(`settings.header_layout.options.${value}`),
                    }))}
                    placeholder={t("settings.header_layout.title")}
                    emptyLabel={t("no_more")}
                    searchable={false}
                  />
                }
              />
              <SettingsCardBody>
                <div className="grid gap-3 md:grid-cols-2">
                  {HEADER_LAYOUT_OPTIONS.map((value) => (
                    <HeaderLayoutPreview
                      key={value}
                      data={{
                        avatar: previewSiteAvatar,
                        name: previewSiteName,
                        themeColor: themeColorValue,
                      }}
                      layout={value}
                      selected={normalizeHeaderLayout(String(clientConfig.get("header.layout") ?? "classic")) === value}
                      title={t(`settings.header_layout.options.${value}`)}
                      description={t(`settings.header_layout.preview.${value}`)}
                      onClick={() => {
                        setConfigValue("client", "header.layout", value);
                      }}
                    />
                  ))}
                </div>
              </SettingsCardBody>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.feed_layout.title")}
                      description={t("settings.feed_layout.desc")}
                    />
                  }
                  action={
                    <SearchableSelect
                      value={feedLayoutValue}
                      onChange={(value) => {
                        setConfigValue("client", "feed.layout", value);
                      }}
                      options={FEED_LAYOUT_OPTIONS.map((value) => ({
                        value,
                        label: t(`settings.feed_layout.options.${value}`),
                      }))}
                      placeholder={t("settings.feed_layout.title")}
                      emptyLabel={t("no_more")}
                      searchable={false}
                    />
                  }
                />
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.feed_card.title")}
                      description={t("settings.feed_card.desc")}
                    />
                  }
                  action={
                    <SearchableSelect
                      value={feedCardVariantValue}
                      onChange={(value) => {
                        setConfigValue("client", "feed.card_variant", value);
                      }}
                      options={FEED_CARD_VARIANTS.map((value) => ({
                        value,
                        label: t(`settings.feed_card.options.${value}`),
                      }))}
                      placeholder={t("settings.feed_card.title")}
                      emptyLabel={t("no_more")}
                      searchable={false}
                    />
                  }
                />
                <SettingsCardBody>
                  <div className="grid gap-3 md:grid-cols-2">
                    {FEED_CARD_VARIANTS.map((value) => (
                      <FeedCardPreview
                        key={value}
                        variant={value}
                        selected={feedCardVariantValue === value}
                        title={t(`settings.feed_card.options.${value}`)}
                        description={t(`settings.feed_card.preview.${value}`)}
                        onClick={() => {
                          setConfigValue("client", "feed.card_variant", value);
                        }}
                      />
                    ))}
                  </div>
                </SettingsCardBody>
              </div>
              {/* Window Opacity Control (Inspired by Modern Glassmorphism & Visual Settings) */}
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-black/[0.015] p-4 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold t-primary flex items-center gap-2">
                        <i className="ri-contrast-drop-line text-theme" />
                        <span>窗口透明度</span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-md">
                        调节整个应用窗口与卡片的通透度与毛玻璃质感，让背景质感若隐若现。较低时文字对比度更柔和。
                      </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={50}
                          max={100}
                          step={1}
                          value={themeOpacityValue}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            setConfigValue("client", "theme.opacity", val);
                            applyThemeOpacity(val);
                          }}
                          className="h-2 w-32 sm:w-44 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/15"
                        />
                        <span className="min-w-12 text-right font-mono text-sm font-bold text-theme">
                          {themeOpacityValue}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {OPACITY_SHORTCUTS.map((pct) => {
                          const isSelected = themeOpacityValue === pct;
                          return (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                setConfigValue("client", "theme.opacity", pct);
                                applyThemeOpacity(pct);
                              }}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all select-none ${
                                isSelected
                                  ? "bg-theme text-white shadow-xs scale-105"
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                              }`}
                            >
                              {pct}%
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* UI Theme & Presets Section (Mode Switcher + Theme Presets Grid + Custom Accent) */}
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <div className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-black/[0.015] p-4 dark:border-white/5 dark:bg-white/[0.02]">
                  {/* Theme Mode Segmented Switcher */}
                  <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                    <div>
                      <div className="text-sm font-semibold t-primary">界面主题模式</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        快速预览与切换浅色、深色或跟随系统外观
                      </div>
                    </div>
                    <div className="flex items-center rounded-xl bg-neutral-100 p-1 dark:bg-white/5 border border-black/5 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          setThemeMode("light");
                          setActiveThemeMode("light");
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition select-none ${
                          activeThemeMode === "light"
                            ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white"
                            : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        }`}
                      >
                        <i className="ri-sun-line text-amber-500" />
                        <span>浅色</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setThemeMode("system");
                          setActiveThemeMode("system");
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition select-none ${
                          activeThemeMode === "system"
                            ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white"
                            : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        }`}
                      >
                        <i className="ri-computer-line text-blue-500" />
                        <span>系统</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setThemeMode("dark");
                          setActiveThemeMode("dark");
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition select-none ${
                          activeThemeMode === "dark"
                            ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white"
                            : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        }`}
                      >
                        <i className="ri-moon-line text-purple-400" />
                        <span>深色</span>
                      </button>
                    </div>
                  </div>

                  {/* Preset Themes Grid */}
                  <div className="flex flex-col gap-2.5 pb-3 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold t-primary">风格主题预设</div>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">18 款精选方案</span>
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      内置多套高质感预设配色方案（极简纸墨、赛博冷萃、和风青空、午夜深邃等），点击即刻全局应用
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-9 gap-2.5 pt-1">
                      {THEME_PRESETS.map((preset) => {
                        const isSelected = themePresetValue === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            title={`${preset.name} - ${preset.description}`}
                            onClick={() => {
                              setConfigValue("client", "theme.preset", preset.id);
                              if (!themeCustomColorEnabled) {
                                setConfigValue("client", "theme.color", preset.color);
                                applyThemeColor(preset.color);
                              }
                            }}
                            className={`group relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                              isSelected
                                ? "ring-2 ring-offset-2 ring-theme shadow-sm shadow-theme/30"
                                : "hover:shadow-xs"
                            }`}
                            style={{
                              backgroundColor: preset.previewBg,
                              border: `1.5px solid ${isSelected ? preset.color : "rgba(0,0,0,0.08)"}`,
                            }}
                          >
                            <span
                              className="h-4 w-4 rounded-full shadow-2xs transition-transform group-hover:scale-110"
                              style={{ backgroundColor: preset.color }}
                            />
                            {isSelected && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <i className="ri-check-line text-xs font-bold text-white drop-shadow-xs" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const activePreset = THEME_PRESETS.find((p) => p.id === themePresetValue);
                      if (!activePreset) return null;
                      return (
                        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 bg-black/[0.02] dark:bg-white/[0.02] px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="font-semibold t-primary">{activePreset.name}</span>
                          <span>·</span>
                          <span>{activePreset.description}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Custom Accent Switch & Palette */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold t-primary">使用自定义强调色</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          覆盖主题预设自带的强调色，自选专属视觉高光
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={themeCustomColorEnabled}
                        onClick={() => {
                          const nextVal = !themeCustomColorEnabled;
                          setConfigValue("client", "theme.custom_color_enabled", nextVal);
                          if (!nextVal) {
                            const activePreset = THEME_PRESETS.find((p) => p.id === themePresetValue) ?? THEME_PRESETS[0];
                            setConfigValue("client", "theme.color", activePreset.color);
                            applyThemeColor(activePreset.color);
                          }
                        }}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent transition-colors focus:outline-none ${
                          themeCustomColorEnabled ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                        }`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            themeCustomColorEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className={`flex flex-col gap-2 transition-opacity duration-200 ${themeCustomColorEnabled ? "opacity-100" : "opacity-45 pointer-events-none"}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">自定义强调色色谱</div>
                        <div className="font-mono text-xs font-bold text-theme">{themeColorValue}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {ACCENT_COLOR_PRESETS.map((color) => {
                          const isSelected = themeColorValue.toLowerCase() === color.toLowerCase();
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setConfigValue("client", "theme.color", color);
                                setConfigValue("client", "theme.custom_color_enabled", true);
                                applyThemeColor(color);
                              }}
                              className={`group relative flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
                                isSelected ? "ring-2 ring-offset-2 ring-theme shadow-xs scale-105" : "hover:shadow-xs"
                              }`}
                              style={{ backgroundColor: color }}
                            >
                              {isSelected && <i className="ri-check-line text-xs font-bold text-white drop-shadow-xs" />}
                            </button>
                          );
                        })}

                        {/* Native Color Picker Trigger */}
                        <label
                          title="自选色盘"
                          className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 via-purple-500 to-sky-500 text-white shadow-xs transition-transform hover:scale-110 active:scale-95"
                        >
                          <i className="ri-palette-line text-xs drop-shadow-xs" />
                          <input
                            type="color"
                            value={themeColorValue}
                            onChange={(event) => {
                              const normalized = normalizeThemeColor(event.target.value);
                              setConfigValue("client", "theme.color", normalized);
                              setConfigValue("client", "theme.custom_color_enabled", true);
                              applyThemeColor(normalized);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <SettingsCardRow
                  header={
                    <SettingsCardHeader
                      title={t("settings.header_behavior.title")}
                      description={t("settings.header_behavior.desc")}
                    />
                  }
                  action={
                    <SearchableSelect
                      value={normalizeHeaderBehavior(String(clientConfig.get("header.behavior") ?? "fixed"))}
                      onChange={(value) => {
                        setConfigValue("client", "header.behavior", value);
                      }}
                      options={HEADER_BEHAVIOR_OPTIONS.map((value) => ({
                        value,
                        label: t(`settings.header_behavior.options.${value}`),
                      }))}
                      placeholder={t("settings.header_behavior.title")}
                      emptyLabel={t("no_more")}
                      searchable={false}
                    />
                  }
                />
              </div>
            </SettingsCard>
          </div>
        </div>
      )}

      {/* Tab 3: Atelier & Sticky Notes Settings */}
      {activeCategory === "atelier" && (
        <div className="w-full flex flex-col space-y-3 ani-show">
          <ItemTitle title="进阶设置 · 画廊随想与便签定制" />
          <ItemInput
            title="画廊主标题"
            description="首页画廊顶部展示的艺术标题"
            configKeyTitle="atelier.title"
            value={String(clientConfig.get("atelier.title") ?? "画廊随想")}
            placeholder="画廊随想"
            onChange={(value) => {
              setConfigValue("client", "atelier.title", value);
            }}
          />

          <ItemTitle title="1. “关于我”便签设置" />
          <ItemInput
            title="“关于我”跳转链接"
            description="点击便签时跳转的文章别名或页面链接（例如 /about 或 /feed/1）"
            configKeyTitle="atelier.about_url"
            value={String(clientConfig.get("atelier.about_url") ?? "/about")}
            placeholder="/about"
            onChange={(value) => {
              setConfigValue("client", "atelier.about_url", value);
            }}
          />
          <ItemInput
            title="“关于我”描述语"
            description="便签卡片上展示的心情寄语"
            configKeyTitle="atelier.about_desc"
            value={String(clientConfig.get("atelier.about_desc") ?? "欢迎光临我的记忆工坊与随笔空间，点击了解更多。")}
            placeholder="欢迎光临我的记忆工坊与随笔空间，点击了解更多。"
            onChange={(value) => {
              setConfigValue("client", "atelier.about_desc", value);
            }}
          />
          <ItemImageInput
            title="“关于我”背景图"
            description="为画廊中的“关于我”便签设置专属艺术背景封面（支持上传图片或输入 URL，留空使用清新纸张质感）"
            configKeyTitle="atelier.about_bg"
            value={String(clientConfig.get("atelier.about_bg") ?? "")}
            placeholder="https://..."
            onChange={(value) => {
              setConfigValue("client", "atelier.about_bg", value);
            }}
            onError={showAlert}
          />

          <ItemTitle title="2. “岁月轨迹”便签设置" />
          <ItemInput
            title="“岁月轨迹”跳转链接"
            description="点击便签时跳转的页面链接"
            configKeyTitle="atelier.timeline_url"
            value={String(clientConfig.get("atelier.timeline_url") ?? "/timeline")}
            placeholder="/timeline"
            onChange={(value) => {
              setConfigValue("client", "atelier.timeline_url", value);
            }}
          />
          <ItemInput
            title="“岁月轨迹”描述语"
            description="便签卡片上展示的时光寄语"
            configKeyTitle="atelier.timeline_desc"
            value={String(clientConfig.get("atelier.timeline_desc") ?? "以时间为轴，串联起每一次灵感与技术实践。")}
            placeholder="以时间为轴，串联起每一次灵感与技术实践。"
            onChange={(value) => {
              setConfigValue("client", "atelier.timeline_desc", value);
            }}
          />
          <ItemImageInput
            title="“岁月轨迹”背景图"
            description="为画廊中的“岁月轨迹”便签设置专属艺术背景封面（支持上传图片或输入 URL，留空使用清新纸张质感）"
            configKeyTitle="atelier.timeline_bg"
            value={String(clientConfig.get("atelier.timeline_bg") ?? "")}
            placeholder="https://..."
            onChange={(value) => {
              setConfigValue("client", "atelier.timeline_bg", value);
            }}
            onError={showAlert}
          />

          <ItemTitle title="3. “日常随想”便签设置" />
          <ItemInput
            title="“日常随想”跳转链接"
            description="点击便签时跳转的页面链接"
            configKeyTitle="atelier.moments_url"
            value={String(clientConfig.get("atelier.moments_url") ?? "/moments")}
            placeholder="/moments"
            onChange={(value) => {
              setConfigValue("client", "atelier.moments_url", value);
            }}
          />
          <ItemInput
            title="“日常随想”描述语"
            description="便签卡片上展示的生活随想"
            configKeyTitle="atelier.moments_desc"
            value={String(clientConfig.get("atelier.moments_desc") ?? "生活碎碎念、朋友圈动态与不设限的日常记录。")}
            placeholder="生活碎碎念、朋友圈动态与不设限的日常记录。"
            onChange={(value) => {
              setConfigValue("client", "atelier.moments_desc", value);
            }}
          />
          <ItemImageInput
            title="“日常随想”背景图"
            description="为画廊中的“日常随想”便签设置专属艺术背景封面（支持上传图片或输入 URL，留空使用清新纸张质感）"
            configKeyTitle="atelier.moments_bg"
            value={String(clientConfig.get("atelier.moments_bg") ?? "")}
            placeholder="https://..."
            onChange={(value) => {
              setConfigValue("client", "atelier.moments_bg", value);
            }}
            onError={showAlert}
          />

          <ItemTitle title="4. “邻家友链”便签设置" />
          <ItemInput
            title="“邻家友链”跳转链接"
            description="点击便签时跳转的页面链接"
            configKeyTitle="atelier.friends_url"
            value={String(clientConfig.get("atelier.friends_url") ?? "/friends")}
            placeholder="/friends"
            onChange={(value) => {
              setConfigValue("client", "atelier.friends_url", value);
            }}
          />
          <ItemInput
            title="“邻家友链”描述语"
            description="便签卡片上展示的友谊寄语"
            configKeyTitle="atelier.friends_desc"
            value={String(clientConfig.get("atelier.friends_desc") ?? "漫步在同好博主的数字花园，交换思想火花。")}
            placeholder="漫步在同好博主的数字花园，交换思想火花。"
            onChange={(value) => {
              setConfigValue("client", "atelier.friends_desc", value);
            }}
          />
          <ItemImageInput
            title="“邻家友链”背景图"
            description="为画廊中的“邻家友链”便签设置专属艺术背景封面（支持上传图片或输入 URL，留空使用清新纸张质感）"
            configKeyTitle="atelier.friends_bg"
            value={String(clientConfig.get("atelier.friends_bg") ?? "")}
            placeholder="https://..."
            onChange={(value) => {
              setConfigValue("client", "atelier.friends_bg", value);
            }}
            onError={showAlert}
          />

          <ItemTitle title="5. “随心探索”便签设置" />
          <ItemInput
            title="“随心探索”跳转链接"
            description="点击便签或回车时跳转的搜索页面链接"
            configKeyTitle="atelier.search_url"
            value={String(clientConfig.get("atelier.search_url") ?? "/search")}
            placeholder="/search"
            onChange={(value) => {
              setConfigValue("client", "atelier.search_url", value);
            }}
          />
          <ItemInput
            title="“随心探索”描述语"
            description="便签卡片上展示的探索寄语"
            configKeyTitle="atelier.search_desc"
            value={String(clientConfig.get("atelier.search_desc") ?? "输入关键词即刻检索文章与解决方案。")}
            placeholder="输入关键词即刻检索文章与解决方案。"
            onChange={(value) => {
              setConfigValue("client", "atelier.search_desc", value);
            }}
          />
          <ItemImageInput
            title="“随心探索”背景图"
            description="为画廊中的“随心探索”便签设置专属艺术背景封面（支持上传图片或输入 URL，留空使用清新纸张质感）"
            configKeyTitle="atelier.search_bg"
            value={String(clientConfig.get("atelier.search_bg") ?? "")}
            placeholder="https://..."
            onChange={(value) => {
              setConfigValue("client", "atelier.search_bg", value);
            }}
            onError={showAlert}
          />

          <ItemTitle title="6. “记忆翻动”卡片设置" />
          <ItemInput
            title="“记忆翻动”跳转链接"
            description="点击卡片中“漫游图床画廊”按钮时跳转的页面链接"
            configKeyTitle="atelier.deck_url"
            value={String(clientConfig.get("atelier.deck_url") ?? "/gallery")}
            placeholder="/gallery"
            onChange={(value) => {
              setConfigValue("client", "atelier.deck_url", value);
            }}
          />
          <ItemInput
            title="“记忆翻动”描述语"
            description="卡片上展示的相片收录说明文字"
            configKeyTitle="atelier.deck_desc"
            value={String(clientConfig.get("atelier.deck_desc") ?? "漫游图床画廊，浏览大图并复制链接。")}
            placeholder="漫游图床画廊，浏览大图并复制链接。"
            onChange={(value) => {
              setConfigValue("client", "atelier.deck_desc", value);
            }}
          />
          <ItemImageInput
            title="“记忆翻动”背景图"
            description="为画廊中的“记忆翻动”卡片设置专属艺术背景封面（支持上传图片或输入 URL，留空使用清新纸张质感）"
            configKeyTitle="atelier.deck_bg"
            value={String(clientConfig.get("atelier.deck_bg") ?? "")}
            placeholder="https://..."
            onChange={(value) => {
              setConfigValue("client", "atelier.deck_bg", value);
            }}
            onError={showAlert}
          />
        </div>
      )}

      {/* Tab 4: Extensions & Services Settings */}
      {activeCategory === "services" && (
        <div className="w-full flex flex-col space-y-3 ani-show">
          <ItemTitle title={t("settings.webhook.title")} />
          <ItemInput
            title={t("settings.webhook.url.title")}
            description={t("settings.webhook.url.desc")}
            configKeyTitle="WEBHOOK_URL"
            value={String(serverConfig.get("webhook_url") ?? "")}
            placeholder="https://example.com/webhook"
            onChange={(value) => {
              setConfigValue("server", "webhook_url", value);
            }}
          />
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.webhook.method.title")}
                    description={t("settings.webhook.method.desc")}
                  />
                }
                action={
                  <SearchableSelect
                    value={String(serverConfig.get("webhook.method") ?? "")}
                    onChange={(value) => {
                      setConfigValue("server", "webhook.method", value);
                    }}
                    options={WEBHOOK_METHOD_OPTIONS}
                    placeholder={String(serverConfig.default("webhook.method") ?? "POST")}
                    searchPlaceholder={t("settings.webhook.method.title")}
                    emptyLabel={t("no_more")}
                    allowCustomValue
                    customValueLabel={(value) => `${t("update.title")}: ${value}`}
                  />
                }
              />
            </SettingsCard>
          </div>
          <ItemInput
            title={t("settings.webhook.content_type.title")}
            description={t("settings.webhook.content_type.desc")}
            configKeyTitle="Content-Type"
            value={String(serverConfig.get("webhook.content_type") ?? "")}
            placeholder={String(serverConfig.default("webhook.content_type") ?? "application/json")}
            onChange={(value) => {
              setConfigValue("server", "webhook.content_type", value);
            }}
          />
          <ItemInput
            title={t("settings.webhook.headers.title")}
            description={t("settings.webhook.headers.desc")}
            configKeyTitle={t("settings.webhook.headers.label")}
            value={String(serverConfig.get("webhook.headers") ?? "")}
            placeholder={String(serverConfig.default("webhook.headers") ?? "{}")}
            onChange={(value) => {
              setConfigValue("server", "webhook.headers", value);
            }}
          />
          <ItemInput
            title={t("settings.webhook.body_template.title")}
            description={t("settings.webhook.body_template.desc")}
            configKeyTitle={t("settings.webhook.body_template.label")}
            value={String(serverConfig.get("webhook.body_template") ?? "")}
            placeholder={String(serverConfig.default("webhook.body_template") ?? "")}
            onChange={(value) => {
              setConfigValue("server", "webhook.body_template", value);
            }}
          />
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.webhook.test.title")}
                    description={t("settings.webhook.test.desc")}
                  />
                }
                action={
                  <Button
                    title={testingWebhook ? t("settings.webhook.test.sending") : t("settings.webhook.test.button")}
                    onClick={handleTestWebhook}
                    disabled={testingWebhook}
                  />
                }
              />
              <SettingsCardBody>
                <textarea
                  value={webhookTestMessage}
                  placeholder={t("settings.webhook.test.placeholder")}
                  onChange={(event) => {
                    setWebhookTestMessage(event.target.value);
                  }}
                  className="min-h-28 w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
                />
              </SettingsCardBody>
            </SettingsCard>
          </div>

          <ItemTitle title={t("settings.friend.title")} />
          <ItemSwitch
            title={t("settings.friend.apply.title")}
            description={t("settings.friend.apply.desc")}
            checked={Boolean(clientConfig.get("friend_apply_enable"))}
            onChange={(checked) => {
              setConfigValue("client", "friend_apply_enable", checked);
            }}
          />
          <ItemSwitch
            title={t("settings.friend.health.title")}
            description={t("settings.friend.health.desc")}
            checked={Boolean(serverConfig.get("friend_crontab"))}
            onChange={(checked) => {
              setConfigValue("server", "friend_crontab", checked);
            }}
          />
          <ItemInput
            title={t("settings.friend.health.ua.title")}
            description={t("settings.friend.health.ua.desc")}
            configKeyTitle="User-Agent"
            value={String(serverConfig.get("friend_ua") ?? "")}
            placeholder={String(serverConfig.default("friend_ua") ?? "User-Agent")}
            onChange={(value) => {
              setConfigValue("server", "friend_ua", value);
            }}
          />

          <ItemTitle title={t("settings.maintenance.title")} />
          <ItemSwitch
            title={t("settings.cache.enabled.title")}
            description={t("settings.cache.enabled.desc")}
            checked={Boolean(clientConfig.getBoolean("cache.enabled"))}
            onChange={(checked) => {
              setConfigValue("client", "cache.enabled", checked);
            }}
          />
          <ItemButton
            title={t("settings.cache.clear.title")}
            description="仅清空边缘 KV 缓存与预渲染结果，绝不影响数据库、已发布文章与上传的图片，用于修改配置后强制刷新边缘节点"
            buttonTitle={t("clear")}
            onConfirm={async () => {
              await client.config.clearCache().then(({ error }) => {
                if (error) {
                  showAlert(t("settings.cache.clear_failed$message", { message: error.value }));
                }
              });
            }}
            alertTitle={t("settings.cache.clear.confirm.title")}
            alertDescription="确定要清除所有边缘缓存吗？该操作不会删除任何文章或文件数据。"
          />
          <ItemWithUpload
            title={t("settings.wordpress.title")}
            description="从 WordPress 导入（上传从 WordPress 后台导出的 WXR .xml 文件，将历史文章、分类及标签无损迁移到本博客系统中）"
            accept="application/xml"
            onFileChange={onFileChange}
          />

          <AISummarySettings
            value={aiValue}
            onChange={(updates) => {
              if (updates.enabled !== undefined) {
                setConfigValue("server", "ai_summary.enabled", updates.enabled);
              }
              if (updates.provider !== undefined) {
                setConfigValue("server", "ai_summary.provider", updates.provider);
              }
              if (updates.model !== undefined) {
                setConfigValue("server", "ai_summary.model", updates.model);
              }
              if (updates.apiUrl !== undefined) {
                setConfigValue("server", "ai_summary.api_url", updates.apiUrl);
              }
              if (updates.apiKey !== undefined) {
                setConfigValue("server", "ai_summary.api_key", updates.apiKey);
              }
            }}
          />
        </div>
      )}

          {hasUnsavedChanges && (
            <div className="sticky bottom-4 z-20 mt-6 w-full pb-2">
              <SettingsCard tone="warning">
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title={t("settings.ai_summary.save.title")}
                    description={t("settings.ai_summary.unsaved_changes")}
                    badge={<SettingsBadge tone="warning">{t("settings.ai_summary.unsaved_changes")}</SettingsBadge>}
                  />
                }
                action={
                  <>
                    <Button secondary title={t("reset")} onClick={handleReset} disabled={saving} />
                    <Button title={t("save")} onClick={handleSave} disabled={saving || loading} />
                  </>
                }
              />
              </SettingsCard>
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
            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="h-min rounded-xl bg-theme px-8 py-2 text-white"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </Modal>
      <AlertUI />
    </div>
  );
}
