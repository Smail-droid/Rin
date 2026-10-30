import { useContext } from "react";
import { ClientConfigContext } from "../state/config";
import { normalizeFeedCardVariant } from "../components/feed-card-options";
import { normalizeFeedLayout } from "../components/feed-layout-options";

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
    headerShowNav: "header.show_nav",
    atelierTitle: "atelier.title",
    atelierAboutUrl: "atelier.about_url",
    atelierAboutDesc: "atelier.about_desc",
    atelierAboutBg: "atelier.about_bg",

    atelierTimelineUrl: "atelier.timeline_url",
    atelierTimelineDesc: "atelier.timeline_desc",
    atelierTimelineBg: "atelier.timeline_bg",

    atelierMomentsUrl: "atelier.moments_url",
    atelierMomentsDesc: "atelier.moments_desc",
    atelierMomentsBg: "atelier.moments_bg",

    atelierFriendsUrl: "atelier.friends_url",
    atelierFriendsDesc: "atelier.friends_desc",
    atelierFriendsBg: "atelier.friends_bg",

    atelierSearchUrl: "atelier.search_url",
    atelierSearchDesc: "atelier.search_desc",
    atelierSearchBg: "atelier.search_bg",

    atelierDeckUrl: "atelier.deck_url",
    atelierDeckDesc: "atelier.deck_desc",
    atelierDeckBg: "atelier.deck_bg",
} as const;

// Hook to get site configuration
export function useSiteConfig() {
    const config = useContext(ClientConfigContext);
    const pageSizeValue = config.get<string | number>(SITE_CONFIG_KEYS.pageSize);
    const parsedPageSize =
        typeof pageSizeValue === "number"
            ? pageSizeValue
            : typeof pageSizeValue === "string"
                ? parseInt(pageSizeValue, 10)
                : NaN;

    const showNavRaw = config.get<string | boolean>(SITE_CONFIG_KEYS.headerShowNav);
    const headerShowNav = showNavRaw === undefined ? undefined : showNavRaw === true || showNavRaw === "true";

    return {
        name: config.get<string>(SITE_CONFIG_KEYS.name) || "Rin",
        description: config.get<string>(SITE_CONFIG_KEYS.description) || "",
        avatar: config.get<string>(SITE_CONFIG_KEYS.avatar) || "",
        pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : 5,
        headerBehavior: config.get<string>(SITE_CONFIG_KEYS.headerBehavior) || "fixed",
        feedLayout: normalizeFeedLayout(config.get<string>(SITE_CONFIG_KEYS.feedLayout) || "list"),
        feedCardVariant: normalizeFeedCardVariant(config.get<string>(SITE_CONFIG_KEYS.feedCardVariant) || "default"),
        headerLayout: config.get<string>(SITE_CONFIG_KEYS.headerLayout) || "classic",
        themeColor: config.get<string>(SITE_CONFIG_KEYS.themeColor) || "#fc466b",
        headerShowNav,
        atelierTitle: config.get<string>(SITE_CONFIG_KEYS.atelierTitle) || "画廊随想",
        atelierAboutUrl: config.get<string>(SITE_CONFIG_KEYS.atelierAboutUrl) || "/about",
        atelierAboutDesc: config.get<string>(SITE_CONFIG_KEYS.atelierAboutDesc) || "欢迎光临我的记忆工坊与随笔空间，点击了解更多。",
        atelierAboutBg: config.get<string>(SITE_CONFIG_KEYS.atelierAboutBg) || "",

        atelierTimelineUrl: config.get<string>(SITE_CONFIG_KEYS.atelierTimelineUrl) || "/timeline",
        atelierTimelineDesc: config.get<string>(SITE_CONFIG_KEYS.atelierTimelineDesc) || "以时间为轴，串联起每一次灵感与技术实践。",
        atelierTimelineBg: config.get<string>(SITE_CONFIG_KEYS.atelierTimelineBg) || "",

        atelierMomentsUrl: config.get<string>(SITE_CONFIG_KEYS.atelierMomentsUrl) || "/moments",
        atelierMomentsDesc: config.get<string>(SITE_CONFIG_KEYS.atelierMomentsDesc) || "生活碎碎念、灵感火花与不设限的日常记录。",
        atelierMomentsBg: config.get<string>(SITE_CONFIG_KEYS.atelierMomentsBg) || "",

        atelierFriendsUrl: config.get<string>(SITE_CONFIG_KEYS.atelierFriendsUrl) || "/friends",
        atelierFriendsDesc: config.get<string>(SITE_CONFIG_KEYS.atelierFriendsDesc) || "漫步在同好博主的数字花园，交换思想火花。",
        atelierFriendsBg: config.get<string>(SITE_CONFIG_KEYS.atelierFriendsBg) || "",

        atelierSearchUrl: config.get<string>(SITE_CONFIG_KEYS.atelierSearchUrl) || "/search",
        atelierSearchDesc: config.get<string>(SITE_CONFIG_KEYS.atelierSearchDesc) || "输入关键词即刻检索文章与解决方案。",
        atelierSearchBg: config.get<string>(SITE_CONFIG_KEYS.atelierSearchBg) || "",

        atelierDeckUrl: config.get<string>(SITE_CONFIG_KEYS.atelierDeckUrl) || "/gallery",
        atelierDeckDesc: config.get<string>(SITE_CONFIG_KEYS.atelierDeckDesc) || "漫游图床画廊，浏览大图并复制链接。",
        atelierDeckBg: config.get<string>(SITE_CONFIG_KEYS.atelierDeckBg) || "",
    };
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
