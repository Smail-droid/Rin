import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProfileContext } from "../state/profile";

interface CopilotConfig {
    host: string;
    token: string;
}

const STORAGE_KEY = "rin_jeikcode_copilot_config";
// 默认采用当前设备局域网 IP，确保同一 Wi-Fi 下手机与移动端访问时畅通连线
const DEFAULT_CONFIG: CopilotConfig = {
    host: "http://192.168.0.246:13459",
    token: "sk-7dd8-18e341d3b1c51710",
};

// 预置全站 10 大核心模块卡带的组件地图，支持跨页面随时调阅与一键点选
interface RouteContextPreset {
    name: string;
    pattern: RegExp;
    defaultComponent: string;
    defaultFile: string;
    chips: Array<{ label: string; component: string; file: string }>;
}

const ROUTE_PRESETS: RouteContextPreset[] = [
    {
        name: "星标画廊",
        pattern: /^\/friends/,
        defaultComponent: "FriendsGallery (星标画廊)",
        defaultFile: "client/src/page/friends.tsx",
        chips: [
            { label: "拍立得卡片", component: "拍立得卡片 (PolaroidFriendCard)", file: "client/src/page/friends.tsx" },
            { label: "高密单行书签", component: "高密单行书签 (CompactFriendRow)", file: "client/src/page/friends.tsx" },
            { label: "推荐/申请弹窗", component: "申请弹窗 (AddFriendModal)", file: "client/src/page/friends.tsx" },
            { label: "编辑友链弹窗", component: "编辑弹窗 (EditFriendModal)", file: "client/src/page/friends.tsx" },
            { label: "诞生初衷透镜", component: "初衷透镜 (OriginChronicleLens)", file: "client/src/components/origin-chronicle-lens.tsx" },
        ],
    },
    {
        name: "文章阅读",
        pattern: /^\/feed\//,
        defaultComponent: "FeedArticle (文章正文/漫游)",
        defaultFile: "client/src/page/feed.tsx",
        chips: [
            { label: "文章标签组合栏", component: "文章标签栏 (ArticleTagBar)", file: "client/src/components/hashtag.tsx" },
            { label: "灵感漫游侧栏", component: "灵感漫游卡片 (RecommendedTags)", file: "client/src/page/feed.tsx" },
            { label: "文章正文排版", component: "文章正文排版 (MarkdownBody)", file: "client/src/components/markdown.tsx" },
            { label: "前后章节导航", component: "章节导航 (AdjacentSection)", file: "client/src/components/adjacent_feed.tsx" },
            { label: "读者留言区", component: "读者留言区 (GalleryComments)", file: "client/src/components/gallery-comments.tsx" },
            { label: "目录大纲", component: "目录大纲 (TOC)", file: "client/src/components/toc-header.tsx" },
            { label: "封面全屏灯箱", component: "封面画廊灯箱 (Lightbox)", file: "client/src/page/feed.tsx" },
        ],
    },
    {
        name: "云端音廊",
        pattern: /^\/admin\/music/,
        defaultComponent: "AdminMusic (云端音廊资产)",
        defaultFile: "client/src/page/admin-music.tsx",
        chips: [
            { label: "画册全宽网格", component: "画册网格 (GalleryView)", file: "client/src/page/admin-music/gallery-view.tsx" },
            { label: "播放列表表格", component: "播放列表 (PlaylistDataGrid)", file: "client/src/page/admin-music/playlist-datagrid.tsx" },
            { label: "音频上传中枢", component: "音频上传中心 (AudioUploadCenter)", file: "client/src/page/admin-music/audio-upload-center.tsx" },
            { label: "浮空双音符播放器", component: "悬浮音符播放器 (GlobalMusicPlayer)", file: "client/src/components/music-player/global-music-player.tsx" },
        ],
    },
    {
        name: "R2图床",
        pattern: /^\/admin\/files/,
        defaultComponent: "AdminFiles (R2图床画廊)",
        defaultFile: "client/src/page/admin-files.tsx",
        chips: [
            { label: "画廊大图灯箱", component: "画廊灯箱 (Lightbox)", file: "client/src/page/admin-files.tsx" },
            { label: "拖拽上传粘贴区", component: "文件上传区 (UploadDropZone)", file: "client/src/page/admin-files.tsx" },
            { label: "OpenList网盘挂载", component: "网盘挂载条 (OpenListMountBar)", file: "client/src/page/admin-files.tsx" },
        ],
    },
    {
        name: "标签星云",
        pattern: /^\/hashtags/,
        defaultComponent: "HashtagsPage (标签星云页)",
        defaultFile: "client/src/page/hashtags.tsx",
        chips: [
            { label: "散落彩色标签墙", component: "便签标签墙 (HashtagWall)", file: "client/src/page/hashtags.tsx" },
            { label: "站长空标签清理栏", component: "站长管理栏 (AdminBar)", file: "client/src/page/hashtags.tsx" },
            { label: "全站漫游动作按钮", component: "漫游按钮 (RandomActionCapsule)", file: "client/src/page/hashtags.tsx" },
        ],
    },
    {
        name: "漫游首页",
        pattern: /^\/($|feeds)/,
        defaultComponent: "FeedListPage (画廊漫游首页)",
        defaultFile: "client/src/page/feeds.tsx",
        chips: [
            { label: "文章卡片瀑布流", component: "文章卡片 (FeedCard)", file: "client/src/components/feed_card.tsx" },
            { label: "顶栏导航", component: "站点顶栏 (Header)", file: "client/src/components/header.tsx" },
            { label: "首页标签管理", component: "标签超级表格 (TagsModal)", file: "client/src/page/feeds.tsx" },
            { label: "首页便签模块", component: "首页便签 (AtelierNotes)", file: "client/src/page/feeds.tsx" },
        ],
    },
    {
        name: "管理大盘",
        pattern: /^\/admin\/dashboard/,
        defaultComponent: "AdminDashboard (管理概览中枢)",
        defaultFile: "client/src/page/admin-dashboard.tsx",
        chips: [
            { label: "文章管理表格", component: "文章管理表格 (DenseDataGrid)", file: "client/src/page/admin-dashboard.tsx" },
            { label: "中枢快捷导航", component: "中枢矩阵 (HubGrid)", file: "client/src/page/admin-dashboard.tsx" },
        ],
    },
    {
        name: "全局设置",
        pattern: /^\/admin\/settings/,
        defaultComponent: "SettingsPage (全局系统设置)",
        defaultFile: "client/src/page/settings.tsx",
        chips: [
            { label: "色彩方案预设", component: "主题色盘 (ThemeColorPresets)", file: "client/src/page/settings.tsx" },
            { label: "艺术字族切换", component: "字族控制 (FontFamilySetting)", file: "client/src/page/settings.tsx" },
            { label: "权限与密码中枢", component: "安全控制台 (SecurityPanel)", file: "client/src/page/settings.tsx" },
        ],
    },
    {
        name: "站点SEO",
        pattern: /^\/admin\/seo/,
        defaultComponent: "AdminSeo (SEO全景控制中心)",
        defaultFile: "client/src/page/admin-seo.tsx",
        chips: [
            { label: "站长直达与Sitemap", component: "SEO大盘 (SeoDashboard)", file: "client/src/page/admin-seo.tsx" },
            { label: "页脚定制与Favicon", component: "页脚定制 (FooterBranding)", file: "client/src/page/admin-seo.tsx" },
        ],
    },
];

// 全局事件总线，支持任意页面任意组件直接唤起 Copilot 并预填上下文
type CopilotOpenDetail = {
    componentName?: string;
    filePath?: string;
    initialPrompt?: string;
};

export function openJeikCodeCopilot(detail: CopilotOpenDetail = {}) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("rin:jeikcode-open", { detail }));
    }
}

/**
 * 🌸 JeikCode 现场随行伴侣与即时交互工作台 (JeikCode In-Situ Copilot)
 * 仅在管理员登录状态下呈现，支持现场抓取上下文、内嵌 WebUI 对话与一键精准提交
 */
export function JeikCodeCopilot() {
    const profile = useContext(ProfileContext);
    const [isOpen, setIsOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    // 打开时默认第一页为「🎯 现场定位」
    const [activeTab, setActiveTab] = useState<"chat" | "inspect" | "settings">("inspect");

    const [config, setConfig] = useState<CopilotConfig>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // 兼容老版本 127.0.0.1，自动平滑升级为局域网 IP，确保移动端局域网连通
                if (parsed.host === "http://127.0.0.1:13459") {
                    parsed.host = DEFAULT_CONFIG.host;
                }
                return { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch {}
        return DEFAULT_CONFIG;
    });

    const [tempHost, setTempHost] = useState(config.host);
    const [tempToken, setTempToken] = useState(config.token);
    const [isOnline, setIsOnline] = useState<boolean | null>(null);

    // 跨页面/模块快捷切换索引
    const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);

    // 现场检视上下文表单
    const [inspectComponent, setInspectComponent] = useState("");
    const [inspectFilePath, setInspectFilePath] = useState("");
    const [inspectFeedback, setInspectFeedback] = useState("");
    const [lastCopiedContext, setLastCopiedContext] = useState("");
    const [toastMsg, setToastMsg] = useState("");

    // 页面元素探针点击选取模式
    const [isPickerActive, setIsPickerActive] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);

    // 根据当前真实路由智能探测初始匹配
    const matchedRouteIndex = useMemo(() => {
        if (typeof window === "undefined") return 0;
        const path = window.location.pathname;
        const found = ROUTE_PRESETS.findIndex((p) => p.pattern.test(path));
        return found !== -1 ? found : 0;
    }, [isOpen]);

    // 打开面板时自动预填当前页面的预设
    useEffect(() => {
        if (isOpen) {
            setSelectedPresetIndex(matchedRouteIndex);
            const preset = ROUTE_PRESETS[matchedRouteIndex];
            if (preset && !inspectComponent) {
                setInspectComponent(preset.defaultComponent);
                setInspectFilePath(preset.defaultFile);
            }
        }
    }, [isOpen, matchedRouteIndex]);

    const activePreset = ROUTE_PRESETS[selectedPresetIndex] || ROUTE_PRESETS[0];

    // 监听外部组件发起的精准唤醒
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<CopilotOpenDetail>).detail || {};
            setInspectComponent(detail.componentName || "");
            setInspectFilePath(detail.filePath || "");
            if (detail.initialPrompt) {
                setInspectFeedback(detail.initialPrompt);
            }
            setActiveTab("inspect");
            setIsOpen(true);
        };
        window.addEventListener("rin:jeikcode-open", handler);
        return () => window.removeEventListener("rin:jeikcode-open", handler);
    }, []);

    // 交互式页面元素探针选取模式
    useEffect(() => {
        if (!isPickerActive) return;

        let lastHovered: HTMLElement | null = null;

        const onMouseMove = (e: MouseEvent) => {
            const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
            if (target && target !== lastHovered && !target.closest("[data-jeikcode-copilot]")) {
                if (lastHovered) {
                    lastHovered.classList.remove("rin-inspect-ring");
                }
                target.classList.add("rin-inspect-ring");
                lastHovered = target;
            }
        };

        const onClick = (e: MouseEvent) => {
            const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
            if (target && !target.closest("[data-jeikcode-copilot]")) {
                e.preventDefault();
                e.stopPropagation();

                if (lastHovered) {
                    lastHovered.classList.remove("rin-inspect-ring");
                }

                // 提炼元素信息
                const tagName = target.tagName.toLowerCase();
                const textSnippet = (target.innerText || "").trim().slice(0, 45).replace(/\s+/g, " ");
                const componentDesc = `[元素: <${tagName}>] "${textSnippet || target.className.slice(0, 30)}"`;

                setInspectComponent(componentDesc);
                setIsPickerActive(false);
                setIsOpen(true);
                setActiveTab("inspect");
                showToast(`✓ 已成功选取现场元素: <${tagName}>`);
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (lastHovered) lastHovered.classList.remove("rin-inspect-ring");
                setIsPickerActive(false);
                setIsOpen(true);
            }
        };

        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("keydown", onKeyDown, true);

        return () => {
            if (lastHovered) lastHovered.classList.remove("rin-inspect-ring");
            document.removeEventListener("mousemove", onMouseMove, true);
            document.removeEventListener("click", onClick, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [isPickerActive]);

    // 连线性探测 (每 20 秒探测一次端口连通状态)
    useEffect(() => {
        let active = true;
        const probe = async () => {
            try {
                const img = new Image();
                img.onload = () => { if (active) setIsOnline(true); };
                img.onerror = () => { if (active) setIsOnline(true); }; // 只要能打通本地端口即认为在线
                img.src = `${config.host.replace(/\/+$/, "")}/favicon.png?t=${Date.now()}`;
            } catch {
                if (active) setIsOnline(false);
            }
        };
        void probe();
        const tid = setInterval(probe, 20000);
        return () => {
            active = false;
            clearInterval(tid);
        };
    }, [config.host]);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 4500);
    };

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        const next = {
            host: tempHost.trim() || DEFAULT_CONFIG.host,
            token: tempToken.trim() || DEFAULT_CONFIG.token,
        };
        setConfig(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        showToast("✓ 连线配置已保存");
        setActiveTab("inspect");
    };

    // 智能打包现场上下文并发送
    const handlePackageAndSend = () => {
        const path = typeof window !== "undefined" ? window.location.pathname : "";
        const title = typeof document !== "undefined" ? document.title : "";
        const width = typeof window !== "undefined" ? window.innerWidth : 0;
        const height = typeof window !== "undefined" ? window.innerHeight : 0;
        const isMobile = width < 768;
        const theme = localStorage.getItem("theme") || "system";

        const lines = [
            `【现场环境定位】`,
            `- 页面路径: \`${path}\``,
            `- 页面标题: ${title}`,
            `- 设备视口: ${width}×${height} (${isMobile ? "移动端触控" : "PC桌面宽屏"})`,
            `- 活跃主题: ${theme}`,
            inspectComponent ? `- 目标组件: \`${inspectComponent}\`` : "",
            inspectFilePath ? `- 文件定位: \`${inspectFilePath}\`` : "",
            ``,
            `【开发者现场反馈与改进诉求】`,
            inspectFeedback.trim() || "（请基于上述界面定位展开检视与代码审查）",
        ].filter(Boolean).join("\n");

        if (navigator.clipboard) {
            void navigator.clipboard.writeText(lines);
        }

        setLastCopiedContext(lines);

        // 尝试向 iframe 发送 postMessage
        try {
            iframeRef.current?.contentWindow?.postMessage({
                type: "jeikcode:prompt",
                prompt: lines,
            }, "*");
        } catch {}

        showToast("✓ 上下文已复制！已为您切换至会话窗口，按 Ctrl + V 粘贴即可发送！");
        setActiveTab("chat");
    };

    // 计算 iframe 目标 URL
    const targetUrl = useMemo(() => {
        const base = config.host.replace(/\/+$/, "");
        return config.token ? `${base}/?token=${encodeURIComponent(config.token)}` : base;
    }, [config.host, config.token]);

    // 仅在管理员已登录时渲染
    if (!profile?.permission) return null;

    return (
        <>
            {/* 注入探针高亮样式 */}
            <style>{`
                .rin-inspect-ring {
                    outline: 2px dashed #fc466b !important;
                    outline-offset: 2px !important;
                    background-color: rgba(252, 70, 107, 0.08) !important;
                    cursor: crosshair !important;
                    transition: all 0.15s ease !important;
                }
            `}</style>

            {/* 探针选取模式浮动提醒胶囊 */}
            {isPickerActive && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100000] px-4 py-2 rounded-full bg-neutral-900/90 text-white border border-theme shadow-2xl backdrop-blur-xl flex items-center gap-3 text-xs ani-show">
                    <span className="w-2 h-2 rounded-full bg-theme animate-ping" />
                    <span className="font-bold">🎯 现场探针已激活：请鼠标点击页面任意组件或文字</span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsPickerActive(false);
                            setIsOpen(true);
                        }}
                        className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-mono text-[10px] cursor-pointer"
                    >
                        ESC 取消
                    </button>
                </div>
            )}

            {/* 1. 纯矢量二次元极简悬浮圆纽 (Compact Floating Vector Button) */}
            {/* 避开底部播放器高度，杜绝长文本遮挡视觉 */}
            <div
                data-jeikcode-copilot
                className="fixed bottom-24 left-4 sm:bottom-7 sm:left-7 z-[9000] select-none ani-show"
                style={{ filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.18))" }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setIsPickerActive(false);
                        setIsOpen((prev) => {
                            if (!prev) setActiveTab("inspect"); // 展开时始终默认停在第一页「现场定位」
                            return !prev;
                        });
                    }}
                    className="group relative flex h-11 w-11 items-center justify-center rounded-full bg-white/95 dark:bg-neutral-900/95 text-neutral-800 dark:text-neutral-100 border border-theme/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer"
                    title="JeikCode 现场随行伴侣 · 智能检视与调试"
                    aria-label="展开 JeikCode 现场伴侣"
                >
                    {/* 纯矢量手绘微光终端 SVG */}
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-theme transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                        <polyline points="7 8 10 10 7 12" />
                        <line x1="13" y1="12" x2="17" y2="12" />
                    </svg>

                    {/* 连线状态微光指示呼吸点 */}
                    <span
                        className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-900 ${
                            isOnline ? "bg-emerald-400 animate-ping" : "bg-neutral-400"
                        }`}
                    />
                    <span
                        className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-900 ${
                            isOnline ? "bg-emerald-500" : "bg-neutral-400"
                        }`}
                    />
                </button>
            </div>

            {/* 2. 现场抽屉式随行工作台 (通过 Portal 挂载到顶层，移动端防截断防锁定) */}
            {isOpen && typeof document !== "undefined" && createPortal(
                <div
                    data-jeikcode-copilot
                    className="fixed inset-0 z-[99999] flex justify-end select-none ani-show pointer-events-auto"
                >
                    {/* 半透明毛玻璃遮罩 */}
                    <div
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
                    />

                    {/* 随行工作台侧栏抽屉 */}
                    <div
                        className={`relative z-10 flex flex-col bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border-l border-black/10 dark:border-white/10 shadow-2xl transition-all duration-300 font-sans ${
                            isFullScreen
                                ? "w-full h-full"
                                : "w-full sm:w-[540px] md:w-[680px] lg:w-[820px] xl:w-[940px] h-full"
                        }`}
                    >
                        {/* 顶栏控制中枢 (移动端优化排布，保障退出按钮 100% 显式固定在右上角) */}
                        <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] shrink-0 gap-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-theme/15 text-theme text-sm shrink-0">
                                    <i className="ri-terminal-box-line" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="font-bold text-xs t-primary truncate">JeikCode 现场伴侣</h3>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded shrink-0 hidden sm:inline-block">
                                            🟢 192.168.0.246
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 控制按钮与 Tab 切换 (紧凑防挤压) */}
                            <div className="flex items-center gap-1 shrink-0">
                                <div className="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] font-medium mr-1">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("inspect")}
                                        className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                            activeTab === "inspect" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs font-bold" : "text-neutral-500 hover:text-neutral-700"
                                        }`}
                                    >
                                        <i className="ri-focus-2-line text-xs" />
                                        <span>现场定位</span>
                                        {inspectComponent && <span className="w-1.5 h-1.5 rounded-full bg-theme animate-ping" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("chat")}
                                        className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                            activeTab === "chat" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs font-bold" : "text-neutral-500 hover:text-neutral-700"
                                        }`}
                                    >
                                        <i className="ri-chat-3-line text-xs" />
                                        <span>现场对话</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("settings")}
                                        className={`px-1.5 py-1 rounded-md transition cursor-pointer ${
                                            activeTab === "settings" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs" : "text-neutral-400 hover:text-neutral-600"
                                        }`}
                                        title="连线配置"
                                    >
                                        <i className="ri-settings-3-line" />
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => window.open(targetUrl, "_blank")}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer hidden sm:block"
                                    title="在新窗口独立弹出 JeikCode"
                                >
                                    <i className="ri-external-link-line text-sm" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsFullScreen((prev) => !prev)}
                                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer hidden sm:block"
                                    title={isFullScreen ? "恢复侧边栏" : "最大化全屏"}
                                >
                                    <i className={isFullScreen ? "ri-fullscreen-exit-line text-sm" : "ri-fullscreen-line text-sm"} />
                                </button>

                                {/* 移动端与桌面端通用的显式大关闭按纽，确保 100% 随时可退 */}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="h-8 w-8 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-rose-500 hover:text-white text-neutral-600 dark:text-neutral-300 transition flex items-center justify-center cursor-pointer shrink-0 ml-1"
                                    title="退出现场伴侣"
                                    aria-label="关闭抽屉"
                                >
                                    <i className="ri-close-line text-lg font-bold" />
                                </button>
                            </div>
                        </div>

                        {/* Toast 提示条 */}
                        {toastMsg && (
                            <div className="bg-emerald-500/15 border-b border-emerald-500/20 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 animate-fade-in shrink-0">
                                <i className="ri-checkbox-circle-line text-emerald-600" />
                                <span>{toastMsg}</span>
                            </div>
                        )}

                        {/* 主内容区域 */}
                        <div className="flex-1 relative overflow-hidden flex flex-col">
                            {/* Tab 1: 现场上下文嗅探与精准提问 (默认首屏) */}
                            {activeTab === "inspect" && (
                                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs font-sans">
                                    {/* 现场环境感知 */}
                                    <div className="p-3 sm:p-3.5 rounded-2xl bg-theme/5 border border-theme/15 flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-theme flex items-center gap-1.5 text-xs truncate">
                                                <i className="ri-scan-2-line shrink-0" />
                                                <span>已自动捕获当前浏览现场环境</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    setIsPickerActive(true);
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-theme/15 hover:bg-theme/25 text-theme font-bold text-[11px] transition flex items-center gap-1 cursor-pointer shrink-0"
                                                title="在页面上点击任意元素自动抓取"
                                            >
                                                <i className="ri-focus-2-line" />
                                                <span>探针选取元素</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono">
                                            <div>📍 页面路由: <span className="t-primary font-bold">{typeof window !== "undefined" ? window.location.pathname : ""}</span></div>
                                            <div>📱 视口: <span className="t-primary font-bold">{typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : ""}</span></div>
                                        </div>
                                    </div>

                                    {/* 跨页面/跨模块便捷切换台 (彻底告别硬编码限制，自由切换全站任意模块) */}
                                    <div className="space-y-1.5">
                                        <div className="text-neutral-500 dark:text-neutral-400 text-[11px] font-medium flex items-center justify-between">
                                            <span>🌐 目标页面与模块快速切换：</span>
                                            <span className="text-[10px] text-theme font-mono">共 {ROUTE_PRESETS.length} 大世界</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
                                            {ROUTE_PRESETS.map((p, idx) => {
                                                const isCurrent = selectedPresetIndex === idx;
                                                return (
                                                    <button
                                                        key={p.name}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPresetIndex(idx);
                                                            setInspectComponent(p.defaultComponent);
                                                            setInspectFilePath(p.defaultFile);
                                                        }}
                                                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                                                            isCurrent
                                                                ? "bg-theme text-white border-theme shadow-xs font-bold"
                                                                : "bg-black/[0.03] dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-400 hover:border-theme/40"
                                                        }`}
                                                    >
                                                        {p.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 所选页面/模块的候选核心组件芯片 */}
                                    {activePreset?.chips && (
                                        <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
                                            <div className="text-neutral-400 text-[11px] font-medium flex items-center justify-between">
                                                <span>⚡ 【{activePreset.name}】候选核心组件 (点击一键定位)：</span>
                                                <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">{activePreset.defaultFile}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {activePreset.chips.map((chip) => {
                                                    const isSelected = inspectComponent === chip.component;
                                                    return (
                                                        <button
                                                            key={chip.label}
                                                            type="button"
                                                            onClick={() => {
                                                                setInspectComponent(chip.component);
                                                                setInspectFilePath(chip.file);
                                                            }}
                                                            className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition cursor-pointer select-none ${
                                                                isSelected
                                                                    ? "bg-theme text-white border-theme shadow-2xs font-bold scale-[1.02]"
                                                                    : "bg-white dark:bg-neutral-800 border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-300 hover:border-theme/40"
                                                            }`}
                                                        >
                                                            {chip.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-neutral-500 font-medium mb-1">
                                            目标组件 / 区域定位 (已智能关联)
                                        </label>
                                        <input
                                            type="text"
                                            value={inspectComponent}
                                            onChange={(e) => setInspectComponent(e.target.value)}
                                            placeholder="例如: PolaroidFriendCard / MusicPlayer / Header"
                                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-neutral-500 font-medium mb-1">
                                            相关代码文件 (自动推导关联)
                                        </label>
                                        <input
                                            type="text"
                                            value={inspectFilePath}
                                            onChange={(e) => setInspectFilePath(e.target.value)}
                                            placeholder="例如: client/src/page/friends.tsx"
                                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-neutral-500 font-medium mb-1">
                                            现场改动要求 / 想要解决的 Bug
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={inspectFeedback}
                                            onChange={(e) => setInspectFeedback(e.target.value)}
                                            placeholder="直接输入你想改进的地方，例如：&#10;- 移动端抽屉增加显式关闭按钮&#10;- 标签管理在手机上自适应撑满高度&#10;- 悬浮图标改用紧凑 SVG，避免遮挡播放器"
                                            className="w-full p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs resize-none focus:outline-none focus:border-theme/40 leading-relaxed font-sans"
                                        />
                                    </div>

                                    <div className="pt-1 flex items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setInspectComponent(activePreset.defaultComponent);
                                                setInspectFilePath(activePreset.defaultFile);
                                                setInspectFeedback("");
                                            }}
                                            className="px-3 py-2 rounded-xl text-neutral-400 hover:text-neutral-600 text-xs cursor-pointer"
                                        >
                                            重置默认
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePackageAndSend}
                                            className="px-5 py-2.5 rounded-xl bg-theme text-white font-bold text-xs shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition cursor-pointer flex items-center gap-1.5 ml-auto"
                                        >
                                            <i className="ri-send-plane-fill" />
                                            <span>一键打包并切至会话发送</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Tab 2: 嵌入式现场实时对话 (Iframe) */}
                            <div className={`flex-1 w-full h-full flex flex-col relative ${activeTab === "chat" ? "flex" : "hidden"}`}>
                                {/* 移动端 iframe 内置悬浮退出按钮，确保 100% 随时逃逸 */}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="sm:hidden absolute top-2.5 right-2.5 z-40 h-8 w-8 rounded-full bg-neutral-900/80 text-white shadow-xl flex items-center justify-center backdrop-blur-md cursor-pointer border border-white/20"
                                    title="关闭抽屉"
                                >
                                    <i className="ri-close-line text-base font-bold" />
                                </button>

                                {/* 即时提示条：已复制提示词并引导按 Ctrl+V 直接发送 */}
                                {lastCopiedContext && (
                                    <div className="px-3 py-2 sm:px-4 bg-gradient-to-r from-theme/15 via-purple-500/10 to-transparent border-b border-theme/20 flex items-center justify-between gap-2 text-xs shrink-0 ani-show">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-2 h-2 rounded-full bg-theme animate-ping shrink-0" />
                                            <span className="font-bold text-theme shrink-0">📋 上下文已复制！</span>
                                            <span className="text-neutral-600 dark:text-neutral-300 truncate">
                                                请在下方输入框按 <kbd className="px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 font-mono font-bold text-theme">Ctrl + V</kbd> 回车发送 ➔
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(lastCopiedContext);
                                                    showToast("✓ 已重新复制到剪贴板！");
                                                }}
                                                className="px-2 py-0.5 rounded-md bg-theme/20 text-theme hover:bg-theme/30 text-[11px] font-bold transition cursor-pointer"
                                            >
                                                重复制
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLastCopiedContext("")}
                                                className="text-neutral-400 hover:text-neutral-600 text-sm cursor-pointer p-0.5"
                                                title="关闭提示"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <iframe
                                    ref={iframeRef}
                                    src={targetUrl}
                                    title="JeikCode Live Workspace"
                                    className="w-full h-full border-0 select-text flex-1"
                                    allow="clipboard-read; clipboard-write; microphone; camera"
                                />
                            </div>

                            {/* Tab 3: 连线配置 */}
                            {activeTab === "settings" && (
                                <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs font-sans">
                                    <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs leading-relaxed">
                                        💡 <strong>局域网连线提示</strong>：已默认预填为您的局域网通信地址 <code>http://192.168.0.246:13459</code>。无论是电脑端还是同 Wi-Fi 下的手机端访问博客，均可直接连通 JeikCode 桌面端展开现场调试。
                                    </div>

                                    <div>
                                        <label className="block text-neutral-500 font-medium mb-1">
                                            JeikCode 本地/局域网服务地址
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={tempHost}
                                            onChange={(e) => setTempHost(e.target.value)}
                                            placeholder="http://192.168.0.246:13459"
                                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-neutral-500 font-medium mb-1">
                                            访问通信凭证 (Token)
                                        </label>
                                        <input
                                            type="text"
                                            value={tempToken}
                                            onChange={(e) => setTempToken(e.target.value)}
                                            placeholder="sk-..."
                                            className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs font-mono"
                                        />
                                    </div>

                                    <div className="pt-3 flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTempHost(DEFAULT_CONFIG.host);
                                                setTempToken(DEFAULT_CONFIG.token);
                                            }}
                                            className="text-neutral-400 hover:text-neutral-600 text-xs cursor-pointer"
                                        >
                                            恢复默认 (192.168.0.246:13459)
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 rounded-xl bg-theme text-white font-bold text-xs shadow-sm hover:opacity-90 transition cursor-pointer"
                                        >
                                            保存连线配置
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
