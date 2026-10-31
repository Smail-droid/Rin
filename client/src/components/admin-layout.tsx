import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { ImageWithFallback } from "./image-with-fallback";

function AdminNavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  const [location] = useLocation();
  const active = location === href || location.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`shrink-0 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-theme text-white"
          : "t-primary hover:bg-neutral-100 dark:hover:bg-white/5"
      }`}
    >
      <i className={`${icon} text-base`} />
      <span>{label}</span>
    </Link>
  );
}

export function AdminLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [adminZoom, setAdminZoom] = useState<number>(() => {
    if (typeof localStorage === "undefined") return 100;
    const stored = localStorage.getItem("rin_admin_zoom");
    const parsed = Number.parseInt(stored || "100", 10);
    return Number.isNaN(parsed) ? 100 : Math.min(100, Math.max(50, parsed));
  });

  const handleSetZoom = (val: number) => {
    const clamped = Math.min(100, Math.max(50, val));
    setAdminZoom(clamped);
    try {
      localStorage.setItem("rin_admin_zoom", String(clamped));
    } catch {}
  };

  return (
    <div
      style={{ zoom: `${adminZoom}%` }}
      className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-all duration-200"
    >
      <div className="mx-auto flex w-full max-w-[1780px] 2xl:max-w-[1920px] flex-col gap-6 px-3 sm:px-6 py-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-60 xl:w-64 lg:self-start flex flex-col gap-3">
          <div className="rounded-2xl border border-black/10 bg-w p-4 sm:p-5 dark:border-white/10">
            <Link href="/" className="flex items-center gap-4 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-50 dark:hover:bg-white/5">
              {siteConfig.avatar ? (
                <ImageWithFallback src={siteConfig.avatar} alt={siteConfig.name} className="h-12 w-12 rounded-2xl border border-black/10 dark:border-white/10" />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold t-primary">{siteConfig.name}</p>
                <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{t("admin.back_to_site")}</p>
              </div>
            </Link>

            <div className="mt-6">
              <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
                {t("admin.title")}
              </p>
              <div className="mt-3 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                <AdminNavItem href="/admin/writing" icon="ri-quill-pen-line" label={t("writing")} />
                <AdminNavItem href="/admin/files" icon="ri-folder-image-line" label={t("admin_files.title")} />
                <AdminNavItem href="/admin/settings" icon="ri-settings-3-line" label={t("settings.title")} />
                <AdminNavItem href="/admin/tags" icon="ri-price-tag-3-line" label="标签管理" />
                <AdminNavItem href="/admin/health" icon="ri-heart-pulse-line" label={t("health.title")} />
                <AdminNavItem href="/admin/ai" icon="ri-sparkling-fill" label="AI 助手" />
                <AdminNavItem href="/admin/queue-status" icon="ri-todo-line" label={t("queue_status.title")} />
                <AdminNavItem href="/admin/compat-tasks" icon="ri-history-line" label={t("compat_tasks.title")} />
              </div>
            </div>

            {/* Admin Zoom / Viewport Scaling Controller (后台缩放微调与记忆保存) */}
            <div className="mt-5 pt-3 border-t border-black/5 dark:border-white/5 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <i className="ri-zoom-in-line" />
                  <span>后台界面缩放</span>
                </span>
                <span className="font-mono text-xs font-bold text-theme">{adminZoom}%</span>
              </div>

              <div className="flex items-center gap-2 px-1">
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={adminZoom}
                  onChange={(e) => handleSetZoom(Number.parseInt(e.target.value, 10))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-theme dark:bg-white/10"
                />
              </div>

              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[50, 70, 85, 100].map((scale) => {
                  const isSelected = adminZoom === scale;
                  return (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleSetZoom(scale)}
                      className={`flex-1 rounded-md py-1 text-[10px] font-semibold transition text-center select-none ${
                        isSelected
                          ? "bg-theme text-white shadow-2xs font-bold"
                          : "bg-black/5 text-neutral-500 hover:bg-black/10 dark:bg-white/5 dark:text-neutral-400"
                      }`}
                    >
                      {scale === 100 ? "100%" : `${scale}%`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Assistant Quick Trigger in Sidebar */}
            <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event("toggle-ai-copilot"));
                }}
                className="w-full group flex items-center gap-2.5 p-2 rounded-xl bg-theme/5 hover:bg-theme/10 border border-theme/20 hover:border-theme/40 transition-all text-left shadow-2xs"
                title="点击呼出/收回 AI 萌娘伴侣"
              >
                <div className="h-8 w-8 rounded-lg bg-theme/15 flex items-center justify-center text-theme shrink-0 group-hover:scale-110 transition-transform">
                  <i className="ri-sparkling-fill text-base" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-theme flex items-center gap-1">
                    <span>AI 萌娘伴侣</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate">点击展开/收回助手 (-)</p>
                </div>
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-2xl border border-black/10 bg-w p-6 dark:border-white/10">
            <div className="border-b border-black/5 pb-5 dark:border-white/5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">{t("admin.title")}</p>
              <h1 className="mt-2 break-words text-3xl font-semibold tracking-[-0.03em] t-primary [overflow-wrap:anywhere]">{title}</h1>
              <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-neutral-500 dark:text-neutral-400 [overflow-wrap:anywhere]">{description}</p>
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
