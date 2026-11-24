import { useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { GALLERY_CONTAINER_CLASS } from "./page-header";
import { normalizeHeaderBehavior, normalizeHeaderLayout } from "./site-header/layout-options";
import { AppearancePopover, BrandLink, HeaderActions, LanguageSwitch, NavBar, ThemeToggle } from "./site-header";

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
    return (
      <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5 rounded-full border border-[rgb(var(--rin-hairline-rgb)/0.9)] bg-[rgb(var(--rin-elevated-rgb)/0.88)] px-2.5 py-1.5 shadow-lg backdrop-blur-xl transition-all select-none ani-show">
        <AppearancePopover plain />
        <ThemeToggle plain />
        <LanguageSwitch plain />
      </div>
    );
  }

  const isStatic = headerBehavior === "static";
  const stickyClass = isStatic
    ? "relative"
    : `sticky top-0 transition-transform duration-300 ${
        headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
      }`;

  // 1. Editorial Hairline Bar (compact): 左品牌 + 静谧左对齐导航 + 极细底线
  if (headerLayout === "compact") {
    return (
      <header
        ref={headerRef}
        data-header-layout="compact"
        className={`${stickyClass} z-30 w-full bg-[rgb(var(--rin-surface-rgb)/0.85)] backdrop-blur-xl border-b border-[rgb(var(--rin-hairline-rgb)/0.7)] select-none`}
      >
        <div className={`${GALLERY_CONTAINER_CLASS} h-13 sm:h-15 flex items-center justify-between gap-2 sm:gap-4`}>
          <div className="flex items-center gap-2.5 sm:gap-5 min-w-0">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="flex items-center gap-2 group shrink-0 min-w-0"
              avatarClassName="h-7 w-7 sm:h-8 sm:w-8 rounded-xl shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
              titleClassName="text-sm sm:text-base font-bold tracking-tight text-[rgb(var(--rin-ink-rgb))] group-hover:text-theme transition-colors truncate max-w-[96px] sm:max-w-none"
              showDescription={false}
            />
            <span
              aria-hidden="true"
              className="hidden md:inline-block h-3.5 w-px bg-[rgb(var(--rin-hairline-rgb))] shrink-0"
            />
            <nav
              className="hidden md:flex items-center text-xs sm:text-sm"
              style={{ gap: `${siteConfig.headerNavGap || 8}px` }}
            >
              <NavBar
                menu={false}
                itemClassName="px-2.5 py-1 rounded-lg text-[13px] font-medium text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] hover:bg-[rgb(var(--rin-ink-rgb)/0.04)] transition-colors whitespace-nowrap shrink-0"
              />
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {children}
            <HeaderActions profile={profile} plain className="flex items-center gap-1 sm:gap-1.5" />
          </div>
        </div>
        <nav className="flex md:hidden items-center overflow-x-auto scrollbar-none px-4 py-1.5 gap-1.5 border-t border-[rgb(var(--rin-hairline-rgb)/0.6)] bg-[rgb(var(--rin-surface-rgb)/0.92)] backdrop-blur-xl">
          <NavBar menu={false} mobile={true} />
        </nav>
      </header>
    );
  }

  // 2. Refero / DesignSpells Floating 3-Island Pill Bar (dock)
  if (headerLayout === "dock") {
    return (
      <header
        ref={headerRef}
        data-header-layout="dock"
        className={`${stickyClass} z-30 w-full bg-transparent border-0 shadow-none select-none pt-2.5 sm:pt-3.5 pb-1`}
      >
        <div className={`${GALLERY_CONTAINER_CLASS} flex items-center justify-between gap-2 sm:gap-3`}>
          {/* 左岛：Logo 与站点品牌 */}
          <div className="flex items-center px-2.5 sm:px-3.5 py-1.5 rounded-full border border-[rgb(var(--rin-hairline-rgb)/0.9)] bg-[rgb(var(--rin-elevated-rgb)/0.9)] backdrop-blur-xl shadow-[0_6px_24px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.45)] shrink min-w-0">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="flex items-center gap-2 min-w-0"
              avatarClassName="h-6 w-6 sm:h-7 sm:w-7 rounded-xl shadow-xs shrink-0"
              titleClassName="text-xs sm:text-sm font-bold tracking-tight text-[rgb(var(--rin-ink-rgb))] truncate max-w-[84px] sm:max-w-none"
              showDescription={false}
            />
          </div>

          {/* 中岛：悬浮胶囊导航 */}
          <div className="hidden md:flex flex-1 items-center justify-center min-w-0">
            <nav
              className="flex items-center rounded-full border border-[rgb(var(--rin-hairline-rgb)/0.95)] bg-[rgb(var(--rin-elevated-rgb)/0.92)] backdrop-blur-xl px-2.5 py-1 shadow-[0_10px_32px_-8px_rgba(var(--theme-rgb),0.18)]"
              style={{ gap: `${siteConfig.headerNavGap || 6}px` }}
            >
              <NavBar
                menu={false}
                itemClassName="px-3 py-1 rounded-full text-xs font-semibold text-[rgb(var(--rin-ink-muted-rgb))] hover:bg-theme/10 hover:text-theme transition-all whitespace-nowrap shrink-0"
              />
            </nav>
          </div>

          {/* 右岛：全局动作微胶囊 */}
          <div className="flex items-center px-1.5 sm:px-2.5 py-1 rounded-full border border-[rgb(var(--rin-hairline-rgb)/0.9)] bg-[rgb(var(--rin-elevated-rgb)/0.9)] backdrop-blur-xl shadow-[0_6px_24px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.45)] gap-0.5 sm:gap-1.5 shrink-0">
            {children}
            <HeaderActions profile={profile} plain className="flex items-center gap-0.5 sm:gap-1" />
          </div>
        </div>

        {/* 移动端专属：单行悬浮胶囊导航 */}
        <div className={`flex md:hidden ${GALLERY_CONTAINER_CLASS} pt-1.5 pb-0.5`}>
          <nav className="w-full flex items-center overflow-x-auto scrollbar-none rounded-full border border-[rgb(var(--rin-hairline-rgb)/0.9)] bg-[rgb(var(--rin-elevated-rgb)/0.92)] backdrop-blur-xl px-2.5 py-1 shadow-[0_4px_20px_-4px_rgba(var(--theme-rgb),0.16)] gap-1.5">
            <NavBar menu={false} mobile={true} />
          </nav>
        </div>
      </header>
    );
  }

  // 3. 居中自然导航 (classic): 透明融入画布，左品牌、居中纯文本星芒导航、右动作图标
  return (
    <header
      ref={headerRef}
      data-header-layout="classic"
      className={`${stickyClass} z-30 w-full bg-transparent border-0 shadow-none select-none`}
    >
      <div className={`${GALLERY_CONTAINER_CLASS} h-14 sm:h-18 flex items-center justify-between gap-2 sm:gap-4`}>
        <BrandLink
          siteConfig={siteConfig}
          compact
          className="flex items-center gap-2 sm:gap-3 shrink min-w-0"
          avatarClassName="h-7 w-7 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl shadow-xs shrink-0"
          titleClassName="text-sm sm:text-lg font-bold tracking-tight text-[rgb(var(--rin-ink-rgb))] truncate max-w-[96px] sm:max-w-none"
          showDescription={false}
        />

        <div className="hidden md:flex flex-1 items-center justify-center min-w-0">
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

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {children}
          <HeaderActions profile={profile} plain className="flex items-center gap-1 sm:gap-1.5" />
        </div>
      </div>

      <nav className="flex md:hidden items-center overflow-x-auto scrollbar-none px-4 py-1.5 gap-1.5 border-t border-[rgb(var(--rin-hairline-rgb)/0.6)] bg-[rgb(var(--rin-surface-rgb)/0.85)] backdrop-blur-xl">
        <NavBar menu={false} mobile={true} />
      </nav>
    </header>
  );
}
