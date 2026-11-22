import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";
import { VinylDiscArt } from "./vinyl-disc-art";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * 🌸 画廊微光黑胶胶囊播放器 (Global Vinyl Capsule Player)
 * - 彻底告别硬编码塑料粉与刺眼白底，100% 接入全站 Tailwind 语义系统与暗黑模式
 * - 折叠态：极具质感的 38px 磁性黑胶微标（随音乐匀速旋转，带主题呼吸微光）
 * - 展开态：280px 精致微光唱片磁贴（微缩黑胶、优雅单行元数据、触控进度条、自适应歌单浮层）
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

  // 展开与折叠控制 (默认折叠为精致黑胶微标)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("rin_music_expanded") === "true";
    } catch {
      return false;
    }
  });

  const [showLyrics, setShowLyrics] = useState(false);
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
    const widgetW = isExpanded ? 300 : 44;
    const widgetH = isExpanded ? 68 : 44;

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
      {/* 状态 1: 折叠状态 (灵动微光黑胶徽标，38px 极致克制，播放自旋，带暗黑自适应 Tooltip) */}
      {!isExpanded ? (
        <div
          className="relative group flex items-center justify-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {showTooltip && (
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-white/95 dark:bg-[#141720]/95 text-neutral-800 dark:text-neutral-100 text-[11px] font-bold shadow-lg border border-neutral-200/80 dark:border-white/10 pointer-events-none ani-show backdrop-blur-md truncate max-w-[200px]">
              {currentTrack ? `${currentTrack.name} · ${currentTrack.artist}` : "画廊随想电台"}
            </div>
          )}

          <div
            onPointerDown={handleCollapsedPointerDown}
            onPointerMove={handleCollapsedPointerMove}
            onPointerUp={handleCollapsedPointerUp}
            onDoubleClick={handleResetPosition}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-white/80 dark:bg-[#12141a]/80 backdrop-blur-md border border-neutral-200/80 dark:border-white/10 shadow-md hover:border-theme/40 hover:shadow-lg active:scale-95 transition-all cursor-grab active:cursor-grabbing ${
              isDragging ? "ring-2 ring-theme/50 scale-105" : "hover:scale-105"
            }`}
            title="点击展开控制栏 (按住可拖动，双击复位)"
          >
            {isPlaying && (
              <span className="absolute inset-0 rounded-full border border-theme/40 animate-ping duration-[2500ms] pointer-events-none" />
            )}

            <div className="h-7 w-7 rounded-full overflow-hidden shrink-0 pointer-events-none shadow-xs">
              <VinylDiscArt
                coverUrl={currentTrack?.pic}
                isPlaying={isPlaying}
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      ) : (
        /* 状态 2: 展开状态 (高质感微光黑胶胶囊，纯净毛玻璃 + 1px 细微描边，全站主题与暗黑完美契合) */
        <div
          onPointerDown={handleExpandedPointerDown}
          onPointerMove={handleExpandedPointerMove}
          onPointerUp={handleExpandedPointerUp}
          onDoubleClick={handleResetPosition}
          className={`relative flex flex-col rounded-2xl p-3 min-w-[285px] max-w-[320px] bg-white/90 dark:bg-[#12141a]/90 backdrop-blur-xl border border-neutral-200/80 dark:border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)] transition-all cursor-grab active:cursor-grabbing ani-show ${
            isDragging ? "scale-95 ring-2 ring-theme/40 transition-none" : "hover:border-theme/30"
          }`}
        >
          {/* 第一层（曲目信息层）：微缩旋转黑胶 + 歌曲名/歌手/歌词 + 右上角微型收起按钮 */}
          <div className="flex items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={handleCollapse}
              className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 shadow-xs border border-black/10 dark:border-white/10 hover:scale-105 transition cursor-pointer"
              title="点击收起微标"
            >
              <VinylDiscArt
                coverUrl={currentTrack?.pic}
                isPlaying={isPlaying}
                className="h-full w-full"
              />
            </button>

            <div className="flex-1 min-w-0 pr-1">
              {showLyrics && currentLyricText ? (
                <div className="text-[11px] font-bold text-theme truncate ani-show">
                  ♫ {currentLyricText}
                </div>
              ) : (
                <div className="truncate">
                  <div className="text-xs font-bold text-neutral-800 dark:text-neutral-100 truncate">
                    {currentTrack?.name || "画廊随想电台"}
                  </div>
                  <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                    {currentTrack?.artist || "随心漫游"}
                  </div>
                </div>
              )}
            </div>

            {/* 右上角微型收起小按钮 (不再把播放大钮突兀放在这里) */}
            <button
              type="button"
              onClick={handleCollapse}
              className="h-6 w-6 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition cursor-pointer"
              title="收起为黑胶徽标"
            >
              <i className="ri-arrow-down-s-line text-sm" />
            </button>
          </div>

          {/* 第二层（流光刻度层）：极细进度条 + 左右两端等宽时间 */}
          <div className="mt-2.5 flex flex-col gap-1 select-none">
            <div
              ref={progressBarRef}
              onPointerDown={handleProgressBarPointerDown}
              onPointerMove={handleProgressBarPointerMove}
              onPointerUp={handleProgressBarPointerUp}
              onPointerCancel={handleProgressBarPointerUp}
              className="progress-bar relative h-3 flex items-center cursor-pointer group select-none"
              title="拖拽快进 / 倒退"
            >
              <div className="w-full h-1 group-hover:h-1.5 rounded-full bg-neutral-200/80 dark:bg-white/10 overflow-hidden transition-all duration-150">
                <div
                  style={{ width: `${effectivePercent}%` }}
                  className="h-full bg-theme rounded-full transition-[width] duration-75"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tabular-nums px-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* 第三层（人体工学控制中枢）：所有控制操作严密聚合在底部同一水平线上 */}
          <div className="mt-1 pt-1.5 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between px-1">
            {/* 循环模式 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                setPlayMode(nextMode);
              }}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                playMode !== "loop" ? "text-theme font-bold" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              }`}
              title={playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
            >
              {playMode === "loop" && <i className="ri-repeat-2-line text-xs" />}
              {playMode === "single" && <i className="ri-repeat-one-line text-xs" />}
              {playMode === "random" && <i className="ri-shuffle-line text-xs" />}
            </button>

            {/* 核心播放三联键（上一曲 + 播放/暂停 + 下一曲 环抱居中） */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-theme hover:scale-110 active:scale-90 transition cursor-pointer"
                title="上一曲"
              >
                <i className="ri-skip-back-fill text-sm" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="h-8 w-8 rounded-full bg-theme text-white flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 shadow-sm shadow-theme/30 transition cursor-pointer"
                title={isPlaying ? "暂停" : "播放"}
              >
                <i className={isPlaying ? "ri-pause-fill text-base" : "ri-play-fill text-base translate-x-0.5"} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-theme hover:scale-110 active:scale-90 transition cursor-pointer"
                title="下一曲"
              >
                <i className="ri-skip-forward-fill text-sm" />
              </button>
            </div>

            {/* 辅助操作区：歌词 + 待播歌单 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLyrics(!showLyrics);
                }}
                className={`px-1.5 py-0.5 text-[10px] font-mono font-bold transition rounded cursor-pointer ${
                  showLyrics ? "bg-theme/15 text-theme" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                }`}
                title="歌词显隐"
              >
                LRC
              </button>

              <button
                ref={playlistToggleBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylistDrawer(!showPlaylistDrawer);
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  showPlaylistDrawer ? "text-theme bg-theme/10" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                }`}
                title="展开待播清单"
              >
                <i className="ri-play-list-line text-xs" />
              </button>
            </div>
          </div>

          {/* 歌单展开浮层 (毛玻璃深浅自适应面板) */}
          {showPlaylistDrawer && (
            <div
              ref={playlistDrawerRef}
              className="playlist-drawer absolute bottom-20 left-0 w-72 max-h-56 overflow-y-auto p-2.5 z-50 ani-show flex flex-col gap-1 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-[#141720]/95 backdrop-blur-xl shadow-2xl text-xs scrollbar-thin"
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
                <p className="text-center text-neutral-400 py-6 text-[11px]">暂无曲目，请在音廊中收录</p>
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
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-rose-500 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800/40 pointer-events-none ani-show shadow-xs">
              {loadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
