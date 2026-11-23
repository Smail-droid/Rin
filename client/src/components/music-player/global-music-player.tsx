import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";
import { MarqueeText } from "./marquee-text";

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
        <linearGradient id="anime-note-theme-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(var(--theme-rgb))" />
          <stop offset="60%" stopColor="rgb(var(--theme-secondary-rgb, var(--theme-hover-rgb)))" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
        </linearGradient>

        <linearGradient id="anime-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgb(var(--theme-secondary-rgb, var(--theme-rgb)))" />
        </linearGradient>
      </defs>

      {/* 1. 灵动四芒星芒 */}
      <path
        d="M25 4.5 C25 6.5 26.5 8 28.5 8 C26.5 8 25 9.5 25 11.5 C25 9.5 23.5 8 21.5 8 C23.5 8 25 6.5 25 4.5 Z"
        fill="url(#anime-star-grad)"
        opacity="0.95"
      />
      <circle cx="25" cy="8" r="0.8" fill="#ffffff" />

      {/* 2. 优雅的双音符连梁与符杆 */}
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
      <circle cx="19" cy="18.4" r="1.1" fill="#ffffff" opacity="0.95" />
      <circle cx="21" cy="20" r="0.5" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * 🌸 cPlayer 黄金对称双层微卡片播放器 (cPlayer Symmetrical Card Player)
 * - 左侧：56px × 56px 纯正方形封面 (点击秒速收缩为纯透明音符)
 * - 右侧上层：严格居中对称的控制中枢 (左侧 LRC/音量，中央播放三联键，右侧循环/歌单/收折)
 * - 右侧下层：[歌名 - 歌手] + [01:43/03:09 分秒时间刻度]
 * - 进度条起止：从封面右边缘 (left-[56px]) 开始，彻底解决遮挡封面问题！
 * - 拖拽移动：按住文本区或空隙随时丝滑拖移，无卡顿吞噬
 */
export function GlobalMusicPlayer() {
  const [location] = useLocation();
  const siteConfig = useSiteConfig();
  const { t } = useTranslation();
  const {
    currentTrack,
    playlist,
    isPlaying,
    currentTime,
    duration,
    playMode,
    volume,
    isMuted,
    currentLyricText,
    loadError,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
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

  const [showLyrics, setShowLyrics] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
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
  const touchStartTimeRef = useRef(0);
  const justExpandedAtRef = useRef(0);
  // 交互因果锁：只有在卡片已展开后、用户在收起按钮上有意识地按下(pointerdown)或无障碍激活，才允许收起
  // 彻底阻断任何由折叠微标轻触(tap)后延迟穿透的合成 Ghost Click
  const collapseTriggerArmRef = useRef(false);

  // 视口边界保护与初始化 (卡片尺寸：宽 228px，高 54px)
  const getSafePosition = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const widgetW = isExpanded ? 232 : 44;
    const widgetH = isExpanded ? 62 : 44;

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
    touchStartTimeRef.current = Date.now();
    const cx = Number.isFinite(e.clientX) ? e.clientX : 0;
    const cy = Number.isFinite(e.clientY) ? e.clientY : 0;
    dragStartRef.current = {
      startX: cx,
      startY: cy,
      initX: position?.x ?? 20,
      initY: position?.y ?? (typeof window !== "undefined" ? window.innerHeight - 76 : 500),
    };
    hasMovedRef.current = false;
    // 不在按下瞬间强行捕获，避免破坏移动端原生轻触 (tap) 的识别流
  };

  const handleCollapsedPointerMove = (e: React.PointerEvent) => {
    const cx = Number.isFinite(e.clientX) ? e.clientX : 0;
    const cy = Number.isFinite(e.clientY) ? e.clientY : 0;
    const deltaX = cx - dragStartRef.current.startX;
    const deltaY = cy - dragStartRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    // 触控设备增加防抖容差（10px），鼠标设为 5px
    const threshold = e.pointerType === "touch" ? 10 : 5;
    if (dist > threshold) {
      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        setIsDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
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
      // 确认发生明显位移（拖拽），保存位置，绝不触发展开
      if (position) {
        try {
          localStorage.setItem("rin_music_player_pos", JSON.stringify(position));
        } catch {}
      }
    } else {
      // 未发生位移（轻触点击），立即零延迟展开，并严密上锁收起触发器
      collapseTriggerArmRef.current = false;
      setIsExpanded(true);
      justExpandedAtRef.current = Date.now();
      try {
        localStorage.setItem("rin_music_expanded", "true");
      } catch {}
    }
  };

  const handleCollapsedPointerCancel = (e: React.PointerEvent) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    setIsDragging(false);
    hasMovedRef.current = false;
  };

  const handleCollapsedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMovedRef.current) {
      e.preventDefault();
      return;
    }
    collapseTriggerArmRef.current = false;
    setIsExpanded(true);
    justExpandedAtRef.current = Date.now();
    try {
      localStorage.setItem("rin_music_expanded", "true");
    } catch {}
  };

  // 展开态下的拖拽处理 (排除按钮、滑块、进度条)
  const handleExpandedPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest(".progress-bar") ||
      target.closest(".playlist-drawer") ||
      target.closest(".collapse-trigger")
    ) {
      return;
    }

    e.preventDefault();
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

    if (dist > 5) {
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
    // 物理级交互因果防御：必须是在展开状态下、针对收起按钮发起的真实交互，杜绝任何外部或历史穿透事件
    const isKeyboardActivation = !!e && (e.detail === 0 || (e.nativeEvent as any)?.pointerType === "");
    if (!collapseTriggerArmRef.current && !isKeyboardActivation) {
      return;
    }
    // 第二重时间防抖冗余保障
    if (Date.now() - justExpandedAtRef.current < 400) {
      return;
    }
    collapseTriggerArmRef.current = false;
    setIsDragging(false);
    setIsExpanded(false);
    setShowPlaylistDrawer(false);
    setShowVolumeSlider(false);
    try {
      localStorage.setItem("rin_music_expanded", "false");
    } catch {}
  };

  if (location.startsWith("/music") || location.startsWith("/admin/music")) {
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

  const trackTitle = currentTrack?.name || t("music.radio_title", { defaultValue: "画廊随想电台" });
  const trackArtist = currentTrack?.artist || t("music.radio_artist", { defaultValue: "随心漫游" });
  const displayText = showLyrics && currentLyricText ? `♫ ${currentLyricText}` : `${trackTitle} - ${trackArtist}`;

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
      {/* 状态 1: 折叠状态 (彻底去除白底！纯透明悬浮日系二次元微光星芒音符) */}
      {!isExpanded ? (
        <div
          className="relative group flex items-center justify-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {showTooltip && (
            <div
              role="tooltip"
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-[#141720]/95 text-neutral-800 dark:text-neutral-100 text-[11px] font-bold shadow-md border border-neutral-200/80 dark:border-white/10 pointer-events-none ani-show backdrop-blur-md truncate max-w-[200px]"
            >
              {displayText}
            </div>
          )}

          <button
            type="button"
            onClick={handleCollapsedClick}
            onPointerDown={handleCollapsedPointerDown}
            onPointerMove={handleCollapsedPointerMove}
            onPointerUp={handleCollapsedPointerUp}
            onPointerCancel={handleCollapsedPointerCancel}
            onDoubleClick={handleResetPosition}
            aria-label="展开音乐播放器"
            style={{ touchAction: "none" }}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent border-0 p-0 shadow-none hover:scale-120 active:scale-95 transition-transform duration-200 cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-theme/60 outline-none select-none touch-none ${
              isDragging ? "scale-110" : ""
            }`}
            title="点击展开播放器 (按住可拖动，双击复位)"
          >
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
        /* 状态 2: 展开状态 (cPlayer 黄金对称微卡片：紧凑高 54px 宽 228px，告别过长长条，封面零遮挡，控制栏严密居中) */
        <div
          onPointerDown={handleExpandedPointerDown}
          onPointerMove={handleExpandedPointerMove}
          onPointerUp={handleExpandedPointerUp}
          onDoubleClick={handleResetPosition}
          className={`relative group flex items-stretch h-[54px] w-[220px] sm:w-[228px] rounded-xl bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-xl border border-neutral-200/80 dark:border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.55)] transition-all select-none cursor-grab active:cursor-grabbing ${
            isDragging ? "scale-95 ring-2 ring-theme/40 transition-none" : "hover:border-theme/40"
          }`}
        >
          {/* 1. 左侧：54px × 54px 正方形封面 (点击秒速收缩为纯透明音符) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              collapseTriggerArmRef.current = true;
            }}
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
            <div
              className="absolute inset-0 bg-black/45 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
              aria-hidden="true"
            >
              <i className="ri-contract-left-right-line text-sm" />
            </div>
          </button>

          {/* 2. 右侧主体：上下双层高度对称排布 */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-1.5 px-2 relative">
            {/* 上半层：严格居中对称的控制中枢 */}
            <div className="flex items-center justify-between w-full h-6">
              {/* 左侧辅助组：LRC 歌词按钮 + 音量按钮 */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLyrics((p) => !p);
                  }}
                  aria-label={showLyrics ? "切换为显示歌曲名" : "切换为显示实时歌词"}
                  className={`px-1 py-0.5 rounded text-[9.5px] font-mono font-bold leading-tight transition cursor-pointer ${
                    showLyrics
                      ? "bg-theme/15 text-theme"
                      : "text-neutral-400 dark:text-neutral-500 hover:text-theme"
                  }`}
                  title={showLyrics ? "正在显示歌词 (点击显示歌曲名)" : "点击显示实时歌词"}
                >
                  LRC
                </button>

                {/* 音量控制按钮与微型滑块 */}
                <div
                  className="relative flex items-center"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    aria-label={isMuted ? "取消静音" : "静音"}
                    className="p-0.5 text-neutral-400 dark:text-neutral-500 hover:text-theme transition cursor-pointer"
                    title={isMuted ? "取消静音" : `当前音量: ${Math.round(volume * 100)}%`}
                  >
                    <i
                      className={
                        isMuted
                          ? "ri-volume-mute-line text-xs text-rose-500"
                          : volume > 0.5
                          ? "ri-volume-up-line text-xs"
                          : "ri-volume-down-line text-xs"
                      }
                      aria-hidden="true"
                    />
                  </button>

                  {/* 悬停展开的极细音量微滑块 (智能感知上下空间) */}
                  {showVolumeSlider && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute ${currentCoords.y < 45 ? "top-7" : "-top-7"} left-0 z-30 px-2 py-1 rounded-lg bg-white/95 dark:bg-[#18181b]/95 border border-neutral-200/80 dark:border-white/10 shadow-lg ani-show flex items-center`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-16 h-1 accent-theme cursor-pointer"
                        aria-label="调节音量"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 中间核心三联键：正圆形居中控制 */}
              <div className="flex items-center justify-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  aria-label="上一曲"
                  className="p-0.5 text-theme hover:scale-115 active:scale-90 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md"
                  title="上一曲"
                >
                  <i className="ri-skip-back-fill text-xs" aria-hidden="true" />
                </button>

                {/* 经典 cPlayer 标志性正圆形内嵌播放/暂停按钮 (宽高严格 22px × 22px，彻底告别畸形椭圆) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  aria-label={isPlaying ? "暂停播放" : "开始播放"}
                  className="w-[22px] h-[22px] shrink-0 aspect-square rounded-full border border-theme text-theme bg-theme/5 hover:bg-theme/15 flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-theme/50 outline-none"
                  title={isPlaying ? "暂停" : "播放"}
                >
                  <i
                    className={
                      isPlaying
                        ? "ri-pause-fill text-[11px] leading-none"
                        : "ri-play-fill text-[11px] leading-none translate-x-[0.5px]"
                    }
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  aria-label="下一曲"
                  className="p-0.5 text-theme hover:scale-115 active:scale-90 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md"
                  title="下一曲"
                >
                  <i className="ri-skip-forward-fill text-xs" aria-hidden="true" />
                </button>
              </div>

              {/* 右侧辅助组：循环模式 + 歌单列表 + 显式收起按钮 */}
              <div className="flex items-center gap-0.5 shrink-0 text-neutral-400 dark:text-neutral-500">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                    setPlayMode(nextMode);
                  }}
                  aria-label={`切换循环模式 (当前: ${playMode})`}
                  className={`p-0.5 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md ${
                    playMode !== "loop" ? "text-theme font-bold" : "hover:text-theme"
                  }`}
                  title={playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
                >
                  {playMode === "loop" && <i className="ri-repeat-2-line text-xs" aria-hidden="true" />}
                  {playMode === "single" && <i className="ri-repeat-one-line text-xs" aria-hidden="true" />}
                  {playMode === "random" && <i className="ri-shuffle-line text-xs" aria-hidden="true" />}
                </button>

                <button
                  ref={playlistToggleBtnRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlaylistDrawer((prev) => !prev);
                  }}
                  aria-label={showPlaylistDrawer ? "关闭待播清单" : "展开待播清单"}
                  className={`p-0.5 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md ${
                    showPlaylistDrawer ? "text-theme font-bold" : "hover:text-theme"
                  }`}
                  title={showPlaylistDrawer ? "关闭待播清单" : "展开待播清单"}
                >
                  <i className="ri-play-list-line text-xs" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    collapseTriggerArmRef.current = true;
                  }}
                  onClick={handleCollapse}
                  aria-label="收起为微光徽标"
                  className="collapse-trigger p-0.5 text-neutral-400 hover:text-theme transition cursor-pointer focus-visible:ring-2 focus-visible:ring-theme/50 rounded-md"
                  title="收起为微光图标微标"
                >
                  <i className="ri-arrow-down-s-line text-xs" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* 下半层：曲目信息走马灯 (左侧/中间) + 分秒时间刻度 (右侧) */}
            <div className="w-full flex items-center justify-between gap-1 select-none pt-0.5 border-t border-black/[0.04] dark:border-white/5 min-w-0">
              <MarqueeText
                text={displayText}
                isPlaying={isPlaying}
                className="text-[11px] font-medium text-neutral-700 dark:text-neutral-200 flex-1 min-w-0"
              />
              <span className="tabular-nums text-[9.5px] font-mono text-neutral-400 dark:text-neutral-500 shrink-0 ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* 3. 底部贴边极细流光进度条：起止位置从封面右边开始 (left-[54px] right-0)，绝对不遮挡封面！ */}
          <div
            ref={progressBarRef}
            onPointerDown={handleProgressBarPointerDown}
            onPointerMove={handleProgressBarPointerMove}
            onPointerUp={handleProgressBarPointerUp}
            onPointerCancel={handleProgressBarPointerUp}
            className="progress-bar absolute bottom-0 left-[54px] right-0 h-1.5 flex items-end cursor-pointer group z-10 rounded-br-xl overflow-hidden"
            title="点击快进 / 倒退"
          >
            <div className="w-full h-[2px] group-hover:h-[3px] bg-neutral-200/60 dark:bg-white/10 transition-all duration-150">
              <div
                style={{ width: `${effectivePercent}%` }}
                className="h-full bg-theme transition-[width] duration-75"
              />
            </div>
          </div>

          {/* 4. 歌单展开浮层 (智能感知屏幕上方/下方自适应向上/向下展开) */}
          {showPlaylistDrawer && (
            <div
              ref={playlistDrawerRef}
              className={`playlist-drawer absolute ${
                (typeof window !== "undefined" && (window.innerHeight - currentCoords.y - 54 < 270 || currentCoords.y > window.innerHeight * 0.5))
                  ? "bottom-full mb-2"
                  : "top-full mt-2"
              } ${
                (typeof window !== "undefined" && currentCoords.x + 288 > window.innerWidth - 12)
                  ? "right-0"
                  : "left-0"
              } w-72 max-h-60 overflow-y-auto p-2.5 z-50 ani-show flex flex-col gap-1 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-[#14161f]/95 backdrop-blur-2xl shadow-2xl text-xs scrollbar-thin select-none`}
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
