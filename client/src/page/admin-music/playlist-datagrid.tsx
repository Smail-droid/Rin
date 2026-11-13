import type { MusicTrack } from "../../components/music-player/types";
import { VinylDiscArt } from "../../components/music-player/vinyl-disc-art";
import { formatCleanSourceName } from "./types";

interface CustomGroupItem {
  name: string;
  count: number;
}

interface PlaylistDataGridProps {
  displayedPlaylist: MusicTrack[];
  fullPlaylist: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  selectedTrackIds: Set<string | number>;
  onSelectTrack: (id: string | number, selected: boolean) => void;
  onToggleSelectAll: () => void;
  onInvertSelect: () => void;
  playlistFilterMode: "all" | "group" | "artist" | "album";
  setPlaylistFilterMode: (mode: "all" | "group" | "artist" | "album") => void;
  selectedGroupTag: string;
  setSelectedGroupTag: (tag: string) => void;
  customGroups: CustomGroupItem[];
  showNewGroupInput: boolean;
  setShowNewGroupInput: (show: boolean) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  onAssignGroup: (name: string) => void;
  onBatchMoveToTop: () => void;
  onBatchPersistR2: () => void;
  onBatchDelete: () => void;
  onResetPlaylist: () => void;
  persistR2Status: "idle" | "saving" | "done";
  persistingTrackId: string | number | null;
  onSingleTrackPersist: (track: MusicTrack) => void;
  onMoveTrackToIndex: (fromIdx: number, targetNumStr: string) => void;
  onMoveToTop: (id: string | number) => void;
  onPlay: (track: MusicTrack) => void;
  onPause: () => void;
  onDeleteTrack: (track: MusicTrack) => void;
}

export function PlaylistDataGrid({
  displayedPlaylist,
  fullPlaylist,
  currentTrack,
  isPlaying,
  selectedTrackIds,
  onSelectTrack,
  onToggleSelectAll,
  onInvertSelect,
  playlistFilterMode,
  setPlaylistFilterMode,
  selectedGroupTag,
  setSelectedGroupTag,
  customGroups,
  showNewGroupInput,
  setShowNewGroupInput,
  newGroupName,
  setNewGroupName,
  onAssignGroup,
  onBatchMoveToTop,
  onBatchPersistR2,
  onBatchDelete,
  onResetPlaylist,
  persistR2Status,
  persistingTrackId,
  onSingleTrackPersist,
  onMoveTrackToIndex,
  onMoveToTop,
  onPlay,
  onPause,
  onDeleteTrack,
}: PlaylistDataGridProps) {
  return (
    <div className="flex flex-col gap-3.5 ani-show">
      {/* 分组与过滤条 */}
      <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-xs t-primary mr-1">分类：</span>
          <div className="flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-0.5 text-xs mr-2">
            {[
              { id: "all", label: "全部" },
              { id: "group", label: "分组" },
              { id: "artist", label: "歌手" },
              { id: "album", label: "专辑" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPlaylistFilterMode(m.id as any);
                  setSelectedGroupTag("");
                }}
                className={`px-2 py-0.5 rounded-lg font-semibold transition ${
                  playlistFilterMode === m.id ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSelectedGroupTag("")}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
              selectedGroupTag === "" ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-500"
            }`}
          >
            全部 ({fullPlaylist.length})
          </button>
          {customGroups.map((g) => (
            <button
              key={g.name}
              type="button"
              onClick={() => setSelectedGroupTag(g.name)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition ${
                selectedGroupTag === g.name
                  ? "bg-theme text-white font-bold"
                  : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
              }`}
            >
              <span>{g.name}</span>
              <span className="opacity-60 text-[10px] ml-1">({g.count})</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowNewGroupInput(!showNewGroupInput)}
            className="px-2.5 py-1 rounded-xl text-theme hover:bg-theme/10 transition text-xs font-bold"
          >
            + 新建分组
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 transition"
          >
            全选
          </button>
          <button
            type="button"
            onClick={onInvertSelect}
            className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 transition"
          >
            反选
          </button>
          <button
            type="button"
            onClick={onBatchMoveToTop}
            disabled={!selectedTrackIds.size}
            className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 transition disabled:opacity-30"
            title="将已选曲目置顶至第 1 位"
          >
            置顶
          </button>
          <button
            type="button"
            onClick={onBatchPersistR2}
            disabled={persistR2Status === "saving"}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
              persistR2Status === "done" ? "bg-emerald-500 text-white font-bold" : "bg-theme/10 hover:bg-theme/20 text-theme"
            }`}
          >
            {persistR2Status === "saving" && <i className="ri-loader-4-line animate-spin" />}
            {persistR2Status === "done" && <i className="ri-check-line" />}
            <span>{persistR2Status === "saving" ? "转存中..." : persistR2Status === "done" ? "已转存 ✓" : "全部转存音廊"}</span>
          </button>
          <button
            type="button"
            onClick={onBatchDelete}
            disabled={!selectedTrackIds.size}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition flex items-center gap-1 text-xs font-semibold"
          >
            <i className="ri-delete-bin-line" />
            <span>删除</span>
          </button>
          <button
            type="button"
            onClick={onResetPlaylist}
            className="px-2.5 py-1 rounded-lg text-neutral-400 hover:text-theme text-xs transition"
          >
            重置
          </button>
        </div>
      </div>

      {/* 新建分组快速输入框 */}
      {showNewGroupInput && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-theme/5 border border-theme/20 text-xs ani-show max-w-md">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="输入新分组名称 (如：车载、深夜、纯音)..."
            className="flex-1 rounded-xl border border-black/10 bg-w px-3 py-1.5 text-xs outline-none focus:border-theme dark:bg-neutral-800"
          />
          <button
            type="button"
            onClick={() => onAssignGroup(newGroupName)}
            disabled={!selectedTrackIds.size || !newGroupName.trim()}
            className="px-3.5 py-1.5 rounded-xl bg-theme text-white font-bold disabled:opacity-40 shadow-xs"
          >
            将已选项归入此组
          </button>
        </div>
      )}

      {/* 播放列表超级表格 */}
      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-w max-h-[60vh] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
              <th className="py-2.5 px-2.5 w-8 text-center">
                <input
                  type="checkbox"
                  checked={selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0}
                  onChange={onToggleSelectAll}
                  className="accent-theme cursor-pointer"
                />
              </th>
              <th className="py-2.5 px-2 w-14 text-center">序号(跳位)</th>
              <th className="py-2.5 px-2">曲目 / 歌手</th>
              <th className="py-2.5 px-2 w-20">分组</th>
              <th className="py-2.5 px-2 w-20">音源</th>
              <th className="py-2.5 px-2 w-16 text-center">状态</th>
              <th className="py-2.5 px-2 text-right pr-4 w-28">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {displayedPlaylist.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-neutral-400">
                  播放列表为空，请在上方「音廊资产」或「曲库探索」中收录
                </td>
              </tr>
            ) : (
              displayedPlaylist.map((track, idx) => {
                const isCur = currentTrack?.id === track.id;
                const isSel = selectedTrackIds.has(track.id);
                const isR2 = track.source === "r2" || track.url.includes("/api/blob/music/");

                return (
                  <tr
                    key={track.id || idx}
                    className={`transition ${
                      isSel
                        ? "bg-theme/[0.04]"
                        : isCur
                        ? "bg-theme/[0.02]"
                        : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                    }`}
                  >
                    <td className="py-2 px-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={(e) => onSelectTrack(track.id, e.target.checked)}
                        className="accent-theme cursor-pointer"
                      />
                    </td>

                    {/* 序号数字直接输入换位 */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isCur && isPlaying && <span className="text-theme font-bold">▶</span>}
                        <input
                          type="number"
                          min={1}
                          max={fullPlaylist.length}
                          defaultValue={idx + 1}
                          key={`${track.id}_${idx}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onMoveTrackToIndex(idx, e.currentTarget.value);
                            }
                          }}
                          onBlur={(e) => {
                            onMoveTrackToIndex(idx, e.currentTarget.value);
                          }}
                          className="w-10 text-center rounded-md bg-black/5 dark:bg-white/5 border border-transparent hover:border-theme/40 focus:border-theme focus:bg-w text-xs font-mono font-bold outline-none transition py-0.5"
                          title="输入数字后敲回车，直接调整到该序号并顺延"
                        />
                      </div>
                    </td>

                    {/* 曲目名与艺术家 (前置播放/暂停按键) */}
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isCur && isPlaying) onPause();
                            else onPlay(track);
                          }}
                          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 shadow-2xs ${
                            isCur && isPlaying
                              ? "bg-theme text-white shadow-theme/30 scale-105"
                              : "bg-theme/10 hover:bg-theme text-theme hover:text-white"
                          }`}
                          title={isCur && isPlaying ? "暂停" : "播放"}
                        >
                          <i
                            className={
                              isCur && isPlaying
                                ? "ri-pause-fill text-xs"
                                : "ri-play-fill text-xs translate-x-0.5"
                            }
                          />
                        </button>

                        {track.pic ? (
                          <img src={track.pic} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
                        ) : (
                          <VinylDiscArt
                            isPlaying={isCur && isPlaying}
                            coverUrl={track.pic}
                            className="h-7 w-7 rounded-lg shrink-0"
                          />
                        )}
                        <div className="truncate">
                          <span className={`font-bold block truncate ${isCur ? "text-theme" : "t-primary"}`}>
                            {track.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 block truncate">
                            {track.artist}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 分组 */}
                    <td className="py-2 px-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-theme/5 text-theme font-bold">
                        {track.group || "默认"}
                      </span>
                    </td>

                    {/* 音源 */}
                    <td className="py-2 px-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-500">
                        {formatCleanSourceName(track)}
                      </span>
                    </td>

                    {/* 转存状态图标 */}
                    <td className="py-2 px-2 text-center">
                      {isR2 ? (
                        <span title="已永久转存至云端音廊" className="inline-flex items-center justify-center text-emerald-500 select-none">
                          <i className="ri-checkbox-circle-fill text-sm" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSingleTrackPersist(track)}
                          disabled={persistingTrackId === track.id}
                          className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5 transition inline-flex items-center justify-center select-none"
                          title="下载并永久固化至云端音廊"
                        >
                          {persistingTrackId === track.id ? (
                            <i className="ri-loader-4-line animate-spin text-xs text-theme" />
                          ) : (
                            <i className="ri-download-cloud-line text-sm" />
                          )}
                        </button>
                      )}
                    </td>

                    {/* 操作 (置顶与删除) */}
                    <td className="py-2 px-2 text-right pr-4">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onMoveToTop(track.id)}
                          className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 transition"
                          title="置顶至第 1 位"
                        >
                          <i className="ri-vertical-align-top text-xs" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteTrack(track)}
                          className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-black/5 transition"
                          title="移出播放列表"
                        >
                          <i className="ri-delete-bin-line text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
