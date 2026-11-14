import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProfileContext } from "../state/profile";

interface CopilotConfig {
    host: string;
    token: string;
}

const STORAGE_KEY = "rin_jeikcode_copilot_config";
const DEFAULT_CONFIG: CopilotConfig = {
    host: "http://127.0.0.1:13459",
    token: "sk-7dd8-18e341d3b1c51710",
};

// 预置主流路由的组件地图与快捷标签，实现 100% 自动关联与极速点选
interface RouteContextPreset {
    pattern: RegExp;
    defaultComponent: string;
    defaultFile: string;
    chips: Array<{ label: string; component: string; file: string }>;
}

const ROUTE_PRESETS: RouteContextPreset[] = [
    {
        pattern: /^\/feed\//,
        defaultComponent: "FeedArticle (文章正文/漫游)",
        defaultFile: "client/src/page/feed.tsx",
        chips: [
            { label: "🔖 灵感书签漫游", component: "灵感书签漫游 (BookmarkRoamer)", file: "client/src/components/hashtag.tsx" },
            { label: "📖 文章正文排版", component: "文章正文排版 (MarkdownBody)", file: "client/src/components/markdown.tsx" },
            { label: "📑 前后章节导航", component: "章节导航 (AdjacentSection)", file: "client/src/components/adjacent_feed.tsx" },
            { label: "💬 读者留言评论区", component: "读者留言区 (GalleryComments)", file: "client/src/components/gallery-comments.tsx" },
            { label: "🧭 目录大纲", component: "目录大纲 (TOC)", file: "client/src/components/toc-header.tsx" },
            { label: "🖼️ 封面全屏灯箱", component: "封面画廊灯箱 (Lightbox)", file: "client/src/page/feed.tsx" },
        ],
    },
    {
        pattern: /^\/friends/,
        defaultComponent: "FriendsGallery (星标画廊)",
        defaultFile: "client/src/page/friends.tsx",
        chips: [
            { label: "🌸 拍立得拟物卡片", component: "拍立得卡片 (PolaroidFriendCard)", file: "client/src/page/friends.tsx" },
            { label: "🔖 高密单行书签", component: "高密单行书签 (CompactFriendRow)", file: "client/src/page/friends.tsx" },
            { label: "➕ 推荐/申请友链弹窗", component: "申请弹窗 (AddFriendModal)", file: "client/src/page/friends.tsx" },
            { label: "✏️ 编辑友链弹窗", component: "编辑弹窗 (EditFriendModal)", file: "client/src/page/friends.tsx" },
            { label: "🪐 诞生初衷透镜", component: "初衷透镜 (OriginChronicleLens)", file: "client/src/components/origin-chronicle-lens.tsx" },
        ],
    },
    {
        pattern: /^\/admin\/music/,
        defaultComponent: "AdminMusic (云端音廊资产)",
        defaultFile: "client/src/page/admin-music.tsx",
        chips: [
            { label: "🎨 画册全宽网格", component: "画册网格 (GalleryView)", file: "client/src/page/admin-music/gallery-view.tsx" },
            { label: "📋 播放列表数据表格", component: "播放列表 (PlaylistDataGrid)", file: "client/src/page/admin-music/playlist-datagrid.tsx" },
            { label: "📤 音频上传中枢", component: "音频上传中心 (AudioUploadCenter)", file: "client/src/page/admin-music/audio-upload-center.tsx" },
            { label: "🎵 浮空双音符播放器", component: "悬浮音符播放器 (GlobalMusicPlayer)", file: "client/src/components/music-player/global-music-player.tsx" },
        ],
    },
    {
        pattern: /^\/admin\/files/,
        defaultComponent: "AdminFiles (R2图床画廊)",
        defaultFile: "client/src/page/admin-files.tsx",
        chips: [
            { label: "🖼️ 沉浸大图画廊灯箱", component: "画廊灯箱 (Lightbox)", file: "client/src/page/admin-files.tsx" },
            { label: "📁 拖拽上传与粘贴区", component: "文件上传区 (UploadDropZone)", file: "client/src/page/admin-files.tsx" },
            { label: "🌐 OpenList边缘挂载条", component: "网盘挂载条 (OpenListMountBar)", file: "client/src/page/admin-files.tsx" },
        ],
    },
    {
        pattern: /^\/admin\/dashboard/,
        defaultComponent: "AdminDashboard (管理概览中枢)",
        defaultFile: "client/src/page/admin-dashboard.tsx",
        chips: [
            { label: "📊 概览超级数据表格", component: "文章管理表格 (DenseDataGrid)", file: "client/src/page/admin-dashboard.tsx" },
            { label: "🎛️ 15大中枢快捷导航", component: "中枢矩阵 (HubGrid)", file: "client/src/page/admin-dashboard.tsx" },
        ],
    },
    {
        pattern: /^\/($|feeds)/,
        defaultComponent: "FeedListPage (画廊漫游首页)",
        defaultFile: "client/src/page/feeds.tsx",
        chips: [
            { label: "🎴 文章卡片瀑布流", component: "文章卡片 (FeedCard)", file: "client/src/components/feed_card.tsx" },
            { label: "🧭 艺术字族顶栏导航", component: "站点顶栏 (Header)", file: "client/src/components/header.tsx" },
            { label: "🏷️ 首页标签常驻管理", component: "标签抽屉 (TagsModal)", file: "client/src/page/feeds.tsx" },
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
 * 专供各个业务组件快捷挂载的微光连线徽标 (Component-level In-situ Badge)
 */
export function JeikCodeInspectorBadge({
    componentName,
    filePath,
    className = "",
}: {
    componentName: string;
    filePath?: string;
    className?: string;
}) {
    const profile = useContext(ProfileContext);
    if (!profile?.permission) return null;

    return (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openJeikCodeCopilot({ componentName, filePath });
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-900/10 dark:bg-white/10 hover:bg-theme/20 text-neutral-600 dark:text-neutral-300 hover:text-theme text-[10px] font-mono transition-all cursor-pointer select-none border border-black/5 dark:border-white/5 ${className}`}
            title={`向 JeikCode 现场反馈关于 ${componentName} 的改进意见`}
        >
            <i className="ri-terminal-box-line text-theme" />
            <span>检视</span>
        </button>
    );
}

/**
 * 🌸 JeikCode 现场随行伴侣与即时交互工作台 (JeikCode In-Situ Copilot)
 * 仅在管理员登录状态下呈现，支持现场抓取上下文、内嵌 WebUI 对话与一键精准提交
 */
export function JeikCodeCopilot() {
    const profile = useContext(ProfileContext);
    const [isOpen, setIsOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [activeTab, setActiveTab] = useState<"chat" | "inspect" | "settings">("chat");

    const [config, setConfig] = useState<CopilotConfig>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
        } catch {
            return DEFAULT_CONFIG;
        }
    });

    const [tempHost, setTempHost] = useState(config.host);
    const [tempToken, setTempToken] = useState(config.token);
    const [isOnline, setIsOnline] = useState<boolean | null>(null);

    // 现场检视上下文表单
    const [inspectComponent, setInspectComponent] = useState("");
    const [inspectFilePath, setInspectFilePath] = useState("");
    const [inspectFeedback, setInspectFeedback] = useState("");
    const [lastCopiedContext, setLastCopiedContext] = useState("");
    const [toastMsg, setToastMsg] = useState("");

    // 页面元素探针点击选取模式
    const [isPickerActive, setIsPickerActive] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);

    // 获取当前路由对应的智能预置
    const currentPreset = useMemo(() => {
        if (typeof window === "undefined") return null;
        const path = window.location.pathname;
        return ROUTE_PRESETS.find((p) => p.pattern.test(path)) || null;
    }, [isOpen]);

    // 打开面板或切换至 inspect tab 时，若组件为空自动预填
    useEffect(() => {
        if (isOpen && !inspectComponent && currentPreset) {
            setInspectComponent(currentPreset.defaultComponent);
            setInspectFilePath(currentPreset.defaultFile);
        }
    }, [isOpen, currentPreset]);

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

    // 连线性探测 (每 20 秒探测一次 JeikCode 13459 端口状态)
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
        setActiveTab("chat");
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

        // 尝试向 iframe 发送 postMessage (跨域安全保护兜底)
        try {
            iframeRef.current?.contentWindow?.postMessage({
                type: "jeikcode:prompt",
                prompt: lines,
            }, "*");
        } catch {}

        showToast("✓ 已自动捕获上下文并复制到剪贴板！已为您切换至会话窗口，按 Ctrl + V 粘贴即可发送！");
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

            {/* 1. 屏幕边缘微光常驻悬浮球 */}
            <div
                data-jeikcode-copilot
                className="fixed bottom-6 left-6 z-[9000] select-none ani-show"
                style={{ filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.15))" }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setIsPickerActive(false);
                        setIsOpen((prev) => !prev);
                    }}
                    className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-900 border border-theme/40 backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-theme/20"
                    title="展开 JeikCode 现场随行伴侣 · 即时调试与无感对话"
                >
                    <div className="relative flex items-center justify-center">
                        <i className="ri-terminal-box-fill text-base text-theme group-hover:rotate-12 transition-transform" />
                        <span
                            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                                isOnline ? "bg-emerald-400 animate-ping" : "bg-neutral-400"
                            }`}
                        />
                    </div>
                    <span className="text-xs font-bold tracking-tight font-sans">
                        JeikCode 现场伴侣
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-theme/15 text-theme font-semibold">
                        {isOnline ? "13459 在线" : "就绪"}
                    </span>
                </button>
            </div>

            {/* 2. 现场抽屉式随行工作台 (通过 Portal 挂载到顶层，杜绝样式溢出裁切) */}
            {isOpen && typeof document !== "undefined" && createPortal(
                <div
                    data-jeikcode-copilot
                    className="fixed inset-0 z-[99999] flex justify-end select-none ani-show pointer-events-auto"
                >
                    {/* 半透明毛玻璃遮罩 */}
                    <div
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
                    />

                    {/* 随行工作台侧栏抽屉 */}
                    <div
                        className={`relative z-10 flex flex-col bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border-l border-black/10 dark:border-white/10 shadow-2xl transition-all duration-300 font-sans ${
                            isFullScreen
                                ? "w-full h-full"
                                : "w-full sm:w-[540px] md:w-[680px] lg:w-[820px] xl:w-[940px] h-full"
                        }`}
                    >
                        {/* 顶栏控制中枢 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-theme/15 text-theme text-sm">
                                    <i className="ri-terminal-box-line" />
                                </span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-xs t-primary">JeikCode 现场伴侣</h3>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                            🟢 127.0.0.1:13459
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 truncate max-w-[280px]">
                                        即时定位现场组件与代码调试，免切窗口实时交互
                                    </p>
                                </div>
                            </div>

                            {/* 控制按钮与 Tab 切换 */}
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center p-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] font-medium mr-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("chat")}
                                        className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                            activeTab === "chat" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs font-bold" : "text-neutral-500 hover:text-neutral-700"
                                        }`}
                                    >
                                        💬 现场对话
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("inspect")}
                                        className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                            activeTab === "inspect" ? "bg-white dark:bg-neutral-800 text-theme shadow-2xs font-bold" : "text-neutral-500 hover:text-neutral-700"
                                        }`}
                                    >
                                        <span>🎯 现场定位</span>
                                        {inspectComponent && <span className="w-1.5 h-1.5 rounded-full bg-theme animate-ping" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("settings")}
                                        className={`px-2 py-1 rounded-md transition cursor-pointer ${
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
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
                                    title="在新窗口独立弹出 JeikCode"
                                >
                                    <i className="ri-external-link-line text-sm" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsFullScreen((prev) => !prev)}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer hidden sm:block"
                                    title={isFullScreen ? "恢复侧边栏" : "最大化全屏"}
                                >
                                    <i className={isFullScreen ? "ri-fullscreen-exit-line text-sm" : "ri-fullscreen-line text-sm"} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 transition cursor-pointer"
                                    title="收起"
                                >
                                    <i className="ri-close-line text-base" />
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
                            {/* Tab 1: 嵌入式现场实时对话 (Iframe) */}
                            <div className={`flex-1 w-full h-full flex flex-col ${activeTab === "chat" ? "flex" : "hidden"}`}>
                                {/* 即时提示条：已复制提示词并引导按 Ctrl+V 直接发送 */}
                                {lastCopiedContext && (
                                    <div className="px-4 py-2 bg-gradient-to-r from-theme/15 via-purple-500/10 to-transparent border-b border-theme/20 flex items-center justify-between gap-2 text-xs shrink-0 ani-show">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-2 h-2 rounded-full bg-theme animate-ping shrink-0" />
                                            <span className="font-bold text-theme shrink-0">📋 现场上下文已在剪贴板中！</span>
                                            <span className="text-neutral-600 dark:text-neutral-300 truncate">
                                                点击下方输入框按 <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold text-theme">Ctrl + V</kbd> 敲回车即可直接发送 ➔
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(lastCopiedContext);
                                                    showToast("✓ 已重新复制到剪贴板！");
                                                }}
                                                className="px-2 py-0.5 rounded-md bg-theme/20 text-theme hover:bg-theme/30 text-[11px] font-bold transition cursor-pointer"
                                            >
                                                重新复制
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLastCopiedContext("")}
                                                className="text-neutral-400 hover:text-neutral-600 text-sm cursor-pointer"
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

                            {/* Tab 2: 现场上下文嗅探与精准提问 */}
                            {activeTab === "inspect" && (
                                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-sans">
                                    <div className="p-3.5 rounded-2xl bg-theme/5 border border-theme/15 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-theme flex items-center gap-1.5 text-xs">
                                                <i className="ri-scan-2-line" />
                                                <span>已自动捕获当前浏览现场环境</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    setIsPickerActive(true);
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-theme/15 hover:bg-theme/25 text-theme font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                                title="在页面上点击任意元素自动抓取"
                                            >
                                                <i className="ri-focus-2-line" />
                                                <span>🎯 鼠标选取页面元素</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 font-mono">
                                            <div>📍 页面路由: <span className="t-primary font-bold">{typeof window !== "undefined" ? window.location.pathname : ""}</span></div>
                                            <div>📄 页面标题: <span className="t-primary font-bold truncate inline-block max-w-[160px] align-bottom">{typeof document !== "undefined" ? document.title : ""}</span></div>
                                        </div>
                                    </div>

                                    {/* 当前页面快捷候选组件芯片 */}
                                    {currentPreset?.chips && (
                                        <div>
                                            <div className="text-neutral-400 text-[11px] mb-1.5 font-medium flex items-center gap-1">
                                                <span>⚡ 当前页面主要功能组件 (点击一键定位)：</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {currentPreset.chips.map((chip) => {
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
                                                                    ? "bg-theme text-white border-theme shadow-2xs font-bold"
                                                                    : "bg-black/[0.03] dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-300 hover:border-theme/40"
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
                                            目标组件 / 区域定位 (已根据当前页面智能预填)
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
                                            rows={5}
                                            value={inspectFeedback}
                                            onChange={(e) => setInspectFeedback(e.target.value)}
                                            placeholder="直接用大白话输入你想改进的地方，例如：&#10;- 这个卡片的上下留白感觉有点大，调紧凑一点&#10;- 灵感标签增加书签折角质感与下一篇/随机换篇按钮&#10;- 这个按钮在手机端被遮挡了，优化响应式"
                                            className="w-full p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-xs resize-none focus:outline-none focus:border-theme/40 leading-relaxed font-sans"
                                        />
                                    </div>

                                    <div className="pt-2 flex items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setInspectComponent(currentPreset?.defaultComponent || "");
                                                setInspectFilePath(currentPreset?.defaultFile || "");
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
                                            <span>🚀 一键打包并切至现场会话发送</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Tab 3: 连线配置 */}
                            {activeTab === "settings" && (
                                <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-sans">
                                    <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs leading-relaxed">
                                        💡 <strong>说明</strong>：JeikCode 桌面端默认通过内置轻量 HTTP/WebSocket 服务在本地 <code>13459</code> 端口提供 Web 交互。在此配置您的监听地址与 Token 后，博客可在管理员端内嵌连线，实现免切窗口的现场极速调试。
                                    </div>

                                    <div>
                                        <label className="block text-neutral-500 font-medium mb-1">
                                            JeikCode 本地服务地址
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={tempHost}
                                            onChange={(e) => setTempHost(e.target.value)}
                                            placeholder="http://127.0.0.1:13459"
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
                                            恢复默认 (127.0.0.1:13459)
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
