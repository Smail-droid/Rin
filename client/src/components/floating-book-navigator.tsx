import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { client } from "../app/runtime";

// 精雕日系二次元可爱微光矢量 SVG 小书本 (彻底拒绝像素 Emoji，纯矢量手绘微光)
function KawaiiBookSvg({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: "drop-shadow(0 2px 8px rgba(255, 126, 149, 0.45))",
      }}
    >
      <defs>
        <linearGradient id="kawaii-book-cover" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4D79" />
          <stop offset="50%" stopColor="#FF7E95" />
          <stop offset="100%" stopColor="#FFA6B7" />
        </linearGradient>
        <linearGradient id="kawaii-book-pages" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFF2F5" />
        </linearGradient>
        <linearGradient id="kawaii-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* 书本封面背衬 */}
      <path
        d="M3.5 19.5C5.5 18.5 8.5 18.5 12 20.2C15.5 18.5 18.5 18.5 20.5 19.5V5.5C18.5 4.5 15.5 4.5 12 6.2C8.5 4.5 5.5 4.5 3.5 5.5V19.5Z"
        fill="url(#kawaii-book-cover)"
        stroke="#FF4D79"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 书本书页折叠层 (左页与右页) */}
      <path
        d="M4.5 18.5C6.5 17.5 9 17.5 12 19V5.5C9 4 6.5 4 4.5 5V18.5Z"
        fill="url(#kawaii-book-pages)"
        stroke="#FFD0DA"
        strokeWidth="0.8"
      />
      <path
        d="M19.5 18.5C17.5 17.5 15 17.5 12 19V5.5C15 4 17.5 4 19.5 5V18.5Z"
        fill="url(#kawaii-book-pages)"
        stroke="#FFD0DA"
        strokeWidth="0.8"
      />

      {/* 黄金丝带书签 */}
      <path
        d="M11 5V12L12 11L13 12V5H11Z"
        fill="url(#kawaii-ribbon)"
      />

      {/* 二次元白色高光点 */}
      <circle cx="6.5" cy="8.5" r="0.75" fill="#FFFFFF" opacity="0.9" />
      <circle cx="17.5" cy="8.5" r="0.75" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

export function FloatingBookNavigator() {
  const [location] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [feeds, setFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 管理后台路由下自动隐藏，保持管理控制台专注整洁
  const isExcluded = location.startsWith("/admin") || location.startsWith("/login");

  // 加载精选文章用于漫游推荐
  const loadRecommendedFeeds = async () => {
    setLoading(true);
    try {
      const { data } = await client.feed.list({ limit: 30, page: 1 });
      if (data?.data && Array.isArray(data.data)) {
        // 随机打乱抽取 5 篇
        const shuffled = [...data.data].sort(() => 0.5 - Math.random());
        setFeeds(shuffled.slice(0, 5));
      }
    } catch {
      // 容错
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && feeds.length === 0) {
      void loadRecommendedFeeds();
    }
  }, [isExpanded]);

  // Click-outside 外部点击监听自动收拢
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        drawerRef.current &&
        !drawerRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isExpanded]);

  if (isExcluded) {
    return null;
  }

  return (
    <aside
      aria-label="画廊漫游与随心阅读"
      className="fixed bottom-20 sm:bottom-22 right-4 sm:right-6 z-40 select-none"
    >
      {/* 折叠状态：纯矢量手绘日系小书本悬浮按钮 */}
      {!isExpanded ? (
        <div
          className="relative group flex items-center justify-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* 轻量悬浮 Tooltip */}
          {showTooltip && (
            <div className="absolute -top-8 right-0 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-[#FFFAFC]/95 text-[#503E42] text-[11px] font-bold shadow-md border border-[#FFD0DA]/70 pointer-events-none ani-show backdrop-blur-md">
              画廊漫游 · 随心阅读
            </div>
          )}

          <button
            ref={buttonRef}
            type="button"
            onClick={() => setIsExpanded(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/70 dark:bg-neutral-900/70 border border-[#FFD0DA] shadow-md backdrop-blur-md hover:scale-110 active:scale-95 transition-all cursor-pointer group"
            title="点击展开画廊文章随心漫游"
          >
            {/* 呼吸微光圈 */}
            <span
              style={{ borderColor: "#FF7E95" }}
              className="absolute inset-0 rounded-full border border-dashed opacity-50 animate-pulse duration-[3000ms] pointer-events-none"
            />
            <div className="transition-transform group-hover:rotate-6">
              <KawaiiBookSvg className="w-6 h-6" />
            </div>
          </button>
        </div>
      ) : (
        /* 展开状态：二次元奶油粉白毛玻璃抽屉 (半透明防遮挡，一键切文章与换一批) */
        <div
          ref={drawerRef}
          style={{
            background: "rgba(255, 250, 252, 0.92)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255, 208, 218, 0.85)",
            boxShadow: "0 12px 36px rgba(255, 126, 149, 0.2)",
          }}
          className="w-76 sm:w-84 max-h-[75vh] rounded-3xl p-3.5 shadow-2xl flex flex-col gap-2.5 ani-show text-xs text-[#503E42] dark:bg-neutral-900/90 dark:text-neutral-200"
        >
          {/* 抽屉头部 */}
          <div className="flex items-center justify-between pb-2 border-b border-[#FFD0DA]/60">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <KawaiiBookSvg className="w-5 h-5 shrink-0" />
              <span className="text-[#503E42] dark:text-neutral-100 font-bold">画廊漫游 · 随心阅读</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadRecommendedFeeds}
                disabled={loading}
                className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-theme hover:bg-theme/10 transition flex items-center gap-0.5"
                title="随机换一批文章"
              >
                <i className={`ri-dice-line text-xs ${loading ? "animate-spin" : ""}`} />
                <span>换一批</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
                title="收起抽屉"
              >
                <i className="ri-close-line text-base" />
              </button>
            </div>
          </div>

          {/* 文章推荐流 */}
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[55vh] pr-0.5 scrollbar-thin">
            {loading && feeds.length === 0 ? (
              <div className="py-12 text-center text-neutral-400">
                <i className="ri-loader-4-line animate-spin text-lg block mb-1 text-theme" />
                <span>正在寻找灵感文章...</span>
              </div>
            ) : feeds.length === 0 ? (
              <div className="py-10 text-center text-neutral-400">
                <span>暂无推荐文章</span>
              </div>
            ) : (
              feeds.map((feed) => {
                const cover = feed.coverImage || feed.avatar;
                const isCurrent = location === `/feed/${feed.id}` || location === `/${feed.alias}`;

                return (
                  <Link
                    key={feed.id}
                    href={`/feed/${feed.id}`}
                    onClick={() => {
                      setIsExpanded(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={`flex items-start gap-2.5 p-2 rounded-2xl transition group/item select-none cursor-pointer ${
                      isCurrent
                        ? "bg-theme/15 text-theme font-bold border border-theme/30"
                        : "hover:bg-[#FFD0DA]/30 dark:hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {/* 文章封面缩略图 */}
                    <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center">
                      {cover ? (
                        <img src={cover} alt="" className="h-full w-full object-cover group-hover/item:scale-105 transition-transform" />
                      ) : (
                        <KawaiiBookSvg className="w-5 h-5 opacity-70" />
                      )}
                    </div>

                    {/* 文章标题与时间 */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs truncate group-hover/item:text-theme transition-colors">
                        {feed.title || "无标题随想"}
                      </h4>
                      <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                        {feed.summary || "点击即刻深度漫游此篇随想"}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* 抽屉底部 */}
          <div className="pt-1.5 border-t border-[#FFD0DA]/60 flex items-center justify-between text-[11px] text-neutral-400">
            <Link
              href="/"
              onClick={() => setIsExpanded(false)}
              className="hover:text-theme transition flex items-center gap-1 font-semibold"
            >
              <span>返回画廊首页</span>
              <i className="ri-arrow-right-s-line text-xs" />
            </Link>
            <Link
              href="/hashtags"
              onClick={() => setIsExpanded(false)}
              className="hover:text-theme transition font-semibold"
            >
              标签星云
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
