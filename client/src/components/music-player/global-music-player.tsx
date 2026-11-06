import React, { useEffect, useRef, useState } from "react";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";

export function GlobalMusicPlayer() {
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

  // 展开与折叠控制 (默认折叠为可爱 38px 悬浮音符)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("rin_music_expanded") === "true";
    } catch {
      return false;
    }
  });

  // 悬浮 LRC 歌词与迷你选歌单展开
  const [showLyrics, setShowLyrics] = useState(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // 播放列表外层点击监听 Ref (Click-outside 防遮挡正文)
  const playlistDrawerRef = useRef<HTMLDivElement>(null);
  const playlistToggleBtnRef = useRef<HTMLButtonElement>(null);

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
    const widgetW = isExpanded ? 280 : 42;
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
    try {
      localStorage.setItem("rin_music_player_pos", JSON.stringify(pos));
    } catch {}
  };

  const toggleExpanded = () => {
    if (hasMovedRef.current) return;
    const nextVal = !isExpanded;
    setIsExpanded(nextVal);
    try {
      localStorage.setItem("rin_music_expanded", String(nextVal));
    } catch {}
  };

  if (!siteConfig.musicEnabled && playlist.length === 0) {
    return null;
  }

  const currentCoords = position || {
    x: 20,
    y: typeof window !== "undefined" ? window.innerHeight - 68 : 500,
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

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
      {/* 状态 1: 折叠状态 (日系可爱 38px 悬浮音符圆形按钮，粉白柔和渐变，可拖拽贴边) */}
      {!isExpanded ? (
        <div
          className="relative group"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* 轻量悬浮 Tooltip (显示当前歌名与歌手) */}
          {showTooltip && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-[#FFFAFC]/90 text-[#503E42] text-[11px] font-bold shadow-md border border-[#FFD0DA]/60 pointer-events-none ani-show backdrop-blur-md truncate max-w-[180px]">
              {currentTrack ? `${currentTrack.name} · ${currentTrack.artist}` : "画廊随想电台"}
            </div>
          )}

          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleResetPosition}
            onClick={toggleExpanded}
            style={{
              background: "linear-gradient(135deg, #FFF5F7 0%, #FFE2E8 50%, #FFD0DA 100%)",
              boxShadow: isPlaying
                ? "0 0 16px rgba(255, 126, 149, 0.55), 0 4px 12px rgba(255, 126, 149, 0.25)"
                : "0 4px 12px rgba(255, 126, 149, 0.2)",
            }}
            className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#FFD0DA] transition-all hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing ${
              isDragging ? "ring-2 ring-[#FF7E95]/60" : ""
            }`}
            title="点击展开可爱播放器 (按住可拖拽，双击复位)"
          >
            {/* 播放时微弱粉色呼吸光圈 */}
            {isPlaying && (
              <span
                style={{ borderColor: "#FF7E95" }}
                className="absolute -inset-1 rounded-full border border-dashed opacity-75 animate-spin duration-[10000ms] pointer-events-none"
              />
            )}

            {/* 音符图标：播放时顺时针缓慢旋转 (8s)，暂停时静止 */}
            <span
              style={{
                color: "#FF7E95",
                animation: isPlaying ? "spin 8s linear infinite" : "none",
              }}
              className="text-base select-none flex items-center justify-center"
            >
              🎶
            </span>
          </button>
        </div>
      ) : (
        /* 状态 2: 展开状态 (日系奶油粉白微光卡片，去除黑深灰色块，嵌入极细粉色半透明进度条) */
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleResetPosition}
          style={{
            background: "rgba(255, 250, 252, 0.82)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 208, 218, 0.7)",
            boxShadow: "0 8px 28px rgba(255, 126, 149, 0.16)",
          }}
          className={`relative flex flex-col rounded-full pl-2 pr-3.5 pt-1.5 pb-2 min-w-[270px] max-w-[320px] transition-all cursor-grab active:cursor-grabbing ani-show ${
            isDragging ? "scale-95 ring-2 ring-[#FF7E95]/50" : "hover:shadow-xl"
          }`}
        >
          {/* 上层浮空文字区 (无底色，居中显示当前歌曲名与歌词，温润深棕色 #503E42) */}
          <div className="flex flex-col items-center justify-center w-full px-2 pointer-events-none select-none text-center">
            {/* 浮动 LRC 歌词行 (深棕色 #503E42 / 高亮 #FF7E95) */}
            {showLyrics && currentLyricText && (
              <div
                style={{ color: "#FF7E95" }}
                className="text-[11px] font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px] ani-show"
              >
                ♫ {currentLyricText}
              </div>
            )}

            {/* 歌曲名与歌手 */}
            <div
              style={{ color: "#503E42" }}
              className="text-xs font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[230px]"
            >
              ♫ {currentTrack?.name || "画廊随想"} · {currentTrack?.artist || "随心漫游"}
            </div>
          </div>

          {/* 下层控制按钮区 (所有按钮去除实体背景色与外框阴影，仅保留纯净矢量图标，默认 #7D5A64，悬停变蜜桃粉 #FF7E95) */}
          <div className="flex items-center justify-between w-full mt-1 px-1">
            {/* 左侧可爱折叠小音符徽章 (点击收起) */}
            <button
              type="button"
              onClick={toggleExpanded}
              style={{
                background: "linear-gradient(135deg, #FFF5F7, #FFE2E8)",
              }}
              className="no-drag flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#FFD0DA] text-[#FF7E95] text-xs hover:scale-110 active:scale-95 transition"
              title="折叠为悬浮小音符"
            >
              <span>🎶</span>
            </button>

            {/* 控制按钮组 (宽指距，无实体底色) */}
            <div className="no-drag flex items-center gap-3">
              {/* 上一曲 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="p-1 text-[#7D5A64] hover:text-[#FF7E95] hover:scale-110 active:scale-90 transition"
                title="上一曲"
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
                className="p-1 text-[#7D5A64] hover:text-[#FF7E95] hover:scale-115 active:scale-90 transition"
                title={isPlaying ? "暂停" : "播放"}
              >
                <i className={isPlaying ? "ri-pause-fill text-lg text-[#FF7E95]" : "ri-play-fill text-lg"} />
              </button>

              {/* 下一曲 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="p-1 text-[#7D5A64] hover:text-[#FF7E95] hover:scale-110 active:scale-90 transition"
                title="下一曲"
              >
                <i className="ri-skip-forward-fill text-sm" />
              </button>

              {/* 循环模式 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                  setPlayMode(nextMode);
                }}
                className={`p-1 transition ${
                  playMode !== "loop" ? "text-[#FF7E95] font-bold" : "text-[#7D5A64] hover:text-[#FF7E95]"
                }`}
                title={playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
              >
                {playMode === "loop" && <i className="ri-repeat-2-line text-sm" />}
                {playMode === "single" && <i className="ri-repeat-one-line text-sm" />}
                {playMode === "random" && <i className="ri-shuffle-line text-sm" />}
              </button>

              {/* 歌词开关 (LRC) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLyrics(!showLyrics);
                }}
                className={`px-1 py-0.5 text-[11px] font-mono font-bold transition rounded ${
                  showLyrics ? "text-[#FF7E95]" : "text-[#7D5A64] hover:text-[#FF7E95]"
                }`}
                title="显示/隐藏浮空歌词"
              >
                LRC
              </button>

              {/* 播放列表按钮 */}
              <button
                ref={playlistToggleBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylistDrawer(!showPlaylistDrawer);
                }}
                className={`p-1 transition ${
                  showPlaylistDrawer ? "text-[#FF7E95]" : "text-[#7D5A64] hover:text-[#FF7E95]"
                }`}
                title="展开选歌列表"
              >
                <i className="ri-play-list-line text-sm" />
              </button>
            </div>
          </div>

          {/* 紧贴下方嵌入一条 2px 极细粉色半透明播放进度条 */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              seek(ratio * duration);
            }}
            className="no-drag absolute -bottom-[1px] left-6 right-6 h-[2px] rounded-full bg-[#FFD0DA]/40 overflow-hidden cursor-pointer"
            title="点击快进/倒退"
          >
            <div
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #FFD0DA 0%, #FF7E95 100%)",
              }}
              className="h-full rounded-full transition-all duration-150"
            />
          </div>

          {/* 歌单展开视窗 (从上方展开，高度不超过 220px，半透明毛玻璃防遮挡，Click-outside 自动收起) */}
          {showPlaylistDrawer && (
            <div
              ref={playlistDrawerRef}
              style={{
                background: "rgba(255, 250, 252, 0.88)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 208, 218, 0.8)",
                boxShadow: "0 10px 30px rgba(255, 126, 149, 0.18)",
              }}
              className="no-drag absolute bottom-14 left-0 w-72 max-h-[220px] overflow-y-auto p-2.5 z-50 ani-show flex flex-col gap-1 text-xs scrollbar-thin"
            >
              <div className="flex items-center justify-between pb-1 px-1 border-b border-[#FFD0DA]/50 text-[11px] text-[#7D5A64] font-bold">
                <span className="flex items-center gap-1">
                  <span>播放列表</span>
                  <span className="text-[10px] text-[#FF7E95] font-mono">({playlist.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPlaylistDrawer(false)}
                  className="text-[#7D5A64] hover:text-[#FF7E95] p-0.5"
                  title="收起列表"
                >
                  <i className="ri-close-line" />
                </button>
              </div>

              {playlist.length === 0 ? (
                <p className="text-center text-[#7D5A64]/70 py-6 text-[11px]">暂无歌曲，请在音廊中收录</p>
              ) : (
                playlist.map((track, i) => {
                  const isCur = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id || i}
                      onClick={() => {
                        play(track);
                      }}
                      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition select-none ${
                        isCur
                          ? "bg-[#FF7E95]/15 text-[#FF7E95] font-bold shadow-2xs"
                          : "text-[#503E42] hover:bg-[#FFD0DA]/30"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] text-[#7D5A64]/60">#{i + 1}</span>
                        <span className="truncate">{track.name}</span>
                        <span className="text-[10px] text-[#7D5A64]/70 truncate">- {track.artist}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTrack(track.id);
                        }}
                        className="text-[#7D5A64]/40 hover:text-rose-500 p-0.5 transition"
                        title="从列表中移除"
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
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-rose-500 bg-[#FFF5F7] px-2.5 py-0.5 rounded-full border border-rose-200 pointer-events-none ani-show shadow-xs">
              {loadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
