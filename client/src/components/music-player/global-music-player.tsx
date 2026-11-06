import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";
import { VinylDiscArt } from "./vinyl-disc-art";

export function GlobalMusicPlayer() {
  const siteConfig = useSiteConfig();
  const {
    currentTrack,
    playlist,
    isPlaying,
    playMode,
    currentLyricText,
    loadError,
    togglePlay,
    next,
    prev,
    setPlayMode,
    play,
    removeTrack,
  } = useMusicPlayer();

  // 迷你播放器状态控制 (浮空歌词、悬浮抽屉列表、贴边微缩折叠)
  const [showLyrics, setShowLyrics] = useState(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [isDocked, setIsDocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem("rin_music_docked") === "true";
    } catch {
      return false;
    }
  });

  // 自由拖拽定位坐标状态 (记忆持久化在本地 localStorage，默认固定左下角，阅读文章绝不上跳)
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

  // 视口边界保护与初始化 (默认坚定驻留左下角，防出界)
  const getSafePosition = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const widgetW = isDocked ? 44 : 260;
    const widgetH = 48;

    const safeX = Math.max(12, Math.min(winW - widgetW - 12, x));
    const safeY = Math.max(60, Math.min(winH - widgetH - 16, y));
    return { x: safeX, y: safeY };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const winH = window.innerHeight;
      // 默认左下角安全坐标
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
  }, [position, isDocked]);

  // 开始按住拖拽 (兼容鼠标与触屏设备)
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest(".no-drag")) {
      return;
    }

    hasMovedRef.current = false;
    setIsDragging(true);

    const clientX = e.clientX;
    const clientY = e.clientY;
    const curX = position?.x ?? 20;
    const curY = position?.y ?? (typeof window !== "undefined" ? window.innerHeight - 68 : 500);

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initX: curX,
      initY: curY,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }

    const nextX = dragStartRef.current.initX + deltaX;
    const nextY = dragStartRef.current.initY + deltaY;
    const safe = getSafePosition(nextX, nextY);

    setPosition(safe);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (position) {
      // 贴边检测：如果拖到屏幕左侧或右侧贴边 (< 25px 或 > winW - 60px)，自动微缩折叠为贴边音符
      if (typeof window !== "undefined") {
        if (position.x <= 28) {
          setIsDocked(true);
          try {
            localStorage.setItem("rin_music_docked", "true");
          } catch {}
        }
      }
      try {
        localStorage.setItem("rin_music_player_pos", JSON.stringify(position));
      } catch {}
    }
  };

  // 双击复位到默认左下角
  const handleResetPosition = () => {
    if (typeof window === "undefined") return;
    const winH = window.innerHeight;
    const pos = { x: 20, y: Math.max(60, winH - 68) };
    setPosition(pos);
    setIsDocked(false);
    try {
      localStorage.setItem("rin_music_player_pos", JSON.stringify(pos));
      localStorage.setItem("rin_music_docked", "false");
    } catch {}
  };

  const toggleDock = () => {
    const nextState = !isDocked;
    setIsDocked(nextState);
    try {
      localStorage.setItem("rin_music_docked", String(nextState));
    } catch {}
  };

  if (!siteConfig.musicEnabled && playlist.length === 0) {
    return null;
  }

  const currentCoords = position || {
    x: 20,
    y: typeof window !== "undefined" ? window.innerHeight - 68 : 500,
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
      {/* 状态 A: 贴边自动隐藏的极简 🎶 音符小圆点 */}
      {isDocked ? (
        <button
          type="button"
          onClick={toggleDock}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white shadow-xl backdrop-blur-xl border border-white/20 transition-all hover:scale-110 active:scale-95 cursor-pointer"
          title="点击展开画廊音乐播放器"
        >
          <span className="text-base select-none">🎶</span>
          {isPlaying && (
            <span className="absolute -inset-1 rounded-full border border-theme/60 animate-ping pointer-events-none" />
          )}
        </button>
      ) : (
        /* 状态 B: 极简通透毛玻璃独立按键迷你播放器 (无大窗占用、浮空歌词、宽指距防误触) */
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleResetPosition}
          className={`relative flex items-center gap-3.5 px-3.5 py-2 rounded-full bg-black/40 dark:bg-black/60 border border-white/20 shadow-2xl backdrop-blur-2xl transition-all cursor-grab active:cursor-grabbing ${
            isDragging ? "scale-95 ring-2 ring-theme/50" : "hover:bg-black/50"
          }`}
        >
          {/* 1. 浮空曲目名称 (置于按键上方，不挤占控制栏宽度) */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] pointer-events-none select-none max-w-[220px] truncate">
            {currentTrack?.name || "画廊随想"} · {currentTrack?.artist || "随心漫游"}
          </div>

          {/* 2. 浮空透明 LRC 歌词行 (点击 LRC 后浮动出现于最顶层，完全透明不占空间) */}
          {showLyrics && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-black text-theme-light bg-black/60 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/15 shadow-xl pointer-events-none select-none ani-show text-center max-w-[280px] truncate">
              ♫ {currentLyricText || "纯音乐 · 静候灵感"}
            </div>
          )}

          {/* 3. 错误自愈提示微标 */}
          {loadError && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-rose-300 bg-rose-950/80 backdrop-blur-md px-3 py-0.5 rounded-full border border-rose-500/30 pointer-events-none ani-show">
              {loadError}
            </div>
          )}

          {/* 4. 浮空播放列表抽屉 (点击 ≡ 列表 后向上浮现，极简卡片式，点击切歌) */}
          {showPlaylistDrawer && (
            <div className="no-drag absolute bottom-12 left-0 w-64 max-h-48 overflow-y-auto rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/15 p-2 shadow-2xl flex flex-col gap-1 text-xs text-white z-50 ani-show scrollbar-thin">
              <div className="flex items-center justify-between pb-1.5 px-1 border-b border-white/10 text-[11px] text-neutral-400">
                <span>播放列表 ({playlist.length}首)</span>
                <button
                  type="button"
                  onClick={() => setShowPlaylistDrawer(false)}
                  className="hover:text-white"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              {playlist.length === 0 ? (
                <p className="text-center text-neutral-400 py-4 text-[11px]">列表为空</p>
              ) : (
                playlist.map((track, i) => {
                  const isCur = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id || i}
                      onClick={() => play(track)}
                      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition select-none ${
                        isCur
                          ? "bg-theme/30 text-theme-light font-bold"
                          : "hover:bg-white/10 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] text-neutral-400">#{i + 1}</span>
                        <span className="truncate">{track.name}</span>
                        <span className="text-[10px] text-neutral-400 truncate">- {track.artist}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrack(track.id);
                        }}
                        className="text-neutral-400 hover:text-red-400 p-0.5"
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 迷你微光黑胶唱片 (封面自动兜底) */}
          <div className="relative h-8 w-8 shrink-0">
            <VinylDiscArt
              isPlaying={isPlaying}
              coverUrl={currentTrack?.pic}
              className="h-8 w-8"
            />
          </div>

          {/* 核心全套独立按键组 (宽指距，透明极简高光) */}
          <div className="no-drag flex items-center gap-3">
            {/* 上一首 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="p-1 text-white/80 hover:text-white hover:scale-110 active:scale-90 transition"
              title="上一首"
            >
              <i className="ri-skip-back-fill text-sm" />
            </button>

            {/* 播放 / 暂停 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-theme text-white hover:scale-110 active:scale-95 transition"
              title={isPlaying ? "暂停" : "播放"}
            >
              <i className={isPlaying ? "ri-pause-fill text-sm" : "ri-play-fill text-sm translate-x-0.5"} />
            </button>

            {/* 下一首 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="p-1 text-white/80 hover:text-white hover:scale-110 active:scale-90 transition"
              title="下一首"
            >
              <i className="ri-skip-forward-fill text-sm" />
            </button>

            {/* 播放模式 (循环/单曲/随机) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                setPlayMode(nextMode);
              }}
              className="p-1 text-white/80 hover:text-white transition"
              title={playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
            >
              {playMode === "loop" && <i className="ri-repeat-2-line text-xs" />}
              {playMode === "single" && <i className="ri-repeat-one-line text-xs text-theme font-bold" />}
              {playMode === "random" && <i className="ri-shuffle-line text-xs text-amber-400" />}
            </button>

            {/* LRC 歌词悬浮开关 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowLyrics(!showLyrics);
              }}
              className={`px-1 py-0.5 text-xs font-mono font-bold rounded transition ${
                showLyrics ? "text-theme bg-white/20 shadow-xs" : "text-white/70 hover:text-white"
              }`}
              title="开启/关闭浮空歌词"
            >
              LRC
            </button>

            {/* ≡ 播放列表抽屉开关 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPlaylistDrawer(!showPlaylistDrawer);
              }}
              className={`p-1 text-sm rounded transition ${
                showPlaylistDrawer ? "text-theme" : "text-white/80 hover:text-white"
              }`}
              title="展开播放列表"
            >
              <i className="ri-play-list-line" />
            </button>

            {/* 贴边折叠收拢按钮 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleDock();
              }}
              className="p-1 text-white/50 hover:text-white hover:scale-105 transition"
              title="折叠为贴边音符"
            >
              <i className="ri-contract-left-line text-xs" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
