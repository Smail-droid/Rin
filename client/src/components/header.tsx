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

  // 1. 杂志左对齐导航 (Editorial Left-Aligned - 报刊式底细线、品牌与菜单紧邻左对齐)
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
        } z-30 w-full border-b border-neutral-200/75 dark:border-white/[0.08] bg-white/80 dark:bg-[#111520]/80 backdrop-blur-md select-none`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <BrandLink
              siteConfig={siteConfig}
              compact
              className="flex items-center gap-2.5 group shrink-0"
              avatarClassName="h-7 w-7 sm:h-8 sm:w-8 rounded-lg shrink-0"
              titleClassName="text-base sm:text-lg font-serif font-bold tracking-wide text-neutral-900 dark:text-neutral-100 group-hover:text-theme transition-colors"
              showDescription={false}
            />
            <span className="hidden md:block h-4 w-px bg-neutral-200 dark:bg-white/15 shrink-0" />
            <nav className="hidden md:flex items-center gap-1 text-xs sm:text-sm">
              <NavBar
                menu={false}
                itemClassName="px-2.5 py-1 text-neutral-600 dark:text-neutral-300 hover:text-theme transition-colors font-medium text-[13px] whitespace-nowrap shrink-0"
              />
            </nav>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {children}
            <HeaderActions profile={profile} plain className="flex items-center gap-1.5" />
          </div>
        </div>
      </header>
    );
  }

  // 2. 居中胶囊托盘导航 (Centered Pill Dock - 清晰悬浮轻磨砂居中托盘)
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
        } z-30 w-full bg-transparent border-0 shadow-none select-none`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-4">
          <BrandLink
            siteConfig={siteConfig}
            compact
            className="flex items-center gap-2.5 shrink-0"
            avatarClassName="h-8 w-8 rounded-xl shadow-xs shrink-0"
            titleClassName="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
            showDescription={false}
          />

          <div className="hidden md:flex flex-1 items-center justify-center">
            <nav className="flex items-center gap-1 rounded-full border border-neutral-200/80 dark:border-white/15 bg-white/85 dark:bg-[#141824]/85 backdrop-blur-md px-2 py-1 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.12)]">
              <NavBar
                menu={false}
                itemClassName="px-3 py-1 text-xs font-medium rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-theme/10 hover:text-theme transition-colors whitespace-nowrap shrink-0"
              />
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {children}
            <HeaderActions profile={profile} plain className="flex items-center gap-2" />
          </div>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-4">
        {/* 左侧：Logo 与博客名称 */}
        <BrandLink
          siteConfig={siteConfig}
          compact
          className="flex items-center gap-2.5 sm:gap-3 shrink-0"
          avatarClassName="h-8 w-8 sm:h-9 sm:w-9 rounded-2xl shadow-xs shrink-0"
          titleClassName="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
          showDescription={false}
        />

        {/* 中间：去容器化纯文本菜单 (直接嵌在网页画布上，两侧跃动星芒) */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <nav className="flex items-center gap-2 lg:gap-3">
            <NavBar
              menu={false}
              itemClassName="px-2 py-1 text-sm font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors"
            />
          </nav>
        </div>

        {/* 右侧：动作与工具 (搜索、多语言、用户头像) */}
        <div className="flex items-center gap-2 shrink-0">
          {children}
          <HeaderActions profile={profile} plain className="flex items-center gap-2" />
        </div>
      </div>
    </header>
  );
}
