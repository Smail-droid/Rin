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
  { href: "/admin/dashboard", icon: "ri-dashboard-3-line", label: "概览" },
  { href: "/admin/writing", icon: "ri-quill-pen-line", label: "撰写" },
  { href: "/admin/files", icon: "ri-folder-image-line", label: "图床" },
  { href: "/admin/settings?tab=general", icon: "ri-equalizer-line", label: "基础" },
  {
    href: "/admin/settings?tab=atelier",
    icon: "ri-palette-line",
    label: "进阶",
    children: [
      { href: "/admin/settings?tab=atelier&focus=about", label: "便签" },
      { href: "/admin/settings?tab=theme", label: "字效" },
      { href: "/admin/settings?tab=atelier&focus=deck", label: "相册" },
    ],
  },
  { href: "/admin/tags", icon: "ri-price-tag-3-line", label: "标签" },
  { href: "/admin/ai", icon: "ri-sparkling-fill", label: "智能" },
  { href: "/admin/queue-status", icon: "ri-todo-line", label: "队列" },
  { href: "/admin/openlist", icon: "ri-hard-drive-2-line", label: "资源" },
  { href: "/admin/access", icon: "ri-shield-keyhole-line", label: "权限" },
  { href: "/admin/tokens", icon: "ri-key-2-line", label: "口令" },
  { href: "/admin/health", icon: "ri-heart-pulse-line", label: "诊断" },
  { href: "/admin/seo", icon: "ri-search-eye-line", label: "SEO" },
  { href: "/admin/compat-tasks", icon: "ri-history-line", label: "回填" },
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
  // 移动端展开侧边栏抽屉状态
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isExpanded = isPinned || isHovered || mobileMenuOpen;

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
      {/* 移动端全屏半透明遮罩背景 (防止点击穿透与视觉闪烁) */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden ani-show"
        />
      )}

      {/* ====================================================================
          1. 3X-UI 风格迷你图标可折叠侧边栏 (默认收起，Hover/Pin 展开)
          ==================================================================== */}
      <aside
        onMouseEnter={() => {
          if (typeof window !== "undefined" && window.innerWidth >= 1024) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (typeof window !== "undefined" && window.innerWidth >= 1024) setIsHovered(false);
        }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-black/10 bg-white/98 backdrop-blur-2xl dark:border-white/10 dark:bg-[#161b26]/98 shadow-2xl transition-all duration-200 ease-in-out select-none ${
          isExpanded ? "w-56 translate-x-0" : "w-[60px] sm:w-[68px] -translate-x-full lg:translate-x-0"
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

          {/* Nav Items List (紧凑行间距与移动端流畅排布) */}
          <nav className="flex flex-col gap-0.5 p-1.5 overflow-y-auto max-h-[calc(100vh-270px)] scrollbar-none">
            {filteredNavItems.map((item) => {
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    // 移动端点击后自动收回展开菜单，流畅无阻碍
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      setIsHovered(false);
                      setIsPinned(false);
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={`group relative flex items-center rounded-xl transition-all duration-150 ${
                    isExpanded ? "gap-2.5 px-3 py-1.5" : "h-9 w-full justify-center"
                  } ${
                    isActive
                      ? "bg-theme text-white shadow-xs font-bold"
                      : "text-neutral-600 hover:bg-black/[0.04] dark:text-neutral-400 dark:hover:bg-white/[0.04] dark:hover:text-neutral-200"
                  }`}
                  title={!isExpanded ? item.label : undefined}
                >
                  <i
                    className={`${item.icon} text-base shrink-0 transition-transform ${
                      isActive ? "scale-105" : "group-hover:scale-105"
                    }`}
                  />

                  {isExpanded && (
                    <div className="flex flex-1 items-center justify-between min-w-0 ani-show">
                      <span className="truncate text-xs font-medium tracking-wide">{item.label}</span>
                    </div>
                  )}

                  {/* Active Indicator Bar on Collapsed Mode */}
                  {isActive && !isExpanded && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-theme dark:bg-white" />
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
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out ${
          isPinned ? "lg:pl-56" : "lg:pl-[68px]"
        } pl-0`}
      >
        {/* Top 3X-UI Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b border-black/5 bg-white/80 px-3 sm:px-6 backdrop-blur-xl dark:border-white/5 dark:bg-[#161b26]/80 select-none">
          {/* Left: Mobile Hamburger & Breadcrumbs */}
          <div className="flex items-center gap-2 min-w-0">
            {/* 移动端汉堡菜单触发按钮 */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 mr-1"
              title="切换后台导航栏"
            >
              <i className={mobileMenuOpen ? "ri-close-line text-lg" : "ri-menu-2-line text-lg"} />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs dark:border-white/10 dark:bg-white/[0.02]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold text-neutral-800 dark:text-neutral-100 hidden sm:inline">后台</span>
              <span className="text-neutral-400 font-bold hidden sm:inline">/</span>
              <span className="font-bold text-theme truncate">{title}</span>
            </div>
            <span className="hidden xl:inline-block font-mono text-[11px] text-neutral-400">
              v1.0.0 · 边缘原生
            </span>
          </div>

          {/* Right: 极客运行状态胶囊 (已移除重复操作按钮，左侧与左上角头像已提供入口) */}
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <span className="hidden md:inline-block text-[11px]">点击左上头像返回画廊</span>
          </div>
        </header>

        {/* Main Content Area: 彻底去除大标题Card，把高度全还给操作区，并响应界面缩放 */}
        <main
          style={adminZoom !== 100 ? { zoom: `${adminZoom}%` } : undefined}
          className="flex-1 w-full max-w-full p-3 sm:p-5 lg:p-6 overflow-x-hidden transition-all duration-200"
        >
          <div className="w-full max-w-full mx-auto flex flex-col gap-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
