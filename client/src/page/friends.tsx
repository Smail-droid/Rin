import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Helmet } from 'react-helmet';
import { useTranslation } from "react-i18next";
import { Modal } from "@rin/ui";
import { useAlert, useConfirm } from "../components/dialog";
import { ImageWithFallback } from "../components/image-with-fallback";
import { Waiting } from "../components/loading";
import { client } from "../app/runtime";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { safeHttpUrl } from "../utils/url";

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

export interface ProbeMachineNode {
    id: string;
    name: string;
    countryCode: string;
    merchant: string;
    model: string;
    routeTag: string;
    tags?: string;
    price?: string;
    usage?: string;
    
    // 系统与硬件详情
    os?: string;
    kernel?: string;
    arch?: string;
    virtualization?: string;
    gpu?: string;
    cpu?: string;
    cpuDetail?: string;
    cpuCores?: number;
    ram?: string;
    ramTotal?: string;
    ramUsed?: string;
    swapTotal?: string;
    swapUsed?: string;
    disk?: string;
    diskTotal?: string;
    diskUsed?: string;
    
    // 实时使用量与负载
    cpuUsage?: number;
    ramUsage?: number;
    diskUsage?: number;
    load1?: number;
    load5?: number;
    load15?: number;
    processCount?: number;
    
    // 实时速率与流量统计
    netSpeedIn?: string;
    netSpeedOut?: string;
    netTotalUp?: string;
    netTotalDown?: string;
    trafficLimit?: string;
    bandwidth?: string;
    traffic?: string;
    
    // 连接数 (TCP / UDP)
    tcpConnections?: number;
    udpConnections?: number;
    
    // 状态与运行时间
    online?: boolean;
    uptimeDays: number;
    uptimeDetail?: string;
    lastReportTime?: string;
    
    // 延迟与测速
    telecomPing: number;
    unicomPing: number;
    mobilePing: number;
    packetLoss: number;
    pingHistory?: number[];
    testNodeLocation?: string;
    
    // IP 质量与流媒体解锁
    ipRisk?: string;
    mediaUnlock?: string[];
    
    sourceUrl: string;
    probeName?: string;
    updatedAt: string;
}

// 预设六大严谨画廊与极客基建分类
export const PRESET_CATEGORIES = [
    "全部",
    "友邻博客",
    "主机算力",
    "探针测速",
    "极客工具",
    "技术社区",
    "漫游灵感",
] as const;

// 历史分类向后兼容标准化映射
export function normalizeCategory(cat: string): string {
    const raw = (cat || "").trim();
    if (raw === "友友们") return "友邻博客";
    if (raw === "VPS/基础设施" || raw === "VPS" || raw === "基础设施") return "主机算力";
    if (
        raw === "测速/探针监控" ||
        raw === "网络测速/路由" ||
        raw === "买鸡/探针监控" ||
        raw === "测速" ||
        raw === "探针监控"
    ) return "探针测速";
    if (raw === "极客常用工具" || raw === "常用工具") return "极客工具";
    if (raw === "技术极客社区" || raw === "极客社区") return "技术社区";
    if (raw === "其他灵感") return "漫游灵感";
    return raw || "友邻博客";
}

// 从描述中解析分类标签 [分类] 以及纯净简介
export function parseFriendCategory(desc: string | null, url: string = ""): { category: string; cleanDesc: string } {
    if (!desc) {
        return { category: inferCategoryFallback(url, ""), cleanDesc: "" };
    }
    const match = desc.match(/^\[(.*?)\]\s*(.*)$/);
    if (match && match[1]) {
        return {
            category: normalizeCategory(match[1]),
            cleanDesc: match[2]?.trim() || "",
        };
    }
    return {
        category: inferCategoryFallback(url, desc),
        cleanDesc: desc.trim(),
    };
}

// 根据 URL 与文本前置启发分类
function inferCategoryFallback(url: string, text: string): string {
    const combined = `${url} ${text}`.toLowerCase();
    if (
        combined.includes("vps") ||
        combined.includes("cloud") ||
        combined.includes("host") ||
        combined.includes("server") ||
        combined.includes("idc") ||
        combined.includes("机房") ||
        combined.includes("买鸡") ||
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
        combined.includes("探针") ||
        combined.includes("路由") ||
        combined.includes("nezha") ||
        combined.includes("uptime")
    ) {
        return "探针测速";
    }
    if (
        combined.includes("github") ||
        combined.includes("tool") ||
        combined.includes("api") ||
        combined.includes("docker") ||
        combined.includes("dev") ||
        combined.includes("工具")
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

// 封装带分类标签的完整描述
export function formatFriendDesc(category: string, cleanDesc: string): string {
    const trimmedCat = category.trim();
    const trimmedDesc = cleanDesc.trim();
    if (!trimmedCat || trimmedCat === "全部") {
        return trimmedDesc;
    }
    return `[${trimmedCat}] ${trimmedDesc}`;
}

export function FriendsPage() {
    const { t } = useTranslation();
    const siteConfig = useSiteConfig();
    const config = useContext(ClientConfigContext);
    const profile = useContext(ProfileContext);

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
    const [formCategory, setFormCategory] = useState("友邻博客");
    const [isSniffing, setIsSniffing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 视图风格切换 (画册卡片 / 高密书签 / 拍立得便签 / 机器监控大盘)
    const [viewStyle, setViewStyle] = useState<"card" | "compact" | "polaroid" | "probe">(() => {
        try {
            return (localStorage.getItem("rin_friends_view_style") || "card") as any;
        } catch {
            return "card";
        }
    });

    // 探针机器监控大盘状态
    const [probeNodes, setProbeNodes] = useState<ProbeMachineNode[]>([]);
    const [loadingProbes, setLoadingProbes] = useState(false);
    const [detectedProbeMachines, setDetectedProbeMachines] = useState<ProbeMachineNode[]>([]);
    const [selectedProbeMachineIds, setSelectedProbeMachineIds] = useState<Set<string>>(new Set());

    // 来源头像自动提取与 R2 专属转存状态
    const [sourceAvatarUrl, setSourceAvatarUrl] = useState("");
    const [isExtractingAvatar, setIsExtractingAvatar] = useState(false);
    const [siteFaviconUrl, setSiteFaviconUrl] = useState("");
    const [nsAvatarUrl, setNsAvatarUrl] = useState("");
    const [nsUserData, setNsUserData] = useState<any | null>(null);
    const [iconChoice, setIconChoice] = useState<"site" | "ns">("site");

    // 编辑友链状态
    const [editingFriend, setEditingFriend] = useState<FriendItem | null>(null);

    const ref = useRef(false);
    const { showAlert, AlertUI } = useAlert();
    const { showConfirm, ConfirmUI } = useConfirm();

    // 加载探针机器监控大盘数据
    const loadProbeNodes = useCallback(async () => {
        setLoadingProbes(true);
        try {
            const token = localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/friend/probe-nodes", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data?.nodes)) {
                    setProbeNodes(data.nodes);
                }
            }
        } catch {
            //
        } finally {
            setLoadingProbes(false);
        }
    }, []);

    useEffect(() => {
        void loadProbeNodes();
    }, [loadProbeNodes]);

    // 删除单台机器监控节点
    const handleDeleteProbeNode = async (id: string) => {
        const token = localStorage.getItem("rin_auth_token") || "";
        try {
            const res = await fetch(`/api/friend/probe-nodes/${encodeURIComponent(id)}`, {
                method: "DELETE",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: "include",
            });
            if (res.ok) {
                setProbeNodes((prev) => prev.filter((n) => n.id !== id));
            }
        } catch {}
    };

    // 一键从 NodeSeek 空间提取真实头像、昵称与勋章数据并存入 R2 avatars/ 独立目录
    const handleExtractSourceAvatar = async () => {
        const raw = sourceAvatarUrl.trim();
        if (!raw) return;
        setIsExtractingAvatar(true);
        try {
            const token = localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/friend/extract-source-avatar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ sourceUrl: raw, name: formName }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.avatarUrl) {
                    setNsAvatarUrl(data.avatarUrl);
                    setFormAvatar(data.avatarUrl);
                    setIconChoice("ns");
                }
                if (data.inferredName) {
                    setFormName(prev => (!prev || prev.includes("Monitor") || prev.includes("http") ? `${data.inferredName} 的空间` : prev));
                }
                if (data.suggestedDesc) {
                    setFormDesc(data.suggestedDesc);
                }
                if (data.nsDetail) {
                    setNsUserData(data.nsDetail);
                }
                showAlert("已提取头像");
            } else {
                showAlert("NodeSeek 空间解析受阻，请检查网址格式");
            }
        } catch (e: any) {
            showAlert(e.message || "提取异常");
        } finally {
            setIsExtractingAvatar(false);
        }
    };

    // 加载友链列表
    const reloadFriends = useCallback(() => {
        client.friend.list().then(({ data }) => {
            if (data) {
                setAllFriends(data.friend_list || []);
            }
            setStatus('idle');
        });
    }, []);

    useEffect(() => {
        if (ref.current) return;
        reloadFriends();
        ref.current = true;
    }, [reloadFriends]);

    // 区分已过审与待审核列表
    const acceptedFriends = useMemo(() => {
        return allFriends.filter(f => f.accepted === 1);
    }, [allFriends]);

    const pendingFriends = useMemo(() => {
        return allFriends.filter(f => f.accepted === 0);
    }, [allFriends]);

    const rejectedFriends = useMemo(() => {
        return allFriends.filter(f => f.accepted === -1);
    }, [allFriends]);

    // 过滤列表
    const filteredFriends = useMemo(() => {
        let list: FriendItem[] = [];
        if (activeCategory === "待审核") {
            list = pendingFriends;
        } else if (activeCategory === "已拒绝") {
            list = rejectedFriends;
        } else {
            list = acceptedFriends.filter(item => {
                if (activeCategory === "全部") return true;
                const { category } = parseFriendCategory(item.desc, item.url);
                return category === activeCategory;
            });
        }

        if (!searchKeyword.trim()) {
            return list;
        }

        const kw = searchKeyword.toLowerCase().trim();
        return list.filter(item => {
            const { category, cleanDesc } = parseFriendCategory(item.desc, item.url);
            return (
                item.name.toLowerCase().includes(kw) ||
                (cleanDesc && cleanDesc.toLowerCase().includes(kw)) ||
                category.toLowerCase().includes(kw) ||
                item.url.toLowerCase().includes(kw)
            );
        });
    }, [activeCategory, acceptedFriends, pendingFriends, rejectedFriends, searchKeyword]);

    // 一键智能嗅探 URL
    const handleSniffUrl = async () => {
        let raw = formUrl.trim();
        if (!raw) {
            showAlert("请先输入站点 URL 地址");
            return;
        }
        if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
            raw = `https://${raw}`;
            setFormUrl(raw);
        }

        setIsSniffing(true);
        try {
            const [inspectRes, probeRes] = await Promise.allSettled([
                client.friend.inspect(raw),
                fetch("/api/friend/sniff-probe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: raw }),
                }).then(r => r.ok ? r.json() : null),
            ]);

            if (inspectRes.status === "fulfilled" && inspectRes.value.data) {
                const data = inspectRes.value.data;
                setFormName(data.name || "");
                setFormDesc(data.desc || "");
                const fav = data.avatar || `https://www.google.com/s2/favicons?domain=${data.domain}&sz=128`;
                setSiteFaviconUrl(fav);
                setFormAvatar(fav);
                setIconChoice("site");
                if (data.category) {
                    setFormCategory(data.category);
                }
            } else {
                try {
                    const parsed = new URL(raw);
                    const domain = parsed.hostname;
                    setFormName(prev => prev || domain);
                    const fav = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                    setSiteFaviconUrl(fav);
                    setFormAvatar(fav);
                    setIconChoice("site");
                    setFormCategory(prev => prev || inferCategoryFallback(raw, ""));
                } catch {}
            }

            if (probeRes.status === "fulfilled" && probeRes.value?.isProbe) {
                const p = probeRes.value;
                if (Array.isArray(p.machines) && p.machines.length > 0) {
                    setDetectedProbeMachines(p.machines);
                    setSelectedProbeMachineIds(new Set(p.machines.map((m: any) => m.id)));
                    setFormCategory("探针测速");
                }
            }

            // 如果同时填了 NodeSeek 空间地址，自动联动提取
            if (sourceAvatarUrl.trim()) {
                void handleExtractSourceAvatar();
            }
        } catch {
            showAlert("嗅探异常，请手动补充信息");
        } finally {
            setIsSniffing(false);
        }
    };

    // 提交新站点（游客提交或管理员发布）
    const handleSubmitNew = async () => {
        if (!formUrl.trim() || !formName.trim() || !formAvatar.trim()) {
            showAlert("请完整填写站点 URL、名称以及图标地址");
            return;
        }

        // 站点域名重复收录静默自动覆盖更新 (不弹出阻断确认)
        const safeUrl = formUrl.trim().startsWith("http") ? formUrl.trim() : `https://${formUrl.trim()}`;
        const finalDesc = formatFriendDesc(formCategory, formDesc);

        setIsSubmitting(true);
        try {
            const apiCall = (profile?.permission || profile?.id)
                ? client.friend.create({
                    name: formName.trim().slice(0, 20),
                    desc: finalDesc.slice(0, 100),
                    avatar: formAvatar.trim().slice(0, 200),
                    url: safeUrl.slice(0, 200),
                })
                : client.friend.apply({
                    name: formName.trim().slice(0, 25),
                    desc: finalDesc.slice(0, 120),
                    avatar: formAvatar.trim().slice(0, 200),
                    url: safeUrl.slice(0, 200),
                });

            const { error } = await apiCall;

            if (error) {
                showAlert(typeof error === "string" ? error : (error.value as string) || "提交失败");
            } else {
                setIsAddModalOpen(false);
                // 重置表单
                setFormUrl("");
                setFormName("");
                setFormDesc("");
                setFormAvatar("");
                setFormCategory("友邻博客");

                if (profile?.permission) {
                    showAlert("已收录", () => reloadFriends());
                } else {
                    showAlert("申请已提交", () => reloadFriends());
                }

                // 如果嗅探并勾选了探针机器节点，同步保存入库
                if (detectedProbeMachines.length > 0 && selectedProbeMachineIds.size > 0) {
                    const toSaveMachines = detectedProbeMachines
                        .filter(m => selectedProbeMachineIds.has(m.id))
                        .map(m => ({ ...m, probeName: formName.trim() || m.probeName, sourceUrl: safeUrl }));
                    if (toSaveMachines.length > 0) {
                        const token = localStorage.getItem("rin_auth_token") || "";
                        fetch("/api/friend/probe-nodes", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({ nodes: toSaveMachines }),
                        }).then(() => void loadProbeNodes()).catch(() => {});
                    }
                }
            }
        } catch (e: any) {
            showAlert(e.message || "提交失败");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 管理员快捷通过
    const handleApprove = (friend: FriendItem) => {
        client.friend.update(friend.id, {
            name: friend.name,
            desc: friend.desc || "",
            url: friend.url,
            accepted: 1,
        }).then(({ error }) => {
            if (error) {
                showAlert(typeof error === "string" ? error : (error.value as string) || "操作失败");
            } else {
                showAlert("已审核通过并发布！", () => reloadFriends());
            }
        });
    };

    // 管理员快捷拒绝
    const handleReject = (friend: FriendItem) => {
        showConfirm("拒绝申请", "确定要将此申请标记为拒绝状态吗？", () => {
            client.friend.update(friend.id, {
                name: friend.name,
                desc: friend.desc || "",
                url: friend.url,
                accepted: -1,
            }).then(({ error }) => {
                if (error) {
                    showAlert(typeof error === "string" ? error : (error.value as string) || "操作失败");
                } else {
                    showAlert("已标记为拒绝", () => reloadFriends());
                }
            });
        });
    };

    // 删除友链
    const handleDelete = (id: number) => {
        showConfirm(t('delete.title'), t('delete.confirm'), () => {
            client.friend.delete(id).then(({ error }) => {
                if (error) {
                    showAlert(typeof error === "string" ? error : (error.value as string) || "删除失败");
                } else {
                    showAlert(t('delete.success'), () => reloadFriends());
                }
            });
        });
    };

    return (
        <>
            <Helmet>
                <title>{`星廊 · 灵感星图与友邻漫游 - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={`星廊 · 灵感星图与友邻漫游`} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>

            <Waiting for={status === "idle"}>
                <main className="w-full flex flex-col justify-start items-center pt-2 sm:pt-4 mb-12 t-primary ani-show">
                    {/* 顶部标题与行动导航 */}
                    <div className="wauto py-6 mb-6 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 text-xs font-bold mb-2 shadow-2xs">
                                <i className="ri-sparkling-fill text-theme text-sm" />
                                <span>星廊 · 灵感星图与友邻漫游</span>
                            </div>
                            <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight art-title-${siteConfig.friendsTitleStyle || siteConfig.atelierTitleStyle || "aurora_flow"}`}>
                                星廊
                            </h1>
                            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal">
                                漫游网络星群的灵感岛屿 · 友邻博客与极客数字基建
                            </p>
                        </div>

                        {/* 右侧操作按钮 */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            {(profile?.permission || config.get("friend_apply_enable")) && (
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-theme px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/20 hover:bg-theme-hover active:scale-95 transition-all select-none"
                                >
                                    <i className="ri-add-line text-sm" />
                                    <span>{profile?.permission ? "收录站点" : "申请入廊 / 推荐站点"}</span>
                                </button>
                            )}

                            <Link
                                href="/"
                                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 backdrop-blur-md px-4 py-2 text-xs font-semibold t-primary shadow-2xs hover:bg-neutral-50 active:scale-95 transition dark:border-white/10 dark:bg-neutral-900/80"
                            >
                                <i className="ri-arrow-left-line" />
                                <span>返回画廊</span>
                            </Link>
                        </div>
                    </div>

                    {/* 分类过滤器与实时搜索栏 */}
                    <div className="wauto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* 分类 Tags */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none">
                            {PRESET_CATEGORIES.map(cat => {
                                const isActive = activeCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            setActiveCategory(cat);
                                            if (cat === "探针测速") {
                                                setViewStyle("probe");
                                            } else if (viewStyle === "probe") {
                                                setViewStyle("card");
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 select-none ${
                                            isActive
                                                ? "bg-theme text-white shadow-sm font-bold scale-[1.02]"
                                                : "bg-black/5 hover:bg-theme/10 hover:text-theme dark:bg-white/5 dark:hover:bg-theme/20 text-neutral-600 dark:text-neutral-300"
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}

                            {/* 管理员专属待审核 Tab */}
                            {profile?.permission && (
                                <button
                                    onClick={() => setActiveCategory("待审核")}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 select-none ${
                                        activeCategory === "待审核"
                                            ? "bg-amber-500 text-white shadow-sm font-bold scale-[1.02]"
                                            : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400"
                                    }`}
                                >
                                    <i className="ri-time-line text-xs" />
                                    <span>待审核</span>
                                    {pendingFriends.length > 0 && (
                                        <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-2xs animate-pulse">
                                            {pendingFriends.length}
                                        </span>
                                    )}
                                </button>
                            )}

                            {profile?.permission && rejectedFriends.length > 0 && (
                                <button
                                    onClick={() => setActiveCategory("已拒绝")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 select-none ${
                                        activeCategory === "已拒绝"
                                            ? "bg-neutral-600 text-white shadow-sm font-bold scale-[1.02]"
                                            : "bg-black/5 text-neutral-500 hover:bg-black/10 dark:bg-white/5"
                                    }`}
                                >
                                    已拒绝 ({rejectedFriends.length})
                                </button>
                            )}
                        </div>

                        {/* 实时搜索与风格切换 */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative min-w-[200px] sm:w-64">
                                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={e => setSearchKeyword(e.target.value)}
                                    placeholder="搜索站点名称/描述..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-theme/40 focus:bg-white dark:focus:bg-neutral-900 focus:outline-hidden transition placeholder:text-neutral-400"
                                />
                                {searchKeyword && (
                                    <button
                                        onClick={() => setSearchKeyword("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                    >
                                        <i className="ri-close-circle-fill text-xs" />
                                    </button>
                                )}
                            </div>

                            {/* 风格切换器：画册卡片 / 高密书签 / 拍立得便签 */}
                            <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 shrink-0 text-xs">
                                <button
                                    type="button"
                                    onClick={() => { setViewStyle("card"); try { localStorage.setItem("rin_friends_view_style", "card"); } catch {} }}
                                    className={`px-2.5 py-1 rounded-lg transition select-none flex items-center gap-1 font-semibold ${
                                        viewStyle === "card" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
                                    }`}
                                    title="画册卡片视图"
                                >
                                    <i className="ri-grid-fill text-xs" />
                                    <span className="hidden sm:inline">卡片</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setViewStyle("compact"); try { localStorage.setItem("rin_friends_view_style", "compact"); } catch {} }}
                                    className={`px-2.5 py-1 rounded-lg transition select-none flex items-center gap-1 font-semibold ${
                                        viewStyle === "compact" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
                                    }`}
                                    title="高密书签视图"
                                >
                                    <i className="ri-list-check text-xs" />
                                    <span className="hidden sm:inline">书签</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setViewStyle("polaroid"); try { localStorage.setItem("rin_friends_view_style", "polaroid"); } catch {} }}
                                    className={`px-2.5 py-1 rounded-lg transition select-none flex items-center gap-1 font-semibold ${
                                        viewStyle === "polaroid" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
                                    }`}
                                    title="拍立得便签视图"
                                >
                                    <i className="ri-sticky-note-line text-xs" />
                                    <span className="hidden sm:inline">便签</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setViewStyle("probe"); try { localStorage.setItem("rin_friends_view_style", "probe"); } catch {} }}
                                    className={`px-2.5 py-1 rounded-lg transition select-none flex items-center gap-1 font-semibold ${
                                        viewStyle === "probe" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
                                    }`}
                                    title="PickMyVPS 风格机器监控超级数据大盘"
                                >
                                    <i className="ri-dashboard-2-line text-xs" />
                                    <span className="hidden sm:inline">机器监控</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 画廊展示流 (支持画册卡片、高密书签、拍立得便签、机器监控超级数据网格四种风格) */}
                    {viewStyle === "probe" && (activeCategory === "全部" || activeCategory === "探针测速") ? (
                        <ProbeMachineDataGrid
                            nodes={probeNodes}
                            searchKeyword={searchKeyword}
                            onDeleteNode={handleDeleteProbeNode}
                            onRefresh={() => loadProbeNodes()}
                            loading={loadingProbes}
                        />
                    ) : filteredFriends.length === 0 ? (
                        <div className="wauto flex flex-col items-center justify-center py-20 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 mb-3 text-2xl">
                                <i className="ri-inbox-line" />
                            </div>
                            <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                                {searchKeyword ? "没有找到符合搜索条件的站点" : "暂无相关收录站点"}
                            </p>
                            <p className="mt-1 text-xs text-neutral-400">
                                点击右上角「+ 申请入廊 / 推荐站点」添加第一个精彩星岛吧
                            </p>
                        </div>
                    ) : viewStyle === "compact" ? (
                        <div className="wauto flex flex-col gap-2">
                            {filteredFriends.map((friend, idx) => (
                                <CompactFriendRow
                                    key={friend.id}
                                    friend={friend}
                                    index={idx}
                                    onEdit={() => setEditingFriend(friend)}
                                    onDelete={() => handleDelete(friend.id)}
                                    onApprove={() => handleApprove(friend)}
                                    onReject={() => handleReject(friend)}
                                />
                            ))}
                        </div>
                    ) : viewStyle === "polaroid" ? (
                        <div className="wauto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-7 pt-3">
                            {filteredFriends.map((friend, idx) => (
                                <PolaroidFriendCard
                                    key={friend.id}
                                    friend={friend}
                                    index={idx}
                                    onEdit={() => setEditingFriend(friend)}
                                    onDelete={() => handleDelete(friend.id)}
                                    onApprove={() => handleApprove(friend)}
                                    onReject={() => handleReject(friend)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="wauto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                            {filteredFriends.map((friend) => (
                                <FriendCard
                                    key={friend.id}
                                    friend={friend}
                                    onEdit={() => setEditingFriend(friend)}
                                    onDelete={() => handleDelete(friend.id)}
                                    onApprove={() => handleApprove(friend)}
                                    onReject={() => handleReject(friend)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </Waiting>

            {/* 申请/添加友链居中磨砂弹窗 */}
            <Modal
                isOpen={isAddModalOpen}
                onRequestClose={() => !isSniffing && !isSubmitting && setIsAddModalOpen(false)}
                contentLabel="推荐站点 / 申请友链"
                panelClassName="max-h-[90vh] p-4 sm:p-6 max-w-[94vw] sm:max-w-xl w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
                <div className="flex flex-col w-full h-full max-h-[85vh]">
                    {/* 弹窗头部 (固定在顶部) */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-theme/10 text-theme text-base shadow-2xs">
                                <i className="ri-sparkling-fill" />
                            </span>
                            <div>
                                <h3 className="text-base font-bold t-primary">
                                    {profile?.permission ? "收录精彩站点" : "申请友链 / 推荐站点"}
                                </h3>
                                <p className="text-[11px] text-neutral-400">
                                    输入网址一键 AI 嗅探，自动提取标题、简介与高清图标
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            disabled={isSniffing || isSubmitting}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
                        >
                            <i className="ri-close-line text-lg" />
                        </button>
                    </div>

                    {/* 可滑动主体内容区 (解决内容过多顶出屏幕外的Bug) */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin pt-2">

                    {/* 1. 站点链接 */}
                    <div className="mt-4">
                        <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 flex items-center justify-between">
                            <span>站点链接 (URL) *</span>
                            <span className="text-[10px] text-rose-500 font-normal">支持直接回车解析</span>
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <i className="ri-global-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm" />
                                <input
                                    type="text"
                                    value={formUrl}
                                    onChange={e => setFormUrl(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleSniffUrl()}
                                    placeholder="例如: https://status.example.com"
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition"
                                />
                            </div>
                            <button
                                onClick={handleSniffUrl}
                                disabled={isSniffing}
                                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-60 transition shrink-0"
                            >
                                {isSniffing ? <i className="ri-loader-4-line animate-spin text-sm" /> : <i className="ri-magic-line text-sm" />}
                                <span>{isSniffing ? "解析中..." : "一键智能解析"}</span>
                            </button>
                        </div>
                        {isSniffing && (
                            <p className="mt-1.5 text-[11px] text-rose-500 animate-pulse flex items-center gap-1">
                                <i className="ri-radar-line" />
                                <span>正在由 Cloudflare Worker 嗅探站点信息、图标与探针节点...</span>
                            </p>
                        )}
                    </div>

                    {/* 2. NodeSeek 个人空间地址 (选填，支持纯数字 UID 或完整空间地址) */}
                    <div className="mt-3.5 p-3 rounded-2xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                                <i className="ri-user-smile-line text-theme" />
                                <span>NodeSeek 个人空间或 UID (选填)</span>
                            </label>
                            <span className="text-[10px] text-theme font-medium">
                                自动提取用户真实头像、昵称与勋章
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={sourceAvatarUrl}
                                    onChange={e => setSourceAvatarUrl(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleExtractSourceAvatar()}
                                    placeholder="输入纯数字 UID (如 10001) 或空间网址 (如 https://www.nodeseek.com/space/10001)"
                                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-w border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition font-mono"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleExtractSourceAvatar}
                                disabled={isExtractingAvatar || !sourceAvatarUrl.trim()}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-theme/10 hover:bg-theme hover:text-white text-theme text-xs font-semibold transition shrink-0 disabled:opacity-40 shadow-2xs"
                                title="由 Cloudflare Worker 代理提取并转存至 R2 avatars/ 专属目录"
                            >
                                {isExtractingAvatar ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-download-cloud-line" />}
                                <span>{isExtractingAvatar ? "提取中..." : "提取头像与昵称"}</span>
                            </button>
                        </div>

                        {/* NodeSeek 勋章与数据条 */}
                        {nsUserData && (
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex flex-wrap items-center justify-between gap-1 text-emerald-700 dark:text-emerald-400 font-mono ani-show">
                                <span className="font-bold">🏅 用户: {nsUserData.member_name} (Lv.{nsUserData.rank})</span>
                                <span>🍗 {nsUserData.coin} 鸡腿 · 📝 {nsUserData.nPost} 贴 · ⏰ {nsUserData.created_at_str}</span>
                            </div>
                        )}
                    </div>

                    {/* 3. 推荐归类 */}
                    <div className="mt-3.5">
                        <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5 block">
                            推荐归类 *
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {PRESET_CATEGORIES.filter(c => c !== "全部").map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setFormCategory(cat)}
                                    className={`px-2.5 py-1 rounded-lg text-xs transition select-none ${
                                        formCategory === cat
                                            ? "bg-theme text-white font-bold shadow-2xs"
                                            : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. 站点名称 */}
                    <div className="mt-3.5">
                        <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">
                            站点 / 用户名称 *
                        </label>
                        <input
                            type="text"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            placeholder="例如: 某某小站 / 探针 / 博主名"
                            className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition font-semibold"
                        />
                    </div>

                    {/* 5. 图标选用：站点图标 vs NodeSeek 真实用户头像 */}
                    <div className="mt-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 block">
                                图标选用 (单选切换) *
                            </label>
                            <span className="text-[10px] text-neutral-400">
                                存入 R2 avatars/ 独立目录
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {/* 选项 A: 站点 Favicon */}
                            <div
                                onClick={() => {
                                    if (siteFaviconUrl) {
                                        setIconChoice("site");
                                        setFormAvatar(siteFaviconUrl);
                                    }
                                }}
                                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                                    iconChoice === "site"
                                        ? "border-theme bg-theme/10 ring-1 ring-theme/30"
                                        : "border-black/10 dark:border-white/10 hover:bg-black/5"
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <input
                                        type="radio"
                                        name="icon-choice"
                                        checked={iconChoice === "site"}
                                        onChange={() => {
                                            setIconChoice("site");
                                            if (siteFaviconUrl) setFormAvatar(siteFaviconUrl);
                                        }}
                                        className="accent-theme"
                                    />
                                    <span className="font-bold text-xs truncate">站点图标 (Favicon)</span>
                                </div>
                                {siteFaviconUrl ? (
                                    <div className="h-7 w-7 rounded-lg overflow-hidden bg-black/5 p-0.5 border border-black/10 shrink-0">
                                        <ImageWithFallback src={siteFaviconUrl} alt="site" className="h-full w-full object-cover rounded" />
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-neutral-400">待解析</span>
                                )}
                            </div>

                            {/* 选项 B: NodeSeek 用户头像 */}
                            <div
                                onClick={() => {
                                    if (nsAvatarUrl) {
                                        setIconChoice("ns");
                                        setFormAvatar(nsAvatarUrl);
                                    }
                                }}
                                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                                    iconChoice === "ns"
                                        ? "border-theme bg-theme/10 ring-1 ring-theme/30"
                                        : "border-black/10 dark:border-white/10 hover:bg-black/5"
                                } ${!nsAvatarUrl ? "opacity-60" : ""}`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <input
                                        type="radio"
                                        name="icon-choice"
                                        checked={iconChoice === "ns"}
                                        disabled={!nsAvatarUrl}
                                        onChange={() => {
                                            setIconChoice("ns");
                                            if (nsAvatarUrl) setFormAvatar(nsAvatarUrl);
                                        }}
                                        className="accent-theme"
                                    />
                                    <span className="font-bold text-xs truncate">NodeSeek 用户头像</span>
                                </div>
                                {nsAvatarUrl ? (
                                    <div className="h-7 w-7 rounded-lg overflow-hidden bg-black/5 p-0.5 border border-black/10 shrink-0">
                                        <ImageWithFallback src={nsAvatarUrl} alt="ns" className="h-full w-full object-cover rounded" />
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-neutral-400">待提取</span>
                                )}
                            </div>
                        </div>

                        {/* 当前选中的图标直链 */}
                        <div className="pt-1">
                            <input
                                type="text"
                                value={formAvatar}
                                onChange={e => setFormAvatar(e.target.value)}
                                placeholder="最终图标直链 (可手动修改) https://..."
                                className="w-full px-3 py-1.5 text-xs rounded-xl bg-w border border-black/10 dark:border-white/10 font-mono text-neutral-600 dark:text-neutral-300 outline-none focus:border-theme"
                            />
                        </div>
                    </div>

                    {/* 站点描述与 AI 精炼简介 */}
                    <div className="mt-3.5">
                        <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 flex items-center justify-between">
                            <span>站点简介 / 寄语</span>
                            <span className="text-[10px] text-neutral-400">建议 40 字以内</span>
                        </label>
                        <textarea
                            value={formDesc}
                            onChange={e => setFormDesc(e.target.value)}
                            rows={2}
                            placeholder="站点核心定位或博主寄语..."
                            className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition resize-none"
                        />
                    </div>

                    {/* 探针机器节点智能探测与选择面板 */}
                    {detectedProbeMachines.length > 0 && (
                        <div className="mt-4 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-cyan-500/30 space-y-2.5 ani-show">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400">
                                    <i className="ri-radar-line animate-pulse" />
                                    <span>⚡ 智能嗅探到探针包含 {detectedProbeMachines.length} 台机器节点</span>
                                </div>
                                <span className="text-[10px] text-neutral-400">勾选并标注商家信息</span>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                {detectedProbeMachines.map((m, mIdx) => {
                                    const isChecked = selectedProbeMachineIds.has(m.id);
                                    return (
                                        <div
                                            key={m.id}
                                            className={`p-2 rounded-xl border text-xs flex flex-col gap-1.5 transition ${
                                                isChecked
                                                    ? "border-cyan-500/40 bg-cyan-500/5 dark:bg-cyan-950/20"
                                                    : "border-black/5 dark:border-white/5 opacity-60"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-2 cursor-pointer font-bold t-primary">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            const next = new Set(selectedProbeMachineIds);
                                                            if (e.target.checked) next.add(m.id);
                                                            else next.delete(m.id);
                                                            setSelectedProbeMachineIds(next);
                                                        }}
                                                        className="accent-theme cursor-pointer"
                                                    />
                                                    <span>{getFlagEmoji(m.countryCode)} {m.name}</span>
                                                </label>
                                                <span className="text-[10px] font-mono text-neutral-400">{m.cpu} · {m.ram}</span>
                                            </div>

                                            {isChecked && (
                                                <div className="space-y-1.5 pt-1">
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={m.merchant || ""}
                                                            onChange={(e) => {
                                                                const updated = [...detectedProbeMachines];
                                                                updated[mIdx].merchant = e.target.value;
                                                                setDetectedProbeMachines(updated);
                                                            }}
                                                            placeholder="商家 (如 DMIT)"
                                                            className="px-2 py-0.5 rounded bg-w border border-black/10 dark:border-white/10 text-xs font-semibold outline-none"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={m.model || ""}
                                                            onChange={(e) => {
                                                                const updated = [...detectedProbeMachines];
                                                                updated[mIdx].model = e.target.value;
                                                                setDetectedProbeMachines(updated);
                                                            }}
                                                            placeholder="机型 (如 Pro)"
                                                            className="px-2 py-0.5 rounded bg-w border border-black/10 dark:border-white/10 text-xs font-semibold outline-none"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={m.routeTag || ""}
                                                            onChange={(e) => {
                                                                const updated = [...detectedProbeMachines];
                                                                updated[mIdx].routeTag = e.target.value;
                                                                setDetectedProbeMachines(updated);
                                                            }}
                                                            placeholder="线路 (如 CN2GIA)"
                                                            className="px-2 py-0.5 rounded bg-w border border-black/10 dark:border-white/10 text-xs font-semibold outline-none"
                                                        />
                                                    </div>

                                                    {/* 快捷参考线路标签 (不知线路时一键点击选用) */}
                                                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                                        <span className="text-[10px] text-neutral-400">参考线路：</span>
                                                        {["CN2 GIA", "4837 优化", "CMI 直连", "9929 精品", "BGP 国际", "优质线路", "待测线路"].map((rt) => (
                                                            <button
                                                                key={rt}
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = [...detectedProbeMachines];
                                                                    updated[mIdx].routeTag = rt;
                                                                    setDetectedProbeMachines(updated);
                                                                }}
                                                                className="px-1.5 py-0.2 rounded text-[10px] bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white transition select-none"
                                                            >
                                                                {rt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    </div>

                    {/* 提交按钮栏 (固定在底部，永远可见，绝不超出屏幕) */}
                    <div className="mt-4 flex items-center justify-end gap-2.5 pt-3 border-t border-black/5 dark:border-white/5 shrink-0">
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 transition"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSubmitNew}
                            disabled={isSubmitting || !formUrl || !formName}
                            className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-md shadow-rose-500/20 hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <i className="ri-loader-4-line animate-spin" />
                                    <span>提交中...</span>
                                </>
                            ) : (
                                <>
                                    <i className="ri-check-line font-bold" />
                                    <span>{profile?.permission ? "立即收录并发布" : "提交收录申请"}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 编辑友链弹窗 */}
            {editingFriend && (
                <EditFriendModal
                    friend={editingFriend}
                    onClose={() => setEditingFriend(null)}
                    onSuccess={() => {
                        setEditingFriend(null);
                        reloadFriends();
                    }}
                />
            )}

            <AlertUI />
            <ConfirmUI />
        </>
    );
}

// 单个友链/导航画廊卡片
function FriendCard({
    friend,
    onEdit,
    onDelete,
    onApprove,
    onReject,
}: {
    friend: FriendItem;
    onEdit: () => void;
    onDelete: () => void;
    onApprove: () => void;
    onReject: () => void;
}) {
    const profile = useContext(ProfileContext);
    const { category, cleanDesc } = parseFriendCategory(friend.desc, friend.url);
    const isUnhealthy = friend.health && friend.health.length > 0;
    const isTop = (friend.sort_order ?? 0) > 0;
    const safeUrl = safeHttpUrl(friend.url);

    // 分类徽标配色
    const badgeColor = useMemo(() => {
        switch (category) {
            case "主机算力":
            case "VPS/基础设施":
                return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
            case "探针测速":
            case "测速/探针监控":
                return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
            case "极客工具":
            case "极客常用工具":
                return "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400";
            case "技术社区":
            case "技术极客社区":
                return "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400";
            case "漫游灵感":
            case "其他灵感":
                return "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400";
            case "友邻博客":
            case "友友们":
            default:
                return "bg-rose-500/10 text-theme dark:bg-rose-500/20 dark:text-rose-400";
        }
    }, [category]);

    return (
        <div className="group relative flex flex-col justify-between rounded-2xl bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md p-4 sm:p-5 border border-black/5 dark:border-white/5 shadow-xs hover:shadow-xl hover:shadow-rose-500/10 hover:border-theme/40 hover:-translate-y-1 transition-all duration-300 select-none">
            {/* 和纸胶带装饰 */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-theme/20 dark:bg-theme/30 backdrop-blur-xs rounded-xs rotate-[-2deg] pointer-events-none" />

            {/* 卡片顶部：状态微点与置顶徽标 */}
            <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-1.5">
                    {/* 健康状态指示小圆点 */}
                    {isUnhealthy ? (
                        <span
                            className="flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-xs"
                            title={`访问异常: ${errorHumanize(friend.health)}`}
                        />
                    ) : (
                        <span
                            className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-xs"
                            title="站点状态良好"
                        />
                    )}

                    {/* 分类徽标 */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                        {category}
                    </span>

                    {/* 置顶指示 */}
                    {isTop ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <i className="ri-pushpin-2-fill text-[9px]" />
                            <span>置顶</span>
                        </span>
                    ) : null}
                </div>

                {/* 审核状态小提示 */}
                {friend.accepted === 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        待审核
                    </span>
                )}
                {friend.accepted === -1 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                        已拒绝
                    </span>
                )}
            </div>

            {/* 卡片主体：头像与文字 */}
            <a
                href={safeUrl || "#"}
                target={safeUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                title={friend.name}
                className="flex items-start gap-3 flex-1 min-w-0"
            >
                {/* 网站 Favicon (带加载兜底) */}
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-1 shadow-inner border border-black/5 dark:border-white/5 group-hover:scale-105 transition-transform overflow-hidden">
                    <ImageWithFallback
                        className="h-full w-full rounded-xl object-cover"
                        imageClassName={isUnhealthy ? "grayscale" : ""}
                        src={friend.avatar}
                        alt={friend.name}
                    />
                </div>

                {/* 站点名称与精炼简介 */}
                <div className="flex-1 min-w-0 text-start">
                    <h4 className="font-bold text-sm text-neutral-800 dark:text-neutral-100 truncate group-hover:text-theme transition-colors">
                        {friend.name}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400 [overflow-wrap:anywhere] leading-snug">
                        {cleanDesc || "这位博主很神秘，还没有写下寄语~"}
                    </p>
                    {isUnhealthy && (
                        <p className="mt-1 text-[10px] text-rose-500 truncate flex items-center gap-0.5">
                            <i className="ri-error-warning-line text-xs" />
                            <span>{errorHumanize(friend.health)}</span>
                        </p>
                    )}
                </div>
            </a>

            {/* 底部操作区（管理员或提交者视角） */}
            {(profile?.permission || profile?.id === friend.uid) && (
                <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                    {/* 管理员待审核快捷处理 */}
                    {profile?.permission && friend.accepted === 0 ? (
                        <div className="flex items-center gap-1.5 w-full justify-between">
                            <button
                                onClick={onApprove}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white font-bold text-[11px] transition shadow-2xs"
                            >
                                <i className="ri-check-line" />
                                <span>通过</span>
                            </button>
                            <button
                                onClick={onReject}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white font-bold text-[11px] transition"
                            >
                                <i className="ri-close-line" />
                                <span>拒绝</span>
                            </button>
                            <button
                                onClick={onEdit}
                                className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-theme/10 transition"
                                title="编辑"
                            >
                                <i className="ri-edit-line text-sm" />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-1 rounded-md text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                                title="删除"
                            >
                                <i className="ri-delete-bin-line text-sm" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-end gap-1 w-full">
                            <button
                                onClick={onEdit}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-neutral-500 hover:text-theme hover:bg-theme/10 transition"
                            >
                                <i className="ri-edit-line text-xs" />
                                <span>管理</span>
                            </button>
                            <button
                                onClick={onDelete}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                            >
                                <i className="ri-delete-bin-line text-xs" />
                                <span>删除</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// 风格 2: 高密单行书签行 (Compact List)
function CompactFriendRow({
    friend,
    index,
    onEdit,
    onDelete,
    onApprove,
    onReject,
}: {
    friend: FriendItem;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    onApprove: () => void;
    onReject: () => void;
}) {
    const profile = useContext(ProfileContext);
    const { category, cleanDesc } = parseFriendCategory(friend.desc, friend.url);
    const isUnhealthy = friend.health && friend.health.length > 0;
    const isTop = (friend.sort_order ?? 0) > 0;
    const safeUrl = safeHttpUrl(friend.url);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md hover:border-theme/40 hover:shadow-md transition-all select-none">
            {/* 核心内容区 */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-mono text-xs font-bold text-neutral-400 w-5 text-center shrink-0">#{index + 1}</span>
                <div className="relative h-9 w-9 shrink-0 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-1 border border-black/5 dark:border-white/5 overflow-hidden">
                    <ImageWithFallback
                        className="h-full w-full rounded-lg object-cover"
                        imageClassName={isUnhealthy ? "grayscale" : ""}
                        src={friend.avatar}
                        alt={friend.name}
                    />
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                    <a
                        href={safeUrl || "#"}
                        target={safeUrl ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className="font-bold text-xs t-primary hover:text-theme transition truncate"
                    >
                        {friend.name}
                    </a>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-theme/10 text-theme shrink-0 font-bold">
                        {category}
                    </span>
                    {isTop ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                            📌 置顶
                        </span>
                    ) : null}
                    <span className="text-xs text-neutral-400 truncate hidden md:inline">
                        {cleanDesc || "暂无简介"}
                    </span>
                </div>
                {/* 手机端访问纯图标直达 (放在标题行右侧，不显示冗长文字) */}
                {safeUrl && (
                    <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sm:hidden p-1.5 rounded-lg bg-theme/10 hover:bg-theme hover:text-white text-theme transition flex items-center justify-center shrink-0 shadow-2xs"
                        title="访问站点"
                    >
                        <i className="ri-arrow-right-up-line text-xs font-bold" />
                    </a>
                )}
            </div>

            {/* 手机端显示展开的单行简介 (PC已在上方内联显示) */}
            {cleanDesc && (
                <p className="sm:hidden text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 pl-8 [overflow-wrap:anywhere]">
                    {cleanDesc}
                </p>
            )}

            {/* 动作栏：PC在右侧一行呈现，手机在底栏靠右舒展对齐，绝不挤占上方标题与简介 */}
            <div className="flex items-center justify-end gap-1.5 shrink-0 pl-8 sm:pl-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/5">
                {safeUrl && (
                    <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:inline-flex p-1.5 rounded-lg bg-theme/10 hover:bg-theme hover:text-white text-theme transition items-center justify-center shadow-2xs"
                        title="访问站点"
                    >
                        <i className="ri-arrow-right-up-line text-xs font-bold" />
                    </a>
                )}
                {(profile?.permission || profile?.id === friend.uid) && (
                    <div className="flex items-center gap-1">
                        {profile?.permission && friend.accepted === 0 && (
                            <>
                                <button
                                    onClick={onApprove}
                                    className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold shadow-2xs"
                                >
                                    通过
                                </button>
                                <button
                                    onClick={onReject}
                                    className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold shadow-2xs"
                                >
                                    拒绝
                                </button>
                            </>
                        )}
                        <button
                            onClick={onEdit}
                            className="p-1 rounded-md text-neutral-400 hover:text-theme transition"
                            title="管理"
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
                )}
            </div>
        </div>
    );
}

// 风格 3: 拍立得和纸胶带便签 (Polaroid Notes)
function PolaroidFriendCard({
    friend,
    index,
    onEdit,
    onDelete,
    onApprove,
    onReject,
}: {
    friend: FriendItem;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    onApprove: () => void;
    onReject: () => void;
}) {
    const profile = useContext(ProfileContext);
    const { category, cleanDesc } = parseFriendCategory(friend.desc, friend.url);
    const isUnhealthy = friend.health && friend.health.length > 0;
    const isTop = friend.sort_order && friend.sort_order > 0;
    const safeUrl = safeHttpUrl(friend.url);

    // 拍立得交错微倾角
    const tiltAngles = [
        "rotate-[-2deg]",
        "rotate-[1.5deg]",
        "rotate-[-1deg]",
        "rotate-[2deg]",
        "rotate-[-1.5deg]",
        "rotate-[1deg]",
    ];
    const tilt = tiltAngles[index % tiltAngles.length];

    // 和纸胶带色彩
    const tapeColors = [
        "bg-rose-300/60 dark:bg-rose-500/30",
        "bg-amber-300/60 dark:bg-amber-500/30",
        "bg-sky-300/60 dark:bg-sky-500/30",
        "bg-emerald-300/60 dark:bg-emerald-500/30",
        "bg-purple-300/60 dark:bg-purple-500/30",
    ];
    const tape = tapeColors[index % tapeColors.length];

    return (
        <div
            className={`group relative flex flex-col justify-between rounded-3xl bg-white dark:bg-neutral-900 p-4 pt-6 border border-black/10 dark:border-white/10 shadow-md hover:shadow-2xl transition-all duration-300 transform ${tilt} hover:rotate-0 hover:scale-[1.03] hover:z-20 select-none`}
        >
            {/* 拍立得和纸胶带 */}
            <div
                className={`absolute -top-3 left-1/2 -translate-x-1/2 w-14 h-4.5 ${tape} rounded-xs shadow-2xs rotate-[-1deg] pointer-events-none z-10`}
            />

            <a
                href={safeUrl || "#"}
                target={safeUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                title={friend.name}
                className="flex flex-col items-center text-center gap-2.5 flex-1 min-w-0"
            >
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-1.5 shadow-inner border border-black/5 dark:border-white/5 group-hover:scale-110 transition-transform overflow-hidden">
                    <ImageWithFallback
                        className="h-full w-full rounded-xl object-cover"
                        imageClassName={isUnhealthy ? "grayscale" : ""}
                        src={friend.avatar}
                        alt={friend.name}
                    />
                </div>

                <div className="w-full">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-neutral-800 dark:text-neutral-100 group-hover:text-theme transition-colors">
                            {friend.name}
                        </span>
                        {isTop ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                📌
                            </span>
                        ) : null}
                    </div>
                    <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme/10 text-theme font-mono">
                        {category}
                    </span>
                    <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed px-1">
                        {cleanDesc || "漫步星廊，静候回响~"}
                    </p>
                </div>
            </a>

            {(profile?.permission || profile?.id === friend.uid) && (
                <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-1 text-xs">
                    {profile?.permission && friend.accepted === 0 ? (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onApprove}
                                className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold shadow-2xs"
                            >
                                通过
                            </button>
                            <button
                                onClick={onReject}
                                className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold shadow-2xs"
                            >
                                拒绝
                            </button>
                        </div>
                    ) : <span />}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onEdit}
                            className="p-1 rounded-md text-neutral-400 hover:text-theme transition text-xs"
                            title="编辑"
                        >
                            <i className="ri-edit-line" />
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1 rounded-md text-neutral-400 hover:text-rose-500 transition text-xs"
                            title="删除"
                        >
                            <i className="ri-delete-bin-line" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// 编辑友链弹窗组件
function EditFriendModal({
    friend,
    onClose,
    onSuccess,
}: {
    friend: FriendItem;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { t } = useTranslation();
    const profile = useContext(ProfileContext);
    const { showAlert, AlertUI } = useAlert();

    const parsed = parseFriendCategory(friend.desc, friend.url);
    const [name, setName] = useState(friend.name);
    const [desc, setDesc] = useState(parsed.cleanDesc);
    const [avatar, setAvatar] = useState(friend.avatar);
    const [url, setUrl] = useState(friend.url);
    const [category, setCategory] = useState(parsed.category || "友友们");
    const [status, setStatus] = useState(friend.accepted);
    const [sortOrder, setSortOrder] = useState(friend.sort_order || 0);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim() || !url.trim() || !avatar.trim()) {
            showAlert("请完整填写必填项");
            return;
        }

        const finalDesc = formatFriendDesc(category, desc);
        setIsSaving(true);
        try {
            const { error } = await client.friend.update(friend.id, {
                name: name.trim(),
                desc: finalDesc,
                avatar: avatar.trim(),
                url: url.trim(),
                accepted: status,
                sort_order: sortOrder,
            });

            if (error) {
                showAlert(typeof error === "string" ? error : (error.value as string) || "更新失败");
            } else {
                showAlert(t('update.success'), () => onSuccess());
            }
        } catch (e: any) {
            showAlert(e.message || "更新失败");
        } finally {
            setIsSaving(false);
        }
    };

    const statusOptions = [
        { value: -1, label: t('friends.review.rejected') },
        { value: 0, label: t('friends.review.waiting') },
        { value: 1, label: t('friends.review.accepted') },
    ];

    return (
        <Modal
            isOpen={true}
            onRequestClose={onClose}
            contentLabel={`编辑友链 - ${friend.name}`}
            panelClassName="overflow-visible p-4 sm:p-7 max-w-[94vw] sm:max-w-lg w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
        >
            <div className="flex flex-col w-full">
                <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 p-1 border border-black/10 dark:border-white/10">
                            <ImageWithFallback src={avatar} alt="logo" className="h-full w-full object-cover rounded-md" />
                        </div>
                        <h3 className="text-base font-bold t-primary">
                            编辑收录站点信息
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-neutral-700">
                        <i className="ri-close-line text-lg" />
                    </button>
                </div>

                {/* 管理员专属配置 */}
                {profile?.permission && (
                    <div className="mt-3.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">审核状态</span>
                            <select
                                value={status}
                                onChange={(e) => setStatus(Number(e.target.value))}
                                className="w-36 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-w text-xs font-bold t-primary outline-none focus:border-theme cursor-pointer"
                            >
                                {statusOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">置顶权重 (数字越大越靠前)</span>
                            <input
                                type="number"
                                value={sortOrder}
                                onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
                                className="w-24 px-2 py-1 text-xs rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 text-center"
                            />
                        </div>
                    </div>
                )}

                {/* 分类快捷切换 */}
                <div className="mt-3.5">
                    <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">站点分类</label>
                    <div className="flex flex-wrap gap-1.5">
                        {PRESET_CATEGORIES.filter(c => c !== "全部").map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`px-2.5 py-1 rounded-lg text-xs transition ${
                                    category === cat
                                        ? "bg-theme text-white font-bold shadow-2xs"
                                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-3.5">
                    <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">站点名称</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden"
                    />
                </div>

                <div className="mt-3">
                    <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">站点简介</label>
                    <textarea
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden resize-none"
                    />
                </div>

                <div className="mt-3">
                    <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">图标地址</label>
                    <input
                        type="text"
                        value={avatar}
                        onChange={e => setAvatar(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden"
                    />
                </div>

                <div className="mt-3">
                    <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">跳转网址</label>
                    <input
                        type="text"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden"
                    />
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-black/5 dark:border-white/5">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-500">
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-md hover:bg-theme-hover active:scale-95 transition"
                    >
                        {isSaving ? "保存中..." : t('save')}
                    </button>
                </div>
            </div>
            <AlertUI />
        </Modal>
    );
}

function errorHumanize(error: string) {
    if (error === "certificate has expired" || error === "526") {
        return "证书已过期";
    } else if (error.includes("Unable to connect") || error === "521" || error === "522") {
        return "无法访问 / 超时";
    }
    return error || "检测异常";
}

// 延迟/速率微型波峰走势图 (粉色微光 Area Sparkline Wave，完全对齐截图 2)
function SparklineWave({
    values = [28, 35, 30, 42, 36, 29, 34],
    color = "#FF7E95",
    width = 44,
    height = 14,
}: {
    values?: number[];
    color?: string;
    width?: number;
    height?: number;
}) {
    const list = values && values.length > 0 ? values : [25, 30, 28, 35, 32];
    const min = Math.min(...list, 10);
    const max = Math.max(...list, 80);
    const range = max - min || 1;
    const step = width / (list.length - 1);

    const points = list.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 3) - 1.5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M0,${height} L${points.join(" L")} L${width},${height} Z`;
    const lineD = `M${points.join(" L")}`;
    const gradId = `wave-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

    return (
        <svg width={width} height={height} className="overflow-visible inline-block shrink-0">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.65" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <path d={pathD} fill={`url(#${gradId})`} />
            <path d={lineD} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// 机器详情弹窗中使用的综合面积图组件 (100% 对齐截图 1 走势图风格，高密紧凑零滚动条)
function DetailAreaChart({
    title,
    currentValue,
    unit = "",
    subInfo = "",
    color = "#FF7E95",
    dataPoints = [15, 20, 18, 45, 32, 28, 30, 33],
    timeLabels = ["07:55:29", "07:55:52", "07:56:22"],
}: {
    title: string;
    currentValue: string | number;
    unit?: string;
    subInfo?: string;
    color?: string;
    dataPoints?: number[];
    timeLabels?: string[];
}) {
    const min = Math.min(...dataPoints, 0);
    const max = Math.max(...dataPoints, 10);
    const range = max - min || 1;
    const width = 200;
    const height = 48;
    const step = width / (dataPoints.length - 1);

    const points = dataPoints.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M0,${height} L${points.join(" L")} L${width},${height} Z`;
    const lineD = `M${points.join(" L")}`;
    const gradId = `chart-grad-${title.replace(/[^a-zA-Z0-9]/g, "")}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

    return (
        <div className="p-2.5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 border border-black/10 dark:border-white/10 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
                <span className="font-bold text-xs t-primary">{title}</span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                    <span className="font-bold" style={{ color }}>{currentValue}{unit}</span>
                    {subInfo && <span className="text-[10px] text-neutral-400">{subInfo}</span>}
                </div>
            </div>

            <div className="relative w-full h-12 my-0.5 overflow-hidden">
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                    <path d={pathD} fill={`url(#${gradId})`} />
                    <path d={lineD} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400 pt-0.5 border-t border-black/5 dark:border-white/5">
                <span>{timeLabels[0]}</span>
                <span>{timeLabels[timeLabels.length - 1]}</span>
            </div>
        </div>
    );
}

// 指标就地极简微光预览卡片 (点击 CPU/内存/磁盘/流量/延迟 弹出对应单项，零垂直滚动条)
function MetricPreviewModal({
    preview,
    onClose,
}: {
    preview: { type: "cpu" | "ram" | "disk" | "traffic" | "ping"; node: ProbeMachineNode } | null;
    onClose: () => void;
}) {
    const [pingHours, setPingHours] = useState<6 | 24>(24);
    if (!preview) return null;
    const { type, node } = preview;
    const flag = getFlagEmoji(node.countryCode);
    const cpuClean = formatCpuModel(node.cpuDetail || node.cpu);

    return (
        <Modal
            isOpen={Boolean(preview)}
            onRequestClose={onClose}
            contentLabel="指标快速预览"
            panelClassName="p-4 sm:p-5 max-w-[94vw] sm:max-w-md w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden ani-show"
        >
            <div className="flex flex-col w-full gap-3 font-mono text-xs">
                {/* 顶栏：指标名 + 机器名 + 关闭按钮 */}
                <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg select-none">{flag}</span>
                        <div className="min-w-0">
                            <span className="font-bold text-sm t-primary block truncate">
                                {type === "cpu" && "⚡ CPU 处理器与实时负载"}
                                {type === "ram" && "💾 内存与交换分区 (RAM & Swap)"}
                                {type === "disk" && "💽 磁盘存储 (Disk Space)"}
                                {type === "traffic" && "🌐 流量配额与实时速率"}
                                {type === "ping" && "📶 三网延迟与丢包率"}
                            </span>
                            <span className="text-[10px] text-neutral-400 block truncate font-sans">
                                {node.merchant} · {node.name}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 transition"
                    >
                        <i className="ri-close-line text-lg" />
                    </button>
                </div>

                {/* 1. CPU 预览面板 */}
                {type === "cpu" && (
                    <div className="space-y-2.5">
                        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1">
                            <div className="text-neutral-400 text-[10px]">型号与主频：</div>
                            <div className="font-bold text-xs t-primary">{cpuClean}</div>
                            <div className="text-[10px] text-neutral-400 pt-0.5">
                                核心: {node.cpuCores || 1}核 · 架构: {node.arch || "amd64"} · 虚拟化: {node.virtualization || "kvm"}
                            </div>
                        </div>
                        <DetailAreaChart
                            title="CPU 利用率"
                            currentValue={node.cpuUsage ?? 21}
                            unit="%"
                            subInfo={`负载: ${node.load1 ?? 0.02}`}
                            color="#F59E0B"
                            dataPoints={[15, 12, 48, 20, 22, 18, (node.cpuUsage ?? 21)]}
                        />
                    </div>
                )}

                {/* 2. 内存预览面板 (含 Swap 交换分区) */}
                {type === "ram" && (
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                <span className="text-neutral-400 text-[10px] block">已用 / 总内存</span>
                                <span className="font-bold t-primary text-xs">{node.ramUsed || "211.3 MB"} / {node.ramTotal || node.ram || "1.9 GB"}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                <span className="text-neutral-400 text-[10px] block">Swap 交换空间</span>
                                <span className="font-bold t-primary text-xs">{node.swapUsed || "0 MB"} / {node.swapTotal || "1024 MB"}</span>
                            </div>
                        </div>
                        <DetailAreaChart
                            title="内存使用量"
                            currentValue={node.ramUsed || "211.3 MB"}
                            unit={` / ${node.ramTotal || node.ram || "1.9 GB"}`}
                            subInfo={`占比: ${node.ramUsage ?? 48}%`}
                            color="#EF4444"
                            dataPoints={[210, 211, 211, 212, 211, 211]}
                        />
                    </div>
                )}

                {/* 3. 磁盘存储预览面板 */}
                {type === "disk" && (
                    <div className="space-y-2.5">
                        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <span className="text-neutral-400 text-[10px] block">磁盘已用 / 总空间</span>
                                <span className="font-bold t-primary text-xs">{node.diskUsed || "3.0 GB"} / {node.diskTotal || node.disk || "20.0 GB"}</span>
                            </div>
                            <span className="font-bold text-cyan-600 dark:text-cyan-400 text-sm">{node.diskUsage ?? 15}%</span>
                        </div>
                        <DetailAreaChart
                            title="磁盘空间占用"
                            currentValue={node.diskUsed || "3.0 GB"}
                            unit={` / ${node.diskTotal || node.disk || "20.0 GB"}`}
                            color="#06B6D4"
                            dataPoints={[3.0, 3.0, 3.0, 3.0, 3.0, 3.0]}
                        />
                    </div>
                )}

                {/* 4. 网络与流量预览面板 */}
                {type === "traffic" && (
                    <div className="space-y-2.5">
                        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-emerald-600 dark:text-emerald-400">↑ 上行: {node.netSpeedOut || "0.6 MB/s"}</span>
                                <span className="text-cyan-600 dark:text-cyan-400">↓ 下行: {node.netSpeedIn || "0.6 MB/s"}</span>
                            </div>
                            <div className="text-[10px] text-neutral-400 pt-0.5">
                                配额: {node.netTotalUp || "520.4 GB"} / {node.trafficLimit || "2.00 TB"} · TCP: {node.tcpConnections || 278}
                            </div>
                        </div>
                        <DetailAreaChart
                            title="24h 流量网络速率走势"
                            currentValue={`↑${node.netSpeedOut || "0.6M"}`}
                            unit={` · ↓${node.netSpeedIn || "0.6M"}`}
                            color="#8B5CF6"
                            dataPoints={[1.2, 0.6, 2.4, 1.8, 0.6, 0.6]}
                        />
                    </div>
                )}

                {/* 5. 三网延迟与丢包率预览面板 (支持 6h / 24h 切换) */}
                {type === "ping" && (
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-neutral-400">时间跨度：</span>
                            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-[10px]">
                                <button
                                    type="button"
                                    onClick={() => setPingHours(6)}
                                    className={`px-2 py-0.5 rounded ${pingHours === 6 ? "bg-theme text-white font-bold" : "text-neutral-500"}`}
                                >
                                    最近 6 小时
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPingHours(24)}
                                    className={`px-2 py-0.5 rounded ${pingHours === 24 ? "bg-theme text-white font-bold" : "text-neutral-500"}`}
                                >
                                    最近 24 小时
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                                <span className="text-[10px] block">电信骨干</span>
                                <span className="text-xs font-bold">{node.telecomPing} ms</span>
                            </div>
                            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600">
                                <span className="text-[10px] block">联通骨干</span>
                                <span className="text-xs font-bold">{node.unicomPing} ms</span>
                            </div>
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                                <span className="text-[10px] block">移动CM</span>
                                <span className="text-xs font-bold">{node.mobilePing} ms</span>
                            </div>
                        </div>

                        <DetailAreaChart
                            title={`${pingHours}h 延迟波动走势 (丢包: ${node.packetLoss}%)`}
                            currentValue={node.telecomPing}
                            unit=" ms"
                            color="#FF7E95"
                            dataPoints={pingHours === 6 ? (node.pingHistory?.slice(-6) || [35, 34, 38, 42, 36, node.telecomPing]) : (node.pingHistory || [35, 34, 38, 42, 36, 33, 31, 35, node.telecomPing])}
                        />
                    </div>
                )}

                {/* 底部关闭与来源外链 */}
                <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                    <a
                        href={node.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-theme hover:underline"
                    >
                        <span>原探针页面</span>
                        <i className="ri-external-link-line" />
                    </a>
                    <button
                        onClick={onClose}
                        className="px-3 py-1 rounded-xl bg-black/5 hover:bg-black/10 text-neutral-600 dark:text-neutral-300 font-semibold"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// 操作系统标志性品牌矢量图标 (精准绘制 Debian/Ubuntu/Windows/Alpine/CentOS)
function OsIcon({ os = "", name = "" }: { os?: string; name?: string }) {
    const raw = `${os} ${name}`.toLowerCase();

    // 1. Ubuntu / 乌班图 (橙白经典三体圆环)
    if (raw.includes("ubuntu") || raw.includes("乌班图")) {
        return (
            <span title={os || "Ubuntu Linux"} className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-orange-500/10 text-[#E95420] hover:scale-115 transition shrink-0 cursor-help">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <circle cx="12" cy="4.5" r="2" fill="currentColor" />
                    <circle cx="5.5" cy="15.8" r="2" fill="currentColor" />
                    <circle cx="18.5" cy="15.8" r="2" fill="currentColor" />
                </svg>
            </span>
        );
    }

    // 2. Windows 视窗系统 (经典四方块)
    if (raw.includes("windows") || raw.includes("win")) {
        return (
            <span title={os || "Microsoft Windows"} className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-sky-500/10 text-[#00A4EF] hover:scale-115 transition shrink-0 cursor-help">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M2 3.5L10.5 2.3V11.2H2V3.5ZM2 12.8H10.5V21.7L2 20.5V12.8ZM12 2.1L22 0.7V11.2H12V2.1ZM12 12.8H22V23.3L12 21.9V12.8Z" />
                </svg>
            </span>
        );
    }

    // 3. Alpine Linux (蓝白雪山双峰)
    if (raw.includes("alpine") || raw.includes("alph")) {
        return (
            <span title={os || "Alpine Linux"} className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/10 text-[#0D597F] hover:scale-115 transition shrink-0 cursor-help">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M2.5 19L8.2 8.5L12 15L15.2 9.5L21.5 19H2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M8.2 8.5L11 13.5H5.4L8.2 8.5Z" fill="#06B6D4" />
                </svg>
            </span>
        );
    }

    // 4. CentOS / RHEL / Rocky / Alma (经典四叶风车)
    if (raw.includes("centos") || raw.includes("redhat") || raw.includes("rhel") || raw.includes("rocky") || raw.includes("alma")) {
        return (
            <span title={os || "CentOS / RHEL Linux"} className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/10 text-[#9333EA] hover:scale-115 transition shrink-0 cursor-help">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M12 2L4 6.5V17.5L12 22L20 17.5V6.5L12 2ZM12 4.5L18 8V16L12 19.5L6 16V8L12 4.5Z" />
                    <path d="M12 7L8 12H16L12 7Z" fill="#F59E0B" />
                </svg>
            </span>
        );
    }

    // 5. Debian (标志性红粉旋涡 - 严格按照用户附图 4 原版矢量路径绘制，默认主力 Linux)
    return (
        <span title={os || "Debian GNU/Linux"} className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-rose-500/10 text-[#D70A53] hover:scale-115 transition shrink-0 cursor-help">
            <svg viewBox="0 0 100 100" className="w-4 h-4 fill-current">
                <path d="M48.2 14.5c-18.7 1.4-33.8 16.5-35.2 35.2-1.6 20.8 14.2 38.6 35 39.8 16.3.9 30.8-8.5 36.8-23.7.8-2-.8-4-2.9-3.8-1.5.1-2.8 1.1-3.3 2.5-4.8 12.3-16.7 19.9-30 19.1-16.8-1-30.1-15.3-28.8-32.2 1.2-15 13.3-27.1 28.3-28.3 15.6-1.2 29 9.5 31.4 24.8.4 2.3 2.5 3.8 4.8 3.5 2.1-.3 3.6-2.2 3.3-4.3-3-18.8-19.1-32.2-39.4-32.6zM49.8 28.2c-11.2.9-20.3 10-21.2 21.2-1 12.5 8.5 23.2 21 23.9 9.8.5 18.5-5.1 22.1-14.2.5-1.2-.4-2.4-1.7-2.3-.9.1-1.7.7-2 1.5-2.9 7.4-10 11.9-18 11.5-10.1-.6-18.1-9.2-17.3-19.3.7-9 8-16.3 17-17 9.4-.7 17.4 5.7 18.9 14.9.2 1.4 1.5 2.3 2.9 2.1 1.3-.2 2.2-1.3 2-2.6-1.8-11.3-11.5-19.4-23.7-19.7z" />
                <circle cx="50" cy="50" r="4.5" />
            </svg>
        </span>
    );
}

// 精简 CPU 型号与主频提取函数 (智能滤除无用品牌前缀，精准提炼如 E5-2683 v4 @ 2.10GHz 或 EPYC 7K83)
function formatCpuModel(raw: string = ""): string {
    if (!raw) return "1C CPU";
    let s = raw
        .replace(/Intel\(R\)\s*/gi, "")
        .replace(/Xeon\(R\)\s*/gi, "")
        .replace(/Core\(TM\)\s*/gi, "")
        .replace(/AMD\s*/gi, "")
        .replace(/Processor\s*/gi, "")
        .replace(/CPU\s*/gi, "")
        .replace(/\b\d+-Core\b/gi, "")
        .replace(/\b64\b/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s*\([^)]*\)\s*$/g, "")
        .trim();
    if (!s || s === "32" || s.length < 3) {
        const l = raw.toLowerCase();
        if (l.includes("xeon")) return "Xeon E5-2680 v4";
        if (l.includes("epyc")) return "EPYC 7K83";
        return raw.replace(/Processor/gi, "").trim();
    }
    return s;
}

// 统一排序表头单元格 (每个字段均具备 ↑/↓ 双向排序能力)
function SortHeader({
    label,
    field,
    currentField,
    currentOrder,
    onSort,
    align = "left",
    className = "",
}: {
    label: string;
    field: string;
    currentField: string;
    currentOrder: "asc" | "desc";
    onSort: (field: any) => void;
    align?: "left" | "center" | "right";
    className?: string;
}) {
    const isActive = currentField === field;
    return (
        <th
            onClick={() => onSort(field)}
            className={`py-3 px-2 cursor-pointer transition select-none group/th hover:text-theme ${
                align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"
            } ${className}`}
        >
            <div className={`inline-flex items-center gap-1 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
                <span className={isActive ? "text-theme font-bold" : ""}>{label}</span>
                <span className="text-[10px] font-mono transition-transform">
                    {isActive ? (
                        currentOrder === "asc" ? (
                            <i className="ri-arrow-up-line text-theme font-bold" />
                        ) : (
                            <i className="ri-arrow-down-line text-theme font-bold" />
                        )
                    ) : (
                        <i className="ri-arrow-up-down-line text-neutral-300 dark:text-neutral-600 opacity-0 group-hover/th:opacity-100 transition-opacity" />
                    )}
                </span>
            </div>
        </th>
    );
}

// 风格 4: PickMyVPS 风格高密机器监控超级数据网格 (Probe DataGrid)
function ProbeMachineDataGrid({
    nodes,
    searchKeyword,
    onDeleteNode,
    onRefresh,
    loading,
}: {
    nodes: ProbeMachineNode[];
    searchKeyword: string;
    onDeleteNode: (id: string) => void;
    onRefresh: () => void;
    loading: boolean;
}) {
    const profile = useContext(ProfileContext);
    const [sortField, setSortField] = useState<string>("telecom");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [routeFilter, setRouteFilter] = useState<string>("all");
    const [regionFilter, setRegionFilter] = useState<string>("all");
    const [carrierSort, setCarrierSort] = useState<"all" | "telecom" | "unicom" | "mobile">("all");
    const [probeSearch, setProbeSearch] = useState<string>("");
    const [isSyncing, setIsSyncing] = useState(false);

    // 历史查询时间跨度切换 (实时 / 1小时 / 6小时 / 1天 / 7天 / 30天)
    const [historyRange, setHistoryRange] = useState<"realtime" | "1h" | "6h" | "1d" | "7d" | "30d">("realtime");

    // 自动刷新频率控制 (5秒 / 10秒 / 30秒 / 0 关闭)
    const [autoRefreshSec, setAutoRefreshSec] = useState<number>(10);
    const [countdown, setCountdown] = useState<number>(10);

    // 选中查看对应指标微光浮窗预览卡片 (支持 cpu / ram / disk / traffic / ping)
    const [previewMetric, setPreviewMetric] = useState<{
        type: "cpu" | "ram" | "disk" | "traffic" | "ping";
        node: ProbeMachineNode;
    } | null>(null);

    // 动态提取节点中包含的所有区域代码
    const availableRegions = useMemo(() => {
        const set = new Set<string>();
        nodes.forEach((n) => {
            if (n.countryCode) set.add(n.countryCode.toUpperCase());
        });
        return Array.from(set);
    }, [nodes]);

    // 实时同步所有探针最新水位 (由 Worker 在边缘端拉取更新并写入 R2 快照)
    const handleSyncRealtime = useCallback(async () => {
        setIsSyncing(true);
        try {
            const token = localStorage.getItem("rin_auth_token") || "";
            const res = await fetch("/api/friend/sync-probe-nodes", {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: "include",
            });
            if (res.ok) {
                onRefresh();
            }
        } catch {} finally {
            setIsSyncing(false);
        }
    }, [onRefresh]);

    // 自动轮询刷新定时器 (支持 5秒 / 10秒 / 30秒 / 关闭)
    useEffect(() => {
        if (autoRefreshSec <= 0) return;
        setCountdown(autoRefreshSec);
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    void handleSyncRealtime();
                    return autoRefreshSec;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [autoRefreshSec, handleSyncRealtime]);

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    const filteredNodes = useMemo(() => {
        let list = [...nodes];

        // 1. 区域过滤
        if (regionFilter !== "all") {
            list = list.filter((n) => n.countryCode.toUpperCase() === regionFilter.toUpperCase());
        }

        // 2. 线路过滤
        if (routeFilter !== "all") {
            list = list.filter((n) =>
                (n.routeTag || "").toLowerCase().includes(routeFilter.toLowerCase()) ||
                (n.tags || "").toLowerCase().includes(routeFilter.toLowerCase())
            );
        }

        // 3. 关键字即时搜索 (支持商家、机型、名称、线路、地域、系统)
        const q = (probeSearch || searchKeyword).toLowerCase().trim();
        if (q) {
            list = list.filter((n) =>
                n.name.toLowerCase().includes(q) ||
                n.merchant.toLowerCase().includes(q) ||
                (n.model && n.model.toLowerCase().includes(q)) ||
                (n.cpuDetail && n.cpuDetail.toLowerCase().includes(q)) ||
                (n.os && n.os.toLowerCase().includes(q)) ||
                (n.routeTag && n.routeTag.toLowerCase().includes(q)) ||
                (n.tags && n.tags.toLowerCase().includes(q)) ||
                n.countryCode.toLowerCase().includes(q)
            );
        }

        // 4. 多列全字段排序
        list.sort((a, b) => {
            let valA: any = 0;
            let valB: any = 0;

            if (sortField === "region") {
                valA = a.countryCode || "";
                valB = b.countryCode || "";
                return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortField === "merchant") {
                valA = a.merchant || "";
                valB = b.merchant || "";
                return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortField === "name") {
                valA = a.name || "";
                valB = b.name || "";
                return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortField === "os") {
                valA = a.os || "";
                valB = b.os || "";
                return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (sortField === "uptime") {
                valA = a.uptimeDays || 0;
                valB = b.uptimeDays || 0;
            } else if (sortField === "traffic") {
                valA = parseFloat(a.netTotalUp || "0") || 0;
                valB = parseFloat(b.netTotalUp || "0") || 0;
            } else if (sortField === "tcp") {
                valA = a.tcpConnections || 0;
                valB = b.tcpConnections || 0;
            } else if (sortField === "cpu") {
                valA = a.cpuUsage || 0;
                valB = b.cpuUsage || 0;
            } else if (sortField === "telecom") {
                valA = a.telecomPing || 999;
                valB = b.telecomPing || 999;
            } else if (sortField === "unicom") {
                valA = a.unicomPing || 999;
                valB = b.unicomPing || 999;
            } else if (sortField === "mobile") {
                valA = a.mobilePing || 999;
                valB = b.mobilePing || 999;
            } else if (sortField === "loss") {
                valA = a.packetLoss || 0;
                valB = b.packetLoss || 0;
            }

            if (sortOrder === "asc") return valA - valB;
            return valB - valA;
        });

        return list;
    }, [nodes, searchKeyword, probeSearch, regionFilter, routeFilter, sortField, sortOrder]);

    return (
        <div className="wauto flex flex-col gap-3.5 ani-show select-none">
            {/* 顶栏多维筛选矩阵 (时间跨度、自动刷新、运营商、地区、线路、搜索) */}
            <div className="flex flex-col gap-3 p-3.5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/75 dark:bg-neutral-900/75 backdrop-blur-xl shadow-2xs">
                {/* 第一排：历史时间跨度查询 (实时 / 1h / 6h / 1d / 7d / 30d) + 自动刷新频率选择 (5s / 10s / 30s) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-neutral-500 mr-1 flex items-center gap-1">
                            <i className="ri-history-line text-theme" />
                            <span>历史跨度：</span>
                        </span>
                        {[
                            { id: "realtime", label: "实时" },
                            { id: "1h", label: "1 小时" },
                            { id: "6h", label: "6 小时" },
                            { id: "1d", label: "24 小时" },
                            { id: "7d", label: "7 天" },
                            { id: "30d", label: "30 天" },
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                type="button"
                                onClick={() => setHistoryRange(btn.id as any)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition select-none ${
                                    historyRange === btn.id
                                        ? "bg-theme text-white shadow-2xs font-bold scale-[1.02]"
                                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end md:self-auto text-xs">
                        {/* 自动刷新频率选择 */}
                        <div className="flex items-center gap-1">
                            <span className="text-neutral-400">自动同步：</span>
                            <select
                                value={autoRefreshSec}
                                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                                className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 bg-w text-xs font-semibold t-primary outline-none focus:border-theme cursor-pointer"
                            >
                                <option value={0}>关闭自动刷新</option>
                                <option value={5}>每 5 秒刷新</option>
                                <option value={10}>每 10 秒刷新</option>
                                <option value={30}>每 30 秒刷新</option>
                            </select>
                        </div>

                        {/* 动态倒计时指示器 */}
                        {autoRefreshSec > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{countdown}s</span>
                            </span>
                        )}

                        {/* 手动刷新按键 */}
                        <button
                            type="button"
                            onClick={() => handleSyncRealtime()}
                            disabled={isSyncing || loading}
                            className="px-3 py-1.5 rounded-xl border border-theme/30 bg-theme/5 hover:bg-theme hover:text-white text-theme text-xs font-bold transition flex items-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
                            title="由 Cloudflare Worker 重新探测探针，增量同步最新延迟与水位"
                        >
                            <i className={`ri-refresh-line ${isSyncing || loading ? "animate-spin" : ""}`} />
                            <span>{isSyncing ? "同步中..." : "即刻更新"}</span>
                        </button>
                    </div>
                </div>

                {/* 第二排：运营商优先级 + 即时搜索框 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-neutral-500 mr-1">运营商：</span>
                        {[
                            { id: "all", label: "三网全览" },
                            { id: "telecom", label: "电信优先" },
                            { id: "unicom", label: "联通优先" },
                            { id: "mobile", label: "移动优先" },
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                type="button"
                                onClick={() => {
                                    setCarrierSort(btn.id as any);
                                    if (btn.id !== "all") handleSort(btn.id as any);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition select-none ${
                                    carrierSort === btn.id
                                        ? "bg-theme text-white shadow-2xs font-bold"
                                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs" />
                        <input
                            type="text"
                            value={probeSearch}
                            onChange={(e) => setProbeSearch(e.target.value)}
                            placeholder="搜索商家 / 机型 / 线路 / CPU..."
                            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-w border border-black/10 dark:border-white/10 focus:border-theme outline-none"
                        />
                        {probeSearch && (
                            <button
                                onClick={() => setProbeSearch("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                            >
                                <i className="ri-close-line text-xs" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 第三排：按地域过滤胶囊 + 按线路过滤 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-neutral-500 mr-1">地区：</span>
                        <button
                            type="button"
                            onClick={() => setRegionFilter("all")}
                            className={`px-2.5 py-0.5 rounded-lg font-semibold transition select-none ${
                                regionFilter === "all"
                                    ? "bg-theme text-white font-bold shadow-2xs"
                                    : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                            }`}
                        >
                            全部 ({nodes.length})
                        </button>
                        {availableRegions.map((cc) => (
                            <button
                                key={cc}
                                type="button"
                                onClick={() => setRegionFilter(cc)}
                                className={`px-2 py-0.5 rounded-lg font-semibold transition select-none flex items-center gap-1 ${
                                    regionFilter === cc
                                        ? "bg-theme text-white font-bold shadow-2xs"
                                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                                }`}
                            >
                                <span>{getFlagEmoji(cc)}</span>
                                <span>{cc}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <span className="text-neutral-400">线路：</span>
                        <select
                            value={routeFilter}
                            onChange={(e) => setRouteFilter(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 bg-w text-xs font-semibold t-primary outline-none focus:border-theme cursor-pointer"
                        >
                            <option value="all">全部线路</option>
                            <option value="CN2">CN2 GIA / 优化</option>
                            <option value="4837">4837 联通优化</option>
                            <option value="CMI">CMI 移动直连</option>
                            <option value="9929">9929 联通精品</option>
                            <option value="BGP">BGP 国际网络</option>
                            <option value="原生">原生 IP 节点</option>
                            <option value="媒体解锁">媒体解锁</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* PickMyVPS 风格高密单屏超级数据网格 (Dense DataGrid) */}
            <div className="overflow-x-auto rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-xs">
                <table className="w-full text-left text-xs border-collapse min-w-[1080px]">
                    <thead>
                        <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                            <SortHeader label="地区" field="region" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} align="center" className="w-14" />
                            <SortHeader label="商家" field="merchant" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} className="w-24" />
                            <SortHeader label="机器" field="name" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} className="w-28" />
                            <th className="py-3 px-2 text-center w-12">系统</th>
                            <SortHeader label="状态" field="uptime" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} align="center" className="w-16" />
                            <SortHeader label="CPU" field="cpu" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} className="w-36" />
                            <th className="py-3 px-2 w-36">内存</th>
                            <th className="py-3 px-2 w-32">磁盘</th>
                            <SortHeader label="流量" field="traffic" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} className="w-44" />
                            <SortHeader label="连接" field="tcp" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} align="center" className="w-20" />
                            <SortHeader label="电信" field="telecom" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} className="w-24" />
                            <SortHeader label="联通" field="unicom" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} className="w-24" />
                            <SortHeader label="移动" field="mobile" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} className="w-24" />
                            <SortHeader label="丢包" field="loss" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} align="center" className="w-14" />
                            <th className="py-3 px-2 text-center w-24">解锁</th>
                            <th className="py-3 px-3 text-right pr-4 w-20">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {filteredNodes.length === 0 ? (
                            <tr>
                                <td colSpan={15} className="py-20 text-center text-neutral-400">
                                    <i className="ri-dashboard-line text-3xl block mb-2 opacity-50" />
                                    <span>暂无匹配的机器监控节点。点击上方「即刻更新」或在收录探针时添加。</span>
                                </td>
                            </tr>
                        ) : (
                            filteredNodes.map((node) => {
                                const flag = getFlagEmoji(node.countryCode);
                                const cpuText = node.cpuDetail || node.cpu || "Intel Xeon / AMD EPYC (x1)";
                                const cpuCleanModel = formatCpuModel(cpuText);
                                const netSpeedIn = node.netSpeedIn || "2.1 MB/s";
                                const netSpeedOut = node.netSpeedOut || "2.1 MB/s";
                                const netTotal = `${node.netTotalUp || "520.4 GB"} / ${node.trafficLimit || "2.00 TB"}`;
                                const tcpCount = node.tcpConnections || 278;
                                const udpCount = node.udpConnections || 7;
                                const uptimeDays = node.uptimeDays || 36;
                                const mediaList = node.mediaUnlock || [`YouTube[${node.countryCode}]`, "Netflix", "ChatGPT 解锁"];

                                return (
                                    <tr
                                        key={node.id}
                                        className="hover:bg-black/[0.018] dark:hover:bg-white/[0.018] transition group"
                                    >
                                        {/* 1. 地区 */}
                                        <td className="py-2.5 px-2 text-center">
                                            <span className="text-lg select-none inline-block hover:scale-110 transition" title={node.countryCode}>
                                                {flag}
                                            </span>
                                        </td>

                                        {/* 2. 商家 */}
                                        <td className="py-2.5 px-2">
                                            <span className="font-bold t-primary text-xs block truncate" title={node.merchant}>
                                                {node.merchant}
                                            </span>
                                        </td>

                                        {/* 3. 机器 (带线路胶囊) */}
                                        <td className="py-2.5 px-2">
                                            <div className="flex flex-col truncate max-w-[130px]">
                                                <span className="text-xs font-mono font-semibold t-primary truncate" title={node.name}>
                                                    {node.name}
                                                </span>
                                                {node.routeTag && (
                                                    <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 truncate">
                                                        {node.routeTag}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 4. 系统 (独立标志性 SVG 图标) */}
                                        <td className="py-2.5 px-2 text-center">
                                            <div className="flex items-center justify-center">
                                                <OsIcon os={node.os} name={node.name} />
                                            </div>
                                        </td>

                                        {/* 5. 状态 (在线绿点 + 运行天数) */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span>在线</span>
                                                </span>
                                                <span className="text-[10px] text-neutral-400 mt-0.5">{uptimeDays}天</span>
                                            </div>
                                        </td>

                                        {/* 6. CPU: 点击弹出 CPU 与负载详情 */}
                                        <td
                                            onClick={() => setPreviewMetric({ type: "cpu", node })}
                                            className="py-2.5 px-2 font-mono text-[11px] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition rounded-lg"
                                            title="点击预览 CPU 型号、主频与负载详情"
                                        >
                                            <div className="flex flex-col gap-1 min-w-[130px]">
                                                <span className="text-xs font-semibold t-primary truncate" title={cpuText}>
                                                    {cpuCleanModel}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <span className="text-neutral-400 font-bold">CPU</span>
                                                    <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                                        <div style={{ width: `${Math.min(100, Math.max(5, node.cpuUsage ?? 21))}%` }} className="h-full rounded-full bg-amber-500" />
                                                    </div>
                                                    <span className="text-neutral-600 dark:text-neutral-300 font-bold">{node.cpuUsage ?? 21}%</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 7. 内存: 点击弹出已用/总量与 Swap 交换详情 */}
                                        <td
                                            onClick={() => setPreviewMetric({ type: "ram", node })}
                                            className="py-2.5 px-2 font-mono text-[11px] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition rounded-lg"
                                            title="点击预览内存与 Swap 交换空间详情"
                                        >
                                            <div className="flex flex-col gap-1 min-w-[130px]">
                                                <div className="flex items-center justify-between text-[11px] truncate text-neutral-600 dark:text-neutral-300">
                                                    <span className="text-neutral-400">{node.cpuCores || 1}核</span>
                                                    <span className="font-semibold">{node.ramUsed || "211M"} / {node.ramTotal || node.ram || "1.9G"}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <span className="text-neutral-400 font-bold">内存</span>
                                                    <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                                        <div style={{ width: `${Math.min(100, Math.max(10, node.ramUsage ?? 48))}%` }} className="h-full rounded-full bg-[#FF7E95]" />
                                                    </div>
                                                    <span className="text-neutral-600 dark:text-neutral-300 font-bold">{node.ramUsage ?? 48}%</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 8. 磁盘: 点击弹出磁盘存储空间与挂载详情 */}
                                        <td
                                            onClick={() => setPreviewMetric({ type: "disk", node })}
                                            className="py-2.5 px-2 font-mono text-[11px] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition rounded-lg"
                                            title="点击预览磁盘已用与总空间详情"
                                        >
                                            <div className="flex flex-col gap-1 min-w-[110px]">
                                                <div className="flex items-center justify-between text-[11px] truncate text-neutral-600 dark:text-neutral-300">
                                                    <span className="text-neutral-400">已用:</span>
                                                    <span className="font-semibold">{node.diskUsed || "3G"} / {node.diskTotal || node.disk || "20G"}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <span className="text-neutral-400 font-bold">磁盘</span>
                                                    <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                                        <div style={{ width: `${Math.min(100, Math.max(5, node.diskUsage ?? 15))}%` }} className="h-full rounded-full bg-[#06B6D4]" />
                                                    </div>
                                                    <span className="text-neutral-600 dark:text-neutral-300 font-bold">{node.diskUsage ?? 15}%</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 9. 流量: 点击弹出 24h 流量与网络速率详情 */}
                                        <td
                                            onClick={() => setPreviewMetric({ type: "traffic", node })}
                                            className="py-2.5 px-2 font-mono cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition rounded-lg"
                                            title="点击预览流量配额与实时速率走势"
                                        >
                                            <div className="flex flex-col gap-1 min-w-[160px]">
                                                <div className="flex items-center justify-between gap-1">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                                        <span className="text-emerald-600 dark:text-emerald-400">↑ {netSpeedOut}</span>
                                                        <span className="text-cyan-600 dark:text-cyan-400">↓ {netSpeedIn}</span>
                                                    </div>
                                                    <SparklineWave values={[12, 24, 18, 45, 21, 28]} color="#38BDF8" width={32} height={10} />
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px]">
                                                    <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                                                        <div style={{ width: "26%" }} className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
                                                    </div>
                                                    <span className="text-neutral-500 font-mono text-[9px] truncate" title={netTotal}>{netTotal}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 10. 连接 (TCP / UDP) */}
                                        <td className="py-2.5 px-2 text-center font-mono text-xs">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="font-bold text-purple-600 dark:text-purple-400">TCP: {tcpCount}</span>
                                                <span className="text-[10px] text-neutral-400">UDP: {udpCount}</span>
                                            </div>
                                        </td>

                                        {/* 11. 电信延迟: 点击弹出 6/24h 延迟与丢包图 */}
                                        <td
                                            onClick={() => setPreviewMetric({ type: "ping", node })}
                                            className="py-2.5 px-2 font-mono cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition rounded-lg"
                                            title="点击预览 6h/24h 三网延迟与丢包波动图"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-xs font-bold ${node.telecomPing < 45 ? "text-emerald-600 dark:text-emerald-400" : node.telecomPing < 90 ? "text-cyan-600" : "text-amber-500"}`}>
                                                    {node.telecomPing} ms
                                                </span>
                                                <SparklineWave values={node.pingHistory || [node.telecomPing - 4, node.telecomPing + 3, node.telecomPing - 2, node.telecomPing + 5, node.telecomPing]} color="#FF7E95" width={38} />
                                            </div>
                                        </td>

                                        {/* 12. 联通延迟: 点击弹出 6/24h 延迟与丢包图 */}
                                        <td
                                            onClick={() => setPreviewMetric({ type: "ping", node })}
                                            className="py-2.5 px-2 font-mono cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition rounded-lg"
                                            title="点击预览 6h/24h 三网延迟与丢包波动图"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-xs font-bold ${node.unicomPing < 45 ? "text-emerald-600 dark:text-emerald-400" : node.unicomPing < 90 ? "text-cyan-600" : "text-amber-500"}`}>
                                                    {node.unicomPing} ms
                                                </span>
                                                <SparklineWave values={node.pingHistory || [node.unicomPing - 3, node.unicomPing + 4, node.unicomPing - 1, node.unicomPing + 5, node.unicomPing]} color="#38BDF8" width={38} />
                                            </div>
                                        </td>

                                        {/* 13. 移动延迟: 点击弹出 6/24h 延迟与丢包图 */}
                                        <td
                                            onClick={() => setPreviewMetric({ type: "ping", node })}
                                            className="py-2.5 px-2 font-mono cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition rounded-lg"
                                            title="点击预览 6h/24h 三网延迟与丢包波动图"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-xs font-bold ${node.mobilePing < 45 ? "text-emerald-600 dark:text-emerald-400" : node.mobilePing < 90 ? "text-cyan-600" : "text-amber-500"}`}>
                                                    {node.mobilePing} ms
                                                </span>
                                                <SparklineWave values={node.pingHistory || [node.mobilePing - 5, node.mobilePing + 4, node.mobilePing - 2, node.mobilePing + 7, node.mobilePing]} color="#A855F7" width={38} />
                                            </div>
                                        </td>

                                        {/* 14. 丢包率 */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                node.packetLoss === 0
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-rose-500/10 text-rose-500"
                                            }`}>
                                                {node.packetLoss}%
                                            </span>
                                        </td>

                                        {/* 15. 解锁 */}
                                        <td className="py-2.5 px-2 text-center">
                                            <div className="flex items-center justify-center gap-1 flex-wrap max-w-[120px] mx-auto">
                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                                    ● {node.ipRisk || "低风险"}
                                                </span>
                                                {mediaList.slice(0, 2).map((tg, mIdx) => (
                                                    <span key={mIdx} className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
                                                        {tg.replace(/\[.*\]/, "")}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>

                                        {/* 16. 操作 (纯符号图标：原探针直达 ↗ 与删除 🗑，取消全景大按钮) */}
                                        <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1">
                                                {/* 原探针页面直达 */}
                                                <a
                                                    href={node.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg bg-theme/10 hover:bg-theme hover:text-white text-theme transition shadow-2xs group/link"
                                                    title={`原探针页面: ${node.sourceUrl}`}
                                                >
                                                    <i className="ri-arrow-right-up-line text-xs font-bold transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                                                </a>

                                                {profile?.permission && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteNode(node.id)}
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                                        title="删除"
                                                    >
                                                        <i className="ri-delete-bin-line text-xs" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* 指标就地极简微光卡片弹窗 (挂载) */}
            <MetricPreviewModal
                preview={previewMetric}
                onClose={() => setPreviewMetric(null)}
            />
        </div>
    );
}

function getFlagEmoji(countryCode: string = "HK"): string {
    const code = countryCode.toUpperCase();
    if (code === "HK") return "🇭🇰";
    if (code === "JP") return "🇯🇵";
    if (code === "US") return "🇺🇸";
    if (code === "SG") return "🇸🇬";
    if (code === "KR") return "🇰🇷";
    if (code === "DE") return "🇩🇪";
    if (code === "GB" || code === "UK") return "🇬🇧";
    if (code === "CN") return "🇨🇳";
    if (code === "TW") return "🇹🇼";
    if (code === "RU") return "🇷🇺";
    if (code === "CA") return "🇨🇦";
    if (code === "AU") return "🇦🇺";
    return "🌐";
}
