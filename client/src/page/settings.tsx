import { Modal, SearchableSelect, SettingsBadge, SettingsCard, SettingsCardBody, SettingsCardHeader, SettingsCardRow } from "@rin/ui";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link, useSearch } from "wouter";
import ReactLoading from "react-loading";
import { client } from "../app/runtime";
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
import { ItemButton, ItemImageInput, ItemInput, ItemSwitch, ItemTitle, ItemWithUpload } from "./settings-items";
import { ImageUploadInput } from "../components/image-upload-input";
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

const ABOUT_PRESET_EMOJIS = ["🐾", "🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐯", "🦄", "☕", "🍵", "🍀", "🌿", "🌸", "🎧", "🎮", "💻", "🎨", "🌟", "👑", "✨", "🌻", "🐣", "🍧"];
const TIMELINE_PRESET_EMOJIS = ["⏳", "⌛", "⏰", "⏱️", "🕰️", "📅", "📆", "🗓️", "📜", "🧭", "⚓", "🏹", "🛸", "🚀", "🌠", "🌌", "🪐", "🍂", "🍁", "🌊", "🏛️", "⛩️", "🕯️", "🔮"];
const MOMENTS_PRESET_EMOJIS = ["💭", "💬", "🫧", "💡", "☕", "🍃", "🌤️", "🌈", "🎈", "🎵", "📖", "📝", "📮", "💌", "🍺", "🥂", "🥐", "🍰", "🧁", "🌻", "🧸", "🪁", "🎐", "🍬"];
const FRIENDS_PRESET_EMOJIS = ["🌸", "🌺", "🌷", "🌹", "💐", "🏡", "🏠", "🏘️", "🏰", "🤝", "👫", "👭", "👬", "💌", "🌐", "🛸", "🪴", "🍄", "🎁", "🎉", "🎈", "🍭", "🌟", "✨"];
const SEARCH_PRESET_EMOJIS = ["🔍", "🔎", "🧭", "🔭", "🔬", "🗺️", "🗝️", "🔮", "🎯", "🏹", "💡", "⚡", "📡", "🛸", "🕵️‍♂️", "🕵️‍♀️", "🧠", "📚", "🔖", "💎", "🛰️", "🚀", "💫", "🧐"];
const DECK_PRESET_EMOJIS = ["🎴", "🃏", "📸", "📷", "🎞️", "🖼️", "🎨", "🖌️", "🎬", "🎭", "🎪", "🎡", "🎠", "🎆", "🎇", "🌠", "🌅", "🌄", "🎑", "📽️", "📼", "🔮", "💎", "✨"];

const ATELIER_TITLE_STYLES = [
  { id: "aurora_flow", name: "彩虹极光流光", desc: "随主题流动平滑渐变流光，灵动惊艳" },
  { id: "glass_glow", name: "琉璃晶透微光", desc: "半透悬浮晶体，泛出柔和呼吸微光" },
  { id: "cyber_neon", name: "赛博电光霓虹", desc: "极客双色电光，未来感霓虹光束" },
  { id: "ink_calligraphy", name: "水墨宣纸书卷", desc: "东方传统宣纸水墨渐变，诗意毛笔风骨" },
  { id: "golden_sunset", name: "落日熔金流光", desc: "晚霞熔金渐变，治愈温暖暮色" },
  { id: "emboss_3d", name: "现代立体浮雕", desc: "极简光影立体凹凸，干净利落" },
  { id: "classic_clean", name: "经典纯净黑体", desc: "质朴沉稳，高对比极简纯色" },
  { id: "pixel_arcade", name: "复古像素街机", desc: "8-bit经典红白机街机，极客点阵情怀" },
  { id: "candy_dream", name: "二次元梦幻软糖", desc: "萌系晶莹圆体，梦幻Q弹粉紫泡泡" },
  { id: "gothic_metal", name: "暗夜哥特金属", desc: "冷冽银白暗夜流光，古典典雅风度" },
  { id: "vaporwave_80s", name: "蒸汽波复古浪潮", desc: "80s复古霓虹与青粉色差分离美学" },
  { id: "starlight_cosmic", name: "星空极夜璀璨", desc: "深邃蓝紫星河粒子光晕，浩瀚神秘" },
];

const STICKY_NOTES_CONFIG = [
  {
    id: "about" as const,
    name: "关于我",
    subKey: "atelier.about",
    defaultIcon: "🐾",
    defaultUrl: "/about",
    defaultDesc: "欢迎光临我的记忆工坊与随笔空间，点击了解更多。",
    presetEmojis: ABOUT_PRESET_EMOJIS,
  },
  {
    id: "timeline" as const,
    name: "岁月轨迹",
    subKey: "atelier.timeline",
    defaultIcon: "⏳",
    defaultUrl: "/timeline",
    defaultDesc: "以时间为轴，串联起每一次灵感与技术实践。",
    presetEmojis: TIMELINE_PRESET_EMOJIS,
  },
  {
    id: "moments" as const,
    name: "朋友圈动态",
    subKey: "atelier.moments",
    defaultIcon: "💭",
    defaultUrl: "/moments",
    defaultDesc: "生活碎碎念、朋友圈动态与不设限的日常记录。",
    presetEmojis: MOMENTS_PRESET_EMOJIS,
  },
  {
    id: "friends" as const,
    name: "邻家友链",
    subKey: "atelier.friends",
    defaultIcon: "🌸",
    defaultUrl: "/friends",
    defaultDesc: "漫步在同好博主的数字花园，交换思想火花。",
    presetEmojis: FRIENDS_PRESET_EMOJIS,
  },
  {
    id: "search" as const,
    name: "随心探索",
    subKey: "atelier.search",
    defaultIcon: "🔍",
    defaultUrl: "/search",
    defaultDesc: "输入关键词即刻检索文章与解决方案。",
    presetEmojis: SEARCH_PRESET_EMOJIS,
  },
  {
    id: "deck" as const,
    name: "记忆翻动底片",
    subKey: "atelier.deck",
    defaultIcon: "🎴",
    defaultUrl: "/gallery",
    defaultDesc: "漫游图床画廊，浏览大图并复制链接。",
    presetEmojis: DECK_PRESET_EMOJIS,
  },
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

  const [activeCoverModal, setActiveCoverModal] = useState<{
    id: string;
    name: string;
    configKey: string;
  } | null>(null);
  const [activeEmojiPopover, setActiveEmojiPopover] = useState<string | null>(null);

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
  const enabledNotesCount = useMemo(() => {
    return STICKY_NOTES_CONFIG.filter((note) => {
      const val = clientConfig.get(`atelier.${note.id}_show`);
      return val !== false && val !== "false";
    }).length;
  }, [clientConfig]);
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
      <main className="w-full rounded-2xl bg-w pb-32" aria-label={t("main_content")}>
        <div className="flex flex-col items-start space-y-4 w-full">
          {(loading || saving) && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}

          {/* Top Category Tabs (Modular Settings Navigation) */}
          <div className="flex w-full items-center justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {[
                { id: "general", label: "基础设置", icon: "ri-settings-4-line" },
                { id: "theme", label: "主题与布局", icon: "ri-palette-line" },
                { id: "atelier", label: "进阶设置", icon: "ri-magic-line" },
                { id: "services", label: "扩展服务", icon: "ri-apps-2-line" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id as any)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition select-none ${
                    activeCategory === tab.id
                      ? "bg-theme text-white shadow-xs scale-[1.02]"
                      : "bg-black/5 hover:bg-black/10 text-neutral-600 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                  }`}
                >
                  <i className={`${tab.icon} text-sm`} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* 紧凑型系统状态指标胶囊 (iKuai 状态感) */}
            <div className="hidden md:flex items-center gap-2 text-xs font-mono shrink-0 select-none">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>Worker 边缘就绪</span>
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20">
                <span>R2 存储桶已连接</span>
              </span>
            </div>
          </div>

          {/* Tab 1: General Settings (画廊概览切片仪表盘风格) */}
          {activeCategory === "general" && (
            <div className="w-full flex flex-col space-y-4 ani-show">
              {/* 顶部：站点综合运行中枢与参数透视 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-theme/10 text-theme text-2xl shadow-2xs">
                    <i className="ri-dashboard-3-line" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold t-primary">画廊站点核心配置中枢</h2>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        边缘实时生效
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      集中管控画廊博客身份、全站导航排布、交互功能总闸与访客统计
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono self-start sm:self-auto">
                  <span className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 text-neutral-500">
                    页面容量: {String(clientConfig.get("site.page_size") || 12)} 篇/页
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-theme/10 text-theme font-bold">
                    导航模式: {String(clientConfig.get("header.position") || "top") === "float" ? "居中浮动" : String(clientConfig.get("header.position") || "top") === "bottom" ? "底部挂件" : "顶部固定"}
                  </span>
                </div>
              </div>

              {/* 切片 1: 站点基本身份工坊 (2 列卡片) */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-user-smile-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">站点身份与展示规范 (Branding)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    title={t("settings.site.page_size.title")}
                    description={t("settings.site.page_size.desc")}
                    configKeyTitle={t("settings.site.page_size.label")}
                    value={String(clientConfig.get("site.page_size") ?? "")}
                    placeholder={String(clientConfig.default("site.page_size") ?? t("settings.site.page_size.label"))}
                    onChange={(value) => {
                      setConfigValue("client", "site.page_size", value);
                    }}
                  />
                </div>

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
              </div>

              {/* 切片 2: 全站导航条位置与挂件模式 (iKuai 风格切换卡片) */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <i className="ri-layout-top-line text-theme text-base" />
                    <h3 className="text-sm font-bold t-primary">前台导航条排布位置与挂件形态</h3>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    支持一键切换为顶部常规导航条、居中悬浮极光胶囊或底部轻便挂件，提供不同的视觉沉浸感
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                  {[
                    { id: "top", label: "顶部固定", icon: "ri-layout-top-line" },
                    { id: "float", label: "居中浮动胶囊", icon: "ri-capsule-line" },
                    { id: "bottom", label: "底部便携挂件", icon: "ri-layout-bottom-line" },
                  ].map((pos) => {
                    const currentPos = String(clientConfig.get("header.position") || "top");
                    const isSelected = currentPos === pos.id;
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setConfigValue("client", "header.position", pos.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition select-none ${
                          isSelected
                            ? "bg-theme text-white shadow-xs font-bold scale-102"
                            : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                        }`}
                      >
                        <i className={pos.icon} />
                        <span>{pos.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 切片 3: 全站功能总闸矩阵 (iKuai 2x3 模块化卡片切片) */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-toggle-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">全站核心功能开关矩阵 (Feature Toggles)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* 开关 1: 导航栏显隐 */}
                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">启用全站导航栏</span>
                      <span className="text-[11px] text-neutral-400 block truncate">前台是否呈现导航条</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={clientConfig.get("header.show_nav") === true || clientConfig.get("header.show_nav") === "true"}
                      onClick={() => {
                        const cur = clientConfig.get("header.show_nav") === true || clientConfig.get("header.show_nav") === "true";
                        setConfigValue("client", "header.show_nav", !cur);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        (clientConfig.get("header.show_nav") === true || clientConfig.get("header.show_nav") === "true") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                        (clientConfig.get("header.show_nav") === true || clientConfig.get("header.show_nav") === "true") ? "translate-x-4.5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* 开关 2: 访客登录 */}
                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">开放访客登录</span>
                      <span className="text-[11px] text-neutral-400 block truncate">允许前台账户登录入口</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={clientConfig.getBoolean("login.enabled")}
                      onClick={() => setConfigValue("client", "login.enabled", !clientConfig.getBoolean("login.enabled"))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        clientConfig.getBoolean("login.enabled") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                        clientConfig.getBoolean("login.enabled") ? "translate-x-4.5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* 开关 3: 留言评论系统 */}
                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">留言板与文章评论</span>
                      <span className="text-[11px] text-neutral-400 block truncate">全站互动留言评论体系</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={clientConfig.getBoolean("comment.enabled")}
                      onClick={() => setConfigValue("client", "comment.enabled", !clientConfig.getBoolean("comment.enabled"))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        clientConfig.getBoolean("comment.enabled") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                        clientConfig.getBoolean("comment.enabled") ? "translate-x-4.5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* 开关 4: 访问统计 PV/UV */}
                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">阅读计数器 (PV/UV)</span>
                      <span className="text-[11px] text-neutral-400 block truncate">文章独立访客与浏览统计</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={clientConfig.getBoolean("counter.enabled")}
                      onClick={() => setConfigValue("client", "counter.enabled", !clientConfig.getBoolean("counter.enabled"))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        clientConfig.getBoolean("counter.enabled") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                        clientConfig.getBoolean("counter.enabled") ? "translate-x-4.5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* 开关 5: 原生 RSS 订阅源 */}
                  <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs t-primary block truncate">原生 RSS 订阅源</span>
                      <span className="text-[11px] text-neutral-400 block truncate">提供 /feed 和 /rss.xml</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={clientConfig.getBoolean("rss")}
                      onClick={() => setConfigValue("client", "rss", !clientConfig.getBoolean("rss"))}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        clientConfig.getBoolean("rss") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                        clientConfig.getBoolean("rss") ? "translate-x-4.5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* 切片快捷导航: 快速直达进阶便签表格 */}
                  <div className="p-3.5 rounded-xl border border-theme/20 bg-theme/[0.04] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-theme block truncate">便签超级表格</span>
                      <span className="text-[11px] text-neutral-400 block truncate">管理首屏 6 大互动便签</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCategory("atelier")}
                      className="px-2.5 py-1 rounded-lg bg-theme text-white font-bold text-xs shadow-2xs hover:bg-theme-hover transition"
                    >
                      立即前往 &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* 切片 4: 图标上传与页脚全局 HTML 代码 */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
                  <i className="ri-code-box-line text-theme text-base" />
                  <h3 className="font-bold text-sm t-primary">站点图标 (Favicon) 与全局自定义注入</h3>
                </div>

                <ItemWithUpload
                  title={t("settings.favicon.title")}
                  description={t("settings.favicon.desc")}
                  accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon"
                  onFileChange={handleFaviconChange}
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

                  {/* Preset Style Buttons Grid (4列3行完美对称布局) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-1">
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

          {/* 画廊随想便签阵列配置 iKuai 风格超级数据表格 (Dense DataGrid) */}
          <div className="w-full flex flex-col space-y-3 ani-show">
            {/* 顶栏控制中枢 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme/10 text-theme text-xl shadow-2xs">
                  <i className="ri-layout-grid-line" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base t-primary">便签阵列管理 (Dense DataGrid)</h3>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      enabledNotesCount === STICKY_NOTES_CONFIG.length
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : enabledNotesCount > 0
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-neutral-500/10 text-neutral-500"
                    }`}>
                      已启用 {enabledNotesCount} / {STICKY_NOTES_CONFIG.length}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    集中调控画廊首屏交错便签的显隐、展示形态、跳转目标与艺术背景封面
                  </p>
                </div>
              </div>

              {/* 批量操作工具 */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    STICKY_NOTES_CONFIG.forEach((note) => {
                      setConfigValue("client", `atelier.${note.id}_show`, true);
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition flex items-center gap-1 select-none"
                >
                  <i className="ri-checkbox-circle-line" />
                  <span>全部开启</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    STICKY_NOTES_CONFIG.forEach((note) => {
                      setConfigValue("client", `atelier.${note.id}_show`, false);
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition flex items-center gap-1 select-none"
                >
                  <i className="ri-close-circle-line" />
                  <span>全部关闭</span>
                </button>
              </div>
            </div>

            {/* iKuai 风格超级表格主体 */}
            <div className="rounded-2xl border border-black/10 bg-w dark:border-white/10 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                  <thead>
                    <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] select-none text-neutral-500 dark:text-neutral-400 font-mono">
                      <th className="py-3 px-3 w-16 text-center">序号/图标</th>
                      <th className="py-3 px-3 w-36">便签名称</th>
                      <th className="py-3 px-3 w-24 text-center">首屏展示</th>
                      <th className="py-3 px-3 w-40">视觉形态</th>
                      <th className="py-3 px-3 w-44">跳转链接</th>
                      <th className="py-3 px-3">心情描述语</th>
                      <th className="py-3 px-3 w-28 text-center">专属背景图</th>
                      <th className="py-3 px-3 w-20 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STICKY_NOTES_CONFIG.map((note) => {
                      const isShow = clientConfig.get(`atelier.${note.id}_show`) !== false && clientConfig.get(`atelier.${note.id}_show`) !== "false";
                      const currentIcon = String(clientConfig.get(`atelier.${note.id}_icon`) ?? note.defaultIcon);
                      const currentStyle = String(clientConfig.get(`atelier.${note.id}_style`) || "card");
                      const currentUrl = String(clientConfig.get(`atelier.${note.id}_url`) ?? note.defaultUrl);
                      const currentDesc = String(clientConfig.get(`atelier.${note.id}_desc`) ?? note.defaultDesc);
                      const currentBg = String(clientConfig.get(`atelier.${note.id}_bg`) ?? "");

                      return (
                        <tr
                          key={note.id}
                          id={`setting-atelier-${note.id}`}
                          className={`border-b border-black/[0.04] dark:border-white/[0.04] transition-colors ${
                            isShow ? "hover:bg-theme/[0.03]" : "opacity-60 bg-black/[0.01] dark:bg-white/[0.01]"
                          }`}
                        >
                          {/* 序号与图标（点击弹出 Emoji 快捷气泡） */}
                          <td className="py-3 px-3 text-center">
                            <div className="relative inline-block">
                              <button
                                type="button"
                                title="点击修改便签图标"
                                onClick={() => setActiveEmojiPopover(activeEmojiPopover === note.id ? null : note.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-theme/10 hover:bg-theme/20 text-sm transition shadow-2xs font-mono font-bold mx-auto select-none"
                              >
                                {currentIcon}
                              </button>

                              {/* Emoji 快捷点选浮层 */}
                              {activeEmojiPopover === note.id && (
                                <div className="absolute left-full top-0 ml-2 z-50 p-2.5 rounded-xl bg-w shadow-xl border border-black/10 dark:border-white/10 flex flex-wrap gap-1.5 w-48 ani-show backdrop-blur-md">
                                  <div className="w-full text-[10px] text-neutral-400 font-mono mb-1 flex items-center justify-between">
                                    <span>推荐专属图标</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveEmojiPopover(null)}
                                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  {note.presetEmojis.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => {
                                        setConfigValue("client", `atelier.${note.id}_icon`, emoji);
                                        setActiveEmojiPopover(null);
                                      }}
                                      className="h-7 w-7 rounded-md hover:bg-theme/10 flex items-center justify-center text-sm transition select-none"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 便签名称与副标题 */}
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs t-primary">{note.name}</span>
                              <span className="text-[10px] font-mono text-neutral-400">atelier.{note.id}</span>
                            </div>
                          </td>

                          {/* 首屏展示开关 */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isShow}
                              onClick={() => setConfigValue("client", `atelier.${note.id}_show`, !isShow)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out select-none ${
                                isShow ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out mt-0.5 ${
                                  isShow ? "translate-x-4.5" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </td>

                          {/* 视觉形态选择 */}
                          <td className="py-3 px-3">
                            {note.id === "deck" ? (
                              <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 text-neutral-500 select-none">
                                记忆翻动胶卷
                              </span>
                            ) : (
                              <div className="inline-flex items-center rounded-lg bg-black/5 dark:bg-white/5 p-0.5 select-none">
                                {[
                                  { id: "card", label: "长条" },
                                  { id: "circle", label: "圆盘" },
                                  { id: "capsule", label: "胶囊" },
                                ].map((st) => (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => setConfigValue("client", `atelier.${note.id}_style`, st.id)}
                                    className={`px-2 py-0.5 rounded-md text-[11px] transition font-medium ${
                                      currentStyle === st.id
                                        ? "bg-theme text-white shadow-2xs font-bold"
                                        : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                                    }`}
                                  >
                                    {st.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* 跳转链接 */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={currentUrl}
                                onChange={(e) => setConfigValue("client", `atelier.${note.id}_url`, e.target.value)}
                                placeholder={note.defaultUrl}
                                className="w-full text-xs font-mono py-1 px-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition"
                              />
                              <Link
                                href={currentUrl}
                                title="新标签页预览此链接"
                                target="_blank"
                                className="p-1 rounded text-neutral-400 hover:text-theme transition shrink-0"
                              >
                                <i className="ri-external-link-line text-xs" />
                              </Link>
                            </div>
                          </td>

                          {/* 寄语描述语 */}
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={currentDesc}
                              onChange={(e) => setConfigValue("client", `atelier.${note.id}_desc`, e.target.value)}
                              placeholder={note.defaultDesc}
                              className="w-full text-xs py-1 px-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition"
                            />
                          </td>

                          {/* 专属背景封面预览与上传 */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {currentBg ? (
                                <img
                                  src={currentBg}
                                  alt="封面"
                                  className="h-6 w-9 rounded object-cover shadow-2xs ring-1 ring-black/10"
                                />
                              ) : (
                                <span className="h-6 w-9 rounded border border-dashed border-black/20 dark:border-white/20 flex items-center justify-center text-[10px] text-neutral-400 font-mono">
                                  质感
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveCoverModal({ id: note.id, name: note.name, configKey: `atelier.${note.id}_bg` })}
                                title="设置专属背景封面"
                                className="p-1 rounded-md text-neutral-500 hover:text-theme hover:bg-theme/10 transition"
                              >
                                <i className="ri-image-edit-line text-sm" />
                              </button>
                            </div>
                          </td>

                          {/* 快捷恢复默认 */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              title="重置为此便签的默认配置"
                              onClick={() => {
                                setConfigValue("client", `atelier.${note.id}_show`, true);
                                setConfigValue("client", `atelier.${note.id}_icon`, note.defaultIcon);
                                setConfigValue("client", `atelier.${note.id}_url`, note.defaultUrl);
                                setConfigValue("client", `atelier.${note.id}_desc`, note.defaultDesc);
                                setConfigValue("client", `atelier.${note.id}_bg`, "");
                                if (note.id !== "deck") {
                                  setConfigValue("client", `atelier.${note.id}_style`, "card");
                                }
                              }}
                              className="p-1 rounded-md text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition"
                            >
                              <i className="ri-restart-line text-sm" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 便签背景封面紧凑设置模态框 */}
          {activeCoverModal && (
            <Modal
              isOpen={!!activeCoverModal}
              onRequestClose={() => setActiveCoverModal(null)}
              contentLabel={`设置“${activeCoverModal.name}”背景封面`}
              panelClassName="p-6 max-w-lg w-full"
            >
              <div className="space-y-4 text-xs">
                <h2 className="text-base font-bold t-primary">设置“{activeCoverModal.name}”背景封面 (建议 800×480)</h2>
                <p className="text-neutral-500">
                  为画廊前台首屏展示的“{activeCoverModal.name}”便签上传高品质背景图（推荐宽高比约 5:3，如 800×480 像素，支持本地拖拽上传或直接填入图床 URL，留空则恢复默认清新纸张微质感）：
                </p>
                <ImageUploadInput
                  value={String(clientConfig.get(activeCoverModal.configKey) ?? "")}
                  onChange={(val) => {
                    setConfigValue("client", activeCoverModal.configKey, val);
                  }}
                  onError={showAlert}
                  placeholder="https://..."
                  shape="rounded"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveCoverModal(null)}
                    className="px-4 py-2 rounded-xl bg-theme text-white text-xs font-semibold shadow-xs"
                  >
                    确定
                  </button>
                </div>
              </div>
            </Modal>
          )}
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
