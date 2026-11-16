import { useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { normalizeHeaderBehavior } from "./site-header/layout-options";
import { BrandLink, HeaderActions, LanguageSwitch, NavBar, ThemeToggle } from "./site-header";

export function Header({ children }: { children?: React.ReactNode }) {
  const [location] = useLocation();
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();

  const headerBehavior = siteConfig.headerStickyEnabled === false
    ? "static"
    : normalizeHeaderBehavior(siteConfig.headerBehavior);
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

  const headerPosition = siteConfig.headerPosition || "top";

  // =========================================================================
  // 1. 居中浮动药丸模式 (Floating Dynamic Island Header)
  // =========================================================================
  if (headerPosition === "float") {
    return (
      <>
        <div
          ref={headerRef}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-fit max-w-[95vw] rounded-full px-4 py-2 border border-black/10 dark:border-white/10 bg-white/85 dark:bg-[#12161f]/85 backdrop-blur-2xl shadow-xl transition-all duration-300 select-none ani-show"
        >
          <div className="flex items-center gap-3">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="flex items-center gap-2"
              avatarClassName="h-7 w-7 rounded-full shadow-xs shrink-0"
              titleClassName="text-xs sm:text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
              showDescription={false}
            />
            <div className="h-3.5 w-px bg-black/10 dark:bg-white/10 hidden sm:block shrink-0" />
            <nav className="flex items-center gap-1">
              <NavBar
                menu={false}
                itemClassName="px-3 py-1 rounded-full text-xs"
              />
            </nav>
            <div className="h-3.5 w-px bg-black/10 dark:bg-white/10 hidden sm:block shrink-0" />
            <HeaderActions profile={profile} plain className="flex items-center gap-1 text-xs shrink-0" />
          </div>
        </div>
      </>
    );
  }

  // =========================================================================
  // 2. 底部便携挂件底座模式 (MHub / macOS Floating Bottom Dock)
  // =========================================================================
  if (headerPosition === "bottom") {
    return (
      <>
        <div
          ref={headerRef}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-fit max-w-[95vw] rounded-full px-4 py-2 border border-black/10 dark:border-white/10 bg-white/90 dark:bg-[#12161f]/90 backdrop-blur-2xl shadow-2xl transition-all duration-300 select-none ani-show"
        >
          <div className="flex items-center gap-3">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="flex items-center gap-2"
              avatarClassName="h-7 w-7 rounded-full shadow-xs shrink-0"
              titleClassName="text-xs sm:text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
              showDescription={false}
            />
            <div className="h-3.5 w-px bg-black/10 dark:bg-white/10 hidden sm:block shrink-0" />
            <nav className="flex items-center gap-1">
              <NavBar
                menu={false}
                itemClassName="px-3 py-1 rounded-full text-xs"
              />
            </nav>
            <div className="h-3.5 w-px bg-black/10 dark:bg-white/10 hidden sm:block shrink-0" />
            <HeaderActions profile={profile} plain popoverUp className="flex items-center gap-1 text-xs shrink-0" />
          </div>
        </div>
      </>
    );
  }

  // =========================================================================
  // 3. 顶部常规固定导航栏模式 (Classic Edge-to-Edge Header)
  // =========================================================================
  return (
    <>
      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-40 transition-transform duration-300 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-[#12161f]/80 backdrop-blur-xl ${
          headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 select-none">
          <BrandLink
            siteConfig={siteConfig}
            compact
            className="flex items-center gap-2.5"
            avatarClassName="h-8 w-8 rounded-xl shadow-xs shrink-0"
            titleClassName="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
            showDescription={false}
          />
          <nav className="hidden md:flex items-center gap-1.5">
            <NavBar
              menu={false}
              itemClassName="px-3.5 py-1.5 rounded-xl text-sm"
            />
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {children}
            <HeaderActions profile={profile} plain className="flex items-center gap-2" />
          </div>
        </div>
      </header>
      <div className="h-16" />
    </>
  );
}
