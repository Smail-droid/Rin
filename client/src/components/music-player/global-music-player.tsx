import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";

/** 精雕日系二次元可爱微光矢量 SVG 音符 (全站主题色渐变驱动 + 晶莹高光点) */
function KawaiiMusicNoteSvg({
  className = "w-5 h-5",
  isPlaying = false,
}: {
  className?: string;
  isPlaying?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: "drop-shadow(0 2px 6px rgba(var(--theme-rgb), 0.35))",
        animation: isPlaying ? "spin 8s linear infinite" : "none",
      }}
    >
      <defs>
        <linearGradient id="kawaii-note-theme-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--theme-rgb))" />
          <stop offset="100%" stopColor="rgb(var(--theme-hover-rgb))" />
        </linearGradient>
      </defs>
      {/* 优雅的双音符连梁 */}
      <path
        d="M9 16.5V5.2C9 4.7 9.4 4.3 9.9 4.2L18.9 2.5C19.5 2.4 20 2.8 20 3.4V14.5"
        stroke="url(#kawaii-note-theme-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 上方连梁横杠 */}
      <path
        d="M9 8.2L20 6.2"
        stroke="url(#kawaii-note-theme-grad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 左音符实体 (倾斜椭圆) */}
      <ellipse
        cx="6.8"
        cy="16.5"
        rx="3.6"
        ry="2.7"
        transform="rotate(-18 6.8 16.5)"
        fill="url(#kawaii-note-theme-grad)"
      />
      {/* 右音符实体 */}
      <ellipse
        cx="17.8"
        cy="14.5"
        rx="3.6"
        ry="2.7"
        transform="rotate(-18 17.8 14.5)"
        fill="url(#kawaii-note-theme-grad)"
      />
      {/* 二次元晶莹高光点 */}
      <circle cx="5.8" cy="15.8" r="0.9" fill="#FFFFFF" opacity="0.95" />
      <circle cx="16.8" cy="13.8" r="0.9" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
}

/**
 * 🌸 极致极简微光单行胶囊播放器 (Ultra-compact Floating Pill Player)
 * - 高度收敛至仅 40px，纯圆微光磁贴胶囊，绝无任何庞大笨重感
 * - 核心标志回归精雕微光二次元音符（自旋微动 + 主题自适应）
 * - 单行一字流：音符微标 + 歌名/歌手 + 上一曲/播放/下一曲/歌单全部并列，底部贴边极细流光进度条
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
    currentLyricText,
    loadError,
    togglePlay,
    next,
    prev,
    seek,
    play,
    removeTrack,
  } = useMusicPlayer();

  // 展开与折叠控制 (默认折叠为精致微标)
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

  // 自由拖拽定位坐标状态 (记忆持久化在本地 localStorage，默认固定左下角)
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

  // 视口边界保护与初始化 (默认稳定驻留左下角，防出界)
  const getSafePosition = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const widgetW = isExpanded ? 280 : 44;
    const widgetH = 46;

    const safeX = Math.max(12, Math.min(winW - widgetW - 12, x));
    const safeY = Math.max(60, Math.min(winH - widgetH - 16, y));
    return { x: safeX, y: safeY };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const winH = window.innerHeight;
      const defaultX = 20;
      const defaultY = Math.max(60, winH - 68);

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

  // Click-outside 监听器：点击歌单外部区域自动收起，避免遮挡博客阅读
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

  // 折叠态下的拖拽处理
  const handleCollapsedPointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position?.x ?? 20,
      initY: position?.y ?? (typeof window !== "undefined" ? window.innerHeight - 68 : 500),
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

  // 展开态下的拖拽处理 (点击按钮、进度条、歌单不触发拖拽)
  const handleExpandedPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest(".progress-bar") ||
      target.closest(".playlist-drawer")
    ) {
      return;
    }

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position?.x ?? 20,
      initY: position?.y ?? (typeof window !== "undefined" ? window.innerHeight - 68 : 500),
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
    const pos = { x: 20, y: Math.max(60, winH - 68) };
    setPosition(pos);
    try {
      localStorage.setItem("rin_music_player_pos", JSON.stringify(pos));
    } catch {}
  };

  const handleCollapse = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDragging(false);
    setIsExpanded(false);
    try {
      localStorage.setItem("rin_music_expanded", "false");
    } catch {}
  };

  // 在音廊专属工作台中，自动由全屏电台底座接管 (在所有 Hooks 之后返回，保证 Hooks 顺序一致)
  if (location.startsWith("/admin/music")) {
    return null;
  }

  if (!siteConfig.musicEnabled && playlist.length === 0) {
    return null;
  }

  const currentCoords = position || {
    x: 20,
    y: typeof window !== "undefined" ? window.innerHeight - 68 : 500,
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
      {/* 状态 1: 折叠状态 (极致小巧的 36px 微光音符徽章，带呼吸光圈与晶莹高光) */}
      {!isExpanded ? (
        <div
          className="relative group flex items-center justify-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {showTooltip && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-[#141720]/95 text-neutral-800 dark:text-neutral-100 text-[11px] font-bold shadow-md border border-neutral-200/80 dark:border-white/10 pointer-events-none ani-show backdrop-blur-md truncate max-w-[190px]">
              {currentTrack ? `${currentTrack.name} · ${currentTrack.artist}` : "画廊随想电台"}
            </div>
          )}

          <div
            onPointerDown={handleCollapsedPointerDown}
            onPointerMove={handleCollapsedPointerMove}
            onPointerUp={handleCollapsedPointerUp}
            onDoubleClick={handleResetPosition}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-white/85 dark:bg-[#12141a]/85 backdrop-blur-md border border-neutral-200/80 dark:border-white/10 shadow-md hover:border-theme/50 hover:shadow-lg active:scale-95 transition-all cursor-grab active:cursor-grabbing ${
              isDragging ? "ring-2 ring-theme/50 scale-105" : "hover:scale-105"
            }`}
            title="点击展开极简胶囊 (按住可拖动，双击复位)"
          >
            {isPlaying && (
              <span className="absolute inset-0 rounded-full border border-theme/40 animate-ping duration-[2500ms] pointer-events-none" />
            )}

            <KawaiiMusicNoteSvg className="w-5 h-5 pointer-events-none" isPlaying={isPlaying} />
          </div>
        </div>
      ) : (
        /* 状态 2: 展开状态 (极致纤细 40px 单行流体胶囊，底部贴边极细流光，绝无大块头压迫感) */
        <div
          onPointerDown={handleExpandedPointerDown}
          onPointerMove={handleExpandedPointerMove}
          onPointerUp={handleExpandedPointerUp}
          onDoubleClick={handleResetPosition}
          className={`relative group flex items-center h-10 w-[265px] sm:w-[285px] rounded-full px-2.5 bg-white/92 dark:bg-[#12141a]/92 backdrop-blur-xl border border-neutral-200/80 dark:border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.5)] transition-all cursor-grab active:cursor-grabbing ani-show ${
            isDragging ? "scale-95 ring-2 ring-theme/40 transition-none" : "hover:border-theme/40"
          }`}
        >
          {/* 左侧：精雕微光音符图标 (点击无条件收起折叠) */}
          <button
            type="button"
            onClick={handleCollapse}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-theme/10 hover:bg-theme/20 active:scale-90 transition p-0.5 cursor-pointer mr-2"
            title="点击收起微标"
          >
            <KawaiiMusicNoteSvg className="w-4 h-4 pointer-events-none" isPlaying={isPlaying} />
          </button>

          {/* 中间：弹性单行信息区 (歌名 + 歌手 或 实时歌词) */}
          <div className="flex-1 min-w-0 pr-1.5 overflow-hidden">
            {currentLyricText ? (
              <div className="text-[11px] font-bold text-theme truncate ani-show tracking-tight">
                ♫ {currentLyricText}
              </div>
            ) : (
              <div className="truncate flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-100 truncate">
                  {currentTrack?.name || "画廊随想电台"}
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate shrink-0">
                  {currentTrack?.artist || "随心漫游"}
                </span>
              </div>
            )}
          </div>

          {/* 右侧：单行紧凑控制三联键 (上一曲 + 播放/暂停 + 下一曲 + 歌单) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 上一曲 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="p-1 text-neutral-400 hover:text-theme hover:scale-110 active:scale-90 transition cursor-pointer"
              title="上一曲"
            >
              <i className="ri-skip-back-fill text-xs" />
            </button>

            {/* 核心播放/暂停键 (轻巧微凸圆纽) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="h-6 w-6 rounded-full bg-theme text-white flex items-center justify-center hover:scale-105 active:scale-95 shadow-2xs shadow-theme/30 transition cursor-pointer"
              title={isPlaying ? "暂停" : "播放"}
            >
              <i className={isPlaying ? "ri-pause-fill text-xs" : "ri-play-fill text-xs translate-x-0.5"} />
            </button>

            {/* 下一曲 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="p-1 text-neutral-400 hover:text-theme hover:scale-110 active:scale-90 transition cursor-pointer"
              title="下一曲"
            >
              <i className="ri-skip-forward-fill text-xs" />
            </button>

            {/* 待播歌单呼出 */}
            <button
              ref={playlistToggleBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPlaylistDrawer(!showPlaylistDrawer);
              }}
              className={`p-1 transition cursor-pointer ${
                showPlaylistDrawer ? "text-theme" : "text-neutral-400 hover:text-theme"
              }`}
              title="展开待播清单"
            >
              <i className="ri-play-list-line text-xs" />
            </button>
          </div>

          {/* 底部贴边极细流光进度条 (仅 2px 高度，完全不占垂直空间，悬停可微拖拽) */}
          <div
            ref={progressBarRef}
            onPointerDown={handleProgressBarPointerDown}
            onPointerMove={handleProgressBarPointerMove}
            onPointerUp={handleProgressBarPointerUp}
            onPointerCancel={handleProgressBarPointerUp}
            className="progress-bar absolute bottom-0 inset-x-3 h-2 flex items-end cursor-pointer group select-none"
            title="拖拽快进 / 倒退"
          >
            <div className="w-full h-[2px] group-hover:h-[3px] rounded-full bg-neutral-200/60 dark:bg-white/10 overflow-hidden transition-all duration-150">
              <div
                style={{ width: `${effectivePercent}%` }}
                className="h-full bg-theme rounded-full transition-[width] duration-75"
              />
            </div>
          </div>

          {/* 歌单展开浮层 (从胶囊上方弹出，高度不超过 200px) */}
          {showPlaylistDrawer && (
            <div
              ref={playlistDrawerRef}
              className="playlist-drawer absolute bottom-12 left-0 w-72 max-h-52 overflow-y-auto p-2.5 z-50 ani-show flex flex-col gap-1 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-xl shadow-2xl text-xs scrollbar-thin"
            >
              <div className="flex items-center justify-between pb-1.5 px-1 border-b border-neutral-100 dark:border-white/10 text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                <span className="flex items-center gap-1">
                  <span>待播清单</span>
                  <span className="text-[10px] text-theme font-mono font-bold">({playlist.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPlaylistDrawer(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 cursor-pointer"
                  title="收起"
                >
                  <i className="ri-close-line text-sm" />
                </button>
              </div>

              {playlist.length === 0 ? (
                <p className="text-center text-neutral-400 py-5 text-[11px]">暂无曲目，请在音廊中收录</p>
              ) : (
                playlist.map((track, i) => {
                  const isCur = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id || i}
                      onClick={() => play(track)}
                      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition select-none ${
                        isCur
                          ? "bg-theme/10 text-theme font-bold"
                          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] text-neutral-400 w-3.5 shrink-0">
                          {isCur && isPlaying ? "▶" : `#${i + 1}`}
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
                        className="text-neutral-400 hover:text-rose-500 p-0.5 transition cursor-pointer"
                        title="从清单移出"
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 错误自愈提示微标 */}
          {loadError && (
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800/40 pointer-events-none ani-show shadow-xs">
              {loadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
