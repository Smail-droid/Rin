import { useState } from "react";
import { useMusicPlayer } from "./music-player-context";
import { VinylDiscArt } from "./vinyl-disc-art";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function BottomPlayerDock({
  mode = "bottom",
}: {
  mode?: "bottom" | "top";
} = {}) {
  const {
    currentTrack,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playMode,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    setPlayMode,
    currentLyricText,
  } = useMusicPlayer();

  const [showQueuePopover, setShowQueuePopover] = useState(false);
  const [showLyricsPopover, setShowLyricsPopover] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  // 如果没有当前曲目且播放列表为空，不渲染底座
  if (!currentTrack && (!playlist || playlist.length === 0)) {
    return null;
  }

  const track = currentTrack || playlist[0];
  const displayTime = isSeeking ? seekTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  return (
    <>
      {/* 歌词弹出浮窗 */}
      {showLyricsPopover && (
        <div className={`fixed ${mode === "top" ? "top-24" : "bottom-20"} right-6 z-50 w-80 max-w-[90vw] p-4 rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12161f]/95 backdrop-blur-2xl shadow-2xl ani-show text-xs select-none`}>
          <div className="flex items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <i className="ri-mic-line text-theme" />
              <span className="font-bold t-primary">实时歌词</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLyricsPopover(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
          <div className="py-6 text-center">
            {currentLyricText ? (
              <p className="text-sm font-bold text-theme leading-relaxed animate-pulse">
                {currentLyricText}
              </p>
            ) : (
              <p className="text-neutral-400 text-xs">暂无同步歌词或纯音乐伴奏</p>
            )}
          </div>
        </div>
      )}

      {/* 待播清单微型弹出抽屉 */}
      {showQueuePopover && (
        <div className={`fixed ${mode === "top" ? "top-24" : "bottom-20"} right-6 z-50 w-80 max-w-[90vw] max-h-96 rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12161f]/95 backdrop-blur-2xl shadow-2xl ani-show flex flex-col text-xs select-none overflow-hidden`}>
          <div className="flex items-center justify-between p-3.5 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <i className="ri-play-list-line text-theme" />
              <span className="font-bold t-primary">待播清单 ({playlist.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowQueuePopover(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <i className="ri-close-line text-base" />
            </button>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/5 overflow-y-auto max-h-72 p-1.5">
            {playlist.map((t, i) => {
              const isCur = t.id === track?.id;
              return (
                <div
                  key={t.id || i}
                  className={`flex items-center justify-between p-2 rounded-xl transition ${
                    isCur
                      ? "bg-theme/10 text-theme font-bold"
                      : "hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-neutral-400 w-4 text-center">
                      {isCur && isPlaying ? "▶" : i + 1}
                    </span>
                    <div className="truncate">
                      <div className="truncate text-xs font-semibold">{t.name}</div>
                      <div className="truncate text-[10px] text-neutral-400">{t.artist}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          MHub & Navidrome 风格：一体化播放底座 (支持顶部吸顶或底部固定)
          ========================================================================= */}
      {mode === "top" ? (
        <div className="sticky top-2 z-30 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12161f]/95 backdrop-blur-2xl shadow-xs p-2.5 sm:p-3 select-none mb-3">
          <div className="w-full flex items-center justify-between gap-4">
            {/* 左侧：正在播放曲目信息 (1:1 封面 + 旋转黑胶 + 律动波形) */}
            <div className="flex items-center gap-3 min-w-0 w-1/4">
              <div className="relative h-11 w-11 rounded-xl overflow-hidden shrink-0 shadow-xs border border-black/10 dark:border-white/10 bg-neutral-900 flex items-center justify-center">
                {track?.pic ? (
                  <img
                    src={track.pic}
                    alt=""
                    className={`h-full w-full object-cover transition-transform duration-700 ${
                      isPlaying ? "scale-105" : ""
                    }`}
                  />
                ) : (
                  <VinylDiscArt isPlaying={isPlaying} className="h-full w-full scale-110" />
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center gap-0.5">
                    <span className="w-0.5 h-3 bg-theme rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-0.5 h-4 bg-theme rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-0.5 h-2.5 bg-theme rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                )}
              </div>

              <div className="truncate min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-xs t-primary truncate" title={track?.name}>
                    {track?.name || "随心画廊电台"}
                  </span>
                  {track?.url?.includes(".flac") || track?.url?.includes(".wav") ? (
                    <span className="shrink-0 px-1 py-0.2 rounded text-[9px] font-mono font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      FLAC
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5" title={track?.artist}>
                  {track?.artist || "随心漫游"}
                </p>
              </div>
            </div>

            {/* 中间：核心播放控制 + 可拖拽时间进度刻度条 */}
            <div className="flex-1 max-w-xl flex flex-col items-center gap-1">
              <div className="flex items-center gap-4 text-neutral-600 dark:text-neutral-300">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                    setPlayMode(nextMode);
                  }}
                  className={`text-sm transition hover:scale-110 cursor-pointer ${
                    playMode === "random" ? "text-theme" : playMode === "single" ? "text-amber-500" : "text-neutral-400"
                  }`}
                  title={playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
                >
                  <i
                    className={
                      playMode === "random"
                        ? "ri-shuffle-line"
                        : playMode === "single"
                        ? "ri-repeat-one-line"
                        : "ri-repeat-line"
                    }
                  />
                </button>

                <button
                  type="button"
                  onClick={prev}
                  className="text-base transition hover:scale-110 active:scale-90 hover:text-theme cursor-pointer"
                  title="上一首"
                >
                  <i className="ri-skip-back-fill" />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-8 w-8 rounded-full bg-theme text-white flex items-center justify-center hover:scale-110 active:scale-95 shadow-md shadow-theme/30 transition cursor-pointer"
                  title={isPlaying ? "暂停" : "播放"}
                >
                  <i
                    className={
                      isPlaying ? "ri-pause-fill text-base" : "ri-play-fill text-base translate-x-0.5"
                    }
                  />
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="text-base transition hover:scale-110 active:scale-90 hover:text-theme cursor-pointer"
                  title="下一首"
                >
                  <i className="ri-skip-forward-fill" />
                </button>
              </div>

              <div className="w-full flex items-center gap-2.5 text-[11px] font-mono text-neutral-400">
                <span className="w-10 text-right shrink-0">{formatTime(displayTime)}</span>
                <div className="relative flex-1 flex items-center group cursor-pointer">
                  <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-theme rounded-full transition-[width] duration-150"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.2}
                    value={displayTime}
                    onPointerDown={() => {
                      setIsSeeking(true);
                      setSeekTime(currentTime);
                    }}
                    onChange={(e) => {
                      setSeekTime(Number(e.target.value));
                    }}
                    onPointerUp={() => {
                      seek(seekTime);
                      setIsSeeking(false);
                    }}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="w-10 text-left shrink-0">{formatTime(duration)}</span>
              </div>
            </div>

            {/* 右侧：音量调节、歌词浮窗与队列抽屉 */}
            <div className="flex items-center justify-end gap-3 w-1/4">
              <div className="hidden sm:flex items-center gap-1.5 text-neutral-500">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="hover:text-theme transition cursor-pointer"
                  title={isMuted ? "取消静音" : "静音"}
                >
                  <i className={isMuted ? "ri-volume-mute-line text-sm text-rose-500" : "ri-volume-up-line text-sm"} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-16 h-1 accent-theme rounded-full cursor-pointer opacity-70 hover:opacity-100 transition"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowLyricsPopover(!showLyricsPopover)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  showLyricsPopover ? "text-theme bg-theme/10" : "text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                title="查看实时歌词"
              >
                <i className="ri-mic-line text-base" />
              </button>

              <button
                type="button"
                onClick={() => setShowQueuePopover(!showQueuePopover)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  showQueuePopover ? "text-theme bg-theme/10" : "text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                title="展开待播清单"
              >
                <i className="ri-play-list-line text-base" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#12161f]/95 backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] select-none">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 w-1/4">
              <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0 shadow-md border border-black/10 dark:border-white/10 bg-neutral-900 flex items-center justify-center">
                {track?.pic ? (
                  <img
                    src={track.pic}
                    alt=""
                    className={`h-full w-full object-cover transition-transform duration-700 ${
                      isPlaying ? "scale-105" : ""
                    }`}
                  />
                ) : (
                  <VinylDiscArt isPlaying={isPlaying} className="h-full w-full scale-110" />
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center gap-0.5">
                    <span className="w-0.5 h-3 bg-theme rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-0.5 h-4 bg-theme rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-0.5 h-2.5 bg-theme rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                )}
              </div>

              <div className="truncate min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-xs t-primary truncate" title={track?.name}>
                    {track?.name || "随心画廊电台"}
                  </span>
                  {track?.url?.includes(".flac") || track?.url?.includes(".wav") ? (
                    <span className="shrink-0 px-1 py-0.2 rounded text-[9px] font-mono font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      FLAC
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5" title={track?.artist}>
                  {track?.artist || "随心漫游"}
                </p>
              </div>
            </div>

            <div className="flex-1 max-w-xl flex flex-col items-center gap-1">
              <div className="flex items-center gap-4 text-neutral-600 dark:text-neutral-300">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = playMode === "loop" ? "single" : playMode === "single" ? "random" : "loop";
                    setPlayMode(nextMode);
                  }}
                  className={`text-sm transition hover:scale-110 ${
                    playMode === "random" ? "text-theme" : playMode === "single" ? "text-amber-500" : "text-neutral-400"
                  }`}
                  title={playMode === "loop" ? "列表循环" : playMode === "single" ? "单曲循环" : "随机播放"}
                >
                  <i
                    className={
                      playMode === "random"
                        ? "ri-shuffle-line"
                        : playMode === "single"
                        ? "ri-repeat-one-line"
                        : "ri-repeat-line"
                    }
                  />
                </button>

                <button
                  type="button"
                  onClick={prev}
                  className="text-lg hover:text-theme transition hover:scale-110 active:scale-90"
                  title="上一首"
                >
                  <i className="ri-skip-back-fill" />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-9 w-9 rounded-full bg-theme text-white flex items-center justify-center hover:scale-110 active:scale-95 shadow-md shadow-theme/30 transition"
                  title={isPlaying ? "暂停" : "播放"}
                >
                  <i
                    className={
                      isPlaying ? "ri-pause-fill text-lg" : "ri-play-fill text-lg translate-x-0.5"
                    }
                  />
                </button>

                <button
                  type="button"
                  onClick={next}
                  className="text-lg hover:text-theme transition hover:scale-110 active:scale-90"
                  title="下一首"
                >
                  <i className="ri-skip-forward-fill" />
                </button>
              </div>

              <div className="w-full flex items-center gap-2.5 text-[11px] font-mono text-neutral-400">
                <span className="w-10 text-right shrink-0">{formatTime(displayTime)}</span>
                <div className="relative flex-1 flex items-center group cursor-pointer">
                  <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-theme rounded-full transition-[width] duration-150"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.2}
                    value={displayTime}
                    onPointerDown={() => {
                      setIsSeeking(true);
                      setSeekTime(currentTime);
                    }}
                    onChange={(e) => {
                      setSeekTime(Number(e.target.value));
                    }}
                    onPointerUp={() => {
                      seek(seekTime);
                      setIsSeeking(false);
                    }}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="w-10 text-left shrink-0">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 w-1/4">
              <div className="hidden sm:flex items-center gap-1.5 text-neutral-500">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="hover:text-theme transition"
                  title={isMuted ? "取消静音" : "静音"}
                >
                  <i className={isMuted ? "ri-volume-mute-line text-sm text-rose-500" : "ri-volume-up-line text-sm"} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-16 h-1 accent-theme rounded-full cursor-pointer opacity-70 hover:opacity-100 transition"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowLyricsPopover(!showLyricsPopover)}
                className={`p-1.5 rounded-xl transition ${
                  showLyricsPopover ? "text-theme bg-theme/10" : "text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                title="查看实时歌词"
              >
                <i className="ri-mic-line text-base" />
              </button>

              <button
                type="button"
                onClick={() => setShowQueuePopover(!showQueuePopover)}
                className={`p-1.5 rounded-xl transition ${
                  showQueuePopover ? "text-theme bg-theme/10" : "text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                title="展开待播清单"
              >
                <i className="ri-play-list-line text-base" />
              </button>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
