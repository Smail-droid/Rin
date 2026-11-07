import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { client } from "../app/runtime";

// 精雕日系二次元可爱微光矢量 SVG 小书本 (纯矢量手绘，蜜桃珊瑚粉微光)
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

      {/* 书页左右折叠层 */}
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
      <path d="M11 5V12L12 11L13 12V5H11Z" fill="url(#kawaii-ribbon)" />

      {/* 白色微光点 */}
      <circle cx="6.5" cy="8.5" r="0.75" fill="#FFFFFF" opacity="0.9" />
      <circle cx="17.5" cy="8.5" r="0.75" fill="#FFFFFF" opacity="0.9" />
    </svg>
  );
}

export function FloatingBookNavigator() {
  const [location, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [adjacent, setAdjacent] = useState<{ prev: any | null; next: any | null }>({ prev: null, next: null });
  const [randomPool, setRandomPool] = useState<any[]>([]);

  const drawerRef = useRef<HTMLDivElement>(null);

  // 严格限定：仅在文章内容 SPA 页面呈现 (如 /feed/:id 或自定义别名文章页)，首页/相册/动态等绝对不出现
  const feedIdMatch = location.match(/^\/feed\/([^/]+)/);
  const currentFeedId = feedIdMatch ? feedIdMatch[1] : null;

  const isArticlePage =
    Boolean(currentFeedId) ||
    (location !== "/" &&
      !location.startsWith("/admin") &&
      !location.startsWith("/login") &&
      !location.startsWith("/friends") &&
      !location.startsWith("/moments") &&
      !location.startsWith("/timeline") &&
      !location.startsWith("/search") &&
      !location.startsWith("/hashtags") &&
      !location.startsWith("/hashtag/"));

  // 读取上一篇/下一篇文章数据
  useEffect(() => {
    if (!isArticlePage || !currentFeedId) {
      setAdjacent({ prev: null, next: null });
      return;
    }

    client.feed
      .adjacent(currentFeedId)
      .then(({ data }) => {
        if (data && typeof data !== "string") {
          setAdjacent({
            prev: data.previousFeed || null,
            next: data.nextFeed || null,
          });
        }
      })
      .catch(() => {});
  }, [currentFeedId, isArticlePage]);

  // 读取全站文章池用于“随便看看 / 随机漫游”
  useEffect(() => {
    if (!isArticlePage) return;

    client.feed
      .list({ limit: 40, page: 1 })
      .then(({ data }) => {
        if (data?.data && Array.isArray(data.data)) {
          setRandomPool(data.data);
        }
      })
      .catch(() => {});
  }, [isArticlePage]);

  // 随机漫游跳文章
  const handleRandomRoam = () => {
    if (!randomPool.length) return;
    const candidates = randomPool.filter((f) => String(f.id) !== String(currentFeedId));
    const target = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : randomPool[0];
    if (target) {
      setLocation(`/feed/${target.id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setIsExpanded(false);
    }
  };

  const handleGoTo = (targetId: number | string) => {
    setLocation(`/feed/${targetId}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsExpanded(false);
  };

  // Click-outside 外部点击监听自动收起
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (drawerRef.current && !drawerRef.current.contains(target)) {
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

  if (!isArticlePage) {
    return null;
  }

  return (
    <aside
      aria-label="文章随心漫游控制器"
      className="fixed bottom-20 sm:bottom-22 right-4 sm:right-6 z-40 select-none"
    >
      {/* 状态 1: 折叠状态 (默认仅显示精雕 38px 悬浮小书本，绝对不显示文字冒泡，零视觉侵扰) */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/75 dark:bg-neutral-900/75 border border-[#FFD0DA] shadow-md backdrop-blur-md hover:scale-110 active:scale-95 transition-all cursor-pointer group"
          title="点击展开文章漫游 (上一篇 / 随便看看 / 下一篇)"
        >
          {/* 呼吸微光波纹 */}
          <span
            style={{ borderColor: "#FF7E95" }}
            className="absolute inset-0 rounded-full border border-dashed opacity-40 animate-pulse duration-[3000ms] pointer-events-none"
          />
          <div className="transition-transform group-hover:rotate-6">
            <KawaiiBookSvg className="w-5.5 h-5.5" />
          </div>
        </button>
      ) : (
        /* 状态 2: 展开状态 (参考播放器组件的极简奶油粉白胶囊，绝不超屏、紧凑优雅) */
        <div
          ref={drawerRef}
          style={{
            background: "rgba(255, 250, 252, 0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 208, 218, 0.75)",
            boxShadow: "0 8px 24px rgba(255, 126, 149, 0.18)",
          }}
          className="relative flex flex-col rounded-full pl-2 pr-3 pt-1 pb-1.5 min-w-[210px] max-w-[260px] ani-show shadow-xl text-xs text-[#503E42] dark:bg-neutral-900/85 dark:text-neutral-200"
        >
          {/* 顶层微字标识 */}
          <div className="w-full text-center text-[10px] font-bold text-[#FF7E95] truncate px-2 pointer-events-none">
            随心漫游
          </div>

          {/* 控制按钮组 (上一篇、随便看看、下一篇、收起) */}
          <div className="flex items-center justify-between w-full mt-0.5">
            {/* 左侧收起图标 */}
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-transparent hover:bg-[#FFD0DA]/30 active:scale-90 transition p-0.5 text-neutral-400 hover:text-[#FF7E95]"
              title="收起漫游"
            >
              <KawaiiBookSvg className="w-4 h-4" />
            </button>

            {/* 上一篇 */}
            <button
              type="button"
              onClick={() => adjacent.prev && handleGoTo(adjacent.prev.id)}
              disabled={!adjacent.prev}
              className={`p-1 transition flex items-center gap-0.5 font-bold ${
                adjacent.prev ? "text-[#503E42] dark:text-neutral-200 hover:text-[#FF7E95] hover:scale-110 active:scale-90 cursor-pointer" : "text-neutral-300 dark:text-neutral-600 opacity-40 cursor-not-allowed"
              }`}
              title={adjacent.prev ? `上一篇: ${adjacent.prev.title}` : "没有上一篇了"}
            >
              <i className="ri-skip-back-line text-sm" />
              <span className="text-[11px]">上一篇</span>
            </button>

            {/* 随便看看 (随机抽一篇) */}
            <button
              type="button"
              onClick={handleRandomRoam}
              className="px-2 py-0.5 rounded-full bg-[#FF7E95]/15 text-[#FF7E95] hover:bg-[#FF7E95] hover:text-white transition font-bold text-[11px] flex items-center gap-0.5 active:scale-95 shadow-2xs cursor-pointer"
              title="随机漫游一篇全站随想"
            >
              <i className="ri-dice-line text-xs" />
              <span>随便看看</span>
            </button>

            {/* 下一篇 */}
            <button
              type="button"
              onClick={() => adjacent.next && handleGoTo(adjacent.next.id)}
              disabled={!adjacent.next}
              className={`p-1 transition flex items-center gap-0.5 font-bold ${
                adjacent.next ? "text-[#503E42] dark:text-neutral-200 hover:text-[#FF7E95] hover:scale-110 active:scale-90 cursor-pointer" : "text-neutral-300 dark:text-neutral-600 opacity-40 cursor-not-allowed"
              }`}
              title={adjacent.next ? `下一篇: ${adjacent.next.title}` : "没有下一篇了"}
            >
              <span className="text-[11px]">下一篇</span>
              <i className="ri-skip-forward-line text-sm" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
