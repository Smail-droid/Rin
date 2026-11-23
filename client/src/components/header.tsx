import { useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { normalizeHeaderBehavior, normalizeHeaderLayout } from "./site-header/layout-options";
import { BrandLink, HeaderActions, LanguageSwitch, NavBar, ThemeToggle } from "./site-header";

export function Header({ children }: { children?: React.ReactNode }) {
  const [location] = useLocation();
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();

  const headerBehavior = siteConfig.headerStickyEnabled === false
    ? "static"
    : normalizeHeaderBehavior(siteConfig.headerBehavior);
  const headerLayout = normalizeHeaderLayout(siteConfig.headerLayout);
  const [isRevealed, setIsRevealed] = useState(true);
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const nearTop = currentScrollY <= 24;
      const scrollingUp = currentScrollY < lastScrollY;
      setIsRevealed(headerBehavior !== "reveal" || nearTop || scrollingUp);
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [headerBehavior]);

  useEffect(() => {
    const root = document.documentElement;
    const setHeaderScrollOffset = () => {
      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--header-scroll-offset", `${Math.ceil(headerHeight + 16)}px`);
    };

    setHeaderScrollOffset();

    const resizeObserver = new ResizeObserver(() => {
      setHeaderScrollOffset();
    });

    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener("resize", setHeaderScrollOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", setHeaderScrollOffset);
    };
  }, [headerBehavior, siteConfig.headerLayout, siteConfig.headerPosition]);

  // ALL HOOKS ARE CALLED UNCONDITIONALLY ABOVE (prevents React Error #310)
  // 当配置隐藏导航栏时，前台页面统一保持隐藏，彻底杜绝进入子页面重新浮出的问题
  const shouldShowNav = profile?.permission
    ? siteConfig.headerShowNav !== false
    : siteConfig.headerShowNav === true;

  if (!shouldShowNav && !location.startsWith("/admin")) {
    // 隐藏前台导航栏时，保留日夜模式与多语言切换浮动微挂件（图3所示）
    return (
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/80 transition-all select-none ani-show">
        <ThemeToggle plain />
        <LanguageSwitch plain />
      </div>
    );
  }

  // 彻底废除悬浮遮挡，统一回归自然嵌入网页的 3 套深度融入式顶栏
  const isStatic = headerBehavior === "static";

  // 1. 日系轻透书签导航 (Atelier Minimal Bar - 柔和微透底栏、品牌与书签菜单左对齐流畅连结)
  if (headerLayout === "compact") {
    return (
      <header
        ref={headerRef}
        className={`${
          isStatic
            ? "relative"
            : `sticky top-0 transition-transform duration-300 ${
                headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
              }`
        } z-30 w-full border-b border-theme/15 dark:border-white/[0.08] bg-white/75 dark:bg-[#121622]/75 backdrop-blur-xl shadow-[0_2px_16px_rgba(var(--theme-rgb),0.05)] select-none`}
      >
        <div className="max-w-6xl mx-auto px-2.5 sm:px-6 h-13 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="flex items-center gap-2 group shrink-0 min-w-0"
              avatarClassName="h-7 w-7 sm:h-8 sm:w-8 rounded-xl shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
              titleClassName="text-sm sm:text-lg font-bold tracking-tight text-neutral-800 dark:text-neutral-100 group-hover:text-theme transition-colors truncate max-w-[120px] sm:max-w-none"
              showDescription={false}
            />
            <span className="hidden md:inline-block h-1.5 w-1.5 rounded-full bg-theme/30 shrink-0" />
            <nav
              className="hidden md:flex items-center text-xs sm:text-sm"
              style={{ gap: `${siteConfig.headerNavGap || 10}px` }}
            >
              <NavBar
                menu={false}
                itemClassName="px-3 py-1.5 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-theme hover:bg-theme/10 transition-all font-medium text-[13px] whitespace-nowrap shrink-0"
              />
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {children}
            <HeaderActions profile={profile} plain className="flex items-center gap-1 sm:gap-1.5" />
          </div>
        </div>
        {/* 移动端专属：横向轻滑全量导航条 (日系二次元轻透手账胶囊条，暗黑通透微光) */}
        <nav className="flex md:hidden items-center overflow-x-auto scrollbar-none px-3 py-1.5 gap-1.5 border-t border-theme/15 dark:border-white/10 bg-white/80 dark:bg-[#141824]/85 backdrop-blur-xl shadow-xs dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          <NavBar
            menu={false}
            mobile={true}
          />
        </nav>
      </header>
    );
  }

  // 2. 二次元悬浮微光手账托盘 (Floating Shimmer Dock - 三岛式悬浮轻磨砂气泡托盘)
  if (headerLayout === "dock") {
    return (
      <header
        ref={headerRef}
        className={`${
          isStatic
            ? "relative"
            : `sticky top-0 transition-transform duration-300 ${
                headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
              }`
        } z-30 w-full bg-transparent border-0 shadow-none select-none pt-2 sm:pt-3`}
      >
        <div className="max-w-6xl mx-auto px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
          {/* 左岛：Logo 与站点品牌 */}
          <div className="flex items-center px-2.5 sm:px-3.5 py-1.5 rounded-full border border-theme/20 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(var(--theme-rgb),0.12)] shrink-0 min-w-0">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="flex items-center gap-2 shrink-0"
              avatarClassName="h-6 w-6 sm:h-7 sm:w-7 rounded-xl shadow-xs shrink-0"
              titleClassName="text-xs sm:text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100 truncate max-w-[100px] sm:max-w-none"
              showDescription={false}
            />
          </div>

          {/* 中岛：悬浮微光手账导航核心 */}
          <div className="hidden md:flex flex-1 items-center justify-center">
            <nav
              className="flex items-center rounded-full border border-theme/25 dark:border-white/15 bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xl px-2.5 py-1.5 shadow-[0_8px_30px_-6px_rgba(var(--theme-rgb),0.2)]"
              style={{ gap: `${siteConfig.headerNavGap || 6}px` }}
            >
              <NavBar
                menu={false}
                itemClassName="px-3 py-1 rounded-full text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-theme/10 hover:text-theme transition-all whitespace-nowrap shrink-0"
              />
            </nav>
          </div>

          {/* 右岛：功能按钮与控制微胶囊 */}
          <div className="flex items-center px-1.5 sm:px-2.5 py-1.5 rounded-full border border-theme/20 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(var(--theme-rgb),0.12)] gap-1 sm:gap-1.5 shrink-0">
            {children}
            <HeaderActions profile={profile} plain className="flex items-center gap-1 sm:gap-1.5" />
          </div>
        </div>

        {/* 移动端专属：悬浮微光手账导航核心 */}
        <div className="flex md:hidden max-w-6xl mx-auto px-2 pt-1.5 pb-0.5">
          <nav className="w-full flex items-center overflow-x-auto scrollbar-none rounded-full border border-theme/25 dark:border-white/15 bg-white/85 dark:bg-[#141824]/90 backdrop-blur-xl px-2.5 py-1.5 shadow-[0_4px_20px_-4px_rgba(var(--theme-rgb),0.2)] gap-1.5">
            <NavBar
              menu={false}
              mobile={true}
            />
          </nav>
        </div>
      </header>
    );
  }

  // 3. 居中自然导航 (Classic Natural - 无边框、居中纯文字轻盈融入画布)
  return (
    <header
      ref={headerRef}
      className={`${
        isStatic
          ? "relative"
          : `sticky top-0 transition-transform duration-300 ${
              headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
            }`
      } z-30 w-full bg-transparent border-0 shadow-none select-none`}
    >
      <div className="max-w-6xl mx-auto px-2.5 sm:px-6 h-14 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
        {/* 左侧：Logo 与博客名称 */}
        <BrandLink
          siteConfig={siteConfig}
          compact
          className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0"
          avatarClassName="h-7 w-7 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl shadow-xs shrink-0"
          titleClassName="text-sm sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 truncate max-w-[120px] sm:max-w-none"
          showDescription={false}
        />

        {/* 中间：去容器化纯文本菜单 (直接嵌在网页画布上，两侧跃动星芒) */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <nav
            className="flex items-center"
            style={{ gap: `${siteConfig.headerNavGap || 12}px` }}
          >
            <NavBar
              menu={false}
              itemClassName="px-2 py-1 text-sm font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors"
            />
          </nav>
        </div>

        {/* 右侧：动作与工具 (搜索、多语言、用户头像) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {children}
          <HeaderActions profile={profile} plain className="flex items-center gap-1 sm:gap-2" />
        </div>
      </div>

      {/* 移动端专属：日系二次元微光横向轻滑导航条 (轻透手账胶囊、告别死黑一片) */}
      <nav className="flex md:hidden items-center overflow-x-auto scrollbar-none px-3 py-1.5 gap-1.5 border-t border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#141824]/85 backdrop-blur-xl shadow-xs dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
        <NavBar
          menu={false}
          mobile={true}
        />
      </nav>
    </header>
  );
}
