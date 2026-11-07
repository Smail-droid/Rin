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
    price?: string;
    usage?: string;
    cpu?: string;
    ram?: string;
    disk?: string;
    bandwidth?: string;
    traffic?: string;
    uptimeDays: number;
    telecomPing: number;
    unicomPing: number;
    mobilePing: number;
    packetLoss: number;
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
                showAlert("🎉 已成功识别 NodeSeek 用户信息与真实头像，并存入 R2 avatars/ 独立目录！");
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
                    showAlert("已成功收录并发布到星廊！", () => reloadFriends());
                } else {
                    showAlert("已提交收录申请！站长审核通过后将即刻展示在星廊中。", () => reloadFriends());
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
                                        onClick={() => setActiveCategory(cat)}
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
                    {viewStyle === "probe" ? (
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
                panelClassName="overflow-visible p-4 sm:p-7 max-w-[94vw] sm:max-w-lg w-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl"
            >
                <div className="flex flex-col w-full">
                    {/* 弹窗头部 */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
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
                                    placeholder="例如: https://komari.zixuanxie.top/"
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

                    {/* 2. NodeSeek 个人空间地址 (选填) */}
                    <div className="mt-3.5 p-3 rounded-2xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                                <i className="ri-user-smile-line text-theme" />
                                <span>NodeSeek 个人空间地址 (选填)</span>
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
                                    placeholder="例如: https://www.nodeseek.com/space/61231#/general"
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
                                                <div className="grid grid-cols-3 gap-1.5 pt-1">
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
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 提交按钮栏 */}
                    <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-black/5 dark:border-white/5">
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
                            className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-md shadow-rose-500/20 hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
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
    width = 42,
    height = 14,
}: {
    values?: number[];
    color?: string;
    width?: number;
    height?: number;
}) {
    const min = Math.min(...values, 10);
    const max = Math.max(...values, 80);
    const range = max - min || 1;
    const step = width / (values.length - 1);

    const points = values.map((v, i) => {
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
    const [sortField, setSortField] = useState<"telecom" | "unicom" | "mobile" | "uptime">("telecom");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [routeFilter, setRouteFilter] = useState<string>("all");
    const [testPoint, setTestPoint] = useState<"all" | "telecom" | "unicom" | "mobile">("all");

    const filteredNodes = useMemo(() => {
        let list = [...nodes];
        if (searchKeyword.trim()) {
            const kw = searchKeyword.toLowerCase().trim();
            list = list.filter((n) =>
                n.name.toLowerCase().includes(kw) ||
                n.merchant.toLowerCase().includes(kw) ||
                (n.model && n.model.toLowerCase().includes(kw)) ||
                (n.routeTag && n.routeTag.toLowerCase().includes(kw))
            );
        }

        if (routeFilter !== "all") {
            list = list.filter((n) => n.routeTag.toLowerCase().includes(routeFilter.toLowerCase()));
        }

        list.sort((a, b) => {
            let valA = 0;
            let valB = 0;
            if (sortField === "telecom") {
                valA = a.telecomPing || 999;
                valB = b.telecomPing || 999;
            } else if (sortField === "unicom") {
                valA = a.unicomPing || 999;
                valB = b.unicomPing || 999;
            } else if (sortField === "mobile") {
                valA = a.mobilePing || 999;
                valB = b.mobilePing || 999;
            } else if (sortField === "uptime") {
                valA = a.uptimeDays || 0;
                valB = b.uptimeDays || 0;
            }

            if (sortOrder === "asc") return valA - valB;
            return valB - valA;
        });

        return list;
    }, [nodes, searchKeyword, routeFilter, sortField, sortOrder]);

    const handleSort = (field: "telecom" | "unicom" | "mobile" | "uptime") => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    return (
        <div className="wauto flex flex-col gap-3.5 ani-show select-none">
            {/* 顶栏筛选与测速点切换 (对齐 PickMyVPS 截图 2 布局) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md shadow-2xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-neutral-500 mr-1">测速网络：</span>
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
                                setTestPoint(btn.id as any);
                                if (btn.id !== "all") handleSort(btn.id as any);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                testPoint === btn.id
                                    ? "bg-theme text-white shadow-2xs font-bold"
                                    : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                            }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs">
                        <span className="text-neutral-400">线路：</span>
                        <select
                            value={routeFilter}
                            onChange={(e) => setRouteFilter(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 bg-w text-xs font-semibold t-primary outline-none focus:border-theme cursor-pointer"
                        >
                            <option value="all">全部线路</option>
                            <option value="CN2GIA">CN2 GIA</option>
                            <option value="4837">4837 优化</option>
                            <option value="CMI">CMI 移动直连</option>
                            <option value="9929">9929 联通精品</option>
                            <option value="BGP">BGP 国际</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-1.5 rounded-lg border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme transition"
                        title="重新获取探针延迟与水位"
                    >
                        <i className={`ri-refresh-line text-xs ${loading ? "animate-spin text-theme" : ""}`} />
                    </button>
                </div>
            </div>

            {/* PickMyVPS 风格高密单屏超级数据网格 (Dense DataGrid) */}
            <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-xs">
                <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                    <thead>
                        <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                            <th className="py-3 px-3">商家 / 机型</th>
                            <th
                                onClick={() => handleSort("telecom")}
                                className="py-3 px-2 w-28 cursor-pointer hover:text-theme transition"
                            >
                                <div className="flex items-center gap-1">
                                    <span>电信延迟</span>
                                    {sortField === "telecom" && <i className={sortOrder === "asc" ? "ri-arrow-up-line text-theme" : "ri-arrow-down-line text-theme"} />}
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort("unicom")}
                                className="py-3 px-2 w-28 cursor-pointer hover:text-theme transition"
                            >
                                <div className="flex items-center gap-1">
                                    <span>联通延迟</span>
                                    {sortField === "unicom" && <i className={sortOrder === "asc" ? "ri-arrow-up-line text-theme" : "ri-arrow-down-line text-theme"} />}
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort("mobile")}
                                className="py-3 px-2 w-28 cursor-pointer hover:text-theme transition"
                            >
                                <div className="flex items-center gap-1">
                                    <span>移动延迟</span>
                                    {sortField === "mobile" && <i className={sortOrder === "asc" ? "ri-arrow-up-line text-theme" : "ri-arrow-down-line text-theme"} />}
                                </div>
                            </th>
                            <th className="py-3 px-2 w-16 text-center">丢包率</th>
                            <th
                                onClick={() => handleSort("uptime")}
                                className="py-3 px-2 w-20 text-center cursor-pointer hover:text-theme transition"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <span>在线</span>
                                    {sortField === "uptime" && <i className={sortOrder === "asc" ? "ri-arrow-up-line text-theme" : "ri-arrow-down-line text-theme"} />}
                                </div>
                            </th>
                            <th className="py-3 px-2 w-36">配置规格</th>
                            <th className="py-3 px-2 w-20 text-center">用途</th>
                            <th className="py-3 px-3 text-right pr-4 w-28">原探针来源</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {filteredNodes.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-16 text-center text-neutral-400">
                                    <i className="ri-dashboard-line text-2xl block mb-2 opacity-50" />
                                    <span>暂无机器监控节点。在收录探针站点时，系统将智能提取节点供您一键入库。</span>
                                </td>
                            </tr>
                        ) : (
                            filteredNodes.map((node) => {
                                const flag = getFlagEmoji(node.countryCode);
                                return (
                                    <tr
                                        key={node.id}
                                        className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition"
                                    >
                                        {/* 商家 / 机型 */}
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base select-none shrink-0" title={node.countryCode}>
                                                    {flag}
                                                </span>
                                                <div className="truncate">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold t-primary">{node.merchant}</span>
                                                        <span className="text-xs text-neutral-400 font-mono truncate">{node.model}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                                            {node.routeTag}
                                                        </span>
                                                        <span className="text-[10px] text-neutral-400 font-mono truncate">{node.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 电信延迟 */}
                                        <td className="py-2.5 px-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex flex-col">
                                                    <span className={`font-mono font-bold text-xs ${node.telecomPing < 45 ? "text-emerald-600 dark:text-emerald-400" : node.telecomPing < 90 ? "text-cyan-600" : "text-amber-500"}`}>
                                                        {node.telecomPing} ms
                                                    </span>
                                                    <span className="text-[9px] text-neutral-400 font-mono">电信骨干</span>
                                                </div>
                                                <SparklineWave values={[node.telecomPing - 4, node.telecomPing + 3, node.telecomPing - 2, node.telecomPing + 5, node.telecomPing]} color="#FF7E95" />
                                            </div>
                                        </td>

                                        {/* 联通延迟 */}
                                        <td className="py-2.5 px-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex flex-col">
                                                    <span className={`font-mono font-bold text-xs ${node.unicomPing < 45 ? "text-emerald-600 dark:text-emerald-400" : node.unicomPing < 90 ? "text-cyan-600" : "text-amber-500"}`}>
                                                        {node.unicomPing} ms
                                                    </span>
                                                    <span className="text-[9px] text-neutral-400 font-mono">联通骨干</span>
                                                </div>
                                                <SparklineWave values={[node.unicomPing - 3, node.unicomPing + 4, node.unicomPing - 1, node.unicomPing + 5, node.unicomPing]} color="#38BDF8" />
                                            </div>
                                        </td>

                                        {/* 移动延迟 */}
                                        <td className="py-2.5 px-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex flex-col">
                                                    <span className={`font-mono font-bold text-xs ${node.mobilePing < 45 ? "text-emerald-600 dark:text-emerald-400" : node.mobilePing < 90 ? "text-cyan-600" : "text-amber-500"}`}>
                                                        {node.mobilePing} ms
                                                    </span>
                                                    <span className="text-[9px] text-neutral-400 font-mono">移动CM</span>
                                                </div>
                                                <SparklineWave values={[node.mobilePing - 5, node.mobilePing + 4, node.mobilePing - 2, node.mobilePing + 7, node.mobilePing]} color="#A855F7" />
                                            </div>
                                        </td>

                                        {/* 丢包率 */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                node.packetLoss === 0
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-rose-500/10 text-rose-500"
                                            }`}>
                                                {node.packetLoss}%
                                            </span>
                                        </td>

                                        {/* 在线时间 */}
                                        <td className="py-2.5 px-2 text-center font-mono text-xs">
                                            <span className="text-neutral-600 dark:text-neutral-300 font-bold">
                                                {node.uptimeDays}天
                                            </span>
                                        </td>

                                        {/* 配置规格 */}
                                        <td className="py-2.5 px-2 font-mono text-[11px] text-neutral-500">
                                            <div className="truncate">
                                                <span>{node.cpu || "1C"} · </span>
                                                <span>{node.ram || "1G"} · </span>
                                                <span>{node.disk || "20G"}</span>
                                            </div>
                                        </td>

                                        {/* 用途 */}
                                        <td className="py-2.5 px-2 text-center">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
                                                {node.usage || "直连/建站"}
                                            </span>
                                        </td>

                                        {/* 核心要求：原探针来源外链直达 */}
                                        <td className="py-2.5 px-3 text-right pr-4 whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5">
                                                <a
                                                    href={node.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme hover:text-white text-theme text-xs font-semibold transition shadow-2xs group/link"
                                                    title={`点击查看原探针页面来源: ${node.sourceUrl}`}
                                                >
                                                    <span>来源</span>
                                                    <i className="ri-arrow-right-up-line text-xs font-bold transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                                                </a>
                                                {profile?.permission && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteNode(node.id)}
                                                        className="p-1 rounded-md text-neutral-400 hover:text-rose-500 transition"
                                                        title="从监控列表中移除"
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
