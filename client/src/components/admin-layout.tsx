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
  group?: "content" | "security" | "system";
  children?: { href: string; label: string }[];
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", icon: "ri-dashboard-3-line", label: "内容总览", group: "content" },
  { href: "/admin/files", icon: "ri-gallery-line", label: "图床画廊", group: "content" },
  { href: "/admin/music", icon: "ri-music-2-line", label: "音廊电台", group: "content" },
  { href: "/admin/tags", icon: "ri-hashtag", label: "标签整理", group: "content" },
  { href: "/admin/access", icon: "ri-lock-password-line", label: "内容加锁", group: "security" },
  { href: "/admin/tokens", icon: "ri-key-2-line", label: "图床口令", group: "security" },
  { href: "/admin/settings", icon: "ri-equalizer-line", label: "站点设置", group: "system" },
  { href: "/admin/ai", icon: "ri-sparkling-2-line", label: "AI 助手", group: "system" },
  { href: "/admin/ops", icon: "ri-pulse-line", label: "系统运维", group: "system" },
  { href: "/admin/queue-status", icon: "ri-stack-line", label: "任务队列", group: "system" },
  { href: "/admin/openlist", icon: "ri-folder-cloud-line", label: "网盘挂载", group: "system" },
];

const NAV_GROUP_LABELS: Record<"content" | "security" | "system", string> = {
  content: "内容管理",
  security: "安全与访问",
  system: "配置与运维",
};

export function AdminLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const siteConfig = useSiteConfig();
  const [location, setLocation] = useLocation();
  const colorMode = useColorMode();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [searchOpen]);

  const filteredNavItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ADMIN_NAV_ITEMS;
    return ADMIN_NAV_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const groupedNav = useMemo(() => {
    const order: Array<"content" | "security" | "system"> = ["content", "security", "system"];
    return order
      .map((group) => ({
        group,
        label: NAV_GROUP_LABELS[group],
        items: filteredNavItems.filter((item) => (item.group || "content") === group),
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredNavItems]);

  return (
    <div className="min-h-screen w-full max-w-full bg-[rgb(var(--rin-canvas-rgb))] text-[rgb(var(--rin-ink-rgb))] flex transition-colors duration-200 overflow-x-hidden">
      {/* 移动端全屏半透明遮罩背景 */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden ani-show"
        />
      )}

      {/* ====================================================================
          1. Refero 静谧左侧导航栏 (画廊语义表面 + 发丝描边 + 分组秩序)
          ==================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] transition-transform duration-200 ease-in-out select-none w-56 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Brand Header */}
          <div className="flex h-14 w-full items-center gap-2.5 px-4 border-b border-[rgb(var(--rin-hairline-rgb)/0.7)] shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 min-w-0 group"
              title="返回前台画廊"
            >
              {siteConfig.avatar ? (
                <img
                  src={siteConfig.avatar}
                  alt={siteConfig.name || "80Hou"}
                  className="h-8 w-8 rounded-xl object-cover border border-[rgb(var(--rin-hairline-rgb))] group-hover:scale-105 transition-transform shrink-0"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-theme/12 text-theme font-bold text-xs border border-theme/20">
                  80H
                </span>
              )}
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[rgb(var(--rin-ink-rgb))] truncate leading-tight group-hover:text-theme transition-colors">
                  {siteConfig.name || "画廊随想"}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[rgb(var(--rin-ink-muted-rgb))] leading-tight mt-0.5">
                  Studio Desk
                </div>
              </div>
            </Link>
          </div>

          {/* 分组导航 */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-none">
            {groupedNav.map((section) => (
              <div key={section.group} className="space-y-1">
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--rin-ink-muted-rgb))]">
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const isActive =
                    location === item.href ||
                    location.startsWith(`${item.href}/`) ||
                    (item.href === "/admin/dashboard" && location === "/admin");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors duration-150 ${
                        isActive
                          ? "bg-theme/10 text-theme font-semibold"
                          : "text-[rgb(var(--rin-ink-muted-rgb))] hover:bg-[rgb(var(--rin-ink-rgb)/0.04)] hover:text-[rgb(var(--rin-ink-rgb))] font-medium"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r bg-theme" />
                      )}
                      <i
                        className={`${item.icon} text-base shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? "text-theme" : "opacity-80"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Area: Front-Office & Logout */}
        <div className="flex flex-col border-t border-[rgb(var(--rin-hairline-rgb)/0.7)] p-3 gap-1 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-[rgb(var(--rin-ink-muted-rgb))] hover:bg-[rgb(var(--rin-ink-rgb)/0.04)] hover:text-[rgb(var(--rin-ink-rgb))] transition-colors"
          >
            <i className="ri-home-4-line text-sm" />
            <span>返回前台画廊</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-[rgb(var(--rin-ink-muted-rgb))] hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer text-left"
          >
            <i className="ri-logout-box-r-line text-sm" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* ====================================================================
          2. 主工作区与顶部极简控制栏
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-150 lg:pl-56 pl-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[rgb(var(--rin-hairline-rgb)/0.85)] bg-[rgb(var(--rin-canvas-rgb)/0.86)] px-4 sm:px-6 lg:px-8 backdrop-blur-xl select-none">
          {/* Left: Mobile Hamburger, Theme Toggle & Editorial Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-[rgb(var(--rin-ink-rgb))]"
              title="展开后台菜单"
            >
              <i className={mobileMenuOpen ? "ri-close-line text-lg" : "ri-menu-2-line text-lg"} />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-[rgb(var(--rin-ink-rgb)/0.05)] transition-all active:scale-95 select-none cursor-pointer"
              title={colorMode === "dark" ? "当前: 暗黑模式 (点击切换为浅色)" : "当前: 浅色模式 (点击切换为暗黑)"}
            >
              <i className={colorMode === "dark" ? "ri-moon-line text-rose-400 text-base" : "ri-sun-line text-amber-500 text-base"} />
            </button>

            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[rgb(var(--rin-ink-muted-rgb))] hidden sm:inline">
                工作台
              </span>
              <span className="text-[rgb(var(--rin-ink-muted-rgb))] opacity-50 hidden sm:inline">/</span>
              <span className="font-semibold text-[rgb(var(--rin-ink-rgb))] truncate">{title}</span>
              {description ? (
                <span className="hidden xl:inline text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] truncate max-w-md border-l border-[rgb(var(--rin-hairline-rgb))] pl-2.5 ml-0.5">
                  {description}
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Quick Search & Studio Links */}
          <div className="flex items-center gap-2.5">
            {searchOpen ? (
              <div ref={searchContainerRef} className="relative flex items-center ani-show">
                <i className="ri-search-line absolute left-2.5 text-[rgb(var(--rin-ink-muted-rgb))] text-xs" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredNavItems.length > 0) {
                      setLocation(filteredNavItems[0].href);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }
                  }}
                  placeholder="快速检索后台导航..."
                  className="w-44 sm:w-60 rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] py-1 pl-7 pr-7 text-xs text-[rgb(var(--rin-ink-rgb))] outline-none focus:border-theme"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="absolute right-2 text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] cursor-pointer"
                >
                  <i className="ri-close-line text-xs" />
                </button>

                {/* 浮动检索面板（桌面/移动端通用，回车即直达） */}
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-elevated-rgb)/0.96)] backdrop-blur-xl p-1.5 shadow-xl z-50 ani-show max-h-72 overflow-y-auto">
                  {filteredNavItems.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[11px] text-[rgb(var(--rin-ink-muted-rgb))]">
                      未匹配到后台菜单
                    </div>
                  ) : (
                    filteredNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs text-[rgb(var(--rin-ink-rgb))] hover:bg-theme/10 hover:text-theme transition-colors"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <i className={`${item.icon} text-sm text-theme`} />
                          <span className="font-semibold truncate">{item.label}</span>
                        </span>
                        <span className="text-[10px] font-mono text-[rgb(var(--rin-ink-muted-rgb))] shrink-0">
                          {NAV_GROUP_LABELS[item.group || "content"]}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] hover:border-theme/40 text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] text-xs transition cursor-pointer"
                title="搜索后台功能 (Ctrl+K)"
              >
                <i className="ri-search-line text-xs" />
                <span className="hidden sm:inline font-mono text-[10px]">Ctrl+K</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--rin-ink-muted-rgb))]">
              <Link
                href="/writing"
                className="hidden sm:inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 hover:bg-[rgb(var(--rin-ink-rgb)/0.05)] hover:text-theme transition font-medium"
                title="进入沉浸式撰写工坊"
              >
                <i className="ri-quill-pen-line text-xs" />
                <span>撰写</span>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] px-2.5 py-1.5 hover:border-theme/40 hover:text-theme transition font-medium text-[rgb(var(--rin-ink-rgb))]"
              >
                <span>前台</span>
                <i className="ri-arrow-right-up-line text-xs opacity-70" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-full p-4 sm:p-6 lg:p-8 overflow-x-hidden transition-all duration-150">
          <div className="w-full max-w-7xl mx-auto flex flex-col gap-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
