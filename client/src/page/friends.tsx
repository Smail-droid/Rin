import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from "react-i18next";
import { Modal } from "@rin/ui";
import { useAlert, useConfirm } from "../components/dialog";
import { ImageWithFallback } from "../components/image-with-fallback";
import { Waiting } from "../components/loading";
import { GALLERY_CONTAINER_CLASS, PageHeader } from "../components/page-header";
import { client } from "../app/runtime";
import { ProfileContext } from "../state/profile";
import { safeHttpUrl } from "../utils/url";
import { emitToast } from "../utils/toast";
import { useSiteConfig } from "../hooks/useSiteConfig";

export type FriendItem = {
    name: string;
    id: number;
    uid: number;
    avatar: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    desc: string | null;
    url: string;
    accepted: number;
    health: string;
    sort_order?: number | null;
};

// 头像呈现模式：dual（子母融合：主站点Logo + 坛友头像角标）、site（仅站点Logo）、ns（仅NodeSeek坛友头像）
export type AvatarDisplayMode = "dual" | "site" | "ns";

export interface NodeSeekUserData {
    name?: string;
    member_name?: string;
    rank?: number;
    coin?: number;
    days?: number | string;
    join_days?: number | string;
    posts?: number;
    nPost?: number;
    comments?: number;
    nComment?: number;
    bio?: string;
    created_at_str?: string;
}

// 纯矢量手绘钻石等级切面 SVG 图标 (彻底终结黄色奖杯或系统原生 Emoji 像素失真)
export function DiamondRankSvg({ className = "w-3 h-3" }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor" fillOpacity="0.2" />
            <path d="M11 3 8 9l4 12 4-12-3-6" />
            <path d="M2 9h20" />
        </svg>
    );
}

// 复制 NodeSeek 个人空间完整概览文本智能结构化解析 (支持官方 API JSON、DevTools 拷贝与网页划选文本)
export function parseNodeSeekPastedText(text: string): {
    name?: string;
    rank?: number;
    coin?: number;
    days?: number;
    posts?: number;
    comments?: number;
    bio?: string;
} {
    if (!text) return {};
    const trimmed = text.trim();

    // 1. 原生 JSON 纯净直读（支持官方接口完整响应或 detail 结构）
    const jsonCandidate = trimmed.startsWith("{")
        ? trimmed
        : (trimmed.match(/\{[\s\S]*\}/)?.[0] || null);

    if (jsonCandidate) {
        try {
            const data = JSON.parse(jsonCandidate);
            const d = data.detail || data;
            if (d && (d.rank !== undefined || d.coin !== undefined || d.member_id !== undefined)) {
                let days = typeof d.days === "number" ? d.days : undefined;
                if (!days && d.created_at) {
                    const diff = Date.now() - new Date(d.created_at).getTime();
                    if (!isNaN(diff) && diff > 0) {
                        days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    }
                } else if (!days && d.created_at_str) {
                    const m = String(d.created_at_str).match(/(\d+)\s*days/i);
                    if (m) days = parseInt(m[1], 10);
                }
                return {
                    name: typeof d.member_name === "string" ? d.member_name : undefined,
                    rank: typeof d.rank === "number" ? d.rank : (d.rank ? parseInt(d.rank, 10) : undefined),
                    coin: typeof d.coin === "number" ? d.coin : (d.coin ? parseInt(d.coin, 10) : undefined),
                    days: days || undefined,
                    posts: typeof d.nPost === "number" ? d.nPost : (d.posts !== undefined ? Number(d.posts) : undefined),
                    comments: typeof d.nComment === "number" ? d.nComment : (d.comments !== undefined ? Number(d.comments) : undefined),
                    bio: typeof d.bio === "string" && d.bio.trim() ? d.bio.trim() : undefined,
                };
            }
        } catch {}
    }

    // 2. 字段级数值抽取（兼容 DevTools 键值对拷贝与前台网页划选文本）
    const num = (pattern: RegExp) => {
        const m = trimmed.match(pattern);
        return m ? parseInt(m[1], 10) : undefined;
    };

    const rank = num(/(?:rank|Lv\.?|等级)\s*[:：]?\s*(\d+)/i) ?? num(/(\d+)\s*级/i);
    const coin = num(/(?:coin|鸡腿(?:数目|数)?)\s*[:：]?\s*(\d+)/i) ?? num(/(\d+)\s*个?鸡腿/i);
    let days = num(/(?:已加入|加入天数|加入|天数)\s*[:：]?\s*(\d+)/i) ?? num(/(\d+)\s*天/i);
    if (!days) {
        const daysStrMatch = trimmed.match(/created_at_str\s*[:：]?\s*["'\s]*(\d+)\s*days/i);
        if (daysStrMatch) {
            days = parseInt(daysStrMatch[1], 10);
        } else {
            const createdAtMatch = trimmed.match(/created_at\s*[:：]?\s*["']([^"'\n\r]+)["']/i);
            if (createdAtMatch) {
                const diff = Date.now() - new Date(createdAtMatch[1]).getTime();
                if (!isNaN(diff) && diff > 0) {
                    days = Math.floor(diff / (1000 * 60 * 60 * 24));
                }
            }
        }
    }
    const posts = num(/(?:nPost|主题帖数|主题数|主题帖|主题)\s*[:：]?\s*(\d+)/i) ?? num(/(\d+)\s*篇?主题/i);
    const comments = num(/(?:nComment|评论数目|评论数|评论)\s*[:：]?\s*(\d+)/i) ?? num(/(\d+)\s*条?评论/i);

    // 智能提取用户名，避开统计词汇、URL与纯数字
    let name: string | undefined;
    const nameMatch = trimmed.match(/(?:member_name|用户名|坛友|昵称)\s*[:：]?\s*["']?([^\s"'\n\r]+)["']?/i);
    if (nameMatch && nameMatch[1]?.trim()) {
        name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    } else {
        const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const invalidKw = ["加入", "天数", "等级", "lv", "鸡腿", "主题", "评论", "空间", "uid", "http", "www.", "detail", "success", "true", "false"];
        const candidate = lines.find(line => {
            const low = line.toLowerCase();
            return !invalidKw.some(kw => low.includes(kw)) && line.length <= 25 && !/^\d+$/.test(line) && low !== "nodeseek";
        });
        if (candidate) name = candidate;
    }

    const bioMatch = trimmed.match(/(?:bio|个性签名|个人签名|签名)\s*[:：]?\s*["']?([^"'\n\r]+)["']?/i);
    let bio = bioMatch ? bioMatch[1].trim().replace(/^["']|["']$/g, "") : undefined;
    if (bio === '""' || bio === "''") bio = undefined;

    return { name, rank, coin, days, posts, comments, bio };
}

// 历史分类向后兼容标准化映射
export function normalizeCategory(cat: string): string {
    const raw = (cat || "").trim();
    if (raw === "友友们") return "友邻博客";
    if (raw === "VPS/基础设施" || raw === "VPS" || raw === "基础设施" || raw === "主机算力") return "主机算力";
    if (
        raw === "测速/探针监控" ||
        raw === "网络测速/路由" ||
        raw === "买鸡/探针监控" ||
        raw === "测速" ||
        raw === "探针监控" ||
        raw === "探针测速"
    ) return "探针测速";
    if (raw === "极客常用工具" || raw === "常用工具" || raw === "极客工具") return "极客工具";
    if (raw === "技术极客社区" || raw === "极客社区" || raw === "技术社区") return "技术社区";
    if (raw === "其他灵感" || raw === "漫游灵感") return "漫游灵感";
    return raw || "友邻博客";
}

// 清洗脱壳历史受损的 weserv 头像链接，还原为真实的原图直链
export function sanitizeAvatarUrl(url: string | null | undefined): string {
    if (!url) return "";
    const trimmed = url.trim();
    // 匹配 images.weserv.nl 代理的 NodeSeek 头像
    const weservNsMatch = trimmed.match(/images\.weserv\.nl\/\?url=(?:https?:\/\/)?(?:www\.)?nodeseek\.com\/avatar\/(\d+)\.png/i);
    if (weservNsMatch && weservNsMatch[1]) {
        return `https://www.nodeseek.com/avatar/${weservNsMatch[1]}.png`;
    }
    // 匹配通用 images.weserv.nl 包装的外部图片链接
    const generalWeservMatch = trimmed.match(/images\.weserv\.nl\/\?url=([^\s&]+)/i);
    if (generalWeservMatch && generalWeservMatch[1]) {
        let raw = generalWeservMatch[1];
        try {
            raw = decodeURIComponent(raw);
        } catch {}
        if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
            raw = `https://${raw}`;
        }
        return raw;
    }
    return trimmed;
}

// 浏览器客户端轻量直取头像并转 Base64 供直接存入 R2
export async function fetchClientAvatarBase64(uid: string): Promise<string | null> {
    if (!uid) return null;
    try {
        const res = await fetch(`https://www.nodeseek.com/avatar/${uid}.png`);
        if (res.ok) {
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        }
    } catch {}
    return null;
}

// 规范化坛友数据格式
function normalizeNsDetail(d: any): NodeSeekUserData {
    let days: number | undefined;
    if (typeof d.days === "number") {
        days = d.days;
    } else if (d.created_at) {
        days = Math.max(1, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000));
    } else if (d.created_at_str) {
        const m = String(d.created_at_str).match(/(\d+)\s*days/i);
        if (m) days = parseInt(m[1], 10);
    }
    return {
        name: d.member_name,
        member_name: d.member_name,
        rank: typeof d.rank === "number" ? d.rank : (d.rank ? parseInt(d.rank, 10) : 1),
        coin: typeof d.coin === "number" ? d.coin : (d.coin ? parseInt(d.coin, 10) : 0),
        days: days || 1,
        join_days: days ? `${days}天` : undefined,
        posts: d.nPost ?? d.posts ?? 0,
        comments: d.nComment ?? d.comments ?? 0,
        bio: typeof d.bio === "string" ? d.bio.trim() : "",
    };
}

// 统一友链空间数据解析（利用客户端浏览器网络直连与无头穿透自动抓取）
export async function fetchClientSideNsDetail(uid: string): Promise<NodeSeekUserData | null> {
    if (!uid) return null;
    const apiUrl = `https://www.nodeseek.com/api/account/getInfo/${uid}?readme=1`;

    // 1. 优先使用浏览器客户端当前网络直连获取 (利用已通过CF人机验证的网络与指纹)
    try {
        const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        if (res.ok) {
            const data = await res.json();
            if (data?.detail) return normalizeNsDetail(data.detail);
        }
    } catch {}

    // 2. 浏览器受同源 CORS 限制时，通过公用无头代理穿透直读
    try {
        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(apiUrl)}&data.body=%7B%22selector%22%3A%22body%22%7D`;
        const res = await fetch(mUrl);
        if (res.ok) {
            const data = await res.json();
            const clean = (data?.data?.body || "").replace(/<[^>]+>/g, "").trim();
            const parsed = JSON.parse(clean);
            if (parsed?.detail) return normalizeNsDetail(parsed.detail);
        }
    } catch {}

    return null;
}

// 从描述中解析分类标签 [分类]、HTML 注释元数据扩展以及纯净简介
export function parseFriendCategory(
    desc: string | null,
    url: string = "",
    friendName: string = "",
    avatar: string = ""
): {
    category: string;
    cleanDesc: string;
    spaceUrl?: string;
    probeUrl?: string;
    nodeCount?: number;
    nsData?: NodeSeekUserData;
    avatarMode?: AvatarDisplayMode;
    nsAvatar?: string;
    siteAvatar?: string;
} {
    let raw = desc || "";
    let spaceUrl: string | undefined;
    let probeUrl: string | undefined;
    let nodeCount: number | undefined;
    let nsData: NodeSeekUserData | undefined;
    let avatarMode: AvatarDisplayMode = "dual";
    let nsAvatar: string | undefined;
    let siteAvatar: string | undefined;

    // 1. 提取 HTML 注释 metadata: <!--space:xxx|probe:xxx|nodes:5|ns:{...}|avatarMode:dual|nsAvatar:xxx|siteAvatar:xxx-->
    const commentMatch = raw.match(/<!--(.*?)-->/);
    if (commentMatch) {
        const metaStr = commentMatch[1];
        raw = raw.replace(/<!--.*?-->/, "").trim();
        metaStr.split("|").forEach(part => {
            const colonIdx = part.indexOf(":");
            if (colonIdx !== -1) {
                const k = part.slice(0, colonIdx).trim();
                const v = part.slice(colonIdx + 1).trim();
                if (k === "space" && v) spaceUrl = v;
                if (k === "probe" && v) probeUrl = v;
                if (k === "nodes" && v) nodeCount = parseInt(v, 10);
                if (k === "avatarMode" && (v === "site" || v === "ns" || v === "dual")) avatarMode = v as AvatarDisplayMode;
                if (k === "nsAvatar" && v) nsAvatar = sanitizeAvatarUrl(v);
                if (k === "siteAvatar" && v) siteAvatar = sanitizeAvatarUrl(v);
                if (k === "ns" && v) {
                    try {
                        nsData = JSON.parse(decodeURIComponent(v));
                    } catch {}
                }
            }
        });
    }

    // 自动推导 spaceUrl
    if (!spaceUrl) {
        if (url && (url.includes("nodeseek.com/space/") || url.includes("space/"))) {
            spaceUrl = url;
        } else if (friendName) {
            const uidMatch = friendName.match(/NodeSeek#(\d+)/i) || friendName.match(/UID[:\s#]+(\d+)/i);
            if (uidMatch && uidMatch[1]) {
                spaceUrl = `https://www.nodeseek.com/space/${uidMatch[1]}#/general`;
            }
        }
        if (!spaceUrl && avatar) {
            const cleanAv = sanitizeAvatarUrl(avatar);
            const avUidMatch = cleanAv.match(/nodeseek\.com\/avatar\/(\d+)\.png/i);
            if (avUidMatch && avUidMatch[1]) {
                spaceUrl = `https://www.nodeseek.com/space/${avUidMatch[1]}#/general`;
            }
        }
    }

    if (spaceUrl && !probeUrl && url && !url.includes("nodeseek.com/space/")) {
        probeUrl = url;
    }

    // 2. 匹配开头的分类标识 [分类] 或 【分类】
    const match = raw.match(/^\[([^\]]+)\]\s*(.*)$/) || raw.match(/^【([^】]+)】\s*(.*)$/);
    if (match) {
        return {
            category: normalizeCategory(match[1]),
            cleanDesc: match[2].trim(),
            spaceUrl,
            probeUrl,
            nodeCount,
            nsData,
            avatarMode,
            nsAvatar,
            siteAvatar,
        };
    }

    // 3. 启发式回退推导
    const fallbackCategory = inferCategoryFallback(url, raw);
    return {
        category: fallbackCategory,
        cleanDesc: raw.trim(),
        spaceUrl,
        probeUrl,
        nodeCount,
        nsData,
        avatarMode,
        nsAvatar,
        siteAvatar,
    };
}

// 启发式分类推导引擎
function inferCategoryFallback(url: string, text: string): string {
    const combined = `${url} ${text}`.toLowerCase();
    if (
        combined.includes("vps") ||
        combined.includes("cloud") ||
        combined.includes("host") ||
        combined.includes("server") ||
        combined.includes("idc") ||
        combined.includes("机房") ||
        combined.includes("云服务器") ||
        combined.includes("主机")
    ) {
        return "主机算力";
    }
    if (
        combined.includes("speedtest") ||
        combined.includes("looking glass") ||
        combined.includes("probe") ||
        combined.includes("ping") ||
        combined.includes("bgp") ||
        combined.includes("测速") ||
        combined.includes("路由") ||
        combined.includes("回程") ||
        combined.includes("traceroute") ||
        combined.includes("探针") ||
        combined.includes("nezha") ||
        combined.includes("uptime") ||
        combined.includes("serverstatus")
    ) {
        return "探针测速";
    }
    if (
        combined.includes("github") ||
        combined.includes("tool") ||
        combined.includes("api") ||
        combined.includes("docker") ||
        combined.includes("dev") ||
        combined.includes("toolbox") ||
        combined.includes("工具") ||
        combined.includes("转换")
    ) {
        return "极客工具";
    }
    if (
        combined.includes("nodeseek") ||
        combined.includes("v2ex") ||
        combined.includes("linux.do") ||
        combined.includes("hostloc") ||
        combined.includes("community") ||
        combined.includes("forum") ||
        combined.includes("论坛") ||
        combined.includes("社区")
    ) {
        return "技术社区";
    }
    if (
        combined.includes("design") ||
        combined.includes("art") ||
        combined.includes("灵感") ||
        combined.includes("画廊") ||
        combined.includes("美学")
    ) {
        return "漫游灵感";
    }
    return "友邻博客";
}

// 规范化拼接分类前缀与 HTML 注释元数据
export function formatFriendDesc(
    category: string,
    desc: string,
    meta?: {
        spaceUrl?: string;
        probeUrl?: string;
        nodeCount?: number;
        nsData?: NodeSeekUserData;
        avatarMode?: AvatarDisplayMode;
        nsAvatar?: string;
        siteAvatar?: string;
    }
): string {
    const cat = normalizeCategory(category);
    const cleanDesc = desc.trim();

    let metaParts: string[] = [];
    if (meta) {
        if (meta.spaceUrl) metaParts.push(`space:${meta.spaceUrl.trim()}`);
        if (meta.probeUrl) metaParts.push(`probe:${meta.probeUrl.trim()}`);
        if (meta.nodeCount !== undefined && meta.nodeCount > 0 && meta.probeUrl) metaParts.push(`nodes:${meta.nodeCount}`);
        if (meta.avatarMode) metaParts.push(`avatarMode:${meta.avatarMode}`);
        if (meta.nsAvatar) metaParts.push(`nsAvatar:${meta.nsAvatar.trim()}`);
        if (meta.siteAvatar) metaParts.push(`siteAvatar:${meta.siteAvatar.trim()}`);
        if (meta.nsData) {
            try {
                metaParts.push(`ns:${encodeURIComponent(JSON.stringify(meta.nsData))}`);
            } catch {}
        }
    }
    const metaStr = metaParts.length > 0 ? `<!--${metaParts.join("|")}-->` : "";

    const combined = cat && cat !== "全部"
        ? `[${cat}] ${cleanDesc}`
        : cleanDesc;

    return metaStr ? `${metaStr} ${combined}`.trim() : combined;
}

export const PRESET_CATEGORIES = [
    "全部",
    "友邻博客",
    "主机算力",
    "探针测速",
    "极客工具",
    "技术社区",
    "漫游灵感"
];

export function FriendsPage() {
    const { t } = useTranslation();
    const profile = useContext(ProfileContext);
    const siteConfig = useSiteConfig();

    const [categories, setCategories] = useState<string[]>(() => {
        return (siteConfig as any).friendsCategories || [
            "友邻博客", "主机算力", "探针测速", "极客工具", "技术社区", "漫游灵感"
        ];
    });
    const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);

    const [allFriends, setAllFriends] = useState<FriendItem[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading'>('loading');
    const [activeCategory, setActiveCategory] = useState<string>("全部");
    const [searchKeyword, setSearchKeyword] = useState<string>("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // 弹窗表单状态
    const [formUrl, setFormUrl] = useState("");
    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formAvatar, setFormAvatar] = useState("");
    const [formSpaceUrl, setFormSpaceUrl] = useState("");
    const [formCategory, setFormCategory] = useState("友邻博客");
    const [isSniffing, setIsSniffing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 视图风格切换 (画册卡片 / 高密书签 / 拍立得便签)
    const [viewStyle, setViewStyle] = useState<"card" | "compact" | "polaroid">(() => {
        try {
            const saved = localStorage.getItem("rin_friends_view_style");
            if (saved === "compact" || saved === "polaroid") return saved;
            return "card";
        } catch {
            return "card";
        }
    });

    // 来源头像自动提取与 R2 专属转存状态
    const [sourceAvatarUrl, setSourceAvatarUrl] = useState("");
    const [isExtractingAvatar, setIsExtractingAvatar] = useState(false);
    const [isRefiningDesc, setIsRefiningDesc] = useState(false);
    const [siteFaviconUrl, setSiteFaviconUrl] = useState("");
    const [nsAvatarUrl, setNsAvatarUrl] = useState("");
    const [nsUserData, setNsUserData] = useState<any | null>(null);
    const [iconChoice, setIconChoice] = useState<AvatarDisplayMode>("dual");

    // 编辑友链状态
    const [editingFriend, setEditingFriend] = useState<FriendItem | null>(null);

    const ref = useRef(false);
    const { showAlert, AlertUI } = useAlert();
    const { showConfirm, ConfirmUI } = useConfirm();

    const [extractBtnFeedback, setExtractBtnFeedback] = useState("");
    const extractDebounceTimer = useRef<any>(null);

    // 输入 NodeSeek 链接或纯数字 UID 实时响应空间直达链接，并智能防抖自动触发提取
    const handleSourceAvatarInputChange = (val: string) => {
        setSourceAvatarUrl(val);
        const trimmed = val.trim();
        const pureDigits = trimmed.match(/^\d{1,8}$/);
        const spaceMatch = trimmed.match(/nodeseek\.com\/space\/(\d+)/i) || trimmed.match(/space\/(\d+)/i);
        const uid = pureDigits ? pureDigits[0] : spaceMatch ? spaceMatch[1] : null;
        if (uid) {
            setFormSpaceUrl(`https://www.nodeseek.com/space/${uid}#/general`);
            setNsAvatarUrl(`https://www.nodeseek.com/avatar/${uid}.png`);

            if (extractDebounceTimer.current) clearTimeout(extractDebounceTimer.current);
            extractDebounceTimer.current = setTimeout(() => {
                void handleExtractSourceAvatar(trimmed);
            }, 400);
        } else if (trimmed.startsWith("http")) {
            setFormSpaceUrl(trimmed);
        }
    };

    // 一键从 NodeSeek 空间提取真实头像、昵称与资产数据并存入 R2 avatars/ 独立目录
    const handleExtractSourceAvatar = async (overrideUrl?: string) => {
        const targetUrl = (overrideUrl || sourceAvatarUrl).trim();
        if (!targetUrl) return;

        setIsExtractingAvatar(true);
        setExtractBtnFeedback("");
        try {
            const uidMatch = targetUrl.match(/^\d{1,8}$/) || targetUrl.match(/space\/(\d+)/i);
            const currentUid = uidMatch ? (uidMatch[1] || uidMatch[0]) : "";

            const [clientDetail, clientAvatar] = await Promise.all([
                currentUid ? fetchClientSideNsDetail(currentUid) : Promise.resolve(null),
                currentUid ? fetchClientAvatarBase64(currentUid) : Promise.resolve(null),
            ]);

            const token = localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/friend/extract-source-avatar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    sourceUrl: targetUrl,
                    name: formName,
                    clientNsDetail: clientDetail || undefined,
                    clientAvatarBase64: clientAvatar || undefined,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.avatarUrl) {
                    setNsAvatarUrl(data.avatarUrl);
                    if (!formAvatar || iconChoice === "ns" || iconChoice === "dual") {
                        setFormAvatar(data.avatarUrl);
                    }
                }
                if (data.spaceUrl && !formSpaceUrl) {
                    setFormSpaceUrl(data.spaceUrl);
                }

                const finalNsDetail = data.nsDetail || clientDetail;
                if (finalNsDetail) {
                    setNsUserData(finalNsDetail);
                    if (finalNsDetail.member_name) {
                        setFormName(finalNsDetail.member_name);
                        setExtractBtnFeedback(`✓ 已识别: ${finalNsDetail.member_name}`);
                    }
                    if (finalNsDetail.bio && !formDesc) {
                        setFormDesc(finalNsDetail.bio.trim().slice(0, 200));
                    }
                } else if (data.inferredName && (!formName || formName.includes("NodeSeek#"))) {
                    setFormName(data.inferredName);
                    setExtractBtnFeedback(`✓ 已识别: ${data.inferredName}`);
                }
                if (data.suggestedDesc && !formDesc) {
                    setFormDesc(data.suggestedDesc);
                }
            }
        } catch (err: any) {
            console.error("Extract source avatar failed:", err);
        } finally {
            setIsExtractingAvatar(false);
            setTimeout(() => setExtractBtnFeedback(""), 3500);
        }
    };

    // 智能精炼简介 (不超过 10 个汉字，单行说清核心)
    const handleRefineDesc = async () => {
        setIsRefiningDesc(true);
        try {
            const token = localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/friend/ai-refine-desc", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    url: formUrl,
                    title: formName,
                    currentDesc: formDesc,
                    nsData: nsUserData,
                    category: formCategory,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.desc) {
                    setFormDesc(data.desc);
                }
            }
        } catch (err) {
            console.error("Refine desc failed:", err);
        } finally {
            setIsRefiningDesc(false);
        }
    };

    // 粘贴或输入目标站点 URL 自动智能嗅探标题、Favicon 与分类
    const handleSniffUrl = async () => {
        if (!formUrl || !formUrl.startsWith("http")) return;
        setIsSniffing(true);
        try {
            const token = localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/friend/inspect", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ url: formUrl }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.name && !formName) setFormName(data.name);
                if (data.desc && !formDesc) setFormDesc(data.desc);
                if (data.avatar) {
                    setSiteFaviconUrl(data.avatar);
                    if (!formAvatar || iconChoice === "site") setFormAvatar(data.avatar);
                }
                if (data.category) setFormCategory(data.category);
            }
        } catch (err) {
            console.error("Sniff URL failed:", err);
        } finally {
            setIsSniffing(false);
        }
    };

    // 切换子母头像展示形态
    const handleIconChoiceChange = (mode: AvatarDisplayMode) => {
        setIconChoice(mode);
        if (mode === "site" && siteFaviconUrl) {
            setFormAvatar(siteFaviconUrl);
        } else if (mode === "ns" && nsAvatarUrl) {
            setFormAvatar(nsAvatarUrl);
        } else if (mode === "dual") {
            setFormAvatar(siteFaviconUrl || nsAvatarUrl || formAvatar);
        }
    };

    const reloadFriends = useCallback(() => {
        setStatus('loading');
        client.friend.list().then(({ data }) => {
            if (data?.friend_list) {
                setAllFriends(data.friend_list);
            }
            setStatus('idle');
        }).catch(() => {
            setStatus('idle');
        });
    }, []);

    useEffect(() => {
        if (!ref.current) {
            ref.current = true;
            reloadFriends();
        }
    }, [reloadFriends]);

    const approvedFriends = useMemo(() => {
        return allFriends.filter((f) => f.accepted === 1);
    }, [allFriends]);

    const pendingFriends = useMemo(() => {
        return allFriends.filter((f) => f.accepted === 0);
    }, [allFriends]);

    const filteredFriends = useMemo(() => {
        let list = approvedFriends;
        if (activeCategory !== "全部") {
            list = list.filter((f) => {
                const parsed = parseFriendCategory(f.desc, f.url, f.name, f.avatar);
                return parsed.category === activeCategory;
            });
        }
        if (searchKeyword.trim()) {
            const kw = searchKeyword.toLowerCase().trim();
            list = list.filter((f) => {
                const parsed = parseFriendCategory(f.desc, f.url, f.name, f.avatar);
                return (
                    f.name.toLowerCase().includes(kw) ||
                    f.url.toLowerCase().includes(kw) ||
                    (f.desc && f.desc.toLowerCase().includes(kw)) ||
                    parsed.cleanDesc.toLowerCase().includes(kw) ||
                    parsed.category.toLowerCase().includes(kw)
                );
            });
        }
        return list;
    }, [approvedFriends, activeCategory, searchKeyword]);

    const handleViewStyleChange = (style: "card" | "compact" | "polaroid") => {
        setViewStyle(style);
        try {
            localStorage.setItem("rin_friends_view_style", style);
        } catch {}
    };

    const handleApprove = async (id: number) => {
        const { error } = await client.friend.update(id, { accepted: 1 });
        if (error) {
            showAlert(typeof error.value === "string" ? error.value : "审核通过失败");
            return;
        }
        emitToast("友链已审核通过", "success");
        reloadFriends();
    };

    const handleReject = async (id: number) => {
        const { error } = await client.friend.update(id, { accepted: -1 });
        if (error) {
            showAlert(typeof error.value === "string" ? error.value : "拒绝失败");
            return;
        }
        emitToast("已拒绝该友链申请", "success");
        reloadFriends();
    };

    const handleDelete = (id: number, name?: string) => {
        showConfirm("删除友链确认", `确定要删除友链${name ? ` “${name}” ` : ""}吗？此操作无法撤销。`, async () => {
            const { error } = await client.friend.delete(id);
            if (error) {
                showAlert(typeof error.value === "string" ? error.value : "删除失败");
                return;
            }
            emitToast(`已删除友链${name ? `「${name}」` : ""}`, "success");
            reloadFriends();
        });
    };

    const [submitError, setSubmitError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError("");
        if (!formName.trim() || !formUrl.trim()) {
            setSubmitError("请完整填写名称与站点链接");
            return;
        }

        setIsSubmitting(true);
        try {
            const chosenAvatar = sanitizeAvatarUrl(
                iconChoice === "ns"
                    ? (nsAvatarUrl || formAvatar)
                    : iconChoice === "site"
                    ? (siteFaviconUrl || formAvatar)
                    : (siteFaviconUrl || formAvatar || nsAvatarUrl || "https://dummyimage.com/128x128/ff4d79/ffffff&text=Rin")
            );

            const finalAvatar = chosenAvatar.startsWith("//") ? `https:${chosenAvatar}` : chosenAvatar;

            const formattedDesc = formatFriendDesc(formCategory, formDesc, {
                spaceUrl: formSpaceUrl,
                nsData: nsUserData || undefined,
                avatarMode: iconChoice,
                nsAvatar: nsAvatarUrl,
                siteAvatar: siteFaviconUrl,
            });

            if (profile?.permission) {
                const res = await client.friend.create({
                    name: formName.trim(),
                    desc: formattedDesc,
                    avatar: finalAvatar.trim(),
                    url: formUrl.trim(),
                });
                if (res.error) {
                    throw new Error(typeof res.error.value === "string" ? res.error.value : "收录失败，请检查填写内容或登录状态");
                }
            } else {
                const res = await fetch("/api/friend/apply", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formName.trim(),
                        desc: formattedDesc,
                        avatar: finalAvatar.trim(),
                        url: formUrl.trim(),
                    }),
                });
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt || "申请提交失败");
                }
            }

            setIsAddModalOpen(false);
            setFormUrl("");
            setFormName("");
            setFormDesc("");
            setFormAvatar("");
            setFormSpaceUrl("");
            setFormCategory("友邻博客");
            setSourceAvatarUrl("");
            setSiteFaviconUrl("");
            setNsAvatarUrl("");
            setNsUserData(null);
            setIconChoice("dual");
            emitToast(profile?.permission ? "星标站点收录成功" : "友链申请已提交，等待审核", "success");
            reloadFriends();
        } catch (err: any) {
            setSubmitError(err.message || "提交失败，请重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 一键批量更正全部 NodeSeek 坛友数据
    const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

    const handleBatchRefreshAll = async () => {
        const nsFriends = allFriends.filter((f) => {
            const parsed = parseFriendCategory(f.desc, f.url, f.name, f.avatar);
            const uidMatch = (parsed.spaceUrl || f.url).match(/nodeseek\.com\/space\/(\d+)/i)
                || (parsed.spaceUrl || f.url).match(/space\/(\d+)/i)
                || f.name.match(/UID[:\s#]+(\d+)/i)
                || (f.avatar && f.avatar.match(/ns_(\d+)/i));
            return Boolean(uidMatch);
        });
        if (nsFriends.length === 0) {
            showAlert("当前友链列表中没有发现包含 NodeSeek 空间地址或 UID 的站点！请先在友链空间地址中填入如 https://www.nodeseek.com/space/27361");
            return;
        }

        setIsBatchRefreshing(true);
        setBatchProgress({ current: 0, total: nsFriends.length });
        let successCount = 0;
        for (let i = 0; i < nsFriends.length; i++) {
            const f = nsFriends[i];
            setBatchProgress({ current: i + 1, total: nsFriends.length });
            try {
                const parsed = parseFriendCategory(f.desc, f.url, f.name, f.avatar);
                const uidMatch = (parsed.spaceUrl || f.url).match(/nodeseek\.com\/space\/(\d+)/i)
                    || (parsed.spaceUrl || f.url).match(/space\/(\d+)/i)
                    || f.name.match(/UID[:\s#]+(\d+)/i)
                    || (f.avatar && f.avatar.match(/ns_(\d+)/i));
                const uid = uidMatch ? uidMatch[1] : "";
                
                // 1. 如果已有 nsData，基于已有 created_at 自动更新天数
                let updatedNsData = parsed.nsData ? { ...parsed.nsData } : undefined;
                if (updatedNsData && (updatedNsData as any).created_at) {
                    const days = Math.max(1, Math.floor((Date.now() - new Date((updatedNsData as any).created_at).getTime()) / 86400000));
                    updatedNsData.days = days;
                    updatedNsData.join_days = `${days}天`;
                }

                const token = localStorage.getItem("rin_auth_token") || "";
                const res = await fetch("/api/friend/extract-source-avatar", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        sourceUrl: parsed.spaceUrl || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : f.url),
                        name: f.name,
                    }),
                });
                let data: any = null;
                if (res.ok) {
                    data = await res.json();
                }
                let finalDetail = data?.nsDetail;
                if (finalDetail) {
                    updatedNsData = {
                        name: finalDetail.member_name,
                        rank: finalDetail.rank,
                        coin: finalDetail.coin,
                        days: finalDetail.days || finalDetail.join_days,
                        posts: finalDetail.posts || finalDetail.nPost,
                        comments: finalDetail.comments || finalDetail.nComment,
                        bio: finalDetail.bio,
                    };
                }

                if (finalDetail || uid || data?.avatarUrl) {
                    const isFriendBlog = parsed.category === "友邻博客";
                    const isTempName = f.name.includes("NodeSeek#") || f.name.startsWith("UID:");
                    const nextName = isFriendBlog ? f.name : (isTempName && finalDetail?.member_name ? finalDetail.member_name : f.name);
                    const existingCleanDesc = parsed.cleanDesc?.trim() || "";
                    const hasCustomDesc = existingCleanDesc && existingCleanDesc !== "个人技术生活随想" && !existingCleanDesc.endsWith("的空间");
                    const nextDesc = hasCustomDesc
                        ? existingCleanDesc
                        : (finalDetail?.bio ? finalDetail.bio.trim().slice(0, 200) : (data?.suggestedDesc || `${nextName}的空间`));
                    const isR2 = data?.avatarUrl && data.avatarUrl.includes("/api/blob/");
                    const finalAvatar = isR2 ? data.avatarUrl : (uid ? `https://www.nodeseek.com/avatar/${uid}.png` : sanitizeAvatarUrl(f.avatar));
                    const formatted = formatFriendDesc(parsed.category, nextDesc, {
                        spaceUrl: data?.spaceUrl || parsed.spaceUrl || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : undefined),
                        avatarMode: parsed.avatarMode,
                        siteAvatar: parsed.siteAvatar,
                        nsAvatar: finalAvatar,
                        nsData: updatedNsData,
                    });
                    await client.friend.update(f.id, {
                        name: nextName,
                        desc: formatted,
                        avatar: finalAvatar,
                    });
                    successCount++;
                }
            } catch {}
        }
        setIsBatchRefreshing(false);
        setBatchProgress(null);
        reloadFriends();
        emitToast(`批量更正完成：已同步 ${successCount} / ${nsFriends.length} 位坛友数据`, "success");
    };

    // 快捷直接移动分类
    const handleQuickMoveCategory = async (friend: FriendItem, newCat: string) => {
        const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
        const formatted = formatFriendDesc(newCat, parsed.cleanDesc, {
            spaceUrl: parsed.spaceUrl,
            probeUrl: parsed.probeUrl,
            nodeCount: parsed.nodeCount,
            avatarMode: parsed.avatarMode,
            siteAvatar: parsed.siteAvatar,
            nsAvatar: parsed.nsAvatar,
            nsData: parsed.nsData,
        });
        const { error } = await client.friend.update(friend.id, { desc: formatted });
        if (error) {
            showAlert(typeof error.value === "string" ? error.value : "切换分类失败");
            return;
        }
        emitToast(`已移动至「${newCat}」`, "success");
        reloadFriends();
    };

    // 输入权重数字敲回车即时排序
    const handleQuickReorder = async (friendId: number, newSortOrder: number) => {
        const { error } = await client.friend.update(friendId, { sort_order: newSortOrder });
        if (error) {
            showAlert(typeof error.value === "string" ? error.value : "排序更新失败");
            return;
        }
        emitToast("排序已更新", "success");
        reloadFriends();
    };

    return (
        <main className={`${GALLERY_CONTAINER_CLASS} py-6 sm:py-8 mb-14 ani-show`}>
            <Helmet>
                <title>{`${t("friends.starry_title", { defaultValue: "星标友链" })} - ${siteConfig.name}`}</title>
            </Helmet>
            <AlertUI />
            <ConfirmUI />

            <PageHeader
                eyebrow={`STARRED GARDEN · ${approvedFriends.length}`}
                title={t("friends.starry_title", { defaultValue: "星标友链" })}
                subtitle={t("friends.desc", { defaultValue: "山海有朋，见字如晤。与志趣相投的旅人一同漫步星空。" })}
                mode={siteConfig.pageHeaderMode}
                titleFont={siteConfig.themeTitleFont as any}
                titleEffect={siteConfig.themeTitleEffect}
                bannerUrl={siteConfig.pageHeaderBannerUrl}
                actions={
                    <>
                        {profile?.permission ? (
                            <button
                                type="button"
                                onClick={handleBatchRefreshAll}
                                disabled={isBatchRefreshing}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-muted-rgb))] hover:border-theme/45 hover:text-theme transition cursor-pointer disabled:opacity-50"
                                title={isBatchRefreshing ? `刷新中 (${batchProgress?.current}/${batchProgress?.total})` : t("friends.refresh_data", { defaultValue: "刷新友链数据" })}
                                aria-label={t("friends.refresh_data", { defaultValue: "刷新友链数据" })}
                            >
                                <i className={`ri-refresh-line text-sm ${isBatchRefreshing ? "animate-spin text-theme" : ""}`} />
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-theme px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-theme-hover transition active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                            <i className="ri-add-line text-sm" />
                            <span>
                                {profile?.permission
                                    ? t("friends.add_site", { defaultValue: "收录星标站点" })
                                    : t("friends.apply_site", { defaultValue: "申请加入星标" })}
                            </span>
                        </button>
                    </>
                }
            />

            {/* 单行控制工具栏：左侧分类筛选，右侧搜索 + 三态视图切换 */}
            <div
                data-friends-toolbar="true"
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-5 mb-6 border-b border-[rgb(var(--rin-hairline-rgb)/0.8)]"
            >
                {/* 左侧：分类 Tab 胶囊与自定义管理 */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none min-w-0">
                    {["全部", ...categories].map((cat) => {
                        const isActive = activeCategory === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                                    isActive
                                        ? "bg-theme text-white shadow-2xs font-semibold"
                                        : "border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme hover:border-theme/40"
                                }`}
                            >
                                {cat}
                            </button>
                        );
                    })}

                    {profile?.permission ? (
                        <button
                            type="button"
                            onClick={() => setIsManageCategoriesOpen(true)}
                            className="px-2.5 py-1.5 rounded-full border border-dashed border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme hover:border-theme/45 text-xs font-medium transition flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                            title="自定义新增、重命名或重排全站星廊分类"
                        >
                            <span>+ 管理分类</span>
                        </button>
                    ) : null}
                </div>

                {/* 右侧单行紧凑组：搜索 + 横版名片/画廊卡/书签行 */}
                <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
                    <div className="relative flex-1 sm:flex-initial w-40 sm:w-52 min-w-0">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--rin-ink-muted-rgb))] text-xs pointer-events-none" />
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="搜索友邻名称或网址..."
                            className="w-full pl-8 pr-7 py-1.5 rounded-full text-xs bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] border border-[rgb(var(--rin-hairline-rgb))] focus:outline-none focus:border-theme/55 transition placeholder:text-[rgb(var(--rin-ink-muted-rgb))]"
                        />
                        {searchKeyword ? (
                            <button
                                type="button"
                                onClick={() => setSearchKeyword("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] cursor-pointer"
                                aria-label="清空搜索"
                            >
                                <i className="ri-close-circle-line text-xs" />
                            </button>
                        ) : null}
                    </div>

                    <div
                        role="group"
                        aria-label="视图切换"
                        className="inline-flex items-center p-0.5 rounded-full bg-[rgb(var(--rin-surface-rgb))] border border-[rgb(var(--rin-hairline-rgb))] shrink-0"
                    >
                        {[
                            { id: "card" as const, label: "横版名片", icon: "ri-layout-grid-line" },
                            { id: "polaroid" as const, label: "画廊卡", icon: "ri-polaroid-line" },
                            { id: "compact" as const, label: "书签行", icon: "ri-list-check-2" },
                        ].map((modeOpt) => (
                            <button
                                key={modeOpt.id}
                                type="button"
                                onClick={() => handleViewStyleChange(modeOpt.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                                    viewStyle === modeOpt.id
                                        ? "bg-theme text-white shadow-2xs font-semibold"
                                        : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
                                }`}
                                title={modeOpt.label}
                            >
                                <i className={`${modeOpt.icon} text-xs hidden sm:inline`} />
                                <span>{modeOpt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 管理员待审批提示条 */}
            {profile?.permission && pendingFriends.length > 0 ? (
                <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
                        <i className="ri-time-line text-base" />
                        <span>有 {pendingFriends.length} 条待审核的友链申请等待处理</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {pendingFriends.map((p) => (
                            <div key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgb(var(--rin-surface-rgb))] border border-amber-500/30 text-xs">
                                <span className="font-medium truncate max-w-[120px]">{p.name}</span>
                                <button
                                    type="button"
                                    onClick={() => handleApprove(p.id)}
                                    className="text-emerald-600 hover:text-emerald-700 font-bold ml-1 cursor-pointer"
                                    title="通过审核"
                                >
                                    ✓
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleReject(p.id)}
                                    className="text-rose-500 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                                    title="拒绝申请"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* 核心内容区：按视图风格流体排布 */}
            {status === "loading" && allFriends.length === 0 ? (
                <div className="py-20 flex justify-center">
                    <Waiting />
                </div>
            ) : filteredFriends.length === 0 ? (
                <div className="py-24 text-center">
                    <i className="ri-inbox-line text-4xl text-neutral-300 dark:text-neutral-600" />
                    <p className="mt-3 text-sm text-[rgb(var(--rin-ink-muted-rgb))]">暂无匹配的友链或星标站点</p>
                </div>
            ) : viewStyle === "compact" ? (
                <div className="flex flex-col gap-2">
                    {filteredFriends.map((friend, idx) => (
                        <CompactFriendRow
                            key={friend.id}
                            friend={friend}
                            index={idx}
                            categories={categories}
                            onEdit={() => setEditingFriend(friend)}
                            onDelete={() => handleDelete(friend.id, friend.name)}
                            onApprove={() => handleApprove(friend.id)}
                            onReject={() => handleReject(friend.id)}
                            onUpdate={reloadFriends}
                            onError={showAlert}
                            onMoveCategory={handleQuickMoveCategory}
                            onReorder={handleQuickReorder}
                        />
                    ))}
                </div>
            ) : viewStyle === "polaroid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
                    {filteredFriends.map((friend, idx) => (
                        <PolaroidFriendCard
                            key={friend.id}
                            friend={friend}
                            index={idx}
                            categories={categories}
                            onEdit={() => setEditingFriend(friend)}
                            onDelete={() => handleDelete(friend.id, friend.name)}
                            onApprove={() => handleApprove(friend.id)}
                            onReject={() => handleReject(friend.id)}
                            onUpdate={reloadFriends}
                            onError={showAlert}
                            onMoveCategory={handleQuickMoveCategory}
                            onReorder={handleQuickReorder}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredFriends.map((friend, idx) => (
                        <FriendCard
                            key={friend.id}
                            friend={friend}
                            index={idx}
                            categories={categories}
                            onEdit={() => setEditingFriend(friend)}
                            onDelete={() => handleDelete(friend.id, friend.name)}
                            onApprove={() => handleApprove(friend.id)}
                            onReject={() => handleReject(friend.id)}
                            onUpdate={reloadFriends}
                            onError={showAlert}
                            onMoveCategory={handleQuickMoveCategory}
                            onReorder={handleQuickReorder}
                        />
                    ))}
                </div>
            )}

            {/* 申请/收录弹窗 */}
            <Modal
                isOpen={isAddModalOpen}
                onRequestClose={() => !isSniffing && !isSubmitting && setIsAddModalOpen(false)}
                contentLabel={profile?.permission ? "收录星标站点" : "申请加入星标画廊"}
                panelClassName="max-h-[90vh] p-4 sm:p-6 max-w-[94vw] sm:max-w-xl w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/5 dark:border-white/5 shrink-0">
                    <h3 className="text-base font-bold t-primary">
                        {profile?.permission ? "收录星标站点" : "申请加入星标画廊"}
                    </h3>
                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(false)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                        <i className="ri-close-line text-lg" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans overflow-y-auto pr-1">
                    {submitError && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                            {submitError}
                        </div>
                    )}

                    {/* 1. 站点链接与快速嗅探 */}
                    <div>
                        <label className="block text-neutral-500 mb-1">站点链接 (必填)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="url"
                                required
                                value={formUrl}
                                onChange={(e) => setFormUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="flex-1 px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 focus:outline-none focus:border-theme/40 text-xs"
                            />
                            <button
                                type="button"
                                onClick={handleSniffUrl}
                                disabled={isSniffing || !formUrl}
                                className="px-3 py-2 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme font-medium whitespace-nowrap transition cursor-pointer disabled:opacity-50"
                            >
                                {isSniffing ? "嗅探中..." : "自动嗅探"}
                            </button>
                        </div>
                    </div>

                    {/* 2. 站点名称与分类 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-neutral-500 mb-1">站点名称 (必填)</label>
                            <input
                                type="text"
                                required
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="例如: 某某的个人博客"
                                className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 focus:outline-none focus:border-theme/40 text-xs"
                            />
                        </div>
                        <div>
                            <label className="block text-neutral-500 mb-1">站点分类</label>
                            <select
                                value={formCategory}
                                onChange={(e) => setFormCategory(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 focus:outline-none focus:border-theme/40 text-xs"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 3. 来源空间 (NodeSeek 坛友识别) */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-neutral-500">NodeSeek 空间或数字 UID (选填)</label>
                            {extractBtnFeedback && (
                                <span className="text-[11px] text-emerald-600 font-bold animate-fade-in">
                                    {extractBtnFeedback}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={sourceAvatarUrl}
                                onChange={(e) => handleSourceAvatarInputChange(e.target.value)}
                                placeholder="输入数字 UID (如 38057) 或空间主页"
                                className="flex-1 px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 focus:outline-none focus:border-theme/40 text-xs font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => handleExtractSourceAvatar()}
                                disabled={isExtractingAvatar || !sourceAvatarUrl}
                                className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap transition cursor-pointer disabled:opacity-50"
                            >
                                {isExtractingAvatar ? "识别中..." : "提取资产"}
                            </button>
                        </div>
                    </div>

                    {/* 4. 站点简介与 AI 精炼 */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-neutral-500">站点简介（支持完整展示）</label>
                            <button
                                type="button"
                                onClick={handleRefineDesc}
                                disabled={isRefiningDesc}
                                className="text-[11px] text-theme hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                                <i className="ri-magic-line text-xs" />
                                <span>{isRefiningDesc ? "提炼中..." : "AI 智能精炼"}</span>
                            </button>
                        </div>
                        <textarea
                            rows={2}
                            maxLength={240}
                            value={formDesc}
                            onChange={(e) => setFormDesc(e.target.value)}
                            placeholder="站点简介（支持完整展示）"
                            className="w-full px-3 py-2 rounded-xl bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] border border-[rgb(var(--rin-hairline-rgb))] focus:outline-none focus:border-theme/45 text-xs resize-none"
                        />
                    </div>

                    {/* 5. 头像 URL 与头像展示模式 */}
                    <div>
                        <label className="block text-neutral-500 mb-1">头像图标 URL (必填)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="url"
                                required
                                value={formAvatar}
                                onChange={(e) => setFormAvatar(e.target.value)}
                                placeholder="https://example.com/avatar.png"
                                className="flex-1 px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 focus:outline-none focus:border-theme/40 text-xs"
                            />
                            {formAvatar && (
                                <ImageWithFallback
                                    src={formAvatar}
                                    alt="预览"
                                    className="w-8 h-8 rounded-lg object-cover border border-black/10 dark:border-white/10 shrink-0"
                                />
                            )}
                        </div>
                        {nsAvatarUrl && siteFaviconUrl && (
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-500">
                                <span>展示模式:</span>
                                <label className="inline-flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="avatar_mode"
                                        checked={iconChoice === "dual"}
                                        onChange={() => handleIconChoiceChange("dual")}
                                    />
                                    <span>子母双图融合</span>
                                </label>
                                <label className="inline-flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="avatar_mode"
                                        checked={iconChoice === "site"}
                                        onChange={() => handleIconChoiceChange("site")}
                                    />
                                    <span>仅站点Logo</span>
                                </label>
                                <label className="inline-flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="avatar_mode"
                                        checked={iconChoice === "ns"}
                                        onChange={() => handleIconChoiceChange("ns")}
                                    />
                                    <span>仅坛友头像</span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-black/10 transition cursor-pointer"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl bg-theme text-white font-medium hover:opacity-90 transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? "正在提交..." : profile?.permission ? "立即收录" : "提交申请"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* 编辑友链弹窗 */}
            {editingFriend ? (
                <EditFriendModal
                    friend={editingFriend}
                    categories={categories}
                    onClose={() => setEditingFriend(null)}
                    onError={showAlert}
                    onSuccess={() => {
                        setEditingFriend(null);
                        emitToast("友链信息已更新", "success");
                        reloadFriends();
                    }}
                />
            ) : null}

            {/* 星廊动态分类自定义管理弹窗 */}
            {isManageCategoriesOpen ? (
                <ManageCategoriesModal
                    isOpen={isManageCategoriesOpen}
                    onClose={() => setIsManageCategoriesOpen(false)}
                    currentCategories={categories}
                    onSave={async (newCats) => {
                        const { error } = await client.config.update("client", {
                            "friends.categories": JSON.stringify(newCats),
                        });
                        if (error) {
                            showAlert(typeof error.value === "string" ? error.value : "保存分类失败");
                            return;
                        }
                        setCategories(newCats);
                        emitToast("星廊分类配置已保存", "success");
                    }}
                />
            ) : null}
        </main>
    );
}

interface FriendCardProps {
    friend: FriendItem;
    index: number;
    categories?: string[];
    onEdit: () => void;
    onDelete: () => void;
    onApprove: () => void;
    onReject: () => void;
    onUpdate?: () => void;
    onError?: (msg: string) => void;
    onMoveCategory?: (friend: FriendItem, newCat: string) => void;
    onReorder?: (friendId: number, newSortOrder: number) => void;
}

// 抽取 NodeSeek 资产更正与就地同步状态机 Hook
function useFriendNsRefresh(
    friend: FriendItem,
    parsed: ReturnType<typeof parseFriendCategory>,
    onUpdate?: () => void,
    onError?: (msg: string) => void,
) {
    const { category, cleanDesc, spaceUrl } = parsed;

    // 严密健壮地提取数字 UID (全面覆盖 spaceUrl, friend.url, friend.name, avatar 中的 ns_xxx, 以及 desc 注释)
    const uidMatch = (spaceUrl || friend.url).match(/nodeseek\.com\/space\/(\d+)/i)
        || (spaceUrl || friend.url).match(/space\/(\d+)/i)
        || friend.name.match(/UID[:\s#]+(\d+)/i)
        || (friend.avatar && friend.avatar.match(/ns_(\d+)/i))
        || (friend.avatar && friend.avatar.match(/nodeseek\.com\/avatar\/(\d+)/i))
        || (friend.desc && friend.desc.match(/space\/(\d+)/i))
        || (friend.desc && friend.desc.match(/ns_(\d+)/i))
        || (parsed.spaceUrl && parsed.spaceUrl.match(/space\/(\d+)/i));
    const uid = uidMatch ? uidMatch[1] : null;

    let displayName = friend.name;
    if (friend.name.includes("NodeSeek#") || friend.name.startsWith("UID:")) {
        const stripped = friend.name.replace(/NodeSeek#\d+\s*的?空间?/i, "").trim();
        if (stripped) {
            displayName = stripped;
        } else if (uid) {
            displayName = `UID: ${uid}`;
        }
    }

    const [isRefreshingNs, setIsRefreshingNs] = useState(false);
    const [refreshNsDone, setRefreshNsDone] = useState(false);

    // 一键就地更正/同步坛友资产
    const handleQuickRefreshNs = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const target = spaceUrl || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : (friend.url.includes("nodeseek") ? friend.url : ""));
        if (!target && !uid) return;
        setIsRefreshingNs(true);
        setRefreshNsDone(false);
        try {
            const token = localStorage.getItem("rin_auth_token") || "";

            // 1. 并发利用客户端网络抓取坛友数据与头像 Base64
            const [clientDetail, clientAvatar] = await Promise.all([
                uid ? fetchClientSideNsDetail(uid) : Promise.resolve(null),
                uid ? fetchClientAvatarBase64(uid) : Promise.resolve(null),
            ]);

            // 2. 请求服务端转存 R2 与数据提取
            let serverData: any = null;
            try {
                const res = await fetch("/api/friend/extract-source-avatar", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        sourceUrl: target || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : ""),
                        name: friend.name,
                        clientNsDetail: clientDetail || undefined,
                        clientAvatarBase64: clientAvatar || undefined,
                    }),
                });
                if (res.ok) {
                    serverData = await res.json();
                }
            } catch (netErr) {
                console.warn("Server extract error, falling back to client-only:", netErr);
            }

            let finalNsDetail = serverData?.nsDetail || clientDetail;

            // 3. 优先尝试从剪贴板自动智能直取 (如果站长刚在 NodeSeek 复制了 API JSON 或主页文本，0手动秒级直读)
            if (!finalNsDetail && typeof navigator !== "undefined" && navigator.clipboard?.readText) {
                try {
                    const clipText = await navigator.clipboard.readText();
                    if (clipText) {
                        const parsedNs = parseNodeSeekPastedText(clipText);
                        if (parsedNs.rank !== undefined || parsedNs.coin !== undefined || parsedNs.days !== undefined) {
                            finalNsDetail = {
                                name: parsedNs.name || displayName || friend.name,
                                member_name: parsedNs.name || displayName || friend.name,
                                rank: parsedNs.rank ?? 1,
                                coin: parsedNs.coin ?? 0,
                                days: parsedNs.days ?? 1,
                                posts: parsedNs.posts ?? 0,
                                comments: parsedNs.comments ?? 0,
                                bio: parsedNs.bio ?? "",
                            };
                        }
                    }
                } catch {}
            }

            // 头像处理：优先使用服务端转存好的 R2 链接 (带时间戳刷新防缓存)；如果服务端没有成功写 R2，则使用官方直链回退
            const serverAvatarUrl = serverData?.avatarUrl || "";
            const isR2Avatar = serverAvatarUrl.includes("/api/blob/");
            const finalAvatarUrl = isR2Avatar
                ? serverAvatarUrl
                : (uid ? `https://www.nodeseek.com/avatar/${uid}.png` : sanitizeAvatarUrl(serverAvatarUrl || friend.avatar));

            // 4. 若自动穿透受阻且剪贴板无数据：自动复制接口链接并自动在新标签页打开，监听视口重聚焦自动入库
            if (!finalNsDetail && uid) {
                const apiHintUrl = `https://www.nodeseek.com/api/account/getInfo/${uid}?readme=1`;
                if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                    try {
                        await navigator.clipboard.writeText(apiHintUrl);
                    } catch {}
                }

                // 自动打开接口新标签（在用户的正常浏览器环境中秒开）
                window.open(apiHintUrl, "_blank");

                // 注册视口重聚焦监听：用户在新标签页全选复制 (Ctrl+A, Ctrl+C) 切回博客时，自动秒级抓取入库！
                const onWindowFocusBack = async () => {
                    window.removeEventListener("focus", onWindowFocusBack);
                    try {
                        const newClip = await navigator.clipboard.readText();
                        if (newClip) {
                            const parsedNs = parseNodeSeekPastedText(newClip);
                            if (parsedNs.rank !== undefined || parsedNs.coin !== undefined || parsedNs.days !== undefined) {
                                const newDesc = formatFriendDesc(category, cleanDesc || `${displayName}的空间`, {
                                    spaceUrl: serverData?.spaceUrl || spaceUrl || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : undefined),
                                    avatarMode: parsed.avatarMode,
                                    siteAvatar: parsed.siteAvatar,
                                    nsAvatar: finalAvatarUrl || parsed.nsAvatar,
                                    nsData: {
                                        name: parsedNs.name || displayName || friend.name,
                                        rank: parsedNs.rank ?? 1,
                                        coin: parsedNs.coin ?? 0,
                                        days: parsedNs.days ?? 1,
                                        posts: parsedNs.posts ?? 0,
                                        comments: parsedNs.comments ?? 0,
                                        bio: parsedNs.bio ?? "",
                                    },
                                });
                                await client.friend.update(friend.id, {
                                    name: parsedNs.name || displayName || friend.name,
                                    desc: newDesc,
                                    avatar: finalAvatarUrl,
                                });
                                setRefreshNsDone(true);
                                if (onUpdate) onUpdate();
                                setTimeout(() => setRefreshNsDone(false), 2500);
                            }
                        }
                    } catch {}
                };
                window.addEventListener("focus", onWindowFocusBack);
            }

            if (finalNsDetail || isR2Avatar) {
                const isFriendBlog = category === "友邻博客";
                const isTempName = friend.name.includes("NodeSeek#") || friend.name.startsWith("UID:");
                const nextName = isFriendBlog ? friend.name : (isTempName && finalNsDetail?.member_name ? finalNsDetail.member_name : (displayName || friend.name));
                const existingCleanDesc = cleanDesc?.trim() || "";
                const hasCustomDesc = existingCleanDesc && existingCleanDesc !== "个人技术生活随想" && !existingCleanDesc.endsWith("的空间");
                const nextDesc = hasCustomDesc
                    ? existingCleanDesc
                    : (finalNsDetail?.bio ? finalNsDetail.bio.trim().slice(0, 200) : (serverData?.suggestedDesc || `${nextName}的空间`));

                const nextNsData = finalNsDetail ? {
                    name: finalNsDetail.member_name,
                    rank: finalNsDetail.rank,
                    coin: finalNsDetail.coin,
                    days: finalNsDetail.days || finalNsDetail.join_days,
                    posts: finalNsDetail.posts || finalNsDetail.nPost,
                    comments: finalNsDetail.comments || finalNsDetail.nComment,
                    bio: finalNsDetail.bio,
                } : parsed.nsData;

                const newFormattedDesc = formatFriendDesc(category, nextDesc, {
                    spaceUrl: serverData?.spaceUrl || spaceUrl || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : undefined),
                    avatarMode: parsed.avatarMode,
                    siteAvatar: parsed.siteAvatar,
                    nsAvatar: finalAvatarUrl || parsed.nsAvatar,
                    nsData: nextNsData,
                });

                const updateRes = await client.friend.update(friend.id, {
                    name: nextName,
                    desc: newFormattedDesc,
                    avatar: finalAvatarUrl,
                });

                if (updateRes.error) {
                    throw new Error(typeof updateRes.error.value === "string" ? updateRes.error.value : "更新失败");
                }

                setRefreshNsDone(true);
                emitToast(`已同步「${nextName}」资产数据`, "success");
                if (onUpdate) {
                    onUpdate();
                }
                setTimeout(() => setRefreshNsDone(false), 2500);
            } else {
                if (onError) {
                    onError("未获取到坛友资产数据，请检查 UID 或重新操作");
                }
            }
        } catch (err: any) {
            console.error("Quick refresh NS failed:", err);
            if (onError) {
                onError(err?.message || "同步坛友资产失败");
            }
        } finally {
            setIsRefreshingNs(false);
        }
    };

    return {
        uid,
        displayName,
        isRefreshingNs,
        refreshNsDone,
        handleQuickRefreshNs,
    };
}

function NodeSeekMetaInline({ uid, nsData }: { uid: string | null; nsData?: NodeSeekUserData }) {
    if (!uid && !nsData) return null;
    const hasLeadingUid = Boolean(uid);
    const hasRank = nsData?.rank !== undefined;
    const hasCoin = nsData?.coin !== undefined;
    const hasDays = nsData?.days !== undefined;
    return (
        <div className="flex items-center gap-1.5 min-w-0 truncate text-[11px] font-mono text-[rgb(var(--rin-ink-muted-rgb))]">
            {uid ? (
                <a
                    href={`https://www.nodeseek.com/space/${uid}#/general`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-theme/90 hover:text-theme font-semibold transition shrink-0"
                    title="直达 NodeSeek 个人空间"
                >
                    NS #{uid}
                </a>
            ) : null}
            {hasRank ? (
                <>
                    {hasLeadingUid ? <span aria-hidden="true">·</span> : null}
                    <span className="inline-flex items-center gap-0.5 text-[rgb(var(--rin-ink-rgb))] shrink-0">
                        <DiamondRankSvg className="w-2.5 h-2.5 text-amber-500" />
                        <span>Lv.{nsData?.rank}</span>
                    </span>
                </>
            ) : null}
            {hasCoin ? (
                <>
                    {(hasLeadingUid || hasRank) ? <span aria-hidden="true">·</span> : null}
                    <span className="inline-flex items-center gap-0.5 shrink-0" title="鸡腿资产">
                        <i className="ri-copper-coin-line text-amber-500 text-xs" />
                        <span>{nsData?.coin}</span>
                    </span>
                </>
            ) : null}
            {hasDays ? (
                <>
                    {(hasLeadingUid || hasRank || hasCoin) ? <span aria-hidden="true">·</span> : null}
                    <span className="inline-flex items-center gap-0.5 shrink-0" title="加入天数">
                        <i className="ri-time-line text-sky-500 text-xs" />
                        <span>{nsData?.days} 天</span>
                    </span>
                </>
            ) : null}
        </div>
    );
}

// 风格 1: 横版精致名片卡 (Horizontal Namecard)
function FriendCard({
    friend,
    categories,
    onEdit,
    onDelete,
    onApprove,
    onReject,
    onUpdate,
    onError,
    onMoveCategory,
    onReorder,
}: FriendCardProps) {
    const profile = useContext(ProfileContext);
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const { category, cleanDesc, spaceUrl, nsData } = parsed;
    const { uid, displayName, isRefreshingNs, refreshNsDone, handleQuickRefreshNs } = useFriendNsRefresh(friend, parsed, onUpdate, onError);
    const [isDescExpanded, setIsDescExpanded] = useState(false);

    const primaryUrl = safeHttpUrl(spaceUrl) || safeHttpUrl(friend.url);
    const cleanHost = friend.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const displayDesc = cleanDesc || "个人技术生活随想";
    const canExpandDesc = displayDesc.length > 68;

    return (
        <article className="group relative p-4 rounded-2xl bg-[rgb(var(--rin-surface-rgb))] border border-[rgb(var(--rin-hairline-rgb))] shadow-2xs hover:border-theme/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between font-sans">
            {/* 顶角悬浮管理微胶囊 */}
            {profile?.permission ? (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-[rgb(var(--rin-elevated-rgb))] p-0.5 rounded-xl border border-[rgb(var(--rin-hairline-rgb))] shadow-xs"
                >
                    {uid ? (
                        <button
                            type="button"
                            onClick={handleQuickRefreshNs}
                            disabled={isRefreshingNs}
                            className="h-6 w-6 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition cursor-pointer"
                            title={refreshNsDone ? "更正成功！" : "更正/同步坛友资产"}
                        >
                            <i className={`ri-refresh-line text-xs ${isRefreshingNs ? "animate-spin" : ""}`} />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onEdit}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                        title="编辑友链"
                    >
                        <i className="ri-edit-line text-xs" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-[rgb(var(--rin-ink-muted-rgb))] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title="删除友链"
                    >
                        <i className="ri-delete-bin-line text-xs" />
                    </button>
                </div>
            ) : null}

            {/* 横版名片主体：左侧 48x48 图标 + 右侧信息 */}
            <div className="flex items-start gap-3.5 min-w-0">
                {/* 左侧：48x48 圆角图标 + 柔和弥散主题光晕 + 可选子母双图角标 */}
                <div className="relative shrink-0 mt-0.5">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-theme/20 via-theme-secondary/15 to-transparent blur-md opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                    <ImageWithFallback
                        src={sanitizeAvatarUrl(friend.avatar)}
                        alt={friend.name}
                        fallbackText={displayName}
                        className="relative w-12 h-12 rounded-2xl object-cover border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shadow-sm group-hover:scale-[1.03] transition-transform"
                    />
                    {parsed.nsAvatar && parsed.siteAvatar && parsed.avatarMode === "dual" ? (
                        <ImageWithFallback
                            src={sanitizeAvatarUrl(parsed.nsAvatar)}
                            alt="NodeSeek"
                            fallbackText="N"
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover border-2 border-[rgb(var(--rin-surface-rgb))] shadow-xs"
                            title="NodeSeek 坛友认证"
                        />
                    ) : null}
                </div>

                {/* 右侧：顶行站名+分类徽章 -> 域链接 -> 完整简介 */}
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <a
                                href={primaryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-sm text-[rgb(var(--rin-ink-rgb))] hover:text-theme transition truncate"
                                title={displayName}
                            >
                                {displayName}
                            </a>
                            {profile?.permission && categories && onMoveCategory ? (
                                <select
                                    value={category}
                                    onChange={(e) => onMoveCategory(friend, e.target.value)}
                                    className="text-[11px] px-2 py-0.5 rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-muted-rgb))] outline-none cursor-pointer hover:border-theme/45 hover:text-theme shrink-0"
                                    title="点击直接切换此友链分类"
                                >
                                    {categories.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-canvas-rgb))] text-[rgb(var(--rin-ink-muted-rgb))] shrink-0 whitespace-nowrap">
                                    {category}
                                </span>
                            )}
                        </div>
                    </div>

                    <a
                        href={safeHttpUrl(friend.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme transition truncate block font-mono"
                    >
                        {cleanHost} ↗
                    </a>

                    <div className="pt-0.5">
                        <p
                            onClick={() => canExpandDesc && setIsDescExpanded((prev) => !prev)}
                            className={`text-xs text-[rgb(var(--rin-ink-muted-rgb))] leading-relaxed ${
                                isDescExpanded ? "" : "line-clamp-3"
                            } ${canExpandDesc ? "cursor-pointer" : ""}`}
                        >
                            {displayDesc}
                        </p>
                        {canExpandDesc ? (
                            <button
                                type="button"
                                onClick={() => setIsDescExpanded((prev) => !prev)}
                                className="mt-0.5 text-[11px] text-theme/85 hover:text-theme hover:underline cursor-pointer"
                            >
                                {isDescExpanded ? "收起简介" : "展开全部"}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* 底部发丝分隔线：单行紧凑 NodeSeek 元信息 + 待审/管理员排序 */}
            {(uid || nsData || friend.accepted === 0 || (profile?.permission && onReorder)) ? (
                <div className="mt-3 pt-2.5 border-t border-[rgb(var(--rin-hairline-rgb)/0.65)] flex items-center justify-between gap-2">
                    <NodeSeekMetaInline uid={uid} nsData={nsData} />

                    <div className="flex items-center gap-1.5 shrink-0">
                        {friend.accepted === 0 ? (
                            <div className="flex items-center gap-1">
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                                    待审核
                                </span>
                                {profile?.permission ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={onApprove}
                                            className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-white font-bold text-[10px] hover:bg-emerald-600 transition cursor-pointer"
                                        >
                                            通过
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onReject}
                                            className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white font-bold text-[10px] hover:bg-rose-600 transition cursor-pointer"
                                        >
                                            拒绝
                                        </button>
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                        {profile?.permission && onReorder ? (
                            <div className="flex items-center gap-0.5 font-mono text-[11px] text-[rgb(var(--rin-ink-muted-rgb))]">
                                <span>#</span>
                                <input
                                    type="number"
                                    defaultValue={friend.sort_order ?? 0}
                                    key={`${friend.id}_${friend.sort_order}`}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            const val = parseInt(e.currentTarget.value, 10);
                                            if (!isNaN(val)) onReorder(friend.id, val);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const val = parseInt(e.currentTarget.value, 10);
                                        if (!isNaN(val) && val !== (friend.sort_order ?? 0)) onReorder(friend.id, val);
                                    }}
                                    className="w-9 text-center rounded bg-[rgb(var(--rin-canvas-rgb))] border border-[rgb(var(--rin-hairline-rgb))] hover:border-theme focus:border-theme outline-none text-[10px] font-mono font-bold py-0.5"
                                    title="输入排序序号敲回车即时排序 (数字越小越靠前，0 为默认)"
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </article>
    );
}

// 风格 2: 高密单行书签行 (Compact List)
function CompactFriendRow({
    friend,
    categories,
    onEdit,
    onDelete,
    onApprove,
    onReject,
    onUpdate,
    onError,
    onMoveCategory,
    onReorder,
}: FriendCardProps) {
    const profile = useContext(ProfileContext);
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const { category, cleanDesc, spaceUrl } = parsed;
    const { uid, isRefreshingNs, refreshNsDone, handleQuickRefreshNs } = useFriendNsRefresh(friend, parsed, onUpdate, onError);
    const primaryUrl = safeHttpUrl(spaceUrl) || safeHttpUrl(friend.url);

    return (
        <div className="group flex items-center justify-between p-3 rounded-2xl bg-[rgb(var(--rin-surface-rgb))] border border-[rgb(var(--rin-hairline-rgb))] hover:border-theme/40 transition gap-3 text-xs font-sans">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <ImageWithFallback
                    src={sanitizeAvatarUrl(friend.avatar)}
                    alt={friend.name}
                    fallbackText={friend.name}
                    className="w-7 h-7 rounded-lg object-cover shrink-0 border border-[rgb(var(--rin-hairline-rgb))]"
                />
                {profile?.permission && categories && onMoveCategory ? (
                    <select
                        value={category}
                        onChange={(e) => onMoveCategory(friend, e.target.value)}
                        className="px-2 py-0.5 rounded-full bg-[rgb(var(--rin-surface-rgb))] border border-[rgb(var(--rin-hairline-rgb))] text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] outline-none cursor-pointer hover:border-theme shrink-0"
                        title="点击直接切换此友链分类"
                    >
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                ) : (
                    <span className="px-2 py-0.5 rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-canvas-rgb))] text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] shrink-0">
                        {category}
                    </span>
                )}
                {profile?.permission && onReorder ? (
                    <input
                        type="number"
                        defaultValue={friend.sort_order ?? 0}
                        key={`${friend.id}_${friend.sort_order}`}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                const val = parseInt(e.currentTarget.value, 10);
                                if (!isNaN(val)) onReorder(friend.id, val);
                            }
                        }}
                        onBlur={(e) => {
                            const val = parseInt(e.currentTarget.value, 10);
                            if (!isNaN(val) && val !== (friend.sort_order ?? 0)) onReorder(friend.id, val);
                        }}
                        className="w-9 text-center rounded bg-[rgb(var(--rin-canvas-rgb))] border border-[rgb(var(--rin-hairline-rgb))] hover:border-theme outline-none text-[10px] font-mono font-bold py-0.5 shrink-0"
                        title="输入排序序号后敲回车立即换序 (数字越小越靠前，0 为默认)"
                    />
                ) : null}
                <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold t-primary hover:text-theme transition truncate shrink-0 max-w-[160px]"
                >
                    {friend.name}
                </a>
                <span className="text-[rgb(var(--rin-ink-muted-rgb))] truncate hidden sm:inline">
                    {cleanDesc || "个人技术生活随想"}
                </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {profile?.permission && uid && friend.accepted !== 0 ? (
                    <button
                        type="button"
                        onClick={handleQuickRefreshNs}
                        disabled={isRefreshingNs}
                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline px-1 py-0.5 rounded cursor-pointer"
                        title="更正坛友资产"
                    >
                        {isRefreshingNs ? "更正中" : refreshNsDone ? "✓ 已更正" : "更正"}
                    </button>
                ) : null}
                <a
                    href={safeHttpUrl(friend.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme p-1"
                    title="访问站点"
                >
                    <i className="ri-external-link-line" />
                </a>
                {profile?.permission ? (
                    <>
                        {friend.accepted === 0 ? (
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={onApprove} className="text-emerald-600 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 cursor-pointer">
                                    通过
                                </button>
                                <button type="button" onClick={onReject} className="text-amber-600 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 cursor-pointer">
                                    拒绝
                                </button>
                            </div>
                        ) : null}
                        <button type="button" onClick={onEdit} className="text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme p-1 cursor-pointer" title="编辑">
                            <i className="ri-edit-line" />
                        </button>
                        <button type="button" onClick={onDelete} className="text-[rgb(var(--rin-ink-muted-rgb))] hover:text-rose-500 p-1 cursor-pointer" title="删除">
                            <i className="ri-delete-bin-line" />
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
}

// 风格 3: 柔和渐变画廊纵卡 (Gallery Vertical Card)
function PolaroidFriendCard({
    friend,
    index,
    categories,
    onEdit,
    onDelete,
    onApprove,
    onReject,
    onUpdate,
    onError,
    onMoveCategory,
    onReorder,
}: FriendCardProps) {
    const profile = useContext(ProfileContext);
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const { category, cleanDesc, spaceUrl } = parsed;
    const { uid, displayName, isRefreshingNs, refreshNsDone, handleQuickRefreshNs } = useFriendNsRefresh(friend, parsed, onUpdate, onError);
    const [isDescExpanded, setIsDescExpanded] = useState(false);

    const primaryUrl = safeHttpUrl(spaceUrl) || safeHttpUrl(friend.url);
    const safeAvatar = sanitizeAvatarUrl(friend.avatar);
    const cleanHost = friend.url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const displayDesc = cleanDesc || "个人技术生活随想";
    const canExpandDesc = displayDesc.length > 68;
    const tilt = index % 2 === 0 ? "hover:rotate-[0.6deg]" : "hover:-rotate-[0.6deg]";

    return (
        <article className={`group relative pt-3.5 pb-3.5 px-3.5 sm:px-4 bg-[rgb(var(--rin-surface-rgb))] border border-[rgb(var(--rin-hairline-rgb))] shadow-xs hover:shadow-lg hover:border-theme/40 transition-all duration-300 rounded-2xl font-sans flex flex-col justify-between ${tilt}`}>
            {/* 顶角悬浮管理微胶囊 */}
            {profile?.permission ? (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-[rgb(var(--rin-elevated-rgb))] p-0.5 rounded-lg border border-[rgb(var(--rin-hairline-rgb))] shadow-xs"
                >
                    {uid ? (
                        <button
                            type="button"
                            onClick={handleQuickRefreshNs}
                            disabled={isRefreshingNs}
                            className="h-5 w-5 rounded flex items-center justify-center text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition cursor-pointer"
                            title={refreshNsDone ? "更正成功！" : "更正/同步坛友资产"}
                        >
                            <i className={`ri-refresh-line text-xs ${isRefreshingNs ? "animate-spin" : ""}`} />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onEdit}
                        className="h-5 w-5 rounded flex items-center justify-center text-[rgb(var(--rin-ink-muted-rgb))] hover:text-theme hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                        title="编辑友链"
                    >
                        <i className="ri-edit-line text-xs" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="h-5 w-5 rounded flex items-center justify-center text-[rgb(var(--rin-ink-muted-rgb))] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title="删除友链"
                    >
                        <i className="ri-delete-bin-line text-xs" />
                    </button>
                </div>
            ) : null}

            <div>
                {/* 柔彩弥散网格渐变画廊头：居中磨砂徽章托举 56x56 图标 + 右下角域名水印 */}
                <div
                    data-friend-gallery-banner="true"
                    className="h-28 sm:h-32 w-full rounded-xl bg-gradient-to-br from-theme/15 via-theme-secondary/10 to-transparent overflow-hidden mb-3 border border-[rgb(var(--rin-hairline-rgb)/0.7)] relative flex items-center justify-center select-none group/polaroid"
                >
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-6 -left-6 h-24 w-24 rounded-full bg-theme/15 blur-2xl"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-theme-secondary/20 blur-2xl"
                    />

                    {/* 居中磨砂玻璃徽章：托举 56x56 圆角图标 */}
                    <div className="relative z-10 p-1.5 rounded-2xl bg-white/75 dark:bg-neutral-900/65 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-sm transition-transform duration-300 group-hover/polaroid:scale-105">
                        <ImageWithFallback
                            src={safeAvatar}
                            alt={friend.name}
                            fallbackText={displayName}
                            className="w-14 h-14 rounded-xl object-cover"
                        />
                    </div>

                    {/* 右下角低饱和域名水印 */}
                    <span className="pointer-events-none absolute bottom-2 right-2.5 z-10 font-mono text-[10px] opacity-55 text-[rgb(var(--rin-ink-muted-rgb))] truncate max-w-[75%]">
                        {cleanHost}
                    </span>
                </div>

                <div className="flex items-center justify-between mb-1.5 gap-1.5">
                    <a
                        href={primaryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-sm t-primary hover:text-theme transition truncate block flex-1"
                        title={displayName}
                    >
                        {displayName}
                    </a>
                    {profile?.permission && categories && onMoveCategory ? (
                        <select
                            value={category}
                            onChange={(e) => onMoveCategory(friend, e.target.value)}
                            className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] shrink-0 hover:border-theme/45 outline-none cursor-pointer"
                            title="点击直接切换此友链分类"
                        >
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-canvas-rgb))] shrink-0">
                            {category}
                        </span>
                    )}
                </div>

                {(friend.accepted === 0 || (profile?.permission && onReorder)) ? (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        {friend.accepted === 0 ? (
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-amber-600 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 shrink-0">
                                    待审核
                                </span>
                                {profile?.permission ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={onApprove}
                                            className="text-emerald-600 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] cursor-pointer"
                                        >
                                            通过
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onReject}
                                            className="text-rose-600 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-[10px] cursor-pointer"
                                        >
                                            拒绝
                                        </button>
                                    </>
                                ) : null}
                            </div>
                        ) : <span />}
                        {profile?.permission && onReorder ? (
                            <input
                                type="number"
                                defaultValue={friend.sort_order ?? 0}
                                key={`${friend.id}_${friend.sort_order}`}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const val = parseInt(e.currentTarget.value, 10);
                                        if (!isNaN(val)) onReorder(friend.id, val);
                                    }
                                }}
                                onBlur={(e) => {
                                    const val = parseInt(e.currentTarget.value, 10);
                                    if (!isNaN(val) && val !== (friend.sort_order ?? 0)) onReorder(friend.id, val);
                                }}
                                className="w-9 text-center rounded bg-[rgb(var(--rin-canvas-rgb))] border border-[rgb(var(--rin-hairline-rgb))] hover:border-theme outline-none text-[10px] font-mono font-bold py-0.5 shrink-0"
                                title="输入排序序号后敲回车立即换序 (数字越小越靠前，0 为默认)"
                            />
                        ) : null}
                    </div>
                ) : null}

                <div className="my-1">
                    <p
                        onClick={() => canExpandDesc && setIsDescExpanded((prev) => !prev)}
                        className={`text-xs text-[rgb(var(--rin-ink-muted-rgb))] leading-relaxed ${
                            isDescExpanded ? "" : "line-clamp-3"
                        } ${canExpandDesc ? "cursor-pointer" : ""}`}
                    >
                        {displayDesc}
                    </p>
                    {canExpandDesc ? (
                        <button
                            type="button"
                            onClick={() => setIsDescExpanded((prev) => !prev)}
                            className="mt-0.5 text-[11px] text-theme/85 hover:text-theme hover:underline cursor-pointer"
                        >
                            {isDescExpanded ? "收起简介" : "展开全部"}
                        </button>
                    ) : null}
                </div>

                {/* NodeSeek 坛友单行元信息 */}
                {(uid || parsed.nsData) ? (
                    <div className="mt-2.5 pt-2 border-t border-[rgb(var(--rin-hairline-rgb)/0.65)]">
                        <NodeSeekMetaInline uid={uid} nsData={parsed.nsData} />
                    </div>
                ) : null}
            </div>
        </article>
    );
}

// 编辑/更新友链弹窗
function EditFriendModal({
    friend,
    categories = ["友邻博客", "主机算力", "探针测速", "极客工具", "技术社区", "漫游灵感"],
    onClose,
    onError,
    onSuccess,
}: {
    friend: FriendItem;
    categories?: string[];
    onClose: () => void;
    onError?: (msg: string) => void;
    onSuccess: () => void;
}) {
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const [name, setName] = useState(friend.name);
    const [desc, setDesc] = useState(parsed.cleanDesc);
    const [avatar, setAvatar] = useState(() => sanitizeAvatarUrl(friend.avatar));
    const [url, setUrl] = useState(friend.url);
    const [category, setCategory] = useState(parsed.category || "友邻博客");
    const [spaceUrl, setSpaceUrl] = useState(parsed.spaceUrl || "");
    const nsData = parsed.nsData;
    const [nsRank, setNsRank] = useState<number | string>(parsed.nsData?.rank ?? "");
    const [nsCoin, setNsCoin] = useState<number | string>(parsed.nsData?.coin ?? "");
    const [nsDays, setNsDays] = useState<number | string>(parsed.nsData?.days ?? "");
    const [sortOrder, setSortOrder] = useState(friend.sort_order || 0);
    const [accepted, setAccepted] = useState(friend.accepted);
    const [isSaving, setIsSaving] = useState(false);
    const [isRefiningDesc, setIsRefiningDesc] = useState(false);

    // AI 智能精炼简介
    const handleRefineDesc = async () => {
        setIsRefiningDesc(true);
        try {
            const token = localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/friend/ai-refine-desc", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    url,
                    title: name,
                    currentDesc: desc,
                    nsData: parsed.nsData,
                    category,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.desc) {
                    setDesc(data.desc);
                }
            }
        } catch (err) {
            console.error("Refine desc failed:", err);
        } finally {
            setIsRefiningDesc(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const hasNsData = nsRank !== "" || nsCoin !== "" || nsDays !== "" || (spaceUrl && spaceUrl.includes("nodeseek"));
            const finalNsData = hasNsData ? {
                name: nsData?.name || name,
                member_name: nsData?.member_name || name,
                rank: nsRank !== "" ? Number(nsRank) : (nsData?.rank ?? 1),
                coin: nsCoin !== "" ? Number(nsCoin) : (nsData?.coin ?? 0),
                days: nsDays !== "" ? Number(nsDays) : (nsData?.days ?? 1),
                posts: nsData?.posts ?? 0,
                comments: nsData?.comments ?? 0,
                bio: nsData?.bio ?? "",
            } : undefined;

            const formattedDesc = formatFriendDesc(category, desc, {
                spaceUrl,
                nsData: finalNsData,
                avatarMode: parsed.avatarMode,
                nsAvatar: parsed.nsAvatar,
                siteAvatar: parsed.siteAvatar,
            });

            const res = await client.friend.update(friend.id, {
                name: name.trim(),
                desc: formattedDesc,
                avatar: sanitizeAvatarUrl(avatar.trim()),
                url: url.trim(),
                accepted,
                sort_order: sortOrder,
            });
            if (res.error) {
                throw new Error(typeof res.error.value === "string" ? res.error.value : "保存失败，请检查输入或稍后重试");
            }
            onSuccess();
        } catch (err: any) {
            console.error("Save friend failed:", err);
            if (onError) {
                onError(err?.message || "保存友链失败，请重试");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onRequestClose={onClose}
            contentLabel={`编辑友链: ${friend.name}`}
            panelClassName="overflow-visible p-4 sm:p-7 max-w-[94vw] sm:max-w-lg w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
        >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/5 dark:border-white/5">
                <h3 className="text-base font-bold t-primary">{`编辑友链: ${friend.name}`}</h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                    <i className="ri-close-line text-lg" />
                </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-neutral-500 mb-1">站点名称</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs"
                        />
                    </div>
                    <div>
                        <label className="block text-neutral-500 mb-1">分类</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-neutral-500 mb-1">站点链接</label>
                    <input
                        type="url"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs"
                    />
                </div>

                <div>
                    <label className="block text-neutral-500 mb-1">头像链接</label>
                    <input
                        type="url"
                        required
                        value={avatar}
                        onChange={(e) => setAvatar(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs"
                    />
                </div>

                <div>
                    <label className="block text-neutral-500 mb-1">空间地址或论坛直达 (选填)</label>
                    <input
                        type="text"
                        value={spaceUrl}
                        onChange={(e) => setSpaceUrl(e.target.value)}
                        placeholder="https://www.nodeseek.com/space/UID"
                        className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs font-mono"
                    />
                </div>

                {/* NodeSeek 勋章资产调节面板 */}
                <div className="p-3 rounded-2xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1">
                            <i className="ri-medal-line text-sm" />
                            <span>NodeSeek 坛友勋章资产 (实时联动)</span>
                        </span>
                        <button
                            type="button"
                            onClick={async () => {
                                const editUid = (spaceUrl || friend.url).match(/space\/(\d+)/i)?.[1] || name.match(/UID[:\s#]+(\d+)/i)?.[1] || "";
                                // 1. 尝试从剪贴板自动读取
                                if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
                                    try {
                                        const clipText = await navigator.clipboard.readText();
                                        if (clipText) {
                                            const p = parseNodeSeekPastedText(clipText);
                                            if (p.rank !== undefined || p.coin !== undefined || p.days !== undefined) {
                                                if (p.rank !== undefined) setNsRank(p.rank);
                                                if (p.coin !== undefined) setNsCoin(p.coin);
                                                if (p.days !== undefined) setNsDays(p.days);
                                                if (p.name && (!name || name.includes("NodeSeek#") || name.startsWith("UID:"))) setName(p.name);
                                                return;
                                            }
                                        }
                                    } catch {}
                                }
                                // 2. 若剪贴板无数据，唤起官方接口并监听切回
                                if (editUid) {
                                    const apiHintUrl = `https://www.nodeseek.com/api/account/getInfo/${editUid}?readme=1`;
                                    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                                        try { await navigator.clipboard.writeText(apiHintUrl); } catch {}
                                    }
                                    window.open(apiHintUrl, "_blank");
                                    const onFocusBack = async () => {
                                        window.removeEventListener("focus", onFocusBack);
                                        try {
                                            const newClip = await navigator.clipboard.readText();
                                            if (newClip) {
                                                const p = parseNodeSeekPastedText(newClip);
                                                if (p.rank !== undefined) setNsRank(p.rank);
                                                if (p.coin !== undefined) setNsCoin(p.coin);
                                                if (p.days !== undefined) setNsDays(p.days);
                                                if (p.name && (!name || name.includes("NodeSeek#") || name.startsWith("UID:"))) setName(p.name);
                                            }
                                        } catch {}
                                    };
                                    window.addEventListener("focus", onFocusBack);
                                }
                            }}
                            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                        >
                            <i className="ri-refresh-line text-xs" />
                            <span>自动读取/同步</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-[11px] text-neutral-500 mb-0.5">等级 (Lv)</label>
                            <input
                                type="number"
                                value={nsRank}
                                onChange={(e) => setNsRank(e.target.value)}
                                placeholder="如: 6"
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-xs font-mono font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] text-neutral-500 mb-0.5">鸡腿数 (🍗)</label>
                            <input
                                type="number"
                                value={nsCoin}
                                onChange={(e) => setNsCoin(e.target.value)}
                                placeholder="如: 11575"
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-xs font-mono font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] text-neutral-500 mb-0.5">加入天数 (🕒)</label>
                            <input
                                type="number"
                                value={nsDays}
                                onChange={(e) => setNsDays(e.target.value)}
                                placeholder="如: 640"
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-xs font-mono font-bold"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-neutral-500">站点简介（支持完整展示）</label>
                        <button
                            type="button"
                            onClick={handleRefineDesc}
                            disabled={isRefiningDesc}
                            className="text-[11px] text-theme hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                        >
                            <i className="ri-magic-line text-xs" />
                            <span>{isRefiningDesc ? "提炼中..." : "AI 智能精炼"}</span>
                        </button>
                    </div>
                    <textarea
                        rows={2}
                        maxLength={240}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="站点简介（支持完整展示）"
                        className="w-full px-3 py-2 rounded-xl bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))] border border-[rgb(var(--rin-hairline-rgb))] text-xs resize-none focus:outline-none focus:border-theme/45"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-neutral-500 mb-1">审核状态</label>
                        <select
                            value={accepted}
                            onChange={(e) => setAccepted(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs"
                        >
                            <option value={1}>已通过</option>
                            <option value={0}>待审核</option>
                            <option value={-1}>已拒绝</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-neutral-500 mb-1">排序序号 (数字越小越靠前，0 为默认)</label>
                        <input
                            type="number"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs font-mono"
                        />
                    </div>
                </div>

                <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-2 rounded-xl bg-theme text-white font-medium hover:opacity-90 disabled:opacity-50"
                    >
                        {isSaving ? "正在保存..." : "保存修改"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// 星廊动态分类自定义管理弹窗
function ManageCategoriesModal({
    isOpen,
    onClose,
    currentCategories,
    onSave,
}: {
    isOpen: boolean;
    onClose: () => void;
    currentCategories: string[];
    onSave: (categories: string[]) => Promise<void>;
}) {
    const [categories, setCategories] = useState<string[]>(currentCategories);
    const [newCatName, setNewCatName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setCategories(currentCategories);
    }, [currentCategories]);

    const handleAdd = () => {
        const trimmed = newCatName.trim();
        if (!trimmed) return;
        if (categories.includes(trimmed)) return;
        setCategories([...categories, trimmed]);
        setNewCatName("");
    };

    const handleMove = (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= categories.length) return;
        const copy = [...categories];
        const [moved] = copy.splice(index, 1);
        copy.splice(targetIndex, 0, moved);
        setCategories(copy);
    };

    const handleDelete = (cat: string) => {
        if (categories.length <= 1) return;
        setCategories(categories.filter((c) => c !== cat));
    };

    const handleRename = (index: number, newName: string) => {
        const copy = [...categories];
        copy[index] = newName;
        setCategories(copy);
    };

    const handleConfirmSave = async () => {
        const cleaned = categories.map((c) => c.trim()).filter(Boolean);
        if (cleaned.length === 0) return;
        setIsSaving(true);
        try {
            await onSave(cleaned);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            contentLabel="星廊分类管理"
            panelClassName="p-5 max-w-[94vw] sm:max-w-md w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl space-y-4"
        >
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-1.5 font-bold text-sm t-primary">
                    <i className="ri-folder-settings-line text-theme" />
                    <span>星廊分类自定义管理</span>
                </div>
                <button type="button" onClick={onClose} className="p-1 rounded text-neutral-400 hover:text-neutral-600">
                    <i className="ri-close-line text-lg" />
                </button>
            </div>

            <p className="text-[11px] text-neutral-400">
                可自由新建、重命名、上下排序或删除分类，配置立即全局生效。
            </p>

            {/* 分类列表 */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {categories.map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                        <input
                            type="text"
                            value={cat}
                            onChange={(e) => handleRename(idx, e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 outline-none focus:border-theme font-medium"
                        />
                        <button
                            type="button"
                            onClick={() => handleMove(idx, "up")}
                            disabled={idx === 0}
                            className="p-1 rounded text-neutral-400 hover:text-theme disabled:opacity-30 cursor-pointer"
                            title="上移"
                        >
                            <i className="ri-arrow-up-line text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleMove(idx, "down")}
                            disabled={idx === categories.length - 1}
                            className="p-1 rounded text-neutral-400 hover:text-theme disabled:opacity-30 cursor-pointer"
                            title="下移"
                        >
                            <i className="ri-arrow-down-line text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            disabled={categories.length <= 1}
                            className="p-1 rounded text-neutral-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer"
                            title="删除分类"
                        >
                            <i className="ri-delete-bin-line text-xs" />
                        </button>
                    </div>
                ))}
            </div>

            {/* 新增分类输入 */}
            <div className="flex items-center gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
                    placeholder="输入新分类名称 (如：设计灵感、二次元)..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs outline-none focus:border-theme bg-transparent"
                />
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!newCatName.trim()}
                    className="px-3 py-1.5 rounded-xl bg-theme/10 hover:bg-theme/20 text-theme text-xs font-bold disabled:opacity-40 transition shrink-0 cursor-pointer"
                >
                    + 新增
                </button>
            </div>

            {/* 底部操作 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl text-neutral-400 hover:bg-black/5 cursor-pointer">
                    取消
                </button>
                <button
                    type="button"
                    onClick={handleConfirmSave}
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                    {isSaving ? "保存中..." : "保存生效"}
                </button>
            </div>
        </Modal>
    );
}
