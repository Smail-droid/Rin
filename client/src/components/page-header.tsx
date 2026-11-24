import type { ReactNode } from "react";
import {
  normalizeTitleEffect,
  normalizeTitleFont,
  type TitleEffect,
  type TitleFont,
} from "../utils/theme-color";
import { ImageWithFallback } from "./image-with-fallback";

export const GALLERY_CONTAINER_CLASS = "w-full max-w-6xl mx-auto px-4 sm:px-6";

export type PageHeaderMode = "clean" | "banner" | "hidden";

export interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  mode?: PageHeaderMode;
  titleFont?: TitleFont;
  titleEffect?: TitleEffect | string;
  avatar?: string;
  bannerUrl?: string;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  mode = "clean",
  titleFont,
  titleEffect,
  avatar,
  bannerUrl,
  className = "",
}: PageHeaderProps) {
  if (mode === "hidden") {
    if (!actions) {
      return null;
    }
    return (
      <div
        data-page-header-mode="hidden"
        className={`w-full flex items-center justify-end gap-2.5 mb-5 ${className}`.trim()}
      >
        {actions}
      </div>
    );
  }

  const resolvedFont = titleFont ? normalizeTitleFont(titleFont) : undefined;
  const resolvedEffect = titleEffect ? normalizeTitleEffect(titleEffect) : undefined;

  const fontClass = resolvedFont ? `rin-title-font-${resolvedFont}` : "";
  const effectClass = resolvedEffect ? `rin-title-effect-${resolvedEffect}` : "";

  const headingNode = (
    <h1
      data-title-font={resolvedFont}
      data-title-effect={resolvedEffect}
      className={`rin-page-title text-2xl sm:text-3xl font-bold tracking-tight text-[rgb(var(--rin-ink-rgb))] ${fontClass} ${effectClass}`.trim()}
    >
      {title}
    </h1>
  );

  const metaBlock = (
    <div className="min-w-0 space-y-1.5">
      {eyebrow ? (
        <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-[rgb(var(--rin-ink-muted-rgb))]">
          {eyebrow}
        </p>
      ) : null}
      {headingNode}
      {subtitle ? (
        <div className="text-xs sm:text-sm text-[rgb(var(--rin-ink-muted-rgb))] leading-relaxed">
          {subtitle}
        </div>
      ) : null}
    </div>
  );

  if (mode === "banner") {
    return (
      <header
        data-page-header-mode="banner"
        className={`relative w-full rounded-3xl overflow-hidden mb-6 p-6 sm:p-7 border rin-hairline bg-[rgb(var(--rin-surface-rgb))] bg-gradient-to-br from-theme/[0.08] via-theme-secondary/[0.04] to-transparent shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`.trim()}
      >
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
          />
        ) : null}
        <div className="relative z-10 flex items-center gap-4 min-w-0">
          {avatar ? (
            <ImageWithFallback
              src={avatar}
              alt={typeof title === "string" ? title : ""}
              fallbackText={typeof title === "string" ? title : undefined}
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border rin-hairline shrink-0 shadow-xs"
            />
          ) : null}
          {metaBlock}
        </div>
        {actions ? (
          <div className="relative z-10 flex items-center gap-2.5 flex-wrap shrink-0 self-start sm:self-center">
            {actions}
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <header
      data-page-header-mode="clean"
      className={`w-full border-b border-black/[0.06] dark:border-white/[0.08] pb-5 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 ${className}`.trim()}
    >
      {metaBlock}
      {actions ? (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-start sm:self-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
