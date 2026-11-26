import type { ReactNode } from "react";

export function SettingsBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
        : tone === "danger"
          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300"
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>{children}</span>;
}
