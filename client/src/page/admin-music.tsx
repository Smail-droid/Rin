import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useMusicPlayer } from "../components/music-player/music-player-context";
import { R2MediaPickerModal } from "../components/r2-media-picker-modal";
import {
  gdMusicService,
  syncOpenListFiles,
  persistTrackToR2,
  deleteR2Track,
  fetchR2MusicFiles,
  fetchR2StorageStats,
  renameR2Track,
  updateR2TrackCover,
  sniffR2AudioCover,
  type GdSearchResultItem,
  type R2MusicFileItem,
  type R2StorageStats,
} from "../services/music-api";
import type { MusicTrack } from "../components/music-player/types";
import {
  cleanDisplayTitle,
  sortSearchResultsByRelevance,
  useAudioUploadQueue,
  AudioUploadCenter,
  CoverEditModal,
  MusicSettingsDrawer,
  PlaylistDataGrid,
  GalleryView,
  ExploreView,
  CustomTrackBar,
} from "./admin-music/index";

export function AdminMusicPage() {
  const siteConfig = useSiteConfig();
  const player = useMusicPlayer();

  // 核心三大视界：音廊 (R2云端资产) | 播放列表 (前台歌单) | 曲库探索 (全网检索)
  const [activeTab, setActiveTab] = useState<"gallery" | "playlist" | "explore">("gallery");

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [batchStatus, setBatchStatus] = useState<"idle" | "batching" | "done">("idle");
  const [customStatus, setCustomStatus] = useState<"idle" | "done">("idle");
  const [openListSyncStatus, setOpenListSyncStatus] = useState<"idle" | "syncing" | "done">("idle");
  const [syncCount, setSyncCount] = useState<number>(0);
  const [autoPersistR2, setAutoPersistR2] = useState<boolean>(true);
  const [persistR2Status, setPersistR2Status] = useState<"idle" | "saving" | "done">("idle");

  // 音廊专属状态
  const [displayLayout, setDisplayLayout] = useState<"grid" | "list">("grid");
  const [gridColumns, setGridColumns] = useState<6 | 8 | 10>(() => {
    try {
      return (Number(localStorage.getItem("rin_music_grid_cols")) || 6) as 6 | 8 | 10;
    } catch {
      return 6;
    }
  });
  const [r2Files, setR2Files] = useState<R2MusicFileItem[]>([]);
  const [r2Stats, setR2Stats] = useState<R2StorageStats | null>(null);
  const [loadingR2, setLoadingR2] = useState<boolean>(false);
  const [selectedR2Keys, setSelectedR2Keys] = useState<Set<string>>(new Set());
  const [searchR2Query, setSearchR2Query] = useState<string>("");
  const [sortR2By, setSortR2By] = useState<"newest" | "largest" | "name">("newest");
  const [editingR2Key, setEditingR2Key] = useState<string | null>(null);
  const [editingR2Name, setEditingR2Name] = useState<string>("");

  // 封面模态与媒体库
  const [autoFetchingAllCovers, setAutoFetchingAllCovers] = useState<boolean>(false);
  const [coverTargetFile, setCoverTargetFile] = useState<R2MusicFileItem | null>(null);
  const [coverInputUrl, setCoverInputUrl] = useState<string>("");
  const [isR2MediaPickerOpen, setIsR2MediaPickerOpen] = useState<boolean>(false);

  // 播放列表状态
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string | number>>(new Set());
  const [playlistFilterMode, setPlaylistFilterMode] = useState<"all" | "group" | "artist" | "album">("all");
  const [selectedGroupTag, setSelectedGroupTag] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [showNewGroupInput, setShowNewGroupInput] = useState<boolean>(false);
  const [persistingTrackId, setPersistingTrackId] = useState<string | number | null>(null);

  // 全局设置抽屉
  const [settingsExpanded, setSettingsExpanded] = useState<boolean>(false);
  const [musicEnabled, setMusicEnabled] = useState(() => siteConfig.musicEnabled);
  const [musicAutoPlay, setMusicAutoPlay] = useState(() => siteConfig.musicAutoPlay);
  const [musicPosition, setMusicPosition] = useState(() => siteConfig.musicPosition || "bottom-left");
  const [musicSourceType] = useState(() => siteConfig.musicSourceType || "gdstudio");
  const [gdApi] = useState(() => siteConfig.musicGdApi || "https://music-api.gdstudio.xyz/api.php");
  const [gdSource, setGdSource] = useState(() => siteConfig.musicGdSource || "all");
  const [openlistMusicUrl, setOpenlistMusicUrl] = useState(() => siteConfig.musicOpenlistUrl || "");

  // 在线搜索状态
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchMode, setSearchMode] = useState<"song" | "album">("song");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GdSearchResultItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string | number | null>(null);
  const [deepScanning, setDeepScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ totalFound: number; verified: number; excluded: number } | null>(null);
  const [deepVerifiedTracks, setDeepVerifiedTracks] = useState<MusicTrack[]>([]);

  // 手动录入
  const [customName, setCustomName] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  // 加载音廊 R2 文件列表与容量统计
  const loadR2Files = async () => {
    setLoadingR2(true);
    try {
      const [files, stats] = await Promise.all([
        fetchR2MusicFiles(),
        fetchR2StorageStats(),
      ]);
      setR2Files(files);
      setR2Stats(stats);
    } catch (e) {
      console.warn("Load R2 files failed:", e);
    } finally {
      setLoadingR2(false);
    }
  };

  useEffect(() => {
    void loadR2Files();
  }, []);

  // 上传队列深模块状态机
  const uploadQueue = useAudioUploadQueue(r2Files, loadR2Files);

  // 过滤后的 R2 音乐文件列表
  const filteredR2Files = useMemo(() => {
    let list = [...r2Files];
    if (searchR2Query.trim()) {
      const q = searchR2Query.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          f.fileName.toLowerCase().includes(q) ||
          (f.artist && f.artist.toLowerCase().includes(q))
      );
    }

    if (sortR2By === "newest") {
      list.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());
    } else if (sortR2By === "largest") {
      list.sort((a, b) => b.size - a.size);
    } else if (sortR2By === "name") {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-CN"));
    }

    return list;
  }, [r2Files, searchR2Query, sortR2By]);

  // 播放列表分类分组统计
  const customGroups = useMemo(() => {
    const map = new Map<string, number>();
    player.playlist.forEach((t) => {
      const g = t.group || "默认";
      map.set(g, (map.get(g) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [player.playlist]);

  const displayedPlaylist = useMemo(() => {
    if (playlistFilterMode === "all" || !selectedGroupTag) return player.playlist;
    if (playlistFilterMode === "group") return player.playlist.filter((t) => (t.group || "默认") === selectedGroupTag);
    if (playlistFilterMode === "artist") return player.playlist.filter((t) => t.artist === selectedGroupTag);
    if (playlistFilterMode === "album") return player.playlist.filter((t) => (t.album || "精选集") === selectedGroupTag);
    return player.playlist;
  }, [player.playlist, playlistFilterMode, selectedGroupTag]);

  // 保存全局配置
  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await client.config.update("client", {
        "music.enabled": musicEnabled ? "true" : "false",
        "music.auto_play": musicAutoPlay ? "true" : "false",
        "music.position": musicPosition,
        "music.source_type": musicSourceType,
        "music.gd_api": gdApi.trim(),
        "music.gd_source": gdSource,
        "music.openlist_url": openlistMusicUrl.trim(),
        "music.playlist": JSON.stringify(player.playlist),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // 输入数字直接跳转序号
  const handleMoveTrackToIndex = (fromIdx: number, targetNumStr: string) => {
    const targetNum = parseInt(targetNumStr.trim(), 10);
    if (isNaN(targetNum) || targetNum < 1) return;
    const targetIdx = Math.min(player.playlist.length, targetNum) - 1;
    if (targetIdx === fromIdx) return;

    const list = [...player.playlist];
    const [moved] = list.splice(fromIdx, 1);
    list.splice(targetIdx, 0, moved);
    player.setPlaylist(list);

    try {
      void client.config.update("client", { "music.playlist": JSON.stringify(list) });
    } catch {}
  };

  // 单曲置顶
  const handleMoveToTop = (trackId: string | number) => {
    const list = [...player.playlist];
    const idx = list.findIndex((t) => t.id === trackId);
    if (idx > 0) {
      const [moved] = list.splice(idx, 1);
      list.unshift(moved);
      player.setPlaylist(list);
    }
  };

  // 批量置顶
  const handleBatchMoveToTop = () => {
    if (!selectedTrackIds.size) return;
    const selected = player.playlist.filter((t) => selectedTrackIds.has(t.id));
    const unselected = player.playlist.filter((t) => !selectedTrackIds.has(t.id));
    player.setPlaylist([...selected, ...unselected]);
  };

  // 单曲手动转存至音廊
  const handleSingleTrackPersist = async (track: MusicTrack) => {
    if (track.source === "r2" || track.url.includes("/api/blob/music/")) return;
    setPersistingTrackId(track.id);
    try {
      const res = await persistTrackToR2({
        url: track.url,
        trackId: track.id,
        name: `${track.artist} - ${track.name}`,
        pic: track.pic,
        artist: track.artist,
      });
      if (res.url) {
        const permanentUrl = res.url;
        const updated = player.playlist.map((t) =>
          t.id === track.id ? { ...t, url: permanentUrl, pic: res.pic || t.pic, source: "r2", sourceName: "音廊" } : t
        );
        player.setPlaylist(updated);
        try {
          await client.config.update("client", { "music.playlist": JSON.stringify(updated) });
        } catch {}
        await loadR2Files();
      }
    } catch (e) {
      console.warn("Single persist failed:", e);
    } finally {
      setPersistingTrackId(null);
    }
  };

  // 一键将播放列表中所有非 R2 的动态外链歌曲全部下载转存至音廊
  const handleBatchPersistR2 = async () => {
    const list = [...player.playlist];
    const targets = list.filter((t) => t.source !== "r2" && !t.url.includes("/api/blob/"));
    if (targets.length === 0) return;

    setPersistR2Status("saving");
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.source !== "r2" && !t.url.includes("/api/blob/")) {
        const res = await persistTrackToR2({
          url: t.url,
          trackId: t.id,
          name: `${t.artist} - ${t.name}`,
          pic: t.pic,
          artist: t.artist,
        });
        if (res.url) {
          list[i] = {
            ...t,
            url: res.url,
            pic: res.pic || t.pic,
            source: "r2",
            sourceName: "音廊",
          };
        }
      }
    }

    player.setPlaylist(list);
    setPersistR2Status("done");
    setTimeout(() => setPersistR2Status("idle"), 2500);

    try {
      await client.config.update("client", { "music.playlist": JSON.stringify(list) });
    } catch {}
    await loadR2Files();
  };

  // 重命名音廊文件
  const handleSaveRenameR2 = async (key: string) => {
    if (!editingR2Name.trim()) {
      setEditingR2Key(null);
      return;
    }
    const success = await renameR2Track(key, editingR2Name.trim());
    if (success) {
      setR2Files((prev) =>
        prev.map((f) => (f.key === key ? { ...f, displayName: editingR2Name.trim() } : f))
      );
    }
    setEditingR2Key(null);
  };

  // 封面更换与持久化保存
  const handleSaveCover = async (file: R2MusicFileItem, newCoverUrl: string) => {
    if (!newCoverUrl.trim()) return;
    const ok = await updateR2TrackCover(file.key, newCoverUrl.trim());
    if (ok) {
      setR2Files((prev) =>
        prev.map((f) => (f.key === file.key ? { ...f, pic: newCoverUrl.trim() } : f))
      );
      const updated = player.playlist.map((t) =>
        t.url.includes(file.key) ? { ...t, pic: newCoverUrl.trim() } : t
      );
      player.setPlaylist(updated);
    }
    setCoverTargetFile(null);
    setCoverInputUrl("");
  };

  // 自动为单个音廊歌曲嗅探封面 (优先从音频本身提取嵌入元数据封面，无元数据才联网寻找)
  const handleAutoFetchSingleCover = async (file: R2MusicFileItem) => {
    try {
      const metaRes = await sniffR2AudioCover(file.key);
      if (metaRes.found && metaRes.pic) {
        setR2Files((prev) =>
          prev.map((f) => (f.key === file.key ? { ...f, pic: metaRes.pic } : f))
        );
        const updated = player.playlist.map((t) =>
          t.url.includes(file.key) ? { ...t, pic: metaRes.pic } : t
        );
        player.setPlaylist(updated);
        setCoverTargetFile(null);
        setCoverInputUrl("");
        return;
      }

      const cleanTitle = cleanDisplayTitle(file.displayName);
      const cleanArtist = cleanDisplayTitle(file.artist || "");
      const q = `${cleanTitle} ${cleanArtist}`.trim();
      const items = await gdMusicService.search(q, "all", 1, 3);
      for (const item of items) {
        const { track } = await gdMusicService.resolveTrackWithFallback(item, 128);
        if (track?.pic) {
          await handleSaveCover(file, track.pic);
          break;
        }
      }
    } catch {}
  };

  // 一键自动补全全部无封面的音廊曲目
  const handleAutoFetchAllMissingCovers = async () => {
    const missing = r2Files.filter((f) => !f.pic);
    if (!missing.length) return;
    setAutoFetchingAllCovers(true);
    for (const f of missing) {
      await handleAutoFetchSingleCover(f);
    }
    setAutoFetchingAllCovers(false);
  };

  // 从音廊中物理删除文件
  const handleDeleteR2PhysicalFile = async (file: R2MusicFileItem) => {
    const success = await deleteR2Track(file.key);
    if (success) {
      setR2Files((prev) => prev.filter((f) => f.key !== file.key));
      const remaining = player.playlist.filter((t) => !t.url.includes(file.key));
      if (remaining.length !== player.playlist.length) {
        player.setPlaylist(remaining);
      }
    }
  };

  // 将音廊文件单首导入播放列表
  const handleImportR2ToQueue = (file: R2MusicFileItem) => {
    const rawTitle = cleanDisplayTitle(file.displayName);
    const rawArtist = cleanDisplayTitle(file.artist || "");
    const parts = rawTitle.split("-").map((s: string) => cleanDisplayTitle(s));
    const artist = rawArtist && rawArtist !== "本地上传" ? rawArtist : (parts.length > 1 ? parts[0] : "音廊");
    const songName = parts.length > 1 ? parts.slice(1).join("-").trim() : rawTitle;
    const track: MusicTrack = {
      id: `r2_${file.key}`,
      name: songName,
      artist,
      album: "云端音廊",
      url: file.url,
      pic: file.pic,
      source: "r2",
      sourceName: "音廊",
      group: "音廊曲库",
    };
    player.addTrack(track, false);
  };

  // 将全部音廊歌曲导入播放列表
  const handleImportAllR2ToQueue = () => {
    if (r2Files.length === 0) return;
    const newTracks: MusicTrack[] = r2Files.map((file) => {
      const rawTitle = cleanDisplayTitle(file.displayName);
      const rawArtist = cleanDisplayTitle(file.artist || "");
      const parts = rawTitle.split("-").map((s: string) => cleanDisplayTitle(s));
      const artist = rawArtist && rawArtist !== "本地上传" ? rawArtist : (parts.length > 1 ? parts[0] : "音廊");
      const songName = parts.length > 1 ? parts.slice(1).join("-").trim() : rawTitle;
      return {
        id: `r2_${file.key}`,
        name: songName,
        artist,
        album: "云端音廊",
        url: file.url,
        pic: file.pic,
        source: "r2",
        sourceName: "音廊",
        group: "音廊曲库",
      };
    });
    player.setPlaylist([...player.playlist, ...newTracks]);
  };

  // 批量入库选中的音廊曲目
  const handleBatchImportR2Selected = () => {
    if (!selectedR2Keys.size) return;
    r2Files
      .filter((f) => selectedR2Keys.has(f.key))
      .forEach((file) => handleImportR2ToQueue(file));
    setSelectedR2Keys(new Set());
  };

  // 搜索曲目
  const handleSearch = async (kwOverride?: string, srcOverride?: string) => {
    const kw = (kwOverride ?? searchKeyword).trim();
    if (!kw) return;
    setIsSearching(true);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const src = srcOverride ?? gdSource;
      const finalSource = searchMode === "album" && src !== "all" ? `${src}_album` : src;
      const items = await gdMusicService.search(kw, finalSource, 1, 30);
      setSearchResults(sortSearchResultsByRelevance(items, kw));
    } catch (e) {
      console.warn("Search error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // 嗅探（探测多页并自动排除受限）
  const handleDeepScanAndVerify = async (pages = 3) => {
    const kw = searchKeyword.trim();
    if (!kw) return;
    setDeepScanning(true);
    setScanProgress({ totalFound: 0, verified: 0, excluded: 0 });
    setDeepVerifiedTracks([]);
    gdMusicService.setEndpoint(gdApi.trim());

    try {
      const { validTracks, excludedCount } = await gdMusicService.deepScanAndVerify(
        kw,
        gdSource,
        pages,
        (totalFound, verified, excluded) => {
          setScanProgress({ totalFound, verified, excluded });
        }
      );
      setDeepVerifiedTracks(validTracks);
      setScanProgress({
        totalFound: validTracks.length + excludedCount,
        verified: validTracks.length,
        excluded: excludedCount,
      });
    } catch {
      setDeepScanning(false);
    } finally {
      setDeepScanning(false);
    }
  };

  const handleImportAllVerified = () => {
    if (deepVerifiedTracks.length === 0) return;
    player.setPlaylist([...player.playlist, ...deepVerifiedTracks]);
    setDeepVerifiedTracks([]);
    setScanProgress(null);
  };

  // 试听或收录
  const handleResolveAndPlay = async (item: GdSearchResultItem, playNow = true) => {
    setResolvingId(item.id);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const { track } = await gdMusicService.resolveTrackWithFallback(item, 320);
      if (!track || !track.url) return;

      if (autoPersistR2 && track.url && !track.url.includes("/api/blob/")) {
        const res = await persistTrackToR2({
          url: track.url,
          trackId: track.id,
          name: `${track.artist} - ${track.name}`,
          pic: track.pic,
          artist: track.artist,
        });
        if (res.url) {
          track.url = res.url;
          track.pic = res.pic || track.pic;
          track.source = "r2";
          track.sourceName = "音廊";
        }
      }

      player.addTrack(track, playNow);
    } catch {
    } finally {
      setResolvingId(null);
    }
  };

  const handleBatchCollect = async () => {
    if (!searchResults.length) return;
    setBatchStatus("batching");
    gdMusicService.setEndpoint(gdApi.trim());
    for (const item of searchResults.slice(0, 8)) {
      try {
        const { track } = await gdMusicService.resolveTrackWithFallback(item, 320);
        if (track?.url) {
          if (autoPersistR2 && !track.url.includes("/api/blob/")) {
            const res = await persistTrackToR2({
              url: track.url,
              trackId: track.id,
              name: `${track.artist} - ${track.name}`,
              pic: track.pic,
              artist: track.artist,
            });
            if (res.url) {
              track.url = res.url;
              track.pic = res.pic || track.pic;
              track.source = "r2";
              track.sourceName = "音廊";
            }
          }
          player.addTrack(track, false);
        }
      } catch {}
    }
    setBatchStatus("done");
    setTimeout(() => setBatchStatus("idle"), 2500);
  };

  const handleSyncOpenList = async () => {
    const targetUrl = openlistMusicUrl.trim();
    if (!targetUrl) return;
    setOpenListSyncStatus("syncing");
    try {
      const tracks = await syncOpenListFiles(targetUrl);
      if (tracks.length > 0) {
        player.setPlaylist([...player.playlist, ...tracks]);
        setSyncCount(tracks.length);
        setOpenListSyncStatus("done");
        setTimeout(() => setOpenListSyncStatus("idle"), 3000);
      } else {
        setOpenListSyncStatus("idle");
      }
    } catch {
      setOpenListSyncStatus("idle");
    }
  };

  // 批量操作
  const handleToggleSelectAll = () => {
    if (selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0) setSelectedTrackIds(new Set());
    else setSelectedTrackIds(new Set(displayedPlaylist.map((t) => t.id)));
  };

  const handleInvertSelect = () => {
    const s = new Set<string | number>();
    displayedPlaylist.forEach((t) => { if (!selectedTrackIds.has(t.id)) s.add(t.id); });
    setSelectedTrackIds(s);
  };

  const handleBatchDelete = async () => {
    if (!selectedTrackIds.size) return;
    const remaining = player.playlist.filter((t) => !selectedTrackIds.has(t.id));
    player.setPlaylist(remaining);
    setSelectedTrackIds(new Set());
    try {
      await client.config.update("client", { "music.playlist": JSON.stringify(remaining) });
    } catch {}
  };

  const handleDeleteTrack = async (track: MusicTrack) => {
    player.removeTrack(track.id);
  };

  const handleAssignGroup = (groupName: string) => {
    if (!selectedTrackIds.size || !groupName.trim()) return;
    const targetGroup = groupName.trim();
    const updated = player.playlist.map((t) => {
      if (selectedTrackIds.has(t.id)) return { ...t, group: targetGroup };
      return t;
    });
    player.setPlaylist(updated);
    setNewGroupName("");
    setShowNewGroupInput(false);
  };

  const handleAddCustomTrack = () => {
    if (!customName.trim() || !customUrl.trim()) return;
    const t: MusicTrack = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      artist: customArtist.trim() || "未知",
      url: customUrl.trim(),
      pic: "",
      lyric: "",
      source: "custom",
      sourceName: "自定义",
      group: selectedGroupTag || "默认",
    };
    player.addTrack(t, true);
    setCustomName("");
    setCustomArtist("");
    setCustomUrl("");
    setCustomStatus("done");
    setTimeout(() => setCustomStatus("idle"), 2500);
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show">
      <Helmet><title>{`音廊 · 云端音乐资产中枢 - ${siteConfig.name}`}</title></Helmet>

      {/* 隐藏的文件输入组件 */}
      <input
        ref={uploadQueue.audioFilesInputRef}
        type="file"
        accept="audio/*, .mp3, .flac, .wav, .m4a"
        multiple
        onChange={(e) => {
          if (e.target.files) uploadQueue.handleEnqueueFiles(Array.from(e.target.files));
          if (uploadQueue.audioFilesInputRef.current) uploadQueue.audioFilesInputRef.current.value = "";
        }}
        className="hidden"
      />
      <input
        ref={uploadQueue.audioFolderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browser
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          if (e.target.files) uploadQueue.handleEnqueueFiles(Array.from(e.target.files));
          if (uploadQueue.audioFolderInputRef.current) uploadQueue.audioFolderInputRef.current.value = "";
        }}
        className="hidden"
      />

      {/* 1. 顶部 Header & 容量资产胶囊 */}
      <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme/10 text-theme text-xl shadow-2xs">
            <i className="ri-disc-line" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold t-primary">音廊 · 云端音乐资产中枢</h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                musicEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
              }`}>
                {musicEnabled ? "已启用" : "未开启"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1 flex-wrap">
              <span className="rounded-full bg-neutral-100 dark:bg-white/10 px-2 py-0.5 font-semibold text-neutral-600 dark:text-neutral-300 text-[11px]">
                {r2Files.length} 首曲目
              </span>
              {r2Stats && (
                <>
                  <span className="rounded-full bg-neutral-100 dark:bg-white/10 px-2 py-0.5 font-semibold text-neutral-600 dark:text-neutral-300 text-[11px]">
                    {(r2Stats.musicBytes / (1024 * 1024)).toFixed(1)} MB 已用
                  </span>
                  <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-semibold text-[11px]">
                    剩余 {(r2Stats.remainingBytes / (1024 * 1024 * 1024)).toFixed(2)} GB / 10 GB
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => uploadQueue.audioFilesInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 transition flex items-center gap-1.5"
            title="支持同时选择多个音频文件上传"
          >
            <i className="ri-upload-cloud-line text-sm" />
            <span>上传文件</span>
          </button>

          <button
            type="button"
            onClick={() => uploadQueue.audioFolderInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 text-xs font-bold hover:border-theme hover:text-theme transition flex items-center gap-1.5"
            title="选择整个文件夹递归导入全部音频文件"
          >
            <i className="ri-folder-upload-line text-sm" />
            <span>上传文件夹</span>
          </button>

          {uploadQueue.uploadTasks.length > 0 && (
            <button
              type="button"
              onClick={() => uploadQueue.setShowUploadPanel(!uploadQueue.showUploadPanel)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                uploadQueue.uploadTasks.some((t: any) => t.status === "uploading")
                  ? "bg-theme text-white shadow-2xs animate-pulse"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
              title="查看上传任务详情"
            >
              <i className="ri-upload-2-line text-xs" />
              <span>
                上传任务 ({uploadQueue.uploadStats.completed}/{uploadQueue.uploadStats.all})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={loadR2Files}
            disabled={loadingR2}
            className="p-2 rounded-xl border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme hover:bg-black/5 transition"
            title="刷新音廊数据"
          >
            <i className={`ri-refresh-line text-sm ${loadingR2 ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className="px-2.5 py-1.5 rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 text-xs font-semibold hover:border-theme transition flex items-center gap-1"
          >
            <i className="ri-settings-4-line text-xs" />
            <span>电台设置</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-2xs transition flex items-center gap-1 ${
              saveStatus === "saved"
                ? "bg-emerald-500"
                : saveStatus === "error"
                ? "bg-rose-500"
                : "bg-theme hover:bg-theme-hover active:scale-95"
            }`}
          >
            {saveStatus === "saving" && <i className="ri-loader-4-line animate-spin text-xs" />}
            {saveStatus === "saved" && <i className="ri-check-line text-xs" />}
            <span>{saveStatus === "saving" ? "保存中" : saveStatus === "saved" ? "已保存" : "保存配置"}</span>
          </button>
        </div>
      </div>

      {/* 2. 电台参数折叠设置抽屉 */}
      <MusicSettingsDrawer
        expanded={settingsExpanded}
        onClose={() => setSettingsExpanded(false)}
        musicEnabled={musicEnabled}
        setMusicEnabled={setMusicEnabled}
        musicAutoPlay={musicAutoPlay}
        setMusicAutoPlay={setMusicAutoPlay}
        musicPosition={musicPosition}
        setMusicPosition={setMusicPosition}
        openlistMusicUrl={openlistMusicUrl}
        setOpenlistMusicUrl={setOpenlistMusicUrl}
        gdSource={gdSource}
        setGdSource={setGdSource}
        onSyncOpenList={handleSyncOpenList}
        openListSyncStatus={openListSyncStatus}
        syncCount={syncCount}
      />

      {/* 3. 核心三大视界大标签栏 */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 select-none w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("gallery")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "gallery"
              ? "bg-w text-theme shadow-xs"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          <i className="ri-archive-line text-sm" />
          <span>音廊资产 ({r2Files.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("playlist")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "playlist"
              ? "bg-w text-theme shadow-xs"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          <i className="ri-play-list-line text-sm" />
          <span>播放列表 ({player.playlist.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("explore")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "explore"
              ? "bg-w text-theme shadow-xs"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          <i className="ri-compass-line text-sm" />
          <span>曲库探索</span>
        </button>
      </div>

      {/* 4. 视界 A: 音廊资产 */}
      {activeTab === "gallery" && (
        <div
          onDragEnter={uploadQueue.handleDragEnter}
          onDragOver={uploadQueue.handleDragOver}
          onDragLeave={uploadQueue.handleDragLeave}
          onDrop={uploadQueue.handleDrop}
          className={`flex flex-col gap-3.5 ani-show relative ${uploadQueue.isDragOverGallery ? "ring-2 ring-theme/50 rounded-2xl bg-theme/5" : ""}`}
        >
          {uploadQueue.isDragOverGallery && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-w/80 backdrop-blur-md border-2 border-dashed border-theme ani-show pointer-events-none">
              <i className="ri-folder-music-line text-4xl text-theme animate-bounce" />
              <p className="mt-2 text-sm font-bold t-primary">松开即可导入所有音频文件与文件夹...</p>
              <p className="text-xs text-neutral-400 mt-1">自动识别音频格式 · 自动递归解析子目录 · 自动重复排重</p>
            </div>
          )}

          {/* 上传任务状态中枢面板 */}
          {(uploadQueue.showUploadPanel || uploadQueue.uploadTasks.length > 0) && (
            <AudioUploadCenter
              uploadTasks={uploadQueue.uploadTasks}
              filteredUploadTasks={uploadQueue.filteredUploadTasks}
              uploadStats={uploadQueue.uploadStats}
              uploadFilterTab={uploadQueue.uploadFilterTab}
              setUploadFilterTab={uploadQueue.setUploadFilterTab}
              onStartAll={uploadQueue.handleStartAllUploads}
              onPauseAll={uploadQueue.handlePauseAllUploads}
              onRetryFailed={uploadQueue.handleRetryAllFailed}
              onClearPanel={uploadQueue.handleClearTaskPanel}
              onClosePanel={() => uploadQueue.setShowUploadPanel(false)}
              onPauseTask={uploadQueue.handlePauseTask}
              onResumeTask={uploadQueue.handleResumeTask}
              onCancelTask={uploadQueue.handleCancelTask}
            />
          )}

          <GalleryView
            displayLayout={displayLayout}
            setDisplayLayout={setDisplayLayout}
            gridColumns={gridColumns}
            setGridColumns={setGridColumns}
            r2Files={r2Files}
            filteredR2Files={filteredR2Files}
            searchR2Query={searchR2Query}
            setSearchR2Query={setSearchR2Query}
            sortR2By={sortR2By}
            setSortR2By={setSortR2By}
            selectedR2Keys={selectedR2Keys}
            setSelectedR2Keys={setSelectedR2Keys}
            editingR2Key={editingR2Key}
            setEditingR2Key={setEditingR2Key}
            editingR2Name={editingR2Name}
            setEditingR2Name={setEditingR2Name}
            onSaveRenameR2={handleSaveRenameR2}
            autoFetchingAllCovers={autoFetchingAllCovers}
            onAutoFetchAllMissingCovers={handleAutoFetchAllMissingCovers}
            onBatchImportR2Selected={handleBatchImportR2Selected}
            onImportAllR2ToQueue={handleImportAllR2ToQueue}
            onImportR2ToQueue={handleImportR2ToQueue}
            onDeleteR2PhysicalFile={handleDeleteR2PhysicalFile}
            onOpenCoverModal={(file: R2MusicFileItem) => {
              setCoverTargetFile(file);
              setCoverInputUrl(file.pic || "");
            }}
            onTriggerUploadClick={() => uploadQueue.audioFilesInputRef.current?.click()}
            playlist={player.playlist}
            currentTrack={player.currentTrack}
            isPlaying={player.isPlaying}
            onPlayTrack={(t: MusicTrack) => player.play(t)}
            onPauseTrack={() => player.pause()}
          />
        </div>
      )}

      {/* 5. 视界 B: 播放列表 */}
      {activeTab === "playlist" && (
        <div className="flex flex-col gap-3.5 ani-show">
          <PlaylistDataGrid
            displayedPlaylist={displayedPlaylist}
            fullPlaylist={player.playlist}
            currentTrack={player.currentTrack}
            isPlaying={player.isPlaying}
            selectedTrackIds={selectedTrackIds}
            onSelectTrack={(id: string | number, selected: boolean) => {
              const s = new Set(selectedTrackIds);
              if (selected) s.add(id);
              else s.delete(id);
              setSelectedTrackIds(s);
            }}
            onToggleSelectAll={handleToggleSelectAll}
            onInvertSelect={handleInvertSelect}
            playlistFilterMode={playlistFilterMode}
            setPlaylistFilterMode={setPlaylistFilterMode}
            selectedGroupTag={selectedGroupTag}
            setSelectedGroupTag={setSelectedGroupTag}
            customGroups={customGroups}
            showNewGroupInput={showNewGroupInput}
            setShowNewGroupInput={setShowNewGroupInput}
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            onAssignGroup={handleAssignGroup}
            onBatchMoveToTop={handleBatchMoveToTop}
            onBatchPersistR2={handleBatchPersistR2}
            onBatchDelete={handleBatchDelete}
            onResetPlaylist={() => player.clearPlaylist()}
            persistR2Status={persistR2Status}
            persistingTrackId={persistingTrackId}
            onSingleTrackPersist={handleSingleTrackPersist}
            onMoveTrackToIndex={handleMoveTrackToIndex}
            onMoveToTop={handleMoveToTop}
            onPlay={(t: MusicTrack) => player.play(t)}
            onPause={() => player.pause()}
            onDeleteTrack={handleDeleteTrack}
          />

          <CustomTrackBar
            customName={customName}
            setCustomName={setCustomName}
            customArtist={customArtist}
            setCustomArtist={setCustomArtist}
            customUrl={customUrl}
            setCustomUrl={setCustomUrl}
            onAddTrack={handleAddCustomTrack}
            customStatus={customStatus}
          />
        </div>
      )}

      {/* 6. 视界 C: 曲库探索 */}
      {activeTab === "explore" && (
        <ExploreView
          autoPersistR2={autoPersistR2}
          setAutoPersistR2={setAutoPersistR2}
          searchMode={searchMode}
          setSearchMode={setSearchMode}
          searchKeyword={searchKeyword}
          setSearchKeyword={setSearchKeyword}
          onSearch={handleSearch}
          isSearching={isSearching}
          deepScanning={deepScanning}
          onDeepScanAndVerify={handleDeepScanAndVerify}
          scanProgress={scanProgress}
          deepVerifiedTracks={deepVerifiedTracks}
          onImportAllVerified={handleImportAllVerified}
          searchResults={searchResults}
          onBatchCollect={handleBatchCollect}
          batchStatus={batchStatus}
          resolvingId={resolvingId}
          onResolveAndPlay={handleResolveAndPlay}
          playlist={player.playlist}
        />
      )}

      {/* 封面修改 Portal 弹窗 */}
      <CoverEditModal
        coverTargetFile={coverTargetFile}
        coverInputUrl={coverInputUrl}
        setCoverInputUrl={setCoverInputUrl}
        onClose={() => setCoverTargetFile(null)}
        onSave={handleSaveCover}
        onAutoSniff={handleAutoFetchSingleCover}
        onOpenMediaPicker={() => setIsR2MediaPickerOpen(true)}
      />

      {/* R2 媒体库图片选择器 */}
      {isR2MediaPickerOpen && (
        <R2MediaPickerModal
          isOpen={isR2MediaPickerOpen}
          onClose={() => setIsR2MediaPickerOpen(false)}
          onSelect={(url) => {
            setCoverInputUrl(url);
            setIsR2MediaPickerOpen(false);
          }}
          title="挑选专辑封面图片"
        />
      )}
    </div>
  );
}
