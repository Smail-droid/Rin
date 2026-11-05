import { useState } from "react";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { useMusicPlayer } from "./music-player-context";

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

  // 如果后台未启用音乐播放器且当前列表无曲目，则不渲染前台挂件
  if (!siteConfig.musicEnabled && playlist.length === 0) {
    return null;
  }

  const isBottomLeft = siteConfig.musicPosition === "bottom-left";
  const positionClass = isBottomLeft
    ? "bottom-4 left-4"
    : "bottom-4 right-4 sm:bottom-6 sm:right-6";

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`fixed ${positionClass} z-50 select-none ani-show`}>
      {/* 1. 迷你唱片悬浮球状态 (Collapsed Mini Disc Bubble) */}
      {!isExpanded ? (
        <div
          onClick={() => setIsExpanded(true)}
          className="group relative flex items-center gap-2.5 p-1.5 pr-3.5 rounded-full bg-white/90 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 shadow-xl backdrop-blur-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={currentTrack ? `正在播放: ${currentTrack.name} - ${currentTrack.artist}` : "打开画廊随想音乐电台"}
        >
          {/* 旋转黑胶唱片 */}
          <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center shadow-md">
            {currentTrack?.pic ? (
              <img
                src={currentTrack.pic}
                alt="cover"
                style={{
                  animationPlayState: isPlaying ? "running" : "paused",
                }}
                className="h-full w-full object-cover rounded-full animate-spin"
              />
            ) : (
              <div
                style={{
                  animationPlayState: isPlaying ? "running" : "paused",
                }}
                className="h-full w-full rounded-full bg-gradient-to-tr from-theme to-pink-500 flex items-center justify-center animate-spin"
              >
                <i className="ri-disc-line text-white text-lg" />
              </div>
            )}
            {/* 唱片黑胶中心圆心 */}
            <div className="absolute h-3 w-3 rounded-full bg-white dark:bg-neutral-800 border-2 border-neutral-900 z-10" />

            {/* 播放微角标 */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full text-white text-xs z-20"
            >
              <i className={isPlaying ? "ri-pause-fill" : "ri-play-fill"} />
            </div>
          </div>

          {/* 简易歌名与动态音波 */}
          <div className="flex flex-col max-w-[130px] sm:max-w-[160px]">
            <span className="text-xs font-bold t-primary truncate">
              {currentTrack?.name || "画廊微光电台"}
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

          {/* 展开指示微按钮 */}
          <span className="text-neutral-400 hover:text-theme transition ml-1 text-xs">
            <i className="ri-fullscreen-line" />
          </span>
        </div>
      ) : (
        /* 2. 展开式微光交互电台面板 (Expanded Frosted Glass Player) */
        <div className="w-[320px] sm:w-[360px] rounded-3xl bg-white/95 dark:bg-neutral-900/95 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-2xl p-4 flex flex-col gap-3 text-neutral-800 dark:text-neutral-100 transition-all">
          {/* Header 顶栏 */}
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-theme/10 text-theme text-sm">
                <i className="ri-disc-line" />
              </span>
              <div>
                <span className="text-xs font-bold t-primary block leading-none">画廊微光电台</span>
                <span className="text-[9px] font-mono text-neutral-400">
                  {currentTrack?.sourceName || "GD Studio / OpenList"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
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
                className={`p-1.5 rounded-lg text-xs transition ${
                  showPlaylist
                    ? "bg-theme text-white shadow-2xs font-bold"
                    : "text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                title="查看播放队列"
              >
                <i className="ri-play-list-line" />
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

          {/* 歌词视窗 (若展开) */}
          {showLyrics && (
            <div className="h-32 overflow-y-auto rounded-xl p-2.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-center flex flex-col gap-1.5 scrollbar-thin">
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
            <div className="max-h-40 overflow-y-auto rounded-xl p-1 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col gap-1">
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
            <div className="relative h-16 w-16 shrink-0 rounded-2xl overflow-hidden bg-neutral-900 shadow-md">
              {currentTrack?.pic ? (
                <img
                  src={currentTrack.pic}
                  alt=""
                  className="h-full w-full object-cover rounded-2xl"
                />
              ) : (
                <div className="h-full w-full rounded-2xl bg-gradient-to-tr from-theme to-pink-500 flex items-center justify-center text-white">
                  <i className="ri-music-2-line text-xl" />
                </div>
              )}
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

          {/* 进度条与播放时间 */}
          <div className="space-y-1">
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
          <div className="flex items-center justify-between pt-1">
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

          {/* 授权与版权声明底栏 (CC BY-NC 4.0 GD音乐台) */}
          <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
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
