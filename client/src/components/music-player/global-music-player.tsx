import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";

/**
 * 🌸 日系二次元微光星芒音乐音符 (Anime Luminous Melodic Note)
 * - 纯净流线双音符造型，右上角点缀灵动四芒微光星辉
 * - 渐变接入全站画廊当前主题色 (--theme-rgb -> --theme-secondary-rgb)
 * - 双层纯白晶莹高光点 + 柔和多重微光辉光滤镜 (Drop-shadow Glow)
 */
function AnimeLuminousNoteSvg({
  className = "w-7 h-7",
  isPlaying = false,
}: {
  className?: string;
  isPlaying?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        filter:
          "drop-shadow(0 2px 8px rgba(var(--theme-rgb), 0.55)) drop-shadow(0 0 16px rgba(var(--theme-rgb), 0.28))",
        animation: isPlaying ? "spin 10s linear infinite" : "none",
      }}
    >
      <defs>
        {/* 全站主题色自适应柔光渐变 */}
        <linearGradient id="anime-note-theme-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--theme-rgb))" />
          <stop offset="60%" stopColor="rgb(var(--theme-secondary-rgb, var(--theme-hover-rgb)))" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
        </linearGradient>

        {/* 灵动星芒亮光渐变 */}
        <linearGradient id="anime-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgb(var(--theme-secondary-rgb, var(--theme-rgb)))" />
        </linearGradient>
      </defs>

      {/* 1. 灵动四芒星芒 (右上角伴随音符闪烁) */}
      <path
        d="M25 4.5 C25 6.5 26.5 8 28.5 8 C26.5 8 25 9.5 25 11.5 C25 9.5 23.5 8 21.5 8 C23.5 8 25 6.5 25 4.5 Z"
        fill="url(#anime-star-grad)"
        opacity="0.95"
      />
      <circle cx="25" cy="8" r="0.8" fill="#ffffff" />

      {/* 2. 优雅的双音符连梁与挺拔符杆 */}
      <path
        d="M10 22V7.2C10 6.5 10.5 5.9 11.2 5.7L21.2 3.5C22 3.3 22.8 3.9 22.8 4.7V19"
        stroke="url(#anime-note-theme-grad)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 3. 上方双连梁波形横条 */}
      <path
        d="M10 10.5L22.8 7.8"
        stroke="url(#anime-note-theme-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* 4. 左侧倾斜饱满音符头 */}
      <ellipse
        cx="7.2"
        cy="22"
        rx="4.6"
        ry="3.4"
        transform="rotate(-22 7.2 22)"
        fill="url(#anime-note-theme-grad)"
      />
      {/* 左音符二次元晶莹纯白高光点 */}
      <circle cx="6.2" cy="21.2" r="1.1" fill="#ffffff" opacity="0.95" />
      <circle cx="8.2" cy="22.8" r="0.5" fill="#ffffff" opacity="0.8" />

      {/* 5. 右侧倾斜饱满音符头 */}
      <ellipse
        cx="20"
        cy="19.2"
        rx="4.6"
        ry="3.4"
        transform="rotate(-22 20 19.2)"
        fill="url(#anime-note-theme-grad)"
      />
      {/* 右音符二次元晶莹纯白高光点 */}
      <circle cx="19" cy="18.4" r="1.1" fill="#ffffff" opacity="0.95" />
      <circle cx="21" cy="20" r="0.5" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

/**
 * 🌸 cPlayer 经典微型双层卡片播放器 (cPlayer Inspired Minimal Card Player)
 * - 折叠态：彻底去除白色底座，实现纯透明悬浮的日系二次元微光星芒音符！
 * - 展开态：245px × 54px 紧凑黄金双层矩形，左侧 1:1 正方形封面，右侧经典双层中枢
 * - 歌单浮层向下优雅弹出 (top-full mt-2)，彻底解除 overflow 裁切
 * - 全量遵循 Web Interface Guidelines：aria-label 完备、触控无障碍良好、支持 reduced-motion
 */
export function GlobalMusicPlayer() {
  const [location] = useLocation();
  const siteConfig = useSiteConfig();
  const {
    currentTrack,
    playlist,
    isPlaying,
    currentTime,
    duration,
    playMode,
    currentLyricText,
    loadError,
    togglePlay,
    next,
    prev,
    seek,
    setPlayMode,
    play,
    removeTrack,
  } = useMusicPlayer();

  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("rin_music_expanded") === "true";
    } catch {
      return false;
    }
  });

  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const playlistDrawerRef = useRef<HTMLDivElement>(null);
  const playlistToggleBtnRef = useRef<HTMLButtonElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem("rin_music_player_pos");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });
  const hasMovedRef = useRef(false);

  const getSafePosition = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const widgetW = isExpanded ? 255 : 44;
    const widgetH = isExpanded ? 64 : 44;

    const safeX = Math.max(12, Math.min(winW - widgetW - 12, x));
    const safeY = Math.max(60, Math.min(winH - widgetH - 16, y));
    return { x: safeX, y: safeY };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const winH = window.innerHeight;
      const defaultX = 20;
      const defaultY = Math.max(60, winH - 76);

      setPosition((prev) => {
        if (!prev) return { x: defaultX, y: defaultY };
        return getSafePosition(prev.x, prev.y);
      });
    };

    if (position === null) {
      handleResize();
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, isExpanded]);

  useEffect(() => {
    if (!showPlaylistDrawer) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        playlistDrawerRef.current &&
        !playlistDrawerRef.current.contains(target) &&
        playlistToggleBtnRef.current &&
        !playlistToggleBtnRef.current.contains(target)
      ) {
        setShowPlaylistDrawer(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showPlaylistDrawer]);

  const handleCollapsedPointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position?.x ?? 20,
      initY: position?.y ?? (typeof window !== "undefined" ? window.innerHeight - 76 : 500),
    };
    hasMovedRef.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleCollapsedPointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 7) {
      hasMovedRef.current = true;
      setIsDragging(true);
      const nextX = dragStartRef.current.initX + deltaX;
      const nextY = dragStartRef.current.initY + deltaY;
      setPosition(getSafePosition(nextX, nextY));
    }
  };

  const handleCollapsedPointerUp = (e: React.PointerEvent) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const wasDragging = hasMovedRef.current;
    setIsDragging(false);

    if (wasDragging) {
      if (position) {
        try {
          localStorage.setItem("rin_music_player_pos", JSON.stringify(position));
        } catch {}
      }
    } else {
      setIsExpanded(true);
      try {
        localStorage.setItem("rin_music_expanded", "true");
      } catch {}
    }
  };

  const handleExpandedPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest(".progress-bar") ||
      target.closest(".playlist-drawer") ||
      target.closest(".collapse-trigger")
    ) {
      return;
    }

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position?.x ?? 20,
      initY: position?.y ?? (typeof window !== "undefined" ? window.innerHeight - 76 : 500),
    };
    hasMovedRef.current = false;
    setIsDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleExpandedPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 6) {
      hasMovedRef.current = true;
    }

    const nextX = dragStartRef.current.initX + deltaX;
    const nextY = dragStartRef.current.initY + deltaY;
    setPosition(getSafePosition(nextX, nextY));
  };

  const handleExpandedPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (position) {
      try {
        localStorage.setItem("rin_music_player_pos", JSON.stringify(position));
      } catch {}
    }
  };

  const handleResetPosition = () => {
    if (typeof window === "undefined") return;
    const winH = window.innerHeight;
    const pos = { x: 20, y: Math.max(60, winH - 76) };
    setPosition(pos);
    try {
      localStorage.setItem("rin_music_player_pos", JSON.stringify(pos));
    } catch {}
  };

  const handleCollapse = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsDragging(false);
    setIsExpanded(false);
    setShowPlaylistDrawer(false);
    try {
      localStorage.setItem("rin_music_expanded", "false");
    } catch {}
  };

  if (location.startsWith("/admin/music")) {
    return null;
  }

  if (!siteConfig.musicEnabled && playlist.length === 0) {
    return null;
  }

  const currentCoords = position || {
    x: 20,
    y: typeof window !== "undefined" ? window.innerHeight - 76 : 500,
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const effectivePercent = isDraggingProgress && dragRatio !== null ? dragRatio * 100 : progressPercent;

  const handleProgressBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const el = progressBarRef.current;
    if (!el) return;
    try { el.setPointerCapture(e.pointerId); } catch {}
    setIsDraggingProgress(true);
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragRatio(ratio);
  };

  const handleProgressBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingProgress) return;
    e.stopPropagation();
    const el = progressBarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragRatio(ratio);
  };

  const handleProgressBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingProgress) return;
    e.stopPropagation();
    const el = progressBarRef.current;
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch {}
    }
    setIsDraggingProgress(false);
    if (dragRatio !== null && duration > 0) {
      seek(dragRatio * duration);
    }
    setDragRatio(null);
  };

  const trackTitle = currentTrack?.name || "画廊随想电台";
  const trackArtist = currentTrack?.artist || "随心漫游";
  const displayText = currentLyricText ? `♫ ${currentLyricText}` : `${trackTitle} - ${trackArtist}`;

  return (
    <div
      style={{
        transform: `translate3d(${currentCoords.x}px, ${currentCoords.y}px, 0)`,
        touchAction: "none",
      }}
      className={`fixed top-0 left-0 z-50 select-none ${
        isDragging ? "cursor-grabbing opacity-90 transition-none" : "transition-transform duration-75"
      }`}
    >
      {/* 状态 1: 折叠状态 (彻底去除白底座与边框！纯透明悬浮二次元微光星芒音符) */}
      {!isExpanded ? (
        <div
          className="relative group flex items-center justify-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {showTooltip && (
            <div
              role="tooltip"
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-[#141720]/95 text-neutral-800 dark:text-neutral-100 text-[11px] font-bold shadow-md border border-neutral-200/80 dark:border-white/10 pointer-events-none ani-show backdrop-blur-md truncate max-w-[190px]"
            >
              {displayText}
            </div>
          )}

          {/* 纯透明音符按钮：零白色背景，零硬边框，只有灵动的微光音符悬浮 */}
          <button
            type="button"
            onPointerDown={handleCollapsedPointerDown}
            onPointerMove={handleCollapsedPointerMove}
            onPointerUp={handleCollapsedPointerUp}
            onDoubleClick={handleResetPosition}
            aria-label="展开音乐播放器"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent border-0 p-0 shadow-none hover:scale-120 active:scale-95 transition-transform duration-200 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-theme/60 outline-none select-none ${
              isDragging ? "scale-110" : ""
            }`}
            title="点击展开播放器 (按住可拖动，双击复位)"
          >
            {/* 播放时纯透明微光呼吸波纹 */}
            {isPlaying && (
              <span
                className="absolute inset-0 rounded-full border border-dashed border-theme/40 animate-ping duration-[2800ms] pointer-events-none motion-reduce:hidden"
                aria-hidden="true"
              />
            )}

            <AnimeLuminousNoteSvg
              className="w-8 h-8 pointer-events-none transition-transform"
              isPlaying={isPlaying}
            />
          </button>
        </div>
      ) : (
        /* 状态 2: 展开状态 (cPlayer 经典黄金微卡片：左侧正方形封面 + 右侧经典双层中枢) */
        <div
          onPointerDown={handleExpandedPointerDown}
          onPointerMove={handleExpandedPointerMove}
          onPointerUp={handleExpandedPointerUp}
          onDoubleClick={handleResetPosition}
          className={`relative group flex items-stretch h-[54px] w-[245px] sm:w-[260px] rounded-xl bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-xl border border-neutral-200/80 dark:border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.55)] transition-all cursor-grab active:cursor-grabbing ani-show ${
            isDragging ? "scale-95 ring-2 ring-theme/40 transition-none" : "hover:border-theme/40"
          }`}
        >
          {/* 1. 左侧：正方形专辑封面 (带 collapse-trigger，点击秒速收缩为纯透明音符) */}
          <button
            type="button"
            onClick={handleCollapse}
            aria-label="收起为微光音符图标"
            className="collapse-trigger relative h-[54px] w-[54px] shrink-0 bg-neutral-900 rounded-l-xl overflow-hidden cursor-pointer group/cover border-0 p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-theme/60"
            title="点击收缩为微光音符图标"
          >
            {currentTrack?.pic ? (
              <img
                src={currentTrack.pic}
                alt=""
                className={`h-full w-full object-cover transition-transform duration-500 ${isPlaying ? "scale-105" : ""}`}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-theme/10">
                <AnimeLuminousNoteSvg className="w-7 h-7" isPlaying={isPlaying} />
              </div>
            )}
            {/* 悬停微暗幕浮现折叠提示图标 */}
            <div
              className="absolute inset-0 bg-black/45 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
              aria-hidden="true"
            >
              <i className="ri-contract-left-right-line text-sm" />
            </div>
          </button>

          {/* 2. 右侧：cPlayer 经典双层控制与曲目信息区 */}
          <div className="flex-1 min-w-0 flex flex-col justify-between p-1.5 pl-2 relative">
            {/* 上半层：经典控制三联键 (居中) + 右侧循环模式与歌单 */}
            <div className="flex items-center justify-between w-full h-6">
              {/* 控制中枢三联键：上一曲 + 经典 cPlayer 空心圆圈播放键 + 下一曲 */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  aria-label="上一曲"
                  className="p-1 text-theme hover:scale-115 active:scale-90 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md"
                  title="上一曲"
                >
                  <i className="ri-skip-back-fill text-xs" aria-hidden="true" />
                </button>

                {/* 经典 cPlayer 标志性空心圆圈内嵌播放三角按钮 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  aria-label={isPlaying ? "暂停播放" : "开始播放"}
                  className="h-5 w-5 rounded-full border border-theme text-theme flex items-center justify-center hover:scale-110 active:scale-95 transition cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-theme/50"
                  title={isPlaying ? "暂停" : "播放"}
                >
                  <i className={isPlaying ? "ri-pause-fill text-[10px]" : "ri-play-fill text-[10px] translate-x-0.2"} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  aria-label="下一曲"
                  className="p-1 text-theme hover:scale-115 active:scale-90 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md"
                  title="下一曲"
                >
                  <i className="ri-skip-forward-fill text-xs" aria-hidden="true" />
                </button>
              </div>

              {/* 右侧辅助组：循环模式 + 歌单列表 + 显式收起按钮 */}
              <div className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                    setPlayMode(nextMode);
                  }}
                  aria-label={`切换循环模式 (当前: ${playMode})`}
                  className={`p-1 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md ${
                    playMode !== "loop" ? "text-theme font-bold" : "hover:text-theme"
                  }`}
                  title={playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
                >
                  {playMode === "loop" && <i className="ri-repeat-2-line text-xs" aria-hidden="true" />}
                  {playMode === "single" && <i className="ri-repeat-one-line text-xs" aria-hidden="true" />}
                  {playMode === "random" && <i className="ri-shuffle-line text-xs" aria-hidden="true" />}
                </button>

                {/* 播放列表触发按钮 */}
                <button
                  ref={playlistToggleBtnRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlaylistDrawer((prev) => !prev);
                  }}
                  aria-label={showPlaylistDrawer ? "关闭待播清单" : "展开待播清单"}
                  className={`p-1 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md ${
                    showPlaylistDrawer ? "text-theme font-bold" : "hover:text-theme"
                  }`}
                  title={showPlaylistDrawer ? "关闭待播清单" : "展开待播清单"}
                >
                  <i className="ri-play-list-line text-xs" aria-hidden="true" />
                </button>

                {/* 显式折叠图标按钮 */}
                <button
                  type="button"
                  onClick={handleCollapse}
                  aria-label="收起为微光徽标"
                  className="collapse-trigger p-1 text-neutral-400 hover:text-theme transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md"
                  title="收起为微光图标微标"
                >
                  <i className="ri-arrow-down-s-line text-xs" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* 下半层：居中单行曲目信息 (歌名 - 歌手 或 实时 LRC 歌词) */}
            <div className="w-full truncate text-[11px] font-medium text-neutral-600 dark:text-neutral-300 text-center select-none pt-0.5 border-t border-black/[0.04] dark:border-white/5">
              <span className="truncate block" title={displayText}>
                {displayText}
              </span>
            </div>
          </div>

          {/* 3. 底部贴边极细流光进度条 */}
          <div
            ref={progressBarRef}
            onPointerDown={handleProgressBarPointerDown}
            onPointerMove={handleProgressBarPointerMove}
            onPointerUp={handleProgressBarPointerUp}
            onPointerCancel={handleProgressBarPointerUp}
            className="progress-bar absolute bottom-0 inset-x-0 h-1.5 flex items-end cursor-pointer group select-none z-10 rounded-b-xl overflow-hidden"
            title="点击快进 / 倒退"
          >
            <div className="w-full h-[2px] group-hover:h-[3px] bg-neutral-200/60 dark:bg-white/10 transition-all duration-150">
              <div
                style={{ width: `${effectivePercent}%` }}
                className="h-full bg-theme transition-[width] duration-75"
              />
            </div>
          </div>

          {/* 4. 歌单展开浮层 (向下优雅展开：top-full mt-2) */}
          {showPlaylistDrawer && (
            <div
              ref={playlistDrawerRef}
              className="playlist-drawer absolute top-full mt-2 left-0 w-72 max-h-60 overflow-y-auto p-2.5 z-50 ani-show flex flex-col gap-1 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-[#14161f]/95 backdrop-blur-2xl shadow-2xl text-xs scrollbar-thin select-none"
            >
              <div className="flex items-center justify-between pb-1.5 px-1 border-b border-neutral-100 dark:border-white/10 text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                <span className="flex items-center gap-1.5">
                  <i className="ri-play-list-line text-theme" aria-hidden="true" />
                  <span>待播清单</span>
                  <span className="text-[10px] text-theme font-mono font-bold">({playlist.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPlaylistDrawer(false)}
                  aria-label="关闭待播清单"
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-theme/50"
                  title="收起"
                >
                  <i className="ri-close-line text-sm" aria-hidden="true" />
                </button>
              </div>

              {playlist.length === 0 ? (
                <p className="text-center text-neutral-400 py-6 text-[11px]">暂无曲目，请在音廊中收录…</p>
              ) : (
                playlist.map((track, i) => {
                  const isCur = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id || i}
                      onClick={() => play(track)}
                      className={`flex items-center justify-between p-1.5 rounded-xl cursor-pointer transition select-none ${
                        isCur
                          ? "bg-theme/10 text-theme font-bold shadow-2xs"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-[10px] text-neutral-400 w-3.5 shrink-0 text-center">
                          {isCur && isPlaying ? (
                            <span className="inline-flex items-center gap-0.5 text-theme" aria-label="正在播放">
                              <span className="w-0.5 h-2.5 bg-theme rounded-full animate-bounce [animation-delay:0ms] motion-reduce:animate-none" />
                              <span className="w-0.5 h-3.5 bg-theme rounded-full animate-bounce [animation-delay:150ms] motion-reduce:animate-none" />
                              <span className="w-0.5 h-2 bg-theme rounded-full animate-bounce [animation-delay:300ms] motion-reduce:animate-none" />
                            </span>
                          ) : (
                            `#${i + 1}`
                          )}
                        </span>
                        <span className="truncate text-xs">{track.name}</span>
                        <span className="text-[10px] text-neutral-400 truncate">- {track.artist}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrack(track.id);
                        }}
                        aria-label={`从待播清单移出曲目 ${track.name}`}
                        className="text-neutral-400 hover:text-rose-500 p-1 transition cursor-pointer rounded-md hover:bg-black/5 dark:hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-rose-400/50"
                        title="从清单移出"
                      >
                        <i className="ri-close-line text-xs" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 错误自愈提示微标 */}
          {loadError && (
            <div
              role="alert"
              className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800/40 pointer-events-none ani-show shadow-xs"
            >
              {loadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
