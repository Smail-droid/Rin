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
import { ItemImageInput, ItemWithUpload } from "./settings-items";
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

function parseConfigInt(val: unknown, fallback: number): number {
  if (val === undefined || val === null || val === "") return fallback;
  const num = Number.parseInt(String(val), 10);
  return Number.isNaN(num) ? fallback : Math.max(0, num);
}

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
    name: "星廊",
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
  const { t, i18n } = useTranslation();
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
  const [previewFeeds, setPreviewFeeds] = useState<any[]>([]);

  // 预拉取真实文章供首页排版画中画微缩视窗实时呈现
  useEffect(() => {
    client.feed
      .list({ limit: 8 })
      .then(({ data }) => {
        if (data?.data && Array.isArray(data.data)) {
          setPreviewFeeds(data.data);
        }
      })
      .catch(() => {});
  }, []);

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

            {/* 紧凑型系统状态指标胶囊 (高密状态感) */}
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
                      className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition"
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
                      className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition font-mono"
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
                    className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition resize-none"
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

              {/* 切片 2: 全站导航条位置与挂件模式 (画中画微缩预览创意卡片) */}
              <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <i className="ri-layout-top-line text-theme text-base" />
                    <h3 className="text-sm font-bold t-primary">前台导航条排布位置与挂件形态</h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-theme/10 text-theme">
                      {String(clientConfig.get("header.position") || "top") === "float"
                        ? "居中浮动胶囊"
                        : String(clientConfig.get("header.position") || "top") === "bottom"
                        ? "底部便携挂件"
                        : "顶部固定导航"}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      (clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false")
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}>
                      {(clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false")
                        ? "前台导航已开启"
                        : "前台已隐藏 (保留日夜/语言浮动挂件)"}
                    </span>
                  </div>

                  {/* 显隐切换开关 */}
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
                        (clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                        (clientConfig.get("header.show_nav") !== false && clientConfig.get("header.show_nav") !== "false") ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {[
                    {
                      id: "top",
                      title: "顶部固定",
                      badge: "CLASSIC FIXED",
                      desc: "常驻屏幕最顶端，融入毛玻璃与呼吸微光，沉浸大气",
                      icon: "ri-layout-top-line",
                      preview: (
                        <div className="w-full h-20 rounded-xl bg-neutral-100 dark:bg-neutral-900/80 p-2 border border-black/5 dark:border-white/5 flex flex-col justify-between relative overflow-hidden group-hover:border-theme/30 transition-colors">
                          {/* Top Nav Bar Mock */}
                          <div className="w-full h-4 rounded-lg bg-white dark:bg-neutral-800 shadow-2xs border border-black/5 dark:border-white/5 flex items-center justify-between px-2">
                            <span className="h-1.5 w-6 rounded-full bg-theme" />
                            <div className="flex items-center gap-1">
                              <span className="h-1.5 w-3 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                              <span className="h-1.5 w-3 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                              <span className="h-1.5 w-3 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                            </div>
                          </div>
                          {/* Content Lines */}
                          <div className="space-y-1 px-1">
                            <div className="h-1.5 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
                            <div className="h-1.5 w-3/4 rounded bg-neutral-200/60 dark:bg-neutral-800/60" />
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: "float",
                      title: "居中浮动胶囊",
                      badge: "DYNAMIC ISLAND",
                      desc: "灵动岛般悬浮于中央半空，内容在其下方穿梭流动",
                      icon: "ri-capsule-line",
                      preview: (
                        <div className="w-full h-20 rounded-xl bg-neutral-100 dark:bg-neutral-900/80 p-2 border border-black/5 dark:border-white/5 flex flex-col items-center justify-between relative overflow-hidden group-hover:border-theme/30 transition-colors">
                          {/* Floating Capsule Mock */}
                          <div className="w-24 h-4 rounded-full bg-white dark:bg-neutral-800 shadow-md border border-theme/30 flex items-center justify-between px-2.5">
                            <span className="h-1.5 w-2 rounded-full bg-theme animate-pulse" />
                            <div className="flex items-center gap-1">
                              <span className="h-1.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                              <span className="h-1.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                            </div>
                          </div>
                          {/* Content Lines flowing underneath */}
                          <div className="w-full space-y-1 px-1 pb-1">
                            <div className="h-1.5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
                            <div className="h-1.5 w-5/6 rounded bg-neutral-200/60 dark:bg-neutral-800/60" />
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: "bottom",
                      title: "底部便携挂件",
                      badge: "BOTTOM DOCK",
                      desc: "移至屏幕下方打造单手掌控操作岛，顶部纯净极目远眺",
                      icon: "ri-layout-bottom-line",
                      preview: (
                        <div className="w-full h-20 rounded-xl bg-neutral-100 dark:bg-neutral-900/80 p-2 border border-black/5 dark:border-white/5 flex flex-col justify-between relative overflow-hidden group-hover:border-theme/30 transition-colors">
                          {/* Top Clean Content */}
                          <div className="space-y-1 px-1 pt-1">
                            <div className="h-1.5 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
                            <div className="h-1.5 w-4/5 rounded bg-neutral-200/60 dark:bg-neutral-800/60" />
                          </div>
                          {/* Bottom Dock Bar Mock */}
                          <div className="w-32 mx-auto h-4 rounded-full bg-white dark:bg-neutral-800 shadow-md border border-black/10 dark:border-white/10 flex items-center justify-around px-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-theme" />
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                          </div>
                        </div>
                      ),
                    },
                  ].map((pos) => {
                    const currentPos = String(clientConfig.get("header.position") || "top");
                    const isSelected = currentPos === pos.id;
                    return (
                      <div
                        key={pos.id}
                        onClick={() => setConfigValue("client", "header.position", pos.id)}
                        className={`group relative flex flex-col justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-200 select-none ${
                          isSelected
                            ? "border-theme bg-theme/[0.04] ring-2 ring-theme/20 shadow-md shadow-theme/10 -translate-y-0.5"
                            : "border-black/10 dark:border-white/10 bg-w hover:border-theme/40 hover:bg-black/[0.01] dark:hover:bg-white/[0.01]"
                        }`}
                      >
                        {/* Preview Area */}
                        {pos.preview}

                        <div className="mt-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <i className={`${pos.icon} ${isSelected ? "text-theme" : "text-neutral-500"} text-sm`} />
                              <span className={`font-bold text-xs ${isSelected ? "text-theme" : "t-primary"}`}>
                                {pos.title}
                              </span>
                            </div>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              isSelected ? "bg-theme text-white" : "bg-black/5 dark:bg-white/10 text-neutral-400"
                            }`}>
                              {pos.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                            {pos.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 切片 3: 全站功能总闸矩阵 (2x3 模块化卡片切片) */}
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
                    className="mt-1 w-full font-mono rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Theme & Layout Settings */}
          {activeCategory === "theme" && (
            <div className="w-full flex flex-col space-y-3 ani-show">
              <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme/10 text-theme text-xl shadow-2xs">
                    <i className="ri-palette-line" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold t-primary">{t("settings.personalization.title")}</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">调控全站导航排布、画廊瀑布流留白、文章卡片风貌与 18 款主题色调</p>
                  </div>
                </div>
              </div>
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

                  {/* Padding, Columns, Gap & PiP Live Preview */}
                  {(() => {
                    const currentPadding = parseConfigInt(clientConfig.get("gallery.padding"), 24);
                    const currentCol = String(clientConfig.get("gallery.columns") ?? "auto");
                    const currentAlign = String(clientConfig.get("gallery.align") ?? "center");
                    const currentCardGap = parseConfigInt(clientConfig.get("gallery.card_gap"), 16);
                    const curTilt = String(clientConfig.get("gallery.tilt_mode") ?? "subtle");

                    return (
                      <>
                        {/* 1. 两侧留白滑块与预设 */}
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
                                value={currentPadding}
                                onChange={(e) => {
                                  const val = parseConfigInt(e.target.value, 24);
                                  setConfigValue("client", "gallery.padding", val);
                                }}
                                className="h-2 w-32 sm:w-44 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/15"
                              />
                              <span className="min-w-14 text-right font-mono text-xs font-bold text-theme">
                                {currentPadding}px
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[0, 12, 24, 48, 80].map((px) => {
                                const isSelected = currentPadding === px;
                                return (
                                  <button
                                    key={px}
                                    type="button"
                                    onClick={() => setConfigValue("client", "gallery.padding", px)}
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition select-none ${
                                      isSelected
                                        ? "bg-theme text-white shadow-2xs font-bold"
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

                        {/* 2. 列数与对齐 */}
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
                                const isSelected = currentCol === col.value;
                                return (
                                  <button
                                    key={col.value}
                                    type="button"
                                    onClick={() => setConfigValue("client", "gallery.columns", col.value)}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition select-none ${
                                      isSelected
                                        ? "bg-theme text-white shadow-xs font-bold"
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
                                const isSelected = currentAlign === align.value;
                                return (
                                  <button
                                    key={align.value}
                                    type="button"
                                    onClick={() => setConfigValue("client", "gallery.align", align.value)}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition select-none ${
                                      isSelected
                                        ? "bg-theme text-white shadow-xs font-bold"
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

                        {/* 3. 卡片列间距与间隙（默认优化为更加紧凑微润的 16px） */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                          <div>
                            <div className="text-xs font-semibold t-primary">卡片列间距与间隙</div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">调节瀑布流每列卡片之间的水平与垂直间隙（默认 16px 紧凑呈现）</div>
                          </div>
                          <div className="flex flex-col items-start sm:items-end gap-1.5">
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min={8}
                                max={48}
                                step={4}
                                value={currentCardGap}
                                onChange={(e) => {
                                  const val = parseConfigInt(e.target.value, 16);
                                  setConfigValue("client", "gallery.card_gap", val);
                                }}
                                className="h-2 w-32 sm:w-44 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/15"
                              />
                              <span className="min-w-14 text-right font-mono text-xs font-bold text-theme">
                                {currentCardGap}px
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[8, 12, 16, 24, 32].map((gapPx) => {
                                const isSelected = currentCardGap === gapPx;
                                return (
                                  <button
                                    key={gapPx}
                                    type="button"
                                    onClick={() => setConfigValue("client", "gallery.card_gap", gapPx)}
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition select-none ${
                                      isSelected
                                        ? "bg-theme text-white shadow-2xs font-bold"
                                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                                    }`}
                                  >
                                    {gapPx === 16 ? "16px (默认)" : `${gapPx}px`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* 4. 画廊相纸卡片拟物旋转与微倾角 (Tilt Mode) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/5">
                          <div>
                            <div className="text-xs font-semibold t-primary">画廊卡片拟物旋转与微倾角</div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">控制首页相纸卡片的倾角幅度，支持纯平、手账微倾或显著错落</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {[
                              { id: "subtle", label: "自然手账微倾 (±1.5°)", icon: "ri-t-box-line" },
                              { id: "pronounced", label: "显著艺术错落 (±3°)", icon: "ri-artboard-line" },
                              { id: "flat", label: "纯平规整对齐 (0°)", icon: "ri-layout-line" },
                              { id: "dynamic", label: "随性随机活力", icon: "ri-shuffle-line" },
                            ].map((m) => {
                              const curTilt = String(clientConfig.get("gallery.tilt_mode") ?? "subtle");
                              const isSelected = curTilt === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setConfigValue("client", "gallery.tilt_mode", m.id)}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition select-none ${
                                    isSelected
                                      ? "bg-theme text-white shadow-xs font-bold"
                                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                                  }`}
                                >
                                  <i className={m.icon} />
                                  <span>{m.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 5. 画中画实时微缩排版视窗 (Picture-in-Picture Live Preview) */}
                        <div className="mt-2 p-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex flex-col gap-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-[#ff5f56] inline-block shadow-2xs" />
                                <span className="h-2 w-2 rounded-full bg-[#ffbd2e] inline-block shadow-2xs" />
                                <span className="h-2 w-2 rounded-full bg-[#27c93f] inline-block shadow-2xs" />
                              </div>
                              <span className="text-xs font-bold t-primary">画中画实时微缩排版视窗 (Live PiP Preview)</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-theme/10 text-theme font-mono font-bold">
                                REALTIME
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-neutral-400">
                              两侧留白 {currentPadding}px · {currentCol === "auto" ? "自适应列" : `${currentCol}列`} · 间距 {currentCardGap}px · {currentAlign === "center" ? "居中聚拢" : "撑满两端"}
                            </span>
                          </div>

                          {/* 模拟浏览器前台视窗画布 */}
                          <div className="w-full bg-neutral-200/60 dark:bg-neutral-900/90 rounded-2xl p-3.5 border border-black/5 dark:border-white/5 overflow-hidden transition-all duration-300 shadow-inner">
                            <div
                              style={{
                                paddingLeft: `${Math.min(50, currentPadding * 0.4)}px`,
                                paddingRight: `${Math.min(50, currentPadding * 0.4)}px`,
                              }}
                              className={`w-full transition-all duration-300 ${currentAlign === "center" ? "max-w-[88%] mx-auto" : "w-full"}`}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: `repeat(${currentCol === "auto" ? 4 : parseInt(currentCol, 10)}, minmax(0, 1fr))`,
                                  gap: `${Math.max(6, currentCardGap * 0.4)}px`,
                                }}
                                className="transition-all duration-300"
                              >
                                {(previewFeeds.length > 0 ? previewFeeds : [
                                  { title: "基于 Cloudflare 边缘架构实战", summary: "技术", avatar: previewSiteAvatar },
                                  { title: "强制 WireGuard 原生 IPv6 调优", summary: "网络", avatar: previewSiteAvatar },
                                  { title: "画廊随想二次元微光美学演进", summary: "美学", avatar: previewSiteAvatar },
                                  { title: "高密单屏超级数据网格设计", summary: "工程", avatar: previewSiteAvatar },
                                  { title: "关于我与随想便签", summary: "便签", isNote: true },
                                  { title: "探针监控与性能优化指南", summary: "运维", avatar: previewSiteAvatar },
                                  { title: "生活碎碎念与日常记录", summary: "动态", avatar: previewSiteAvatar },
                                  { title: "画廊文字侍从全场景协同", summary: "侍从", avatar: previewSiteAvatar },
                                ]).slice(0, currentCol === "2" ? 4 : currentCol === "3" ? 6 : 8).map((card: any, i: number) => {
                                  // 动态响应所选旋转风格，倾角随模式实时驱动
                                  const tiltStyle = (() => {
                                    if (curTilt === "flat") return { transform: "rotate(0deg)" };
                                    if (curTilt === "pronounced") {
                                      const degs = [-3.2, 2.8, -3.5, 3.0, -2.5, 2.6, -3.0, 2.2];
                                      return { transform: `rotate(${degs[i % degs.length]}deg)` };
                                    }
                                    if (curTilt === "dynamic") {
                                      const degs = [-2.5, 1.8, -3.0, 2.2, -1.5, 2.8, -2.0, 1.6];
                                      return { transform: `rotate(${degs[i % degs.length]}deg)` };
                                    }
                                    // "subtle" (default ±1.5°)
                                    const degs = [-1.8, 1.4, -2.2, 1.9, -1.2, 1.6, -2.4, 1.1];
                                    return { transform: `rotate(${degs[i % degs.length]}deg)` };
                                  })();

                                  const hasImg = Boolean(card.avatar);

                                  return (
                                    <div
                                      key={card.id || i}
                                      style={{
                                        ...tiltStyle,
                                        transition: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                      }}
                                      className={`group relative rounded-2xl p-2 pb-2.5 shadow-md border flex flex-col justify-between overflow-hidden select-none ${
                                        card.isNote
                                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300/40 dark:border-amber-700/40"
                                          : "bg-white dark:bg-neutral-800 border-black/10 dark:border-white/10"
                                      }`}
                                    >
                                      {/* Washi Tape Pin Mock */}
                                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-theme/30 rounded-xs rotate-[-2deg] pointer-events-none z-10" />

                                      {/* Cover Image */}
                                      <div className="w-full h-16 sm:h-20 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 mb-1.5 flex items-center justify-center relative shadow-inner">
                                        {hasImg ? (
                                          <img
                                            src={card.avatar}
                                            alt=""
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-theme/10 to-pink-500/10 text-theme font-bold text-xs">
                                            {card.isNote ? "📌" : "🎨"}
                                          </div>
                                        )}
                                      </div>

                                      {/* Title & Badge */}
                                      <div className="flex items-center justify-between gap-1 w-full">
                                        <span className="text-[10px] font-bold t-primary truncate max-w-[70%]">
                                          {card.title || "画廊文章"}
                                        </span>
                                        <span className="text-[8px] font-mono px-1.5 py-0.2 rounded-full bg-theme/10 text-theme font-semibold shrink-0">
                                          {card.summary ? String(card.summary).slice(0, 4) : "文章"}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
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

              {/* Site Language & Translation Preferences (博客多语言与国际化全景控制中心) */}
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
                <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-black/[0.015] p-4 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold t-primary flex items-center gap-2">
                        <i className="ri-translate-2 text-theme" />
                        <span>多语言偏好与国际化控制中心</span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-md">
                        当前系统已内置 简体中文 (zh-CN)、繁体中文 (zh-TW)、English (en)、日本語 (ja) 完整语言包。
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {[
                        { code: "auto", label: "浏览器自适应 (Auto)" },
                        { code: "zh-CN", label: "简体中文" },
                        { code: "en", label: "English" },
                        { code: "zh-TW", label: "繁體中文" },
                        { code: "ja", label: "日本語" },
                      ].map((item) => {
                        const currentPref = String(clientConfig.get("site.language_preference") ?? "auto");
                        const isSelected = currentPref === item.code;
                        return (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => {
                              setConfigValue("client", "site.language_preference", item.code);
                              if (item.code !== "auto") {
                                void i18n.changeLanguage(item.code);
                              }
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

                  {/* 顶栏切换交互模式配置：一键即时切换 vs 完整下拉菜单 */}
                  <div className="pt-3 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold t-primary block">前台顶栏语言切换按钮模式</span>
                      <span className="text-[11px] text-neutral-400">
                        {String(clientConfig.get("site.language_switch_mode") ?? "toggle") === "toggle"
                          ? "当前为【一键即时切换】：点击直接在中英之间无感切换，免去二级下拉"
                          : "当前为【完整多语言面板】：点击弹出包含 简/繁/英/日 的精美语言选择面板"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[
                        { mode: "toggle", label: "一键中英即时切换" },
                        { mode: "menu", label: "完整多语言弹出面板" },
                      ].map((m) => {
                        const currentMode = String(clientConfig.get("site.language_switch_mode") ?? "toggle");
                        const isSelected = currentMode === m.mode;
                        return (
                          <button
                            key={m.mode}
                            type="button"
                            onClick={() => setConfigValue("client", "site.language_switch_mode", m.mode)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all select-none ${
                              isSelected
                                ? "bg-theme text-white shadow-2xs"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-400 leading-relaxed">
                    💡 自适应探测机制：在【浏览器自适应】下，系统会自动探测访客系统的 <code className="font-mono text-theme font-bold">navigator.language</code>。当命中中文时展示简体/繁体，命中日文时展示日本語，其他任何未知国家语言（如德法西韩）将统一平滑回退（Fallback）到通用国际 English。
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
              <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold tracking-[-0.02em] t-primary">顶部导航栏吸顶与滚动控制</p>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        (clientConfig.get("header.sticky_enabled") !== false && clientConfig.get("header.sticky_enabled") !== "false")
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}>
                        {(clientConfig.get("header.sticky_enabled") !== false && clientConfig.get("header.sticky_enabled") !== "false")
                          ? "吸顶已启用"
                          : "已停用吸顶 (随页面滚出/自由解耦)"}
                      </span>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                      控制是否启用前台导航条的吸顶悬浮效果。停用后导航条将随页面自然滚出，支持与首页标签、浮动挂件自由解耦搭配
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <span className="text-xs font-semibold t-primary">启用吸顶行为</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={clientConfig.get("header.sticky_enabled") !== false && clientConfig.get("header.sticky_enabled") !== "false"}
                      onClick={() => {
                        const cur = clientConfig.get("header.sticky_enabled") !== false && clientConfig.get("header.sticky_enabled") !== "false";
                        setConfigValue("client", "header.sticky_enabled", !cur);
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        (clientConfig.get("header.sticky_enabled") !== false && clientConfig.get("header.sticky_enabled") !== "false") ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition transform mt-1 ${
                        (clientConfig.get("header.sticky_enabled") !== false && clientConfig.get("header.sticky_enabled") !== "false") ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </div>

                {(clientConfig.get("header.sticky_enabled") !== false && clientConfig.get("header.sticky_enabled") !== "false") && (
                  <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ani-show">
                    <div>
                      <span className="text-xs font-bold t-primary">吸顶触发模式</span>
                      <p className="text-[11px] text-neutral-400">选择固定吸顶悬浮、向上滑动自动呼出，或跟随滚动</p>
                    </div>
                    <div className="w-full sm:w-64">
                      <SearchableSelect
                        placement="top"
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
                    </div>
                  </div>
                )}
              </div>
            </SettingsCard>
          </div>
        </div>
      )}

      {/* Tab 3: Atelier & Sticky Notes Settings */}
      {activeCategory === "atelier" && (
        <div className="w-full flex flex-col space-y-3 ani-show">
          {/* 画廊主标题控制切片 */}
          <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <i className="ri-quill-pen-line text-theme text-base" />
                <h3 className="font-bold text-sm t-primary">画廊主标题</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-theme/10 text-theme">
                  首页专属
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">首页画廊顶部展示的艺术主标题文本</p>
            </div>
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={String(clientConfig.get("atelier.title") ?? "画廊随想")}
                placeholder="画廊随想"
                onChange={(e) => setConfigValue("client", "atelier.title", e.target.value)}
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-3.5 py-2 text-xs font-bold t-primary outline-hidden focus:border-theme transition"
              />
            </div>
          </div>

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

          {/* 海报微光流动弹幕全景控制台 (速度/字号/流速/形态) */}
          <div className="w-full">
            <SettingsCard>
              <SettingsCardRow
                header={
                  <SettingsCardHeader
                    title="文章海报弹幕效果配置中心 (Danmaku Studio)"
                    description="自由调控详情页海报顶部轨道与两侧微光弹幕的流动速度、字号大小与流转节奏"
                  />
                }
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-theme">
                      {String(clientConfig.get("danmaku.speed") ?? "normal") === "fast" ? "极速流转" : String(clientConfig.get("danmaku.speed") ?? "normal") === "slow" ? "从容慢速" : "标准舒缓"}
                    </span>
                  </div>
                }
              />
              <SettingsCardBody>
                <div className="flex flex-col gap-4">
                  {/* 流动速度预设选择 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/5 dark:border-white/5">
                    <div>
                      <div className="text-sm font-semibold t-primary">弹幕流动与穿梭流速</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        调整海报顶部与两侧弹幕滑过与相聚的游动速度
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        { speed: "slow", label: "从容慢速 (Slow)" },
                        { speed: "normal", label: "标准舒缓 (Normal)" },
                        { speed: "fast", label: "灵动极速 (Fast)" },
                      ].map((item) => {
                        const currentSpeed = String(clientConfig.get("danmaku.speed") ?? "normal");
                        const isSelected = currentSpeed === item.speed;
                        return (
                          <button
                            key={item.speed}
                            type="button"
                            onClick={() => setConfigValue("client", "danmaku.speed", item.speed)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all select-none ${
                              isSelected
                                ? "bg-theme text-white shadow-xs scale-105"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 弹幕特性说明与避坑建议 */}
                  <div className="p-3.5 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold t-primary block">✨ 动态特性：</span>
                      <p className="text-[11px] text-neutral-400">
                        • 顶部天花板轨道已自动预留左右两端安全避让距离，彻底避开左上角弹幕开关与右上角全屏预览标签；<br />
                        • 左翼与右翼弹幕每轮动态从全站真实文章库中随机洗牌抽取，向中心游动并在接近核心画框时产生晶体粒子微光破碎消散。
                      </p>
                    </div>
                  </div>
                </div>
              </SettingsCardBody>
            </SettingsCard>
          </div>

          {/* 画廊随想便签阵列配置 高密单屏超级数据表格 (Dense DataGrid) */}
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

            {/* 高密单屏超级表格主体 */}
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

      {/* Tab 4: Extensions & Services Settings (全站服务、通知与维护中枢) */}
      {activeCategory === "services" && (
        <div className="w-full flex flex-col space-y-4 ani-show">
          {/* 切片 1: Webhook 外部通知广播中枢 */}
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
              <p className="text-xs text-neutral-400">文章发布、友链申请与新评论实时外部 Webhook 广播推送</p>
            </div>

            {/* URL 与 请求方法组合条 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold t-primary">{t("settings.webhook.url.title")}</label>
                  <span className="text-[10px] text-neutral-400 font-mono">WEBHOOK_URL</span>
                </div>
                <p className="text-[11px] text-neutral-400">{t("settings.webhook.url.desc")}</p>
                <input
                  type="text"
                  value={String(serverConfig.get("webhook_url") ?? "")}
                  placeholder="https://example.com/webhook"
                  onChange={(e) => setConfigValue("server", "webhook_url", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition font-mono"
                />
              </div>

              <div className="w-full sm:w-48 flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                <label className="text-xs font-bold t-primary">{t("settings.webhook.method.title")}</label>
                <p className="text-[11px] text-neutral-400">HTTP 请求方法</p>
                <div className="mt-1">
                  <SearchableSelect
                    value={String(serverConfig.get("webhook.method") ?? "POST")}
                    onChange={(value) => setConfigValue("server", "webhook.method", value)}
                    options={WEBHOOK_METHOD_OPTIONS}
                    placeholder="POST"
                    searchPlaceholder="请求方法"
                    emptyLabel={t("no_more")}
                    searchable={false}
                  />
                </div>
              </div>
            </div>

            {/* Content-Type 与 Headers 2 列网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold t-primary">{t("settings.webhook.content_type.title")}</label>
                  <span className="text-[10px] text-neutral-400 font-mono">Content-Type</span>
                </div>
                <p className="text-[11px] text-neutral-400">{t("settings.webhook.content_type.desc")}</p>
                <input
                  type="text"
                  value={String(serverConfig.get("webhook.content_type") ?? "")}
                  placeholder={String(serverConfig.default("webhook.content_type") ?? "application/json")}
                  onChange={(e) => setConfigValue("server", "webhook.content_type", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition font-mono"
                />
              </div>

              <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold t-primary">{t("settings.webhook.headers.title")}</label>
                  <span className="text-[10px] text-neutral-400 font-mono">Custom Headers (JSON)</span>
                </div>
                <p className="text-[11px] text-neutral-400">{t("settings.webhook.headers.desc")}</p>
                <input
                  type="text"
                  value={String(serverConfig.get("webhook.headers") ?? "")}
                  placeholder={String(serverConfig.default("webhook.headers") ?? "{}")}
                  onChange={(e) => setConfigValue("server", "webhook.headers", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition font-mono"
                />
              </div>
            </div>

            {/* Body Payload 模板 */}
            <div className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold t-primary">{t("settings.webhook.body_template.title")}</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-neutral-400">可用占位变量:</span>
                  {["${event}", "${title}", "${message}", "${url}", "${username}"].map((v) => (
                    <span
                      key={v}
                      onClick={() => {
                        const cur = String(serverConfig.get("webhook.body_template") ?? "");
                        setConfigValue("server", "webhook.body_template", cur + (cur ? " " : "") + v);
                      }}
                      className="cursor-pointer px-1.5 py-0.5 rounded-md bg-theme/10 hover:bg-theme/20 text-theme font-mono text-[10px] font-semibold transition"
                      title="点击插入此变量"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">{t("settings.webhook.body_template.desc")}</p>
              <textarea
                rows={3}
                value={String(serverConfig.get("webhook.body_template") ?? "")}
                placeholder={String(serverConfig.default("webhook.body_template") ?? '{"msg_type":"text","content":{"text":"${message}"}}')}
                onChange={(e) => setConfigValue("server", "webhook.body_template", e.target.value)}
                className="mt-1 w-full font-mono rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-2 text-xs t-primary outline-hidden focus:border-theme transition"
              />
            </div>

            {/* 实时 Webhook 测试控制台 */}
            <div className="p-3.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <span className="text-xs font-bold t-primary block">{t("settings.webhook.test.title")}</span>
                <p className="text-[11px] text-neutral-400 mt-0.5">{t("settings.webhook.test.desc")}</p>
                <input
                  type="text"
                  value={webhookTestMessage}
                  placeholder={t("settings.webhook.test.placeholder")}
                  onChange={(e) => setWebhookTestMessage(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/10 dark:border-white/10 bg-w px-3 py-1.5 text-xs t-primary outline-hidden focus:border-theme transition"
                />
              </div>
              <div className="self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !serverConfig.get("webhook_url")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
                >
                  {testingWebhook ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      <span>{t("settings.webhook.test.sending")}</span>
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-fill" />
                      <span>{t("settings.webhook.test.button")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 切片 2: 星廊站点健康巡检与申请治理 */}
          <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
              <i className="ri-heart-pulse-line text-theme text-base" />
              <h3 className="font-bold text-sm t-primary">{t("settings.friend.title")}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 开关 1: 开放申请 */}
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

              {/* 开关 2: 自动健康巡检 Crontab */}
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

              {/* 输入: User-Agent */}
              <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-xs t-primary block truncate">{t("settings.friend.health.ua.title")}</span>
                  <span className="text-[11px] text-neutral-400 block truncate">{t("settings.friend.health.ua.desc")}</span>
                </div>
                <input
                  type="text"
                  value={String(serverConfig.get("friend_ua") ?? "")}
                  placeholder={String(serverConfig.default("friend_ua") ?? "User-Agent")}
                  onChange={(e) => setConfigValue("server", "friend_ua", e.target.value)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-w px-2.5 py-1 text-xs font-mono t-primary outline-hidden focus:border-theme"
                />
              </div>
            </div>
          </div>

          {/* 切片 3: 边缘性能维护与数据迁移 */}
          <div className="p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-black/5 dark:border-white/5">
              <i className="ri-tools-line text-theme text-base" />
              <h3 className="font-bold text-sm t-primary">{t("settings.maintenance.title")}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* 缓存治理 */}
              <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-3">
                <div>
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
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {t("settings.cache.enabled.desc")} · 开启后文章与列表由边缘分布式缓存加速响应
                  </p>
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

              {/* WordPress 导入 */}
              <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs t-primary">{t("settings.wordpress.title")}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-neutral-400">WXR .xml</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    从 WordPress 导出文件无损导入历史文章、分类及标签到本画廊博客中
                  </p>
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400 font-mono">支持 50MB 以内 XML</span>
                  <ItemWithUpload
                    title=""
                    description=""
                    accept="application/xml"
                    onFileChange={onFileChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 切片 4: AI 智能导读与大模型引擎 */}

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
