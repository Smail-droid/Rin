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

  // 彻底废除浮动胶囊与悬浮底座，统一回归自然嵌入网页的经典顶栏 (文字直接嵌在网页上，高度充裕，绝不遮挡)
  const isStatic = headerBehavior === "static";

  if (headerLayout === "compact") {
    // 极简纯文本社论风（透气排版、文质彬彬、暖润毛玻璃、文字自然融入）
    return (
      <header
        ref={headerRef}
        className={`${
          isStatic
            ? "relative"
            : `sticky top-0 transition-transform duration-300 ${
                headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
              }`
        } z-30 w-full bg-white/90 dark:bg-[#12161f]/90 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.06] shadow-2xs select-none`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 sm:h-18 flex items-center justify-between gap-6">
          <BrandLink
            siteConfig={siteConfig}
            compact
            className="flex items-center gap-3 group shrink-0"
            avatarClassName="h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
            titleClassName="text-base sm:text-lg font-serif font-bold tracking-wider text-neutral-800 dark:text-neutral-100 group-hover:text-theme transition-colors"
            showDescription={false}
          />
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium tracking-wide">
              <NavBar
                menu={false}
                itemClassName="px-3.5 py-2 text-neutral-600 dark:text-neutral-300 hover:text-theme transition-colors font-medium text-sm whitespace-nowrap shrink-0"
              />
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              {children}
              <HeaderActions profile={profile} plain className="flex items-center gap-1.5" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  // 经典居中对称布局 (Classic Balanced Header - 文字直接嵌在网页上，舒展大方，绝不压缩变形与悬浮遮挡)
  return (
    <header
      ref={headerRef}
      className={`${
        isStatic
          ? "relative"
          : `sticky top-0 transition-transform duration-300 ${
              headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
            }`
      } z-30 w-full border-b border-black/5 dark:border-white/5 bg-white/90 dark:bg-[#12161f]/90 backdrop-blur-md shadow-2xs select-none`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-4">
        {/* 左侧：Logo 与博客名称 */}
        <BrandLink
          siteConfig={siteConfig}
          compact
          className="flex items-center gap-2.5 sm:gap-3 shrink-0"
          avatarClassName="h-8 w-8 sm:h-9 sm:w-9 rounded-xl shadow-xs shrink-0"
          titleClassName="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
          showDescription={false}
        />

        {/* 中间：经典纯文本菜单导航条 (文字直接嵌在网页上，绝无外层药丸死板边框与字体挤压) */}
        <div className="hidden md:flex flex-1 items-center justify-center">
          <nav className="flex items-center gap-1 lg:gap-2">
            <NavBar
              menu={false}
              itemClassName="px-4 py-2 text-sm font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors"
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
