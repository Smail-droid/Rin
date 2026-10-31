import type { ReactNode } from "react";

export function SettingsPreviewCard({
  children,
  description,
  preview,
  selected,
  title,
  onClick,
  compact = false,
}: {
  children?: ReactNode;
  description: string;
  preview: ReactNode;
  selected: boolean;
  title: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col ${compact ? "rounded-2xl" : "rounded-[28px]"} border text-left transition-all ${
        selected
          ? "border-theme bg-theme/5 shadow-md shadow-theme/10 ring-1 ring-theme"
          : "border-black/10 bg-white hover:border-black/20 dark:border-white/10 dark:bg-neutral-950 dark:hover:border-white/20"
      }`}
    >
      <div className={`flex items-start justify-between gap-2 border-b border-black/5 ${compact ? "px-3 py-2" : "px-4 py-3"} dark:border-white/10`}>
        <div className="min-w-0 flex-1">
          <p className={`${compact ? "text-xs font-bold" : "text-sm font-semibold"} t-primary truncate`}>{title}</p>
          <p className={`mt-0.5 ${compact ? "text-[11px] line-clamp-1" : "text-xs"} text-neutral-500 dark:text-neutral-400`}>{description}</p>
          {children ? <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{children}</div> : null}
        </div>
        {selected ? <i className={`ri-check-line ${compact ? "text-base" : "text-lg"} text-theme shrink-0`} aria-hidden="true" /> : null}
      </div>
      <div className={`flex flex-1 items-stretch bg-[linear-gradient(180deg,rgba(var(--theme-rgb),0.08),transparent)] ${compact ? "p-2 max-h-44 overflow-hidden" : "p-4"}`}>
        <div className={`flex w-full items-stretch ${compact ? "rounded-xl text-[11px] origin-top scale-[0.88]" : "rounded-[22px]"}`}>
          {preview}
        </div>
      </div>
    </button>
  );
}
