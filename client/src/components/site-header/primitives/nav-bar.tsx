import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useSiteConfig } from "../../../hooks/useSiteConfig";

// 不规则手账微倾角阶梯 (让纯文字自然排布在网页上，富有生机灵气，拒绝呆板机械)
const ORGANIC_TILTS = [
  "rotate-[-1.2deg]",
  "rotate-[1.4deg]",
  "rotate-[-0.8deg]",
  "rotate-[1.1deg]",
  "rotate-[-1deg]",
  "rotate-[0.7deg]",
  "rotate-[-0.5deg]",
];

export function NavBar({
  menu,
  onClick,
  itemClassName = "",
  mobile = false,
}: {
  menu: boolean;
  onClick?: () => void;
  itemClassName?: string;
  mobile?: boolean;
}) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();

  return (
    <>
      <NavItem
        menu={menu}
        mobile={mobile}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("article.title")}
        selected={location === "/" || location.startsWith("/feed")}
        href="/"
        tiltIndex={0}
      />
      <NavItem
        menu={menu}
        mobile={mobile}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("timeline")}
        selected={location === "/timeline"}
        href="/timeline"
        tiltIndex={1}
      />
      <NavItem
        menu={menu}
        mobile={mobile}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("moments.title")}
        selected={location === "/moments"}
        href="/moments"
        tiltIndex={2}
      />
      <NavItem
        menu={menu}
        mobile={mobile}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("hashtags")}
        selected={location === "/hashtags"}
        href="/hashtags"
        tiltIndex={3}
      />
      <NavItem
        menu={menu}
        mobile={mobile}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("friends.title")}
        selected={location === "/friends"}
        href="/friends"
        tiltIndex={4}
      />
      <NavItem
        menu={menu}
        mobile={mobile}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("about.title")}
        selected={location === "/about"}
        href="/about"
        tiltIndex={5}
      />
      {siteConfig.openlistShowInNav && Boolean(siteConfig.openlistWorkerUrl) && (
        <a
          href={siteConfig.openlistWorkerUrl}
          target="_blank"
          rel="noreferrer"
          className={`${
            menu
              ? "flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5"
              : mobile
              ? "group relative inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all select-none text-neutral-700 dark:text-neutral-200 bg-black/[0.03] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 active:scale-95 active:bg-theme/15"
              : "group relative inline-flex items-center gap-1.5 cursor-pointer text-sm sm:text-[15px] font-medium tracking-wider whitespace-nowrap shrink-0 transition-all duration-200 text-neutral-700 dark:text-neutral-200 hover:text-theme rotate-[0.9deg] hover:rotate-0 px-2.5 py-1 select-none"
          } ${itemClassName}`}
          onClick={onClick}
        >
          {!mobile && !menu && (
            <span className="opacity-0 group-hover:opacity-100 group-hover:nav-hop-left transition-opacity text-theme text-xs font-bold">
              ✦
            </span>
          )}
          <span>{siteConfig.openlistNavTitle || t("openlist_nav_title", { defaultValue: "资源列表" })}</span>
          <i className="ri-external-link-line text-xs opacity-60" />
          {!mobile && !menu && (
            <span className="opacity-0 group-hover:opacity-100 group-hover:nav-hop-right transition-opacity text-theme text-xs font-bold">
              ✦
            </span>
          )}
        </a>
      )}
    </>
  );
}

function NavItem({
  menu,
  mobile = false,
  title,
  selected,
  href,
  when = true,
  onClick,
  itemClassName = "",
  tiltIndex = 0,
}: {
  title: string;
  selected: boolean;
  href: string;
  menu?: boolean;
  mobile?: boolean;
  when?: boolean;
  onClick?: () => void;
  itemClassName?: string;
  tiltIndex?: number;
}) {
  const siteConfig = useSiteConfig();
  const tilt = !menu && !mobile && siteConfig.headerNavOrganicTilt ? ORGANIC_TILTS[tiltIndex % ORGANIC_TILTS.length] : "";
  const navFontSize = siteConfig.headerNavFontSize || 15;

  let baseClass = "";
  if (menu) {
    baseClass = `flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
      selected
        ? "text-theme font-bold bg-theme/10"
        : "text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5"
    }`;
  } else if (mobile) {
    // 🌸 移动端专属：日系二次元轻透手账微光胶囊
    // 未点击/未选中项：自带温润微透底座与 1px 微光描边，字迹清晰高对比，彻底告别暗黑死黑
    // 选中项：通透微光樱粉/主题色光芒，自带微光环境发光与轻跃星芒
    baseClass = `group relative inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs whitespace-nowrap shrink-0 transition-all select-none active:scale-95 ${
      selected
        ? "text-theme font-bold bg-theme/15 dark:bg-theme/20 border border-theme/40 dark:border-theme/50 shadow-[0_2px_10px_rgba(var(--theme-rgb),0.25)]"
        : "font-semibold text-neutral-700 dark:text-neutral-200 bg-black/[0.03] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 hover:border-theme/30 hover:text-theme shadow-2xs active:bg-theme/15 active:text-theme"
    }`;
  } else {
    // 桌面端自然去容器化流派
    baseClass = `group relative inline-flex items-center gap-1.5 cursor-pointer tracking-wider whitespace-nowrap shrink-0 transition-all duration-200 select-none ${tilt} hover:rotate-0 hover:scale-105 ${
      selected
        ? "text-theme font-bold drop-shadow-xs"
        : "font-medium text-neutral-700 dark:text-neutral-200 hover:text-theme"
    } px-2.5 py-1`;
  }

  return when ? (
    <Link
      href={href}
      style={!menu && !mobile ? { fontSize: `${navFontSize}px` } : undefined}
      className={`${baseClass} ${itemClassName}`}
      state={{ animate: true }}
      onClick={onClick}
    >
      {/* 1. 左侧跃动星芒 (桌面端全状态响应，移动端选中时精致点缀) */}
      {!menu && (
        <span
          aria-hidden="true"
          className={`font-bold text-theme transition-all duration-300 ${
            mobile
              ? selected
                ? "text-[10px] opacity-100 scale-105"
                : "hidden"
              : `text-[11px] ${
                  selected
                    ? "opacity-100 nav-hop-left scale-110"
                    : "opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:nav-hop-left"
                }`
          }`}
        >
          ✦
        </span>
      )}

      {/* 2. 居中标题文字 */}
      <span className="relative z-10 transition-colors duration-200">
        {title}
      </span>

      {/* 3. 右侧跃动星芒 */}
      {!menu && (
        <span
          aria-hidden="true"
          className={`font-bold text-theme transition-all duration-300 ${
            mobile
              ? selected
                ? "text-[10px] opacity-100 scale-105"
                : "hidden"
              : `text-[11px] ${
                  selected
                    ? "opacity-100 nav-hop-right scale-110"
                    : "opacity-0 translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:nav-hop-right"
                }`
          }`}
        >
          ✦
        </span>
      )}
    </Link>
  ) : null;
}
