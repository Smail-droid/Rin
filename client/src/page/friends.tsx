import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from 'react-helmet';
import { Modal } from "@rin/ui";
import { useConfirm } from "../components/dialog";
import { ImageWithFallback } from "../components/image-with-fallback";
import { Waiting } from "../components/loading";
import { client } from "../app/runtime";
import { ProfileContext } from "../state/profile";
import { siteName } from "../utils/constants";
import { safeHttpUrl } from "../utils/url";
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

// 复制 NodeSeek 个人空间完整概览文本智能结构化解析
export function parseNodeSeekPastedText(text: string): {
    name?: string;
    rank?: number;
    coin?: number;
    days?: number;
    posts?: number;
    comments?: number;
    bio?: string;
} {
    const res: any = {};
    if (!text) return res;

    const rankMatch = text.match(/Lv\.?\s*(\d+)/i);
    if (rankMatch) res.rank = parseInt(rankMatch[1], 10);

    const coinMatch = text.match(/鸡腿\s*[:：]?\s*(\d+)/i) || text.match(/(\d+)\s*鸡腿/i);
    if (coinMatch) res.coin = parseInt(coinMatch[1], 10);

    const daysMatch = text.match(/已加入\s*[:：]?\s*(\d+)\s*天/i) || text.match(/加入\s*[:：]?\s*(\d+)\s*天/i) || text.match(/(\d+)\s*天/i);
    if (daysMatch) res.days = parseInt(daysMatch[1], 10);

    const postsMatch = text.match(/主题\s*[:：]?\s*(\d+)/i) || text.match(/(\d+)\s*主题/i);
    if (postsMatch) res.posts = parseInt(postsMatch[1], 10);

    const commentsMatch = text.match(/评论\s*[:：]?\s*(\d+)/i) || text.match(/(\d+)\s*评论/i);
    if (commentsMatch) res.comments = parseInt(commentsMatch[1], 10);

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
        const firstLine = lines[0].replace(/NodeSeek/i, "").trim();
        if (firstLine && !firstLine.includes("Lv") && !firstLine.includes("鸡腿") && firstLine.length <= 25) {
            res.name = firstLine;
        }
    }

    const bioMatch = text.match(/个性签名\s*[:：]?\s*([^\n]+)/i) || text.match(/签名\s*[:：]?\s*([^\n]+)/i);
    if (bioMatch) res.bio = bioMatch[1].trim();

    return res;
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

// 浏览器客户端轻量兜底抓取 NodeSeek 原生头像并转为 Base64
export async function fetchClientAvatarBase64(uid: string): Promise<string | null> {
    if (!uid) return null;
    const urls = [
        `https://www.nodeseek.com/avatar/${uid}.png`,
        `https://corsproxy.io/?url=${encodeURIComponent(`https://www.nodeseek.com/avatar/${uid}.png`)}`,
    ];
    for (const u of urls) {
        try {
            const res = await fetch(u, { signal: AbortSignal.timeout(2500) });
            if (res.ok) {
                const blob = await res.blob();
                if (blob.size > 100 && (blob.type.startsWith("image/") || blob.type.includes("octet-stream"))) {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(blob);
                    });
                }
            }
        } catch {}
    }
    return null;
}

// 浏览器客户端多级兜底直连获取 NodeSeek 真实坛友数据（利用用户本地 IPv4 网络穿透 IPv6 封锁）
export async function fetchClientSideNsDetail(uid: string): Promise<NodeSeekUserData | null> {
    if (!uid) return null;

    // 解析 NodeSeek API 返回的 JSON 为统一结构
    const parseNsDetail = (detail: any): NodeSeekUserData | null => {
        if (!detail) return null;
        let joinDays = detail.created_at_str ? detail.created_at_str.replace("days ago", "天") : undefined;
        if (detail.created_at) {
            const ts = typeof detail.created_at === "number" ? (detail.created_at < 1e11 ? detail.created_at * 1000 : detail.created_at) : new Date(detail.created_at).getTime();
            if (!isNaN(ts) && ts > 0) {
                const days = Math.max(1, Math.floor((Date.now() - ts) / (86400 * 1000)));
                joinDays = `${days}天`;
            }
        }
        return {
            name: detail.member_name,
            member_name: detail.member_name,
            bio: detail.bio ? detail.bio.trim() : undefined,
            rank: typeof detail.rank === "number" ? detail.rank : undefined,
            coin: typeof detail.coin === "number" ? detail.coin : undefined,
            days: joinDays,
            join_days: joinDays,
            posts: typeof detail.nPost === "number" ? detail.nPost : undefined,
            nPost: typeof detail.nPost === "number" ? detail.nPost : undefined,
            comments: typeof detail.nComment === "number" ? detail.nComment : undefined,
            nComment: typeof detail.nComment === "number" ? detail.nComment : undefined,
            created_at_str: detail.created_at_str,
        };
    };

    const apiUrl = `https://www.nodeseek.com/api/account/getInfo/${uid}`;

    // 第 1 级：浏览器本地网络直连 NodeSeek API
    try {
        const directRes = await fetch(apiUrl, {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(3000),
        });
        if (directRes.ok) {
            const text = await directRes.text();
            if (!text.includes("<!DOCTYPE") && !text.includes("ipv6") && !text.includes("IPv6")) {
                const parsed = JSON.parse(text);
                if (parsed?.detail) return parseNsDetail(parsed.detail);
            }
        }
    } catch {}

    // 第 2 级：通过 corsproxy.io 公共代理
    try {
        const proxyRes = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`, {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(3000),
        });
        if (proxyRes.ok) {
            const text = await proxyRes.text();
            if (!text.includes("<!DOCTYPE")) {
                const parsed = JSON.parse(text);
                if (parsed?.detail) return parseNsDetail(parsed.detail);
            }
        }
    } catch {}

    // 第 3 级：通过 microlink.io HTML 嗅探
    try {
        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(apiUrl)}&data.body=%7B%22selector%22%3A%22body%22%7D`;
        const mRes = await fetch(mUrl, {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(8000),
        });
        if (mRes.ok) {
            const mData = await mRes.json();
            const rawBody = mData?.data?.body || "";
            const jsonMatch = rawBody.match(/\{"success":true,"detail":\{[\s\S]*?\}\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed?.detail) return parseNsDetail(parsed.detail);
            }
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

                let finalNsDetail = data.nsDetail;
                const uidMatch = targetUrl.match(/^\d{1,8}$/) || targetUrl.match(/space\/(\d+)/i);
                if (!finalNsDetail && uidMatch) {
                    const clientDetail = await fetchClientSideNsDetail(uidMatch[1] || uidMatch[0]);
                    if (clientDetail) {
                        finalNsDetail = clientDetail;
                    }
                }

                if (finalNsDetail) {
                    setNsUserData(finalNsDetail);
                    if (finalNsDetail.member_name) {
                        setFormName(finalNsDetail.member_name);
                        setExtractBtnFeedback(`✓ 已识别: ${finalNsDetail.member_name}`);
                    }
                    if (finalNsDetail.bio && !formDesc) {
                        setFormDesc(finalNsDetail.bio.slice(0, 40));
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

    const acceptedFriends = useMemo(() => {
        return allFriends.filter((f) => f.accepted === 1);
    }, [allFriends]);

    const pendingFriends = useMemo(() => {
        return allFriends.filter((f) => f.accepted === 0);
    }, [allFriends]);

    const filteredFriends = useMemo(() => {
        let list = acceptedFriends;
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
    }, [acceptedFriends, activeCategory, searchKeyword]);

    const handleViewStyleChange = (style: "card" | "compact" | "polaroid") => {
        setViewStyle(style);
        try {
            localStorage.setItem("rin_friends_view_style", style);
        } catch {}
    };

    const handleApprove = async (id: number) => {
        await client.friend.update(id, { accepted: 1 });
        reloadFriends();
    };

    const handleReject = async (id: number) => {
        await client.friend.update(id, { accepted: -1 });
        reloadFriends();
    };

    const handleDelete = (id: number, name: string) => {
        showConfirm("删除友链", `确定要删除「${name}」吗？此操作无法撤销。`, async () => {
            await client.friend.delete(id);
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
            const finalAvatar = iconChoice === "ns"
                ? (nsAvatarUrl || formAvatar)
                : iconChoice === "site"
                ? (siteFaviconUrl || formAvatar)
                : (siteFaviconUrl || formAvatar || nsAvatarUrl || "https://dummyimage.com/128x128/ff4d79/ffffff&text=Rin");

            const formattedDesc = formatFriendDesc(formCategory, formDesc, {
                spaceUrl: formSpaceUrl,
                nsData: nsUserData || undefined,
                avatarMode: iconChoice,
                nsAvatar: nsAvatarUrl,
                siteAvatar: siteFaviconUrl,
            });

            if (profile?.permission) {
                await client.friend.create({
                    name: formName.trim(),
                    desc: formattedDesc,
                    avatar: finalAvatar.trim(),
                    url: formUrl.trim(),
                });
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
        if (nsFriends.length === 0) return;

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
                if (!finalDetail && uid) {
                    finalDetail = await fetchClientSideNsDetail(uid);
                }
                if (finalDetail || uid || data?.avatarUrl) {
                    const nextName = parsed.category === "友邻博客" ? f.name : (finalDetail?.member_name || f.name);
                    const nextDesc = finalDetail?.bio ? finalDetail.bio.slice(0, 40) : (data?.suggestedDesc || `${nextName}的空间`);
                    const isR2 = data?.avatarUrl && data.avatarUrl.includes("/api/blob/");
                    const finalAvatar = isR2 ? data.avatarUrl : (uid ? `https://www.nodeseek.com/avatar/${uid}.png` : sanitizeAvatarUrl(f.avatar));
                    const formatted = formatFriendDesc(parsed.category, nextDesc, {
                        spaceUrl: data?.spaceUrl || parsed.spaceUrl || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : undefined),
                        avatarMode: parsed.avatarMode,
                        siteAvatar: parsed.siteAvatar,
                        nsAvatar: finalAvatar,
                        nsData: finalDetail ? {
                            name: finalDetail.member_name,
                            rank: finalDetail.rank,
                            coin: finalDetail.coin,
                            days: finalDetail.days || finalDetail.join_days,
                            posts: finalDetail.posts || finalDetail.nPost,
                            comments: finalDetail.comments || finalDetail.nComment,
                            bio: finalDetail.bio,
                        } : parsed.nsData,
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
        await client.friend.update(friend.id, { desc: formatted });
        reloadFriends();
    };

    // 输入权重数字敲回车即时排序
    const handleQuickReorder = async (friendId: number, newSortOrder: number) => {
        await client.friend.update(friendId, { sort_order: newSortOrder });
        reloadFriends();
    };

    return (
        <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <Helmet>
                <title>{`星标友链 · 画廊漫游 - ${siteName}`}</title>
            </Helmet>
            <ConfirmUI />

            {/* 顶栏：标题、描述与新增/申请按钮 */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight t-primary flex items-center gap-2">
                        <span className="text-theme">🌸</span>
                        <span>星标友链 · 画廊漫游</span>
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        汇聚优秀的友邻博客、极客工具与技术漫游星空。
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {profile?.permission && (
                        <button
                            type="button"
                            onClick={handleBatchRefreshAll}
                            disabled={isBatchRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            title="一键自动更正全部 NodeSeek 坛友最新头像与等级鸡腿数据"
                        >
                            <i className={`ri-refresh-line ${isBatchRefreshing ? "animate-spin" : ""}`} />
                            <span>{isBatchRefreshing ? `更正中 (${batchProgress?.current}/${batchProgress?.total})` : "一键更正全部"}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-theme text-white text-sm font-medium hover:opacity-90 transition shadow-sm cursor-pointer"
                    >
                        <i className="ri-add-line text-base" />
                        <span>{profile?.permission ? "收录星标站点" : "申请加入星标"}</span>
                    </button>
                </div>
            </div>

            {/* 控制条：分类筛选 Tab、视图风格切换与搜索框 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-black/5 dark:border-white/5">
                {/* 分类 Tab 胶囊与自定义管理 */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {["全部", ...categories].map((cat) => {
                        const isActive = activeCategory === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                                    isActive
                                        ? "bg-theme text-white shadow-2xs"
                                        : "bg-black/[0.03] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5"
                                }`}
                            >
                                {cat}
                            </button>
                        );
                    })}

                    {profile?.permission && (
                        <button
                            type="button"
                            onClick={() => setIsManageCategoriesOpen(true)}
                            className="px-2.5 py-1.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.015] dark:bg-white/[0.02] text-neutral-500 hover:text-theme hover:border-theme/40 text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="自定义新增、重命名或重排全站星廊分类"
                        >
                            <i className="ri-settings-3-line text-xs" />
                            <span>管理分类</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* 视图风格切换 */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-neutral-500">
                        <button
                            type="button"
                            onClick={() => handleViewStyleChange("card")}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${viewStyle === "card" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs" : "hover:text-neutral-700 dark:hover:text-neutral-200"}`}
                            title="经典卡片视图"
                        >
                            <i className="ri-grid-fill text-sm" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleViewStyleChange("compact")}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${viewStyle === "compact" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs" : "hover:text-neutral-700 dark:hover:text-neutral-200"}`}
                            title="高密书签行视图"
                        >
                            <i className="ri-list-check-2 text-sm" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleViewStyleChange("polaroid")}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${viewStyle === "polaroid" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs" : "hover:text-neutral-700 dark:hover:text-neutral-200"}`}
                            title="拍立得和纸胶带便签视图"
                        >
                            <i className="ri-polaroid-line text-sm" />
                        </button>
                    </div>

                    {/* 搜索输入框 */}
                    <div className="relative w-48 sm:w-60">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="搜索友邻名称或网址..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 focus:outline-none focus:border-theme/40 transition placeholder:text-neutral-400"
                        />
                        {searchKeyword && (
                            <button
                                type="button"
                                onClick={() => setSearchKeyword("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                <i className="ri-close-circle-line text-xs" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 管理员待审批提示条 */}
            {profile?.permission && pendingFriends.length > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
                        <i className="ri-time-line text-base" />
                        <span>有 {pendingFriends.length} 条待审核的友链申请等待处理</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {pendingFriends.map((p) => (
                            <div key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-amber-500/30 text-xs">
                                <span className="font-medium truncate max-w-[120px]">{p.name}</span>
                                <button
                                    onClick={() => handleApprove(p.id)}
                                    className="text-emerald-600 hover:text-emerald-700 font-bold ml-1"
                                    title="通过审核"
                                >
                                    ✓
                                </button>
                                <button
                                    onClick={() => handleReject(p.id)}
                                    className="text-rose-500 hover:text-rose-600 font-bold ml-1"
                                    title="拒绝申请"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 核心内容区：按视图风格流体排布 */}
            {status === "loading" && allFriends.length === 0 ? (
                <div className="py-20 flex justify-center">
                    <Waiting />
                </div>
            ) : filteredFriends.length === 0 ? (
                <div className="py-24 text-center">
                    <i className="ri-inbox-line text-4xl text-neutral-300 dark:text-neutral-600" />
                    <p className="mt-3 text-sm text-neutral-500">暂无匹配的友链或星标站点</p>
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
                            onMoveCategory={handleQuickMoveCategory}
                            onReorder={handleQuickReorder}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 items-start">
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
                            <label className="text-neutral-500">极炼简介 (不超过40字)</label>
                            <button
                                type="button"
                                onClick={handleRefineDesc}
                                disabled={isRefiningDesc}
                                className="text-[11px] text-theme hover:underline flex items-center gap-0.5"
                            >
                                <i className="ri-magic-line text-xs" />
                                <span>{isRefiningDesc ? "提炼中..." : "AI 智能精炼"}</span>
                            </button>
                        </div>
                        <input
                            type="text"
                            maxLength={40}
                            value={formDesc}
                            onChange={(e) => setFormDesc(e.target.value)}
                            placeholder="个人技术生活随想"
                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 focus:outline-none focus:border-theme/40 text-xs"
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
            {editingFriend && (
                <EditFriendModal
                    friend={editingFriend}
                    categories={categories}
                    onClose={() => setEditingFriend(null)}
                    onSuccess={() => {
                        setEditingFriend(null);
                        reloadFriends();
                    }}
                />
            )}

            {/* 星廊动态分类自定义管理弹窗 */}
            {isManageCategoriesOpen && (
                <ManageCategoriesModal
                    isOpen={isManageCategoriesOpen}
                    onClose={() => setIsManageCategoriesOpen(false)}
                    currentCategories={categories}
                    onSave={async (newCats) => {
                        await client.config.update("client", {
                            "friends.categories": JSON.stringify(newCats),
                        });
                        setCategories(newCats);
                    }}
                />
            )}
        </div>
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
    onMoveCategory?: (friend: FriendItem, newCat: string) => void;
    onReorder?: (friendId: number, newSortOrder: number) => void;
}

// 抽取 NodeSeek 资产更正与就地同步状态机 Hook
function useFriendNsRefresh(
    friend: FriendItem,
    parsed: ReturnType<typeof parseFriendCategory>,
    onUpdate?: () => void
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

            // 1. 请求服务端转存与提取（内置纯净直连与快速降级）
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
                    }),
                });
                if (res.ok) {
                    serverData = await res.json();
                }
            } catch (netErr) {
                console.warn("Server extract error, falling back to client-only:", netErr);
            }

            let finalNsDetail = serverData?.nsDetail;
            if (!finalNsDetail && uid) {
                finalNsDetail = await fetchClientSideNsDetail(uid);
            }

            // 头像处理：优先使用服务端转存好的 R2 链接 (带时间戳刷新防缓存)；如果服务端没有成功写 R2，则使用官方直链回退
            const serverAvatarUrl = serverData?.avatarUrl || "";
            const isR2Avatar = serverAvatarUrl.includes("/api/blob/");
            const finalAvatarUrl = isR2Avatar
                ? serverAvatarUrl
                : (uid ? `https://www.nodeseek.com/avatar/${uid}.png` : sanitizeAvatarUrl(serverAvatarUrl || friend.avatar));

            if (finalNsDetail) {
                const isFriendBlog = category === "友邻博客";
                const nextName = isFriendBlog ? friend.name : (finalNsDetail.member_name || displayName);
                const nextDesc = isFriendBlog
                    ? (cleanDesc && cleanDesc !== "个人技术生活随想" ? cleanDesc : friend.name)
                    : (finalNsDetail.bio ? finalNsDetail.bio.trim().slice(0, 40) : (serverData?.suggestedDesc || `${nextName}的空间`));

                const newFormattedDesc = formatFriendDesc(category, nextDesc, {
                    spaceUrl: serverData?.spaceUrl || spaceUrl || (uid ? `https://www.nodeseek.com/space/${uid}#/general` : undefined),
                    avatarMode: parsed.avatarMode,
                    siteAvatar: parsed.siteAvatar,
                    nsAvatar: finalAvatarUrl || parsed.nsAvatar,
                    nsData: {
                        name: finalNsDetail.member_name,
                        rank: finalNsDetail.rank,
                        coin: finalNsDetail.coin,
                        days: finalNsDetail.days || finalNsDetail.join_days,
                        posts: finalNsDetail.posts || finalNsDetail.nPost,
                        comments: finalNsDetail.comments || finalNsDetail.nComment,
                        bio: finalNsDetail.bio,
                    },
                });

                await client.friend.update(friend.id, {
                    name: nextName,
                    desc: newFormattedDesc,
                    avatar: finalAvatarUrl,
                });

                setRefreshNsDone(true);
                if (onUpdate) {
                    onUpdate();
                }
                setTimeout(() => setRefreshNsDone(false), 2500);
            }
        } catch (err) {
            console.error("Quick refresh NS failed:", err);
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

// 风格 1: 画廊经典卡片 (FriendCard)
function FriendCard({
    friend,
    index,
    categories,
    onEdit,
    onDelete,
    onApprove,
    onReject,
    onUpdate,
    onMoveCategory,
    onReorder,
}: FriendCardProps) {
    const profile = useContext(ProfileContext);
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const { category, cleanDesc, spaceUrl, nsData } = parsed;
    const { uid, displayName, isRefreshingNs, refreshNsDone, handleQuickRefreshNs } = useFriendNsRefresh(friend, parsed, onUpdate);

    const primaryUrl = safeHttpUrl(spaceUrl) || safeHttpUrl(friend.url);

    // 拍立得手绘微倾角：奇数项向左倾斜 -1.8deg，偶数项向右倾斜 1.6deg
    const tiltClass = index % 2 === 0 ? "hover:rotate-[1.6deg]" : "hover:rotate-[-1.8deg]";

    return (
        <div className={`group relative p-4 rounded-3xl bg-white/70 dark:bg-neutral-900/70 border border-black/5 dark:border-white/5 backdrop-blur-md shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-3 font-sans ${tiltClass}`}>
            {/* 顶部标签栏与分类 */}
            <div className="flex items-center justify-between text-[11px]">
                {profile?.permission && categories && onMoveCategory ? (
                    <select
                        value={category}
                        onChange={(e) => onMoveCategory(friend, e.target.value)}
                        className="px-2 py-0.5 rounded-lg bg-theme/10 text-theme font-medium text-[11px] outline-none cursor-pointer border border-transparent hover:border-theme/40"
                        title="点击直接切换此友链分类"
                    >
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                ) : (
                    <span className="px-2 py-0.5 rounded-lg bg-theme/10 text-theme font-medium">
                        {category}
                    </span>
                )}
                <div className="flex items-center gap-1.5">
                    {profile?.permission && onReorder && (
                        <div className="flex items-center gap-0.5 font-mono text-[11px] text-neutral-400">
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
                                className="w-10 text-center rounded bg-black/5 dark:bg-white/5 border border-transparent hover:border-theme focus:border-theme outline-none text-[10px] font-mono font-bold py-0.2"
                                title="输入排序权重敲回车即时排序 (数字越大越靠前)"
                            />
                        </div>
                    )}
                    {friend.accepted === 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 font-bold">
                            待审核
                        </span>
                    )}
                </div>
            </div>

            {/* 卡片核心主体 */}
            <div className="flex items-start gap-3">
                {/* 头像区域：支持子母双图融合 */}
                <div className="relative shrink-0">
                    <ImageWithFallback
                        src={sanitizeAvatarUrl(friend.avatar)}
                        alt={friend.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-black/10 dark:border-white/10 shadow-2xs group-hover:scale-105 transition-transform"
                    />
                    {parsed.nsAvatar && parsed.siteAvatar && parsed.avatarMode === "dual" && (
                        <ImageWithFallback
                            src={sanitizeAvatarUrl(parsed.nsAvatar)}
                            alt="NodeSeek"
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover border-2 border-white dark:border-neutral-900 shadow-xs"
                            title="NodeSeek 坛友认证"
                        />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <a
                        href={primaryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-sm t-primary hover:text-theme transition truncate block"
                        title={displayName}
                    >
                        {displayName}
                    </a>
                    <a
                        href={safeHttpUrl(friend.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition truncate block font-mono mt-0.5"
                    >
                        {friend.url.replace(/^https?:\/\//, "").replace(/\/+$/, "")} ↗
                    </a>
                </div>
            </div>

            {/* 简介说明 */}
            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 min-h-[32px]">
                {cleanDesc || "个人技术生活随想"}
            </p>

            {/* NodeSeek 坛友专属资产勋章栏 */}
            {(uid || nsData) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-black/5 dark:border-white/5 text-[10px] font-mono">
                    {uid && (
                        <a
                            href={`https://www.nodeseek.com/space/${uid}#/general`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-500/20 transition"
                            title="直达 NodeSeek 个人空间"
                        >
                            UID: {uid}
                        </a>
                    )}
                    {nsData?.rank !== undefined && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold">
                            <DiamondRankSvg className="w-2.5 h-2.5" />
                            <span>Lv.{nsData.rank}</span>
                        </span>
                    )}
                    {nsData?.coin !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-600 font-bold" title="鸡腿资产">
                            🍗 {nsData.coin}
                        </span>
                    )}
                    {nsData?.days !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold" title="加入天数">
                            🕒 {nsData.days}
                        </span>
                    )}
                </div>
            )}

            {/* 管理员操作栏 */}
            {profile?.permission && (
                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                    {friend.accepted === 0 ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onApprove}
                                className="px-2 py-0.5 rounded-md bg-emerald-500 text-white font-bold text-[11px]"
                            >
                                通过
                            </button>
                            <button
                                onClick={onReject}
                                className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-bold text-[11px]"
                            >
                                拒绝
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleQuickRefreshNs}
                            disabled={isRefreshingNs}
                            className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer disabled:opacity-50"
                        >
                            <i className={`ri-refresh-line ${isRefreshingNs ? "animate-spin" : ""}`} />
                            <span>{isRefreshingNs ? "更正中" : refreshNsDone ? "✓ 已更正" : "更正数据"}</span>
                        </button>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={onEdit}
                            className="p-1 rounded-md text-neutral-400 hover:text-theme transition"
                            title="编辑"
                        >
                            <i className="ri-edit-line text-xs" />
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1 rounded-md text-neutral-400 hover:text-rose-500 transition"
                            title="删除"
                        >
                            <i className="ri-delete-bin-line text-xs" />
                        </button>
                    </div>
                </div>
            )}
        </div>
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
    onMoveCategory,
    onReorder,
}: FriendCardProps) {
    const profile = useContext(ProfileContext);
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const { category, cleanDesc, spaceUrl } = parsed;
    const { uid, isRefreshingNs, refreshNsDone, handleQuickRefreshNs } = useFriendNsRefresh(friend, parsed, onUpdate);
    const primaryUrl = safeHttpUrl(spaceUrl) || safeHttpUrl(friend.url);

    return (
        <div className="group flex items-center justify-between p-3 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-black/5 dark:border-white/5 hover:bg-white dark:hover:bg-neutral-800 transition gap-3 text-xs font-sans">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <ImageWithFallback
                    src={sanitizeAvatarUrl(friend.avatar)}
                    alt={friend.name}
                    className="w-7 h-7 rounded-lg object-cover shrink-0"
                />
                {profile?.permission && categories && onMoveCategory ? (
                    <select
                        value={category}
                        onChange={(e) => onMoveCategory(friend, e.target.value)}
                        className="px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-neutral-500 outline-none cursor-pointer border border-transparent hover:border-theme shrink-0"
                        title="点击直接切换此友链分类"
                    >
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                ) : (
                    <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-neutral-500 shrink-0">
                        {category}
                    </span>
                )}
                {profile?.permission && onReorder && (
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
                        className="w-9 text-center rounded bg-black/5 dark:bg-white/5 border border-transparent hover:border-theme outline-none text-[10px] font-mono font-bold py-0.2 shrink-0"
                        title="输入排序权重后敲回车立即换序"
                    />
                )}
                <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold t-primary hover:text-theme transition truncate shrink-0 max-w-[150px]"
                >
                    {friend.name}
                </a>
                <span className="text-neutral-400 truncate hidden sm:inline">
                    {cleanDesc || "个人技术生活随想"}
                </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {profile?.permission && uid && friend.accepted !== 0 && (
                    <button
                        type="button"
                        onClick={handleQuickRefreshNs}
                        disabled={isRefreshingNs}
                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline px-1 py-0.5 rounded"
                        title="更正坛友资产"
                    >
                        {isRefreshingNs ? "更正中" : refreshNsDone ? "✓ 已更正" : "更正"}
                    </button>
                )}
                <a
                    href={safeHttpUrl(friend.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-400 hover:text-theme p-1"
                    title="访问站点"
                >
                    <i className="ri-external-link-line" />
                </a>
                {profile?.permission && (
                    <>
                        {friend.accepted === 0 && (
                            <div className="flex items-center gap-1">
                                <button onClick={onApprove} className="text-emerald-600 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10">
                                    通过
                                </button>
                                <button onClick={onReject} className="text-amber-600 font-bold px-1.5 py-0.5 rounded bg-amber-500/10">
                                    拒绝
                                </button>
                            </div>
                        )}
                        <button onClick={onEdit} className="text-neutral-400 hover:text-theme p-1" title="编辑">
                            <i className="ri-edit-line" />
                        </button>
                        <button onClick={onDelete} className="text-neutral-400 hover:text-rose-500 p-1" title="删除">
                            <i className="ri-delete-bin-line" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// 风格 3: 拍立得和纸胶带便签 (Polaroid Notes)
function PolaroidFriendCard({
    friend,
    index,
    categories,
    onEdit,
    onDelete,
    onApprove,
    onReject,
    onUpdate,
    onMoveCategory,
    onReorder,
}: FriendCardProps) {
    const profile = useContext(ProfileContext);
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const { category, cleanDesc, spaceUrl } = parsed;
    const { uid, displayName, isRefreshingNs, refreshNsDone, handleQuickRefreshNs } = useFriendNsRefresh(friend, parsed, onUpdate);
    const primaryUrl = safeHttpUrl(spaceUrl) || safeHttpUrl(friend.url);
    const safeAvatar = sanitizeAvatarUrl(friend.avatar);

    const tilt = index % 2 === 0 ? "rotate-1" : "-rotate-1";

    return (
        <div className={`relative pt-4 pb-3.5 px-3.5 sm:px-4 bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 shadow-md hover:shadow-xl transition-all duration-300 rounded-sm font-sans flex flex-col justify-between ${tilt}`}>
            {/* 顶端半透明彩色和纸胶带拟物 */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4.5 bg-pink-400/40 dark:bg-pink-500/30 backdrop-blur-xs border-t border-b border-white/40 rotate-1 shadow-2xs pointer-events-none" />

            <div>
                {/* 拍立得照片视窗：弥散微光暗纹背景 + 居中高清主体，彻底杜绝小图拉伸发虚 */}
                <div className="h-28 sm:h-32 w-full rounded-xl bg-gradient-to-br from-theme/10 via-black/5 to-theme/5 dark:from-white/5 dark:to-white/[0.02] overflow-hidden mb-2.5 border border-black/5 dark:border-white/5 relative flex items-center justify-center select-none group/polaroid">
                    {/* 提取头像主色作为环境氛围弥散光 */}
                    <img
                        src={safeAvatar}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-125 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-white/20 dark:bg-black/25 backdrop-blur-[2px] pointer-events-none" />

                    {/* 居中高清无损头像主体 (56px~64px 黄金尺寸，保留原生锐度) */}
                    <div className="relative z-10 flex flex-col items-center justify-center p-1.5">
                        <ImageWithFallback
                            src={safeAvatar}
                            alt={friend.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-neutral-800 transition-transform duration-300 group-hover/polaroid:scale-105"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between mb-1 gap-1">
                    <a
                        href={primaryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-sm t-primary hover:text-theme transition truncate block flex-1"
                        title={displayName}
                    >
                        {displayName}
                    </a>
                    {profile?.permission && categories && onMoveCategory ? (
                        <select
                            value={category}
                            onChange={(e) => onMoveCategory(friend, e.target.value)}
                            className="text-[10px] text-theme font-medium px-1.5 py-0.2 rounded bg-theme/10 shrink-0 border border-transparent hover:border-theme/40 outline-none cursor-pointer"
                            title="点击直接切换此友链分类"
                        >
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-[10px] text-theme font-medium px-1.5 py-0.2 rounded bg-theme/10 shrink-0">
                            {category}
                        </span>
                    )}
                    {profile?.permission && onReorder && (
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
                            className="w-9 text-center rounded bg-black/5 dark:bg-white/5 border border-transparent hover:border-theme outline-none text-[10px] font-mono font-bold py-0.2 shrink-0"
                            title="输入排序权重后敲回车立即换序"
                        />
                    )}
                </div>

                <p className="text-xs text-neutral-500 line-clamp-2 min-h-[30px] my-1 leading-relaxed">
                    {cleanDesc || "个人技术生活随想"}
                </p>

                {/* NodeSeek 坛友专属资产勋章栏（UID直达、Lv等级、🍗鸡腿、🕒加入天数） */}
                {(uid || parsed.nsData) && (
                    <div className="flex flex-wrap items-center gap-1 my-1.5 py-1 px-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-[10px] font-mono">
                        {uid && (
                            <a
                                href={`https://www.nodeseek.com/space/${uid}#/general`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-500/20 transition shrink-0"
                                title="直达 NodeSeek 个人空间"
                            >
                                UID: {uid}
                            </a>
                        )}
                        {parsed.nsData?.rank !== undefined && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-bold shrink-0">
                                <DiamondRankSvg className="w-2.5 h-2.5" />
                                <span>Lv.{parsed.nsData.rank}</span>
                            </span>
                        )}
                        {parsed.nsData?.coin !== undefined && (
                            <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-600 font-bold shrink-0" title="鸡腿资产">
                                🍗 {parsed.nsData.coin}
                            </span>
                        )}
                        {parsed.nsData?.days !== undefined && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 font-bold shrink-0" title="加入天数">
                                🕒 {parsed.nsData.days}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* 管理员操作栏 */}
            {profile?.permission && (
                <div className="pt-2 mt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                    {friend.accepted === 0 ? (
                        <div className="flex items-center gap-1.5">
                            <button onClick={onApprove} className="text-emerald-600 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-[11px]">
                                通过
                            </button>
                            <button onClick={onReject} className="text-amber-600 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-[11px]">
                                拒绝
                            </button>
                        </div>
                    ) : uid ? (
                        <button
                            type="button"
                            onClick={handleQuickRefreshNs}
                            disabled={isRefreshingNs}
                            className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer disabled:opacity-50"
                        >
                            <i className={`ri-refresh-line ${isRefreshingNs ? "animate-spin" : ""}`} />
                            <span>{isRefreshingNs ? "更正中" : refreshNsDone ? "✓ 已更正" : "更正数据"}</span>
                        </button>
                    ) : <div />}
                    <div className="flex items-center gap-2">
                        <button onClick={onEdit} className="text-neutral-400 hover:text-theme p-0.5" title="编辑">
                            <i className="ri-edit-line" />
                        </button>
                        <button onClick={onDelete} className="text-neutral-400 hover:text-rose-500 p-0.5" title="删除">
                            <i className="ri-delete-bin-line" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// 编辑/更新友链弹窗
function EditFriendModal({
    friend,
    categories = ["友邻博客", "主机算力", "探针测速", "极客工具", "技术社区", "漫游灵感"],
    onClose,
    onSuccess,
}: {
    friend: FriendItem;
    categories?: string[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const parsed = parseFriendCategory(friend.desc, friend.url, friend.name, friend.avatar);
    const [name, setName] = useState(friend.name);
    const [desc, setDesc] = useState(parsed.cleanDesc);
    const [avatar, setAvatar] = useState(() => sanitizeAvatarUrl(friend.avatar));
    const [url, setUrl] = useState(friend.url);
    const [category, setCategory] = useState(parsed.category || "友邻博客");
    const [spaceUrl, setSpaceUrl] = useState(parsed.spaceUrl || "");
    const [sortOrder, setSortOrder] = useState(friend.sort_order || 0);
    const [accepted, setAccepted] = useState(friend.accepted);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const formattedDesc = formatFriendDesc(category, desc, {
                spaceUrl,
                nsData: parsed.nsData,
                avatarMode: parsed.avatarMode,
                nsAvatar: parsed.nsAvatar,
                siteAvatar: parsed.siteAvatar,
            });

            await client.friend.update(friend.id, {
                name: name.trim(),
                desc: formattedDesc,
                avatar: sanitizeAvatarUrl(avatar.trim()),
                url: url.trim(),
                accepted,
                sort_order: sortOrder,
            });
            onSuccess();
        } catch (err) {
            console.error("Save friend failed:", err);
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
                        className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs"
                    />
                </div>

                <div>
                    <label className="block text-neutral-500 mb-1">站点简介</label>
                    <input
                        type="text"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs"
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
                        <label className="block text-neutral-500 mb-1">排序权重 (数字越大越靠前)</label>
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
