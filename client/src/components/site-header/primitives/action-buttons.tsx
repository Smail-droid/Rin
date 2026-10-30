import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Popup from "reactjs-popup";
import { useLocation } from "wouter";
import { client } from "../../../app/runtime";
import { ClientConfigContext } from "../../../state/config";
import { type Profile } from "../../../state/profile";
import { removeAuthToken } from "../../../utils/auth";
import { ImageWithFallback } from "../../image-with-fallback";
import { HEADER_POPUP_PANEL_CLASS } from "../shared";

export function HeaderActions({
  profile,
  className = "",
  plain = false,
  popoverUp = false,
}: {
  profile?: Profile | null;
  className?: string;
  plain?: boolean;
  popoverUp?: boolean;
}) {
  return (
    <div className={className}>
      <SearchButton plain={plain} />
      <LanguageSwitch plain={plain} popoverUp={popoverUp} />
      <UserAvatar profile={profile} plain={plain} popoverUp={popoverUp} />
    </div>
  );
}

export function SearchButton({ className = "", onClose, plain = false }: { className?: string; onClose?: () => void; plain?: boolean }) {
  const { t } = useTranslation();
  const [isOpened, setIsOpened] = useState(false);
  const [, setLocation] = useLocation();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = t("article.search.title");

  useEffect(() => {
    if (isOpened) {
      inputRef.current?.focus();
    } else {
      setValue("");
      setResults([]);
    }
  }, [isOpened]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpened(false);
        onClose?.();
      }
    };
    if (isOpened) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpened, onClose]);

  useEffect(() => {
    const query = value.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      client.search
        .search(query, { limit: 5 })
        .then(({ data }) => {
          if (data && Array.isArray(data.data)) {
            setResults(data.data);
          } else {
            setResults([]);
          }
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = value.trim();
    if (query) {
      setIsOpened(false);
      onClose?.();
      setLocation(`/search/${encodeURIComponent(query)}`);
    }
  };

  const handleSelectResult = (id: string | number) => {
    setIsOpened(false);
    onClose?.();
    setLocation(`/feed/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpened(false);
      onClose?.();
    }
  };

  return (
    <div ref={containerRef} className={`${className} relative flex items-center`}>
      {!isOpened ? (
        <button
          onClick={() => setIsOpened(true)}
          title={label}
          aria-label={label}
          className={
            plain
              ? "flex aspect-[1] items-center justify-center px-1.5 text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              : "flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button"
          }
        >
          <i className="ri-search-line" />
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center ani-show"
        >
          <div className="flex items-center rounded-full border border-black/15 bg-w dark:border-white/15 px-3 py-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-theme/30 focus-within:border-theme max-w-[85vw] sm:max-w-none w-36 sm:w-60 md:w-72">
            <i className="ri-search-line text-neutral-400 mr-2 shrink-0 text-sm" />
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("article.search.placeholder") || "Search..."}
              className="w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={() => setValue("")}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 ml-1 p-0.5"
              >
                <i className="ri-close-line text-xs" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsOpened(false);
                onClose?.();
              }}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 ml-1.5 p-0.5"
              title={t("close") || "Close"}
            >
              <i className="ri-close-circle-line text-sm" />
            </button>
          </div>

          {/* Live Search Results Dropdown */}
          {value.trim().length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 md:w-96 max-w-[90vw] rounded-2xl border border-black/10 bg-w p-2 shadow-xl backdrop-blur-lg dark:border-white/10 dark:bg-neutral-900/95 z-50 ani-show max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-neutral-400">
                  <i className="ri-loader-4-line animate-spin mr-2 text-base text-theme" />
                  <span>{t("searching") || "Searching..."}</span>
                </div>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    {t("article.search.title") || "Results"}
                  </div>
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectResult(item.id)}
                      className="group flex flex-col items-start rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-white/5 w-full"
                    >
                      <span className="font-medium text-sm text-neutral-800 dark:text-neutral-200 group-hover:text-theme line-clamp-1 transition-colors">
                        {item.title}
                      </span>
                      {item.summary && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                          {item.summary}
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border-t border-black/5 dark:border-white/5 pt-2 pb-1 text-xs font-medium text-theme hover:underline w-full"
                  >
                    <span>{t("article.search.view_all") || "View all results"}</span>
                    <i className="ri-arrow-right-line" />
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-neutral-400">
                  <i className="ri-inbox-line text-2xl block mb-1 opacity-50" />
                  <span>{t("search.no_results") || "No articles found"}</span>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export function LanguageSwitch({ className, plain = false, popoverUp = false }: { className?: string; plain?: boolean; popoverUp?: boolean }) {
  const { i18n } = useTranslation();
  const languages = [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "ja", name: "日本語" },
  ];

  return (
    <div className={className + " flex flex-row items-center"}>
      <Popup
        trigger={
          <button
            title="Languages"
            aria-label="Languages"
            className={
              plain
                ? "flex aspect-[1] items-center justify-center px-1.5 text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                : "flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button"
            }
          >
            <i className="ri-translate-2" />
          </button>
        }
        position={popoverUp ? "top left" : "bottom right"}
        arrow={false}
        closeOnDocumentClick
      >
        <div className={`${HEADER_POPUP_PANEL_CLASS} min-w-40`}>
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Languages
          </p>
          {languages.map(({ code, name }) => (
            <button
              key={code}
              onClick={() => i18n.changeLanguage(code)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm t-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              {name}
            </button>
          ))}
        </div>
      </Popup>
    </div>
  );
}

export function UserAvatar({
  className,
  profile,
  plain = false,
  popoverUp = false,
}: {
  className?: string;
  profile?: Profile | null;
  plain?: boolean;
  popoverUp?: boolean;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const label = t("github_login");
  const config = useContext(ClientConfigContext);
  const [isOpen, setIsOpen] = useState(false);
  const shouldShowEntry = Boolean(profile) || config.getBoolean("login.enabled");

  return shouldShowEntry ? (
    <div className={className + " flex flex-row items-center"}>
      {profile ? (
        <Popup
          arrow={false}
          position={popoverUp ? "top left" : "bottom right"}
          closeOnDocumentClick
          open={isOpen}
          onOpen={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
          trigger={
            <button
              title={t("profile.title")}
              aria-label={t("profile.title")}
              className={
                plain
                  ? "group flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-neutral-500 transition-all hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
                  : "flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-w dark:border-white/10"
              }
            >
              {profile.avatar ? (
                <ImageWithFallback
                  src={profile.avatar}
                  alt={profile.name || t("profile.title")}
                  className="h-8 w-8 cursor-pointer rounded-full"
                  imageClassName="transition duration-200 group-hover:brightness-95"
                />
              ) : (
                <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-black/5 dark:group-hover:bg-white/10">
                  <i className="ri-user-line text-lg t-secondary" />
                </div>
              )}
            </button>
          }
        >
          <div className={`mt-3 flex min-w-44 flex-col ${HEADER_POPUP_PANEL_CLASS}`}>
            <button
              onClick={() => {
                setIsOpen(false);
                setLocation("/profile");
              }}
              className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              {profile.avatar ? (
                <ImageWithFallback src={profile.avatar} alt={profile.name || t("profile.title")} className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <i className="ri-user-line text-lg t-secondary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold t-primary">{profile.name || t("profile.title")}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("profile.title")}</p>
              </div>
            </button>
            {profile.permission ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  setLocation("/admin/writing");
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm t-primary transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                <i className="ri-dashboard-line" />
                <span>{t("admin.title")}</span>
              </button>
            ) : null}
            <button
              onClick={async () => {
                setIsOpen(false);
                await client.user.logout();
                removeAuthToken();
                window.location.reload();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <i className="ri-logout-circle-line" />
              <span>{t("logout")}</span>
            </button>
          </div>
        </Popup>
      ) : (
        <button
          onClick={() => setLocation("/login")}
          title={label}
          aria-label={label}
          className={
            plain
              ? "flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
              : "flex rounded-full border dark:border-neutral-600 px-2 bg-w aspect-[1] items-center justify-center t-primary bg-button"
          }
        >
          <i className="ri-user-received-line" />
        </button>
      )}
    </div>
  ) : null;
}
