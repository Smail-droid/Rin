import { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";
import { VinylDiscArt } from "./vinyl-disc-art";

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function GlobalMusicPlayer() {
  const siteConfig = useSiteConfig();
  const {
    currentTrack,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playMode,
    isExpanded,
    showLyrics,
    showPlaylist,
    currentLyricText,
    parsedLyrics,
    loadError,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    setPlayMode,
    setIsExpanded,
    setShowLyrics,
    setShowPlaylist,
    play,
    removeTrack,
  } = useMusicPlayer();

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // 自由拖拽定位坐标状态 (记忆持久化在本地 localStorage)
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

  // 视口边界保护与初始化
  const getSafePosition = (x: number, y: number, isExp = isExpanded) => {
    if (typeof window === "undefined") return { x, y };
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const widgetW = isExp ? Math.min(360, winW - 24) : 200;
    const widgetH = isExp ? 440 : 56;

    const safeX = Math.max(12, Math.min(winW - widgetW - 12, x));
    const safeY = Math.max(60, Math.min(winH - widgetH - 12, y));
    return { x: safeX, y: safeY };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const isLeft = siteConfig.musicPosition === "bottom-left";
      const defaultX = isLeft ? 16 : Math.max(16, winW - 220);
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
  }, [position, siteConfig.musicPosition, isExpanded]);

  // 开始按住拖拽 (兼容鼠标与触屏设备)
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // 如果点击的是按钮、滑块、音量等操作组件，则不触发外层卡片拖拽
    if (target.closest("button") || target.closest("input") || target.closest(".no-drag")) {
      return;
    }

    hasMovedRef.current = false;
    setIsDragging(true);

    const clientX = e.clientX;
    const clientY = e.clientY;
    const curX = position?.x ?? (typeof window !== "undefined" ? window.innerWidth - 220 : 100);
    const curY = position?.y ?? (typeof window !== "undefined" ? window.innerHeight - 80 : 500);

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
      try {
        localStorage.setItem("rin_music_player_pos", JSON.stringify(position));
      } catch {}
    }
  };

  // 双击气泡复位到屏幕推荐角
  const handleResetPosition = () => {
    if (typeof window === "undefined") return;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const isLeft = siteConfig.musicPosition === "bottom-left";
    const defaultX = isLeft ? 16 : Math.max(16, winW - 220);
    const defaultY = Math.max(60, winH - 76);
    const pos = { x: defaultX, y: defaultY };
    setPosition(pos);
    try {
      localStorage.setItem("rin_music_player_pos", JSON.stringify(pos));
    } catch {}
  };

  // 如果后台未启用音乐播放器且当前列表无曲目，则不渲染前台挂件
  if (!siteConfig.musicEnabled && playlist.length === 0) {
    return null;
  }

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const currentCoords = position || {
    x: typeof window !== "undefined" ? window.innerWidth - 220 : 100,
    y: typeof window !== "undefined" ? window.innerHeight - 80 : 500,
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
      {/* 1. 迷你唱片悬浮球状态 (支持自由拖拽移动、双击复位) */}
      {!isExpanded ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleResetPosition}
          onClick={() => {
            if (!hasMovedRef.current) {
              setIsExpanded(true);
            }
          }}
          className={`group relative flex items-center gap-2.5 p-1.5 pr-3.5 rounded-full bg-white/90 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 shadow-xl backdrop-blur-xl transition-all cursor-grab active:cursor-grabbing ${
            isDragging ? "scale-95 ring-2 ring-theme/50 shadow-2xl" : "hover:scale-105"
          }`}
          title={
            currentTrack
              ? `正在播放: ${currentTrack.name} - ${currentTrack.artist} (按住可任意拖拽，双击复位)`
              : "打开画廊随想音乐电台 (按住可任意拖拽，双击复位)"
          }
        >
          {/* 精雕微光黑胶唱片质感原盘 (兜底与待机图标) */}
          <div className="relative h-10 w-10 shrink-0">
            <VinylDiscArt
              isPlaying={isPlaying}
              coverUrl={currentTrack?.pic}
              className="h-10 w-10"
            />

            {/* 播放微角标悬浮交互 */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="no-drag absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full text-white text-xs z-20 cursor-pointer"
            >
              <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} />
            </div>
          </div>

          {/* 简易歌名与动态音波 */}
          <div className="flex flex-col max-w-[110px] sm:max-w-[140px] pointer-events-none">
            <span className="text-xs font-bold t-primary truncate">
              {currentTrack?.name || "画廊随想电台"}
            </span>
            <span className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
              {isPlaying && (
                <span className="inline-flex gap-0.5 items-end h-2.5">
                  <span className="w-0.5 h-2 bg-theme animate-pulse" />
                  <span className="w-0.5 h-3 bg-theme animate-pulse delay-75" />
                  <span className="w-0.5 h-1.5 bg-theme animate-pulse delay-150" />
                </span>
              )}
              <span className="truncate">{currentTrack?.artist || "随心漫游"}</span>
            </span>
          </div>

          {/* 队列歌曲数量小标 */}
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-theme/10 text-theme font-bold shrink-0 ml-0.5 pointer-events-none">
            {playlist.length}首
          </span>

          {/* 拖拽手柄与展开指示微图标 */}
          <div className="flex items-center gap-0.5 text-neutral-400 ml-1 text-xs">
            <i className="ri-drag-move-2-line opacity-50 group-hover:opacity-100" />
            <i className="ri-fullscreen-line group-hover:text-theme transition" />
          </div>
        </div>
      ) : (
        /* 2. 展开式微光交互电台面板 (支持顶部按住自由拖拽) */
        <div className="w-[320px] sm:w-[360px] rounded-3xl bg-white/95 dark:bg-neutral-900/95 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-2xl p-4 flex flex-col gap-3 text-neutral-800 dark:text-neutral-100 transition-all">
          {/* Header 顶栏 (按住此处可任意拖拽面板) */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleResetPosition}
            className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 cursor-grab active:cursor-grabbing select-none"
            title="按住顶栏可任意拖动电台面板，双击复位"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm">
                <i className="ri-disc-line" />
              </span>
              <div>
                <span className="text-xs font-bold t-primary block leading-none flex items-center gap-1">
                  <span>画廊微光电台</span>
                  <i className="ri-drag-move-2-line text-[10px] text-neutral-400 opacity-60" />
                </span>
                <span className="text-[9px] font-mono text-neutral-400">
                  {currentTrack?.sourceName || "GD Studio / OpenList"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 no-drag">
              <button
                type="button"
                onClick={() => setShowLyrics(!showLyrics)}
                className={`p-1.5 rounded-lg text-xs transition ${
                  showLyrics
                    ? "bg-theme text-white shadow-2xs font-bold"
                    : "text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                title="开启/关闭歌词视窗"
              >
                <i className="ri-quote-text" />
              </button>
              <button
                type="button"
                onClick={() => setShowPlaylist(!showPlaylist)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  showPlaylist
                    ? "bg-theme text-white shadow-2xs font-bold"
                    : "text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                title="查看播放队列"
              >
                <i className="ri-play-list-line" />
                <span className="font-mono text-[11px]">{playlist.length}首</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 text-xs transition"
                title="收起为微缩气泡"
              >
                <i className="ri-arrow-down-s-line text-sm" />
              </button>
            </div>
          </div>

          {/* 异常提示横幅 (防盗链 / 链接 404 自愈提示) */}
          {loadError && (
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] leading-tight flex items-start gap-1.5 ani-show">
              <i className="ri-error-warning-line text-xs shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
          )}

          {/* 歌词视窗 (若展开) */}
          {showLyrics && (
            <div className="no-drag h-32 overflow-y-auto rounded-xl p-2.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-center flex flex-col gap-1.5 scrollbar-thin">
              {parsedLyrics.length > 0 ? (
                parsedLyrics.map((line, idx) => {
                  const isCurrent = currentLyricText === line.text;
                  return (
                    <p
                      key={idx}
                      className={`text-[11px] transition-all duration-300 ${
                        isCurrent
                          ? "text-theme font-bold scale-105"
                          : "text-neutral-400 opacity-60"
                      }`}
                    >
                      {line.text}
                    </p>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                  <span>纯音乐或暂无匹配歌词</span>
                </div>
              )}
            </div>
          )}

          {/* 播放队列抽屉 (若展开) */}
          {showPlaylist && (
            <div className="no-drag max-h-40 overflow-y-auto rounded-xl p-1 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col gap-1">
              {playlist.length === 0 ? (
                <p className="text-center text-xs text-neutral-400 py-4">播放队列为空</p>
              ) : (
                playlist.map((track) => {
                  const isCur = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => play(track)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                        isCur
                          ? "bg-theme/10 text-theme font-bold"
                          : "hover:bg-black/5 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <i className={isCur && isPlaying ? "ri-volume-up-fill text-theme" : "ri-music-line opacity-40"} />
                        <span className="truncate">{track.name}</span>
                        <span className="text-[10px] text-neutral-400 truncate opacity-70">- {track.artist}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrack(track.id);
                        }}
                        className="text-neutral-400 hover:text-red-500 p-0.5 transition"
                        title="从播放列表移除"
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 唱片封面 + 歌曲标题 + 实时歌词 */}
          <div className="flex items-center gap-3">
            {/* 精雕微光黑胶唱片高保真封面 (带唱针与金属轴心) */}
            <div className="relative h-16 w-16 shrink-0 rounded-full shadow-lg bg-neutral-900 flex items-center justify-center">
              <VinylDiscArt
                isPlaying={isPlaying}
                coverUrl={currentTrack?.pic}
                className="h-16 w-16"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-extrabold t-primary truncate">
                {currentTrack?.name || "未选择曲目"}
              </h4>
              <p className="text-xs text-neutral-400 truncate mt-0.5">
                {currentTrack?.artist || "请从后台添加歌曲或试听"}
              </p>
              {currentLyricText && !showLyrics && (
                <p className="text-[11px] text-theme/90 truncate mt-1 font-medium italic animate-fade-in">
                  ♫ {currentLyricText}
                </p>
              )}
            </div>
          </div>

          {/* 未展开抽屉时的直观队列引导条 */}
          {!showPlaylist && !showLyrics && (
            <div
              onClick={() => setShowPlaylist(true)}
              className="no-drag flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-theme/5 border border-black/5 dark:border-white/5 transition cursor-pointer text-[11px] text-neutral-500 hover:text-theme"
              title="点击展开查看当前全部播放队列"
            >
              <div className="flex items-center gap-1.5 truncate">
                <i className="ri-play-list-line text-theme" />
                <span>播放队列共 {playlist.length} 首</span>
              </div>
              <span className="text-[10px] text-theme font-semibold shrink-0">
                展开队列 ➔
              </span>
            </div>
          )}

          {/* 进度条与播放时间 */}
          <div className="space-y-1 no-drag">
            <div className="relative w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer">
              <div
                style={{ width: `${percent}%` }}
                className="h-full bg-theme transition-all rounded-full"
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
              <span>{formatSeconds(currentTime)}</span>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* 核心控制栏 (上一曲 / 播放 / 下一曲 / 循环模式 / 音量) */}
          <div className="flex items-center justify-between pt-1 no-drag">
            {/* 循环模式 */}
            <button
              type="button"
              onClick={() => {
                const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                setPlayMode(nextMode);
              }}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-theme transition"
              title={
                playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"
              }
            >
              {playMode === "loop" && <i className="ri-repeat-2-line text-sm" />}
              {playMode === "single" && <i className="ri-repeat-one-line text-sm text-theme" />}
              {playMode === "random" && <i className="ri-shuffle-line text-sm text-amber-500" />}
            </button>

            {/* 上一曲 */}
            <button
              type="button"
              onClick={prev}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-theme transition active:scale-90"
              title="上一首"
            >
              <i className="ri-skip-back-fill text-base" />
            </button>

            {/* 核心播放/暂停键 */}
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-theme hover:bg-theme-hover text-white shadow-lg shadow-theme/30 hover:scale-105 active:scale-95 transition-all"
            >
              <i className={isPlaying ? "ri-pause-fill text-xl" : "ri-play-fill text-xl translate-x-0.5"} />
            </button>

            {/* 下一曲 */}
            <button
              type="button"
              onClick={next}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-theme transition active:scale-90"
              title="下一首"
            >
              <i className="ri-skip-forward-fill text-base" />
            </button>

            {/* 音量控制 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-theme transition"
                title="音量调节"
              >
                <i className={isMuted || volume === 0 ? "ri-volume-mute-line text-sm" : "ri-volume-up-line text-sm"} />
              </button>

              {showVolumeSlider && (
                <div className="absolute bottom-8 right-0 p-2 rounded-xl bg-white/95 dark:bg-neutral-800/95 shadow-xl border border-black/10 dark:border-white/10 flex items-center gap-2 z-50 ani-show">
                  <button type="button" onClick={toggleMute} className="text-xs text-neutral-400">
                    <i className={isMuted ? "ri-volume-mute-fill" : "ri-volume-down-fill"} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 accent-theme h-1.5 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 授权与版权声明底栏 */}
          <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-neutral-400 font-mono no-drag">
            <span>全站跨页沉浸流转</span>
            <a
              href="https://music.gdstudio.xyz"
              target="_blank"
              rel="noreferrer"
              className="hover:text-theme transition"
              title="API 授权自 GD Studio (CC BY-NC 4.0)"
            >
              GD音乐台 · CC BY-NC 4.0
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
