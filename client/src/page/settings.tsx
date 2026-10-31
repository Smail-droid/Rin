import { Modal, SearchableSelect, SettingsBadge, SettingsCard, SettingsCardBody, SettingsCardHeader, SettingsCardRow } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useSearch } from "wouter";
import ReactLoading from "react-loading";
import { client, oauth_url } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog.tsx";
import { HeaderLayoutPreview } from "../components/site-header/layout-preview";
import {
  HEADER_LAYOUT_OPTIONS,
  normalizeHeaderBehavior,
  normalizeHeaderLayout,
} from "../components/site-header/layout-options";
import { FEED_CARD_VARIANTS, normalizeFeedCardVariant } from "../components/feed-card-options";
import { FeedCardPreview } from "../components/feed-card-preview";
import { FEED_LAYOUT_OPTIONS, normalizeFeedLayout } from "../components/feed-layout-options";
import { useSiteConfig } from "../hooks/useSiteConfig";
import {
  applyArtTitleColor,
  applyThemeColor,
  normalizeThemeColor,
  applyThemeOpacity,
  normalizeThemeOpacity,
  applyThemeFontSize,
  THEME_PRESETS,
  ACCENT_COLOR_PRESETS,
  OPACITY_SHORTCUTS,
} from "../utils/theme-color";
import { getStoredThemeMode, setThemeMode, type ThemeMode } from "../utils/darkModeUtils";
import { AISummarySettings } from "./settings-ai";
import { ItemButton, ItemEmojiInput, ItemImageInput, ItemInput, ItemSwitch, ItemTitle, ItemWithUpload } from "./settings-items";
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

const ABOUT_PRESET_EMOJIS = ["🐾", "🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐯", "🦄", "☕", "🍵", "🍀", "🌿", "🌸", "🎧", "🎮", "💻", "🎨", "🪄", "👑", "✨", "🌻", "🐣", "🍧"];
const TIMELINE_PRESET_EMOJIS = ["⏳", "⌛", "⏰", "⏱️", "🕰️", "📅", "📆", "🗓️", "📜", "🧭", "⚓", "🏹", "🛸", "🚀", "🌠", "🌌", "🪐", "🍂", "🍁", "🌊", "🏛️", "⛩️", "🕯️", "🔮"];
const MOMENTS_PRESET_EMOJIS = ["💭", "💬", "🫧", "💡", "☕", "🍃", "🌤️", "🌈", "🎈", "🎵", "📖", "📝", "📮", "💌", "🍺", "🥂", "🥐", "🍰", "🧁", "🌻", "🧸", "🪁", "🎐", "🍬"];
const FRIENDS_PRESET_EMOJIS = ["🌸", "🌺", "🌷", "🌹", "💐", "🏡", "🏠", "🏘️", "🏰", "🤝", "👫", "👭", "👬", "💌", "🌐", "🛸", "🪴", "🍄", "🎁", "🎉", "🎈", "🍭", "🌟", "✨"];
const SEARCH_PRESET_EMOJIS = ["🔍", "🔎", "🧭", "🔭", "🔬", "🗺️", "🗝️", "🔮", "🎯", "🏹", "💡", "⚡", "📡", "🛸", "🕵️‍♂️", "🕵️‍♀️", "🧠", "📚", "🔖", "💎", "🛰️", "🚀", "💫", "🧐"];
const DECK_PRESET_EMOJIS = ["🎴", "🃏", "📸", "📷", "🎞️", "🖼️", "🎨", "🖌️", "🎬", "🎭", "🎪", "🎡", "🎠", "🎆", "🎇", "🌠", "🌅", "🌄", "🎑", "📽️", "📼", "🔮", "🪩", "✨"];

const ATELIER_TITLE_STYLES = [
  { id: "aurora_flow", name: "彩虹极光流光", desc: "随主题流动平滑渐变流光，灵动惊艳" },
  { id: "glass_glow", name: "琉璃晶透微光", desc: "半透悬浮晶体，泛出柔和呼吸微光" },
  { id: "cyber_neon", name: "赛博电光霓虹", desc: "极客双色电光，未来感霓虹光束" },
  { id: "ink_calligraphy", name: "水墨宣纸书卷", desc: "东方传统宣纸水墨渐变，诗意毛笔风骨" },
  { id: "golden_sunset", name: "落日熔金流光", desc: "晚霞熔金渐变，治愈温暖暮色" },
  { id: "emboss_3d", name: "现代立体浮雕", desc: "极简光影立体凹凸，干净利落" },
  { id: "classic_clean", name: "经典纯净黑体", desc: "质朴沉稳，高对比极简纯色" },
];

export function Settings() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const initialCategoryParam = searchParams.get("tab") as "general" | "theme" | "atelier" | "services" | null;
  const focusTarget = searchParams.get("focus");

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
  const [activeCategory, setActiveCategory] = useState<"general" | "theme" | "atelier" | "services">(
    initialCategoryParam && ["general", "theme", "atelier", "services"].includes(initialCategoryParam)
      ? initialCategoryParam
      : "general"
  );
  const [activeThemeMode, setActiveThemeMode] = useState<ThemeMode>(getStoredThemeMode());

  // URL tab change synchronizer
  useEffect(() => {
    const tabParam = searchParams.get("tab") as "general" | "theme" | "atelier" | "services" | null;
    if (tabParam && ["general", "theme", "atelier", "services"].includes(tabParam)) {
      setActiveCategory(tabParam);
    }
  }, [searchString]);

  // Smooth scroll and focus anchor when jumping from sticky note gear
  useEffect(() => {
    if (!focusTarget) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`setting-atelier-${focusTarget}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-4", "ring-theme/50", "rounded-2xl", "transition-all", "duration-500");
        setTimeout(() => {
          el.classList.remove("ring-4", "ring-theme/50");
        }, 2400);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [focusTarget, activeCategory]);

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
                title="显示顶部站点导航栏"
                description="开启后在全站页面顶部显示导航栏；关闭后前台将完全隐藏顶部导航条，提供极致纯净沉浸视觉（子页面均配备返回按钮）"
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
                    title="顶部站点导航栏（Header）布局样式"
                    description="选择桌面端站点头部导航栏的排布风格（经典居中平衡 或 极简纯文本）"
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
                      label: value === "classic" ? "经典居中" : "极简纯文本",
                    }))}
                    placeholder="选择顶部导航栏布局"
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
                      title={value === "classic" ? "经典居中" : "极简纯文本"}
                      description={value === "classic" ? "品牌、居中导航和操作区保持平衡居中布局。" : "几乎去掉所有装饰，只保留最必要的信息和操作。"}
                      onClick={() => {
                        setConfigValue("client", "header.layout", value);
                      }}
                    />
                  ))}
                </div>
              </SettingsCardBody>

              {/* Homepage Atelier Gallery Layout Customization */}
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <div className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-black/[0.015] p-4 dark:border-white/5 dark:bg-white/[0.02]">
                  <div>
                    <div className="text-sm font-semibold t-primary flex items-center gap-2">
                      <i className="ri-layout-masonry-line text-theme" />
                      <span>首页画廊瀑布流专属排版定制</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      首页已升级为艺术画廊画报流，以下配置将直接控制首页两侧留白边距、画报列数、对齐方式与尺寸
                    </div>
                  </div>

                  {/* Padding Slider & Shortcuts */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                    <div>
                      <div className="text-xs font-semibold t-primary">首页两侧留白边距</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">控制首页主体内容距离屏幕左右两侧的留白空隙</div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1.5">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={120}
                          step={4}
                          value={Number.parseInt(String(clientConfig.get("gallery.padding") ?? 24), 10) || 24}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            setConfigValue("client", "gallery.padding", val);
                          }}
                          className="h-2 w-32 sm:w-44 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/15"
                        />
                        <span className="min-w-14 text-right font-mono text-xs font-bold text-theme">
                          {Number.parseInt(String(clientConfig.get("gallery.padding") ?? 24), 10) || 24}px
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[0, 12, 24, 48, 80].map((px) => {
                          const currentVal = Number.parseInt(String(clientConfig.get("gallery.padding") ?? 24), 10) || 24;
                          const isSelected = currentVal === px;
                          return (
                            <button
                              key={px}
                              type="button"
                              onClick={() => setConfigValue("client", "gallery.padding", px)}
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition select-none ${
                                isSelected
                                  ? "bg-theme text-white shadow-2xs"
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                              }`}
                            >
                              {px === 0 ? "无边距" : `${px}px`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Gallery Columns & Alignment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                    <div>
                      <div className="text-xs font-semibold t-primary mb-1.5">画廊列数控制</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { label: "自适应 Auto", value: "auto" },
                          { label: "2 列", value: "2" },
                          { label: "3 列", value: "3" },
                          { label: "4 列", value: "4" },
                          { label: "5 列", value: "5" },
                        ].map((col) => {
                          const currentCol = String(clientConfig.get("gallery.columns") ?? "auto");
                          const isSelected = currentCol === col.value;
                          return (
                            <button
                              key={col.value}
                              type="button"
                              onClick={() => setConfigValue("client", "gallery.columns", col.value)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition select-none ${
                                isSelected
                                  ? "bg-theme text-white shadow-xs"
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                              }`}
                            >
                              {col.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold t-primary mb-1.5">画廊排版对齐方式</div>
                      <div className="flex items-center gap-1.5">
                        {[
                          { label: "居中聚拢 (Center)", value: "center" },
                          { label: "撑满两端 (Fluid)", value: "fluid" },
                        ].map((align) => {
                          const currentAlign = String(clientConfig.get("gallery.align") ?? "center");
                          const isSelected = currentAlign === align.value;
                          return (
                            <button
                              key={align.value}
                              type="button"
                              onClick={() => setConfigValue("client", "gallery.align", align.value)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition select-none ${
                                isSelected
                                  ? "bg-theme text-white shadow-xs"
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                              }`}
                            >
                              {align.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card Gap & Max Width Fine-tuning */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                    <div>
                      <div className="text-xs font-semibold t-primary">卡片列间距与间隙</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">调节瀑布流每列卡片之间的水平与垂直间隙</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={12}
                        max={48}
                        step={4}
                        value={Number.parseInt(String(clientConfig.get("gallery.card_gap") ?? 24), 10) || 24}
                        onChange={(e) => {
                          const val = Number.parseInt(e.target.value, 10);
                          setConfigValue("client", "gallery.card_gap", val);
                        }}
                        className="h-2 w-32 sm:w-44 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/15"
                      />
                      <span className="min-w-14 text-right font-mono text-xs font-bold text-theme">
                        {Number.parseInt(String(clientConfig.get("gallery.card_gap") ?? 24), 10) || 24}px
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
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
                        调节卡片与窗口的通透度与毛玻璃磨砂程度。已注入环境弥散光晕，调低时可清晰看到背景光晕透出与通透悬浮层次。
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

              {/* Global Typography Scale / Font Size Customization */}
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-black/[0.015] p-4 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold t-primary flex items-center gap-2">
                        <i className="ri-font-size-2 text-theme" />
                        <span>全站正文阅读字号</span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-md">
                        自由调节文章卡片与阅读页面的基准字号，字号越大排版越宽松清晰，字号越小信息密度越高。
                      </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={13}
                          max={20}
                          step={1}
                          value={Number.parseInt(String(clientConfig.get("theme.font_size") ?? 16), 10) || 16}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            setConfigValue("client", "theme.font_size", val);
                            applyThemeFontSize(val);
                          }}
                          className="h-2 w-32 sm:w-44 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/15"
                        />
                        <span className="min-w-12 text-right font-mono text-sm font-bold text-theme">
                          {Number.parseInt(String(clientConfig.get("theme.font_size") ?? 16), 10) || 16}px
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[
                          { px: 14, label: "14px 精致" },
                          { px: 16, label: "16px 标准" },
                          { px: 17, label: "17px 舒适" },
                          { px: 18, label: "18px 宽大" },
                        ].map((item) => {
                          const currentSize = Number.parseInt(String(clientConfig.get("theme.font_size") ?? 16), 10) || 16;
                          const isSelected = currentSize === item.px;
                          return (
                            <button
                              key={item.px}
                              type="button"
                              onClick={() => {
                                setConfigValue("client", "theme.font_size", item.px);
                                applyThemeFontSize(item.px);
                              }}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all select-none ${
                                isSelected
                                  ? "bg-theme text-white shadow-xs scale-105"
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Real-time typography preview */}
                  <div className="mt-1 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                    <p
                      style={{ fontSize: `${Number.parseInt(String(clientConfig.get("theme.font_size") ?? 16), 10) || 16}px` }}
                      className="t-primary leading-relaxed transition-all duration-200"
                    >
                      字号实时预览：岁月不语，惟石能言。每一篇随笔都是长河里静止的浮游微光，在字里行间静候知音。
                    </p>
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

                  {/* Preset Themes Grid (Compact row matching accent palette below) */}
                  <div className="flex flex-col gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold t-primary">风格主题预设</div>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">18 款精选方案 · 紧凑点选</span>
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      内置多套高质感配色方案（极简纸墨、赛博冷萃、和风青空、午夜深邃等），点击即刻全局应用
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
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
                            className={`group relative flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                              isSelected
                                ? "ring-2 ring-offset-2 ring-theme shadow-xs scale-105"
                                : "hover:shadow-xs"
                            }`}
                            style={{
                              backgroundColor: preset.previewBg,
                              border: `1.5px solid ${isSelected ? preset.color : "rgba(0,0,0,0.12)"}`,
                            }}
                          >
                            <span
                              className="h-3.5 w-3.5 rounded-full shadow-2xs transition-transform group-hover:scale-110"
                              style={{ backgroundColor: preset.color }}
                            />
                            {isSelected && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <i className="ri-check-line text-[11px] font-bold text-white drop-shadow-xs" />
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
                      title="顶部导航栏吸顶滚动行为"
                      description="控制页面向下滚动时，顶部导航栏是固定吸顶悬浮、随页面滚出屏幕，还是向上滑动时自动呼出"
                    />
                  }
                  action={
                    <SearchableSelect
                      value={normalizeHeaderBehavior(String(clientConfig.get("header.behavior") ?? "fixed"))}
                      onChange={(value) => {
                        setConfigValue("client", "header.behavior", value);
                      }}
                      options={[
                        { value: "fixed", label: "固定吸顶在顶部 (Fixed)" },
                        { value: "static", label: "跟随页面滚动 (Static)" },
                        { value: "reveal", label: "向上滑动时自动呼出 (Reveal)" },
                      ]}
                      placeholder="顶部导航栏滚动行为"
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

          {/* Artistic Gallery Title Customizer */}
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title="画廊主标题艺术效果定制"
                    description="纯代码实现多种惊艳的艺术标题字效（流光、琉璃、水墨、霓虹等），让首页标题对得起艺术之美"
                  />
                }
                action={
                  <div className="text-xs font-semibold text-theme">
                    {ATELIER_TITLE_STYLES.find((s) => s.id === String(clientConfig.get("atelier.title_style") ?? "aurora_flow"))?.name || "彩虹极光流光"}
                  </div>
                }
              />
              <SettingsCardBody>
                <div className="flex flex-col gap-3">
                  {/* Real-time live preview */}
                  <div className="p-4 rounded-xl border border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-neutral-400 mb-1">当前选中的实时艺术字效预览：</p>
                      <span className={`text-2xl sm:text-3xl font-extrabold art-title-${String(clientConfig.get("atelier.title_style") ?? "aurora_flow")}`}>
                        {String(clientConfig.get("atelier.title") || "画廊随想")}
                      </span>
                    </div>
                  </div>

                  {/* Preset Style Buttons Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {ATELIER_TITLE_STYLES.map((style) => {
                      const currentStyle = String(clientConfig.get("atelier.title_style") ?? "aurora_flow");
                      const isSelected = currentStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setConfigValue("client", "atelier.title_style", style.id)}
                          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "border-theme bg-theme/5 shadow-2xs ring-1 ring-theme"
                              : "border-black/10 bg-w hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={`font-bold text-sm art-title-${style.id}`}>
                              {style.name}
                            </span>
                            {isSelected && <i className="ri-check-line text-theme text-sm" />}
                          </div>
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                            {style.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Art Title Color Option */}
                  <div className="mt-2 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold t-primary">使用自定义艺术标题色彩</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          覆盖默认强调色，自选专属标题光晕与流光基调色彩
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={clientConfig.getBoolean("atelier.title_custom_color_enabled")}
                        onClick={() => {
                          const nextVal = !clientConfig.getBoolean("atelier.title_custom_color_enabled");
                          setConfigValue("client", "atelier.title_custom_color_enabled", nextVal);
                          if (!nextVal) {
                            applyArtTitleColor(undefined);
                          } else {
                            applyArtTitleColor(String(clientConfig.get("atelier.title_color") || themeColorValue));
                          }
                        }}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent transition-colors focus:outline-none ${
                          clientConfig.getBoolean("atelier.title_custom_color_enabled") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                        }`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            clientConfig.getBoolean("atelier.title_custom_color_enabled") ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className={`flex flex-col gap-2 transition-opacity duration-200 ${clientConfig.getBoolean("atelier.title_custom_color_enabled") ? "opacity-100" : "opacity-45 pointer-events-none"}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">艺术标题颜色色谱</div>
                        <div className="font-mono text-xs font-bold text-theme">
                          {String(clientConfig.get("atelier.title_color") || themeColorValue)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {ACCENT_COLOR_PRESETS.map((color) => {
                          const titleColorVal = String(clientConfig.get("atelier.title_color") || themeColorValue).toLowerCase();
                          const isSelected = titleColorVal === color.toLowerCase();
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setConfigValue("client", "atelier.title_color", color);
                                setConfigValue("client", "atelier.title_custom_color_enabled", true);
                                applyArtTitleColor(color);
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

                        {/* Native Color Picker */}
                        <label
                          title="自选专属色盘"
                          className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 via-purple-500 to-sky-500 text-white shadow-xs transition-transform hover:scale-110 active:scale-95"
                        >
                          <i className="ri-palette-line text-xs drop-shadow-xs" />
                          <input
                            type="color"
                            value={String(clientConfig.get("atelier.title_color") || themeColorValue)}
                            onChange={(event) => {
                              const normalized = normalizeThemeColor(event.target.value);
                              setConfigValue("client", "atelier.title_color", normalized);
                              setConfigValue("client", "atelier.title_custom_color_enabled", true);
                              applyArtTitleColor(normalized);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsCardBody>
            </SettingsCard>
          </div>

          <div id="setting-atelier-about" className="space-y-3 p-3.5 rounded-2xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02]">
            <ItemTitle title="1. “关于我”便签设置" />
            <ItemEmojiInput
              title="“关于我”便签图标 (Emoji / 符号)"
              description="便签左上角个性符号（博主/身份专属推荐：🐾 🐱 🐶 🦊 🐼 🐨 🦁 🐯 🦄 ☕ 🍵 🍀 🌿 🌸 🎧 🎮 💻 🎨 🪄 👑 ✨ 🌻 🐣 🍧 等，可点击快速填入或自行输入）"
              configKeyTitle="atelier.about_icon"
              value={String(clientConfig.get("atelier.about_icon") ?? "🐾")}
              placeholder="🐾"
              presetEmojis={ABOUT_PRESET_EMOJIS}
              onChange={(value) => {
                setConfigValue("client", "atelier.about_icon", value);
              }}
            />
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
          </div>

          <div id="setting-atelier-timeline" className="space-y-3 p-3.5 rounded-2xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02]">
            <ItemTitle title="2. “岁月轨迹”便签设置" />
            <ItemEmojiInput
              title="“岁月轨迹”便签图标 (Emoji / 符号)"
              description="便签左上角个性符号（岁月/刻度专属推荐：⏳ ⌛ ⏰ ⏱️ 🕰️ 📅 📆 🗓️ 📜 🧭 ⚓ 🏹 🛸 🚀 🌠 🌌 🪐 🍂 🍁 🌊 🏛️ ⛩️ 🕯️ 🔮 等，可点击快速填入或自行输入）"
              configKeyTitle="atelier.timeline_icon"
              value={String(clientConfig.get("atelier.timeline_icon") ?? "⏳")}
              placeholder="⏳"
              presetEmojis={TIMELINE_PRESET_EMOJIS}
              onChange={(value) => {
                setConfigValue("client", "atelier.timeline_icon", value);
              }}
            />
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
          </div>

          <div id="setting-atelier-moments" className="space-y-3 p-3.5 rounded-2xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02]">
            <ItemTitle title="3. “日常随想”便签设置" />
            <ItemEmojiInput
              title="“日常随想”便签图标 (Emoji / 符号)"
              description="便签左上角个性符号（灵感/随笔专属推荐：💭 💬 🫧 💡 ☕ 🍃 🌤️ 🌈 🎈 🎵 📖 📝 📮 💌 🍺 🥂 🥐 🍰 🧁 🌻 🧸 🪁 🎐 🍬 等，可点击快速填入或自行输入）"
              configKeyTitle="atelier.moments_icon"
              value={String(clientConfig.get("atelier.moments_icon") ?? "💭")}
              placeholder="💭"
              presetEmojis={MOMENTS_PRESET_EMOJIS}
              onChange={(value) => {
                setConfigValue("client", "atelier.moments_icon", value);
              }}
            />
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
          </div>

          <div id="setting-atelier-friends" className="space-y-3 p-3.5 rounded-2xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02]">
            <ItemTitle title="4. “邻家友链”便签设置" />
            <ItemEmojiInput
              title="“邻家友链”便签图标 (Emoji / 符号)"
              description="便签左上角个性符号（邻里/友谊专属推荐：🌸 🌺 🌷 🌹 💐 🏡 🏠 🏘️ 🏰 🤝 👫 👭 👬 💌 🌐 🛸 🪴 🍄 🎁 🎉 🎈 🍭 🌟 ✨ 等，可点击快速填入或自行输入）"
              configKeyTitle="atelier.friends_icon"
              value={String(clientConfig.get("atelier.friends_icon") ?? "🌸")}
              placeholder="🌸"
              presetEmojis={FRIENDS_PRESET_EMOJIS}
              onChange={(value) => {
                setConfigValue("client", "atelier.friends_icon", value);
              }}
            />
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
          </div>

          <div id="setting-atelier-search" className="space-y-3 p-3.5 rounded-2xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02]">
            <ItemTitle title="5. “随心探索”便签设置" />
            <ItemEmojiInput
              title="“随心探索”便签图标 (Emoji / 符号)"
              description="便签左上角个性符号（探索/检索专属推荐：🔍 🔎 🧭 🔭 🔬 🗺️ 🗝️ 🔮 🎯 🏹 💡 ⚡ 📡 🛸 🕵️‍♂️ 🕵️‍♀️ 🧠 📚 🔖 💎 🛰️ 🚀 💫 🧐 等，可点击快速填入或自行输入）"
              configKeyTitle="atelier.search_icon"
              value={String(clientConfig.get("atelier.search_icon") ?? "🔍")}
              placeholder="🔍"
              presetEmojis={SEARCH_PRESET_EMOJIS}
              onChange={(value) => {
                setConfigValue("client", "atelier.search_icon", value);
              }}
            />
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
          </div>

          <div id="setting-atelier-deck" className="space-y-3 p-3.5 rounded-2xl border border-black/5 bg-black/[0.015] dark:border-white/5 dark:bg-white/[0.02]">
            <ItemTitle title="6. “记忆翻动”卡片设置" />
            <ItemEmojiInput
              title="“记忆翻动”卡片图标 (Emoji / 符号)"
              description="卡片翻转个性符号（图床/画廊专属推荐：🎴 🃏 📸 📷 🎞️ 🖼️ 🎨 🖌️ 🎬 🎭 🎪 🎡 🎠 🎆 🎇 🌠 🌅 🌄 🎑 📽️ 📼 🔮 🪩 ✨ 等，可点击快速填入或自行输入）"
              configKeyTitle="atelier.deck_icon"
              value={String(clientConfig.get("atelier.deck_icon") ?? "🎴")}
              placeholder="🎴"
              presetEmojis={DECK_PRESET_EMOJIS}
              onChange={(value) => {
                setConfigValue("client", "atelier.deck_icon", value);
              }}
            />
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
