import { Link } from "wouter";
import type { SiteHeaderConfig } from "../shared";
import { ImageWithFallback } from "../../image-with-fallback";

export function BrandLink({
  siteConfig,
  className = "",
  avatarClassName,
  compact = false,
  showAvatar = true,
  showDescription = true,
  titleClassName = "",
  descriptionClassName = "",
}: {
  siteConfig: SiteHeaderConfig;
  className?: string;
  avatarClassName?: string;
  compact?: boolean;
  showAvatar?: boolean;
  showDescription?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  const cleanName =
    (siteConfig.name || "Rin")
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .trim() || "Rin";

  return (
    <Link aria-label="home" href="/" className={className}>
      {showAvatar && siteConfig.avatar ? (
        <ImageWithFallback
          src={siteConfig.avatar}
          alt={cleanName}
          className={
            avatarClassName ||
            (compact
              ? "h-9 w-9 rounded-2xl object-cover ring-1 ring-black/5 shadow-2xs"
              : "h-11 w-11 rounded-2xl object-cover ring-1 ring-black/5 shadow-xs")
          }
        />
      ) : null}
      <div className={`${showAvatar ? (compact ? "mx-2" : "mx-3") : ""} flex min-w-0 flex-col items-start justify-center`}>
        <p className={`max-w-full truncate ${compact ? "text-sm font-bold t-primary" : "text-lg font-bold dark:text-white"} ${titleClassName}`}>{cleanName}</p>
        {showDescription ? <p className={`max-w-full truncate text-xs text-neutral-500 ${descriptionClassName}`}>{siteConfig.description}</p> : null}
      </div>
    </Link>
  );
}
