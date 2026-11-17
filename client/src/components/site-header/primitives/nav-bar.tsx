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
}: {
  menu: boolean;
  onClick?: () => void;
  itemClassName?: string;
}) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();

  return (
    <>
      <NavItem
        menu={menu}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("article.title")}
        selected={location === "/" || location.startsWith("/feed")}
        href="/"
        tiltIndex={0}
      />
      <NavItem
        menu={menu}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("timeline")}
        selected={location === "/timeline"}
        href="/timeline"
        tiltIndex={1}
      />
      <NavItem
        menu={menu}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("moments.title")}
        selected={location === "/moments"}
        href="/moments"
        tiltIndex={2}
      />
      <NavItem
        menu={menu}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("hashtags")}
        selected={location === "/hashtags"}
        href="/hashtags"
        tiltIndex={3}
      />
      <NavItem
        menu={menu}
        onClick={onClick}
        itemClassName={itemClassName}
        title={t("friends.title")}
        selected={location === "/friends"}
        href="/friends"
        tiltIndex={4}
      />
      <NavItem
        menu={menu}
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
              : "group relative inline-flex items-center gap-1.5 cursor-pointer text-sm sm:text-[15px] font-medium tracking-wider whitespace-nowrap shrink-0 transition-all duration-200 text-neutral-700 dark:text-neutral-200 hover:text-theme rotate-[0.9deg] hover:rotate-0 px-2 py-1 select-none"
          } ${itemClassName}`}
          onClick={onClick}
        >
          <span className="opacity-0 group-hover:opacity-100 group-hover:nav-hop-left transition-opacity text-theme text-xs font-bold">
            ✦
          </span>
          <span>{siteConfig.openlistNavTitle || "资源列表"}</span>
          <i className="ri-external-link-line text-xs opacity-60" />
          <span className="opacity-0 group-hover:opacity-100 group-hover:nav-hop-right transition-opacity text-theme text-xs font-bold">
            ✦
          </span>
        </a>
      )}
    </>
  );
}

function NavItem({
  menu,
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
  when?: boolean;
  onClick?: () => void;
  itemClassName?: string;
  tiltIndex?: number;
}) {
  const tilt = ORGANIC_TILTS[tiltIndex % ORGANIC_TILTS.length];

  return when ? (
    <Link
      href={href}
      className={`${
        menu
          ? `flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              selected
                ? "text-theme font-bold bg-theme/10"
                : "text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5"
            }`
          : `group relative inline-flex items-center gap-1.5 cursor-pointer text-sm sm:text-[15px] tracking-wider whitespace-nowrap shrink-0 transition-all duration-200 select-none ${tilt} hover:rotate-0 hover:scale-105 ${
              selected
                ? "text-theme font-bold drop-shadow-xs"
                : "font-medium text-neutral-700 dark:text-neutral-200 hover:text-theme"
            } px-2.5 py-1`
      } ${itemClassName}`}
      state={{ animate: true }}
      onClick={onClick}
    >
      {/* 1. 左侧跃动星芒 (参考图2: 激活或悬浮时灵动跳跃) */}
      {!menu && (
        <span
          aria-hidden="true"
          className={`text-[11px] font-bold text-theme transition-all duration-300 ${
            selected
              ? "opacity-100 nav-hop-left scale-110"
              : "opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:nav-hop-left"
          }`}
        >
          ✦
        </span>
      )}

      {/* 2. 纯粹居中标题文字 (直接嵌入网页，绝无外层药丸白框) */}
      <span className="relative z-10 transition-colors duration-200">
        {title}
      </span>

      {/* 3. 右侧跃动星芒 (参考图2: 激活或悬浮时对向跳跃) */}
      {!menu && (
        <span
          aria-hidden="true"
          className={`text-[11px] font-bold text-theme transition-all duration-300 ${
            selected
              ? "opacity-100 nav-hop-right scale-110"
              : "opacity-0 translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:nav-hop-right"
          }`}
        >
          ✦
        </span>
      )}
    </Link>
  ) : null;
}
