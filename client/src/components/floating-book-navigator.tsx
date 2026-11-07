import { useEffect, useMemo, useRef, useState } from "react";
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

// 智能精简提炼长标题（去除生硬标点与多余前后缀，保持干练优美）
function formatCompactTitle(raw: string, maxLen = 16): string {
  if (!raw) return "无标题随想";
  let t = raw.trim();
  // 去除开头的引用括号如 【xx】、[xx]
  t = t.replace(/^[【\[][^】\]]+[】\]]\s*/, "");
  // 如果带有副标题横杠，优先保留前半句核心题旨
  if (t.includes(" - ")) {
    t = t.split(" - ")[0].trim();
  } else if (t.includes(" —— ")) {
    t = t.split(" —— ")[0].trim();
  }
  if (t.length > maxLen) {
    return `${t.slice(0, maxLen)}…`;
  }
  return t;
}

export function FloatingBookNavigator() {
  const [location, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [feedsPool, setFeedsPool] = useState<any[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // 严格限定：仅在文章内容 SPA 页面呈现 (如 /feed/:id 或自定义别名页)，首页/星廊/动态等全站绝对不出现
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

  // 读取文章全量池
  useEffect(() => {
    if (!isArticlePage) return;

    client.feed
      .list({ limit: 40, page: 1 })
      .then(({ data }) => {
        if (data?.data && Array.isArray(data.data)) {
          setFeedsPool(data.data);
        }
      })
      .catch(() => {});
  }, [isArticlePage]);

  // 当前文章标题提炼
  const currentFeedTitle = useMemo(() => {
    if (!currentFeedId || !feedsPool.length) return "画廊随想";
    const found = feedsPool.find((f) => String(f.id) === String(currentFeedId));
    return found ? formatCompactTitle(found.title) : "画廊随想";
  }, [currentFeedId, feedsPool]);

  // 随机漫游跳文章 (就像音乐随机播放一样)
  const handleRandomRoam = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!feedsPool.length) return;
    const candidates = feedsPool.filter((f) => String(f.id) !== String(currentFeedId));
    const target = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : feedsPool[0];
    if (target) {
      setLocation(`/feed/${target.id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setShowDrawer(false);
    }
  };

  const handleSelectArticle = (feedId: number | string) => {
    setLocation(`/feed/${feedId}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setShowDrawer(false);
  };

  // Click-outside 外部点击监听自动收起
  useEffect(() => {
    if (!isExpanded && !showDrawer) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        drawerRef.current &&
        !drawerRef.current.contains(target)
      ) {
        setIsExpanded(false);
        setShowDrawer(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isExpanded, showDrawer]);

  if (!isArticlePage) {
    return null;
  }

  return (
    <aside
      aria-label="文章随心漫游控制器"
      className="fixed bottom-20 sm:bottom-22 right-4 sm:right-6 z-40 select-none"
    >
      {/* 状态 1: 折叠状态 (默认仅显示精雕 38px 悬浮小书本，绝对不显示文字冒泡，与播放器呼应) */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          style={{
            background: "linear-gradient(135deg, #FFF5F7 0%, #FFE2E8 50%, #FFD0DA 100%)",
            boxShadow: "0 4px 16px rgba(255, 126, 149, 0.22)",
          }}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#FFD0DA] hover:scale-110 active:scale-95 transition-all cursor-pointer group shadow-md"
          title="点击展开文章漫游控制器"
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
        /* 状态 2: 展开状态 (完全参照播放器组件：纯矢量图标、无实体底框填充、紧凑手掌大胶囊) */
        <div
          ref={containerRef}
          style={{
            background: "rgba(255, 250, 252, 0.86)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 208, 218, 0.75)",
            boxShadow: "0 8px 26px rgba(255, 126, 149, 0.18)",
          }}
          className="relative flex flex-col rounded-full pl-2 pr-3 pt-1 pb-1.5 min-w-[170px] max-w-[210px] ani-show shadow-xl text-xs text-[#503E42] dark:bg-neutral-900/85 dark:text-neutral-200"
        >
          {/* 顶层当前文章微字标识 (居中展示精简标题，无实体底色，温润深棕色 #503E42) */}
          <div className="w-full text-center text-[10px] font-bold text-[#FF7E95] truncate px-1.5 pointer-events-none">
            📖 {currentFeedTitle}
          </div>

          {/* 控制按钮区 (所有按钮去除实体背景色与外框阴影，仅保留纯净矢量图标，默认 #7D5A64，悬停变蜜桃粉 #FF7E95) */}
          <div className="flex items-center justify-between w-full mt-0.5 px-0.5">
            {/* 左侧收起图标 */}
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setShowDrawer(false);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-transparent hover:bg-[#FFD0DA]/20 active:scale-90 transition p-0.5 text-neutral-400 hover:text-[#FF7E95]"
              title="收起漫游控制器"
            >
              <KawaiiBookSvg className="w-4 h-4" />
            </button>

            {/* 随机漫游 (纯矢量图标，如同播放器随机播放按键一样，无粗笨文字填充) */}
            <button
              type="button"
              onClick={handleRandomRoam}
              className="p-1 text-[#7D5A64] hover:text-[#FF7E95] hover:scale-115 active:scale-90 transition cursor-pointer"
              title="随机漫游一篇随想 (就像随机播放)"
            >
              <i className="ri-shuffle-line text-sm font-bold" />
            </button>

            {/* 换一批文章池 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (feedsPool.length > 0) {
                  const shuffled = [...feedsPool].sort(() => 0.5 - Math.random());
                  setFeedsPool(shuffled);
                }
              }}
              className="p-1 text-[#7D5A64] hover:text-[#FF7E95] hover:scale-115 active:scale-90 transition cursor-pointer"
              title="刷新换一批文章"
            >
              <i className="ri-refresh-line text-sm" />
            </button>

            {/* 展开文章列表抽屉 (如同播放器展开选歌单一样) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDrawer(!showDrawer);
              }}
              className={`p-1 transition cursor-pointer ${
                showDrawer ? "text-[#FF7E95] font-bold scale-110" : "text-[#7D5A64] hover:text-[#FF7E95]"
              }`}
              title="展开文章列表选读"
            >
              <i className="ri-play-list-line text-sm" />
            </button>
          </div>

          {/* 类似播放器选歌窗：从上方展开的高度不超过 220px 的极简文章选读窗 (只保留标题，绝无多余描述) */}
          {showDrawer && (
            <div
              ref={drawerRef}
              style={{
                background: "rgba(255, 250, 252, 0.90)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 208, 218, 0.8)",
                boxShadow: "0 10px 30px rgba(255, 126, 149, 0.18)",
              }}
              className="absolute bottom-12 right-0 w-64 max-h-[220px] overflow-y-auto p-2.5 z-50 ani-show flex flex-col gap-1 text-xs scrollbar-thin dark:bg-neutral-900/90"
            >
              <div className="flex items-center justify-between pb-1 px-1 border-b border-[#FFD0DA]/50 text-[11px] text-[#7D5A64] font-bold">
                <span className="flex items-center gap-1">
                  <span>文章漫游</span>
                  <span className="text-[10px] text-[#FF7E95] font-mono">({feedsPool.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  className="text-[#7D5A64] hover:text-[#FF7E95] p-0.5"
                  title="收起列表"
                >
                  <i className="ri-close-line" />
                </button>
              </div>

              {feedsPool.length === 0 ? (
                <p className="text-center text-[#7D5A64]/70 py-6 text-[11px]">正在寻找文章...</p>
              ) : (
                feedsPool.slice(0, 10).map((feed, i) => {
                  const isCur = String(feed.id) === String(currentFeedId);
                  const title = formatCompactTitle(feed.title, 18);
                  return (
                    <div
                      key={feed.id || i}
                      onClick={() => handleSelectArticle(feed.id)}
                      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition select-none ${
                        isCur
                          ? "bg-[#FF7E95]/15 text-[#FF7E95] font-bold shadow-2xs"
                          : "text-[#503E42] dark:text-neutral-200 hover:bg-[#FFD0DA]/30 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] text-[#7D5A64]/60 shrink-0">#{i + 1}</span>
                        {/* 严格遵循用户指令：【只要标题，不要描述】，保持纯净干练 */}
                        <span className="truncate font-medium">{title}</span>
                      </div>
                      {isCur && <span className="text-[9px] text-theme font-mono shrink-0">阅读中</span>}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
