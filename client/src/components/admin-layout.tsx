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
  children?: { href: string; label: string }[];
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", icon: "ri-dashboard-3-line", label: "概览" },
  { href: "/admin/writing", icon: "ri-quill-pen-line", label: "撰写" },
  { href: "/admin/tags", icon: "ri-price-tag-3-line", label: "内容" },
  { href: "/admin/files", icon: "ri-folder-image-line", label: "媒体" },
  { href: "/admin/music", icon: "ri-disc-line", label: "音廊" },
  { href: "/admin/openlist", icon: "ri-hard-drive-2-line", label: "网盘" },
  { href: "/admin/queue-status", icon: "ri-todo-line", label: "调度" },
  { href: "/admin/settings", icon: "ri-equalizer-line", label: "设置" },
  { href: "/admin/ops", icon: "ri-heart-pulse-line", label: "运维" },
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

  // 移动端菜单开关
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 快捷搜索菜单
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
        setSearchOpen((prev) => !prev);
        setTimeout(() => searchInputRef.current?.focus(), 50);
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
      (item) => item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen w-full max-w-full bg-[#f8fafc] text-neutral-800 dark:bg-[#12161f] dark:text-[#d1d5db] flex transition-colors duration-200 overflow-x-hidden">
      {/* 移动端全屏半透明遮罩背景 */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden ani-show"
        />
      )}

      {/* ====================================================================
          1. 紧凑型专业侧边栏 (向日葵专业暗黑风格：深炭黑底色 #18181b / #1f1f23)
          ==================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-black/10 bg-white dark:border-white/5 dark:bg-[#18181b] shadow-xl transition-transform duration-200 ease-in-out select-none w-16 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Top Area: 头像与日夜模式切换 */}
        <div className="flex flex-col items-center">
          {/* Logo 头像 */}
          <div className="flex h-16 w-full items-center justify-center border-b border-black/5 dark:border-white/5">
            <Link href="/" className="relative group" title="返回博客主页">
              {siteConfig.avatar ? (
                <img
                  src={siteConfig.avatar}
                  alt={siteConfig.name || "80Hou"}
                  className="h-10 w-10 rounded-xl object-cover shadow-sm ring-2 ring-theme/20 group-hover:scale-105 transition-transform"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-theme to-pink-500 text-white font-extrabold text-xs shadow-sm">
                  80H
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
            </Link>
          </div>

          {/* 纯净日夜切换：无背景底色，太阳黄色，月亮粉色 */}
          <div className="py-2 w-full flex justify-center border-b border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center transition-transform hover:scale-115 active:scale-95"
              title={colorMode === "dark" ? "当前: 暗黑模式 (点击切换为浅色)" : "当前: 浅色模式 (点击切换为暗黑)"}
            >
              <i className={colorMode === "dark" ? "ri-moon-line text-rose-400 text-lg" : "ri-sun-line text-amber-500 text-lg"} />
            </button>
          </div>

          {/* 紧凑纯图标导航列表 (向日葵专业暗黑配色：未选中 #a1a1aa，选中深炭灰底 + 亮粉字) */}
          <nav className="flex flex-col gap-1 p-1.5 w-full overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-none">
            {filteredNavItems.map((item) => {
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group relative flex flex-col items-center justify-center rounded-xl py-1.5 w-full transition-all duration-150 ${
                    isActive
                      ? "bg-theme text-white shadow-xs font-bold dark:bg-[#27272a] dark:text-[#ff4d6d] dark:shadow-inner"
                      : "text-neutral-500 hover:bg-black/[0.04] hover:text-neutral-900 dark:text-[#a1a1aa] dark:hover:bg-[#27272a]/60 dark:hover:text-white"
                  }`}
                  title={item.label}
                >
                  <i className={`${item.icon} text-lg shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? "dark:text-[#ff4d6d]" : ""
                  }`} />
                  <span className="text-xs mt-0.5 tracking-tight font-semibold">
                    {item.label}
                  </span>

                  {/* 激活指示条 (暗黑模式下为精致的樱粉高光条) */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-white dark:bg-[#ff4d6d]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Area: AI Drawer, Logout */}
        <div className="flex flex-col items-center border-t border-black/5 p-1.5 dark:border-white/5 gap-1">
          {/* 画廊文字侍从快捷触发 */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("toggle-ai-copilot"));
            }}
            className="flex flex-col items-center justify-center rounded-xl bg-theme/5 hover:bg-theme/15 border border-theme/20 text-theme h-11 w-full transition-all"
            title="呼出 / 收回画廊文字侍从"
          >
            <i className="ri-sparkling-fill text-sm animate-pulse text-theme" />
            <span className="text-[9px] font-bold mt-0.5 scale-90">侍从</span>
          </button>

          {/* 退出登录按钮 */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 w-full items-center justify-center rounded-xl text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition"
            title="退出登录"
          >
            <i className="ri-logout-box-r-line text-base" />
          </button>
        </div>
      </aside>

      {/* ====================================================================
          2. 主工作区与顶部极简控制栏 (固定留白 64px，绝不挤压抖动)
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-150 lg:pl-16 pl-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-black/5 bg-white/80 px-3 sm:px-6 backdrop-blur-xl dark:border-white/5 dark:bg-[#161b26]/80 select-none">
          {/* Left: Mobile Hamburger & Breadcrumbs */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* 移动端汉堡菜单触发按钮 */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300"
              title="展开后台菜单"
            >
              <i className={mobileMenuOpen ? "ri-close-line text-lg" : "ri-menu-2-line text-lg"} />
            </button>

            {/* 纯净日夜切换按钮 (无背景底色，太阳黄色，月亮粉色) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center transition-transform hover:scale-115 active:scale-95 select-none"
              title={colorMode === "dark" ? "当前: 暗黑模式 (点击切换为浅色)" : "当前: 浅色模式 (点击切换为暗黑)"}
            >
              <i className={colorMode === "dark" ? "ri-moon-line text-rose-400 text-lg" : "ri-sun-line text-amber-500 text-lg"} />
            </button>

            <div className="flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs dark:border-white/10 dark:bg-white/[0.02]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold text-neutral-700 dark:text-neutral-300 hidden sm:inline">后台</span>
              <span className="text-neutral-400 font-bold hidden sm:inline">/</span>
              <span className="font-bold text-theme truncate">{title}</span>
            </div>
          </div>

          {/* Right: Quick Search & Avatar Tips */}
          <div className="flex items-center gap-3">
            {searchOpen ? (
              <div className="relative flex items-center ani-show">
                <i className="ri-search-line absolute left-2.5 text-neutral-400 text-xs" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="快速检索后台导航..."
                  className="w-44 sm:w-56 rounded-xl border border-black/10 bg-black/[0.02] py-1 pl-7 pr-7 text-xs t-primary outline-none focus:border-theme dark:border-white/10 dark:bg-white/[0.03]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="absolute right-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 text-neutral-500 text-xs transition"
                title="搜索后台功能 (Ctrl+K)"
              >
                <i className="ri-search-line text-xs" />
                <span className="hidden sm:inline font-mono text-[10px]">Ctrl+K</span>
              </button>
            )}

            <Link href="/" className="text-xs text-neutral-400 hover:text-theme transition hidden md:inline">
              返回画廊前台 &rarr;
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-full p-3 sm:p-5 lg:p-6 overflow-x-hidden transition-all duration-150">
          <div className="w-full max-w-full mx-auto flex flex-col gap-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
