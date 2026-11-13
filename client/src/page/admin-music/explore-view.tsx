import type { GdSearchResultItem } from "../../services/music-api";
import type { MusicTrack } from "../../components/music-player/types";

interface ExploreViewProps {
  autoPersistR2: boolean;
  setAutoPersistR2: (val: boolean) => void;
  searchMode: "song" | "album";
  setSearchMode: (mode: "song" | "album") => void;
  searchKeyword: string;
  setSearchKeyword: (kw: string) => void;
  onSearch: (kw?: string) => void;
  isSearching: boolean;
  deepScanning: boolean;
  onDeepScanAndVerify: (pages?: number) => void;
  scanProgress: { totalFound: number; verified: number; excluded: number } | null;
  deepVerifiedTracks: MusicTrack[];
  onImportAllVerified: () => void;
  searchResults: GdSearchResultItem[];
  onBatchCollect: () => void;
  batchStatus: "idle" | "batching" | "done";
  resolvingId: string | number | null;
  onResolveAndPlay: (item: GdSearchResultItem, playNow: boolean) => void;
  playlist: MusicTrack[];
}

export function ExploreView({
  autoPersistR2,
  setAutoPersistR2,
  searchMode,
  setSearchMode,
  searchKeyword,
  setSearchKeyword,
  onSearch,
  isSearching,
  deepScanning,
  onDeepScanAndVerify,
  scanProgress,
  deepVerifiedTracks,
  onImportAllVerified,
  searchResults,
  onBatchCollect,
  batchStatus,
  resolvingId,
  onResolveAndPlay,
  playlist,
}: ExploreViewProps) {
  return (
    <div className="flex flex-col gap-3.5 ani-show">
      <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5">
        {/* 顶层切换与设置 */}
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <i className="ri-compass-3-line text-theme" />
            <h3 className="font-bold text-xs t-primary">全网音乐探索</h3>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1 cursor-pointer select-none text-[11px] text-neutral-500 hover:text-theme transition">
              <input
                type="checkbox"
                checked={autoPersistR2}
                onChange={(e) => setAutoPersistR2(e.target.checked)}
                className="accent-theme cursor-pointer"
              />
              <span>收录时自动转存音廊</span>
            </label>

            <div className="flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSearchMode("song")}
                className={`px-2.5 py-0.5 rounded-lg font-semibold transition ${
                  searchMode === "song" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                }`}
              >
                单曲
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("album")}
                className={`px-2.5 py-0.5 rounded-lg font-semibold transition ${
                  searchMode === "album" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                }`}
              >
                专辑歌单
              </button>
            </div>
          </div>
        </div>

        {/* 搜索框与嗅探按钮 */}
        <div className="flex flex-col sm:flex-row gap-2.5 text-xs">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder={searchMode === "album" ? "输入专辑/歌单名称快速检索..." : "输入曲名或歌手名称快速检索..."}
            className="flex-1 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3.5 py-2 text-xs t-primary outline-none focus:border-theme transition"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSearch()}
              disabled={isSearching || deepScanning}
              className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-xs font-bold transition flex items-center gap-1.5 select-none"
            >
              {isSearching ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}
              <span>{isSearching ? "检索..." : "搜索"}</span>
            </button>
            <button
              type="button"
              onClick={() => onDeepScanAndVerify(3)}
              disabled={deepScanning || isSearching}
              className="px-4 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5 select-none"
              title="连续翻页检索并探测可用性，自动剔除受限失效曲目"
            >
              {deepScanning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-shield-check-line" />}
              <span>{deepScanning ? "嗅探中..." : "嗅探"}</span>
            </button>
          </div>
        </div>

        {/* 嗅探进度与一键导入栏 */}
        {scanProgress && (
          <div className="p-3 rounded-2xl bg-theme/5 border border-theme/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ani-show">
            <div className="flex items-center gap-2">
              {deepScanning ? (
                <i className="ri-loader-4-line animate-spin text-theme text-sm" />
              ) : (
                <i className="ri-checkbox-circle-fill text-emerald-500 text-sm" />
              )}
              <span className="text-neutral-700 dark:text-neutral-200">
                共探测 {scanProgress.totalFound} 首候选 · <strong className="text-emerald-600 dark:text-emerald-400">{scanProgress.verified} 首 100% 可播</strong> · <span className="text-neutral-400">已排除 {scanProgress.excluded} 首受限</span>
              </span>
            </div>
            {deepVerifiedTracks.length > 0 && !deepScanning && (
              <button
                type="button"
                onClick={onImportAllVerified}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-2xs hover:bg-emerald-600 transition flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
              >
                <i className="ri-play-list-add-line" />
                <span>一键全量入库 ({deepVerifiedTracks.length} 首)</span>
              </button>
            )}
          </div>
        )}

        {/* 搜索结果列表 */}
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-w overflow-hidden text-xs">
          <div className="p-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between text-neutral-400">
            <span className="font-mono text-[11px]">{searchResults.length > 0 ? `${searchResults.length} 条匹配 (按相关度置顶)` : "搜索结果"}</span>
            {searchResults.length > 0 && (
              <button
                type="button"
                onClick={onBatchCollect}
                disabled={batchStatus === "batching"}
                className="text-xs font-bold text-theme hover:underline flex items-center gap-1"
              >
                {batchStatus === "batching" && <i className="ri-loader-4-line animate-spin" />}
                <span>{batchStatus === "batching" ? "正在批量收录..." : batchStatus === "done" ? "已收录 ✓" : "批量收录前8首"}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[50vh] overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 flex flex-col items-center gap-2">
                <i className="ri-music-2-line text-2xl opacity-40" />
                <span>输入歌曲名称或歌手快速全网检索</span>
              </div>
            ) : (
              searchResults.map((item) => {
                const artistStr = Array.isArray(item.artist) ? item.artist.join(" / ") : item.artist;
                const isResolving = resolvingId === item.id;
                const isQueued = playlist.some((t) => t.id === item.id || (t.name === item.name && t.artist === artistStr));

                return (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {(item as any).pic ? (
                        <img src={(item as any).pic} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-theme text-xs font-bold">
                          <i className="ri-music-fill" />
                        </span>
                      )}
                      <div className="truncate">
                        <span className="font-bold text-xs t-primary block truncate">{item.name}</span>
                        <span className="text-[10px] text-neutral-400 block truncate">{artistStr}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-neutral-400">
                        {item.source}
                      </span>
                      <button
                        type="button"
                        onClick={() => onResolveAndPlay(item, true)}
                        disabled={isResolving}
                        className="px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold transition flex items-center gap-1"
                      >
                        {isResolving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-play-fill" />}
                        <span>试听</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveAndPlay(item, false)}
                        disabled={isResolving}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                          isQueued ? "bg-emerald-500 text-white font-bold" : "bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white"
                        }`}
                      >
                        <i className={isQueued ? "ri-check-line" : "ri-add-line"} />
                        <span>{isQueued ? "已收录" : "收录"}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
