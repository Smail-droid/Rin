import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Helmet } from 'react-helmet';
import { useTranslation } from "react-i18next";
import { Modal, SearchableSelect } from "@rin/ui";
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

// 预设核心与扩展分类
export const PRESET_CATEGORIES = [
    "全部",
    "友友们",
    "VPS/基础设施",
    "测速/探针监控",
    "极客常用工具",
    "技术极客社区",
    "其他灵感",
] as const;

// 从描述中解析分类标签 [分类] 以及纯净简介
export function parseFriendCategory(desc: string | null, url: string = ""): { category: string; cleanDesc: string } {
    if (!desc) {
        return { category: inferCategoryFallback(url, ""), cleanDesc: "" };
    }
    const match = desc.match(/^\[(.*?)\]\s*(.*)$/);
    if (match && match[1]) {
        return {
            category: match[1].trim(),
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
        combined.includes("机房") ||
        combined.includes("买鸡") ||
        combined.includes("主机")
    ) {
        return "VPS/基础设施";
    }
    if (
        combined.includes("speedtest") ||
        combined.includes("probe") ||
        combined.includes("ping") ||
        combined.includes("bgp") ||
        combined.includes("测速") ||
        combined.includes("探针") ||
        combined.includes("路由") ||
        combined.includes("nezha") ||
        combined.includes("uptime")
    ) {
        return "测速/探针监控";
    }
    if (
        combined.includes("github") ||
        combined.includes("tool") ||
        combined.includes("api") ||
        combined.includes("docker") ||
        combined.includes("dev") ||
        combined.includes("工具")
    ) {
        return "极客常用工具";
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
        return "技术极客社区";
    }
    return "友友们";
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
    const [formCategory, setFormCategory] = useState("友友们");
    const [isSniffing, setIsSniffing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 编辑友链状态
    const [editingFriend, setEditingFriend] = useState<FriendItem | null>(null);

    const ref = useRef(false);
    const { showAlert, AlertUI } = useAlert();
    const { showConfirm, ConfirmUI } = useConfirm();

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
            const { data, error } = await client.friend.inspect(raw);
            if (error || !data) {
                // 嗅探受阻时平滑兜底
                try {
                    const parsed = new URL(raw);
                    const domain = parsed.hostname;
                    setFormName(prev => prev || domain);
                    setFormAvatar(prev => prev || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
                    setFormCategory(prev => prev || inferCategoryFallback(raw, ""));
                } catch {}
                showAlert("站点嗅探响应超时或受防护阻断，已为您自动补全域名，可直接微调后提交");
            } else {
                setFormName(data.name || "");
                setFormDesc(data.desc || "");
                setFormAvatar(data.avatar || `https://www.google.com/s2/favicons?domain=${data.domain}&sz=128`);
                if (data.category) {
                    setFormCategory(data.category);
                }
            }
        } catch (err: any) {
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
                setFormCategory("友友们");

                if (profile?.permission) {
                    showAlert("已成功收录并发布到罗盘画廊！", () => reloadFriends());
                } else {
                    showAlert("已提交收录申请！站长审核通过后将即刻展示在画廊中。", () => reloadFriends());
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
                <title>{`${t('friends.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('friends.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>

            <Waiting for={status === "idle"}>
                <main className="w-full flex flex-col justify-center items-center mb-12 t-primary ani-show min-h-[75vh]">
                    {/* 顶部标题与行动导航 */}
                    <div className="wauto py-6 mb-6 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 text-xs font-bold mb-2 shadow-2xs">
                                <i className="ri-compass-3-line animate-spin-slow text-sm" />
                                <span>邻家友链 · 极客罗盘</span>
                            </div>
                            <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight art-title-${siteConfig.friendsTitleStyle || siteConfig.atelierTitleStyle || "aurora_flow"}`}>
                                {t('friends.title')}
                            </h1>
                            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal">
                                收集网络各处的灵感小岛、技术社区与极客基建罗盘
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
                                    <span>{profile?.permission ? "添加站点" : "推荐站点 / 申请友链"}</span>
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

                        {/* 实时搜索 */}
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
                    </div>

                    {/* 画廊卡片流 */}
                    {filteredFriends.length === 0 ? (
                        <div className="wauto flex flex-col items-center justify-center py-20 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 mb-3 text-2xl">
                                <i className="ri-inbox-line" />
                            </div>
                            <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                                {searchKeyword ? "没有找到符合搜索条件的站点" : "暂无相关收录站点"}
                            </p>
                            <p className="mt-1 text-xs text-neutral-400">
                                点击右上角「+ 推荐站点 / 申请友链」添加第一个精彩小岛吧
                            </p>
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

                    {/* URL 输入与一键智能解析 */}
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
                                    placeholder="https://example.com"
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition"
                                />
                            </div>
                            <button
                                onClick={handleSniffUrl}
                                disabled={isSniffing}
                                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-60 transition shrink-0"
                            >
                                {isSniffing ? (
                                    <>
                                        <i className="ri-loader-4-line animate-spin text-sm" />
                                        <span>AI 解析中...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="ri-magic-line text-sm" />
                                        <span>一键智能解析</span>
                                    </>
                                )}
                            </button>
                        </div>
                        {isSniffing && (
                            <p className="mt-1.5 text-[11px] text-rose-500 animate-pulse flex items-center gap-1">
                                <i className="ri-radar-line" />
                                <span>正在嗅探站点信息并由 AI 自动精炼与归类...</span>
                            </p>
                        )}
                    </div>

                    {/* 分类选择 */}
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

                    {/* 站点名称与图标回填 */}
                    <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">
                                站点名称 *
                            </label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="例如: 某某小站 / 探针"
                                className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1 block">
                                图标/Favicon 地址 *
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={formAvatar}
                                    onChange={e => setFormAvatar(e.target.value)}
                                    placeholder="https://.../favicon.ico"
                                    className="w-full px-3 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-theme focus:outline-hidden transition"
                                />
                                {formAvatar && (
                                    <div className="h-8 w-8 shrink-0 rounded-lg bg-black/5 dark:bg-white/5 p-1 flex items-center justify-center overflow-hidden border border-black/10 dark:border-white/10">
                                        <ImageWithFallback
                                            src={formAvatar}
                                            alt="preview"
                                            className="h-full w-full object-cover rounded-md"
                                        />
                                    </div>
                                )}
                            </div>
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
    const isTop = friend.sort_order && friend.sort_order > 0;
    const safeUrl = safeHttpUrl(friend.url);

    // 分类徽标配色
    const badgeColor = useMemo(() => {
        switch (category) {
            case "VPS/基础设施":
                return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
            case "测速/探针监控":
                return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
            case "极客常用工具":
                return "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400";
            case "技术极客社区":
                return "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400";
            case "其他灵感":
                return "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400";
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
                    {isTop && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <i className="ri-pushpin-2-fill text-[9px]" />
                            <span>置顶</span>
                        </span>
                    )}
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
                            <div className="w-36">
                                <SearchableSelect
                                    value={String(status)}
                                    onChange={(nextValue) => setStatus(Number(nextValue) || 0)}
                                    options={statusOptions.map(o => ({ label: o.label, value: String(o.value) }))}
                                    placeholder="状态"
                                />
                            </div>
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
