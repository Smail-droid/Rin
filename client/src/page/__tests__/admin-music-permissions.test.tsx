import "../../test/setup";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { PlaylistDataGrid } from "../admin-music/playlist-datagrid";
import { ExploreView } from "../admin-music/explore-view";
import type { MusicTrack } from "../../components/music-player/types";

afterEach(() => {
  cleanup();
});

const sampleTracks: MusicTrack[] = [
  {
    id: "track-1",
    name: "夜曲",
    artist: "周杰伦",
    album: "十一月的萧邦",
    url: "https://example.com/api/blob/music/1.mp3",
    source: "r2",
    sourceName: "音廊",
    group: "默认",
  },
];

function renderPlaylistGrid(isAdmin: boolean) {
  return render(
    <PlaylistDataGrid
      isAdmin={isAdmin}
      displayedPlaylist={sampleTracks}
      fullPlaylist={sampleTracks}
      currentTrack={null}
      isPlaying={false}
      selectedTrackIds={new Set()}
      onSelectTrack={mock()}
      onToggleSelectAll={mock()}
      onInvertSelect={mock()}
      playlistFilterMode="all"
      setPlaylistFilterMode={mock()}
      selectedGroupTag=""
      setSelectedGroupTag={mock()}
      customGroups={[{ name: "默认", count: 1 }]}
      showNewGroupInput={false}
      setShowNewGroupInput={mock()}
      newGroupName=""
      setNewGroupName={mock()}
      onAssignGroup={mock()}
      onBatchMoveToTop={mock()}
      onBatchPersistR2={mock()}
      onBatchDelete={mock()}
      onResetPlaylist={mock()}
      persistR2Status="idle"
      persistingTrackId={null}
      onSingleTrackPersist={mock()}
      onMoveTrackToIndex={mock()}
      onMoveToTop={mock()}
      onPlay={mock()}
      onPause={mock()}
      onDeleteTrack={mock()}
    />,
  );
}

describe("Music studio visitor vs admin permission isolation", () => {
  it("hides playlist mutation controls and checkboxes for unauthenticated visitors while allowing playback", () => {
    const { queryByText, queryByRole, getByTitle } = renderPlaylistGrid(false);

    expect(queryByText("全选")).toBeNull();
    expect(queryByText("反选")).toBeNull();
    expect(queryByText("全部转存音廊")).toBeNull();
    expect(queryByText("删除")).toBeNull();
    expect(queryByText("重置")).toBeNull();
    expect(queryByText("+ 新建分组")).toBeNull();
    expect(queryByRole("checkbox")).toBeNull();
    expect(queryByRole("spinbutton")).toBeNull();
    expect(getByTitle("播放")).toBeDefined();
  });

  it("shows full playlist management controls for admins", () => {
    const { getByText, getAllByRole } = renderPlaylistGrid(true);

    expect(getByText("全选")).toBeDefined();
    expect(getByText("全部转存音廊")).toBeDefined();
    expect(getByText("删除")).toBeDefined();
    expect(getByText("+ 新建分组")).toBeDefined();
    expect(getAllByRole("checkbox").length).toBeGreaterThan(0);
  });

  it("hides R2 persistence and collection actions from guests in ExploreView while keeping audition", () => {
    const { queryByText, getByText } = render(
      <ExploreView
        isAdmin={false}
        autoPersistR2={true}
        setAutoPersistR2={mock()}
        searchMode="song"
        setSearchMode={mock()}
        searchKeyword="夜曲"
        setSearchKeyword={mock()}
        onSearch={mock()}
        isSearching={false}
        deepScanning={false}
        onDeepScanAndVerify={mock()}
        scanProgress={null}
        deepVerifiedTracks={[]}
        onImportAllVerified={mock()}
        searchResults={[{ id: "1", name: "夜曲", artist: "周杰伦", source: "netease" }]}
        onBatchCollect={mock()}
        batchStatus="idle"
        resolvingId={null}
        onResolveAndPlay={mock()}
        playlist={[]}
      />,
    );

    expect(queryByText("收录时自动转存音廊")).toBeNull();
    expect(queryByText("批量收录前8首")).toBeNull();
    expect(queryByText("收录")).toBeNull();
    expect(getByText("试听")).toBeDefined();
  });
});
