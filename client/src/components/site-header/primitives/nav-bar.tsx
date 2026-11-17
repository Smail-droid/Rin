import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useSiteConfig } from "../../../hooks/useSiteConfig";

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
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("article.title")} selected={location === "/" || location.startsWith("/feed")} href="/" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("timeline")} selected={location === "/timeline"} href="/timeline" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("moments.title")} selected={location === "/moments"} href="/moments" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("hashtags")} selected={location === "/hashtags"} href="/hashtags" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("friends.title")} selected={location === "/friends"} href="/friends" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("about.title")} selected={location === "/about"} href="/about" />
      {siteConfig.openlistShowInNav && Boolean(siteConfig.openlistWorkerUrl) && (
        <a
          href={siteConfig.openlistWorkerUrl}
          target="_blank"
          rel="noreferrer"
          className={`${
            menu
              ? "flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5"
              : "hidden md:inline-flex items-center gap-1 cursor-pointer text-sm font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors text-neutral-700 dark:text-neutral-300 hover:text-theme px-3.5 py-2"
          } ${itemClassName}`}
          onClick={onClick}
        >
          <span>{siteConfig.openlistNavTitle || "资源列表"}</span>
          <i className="ri-external-link-line text-xs opacity-60" />
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
}: {
  title: string;
  selected: boolean;
  href: string;
  menu?: boolean;
  when?: boolean;
  onClick?: () => void;
  itemClassName?: string;
}) {
  return when ? (
    <Link
      href={href}
      className={`${
        menu
          ? `flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              selected ? "text-theme font-bold bg-theme/10" : "text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5"
            }`
          : `hidden md:inline-flex items-center cursor-pointer text-sm font-medium tracking-wide whitespace-nowrap shrink-0 transition-all duration-200 ${
              selected
                ? "text-theme font-bold bg-theme/10 shadow-2xs rounded-xl"
                : "text-neutral-700 dark:text-neutral-300 hover:text-theme hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-xl"
            } px-3.5 py-1.5`
      } ${itemClassName}`}
      state={{ animate: true }}
      onClick={onClick}
    >
      {title}
    </Link>
  ) : null;
}
