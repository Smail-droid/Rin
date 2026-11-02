import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { client } from "../app/runtime";
import { getStoredThemeMode, setThemeMode, useColorMode, type ThemeMode } from "../utils/darkModeUtils";

export type NavItem = {
  href: string;
  icon: string;
  label: string;
  tag?: string;
  children?: { href: string; label: string; tag?: string }[];
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", icon: "ri-dashboard-3-line", label: "画廊概览", tag: "CORE" },
  { href: "/admin/writing", icon: "ri-quill-pen-line", label: "文章撰写", tag: "WRITE" },
  { href: "/admin/files", icon: "ri-folder-image-line", label: "图床媒体", tag: "MEDIA" },
  { href: "/admin/settings?tab=general", icon: "ri-equalizer-line", label: "基础设置", tag: "BASIC" },
  {
    href: "/admin/settings?tab=atelier",
    icon: "ri-palette-line",
    label: "画廊进阶",
    tag: "ADV",
    children: [
      { href: "/admin/settings?tab=atelier&focus=about", label: "便签配置", tag: "NOTES" },
      { href: "/admin/settings?tab=theme", label: "主题字效", tag: "FONTS" },
      { href: "/admin/settings?tab=atelier&focus=deck", label: "相册卡片", tag: "DECK" },
    ],
  },
  { href: "/admin/tags", icon: "ri-price-tag-3-line", label: "分类标签", tag: "TAGS" },
  { href: "/admin/ai", icon: "ri-sparkling-fill", label: "智能助手", tag: "AI" },
  { href: "/admin/queue-status", icon: "ri-todo-line", label: "队列监控", tag: "QUEUE" },
  { href: "/admin/openlist", icon: "ri-hard-drive-2-line", label: "资源列表", tag: "LIST" },
  { href: "/admin/access", icon: "ri-shield-keyhole-line", label: "访问权限", tag: "LOCK" },
  { href: "/admin/tokens", icon: "ri-key-2-line", label: "口令生成", tag: "AUTH" },
  { href: "/admin/health", icon: "ri-heart-pulse-line", label: "健康诊断", tag: "DIAG" },
  { href: "/admin/compat-tasks", icon: "ri-history-line", label: "兼容回填", tag: "TASKS" },
];

export function AdminLayout({
  title,
  description: _description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const siteConfig = useSiteConfig();
  const [location] = useLocation();
  const colorMode = useColorMode();

  // 侧边栏固定锁定状态 (Pin)
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem("rin_admin_sidebar_pinned") === "true";
  });

  // 鼠标悬停展开状态
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isPinned || isHovered;

  // 快捷搜索菜单
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 界面缩放状态
  const [adminZoom, setAdminZoom] = useState<number>(() => {
    if (typeof localStorage === "undefined") return 100;
    const stored = localStorage.getItem("rin_admin_zoom");
    const parsed = Number.parseInt(stored || "100", 10);
    return Number.isNaN(parsed) ? 100 : Math.min(100, Math.max(50, parsed));
  });

  const handleSetZoom = (val: number) => {
    const clamped = Math.min(100, Math.max(50, val));
    setAdminZoom(clamped);
    try {
      localStorage.setItem("rin_admin_zoom", String(clamped));
    } catch {}
  };

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    try {
      localStorage.setItem("rin_admin_sidebar_pinned", String(next));
    } catch {}
  };

  const toggleTheme = () => {
    const current = getStoredThemeMode();
    const next: ThemeMode = current === "dark" ? "light" : "dark";
    setThemeMode(next);
  };

  const handleLogout = async () => {
    try {
      await client.user.logout();
    } finally {
      window.location.href = "/";
    }
  };

  // 支持键盘快捷键 Ctrl+K 聚焦搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsHovered(true);
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 过滤后的导航菜单
  const filteredNavItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ADMIN_NAV_ITEMS;
    return ADMIN_NAV_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q) || item.tag?.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div
      className="min-h-screen w-full max-w-full bg-[#f8fafc] text-neutral-800 dark:bg-[#12161f] dark:text-[#d1d5db] flex transition-colors duration-200 overflow-x-hidden"
    >
      {/* ====================================================================
          1. 3X-UI 风格迷你图标可折叠侧边栏 (默认收起，Hover/Pin 展开)
          ==================================================================== */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-black/10 bg-white/95 backdrop-blur-2xl dark:border-white/10 dark:bg-[#161b26]/95 shadow-2xl transition-all duration-300 ease-in-out select-none ${
          isExpanded ? "w-64" : "w-[68px]"
        }`}
      >
        {/* Top Area: Logo, Title, Pin, Theme Toggle */}
        <div className="flex flex-col">
          {/* Logo Header Bar */}
          <div className="flex h-16 items-center justify-between px-3.5 border-b border-black/5 dark:border-white/5">
            <Link href="/" className="flex items-center gap-3 min-w-0" title="返回画廊前台">
              {siteConfig.avatar ? (
                <img
                  src={siteConfig.avatar}
                  alt={siteConfig.name || "80Hou"}
                  className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-md ring-2 ring-theme/20"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-theme to-pink-500 text-white font-extrabold text-xs shadow-md">
                  80H
                </span>
              )}
              {isExpanded && (
                <div className="min-w-0 truncate ani-show">
                  <p className="font-extrabold text-sm tracking-tight t-primary truncate">
                    {siteConfig.name || "80Hou's Home"}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    <span>v1.0.0 · 运行中</span>
                  </p>
                </div>
              )}
            </Link>

            {/* Expanded Header Control Icons (Pin, Theme, Front) */}
            {isExpanded && (
              <div className="flex items-center gap-1 ani-show">
                <button
                  type="button"
                  onClick={togglePin}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                    isPinned
                      ? "bg-theme/10 text-theme"
                      : "text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-700 dark:hover:text-neutral-200"
                  }`}
                  title={isPinned ? "取消固定侧边栏 (点击恢复迷你模式)" : "固定侧边栏 (锁定展开宽度)"}
                >
                  <i className={`ri-pushpin-${isPinned ? "fill" : "line"} text-sm ${isPinned ? "text-theme" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
                  title="切换浅色 / 深色主题模式"
                >
                  <i className={colorMode === "dark" ? "ri-sun-line text-amber-400 text-sm" : "ri-moon-line text-sm"} />
                </button>
              </div>
            )}
          </div>

          {/* Quick Search Bar (Ctrl+K) */}
          <div className="p-2 border-b border-black/5 dark:border-white/5">
            {isExpanded ? (
              <div className="relative flex items-center ani-show">
                <i className="ri-search-line absolute left-3 text-neutral-400 text-xs" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索管理功能..."
                  className="w-full rounded-xl border border-black/10 bg-black/[0.02] py-2 pl-8 pr-12 text-xs t-primary placeholder-neutral-400 outline-none focus:border-theme dark:border-white/10 dark:bg-white/[0.03]"
                />
                <span className="absolute right-2.5 rounded border border-black/10 bg-white/80 px-1 py-0.2 text-[9px] font-mono font-bold text-neutral-400 dark:border-white/10 dark:bg-neutral-800">
                  Ctrl K
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsHovered(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="flex h-10 w-full items-center justify-center rounded-xl text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition"
                title="搜索菜单 (Ctrl + K)"
              >
                <i className="ri-search-line text-base" />
              </button>
            )}
          </div>

          {/* Nav Items List */}
          <nav className="flex flex-col gap-1 p-2 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-none">
            {filteredNavItems.map((item) => {
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center rounded-xl transition-all duration-200 ${
                    isExpanded ? "gap-3 px-3 py-2.5" : "h-11 w-full justify-center"
                  } ${
                    isActive
                      ? "bg-theme text-white shadow-md font-semibold"
                      : "text-neutral-600 hover:bg-black/[0.04] dark:text-neutral-400 dark:hover:bg-white/[0.04] dark:hover:text-neutral-200"
                  }`}
                  title={!isExpanded ? item.label : undefined}
                >
                  <i
                    className={`${item.icon} text-lg shrink-0 transition-transform ${
                      isActive ? "scale-110" : "group-hover:scale-110"
                    }`}
                  />

                  {isExpanded && (
                    <div className="flex flex-1 items-center justify-between min-w-0 ani-show">
                      <span className="truncate text-xs font-medium">{item.label}</span>
                      {item.tag && (
                        <span
                          className={`rounded-md px-1.5 py-0.2 text-[9px] font-mono uppercase ${
                            isActive ? "bg-white/20 text-white" : "bg-black/5 text-neutral-400 dark:bg-white/10"
                          }`}
                        >
                          {item.tag}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Active Indicator Bar on Collapsed Mode */}
                  {isActive && !isExpanded && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-white" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Area: AI Drawer, Zoom Controller, Logout, Version */}
        <div className="flex flex-col border-t border-black/5 p-2 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] gap-1">
          {/* AI Copilot Quick Trigger */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("toggle-ai-copilot"));
            }}
            className={`flex items-center rounded-xl bg-theme/5 hover:bg-theme/15 border border-theme/20 transition-all text-theme ${
              isExpanded ? "gap-2.5 px-3 py-2" : "h-10 w-full justify-center"
            }`}
            title="呼出 / 收回 AI 萌娘伴侣"
          >
            <i className="ri-sparkling-fill text-base shrink-0 animate-pulse text-theme" />
            {isExpanded && (
              <div className="flex flex-1 items-center justify-between min-w-0 ani-show">
                <span className="truncate text-xs font-bold">AI 萌娘伴侣</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              </div>
            )}
          </button>

          {/* Zoom Slider Control (Expanded only) */}
          {isExpanded && (
            <div className="mt-1 flex flex-col gap-1 rounded-xl bg-black/[0.02] p-2 dark:bg-white/[0.02] ani-show">
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span>界面缩放</span>
                <span className="text-theme font-bold">{adminZoom}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={adminZoom}
                onChange={(e) => handleSetZoom(Number.parseInt(e.target.value, 10))}
                className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/10"
              />
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[50, 75, 100].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSetZoom(s)}
                    className={`flex-1 rounded py-0.5 text-[9px] font-mono transition select-none ${
                      adminZoom === s
                        ? "bg-theme text-white font-bold"
                        : "text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className={`flex items-center rounded-xl text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition ${
              isExpanded ? "gap-3 px-3 py-2" : "h-10 w-full justify-center"
            }`}
            title="退出登录"
          >
            <i className="ri-logout-box-r-line text-base shrink-0" />
            {isExpanded && <span className="text-xs truncate ani-show font-medium">退出登录</span>}
          </button>

          {/* GitHub Repo & Version Info */}
          <a
            href="https://github.com/Smail-droid/Rin"
            target="_blank"
            rel="noreferrer"
            className={`flex items-center rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition ${
              isExpanded ? "gap-2.5 px-3 py-1.5" : "h-9 w-full justify-center"
            }`}
            title="查看 GitHub 仓库 (Rin Fork v1.0.0)"
          >
            <i className="ri-github-fill text-base shrink-0" />
            {isExpanded && <span className="font-mono text-[10px] opacity-80 ani-show">Rin Fork v1.0.0</span>}
          </a>
        </div>
      </aside>

      {/* ====================================================================
          2. 主工作区与顶部 3X-UI 风格仪表盘控制栏
          ==================================================================== */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isPinned ? "pl-64" : "pl-[68px]"
        }`}
      >
        {/* Top 3X-UI Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-black/5 bg-white/80 px-4 sm:px-6 backdrop-blur-xl dark:border-white/5 dark:bg-[#161b26]/80 select-none">
          {/* Left: Breadcrumbs & Status Tag */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] px-3.5 py-1 text-xs dark:border-white/10 dark:bg-white/[0.02]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-neutral-800 dark:text-neutral-100">后台系统</span>
              <span className="text-neutral-400 font-bold">/</span>
              <span className="font-bold text-theme truncate">{title}</span>
            </div>
            <span className="hidden lg:inline-block font-mono text-[11px] text-neutral-400">
              v1.0.0 · 边缘原生
            </span>
          </div>

          {/* Right: Quick Action Buttons Group */}
          <div className="flex items-center gap-2">
            <Link
              href="/admin/writing"
              className="inline-flex items-center gap-1.5 rounded-xl bg-theme px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-theme-hover active:scale-95 transition"
              title="写文章"
            >
              <i className="ri-quill-pen-line text-sm" />
              <span className="hidden sm:inline">写文章</span>
            </Link>

            <Link
              href="/admin/files"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-w px-3 py-1.5 text-xs font-semibold t-primary shadow-2xs hover:border-theme hover:text-theme dark:border-white/10 transition"
              title="管理 R2 图床相册"
            >
              <i className="ri-folder-image-line text-sm" />
              <span className="hidden sm:inline">图床画廊</span>
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-w px-3 py-1.5 text-xs font-semibold t-primary shadow-2xs hover:border-theme hover:text-theme dark:border-white/10 transition"
              title="回到前台画廊随想"
            >
              <i className="ri-external-link-line text-sm" />
              <span className="hidden sm:inline">前台画廊</span>
            </Link>
          </div>
        </header>

        {/* Main Content Area: 彻底去除大标题Card，把高度全还给操作区 */}
        <main className="flex-1 w-full max-w-full p-3 sm:p-5 lg:p-6 overflow-x-hidden">
          <div className="w-full max-w-full mx-auto flex flex-col gap-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
