import { useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ProfileContext } from "../state/profile";
import { Padding } from "./padding";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { getHeaderLayoutDefinition } from "./site-header/layout-registry";
import { normalizeHeaderBehavior, normalizeHeaderLayout } from "./site-header/layout-options";
import { LanguageSwitch, ThemeToggle } from "./site-header";

export function Header({ children }: { children?: React.ReactNode }) {
  const [location] = useLocation();
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();

  const headerLayout = normalizeHeaderLayout(siteConfig.headerLayout);
  const headerBehavior = siteConfig.headerStickyEnabled === false
    ? "static"
    : normalizeHeaderBehavior(siteConfig.headerBehavior);
  const layoutDefinition = getHeaderLayoutDefinition(headerLayout);
  const [isRevealed, setIsRevealed] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const nearTop = currentScrollY <= 24;
      const scrollingUp = currentScrollY < lastScrollY;
      setIsAtTop(nearTop);
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
  }, [headerBehavior, headerLayout]);

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

  const useTopHeader = layoutDefinition.kind === "top";
  const headerPosition = siteConfig.headerPosition || "top";
  const headerPaddingClassName = headerLayout === "compact" ? "mx-0 mt-0" : "mx-4 mt-4";

  // 灵活的导航条排布位置 (顶部常规 / 居中浮动药丸 / 底部便携挂件)
  let containerClassName = "fixed z-40 transition-all duration-300 ";
  if (headerPosition === "float") {
    containerClassName += "top-4 left-1/2 -translate-x-1/2 w-auto max-w-[92vw] rounded-full shadow-2xl backdrop-blur-xl bg-w/85 border border-black/10 dark:border-white/10 px-4 py-1.5";
  } else if (headerPosition === "bottom") {
    containerClassName += "bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[92vw] rounded-full shadow-2xl backdrop-blur-xl bg-w/85 border border-black/10 dark:border-white/10 px-4 py-1.5";
  } else {
    // 默认 "top" 常规模式
    containerClassName =
      !useTopHeader || headerBehavior === "static"
        ? "relative z-40"
        : `fixed inset-x-0 top-0 z-40 transition-transform duration-300 ${
            headerBehavior === "reveal" && !isRevealed ? "-translate-y-full" : "translate-y-0"
          }`;
  }

  const spacerClassName = headerPosition !== "top" || !useTopHeader || headerBehavior === "static" ? "h-0" : "h-20";

  return (
    <>
      {headerLayout === "compact" ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-theme/15 to-white/0 dark:from-theme/20 dark:to-transparent" />
      ) : null}
      <div ref={headerRef} className={containerClassName}>
        <div className="w-screen">
          {headerLayout === "compact" ? (
            <div className="w-full">
              {layoutDefinition.renderMobile({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
              {layoutDefinition.renderDesktop({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
            </div>
          ) : (
            <Padding className={headerPaddingClassName}>
              <div className="w-full">
                {layoutDefinition.renderMobile({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
                {layoutDefinition.renderDesktop({ children, profile, siteConfig, behavior: headerBehavior, isAtTop })}
              </div>
            </Padding>
          )}
        </div>
      </div>
      <div className={spacerClassName} />
    </>
  );
}
