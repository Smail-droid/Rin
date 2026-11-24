import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClientConfigContext } from "../state/config";
import { normalizeFeedCardVariant } from "../components/feed-card-options";
import { normalizeFeedLayout } from "../components/feed-layout-options";
import { normalizeThemeOpacity } from "../utils/theme-color";
import { normalizeBlobUrl } from "../utils/url";

// Site configuration keys
export const SITE_CONFIG_KEYS = {
    headerBehavior: "header.behavior",
    name: "site.name",
    description: "site.description",
    avatar: "site.avatar",
    pageSize: "site.page_size",
    feedLayout: "feed.layout",
    feedCardVariant: "feed.card_variant",
    headerLayout: "header.layout",
    themeColor: "theme.color",
    themeSecondaryColor: "theme.secondary_color",
    themeOpacity: "theme.opacity",
    themeFontFamily: "theme.font_family",
    themeFontSize: "theme.font_size",
    themeTitleFont: "theme.title_font",
    themeTitleEffect: "theme.title_effect",
    themePreset: "theme.preset",
    themeAmbience: "theme.ambience",
    themeCustomColorEnabled: "theme.custom_color_enabled",
    themeWallpaper: "theme.wallpaper",
    themeWallpaperOpacity: "theme.wallpaper_opacity",
    themeCustomCursor: "theme.custom_cursor",
    themeReadingProgress: "theme.reading_progress",
    galleryTiltDegree: "gallery.tilt_degree",
    headerShowNav: "header.show_nav",
    headerStickyEnabled: "header.sticky_enabled",
    headerPosition: "header.position", // "top" (顶部固定) | "float" (居中浮动胶囊) | "bottom" (底部挂件)
    headerNavFontSize: "header.nav_font_size",
    headerNavGap: "header.nav_gap",
    headerNavOrganicTilt: "header.nav_organic_tilt",
    pageHeaderMode: "page.header_mode", // "clean" (极简文字) | "banner" (微光横幅) | "hidden" (彻底隐藏)
    pageHeaderBannerUrl: "page.header_banner_url",
    storageAllowPublicUpload: "storage.allow_public_upload",
    storageGalleryShowInNav: "storage.gallery_show_in_nav",
    openlistWorkerUrl: "openlist.worker_url",
    openlistShowInNav: "openlist.show_in_nav",
    openlistNavTitle: "openlist.nav_title",

    // 全站沉浸式音乐播放器配置
    musicEnabled: "music.enabled",
    musicAutoPlay: "music.auto_play",
    musicSourceType: "music.source_type", // "gdstudio" | "openlist" | "custom"
    musicGdApi: "music.gd_api",
    musicGdSource: "music.gd_source",
    musicOpenlistUrl: "music.openlist_url",
    musicPlaylist: "music.playlist",
    musicPosition: "music.position", // "bottom-right" | "bottom-left"
    atelierTitle: "atelier.title",
    atelierTitleStyle: "atelier.title_style",
    hashtagsTitleStyle: "atelier.hashtags_title_style",
    timelineTitleStyle: "atelier.timeline_title_style",
    momentsTitleStyle: "atelier.moments_title_style",
    friendsTitleStyle: "atelier.friends_title_style",
    atelierTitleColor: "atelier.title_color",
    atelierTitleCustomColorEnabled: "atelier.title_custom_color_enabled",
    atelierAboutUrl: "atelier.about_url",
    atelierAboutDesc: "atelier.about_desc",
    atelierAboutBg: "atelier.about_bg",
    atelierAboutIcon: "atelier.about_icon",

    atelierTimelineUrl: "atelier.timeline_url",
    atelierTimelineDesc: "atelier.timeline_desc",
    atelierTimelineBg: "atelier.timeline_bg",
    atelierTimelineIcon: "atelier.timeline_icon",

    atelierMomentsUrl: "atelier.moments_url",
    atelierMomentsDesc: "atelier.moments_desc",
    atelierMomentsBg: "atelier.moments_bg",
    atelierMomentsIcon: "atelier.moments_icon",

    atelierFriendsUrl: "atelier.friends_url",
    atelierFriendsDesc: "atelier.friends_desc",
    atelierFriendsBg: "atelier.friends_bg",
    atelierFriendsIcon: "atelier.friends_icon",

    atelierSearchUrl: "atelier.search_url",
    atelierSearchDesc: "atelier.search_desc",
    atelierSearchBg: "atelier.search_bg",
    atelierSearchIcon: "atelier.search_icon",

    atelierDeckUrl: "atelier.deck_url",
    atelierDeckDesc: "atelier.deck_desc",
    atelierDeckBg: "atelier.deck_bg",
    atelierDeckIcon: "atelier.deck_icon",
    atelierNotesLayout: "atelier.notes_layout",

    // 6 大便签首页显隐开关、展示样式与封面文字策略 ("hover" | "hidden" | "always")
    atelierAboutShow: "atelier.about_show",
    atelierAboutStyle: "atelier.about_style",
    atelierAboutTextMode: "atelier.about_text_mode",
    atelierTimelineShow: "atelier.timeline_show",
    atelierTimelineStyle: "atelier.timeline_style",
    atelierTimelineTextMode: "atelier.timeline_text_mode",
    atelierMomentsShow: "atelier.moments_show",
    atelierMomentsStyle: "atelier.moments_style",
    atelierMomentsTextMode: "atelier.moments_text_mode",
    atelierFriendsShow: "atelier.friends_show",
    atelierFriendsStyle: "atelier.friends_style",
    atelierFriendsTextMode: "atelier.friends_text_mode",
    atelierSearchShow: "atelier.search_show",
    atelierSearchStyle: "atelier.search_style",
    atelierSearchTextMode: "atelier.search_text_mode",
    atelierDeckShow: "atelier.deck_show",
    atelierDeckStyle: "atelier.deck_style",
    atelierDeckTextMode: "atelier.deck_text_mode",

    galleryPadding: "gallery.padding",
    galleryColumns: "gallery.columns",
    galleryAlign: "gallery.align",
    galleryCardSize: "gallery.card_size",
    galleryCardMaxWidth: "gallery.card_max_width",
    galleryCardGap: "gallery.card_gap",
    galleryTiltMode: "gallery.tilt_mode", // "subtle" (自然微倾) | "pronounced" (显著错落) | "flat" (纯平对齐) | "dynamic" (随性活力)
    homepageTagsConfig: "gallery.homepage_tags_config",

    danmakuSpeed: "danmaku.speed",
    aiSummaryEnabled: "ai_summary.enabled",
} as const;

// Hook to get site configuration (memoized per ConfigWrapper instance to avoid 50+ redundant JSON.parse/allocations per render)
export function useSiteConfig() {
    const config = useContext(ClientConfigContext);
    const { t } = useTranslation();
    return useMemo(() => {
    const pageSizeValue = config.get<string | number>(SITE_CONFIG_KEYS.pageSize);
    const parsedPageSize =
        typeof pageSizeValue === "number"
            ? pageSizeValue
            : typeof pageSizeValue === "string"
                ? parseInt(pageSizeValue, 10)
                : NaN;

    const showNavRaw = config.get<string | boolean>(SITE_CONFIG_KEYS.headerShowNav);
    const headerShowNav = showNavRaw === undefined ? undefined : showNavRaw === true || showNavRaw === "true";

    const defaultSiteName = t("site.default_name", { defaultValue: "Rin" });
    const rawName = config.get<string>(SITE_CONFIG_KEYS.name);
    const name = !rawName || rawName === "Rin" || rawName === "画廊随想"
        ? (rawName === "画廊随想" ? t("atelier.title", { defaultValue: "Gallery Blog" }) : defaultSiteName)
        : rawName;

    const defaultDesc = t("site.default_desc", { defaultValue: "记录生活闪光与技术沉淀，让每一次漫步都有迹可循。" });
    const rawDesc = config.get<string>(SITE_CONFIG_KEYS.description);
    const description = !rawDesc || rawDesc === "记录生活闪光与技术沉淀，让每一次漫步都有迹可循。"
        ? defaultDesc
        : rawDesc;

    const rawAtelierTitle = config.get<string>(SITE_CONFIG_KEYS.atelierTitle);
    const atelierTitle = !rawAtelierTitle || rawAtelierTitle === "画廊随想"
        ? t("atelier.title", { defaultValue: "画廊随想" })
        : rawAtelierTitle;

    const rawOpenlistNavTitle = config.get<string>(SITE_CONFIG_KEYS.openlistNavTitle);
    const openlistNavTitle = !rawOpenlistNavTitle || rawOpenlistNavTitle === "资源列表"
        ? t("openlist_nav_title", { defaultValue: "资源列表" })
        : rawOpenlistNavTitle;

    const rawAboutDesc = config.get<string>(SITE_CONFIG_KEYS.atelierAboutDesc);
    const atelierAboutDesc = !rawAboutDesc || rawAboutDesc === "欢迎光临我的记忆工坊与随笔空间，点击了解更多。"
        ? t("notes.about_desc", { defaultValue: "欢迎光临我的记忆工坊与随笔空间，点击了解更多。" })
        : rawAboutDesc;

    const rawTimelineDesc = config.get<string>(SITE_CONFIG_KEYS.atelierTimelineDesc);
    const atelierTimelineDesc = !rawTimelineDesc || rawTimelineDesc === "以时间为轴，串联起每一次灵感与技术实践。"
        ? t("notes.timeline_desc", { defaultValue: "以时间为轴，串联起每一次灵感与技术实践。" })
        : rawTimelineDesc;

    const rawMomentsDesc = config.get<string>(SITE_CONFIG_KEYS.atelierMomentsDesc);
    const atelierMomentsDesc = !rawMomentsDesc || rawMomentsDesc === "生活碎碎念、灵感火花与不设限的日常记录。"
        ? t("notes.moments_desc", { defaultValue: "生活碎碎念、灵感火花与不设限的日常记录。" })
        : rawMomentsDesc;

    const rawFriendsDesc = config.get<string>(SITE_CONFIG_KEYS.atelierFriendsDesc);
    const atelierFriendsDesc = !rawFriendsDesc || rawFriendsDesc === "漫步在同好博主的数字花园，交换思想火花。"
        ? t("notes.friends_desc", { defaultValue: "漫步在同好博主的数字花园，交换思想火花。" })
        : rawFriendsDesc;

    const rawSearchDesc = config.get<string>(SITE_CONFIG_KEYS.atelierSearchDesc);
    const atelierSearchDesc = !rawSearchDesc || rawSearchDesc === "输入关键词即刻检索文章与解决方案。"
        ? t("notes.search_desc", { defaultValue: "输入关键词即刻检索文章与解决方案。" })
        : rawSearchDesc;

    const rawDeckDesc = config.get<string>(SITE_CONFIG_KEYS.atelierDeckDesc);
    const atelierDeckDesc = !rawDeckDesc || rawDeckDesc === "漫游图床画廊，浏览大图并复制链接。"
        ? t("notes.deck_desc", { defaultValue: "漫游图床画廊，浏览大图并复制链接。" })
        : rawDeckDesc;

    return {
        name,
        description,
        avatar: normalizeBlobUrl(config.get<string>(SITE_CONFIG_KEYS.avatar)) || config.get<string>(SITE_CONFIG_KEYS.avatar) || "",
        pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : 5,
        headerBehavior: config.get<string>(SITE_CONFIG_KEYS.headerBehavior) || "fixed",
        feedLayout: normalizeFeedLayout(config.get<string>(SITE_CONFIG_KEYS.feedLayout) || "list"),
        feedCardVariant: normalizeFeedCardVariant(config.get<string>(SITE_CONFIG_KEYS.feedCardVariant) || "default"),
        headerLayout: config.get<string>(SITE_CONFIG_KEYS.headerLayout) || "classic",
        themeColor: config.get<string>(SITE_CONFIG_KEYS.themeColor) || "#d87a90",
        themeSecondaryColor: config.get<string>(SITE_CONFIG_KEYS.themeSecondaryColor) || "#e7a1b0",
        themeOpacity: normalizeThemeOpacity(config.get(SITE_CONFIG_KEYS.themeOpacity)),
        themeFontFamily: config.get<string>(SITE_CONFIG_KEYS.themeFontFamily) || "sans",
        themeFontSize: Number.parseInt(String(config.get(SITE_CONFIG_KEYS.themeFontSize) ?? 16), 10) || 16,
        themeTitleFont: config.get<string>(SITE_CONFIG_KEYS.themeTitleFont) || "serif",
        themeTitleEffect:
          config.get<string>(SITE_CONFIG_KEYS.themeTitleEffect) ||
          config.get<string>(SITE_CONFIG_KEYS.atelierTitleStyle) ||
          "clean",
        themePreset: config.get<string>(SITE_CONFIG_KEYS.themePreset) || "sakura_paper",
        themeAmbience: config.get<string>(SITE_CONFIG_KEYS.themeAmbience) || "none",
        themeCustomColorEnabled: config.getBoolean(SITE_CONFIG_KEYS.themeCustomColorEnabled),
        themeWallpaper: config.get<string>(SITE_CONFIG_KEYS.themeWallpaper) || "none",
        themeWallpaperOpacity: (() => {
            const raw = config.get(SITE_CONFIG_KEYS.themeWallpaperOpacity);
            const val = Number.parseInt(String(raw ?? 35), 10);
            return Number.isNaN(val) ? 35 : Math.min(100, Math.max(0, val));
        })(),
        themeCustomCursor: config.get(SITE_CONFIG_KEYS.themeCustomCursor) !== false && config.get(SITE_CONFIG_KEYS.themeCustomCursor) !== "false",
        themeReadingProgress: config.get(SITE_CONFIG_KEYS.themeReadingProgress) !== false && config.get(SITE_CONFIG_KEYS.themeReadingProgress) !== "false",
        galleryTiltDegree: (() => {
            const raw = config.get(SITE_CONFIG_KEYS.galleryTiltDegree);
            const val = Number.parseFloat(String(raw ?? 1.8));
            return Number.isNaN(val) ? 1.8 : Math.min(10, Math.max(0, val));
        })(),
        headerShowNav,
        headerStickyEnabled: config.get(SITE_CONFIG_KEYS.headerStickyEnabled) !== false && config.get(SITE_CONFIG_KEYS.headerStickyEnabled) !== "false",
        headerPosition: config.get<string>(SITE_CONFIG_KEYS.headerPosition) || "top",
        headerNavFontSize: Number.parseInt(String(config.get(SITE_CONFIG_KEYS.headerNavFontSize) ?? 15), 10) || 15,
        headerNavGap: Number.parseInt(String(config.get(SITE_CONFIG_KEYS.headerNavGap) ?? 12), 10) || 12,
        headerNavOrganicTilt: config.get(SITE_CONFIG_KEYS.headerNavOrganicTilt) !== false && config.get(SITE_CONFIG_KEYS.headerNavOrganicTilt) !== "false",
        pageHeaderMode: (config.get<string>(SITE_CONFIG_KEYS.pageHeaderMode) || "clean") as "clean" | "banner" | "hidden",
        pageHeaderBannerUrl: config.get<string>(SITE_CONFIG_KEYS.pageHeaderBannerUrl) || "",
        storageAllowPublicUpload: config.getBoolean(SITE_CONFIG_KEYS.storageAllowPublicUpload),
        storageGalleryShowInNav: config.getBoolean(SITE_CONFIG_KEYS.storageGalleryShowInNav),
        openlistWorkerUrl: config.get<string>(SITE_CONFIG_KEYS.openlistWorkerUrl) || "",
        openlistShowInNav: config.get(SITE_CONFIG_KEYS.openlistShowInNav) === true || config.get(SITE_CONFIG_KEYS.openlistShowInNav) === "true",
        openlistNavTitle,

        musicEnabled: config.get(SITE_CONFIG_KEYS.musicEnabled) === true || config.get(SITE_CONFIG_KEYS.musicEnabled) === "true",
        musicAutoPlay: config.get(SITE_CONFIG_KEYS.musicAutoPlay) === true || config.get(SITE_CONFIG_KEYS.musicAutoPlay) === "true",
        musicSourceType: config.get<string>(SITE_CONFIG_KEYS.musicSourceType) || "gdstudio",
        musicGdApi: config.get<string>(SITE_CONFIG_KEYS.musicGdApi) || "https://music-api.gdstudio.xyz/api.php",
        musicGdSource: config.get<string>(SITE_CONFIG_KEYS.musicGdSource) || "netease",
        musicOpenlistUrl: config.get<string>(SITE_CONFIG_KEYS.musicOpenlistUrl) || "",
        musicPlaylist: config.get<string>(SITE_CONFIG_KEYS.musicPlaylist) || "",
        musicPosition: config.get<string>(SITE_CONFIG_KEYS.musicPosition) || "bottom-right",
        atelierTitle,
        atelierTitleStyle: config.get<string>(SITE_CONFIG_KEYS.atelierTitleStyle) || "aurora_flow",
        hashtagsTitleStyle: config.get<string>(SITE_CONFIG_KEYS.hashtagsTitleStyle) || "aurora_flow",
        timelineTitleStyle: config.get<string>(SITE_CONFIG_KEYS.timelineTitleStyle) || "aurora_flow",
        momentsTitleStyle: config.get<string>(SITE_CONFIG_KEYS.momentsTitleStyle) || "aurora_flow",
        friendsTitleStyle: config.get<string>(SITE_CONFIG_KEYS.friendsTitleStyle) || "aurora_flow",
        atelierTitleColor: config.get<string>(SITE_CONFIG_KEYS.atelierTitleColor) || "",
        atelierTitleCustomColorEnabled: config.getBoolean(SITE_CONFIG_KEYS.atelierTitleCustomColorEnabled),
        atelierAboutUrl: config.get<string>(SITE_CONFIG_KEYS.atelierAboutUrl) || "/about",
        atelierAboutDesc,
        atelierAboutBg: config.get<string>(SITE_CONFIG_KEYS.atelierAboutBg) || "",
        atelierAboutIcon: config.get<string>(SITE_CONFIG_KEYS.atelierAboutIcon) || "ri-user-smile-line",

        atelierTimelineUrl: config.get<string>(SITE_CONFIG_KEYS.atelierTimelineUrl) || "/timeline",
        atelierTimelineDesc,
        atelierTimelineBg: config.get<string>(SITE_CONFIG_KEYS.atelierTimelineBg) || "",
        atelierTimelineIcon: config.get<string>(SITE_CONFIG_KEYS.atelierTimelineIcon) || "ri-time-line",

        atelierMomentsUrl: config.get<string>(SITE_CONFIG_KEYS.atelierMomentsUrl) || "/moments",
        atelierMomentsDesc,
        atelierMomentsBg: config.get<string>(SITE_CONFIG_KEYS.atelierMomentsBg) || "",
        atelierMomentsIcon: config.get<string>(SITE_CONFIG_KEYS.atelierMomentsIcon) || "ri-chat-heart-line",

        atelierFriendsUrl: config.get<string>(SITE_CONFIG_KEYS.atelierFriendsUrl) || "/friends",
        atelierFriendsDesc,
        atelierFriendsBg: config.get<string>(SITE_CONFIG_KEYS.atelierFriendsBg) || "",
        atelierFriendsIcon: config.get<string>(SITE_CONFIG_KEYS.atelierFriendsIcon) || "ri-planet-line",

        atelierSearchUrl: config.get<string>(SITE_CONFIG_KEYS.atelierSearchUrl) || "/search",
        atelierSearchDesc,
        atelierSearchBg: config.get<string>(SITE_CONFIG_KEYS.atelierSearchBg) || "",
        atelierSearchIcon: config.get<string>(SITE_CONFIG_KEYS.atelierSearchIcon) || "ri-search-line",

        atelierDeckUrl: config.get<string>(SITE_CONFIG_KEYS.atelierDeckUrl) || "/gallery",
        atelierDeckDesc,
        atelierDeckBg: config.get<string>(SITE_CONFIG_KEYS.atelierDeckBg) || "",
        atelierDeckIcon: config.get<string>(SITE_CONFIG_KEYS.atelierDeckIcon) || "ri-camera-lens-line",
        atelierNotesLayout: config.get<string>(SITE_CONFIG_KEYS.atelierNotesLayout) || "grid",

        atelierAboutShow: config.get(SITE_CONFIG_KEYS.atelierAboutShow) !== false && config.get(SITE_CONFIG_KEYS.atelierAboutShow) !== "false",
        atelierAboutStyle: config.get<string>(SITE_CONFIG_KEYS.atelierAboutStyle) || "card",
        atelierAboutTextMode: (config.get<string>(SITE_CONFIG_KEYS.atelierAboutTextMode) || "hover") as "hover" | "hidden" | "always",
        atelierTimelineShow: config.get(SITE_CONFIG_KEYS.atelierTimelineShow) !== false && config.get(SITE_CONFIG_KEYS.atelierTimelineShow) !== "false",
        atelierTimelineStyle: config.get<string>(SITE_CONFIG_KEYS.atelierTimelineStyle) || "card",
        atelierTimelineTextMode: (config.get<string>(SITE_CONFIG_KEYS.atelierTimelineTextMode) || "hover") as "hover" | "hidden" | "always",
        atelierMomentsShow: config.get(SITE_CONFIG_KEYS.atelierMomentsShow) !== false && config.get(SITE_CONFIG_KEYS.atelierMomentsShow) !== "false",
        atelierMomentsStyle: config.get<string>(SITE_CONFIG_KEYS.atelierMomentsStyle) || "card",
        atelierMomentsTextMode: (config.get<string>(SITE_CONFIG_KEYS.atelierMomentsTextMode) || "hover") as "hover" | "hidden" | "always",
        atelierFriendsShow: config.get(SITE_CONFIG_KEYS.atelierFriendsShow) !== false && config.get(SITE_CONFIG_KEYS.atelierFriendsShow) !== "false",
        atelierFriendsStyle: config.get<string>(SITE_CONFIG_KEYS.atelierFriendsStyle) || "card",
        atelierFriendsTextMode: (config.get<string>(SITE_CONFIG_KEYS.atelierFriendsTextMode) || "hover") as "hover" | "hidden" | "always",
        atelierSearchShow: config.get(SITE_CONFIG_KEYS.atelierSearchShow) !== false && config.get(SITE_CONFIG_KEYS.atelierSearchShow) !== "false",
        atelierSearchStyle: config.get<string>(SITE_CONFIG_KEYS.atelierSearchStyle) || "card",
        atelierSearchTextMode: (config.get<string>(SITE_CONFIG_KEYS.atelierSearchTextMode) || "hover") as "hover" | "hidden" | "always",
        atelierDeckShow: config.get(SITE_CONFIG_KEYS.atelierDeckShow) !== false && config.get(SITE_CONFIG_KEYS.atelierDeckShow) !== "false",
        atelierDeckStyle: config.get<string>(SITE_CONFIG_KEYS.atelierDeckStyle) || "card",
        atelierDeckTextMode: (config.get<string>(SITE_CONFIG_KEYS.atelierDeckTextMode) || "hover") as "hover" | "hidden" | "always",

        galleryPadding: (() => {
            const padRaw = config.get(SITE_CONFIG_KEYS.galleryPadding);
            if (padRaw === undefined || padRaw === null || padRaw === "") return 24;
            const parsed = Number.parseInt(String(padRaw), 10);
            return Number.isNaN(parsed) ? 24 : Math.max(0, parsed);
        })(),
        galleryColumns: String(config.get(SITE_CONFIG_KEYS.galleryColumns) ?? "auto"),
        galleryAlign: String(config.get(SITE_CONFIG_KEYS.galleryAlign) ?? "center"),
        galleryCardSize: String(config.get(SITE_CONFIG_KEYS.galleryCardSize) ?? "medium"),
        galleryCardMaxWidth: Number.parseInt(String(config.get(SITE_CONFIG_KEYS.galleryCardMaxWidth) ?? 380), 10) || 380,
        galleryCardGap: (() => {
            const gapRaw = config.get(SITE_CONFIG_KEYS.galleryCardGap);
            if (gapRaw === undefined || gapRaw === null || gapRaw === "") return 16;
            const parsed = Number.parseInt(String(gapRaw), 10);
            return Number.isNaN(parsed) ? 16 : Math.max(0, parsed);
        })(),
        galleryTiltMode: String(config.get(SITE_CONFIG_KEYS.galleryTiltMode) ?? "subtle"),
        homepageTagsConfig: config.get<string>(SITE_CONFIG_KEYS.homepageTagsConfig) || "",

        danmakuSpeed: String(config.get(SITE_CONFIG_KEYS.danmakuSpeed) ?? "normal"),
        aiSummaryEnabled: config.get(SITE_CONFIG_KEYS.aiSummaryEnabled) === true || config.get(SITE_CONFIG_KEYS.aiSummaryEnabled) === "true",

        friendsCategories: (() => {
            try {
                const raw = config.get("friends.categories");
                if (raw) {
                    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
                }
            } catch {}
            return ["友邻博客", "主机算力", "探针测速", "极客工具", "技术社区", "漫游灵感"];
        })(),
    };
    }, [config, t]);
}

// Hook to get a specific site config value
export function useSiteConfigValue<K extends keyof typeof SITE_CONFIG_KEYS>(
    key: K
): typeof SITE_CONFIG_KEYS[K] extends "site.page_size" ? number : string {
    const config = useContext(ClientConfigContext);
    const configKey = SITE_CONFIG_KEYS[key];

    if (key === "pageSize") {
        const value = config.get<string | number>(configKey);
        const parsed =
            typeof value === "number"
                ? value
                : typeof value === "string"
                    ? parseInt(value, 10)
                    : NaN;
        return (Number.isFinite(parsed) ? parsed : 5) as any;
    }

    return (config.get<string>(configKey) || "") as any;
}
