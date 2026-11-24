import { useMemo, useState } from "react";
import type { MusicTrack } from "../../components/music-player/types";
import { VinylDiscArt } from "../../components/music-player/vinyl-disc-art";
import { formatCleanSourceName } from "./types";

type GroupByMode = "album" | "artist";

interface AlbumGroup {
  key: string;
  title: string;
  subtitle: string;
  coverUrl?: string;
  tracks: MusicTrack[];
}

export interface AlbumWallViewProps {
  tracks: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  onPlay: (track: MusicTrack) => void;
  onPause: () => void;
  onPlayAlbum?: (tracks: MusicTrack[]) => void;
}

export function resolveTrackAlbumTitle(track: MusicTrack): string {
  const album = track.album?.trim();
  if (album) return album;
  if (track.source === "r2" || (track.url && track.url.includes("/api/blob/"))) {
    return "云端音廊";
  }
  return "精选单曲";
}

function resolveTrackArtist(track: MusicTrack): string {
  const artist = track.artist?.trim();
  return artist || "未知歌手";
}

function isSameTrack(a: MusicTrack, b: MusicTrack): boolean {
  if (a.id !== undefined && b.id !== undefined && String(a.id) === String(b.id)) {
    return true;
  }
  return Boolean(a.url && b.url && a.url === b.url);
}

function formatTrackDuration(track: MusicTrack): string | null {
  const raw = (track as MusicTrack & { duration?: number | string }).duration;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    const mins = Math.floor(raw / 60);
    const secs = Math.floor(raw % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return null;
}

export function AlbumWallView({
  tracks,
  currentTrack,
  isPlaying,
  onPlay,
  onPause,
  onPlayAlbum,
}: AlbumWallViewProps) {
  const [groupBy, setGroupBy] = useState<GroupByMode>("album");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  const allGroups = useMemo<AlbumGroup[]>(() => {
    const map = new Map<
      string,
      {
        title: string;
        tracks: MusicTrack[];
        artists: string[];
        albums: string[];
        coverUrl?: string;
      }
    >();

    for (const track of tracks) {
      const albumTitle = resolveTrackAlbumTitle(track);
      const artistName = resolveTrackArtist(track);
      const key = groupBy === "album" ? albumTitle : artistName;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          title: key,
          tracks: [],
          artists: [],
          albums: [],
          coverUrl: undefined,
        };
        map.set(key, entry);
      }

      entry.tracks.push(track);
      if (!entry.artists.includes(artistName)) {
        entry.artists.push(artistName);
      }
      if (!entry.albums.includes(albumTitle)) {
        entry.albums.push(albumTitle);
      }
      if (!entry.coverUrl && track.pic && track.pic.trim()) {
        entry.coverUrl = track.pic.trim();
      }
    }

    return Array.from(map.entries()).map(([key, entry]) => {
      const subtitle =
        groupBy === "album"
          ? `${
              entry.artists.length > 2
                ? `${entry.artists.slice(0, 2).join(" / ")} 等`
                : entry.artists.join(" / ")
            } · ${entry.tracks.length} 首`
          : `${entry.albums.length} 张专辑 · ${entry.tracks.length} 首`;

      return {
        key,
        title: entry.title,
        subtitle,
        coverUrl: entry.coverUrl,
        tracks: entry.tracks,
      };
    });
  }, [tracks, groupBy]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter(
      (group) =>
        group.title.toLowerCase().includes(q) ||
        group.subtitle.toLowerCase().includes(q) ||
        group.tracks.some(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.artist && t.artist.toLowerCase().includes(q)) ||
            (t.album && t.album.toLowerCase().includes(q)),
        ),
    );
  }, [allGroups, searchQuery]);

  const selectedGroup = useMemo(
    () => (selectedGroupKey ? allGroups.find((g) => g.key === selectedGroupKey) || null : null),
    [allGroups, selectedGroupKey],
  );

  const isSelectedGroupPlaying = Boolean(
    selectedGroup &&
      isPlaying &&
      currentTrack &&
      selectedGroup.tracks.some((t) => isSameTrack(t, currentTrack)),
  );

  const handleGroupModeChange = (mode: GroupByMode) => {
    setGroupBy(mode);
    setSelectedGroupKey(null);
  };

  return (
    <div className="flex flex-col gap-4 ani-show">
      {/* 顶部聚合与瞬时筛选控制栏 */}
      <div className="rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[rgb(var(--rin-hairline-rgb)/0.65)] bg-[rgb(var(--rin-ink-rgb)/0.04)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleGroupModeChange("album")}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                groupBy === "album"
                  ? "bg-[rgb(var(--rin-surface-rgb))] text-theme font-bold shadow-2xs"
                  : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
              }`}
            >
              按专辑聚合
            </button>
            <button
              type="button"
              onClick={() => handleGroupModeChange("artist")}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                groupBy === "artist"
                  ? "bg-[rgb(var(--rin-surface-rgb))] text-theme font-bold shadow-2xs"
                  : "text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))]"
              }`}
            >
              按歌手聚合
            </button>
          </div>

          <span className="text-[11px] font-mono text-[rgb(var(--rin-ink-muted-rgb))]">
            {filteredGroups.length} {groupBy === "album" ? "张专辑" : "位歌手"} · {tracks.length} 首曲目
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--rin-ink-muted-rgb))] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={groupBy === "album" ? "筛选专辑、歌手或曲名..." : "筛选歌手、专辑或曲名..."}
            className="w-full rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-canvas-rgb)/0.65)] pl-8 pr-7 py-1.5 text-xs text-[rgb(var(--rin-ink-rgb))] placeholder:text-[rgb(var(--rin-ink-muted-rgb))] outline-none focus:border-theme transition"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="清空筛选"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--rin-ink-muted-rgb))] hover:text-[rgb(var(--rin-ink-rgb))] cursor-pointer"
            >
              <i className="ri-close-line" />
            </button>
          ) : null}
        </div>
      </div>

      {/* 展开的专辑 / 歌手内联曲目面板 */}
      {selectedGroup ? (
        <section
          aria-label={`专辑详情：${selectedGroup.title}`}
          className="rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] p-4 sm:p-5 shadow-xs space-y-4 ani-show"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgb(var(--rin-hairline-rgb)/0.65)]">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-canvas-rgb)/0.65)] overflow-hidden shrink-0 flex items-center justify-center">
                {selectedGroup.coverUrl ? (
                  <img
                    src={selectedGroup.coverUrl}
                    alt={selectedGroup.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full p-2 flex items-center justify-center">
                    <VinylDiscArt isPlaying={isSelectedGroupPlaying} className="h-full w-full" />
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-theme">
                  <i className={groupBy === "album" ? "ri-album-line" : "ri-user-voice-line"} />
                  <span>{groupBy === "album" ? "专辑曲目" : "歌手作品集"}</span>
                </span>
                <h3 className="text-sm sm:text-base font-bold text-[rgb(var(--rin-ink-rgb))] truncate">
                  {selectedGroup.title}
                </h3>
                <p className="text-xs text-[rgb(var(--rin-ink-muted-rgb))] truncate">
                  {selectedGroup.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (onPlayAlbum) {
                    onPlayAlbum(selectedGroup.tracks);
                  } else if (selectedGroup.tracks[0]) {
                    onPlay(selectedGroup.tracks[0]);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 transition cursor-pointer"
              >
                <i className="ri-play-fill text-sm" />
                <span>全部播放</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroupKey(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] text-xs font-semibold text-[rgb(var(--rin-ink-rgb))] hover:border-theme/50 hover:text-theme transition cursor-pointer"
              >
                <i className="ri-arrow-left-line text-sm" />
                <span>返回全部专辑</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-[rgb(var(--rin-hairline-rgb)/0.55)] rounded-xl border border-[rgb(var(--rin-hairline-rgb))] overflow-hidden">
            {selectedGroup.tracks.map((track, idx) => {
              const isTrackCurrent = currentTrack ? isSameTrack(currentTrack, track) : false;
              const isTrackPlaying = isTrackCurrent && isPlaying;
              const durationText = formatTrackDuration(track);

              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 text-xs transition ${
                    isTrackCurrent
                      ? "bg-theme/[0.06]"
                      : "hover:bg-[rgb(var(--rin-ink-rgb)/0.025)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-5 text-center font-mono text-[11px] tabular-nums shrink-0 ${
                        isTrackCurrent ? "text-theme font-bold" : "text-[rgb(var(--rin-ink-muted-rgb))]"
                      }`}
                    >
                      {isTrackPlaying ? "▶" : idx + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (isTrackPlaying) onPause();
                        else onPlay(track);
                      }}
                      aria-label={isTrackPlaying ? `暂停 ${track.name}` : `播放 ${track.name}`}
                      title={isTrackPlaying ? "暂停" : "播放"}
                      className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
                        isTrackPlaying
                          ? "bg-theme text-white shadow-2xs"
                          : "bg-theme/10 text-theme hover:bg-theme hover:text-white"
                      }`}
                    >
                      <i className={isTrackPlaying ? "ri-pause-fill text-xs" : "ri-play-fill text-xs translate-x-0.5"} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-semibold truncate ${
                          isTrackCurrent ? "text-theme" : "text-[rgb(var(--rin-ink-rgb))]"
                        }`}
                      >
                        {track.name}
                      </div>
                      <div className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] truncate">
                        {resolveTrackArtist(track)}
                        {groupBy === "artist" ? ` · ${resolveTrackAlbumTitle(track)}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {durationText ? (
                      <span className="font-mono text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] tabular-nums">
                        {durationText}
                      </span>
                    ) : null}
                    <span className="px-2 py-0.5 rounded-md border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-canvas-rgb)/0.6)] font-mono text-[10px] text-[rgb(var(--rin-ink-muted-rgb))]">
                      {formatCleanSourceName(track)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Navidrome 风格专辑封面墙网格 */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-[rgb(var(--rin-hairline-rgb))] bg-[rgb(var(--rin-surface-rgb))] py-16 px-4 text-center space-y-2">
          <i className="ri-album-line text-3xl text-[rgb(var(--rin-ink-muted-rgb))] opacity-50" />
          <p className="text-xs font-medium text-[rgb(var(--rin-ink-muted-rgb))]">
            {searchQuery.trim()
              ? `未找到匹配 “${searchQuery.trim()}” 的${groupBy === "album" ? "专辑" : "歌手"}`
              : "当前曲库暂无可展示的专辑"}
          </p>
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-1 inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-[rgb(var(--rin-hairline-rgb))] text-xs text-[rgb(var(--rin-ink-rgb))] hover:border-theme hover:text-theme transition cursor-pointer"
            >
              清空筛选条件
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredGroups.map((group) => {
            const isSelected = selectedGroup?.key === group.key;
            const isGroupCurrent = Boolean(
              currentTrack && group.tracks.some((t) => isSameTrack(t, currentTrack)),
            );
            const isGroupPlaying = isGroupCurrent && isPlaying;

            return (
              <article
                key={group.key}
                className={`group flex flex-col rounded-2xl p-1.5 -m-1.5 transition ${
                  isSelected
                    ? "ring-2 ring-theme/45 bg-theme/[0.04]"
                    : "hover:bg-[rgb(var(--rin-ink-rgb)/0.025)]"
                }`}
              >
                <div
                  className={`relative aspect-square rounded-2xl border bg-[rgb(var(--rin-surface-rgb))] overflow-hidden ${
                    isGroupCurrent
                      ? "border-theme/70 shadow-sm"
                      : "border-[rgb(var(--rin-hairline-rgb))]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedGroupKey(isSelected ? null : group.key)}
                    aria-label={`查看 ${group.title}`}
                    className="block h-full w-full text-left cursor-pointer focus:outline-none"
                  >
                    {group.coverUrl ? (
                      <img
                        src={group.coverUrl}
                        alt={group.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full p-3 flex items-center justify-center bg-[rgb(var(--rin-canvas-rgb)/0.65)]">
                        <VinylDiscArt isPlaying={isGroupPlaying} className="h-full w-full" />
                      </div>
                    )}
                  </button>

                  {isGroupPlaying ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-2 right-2 px-2 py-1 rounded-full bg-black/65 backdrop-blur-sm flex items-center gap-0.5 border border-white/15"
                    >
                      <span className="w-0.5 h-2 bg-theme rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-0.5 h-3 bg-theme rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-0.5 h-2 bg-theme rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  ) : null}

                  <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isGroupPlaying) {
                          onPause();
                        } else if (group.tracks[0]) {
                          onPlay(group.tracks[0]);
                        }
                      }}
                      aria-label={isGroupPlaying ? `暂停 ${group.title}` : `播放 ${group.title}`}
                      title={isGroupPlaying ? "暂停" : "播放"}
                      className="pointer-events-auto h-11 w-11 rounded-full bg-theme text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer"
                    >
                      <i
                        className={
                          isGroupPlaying
                            ? "ri-pause-fill text-lg"
                            : "ri-play-fill text-lg translate-x-0.5"
                        }
                      />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedGroupKey(isSelected ? null : group.key)}
                  className="mt-2 px-0.5 text-left space-y-0.5 cursor-pointer focus:outline-none"
                >
                  <div
                    className={`truncate font-semibold text-xs ${
                      isGroupCurrent ? "text-theme" : "text-[rgb(var(--rin-ink-rgb))]"
                    }`}
                    title={group.title}
                  >
                    {group.title}
                  </div>
                  <div
                    className="truncate text-[11px] text-[rgb(var(--rin-ink-muted-rgb))]"
                    title={group.subtitle}
                  >
                    {group.subtitle}
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
