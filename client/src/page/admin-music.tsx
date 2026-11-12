import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useMusicPlayer } from "../components/music-player/music-player-context";
import { VinylDiscArt } from "../components/music-player/vinyl-disc-art";
import { R2MediaPickerModal } from "../components/r2-media-picker-modal";
import {
  gdMusicService,
  GD_MUSIC_SOURCES,
  syncOpenListFiles,
  persistTrackToR2,
  deleteR2Track,
  fetchR2MusicFiles,
  fetchR2StorageStats,
  uploadR2AudioFileWithProgress,
  computeAudioFingerprint,
  renameR2Track,
  updateR2TrackCover,
  type GdSearchResultItem,
  type R2MusicFileItem,
  type R2StorageStats,
} from "../services/music-api";
import type { MusicTrack } from "../components/music-player/types";

// 搜索结果按关键字相关度排序（精准命中歌名/歌手置顶排布）
function sortSearchResultsByRelevance(items: GdSearchResultItem[], kw: string): GdSearchResultItem[] {
  const q = kw.trim().toLowerCase();
  if (!q) return items;
  return [...items].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aArtist = (Array.isArray(a.artist) ? a.artist.join(" ") : String(a.artist)).toLowerCase();
    const bArtist = (Array.isArray(b.artist) ? b.artist.join(" ") : String(b.artist)).toLowerCase();

    const getScore = (name: string, artist: string) => {
      if (name === q) return 100;
      if (artist === q) return 95;
      if (name.startsWith(q)) return 85;
      if (artist.startsWith(q)) return 80;
      if (name.includes(q)) return 70;
      if (artist.includes(q)) return 60;
      return 10;
    };

    return getScore(bName, bArtist) - getScore(aName, aArtist);
  });
}

// 简短中文音源格式化 (严禁英文和自动降级后缀，保持纯粹简洁)
function formatCleanSourceName(track: MusicTrack): string {
  if (track.source === "r2" || (track.url && track.url.includes("/api/blob/"))) {
    return "音廊";
  }
  const raw = `${track.sourceName || ""} ${track.source || ""}`.toLowerCase();
  if (raw.includes("126") || raw.includes("netease")) return "网易云";
  if (raw.includes("bilibili") || raw.includes("bili")) return "哔哩哔哩";
  if (raw.includes("qq") || raw.includes("tencent")) return "QQ音乐";
  if (raw.includes("joox")) return "JOOX";
  if (raw.includes("openlist") || raw.includes("5t")) return "5T网盘";
  if (raw.includes("gallery") || raw.includes("preset")) return "精选";
  return "网络源";
}

// 支持的音频格式集合
const AUDIO_EXTS = new Set([
  "mp3", "flac", "wav", "m4a", "ogg", "aac", "opus", "wma", "webm", "ape", "alac", "aiff"
]);

// 单个音频文件上限 (Cloudflare Worker 请求体上限通常为 100MB)
const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024;

// 上传并发队列上限：严格限制为最多 2 个文件并发，避免上行拥塞与 Cloudflare 边缘 Worker 超时
const MAX_CONCURRENT_UPLOADS = 2;

export interface AudioUploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "paused" | "completed" | "duplicate" | "oversized" | "error";
  error?: string;
  controller?: AbortController;
}

function isAudioFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return AUDIO_EXTS.has(ext) || file.type.startsWith("audio/");
}

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
  // 上传任务队列与控制
  const [uploadTasks, setUploadTasks] = useState<AudioUploadTask[]>([]);
  const tasksRef = useRef<AudioUploadTask[]>([]);
  tasksRef.current = uploadTasks;
  const [showUploadPanel, setShowUploadPanel] = useState<boolean>(false);
  const [isDragOverGallery, setIsDragOverGallery] = useState<boolean>(false);
  const audioFilesInputRef = useRef<HTMLInputElement>(null);
  const audioFolderInputRef = useRef<HTMLInputElement>(null);
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
  const [customPic, setCustomPic] = useState("");
  const [customLyric, setCustomLyric] = useState("");

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
    } catch {
      setR2Files([]);
    } finally {
      setLoadingR2(false);
    }
  };

  useEffect(() => {
    loadR2Files();
  }, []);

  // 过滤后的音廊 R2 文件
  const filteredR2Files = useMemo(() => {
    let list = [...r2Files];
    if (searchR2Query.trim()) {
      const q = searchR2Query.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          (f.artist && f.artist.toLowerCase().includes(q))
      );
    }

    if (sortR2By === "newest") {
      list.sort((a, b) => new Date(b.uploaded || 0).getTime() - new Date(a.uploaded || 0).getTime());
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

  // 核心交互：输入数字直接跳转序号 (如第 14 首输入 3 瞬间移到第 3 位，其余顺延)
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
      client.config.update("client", { "music.playlist": JSON.stringify(list) });
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

  // 单曲手动转存至音廊 (保留封面与元数据)
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

  // 核心：严格限制并发的队列调度泵 (最大并发 MAX_CONCURRENT_UPLOADS = 2，杜绝冲垮网关与请求超时)
  const pumpUploadQueue = useCallback(() => {
    setUploadTasks((currentTasks) => {
      const activeCount = currentTasks.filter((t) => t.status === "uploading").length;
      const availableSlots = MAX_CONCURRENT_UPLOADS - activeCount;
      if (availableSlots <= 0) return currentTasks;

      const queuedTasks = currentTasks.filter((t) => t.status === "queued");
      if (queuedTasks.length === 0) return currentTasks;

      const toStart = queuedTasks.slice(0, availableSlots);
      const toStartIds = new Set(toStart.map((t) => t.id));

      const updated = currentTasks.map((t) => {
        if (toStartIds.has(t.id)) {
          const controller = new AbortController();
          return { ...t, status: "uploading" as const, error: undefined, controller };
        }
        return t;
      });

      // 异步触发开始上传
      toStart.forEach((task) => {
        setTimeout(() => {
          runSingleUpload(task.id, task.file);
        }, 0);
      });

      return updated;
    });
  }, []);

  // 执行单曲上传 (含网络抖动自动重试与槽位回收)
  const runSingleUpload = (taskId: string, file: File, retryAttempt = 0) => {
    const currentTask = tasksRef.current.find((t) => t.id === taskId);
    const controller = currentTask?.controller || new AbortController();

    uploadR2AudioFileWithProgress(file, {
      signal: controller.signal,
      onProgress: (_loaded, _total, percent) => {
        setUploadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress: percent } : t))
        );
      },
    })
      .then((res) => {
        if (res.success) {
          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: "completed" } : t))
          );
          void loadR2Files();
          // 当前文件成功后，调度队列自动启动后续文件
          setTimeout(pumpUploadQueue, 50);
        } else {
          if (res.error === "aborted") {
            setUploadTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, status: "paused" } : t))
            );
            setTimeout(pumpUploadQueue, 50);
          } else {
            // 自动重试机制：非主动取消且首次失败，自动重试 1 次（800ms 缓冲后）
            if (retryAttempt < 1) {
              setTimeout(() => {
                runSingleUpload(taskId, file, retryAttempt + 1);
              }, 800);
            } else {
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId ? { ...t, status: "error", error: res.error || "上传失败" } : t
                )
              );
              // 失败后释放并发槽位，继续推进后续任务
              setTimeout(pumpUploadQueue, 50);
            }
          }
        }
      })
      .catch((err) => {
        if (retryAttempt < 1) {
          setTimeout(() => {
            runSingleUpload(taskId, file, retryAttempt + 1);
          }, 800);
        } else {
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: "error", error: err?.message || "上传异常" } : t
            )
          );
          setTimeout(pumpUploadQueue, 50);
        }
      });
  };

  // 批量入队音频文件 (多重精准排重：字节大小精确比对 + 歌名/歌手归一化比对)
  const handleEnqueueFiles = (incomingFiles: File[]) => {
    const audioList = incomingFiles.filter(isAudioFile);
    if (audioList.length === 0) return;

    const currentR2 = r2Files;
    // 构建精确大小集合、哈希集合与归一化名称集合
    const r2SizeSet = new Set(currentR2.map((f) => f.size));
    const r2HashSet = new Set(currentR2.map((f) => f.hash).filter(Boolean));
    const r2NormalizedNames = new Set(
      currentR2.map((f) =>
        f.displayName
          .replace(/[^\w\u4e00-\u9fa5]/g, "")
          .toLowerCase()
      )
    );

    const newTasks: AudioUploadTask[] = audioList.map((file) => {
      const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const baseName = file.name.replace(/\.[a-zA-Z0-9]+$/, "").trim();
      const normName = baseName.replace(/[^\w\u4e00-\u9fa5]/g, "").toLowerCase();

      // 多维精准查重：
      // 1. 精确文件大小完全一致 (Size Match，音频文件概率为 99.999% 同文件)
      // 2. 歌名/歌手清洗归一化完全一致 (Normalized Name Match)
      const isSizeMatch = r2SizeSet.has(file.size);
      const isNameMatch = normName && r2NormalizedNames.has(normName);
      const isDup = isSizeMatch || isNameMatch;

      let status: AudioUploadTask["status"] = "queued";
      let error: string | undefined;

      if (file.size > MAX_AUDIO_FILE_SIZE) {
        status = "oversized";
        error = "超出单文件 100MB 限制";
      } else if (isDup) {
        status = "duplicate";
        error = isSizeMatch ? "音廊已有相同大小音频" : "音廊已收录同名曲目";
      }

      // 后台异步进行特征哈希二次指纹校验
      if (!isDup && status === "queued") {
        computeAudioFingerprint(file)
          .then((fp) => {
            if (r2HashSet.has(fp)) {
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === id ? { ...t, status: "duplicate", error: "哈希指纹完全一致" } : t
                )
              );
            }
          })
          .catch(() => {});
      }

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status,
        error,
      };
    });

    setUploadTasks((prev) => [...newTasks, ...prev]);
    setShowUploadPanel(true);

    // 启动受控并发队列（最多 2 个并发）
    setTimeout(pumpUploadQueue, 50);
  };

  // 递归提取拖拽目录和文件
  const handleExtractDropFiles = async (dataTransfer: DataTransfer) => {
    const items = dataTransfer.items;
    if (!items || items.length === 0) {
      if (dataTransfer.files?.length) {
        handleEnqueueFiles(Array.from(dataTransfer.files));
      }
      return;
    }

    const collectedFiles: File[] = [];
    const entries: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const entry = (item as any).webkitGetAsEntry?.() || (item as any).getAsEntry?.();
        if (entry) {
          entries.push(entry);
        } else {
          const f = item.getAsFile();
          if (f && isAudioFile(f)) collectedFiles.push(f);
        }
      }
    }

    async function traverseEntry(entry: any): Promise<void> {
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file(
            (f: File) => {
              if (isAudioFile(f)) collectedFiles.push(f);
              resolve();
            },
            () => resolve()
          );
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntries = async (): Promise<any[]> => {
          return new Promise((resolve) => {
            reader.readEntries((res: any[]) => resolve(res), () => resolve([]));
          });
        };
        let batch: any[];
        do {
          batch = await readEntries();
          for (const child of batch) {
            await traverseEntry(child);
          }
        } while (batch.length > 0);
      }
    }

    for (const entry of entries) {
      await traverseEntry(entry);
    }

    if (collectedFiles.length > 0) {
      handleEnqueueFiles(collectedFiles);
    }
  };

  const handlePauseTask = (taskId: string) => {
    const target = tasksRef.current.find((t) => t.id === taskId);
    if (target?.controller) {
      target.controller.abort();
    }
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "paused" } : t))
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handleResumeTask = (taskId: string) => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "queued", error: undefined, progress: 0 } : t))
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handleCancelTask = (taskId: string) => {
    const target = tasksRef.current.find((t) => t.id === taskId);
    if (target?.controller) {
      target.controller.abort();
    }
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
    setTimeout(pumpUploadQueue, 50);
  };

  const handleStartAllUploads = () => {
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.status === "paused" || t.status === "error" || t.status === "queued"
          ? { ...t, status: "queued", error: undefined }
          : t
      )
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handlePauseAllUploads = () => {
    tasksRef.current
      .filter((t) => t.status === "uploading")
      .forEach((t) => t.controller?.abort());
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.status === "uploading" || t.status === "queued" ? { ...t, status: "paused" } : t
      )
    );
  };

  const handleRetryAllFailed = () => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.status === "error" ? { ...t, status: "queued", error: undefined, progress: 0 } : t))
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handleSkipAllDuplicates = () => {
    setUploadTasks((prev) => prev.filter((t) => t.status !== "duplicate"));
  };

  const handleClearCompletedUploads = () => {
    setUploadTasks((prev) => prev.filter((t) => t.status !== "completed"));
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
      // 同步更新播放列表中对应曲目的封面
      const updated = player.playlist.map((t) =>
        t.url.includes(file.key) ? { ...t, pic: newCoverUrl.trim() } : t
      );
      player.setPlaylist(updated);
    }
    setCoverTargetFile(null);
    setCoverInputUrl("");
  };

  // 自动为单个音廊歌曲嗅探网络高清封面
  const handleAutoFetchSingleCover = async (file: R2MusicFileItem) => {
    try {
      const q = `${file.displayName} ${file.artist || ""}`.trim();
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
    const parts = file.displayName.split("-").map((s) => s.trim());
    const artist = file.artist || (parts.length > 1 ? parts[0] : "音廊");
    const songName = parts.length > 1 ? parts.slice(1).join("-") : parts[0];
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
      const parts = file.displayName.split("-").map((s) => s.trim());
      const artist = file.artist || (parts.length > 1 ? parts[0] : "音廊");
      const songName = parts.length > 1 ? parts.slice(1).join("-") : parts[0];
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

  // 同步 OpenList
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
    player.setPlaylist(player.playlist.filter((t) => !selectedTrackIds.has(t.id)));
    setSelectedTrackIds(new Set());
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
    setSelectedTrackIds(new Set());
    setShowNewGroupInput(false);
    setNewGroupName("");
  };

  const handleAddCustomTrack = () => {
    if (!customName.trim() || !customUrl.trim()) return;
    const t: MusicTrack = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      artist: customArtist.trim() || "未知",
      url: customUrl.trim(),
      pic: customPic.trim(),
      lyric: customLyric.trim(),
      source: "custom",
      sourceName: "自定义",
      group: selectedGroupTag || "默认",
    };
    player.addTrack(t, true);
    setCustomName(""); setCustomArtist(""); setCustomUrl(""); setCustomPic(""); setCustomLyric("");
    setCustomStatus("done"); setTimeout(() => setCustomStatus("idle"), 2500);
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show">
      <Helmet><title>{`音廊 · 云端音乐资产中枢 - ${siteConfig.name}`}</title></Helmet>

      {/* 隐藏的本地音频多文件上传与文件夹上传输入框 */}
      <input
        ref={audioFilesInputRef}
        type="file"
        accept="audio/*,.mp3,.flac,.wav,.m4a,.ogg,.aac,.opus,.ape"
        multiple
        onChange={(e) => {
          if (e.target.files) handleEnqueueFiles(Array.from(e.target.files));
          if (audioFilesInputRef.current) audioFilesInputRef.current.value = "";
        }}
        className="hidden"
      />
      <input
        ref={audioFolderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browser
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          if (e.target.files) handleEnqueueFiles(Array.from(e.target.files));
          if (audioFolderInputRef.current) audioFolderInputRef.current.value = "";
        }}
        className="hidden"
      />

      {/* 1. 顶部 Header & 容量资产胶囊 (参考图 4 媒体资产相册设计) */}
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
            {/* 容量资产指标胶囊 */}
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
          {/* 上传多文件 */}
          <button
            type="button"
            onClick={() => audioFilesInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 transition flex items-center gap-1.5"
            title="支持同时选择多个音频文件上传"
          >
            <i className="ri-upload-cloud-line text-sm" />
            <span>上传文件</span>
          </button>

          {/* 上传文件夹 */}
          <button
            type="button"
            onClick={() => audioFolderInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-300 text-xs font-bold hover:border-theme hover:text-theme transition flex items-center gap-1.5"
            title="选择整个文件夹递归导入全部音频文件"
          >
            <i className="ri-folder-upload-line text-sm" />
            <span>上传文件夹</span>
          </button>

          {/* 上传任务状态胶囊 */}
          {uploadTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                uploadTasks.some((t) => t.status === "uploading")
                  ? "bg-theme text-white shadow-2xs animate-pulse"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
              title="查看上传任务详情"
            >
              <i className="ri-upload-2-line text-xs" />
              <span>
                上传任务 ({uploadTasks.filter((t) => t.status === "completed").length}/{uploadTasks.length})
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
      {settingsExpanded && (
        <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4 ani-show">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <span className="font-bold text-xs t-primary">电台运行参数</span>
            <button
              type="button"
              onClick={() => setSettingsExpanded(false)}
              className="text-neutral-400 hover:text-neutral-600 text-xs"
            >
              收起设置
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
              <div>
                <span className="font-bold block t-primary">启用前台播放器</span>
                <span className="text-[10px] text-neutral-400">悬浮迷你微光音符</span>
              </div>
              <input
                type="checkbox"
                checked={musicEnabled}
                onChange={(e) => setMusicEnabled(e.target.checked)}
                className="accent-theme cursor-pointer scale-110"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
              <div>
                <span className="font-bold block t-primary">入站自动播放</span>
                <span className="text-[10px] text-neutral-400">进站后开启流媒体</span>
              </div>
              <input
                type="checkbox"
                checked={musicAutoPlay}
                onChange={(e) => setMusicAutoPlay(e.target.checked)}
                className="accent-theme cursor-pointer scale-110"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
              <div>
                <span className="font-bold block t-primary">挂件停靠方位</span>
                <span className="text-[10px] text-neutral-400">屏幕默认边缘</span>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { id: "bottom-left", label: "左下" },
                  { id: "bottom-right", label: "右下" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMusicPosition(p.id)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition ${
                      musicPosition === p.id ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-500"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  OpenList 5T 音频目录直链路径
                </label>
                <button
                  type="button"
                  onClick={handleSyncOpenList}
                  disabled={openListSyncStatus === "syncing"}
                  className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                  {openListSyncStatus === "syncing" && <i className="ri-loader-4-line animate-spin" />}
                  {openListSyncStatus === "done" && <i className="ri-check-line" />}
                  <span>{openListSyncStatus === "syncing" ? "读取中..." : openListSyncStatus === "done" ? `已同步 ${syncCount} 首 ✓` : "扫描并同步5T音频"}</span>
                </button>
              </div>
              <input
                type="url"
                value={openlistMusicUrl}
                onChange={(e) => setOpenlistMusicUrl(e.target.value)}
                placeholder="https://openlist.yourdomain.com/5T/Music/"
                className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3 py-1.5 font-mono text-xs outline-none focus:border-theme transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                默认在线检索音源
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {GD_MUSIC_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setGdSource(s.id)}
                    className={`px-2 py-1 rounded-lg text-xs transition select-none ${
                      gdSource === s.id
                        ? "bg-theme text-white font-bold"
                        : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 核心三大视界大标签栏 (整合 Navidrome + 媒体图床统一全宽工作区) */}
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

      {/* 4. 视界 A: 音廊资产 (R2 云端资产曲库，融合图 2 Navidrome 与图 4 媒体资产相册) */}
      {activeTab === "gallery" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOverGallery(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOverGallery(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOverGallery(false);
            if (e.dataTransfer) {
              void handleExtractDropFiles(e.dataTransfer);
            }
          }}
          className={`flex flex-col gap-3.5 ani-show relative ${isDragOverGallery ? "ring-2 ring-theme/50 rounded-2xl bg-theme/5" : ""}`}
        >
          {/* 拖拽释放蒙层提示 */}
          {isDragOverGallery && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-w/80 backdrop-blur-md border-2 border-dashed border-theme ani-show pointer-events-none">
              <i className="ri-folder-music-line text-4xl text-theme animate-bounce" />
              <p className="mt-2 text-sm font-bold t-primary">松开即可导入所有音频文件与文件夹...</p>
              <p className="text-xs text-neutral-400 mt-1">自动识别音频格式 · 自动递归解析子目录 · 自动重复排重</p>
            </div>
          )}

          {/* 上传任务状态中枢面板 */}
          {(showUploadPanel || uploadTasks.length > 0) && uploadTasks.length > 0 && (
            <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3 ani-show">
              <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-theme/10 text-theme text-xs font-bold">
                    <i className="ri-upload-cloud-2-line" />
                  </span>
                  <span className="font-bold text-xs t-primary">音频上传中枢</span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    (共 {uploadTasks.length} 项 · 成功 {uploadTasks.filter((t) => t.status === "completed").length} · 失败/超限 {uploadTasks.filter((t) => t.status === "error" || t.status === "oversized").length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={handleStartAllUploads}
                    className="px-2 py-1 rounded-lg bg-theme/10 text-theme font-semibold hover:bg-theme/20 transition flex items-center gap-1 text-[11px]"
                  >
                    <i className="ri-play-fill" />
                    <span>全部开始</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePauseAllUploads}
                    className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 font-semibold hover:bg-black/10 transition flex items-center gap-1 text-[11px]"
                  >
                    <i className="ri-pause-fill" />
                    <span>全部暂停</span>
                  </button>
                  {uploadTasks.some((t) => t.status === "error") && (
                    <button
                      type="button"
                      onClick={handleRetryAllFailed}
                      className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-semibold transition flex items-center gap-1 text-[11px]"
                      title="重试所有失败项"
                    >
                      <i className="ri-restart-line" />
                      <span>重试失败 ({uploadTasks.filter((t) => t.status === "error").length})</span>
                    </button>
                  )}
                  {uploadTasks.some((t) => t.status === "duplicate") && (
                    <button
                      type="button"
                      onClick={handleSkipAllDuplicates}
                      className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-500 hover:text-neutral-700 font-semibold transition text-[11px]"
                      title="从列表中跳过已存在的歌曲"
                    >
                      跳过已存在
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearCompletedUploads}
                    className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-400 hover:text-neutral-600 font-semibold transition text-[11px]"
                  >
                    清空已完成
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUploadPanel(false)}
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 transition"
                    title="收起上传面板"
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>

              {/* 任务列表 */}
              <div className="divide-y divide-black/5 dark:divide-white/5 max-h-56 overflow-y-auto scrollbar-thin">
                {uploadTasks.map((task) => (
                  <div key={task.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium t-primary truncate max-w-sm block text-[11px]">{task.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[10px] text-neutral-400">
                            {(task.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                          {/* 状态徽标 */}
                          {task.status === "uploading" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-theme/10 text-theme animate-pulse">
                              上传中 {task.progress}%
                            </span>
                          )}
                          {task.status === "completed" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              ✓ 完成
                            </span>
                          )}
                          {task.status === "paused" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-amber-500/10 text-amber-600">
                              已暂停
                            </span>
                          )}
                          {task.status === "duplicate" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-purple-500/10 text-purple-600">
                              已存在
                            </span>
                          )}
                          {task.status === "oversized" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-500/10 text-rose-600">
                              超限 (&gt;100MB)
                            </span>
                          )}
                          {task.status === "error" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-500/10 text-rose-600" title={task.error}>
                              失败
                            </span>
                          )}
                          {task.status === "queued" && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-neutral-500/10 text-neutral-400">
                              排队中
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 进度条 */}
                      <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            task.status === "completed"
                              ? "bg-emerald-500"
                              : task.status === "error" || task.status === "oversized"
                              ? "bg-rose-500"
                              : task.status === "paused"
                              ? "bg-amber-400"
                              : "bg-theme"
                          }`}
                          style={{ width: `${task.status === "completed" ? 100 : task.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* 操作按钮区 */}
                    <div className="flex items-center gap-1 shrink-0">
                      {task.status === "uploading" && (
                        <button
                          type="button"
                          onClick={() => handlePauseTask(task.id)}
                          className="p-1 rounded text-neutral-400 hover:text-amber-500 transition"
                          title="暂停上传"
                        >
                          <i className="ri-pause-line text-sm" />
                        </button>
                      )}
                      {(task.status === "paused" || task.status === "queued") && (
                        <button
                          type="button"
                          onClick={() => handleResumeTask(task.id)}
                          className="p-1 rounded text-neutral-400 hover:text-theme transition"
                          title="开始/继续上传"
                        >
                          <i className="ri-play-line text-sm" />
                        </button>
                      )}
                      {task.status === "error" && (
                        <button
                          type="button"
                          onClick={() => handleResumeTask(task.id)}
                          className="p-1 rounded text-rose-500 hover:text-theme transition"
                          title="重新尝试上传"
                        >
                          <i className="ri-restart-line text-sm" />
                        </button>
                      )}
                      {task.status === "duplicate" && (
                        <button
                          type="button"
                          onClick={() => handleResumeTask(task.id)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition"
                          title="强制覆盖已存在文件"
                        >
                          覆盖上传
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCancelTask(task.id)}
                        className="p-1 rounded text-neutral-400 hover:text-rose-500 transition"
                        title="移除任务"
                      >
                        <i className="ri-close-line text-sm" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 搜索与工具控制栏 */}
          <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1">
              <div className="relative flex-1 max-w-md">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm" />
                <input
                  type="text"
                  value={searchR2Query}
                  onChange={(e) => setSearchR2Query(e.target.value)}
                  placeholder="搜索音廊曲名、歌手..."
                  className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] pl-9 pr-8 py-1.5 text-xs t-primary outline-none focus:border-theme"
                />
                {searchR2Query && (
                  <button
                    onClick={() => setSearchR2Query("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                )}
              </div>

              {/* 排序方式下拉 */}
              <select
                value={sortR2By}
                onChange={(e) => setSortR2By(e.target.value as any)}
                className="rounded-xl border border-black/10 bg-w px-2.5 py-1.5 text-xs t-primary outline-none dark:border-white/10 dark:bg-neutral-800 cursor-pointer"
              >
                <option value="newest">最新上传</option>
                <option value="largest">文件大小</option>
                <option value="name">歌名 A-Z</option>
              </select>

              {/* 画册图格 (Navidrome) / 紧凑列表切换按钮 */}
              <div className="flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayLayout("grid")}
                  className={`p-1.5 rounded-lg transition ${
                    displayLayout === "grid" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400 hover:text-neutral-600"
                  }`}
                  title="Navidrome 画册图格"
                >
                  <i className="ri-grid-fill text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayLayout("list")}
                  className={`p-1.5 rounded-lg transition ${
                    displayLayout === "list" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400 hover:text-neutral-600"
                  }`}
                  title="紧凑表格视图"
                >
                  <i className="ri-list-check text-sm" />
                </button>
              </div>

              {/* 多列排布密度切换器 (6列 / 8列 / 10列，按需一键自由切换) */}
              {displayLayout === "grid" && (
                <div className="flex items-center gap-0.5 rounded-xl bg-black/5 dark:bg-white/5 p-0.5 text-xs">
                  {[6, 8, 10].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setGridColumns(col as 6 | 8 | 10);
                        try {
                          localStorage.setItem("rin_music_grid_cols", String(col));
                        } catch {}
                      }}
                      className={`px-2 py-0.5 rounded-lg font-mono font-bold transition text-[11px] ${
                        gridColumns === col ? "bg-w text-theme shadow-2xs" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      }`}
                      title={`${col} 列密集排布`}
                    >
                      {col}列
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
              {/* 自动补全封面功能 */}
              <button
                type="button"
                onClick={handleAutoFetchAllMissingCovers}
                disabled={autoFetchingAllCovers}
                className="px-2.5 py-1.5 rounded-xl border border-theme/20 bg-theme/5 hover:bg-theme/10 text-theme text-xs font-semibold transition flex items-center gap-1"
                title="自动为没有封面的歌曲在网络曲库中查找并保存封面"
              >
                {autoFetchingAllCovers ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-sparkling-line" />}
                <span>{autoFetchingAllCovers ? "嗅探封面中..." : "自动补全封面"}</span>
              </button>

              {selectedR2Keys.size > 0 && (
                <button
                  type="button"
                  onClick={handleBatchImportR2Selected}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition flex items-center gap-1 shadow-2xs"
                >
                  <i className="ri-play-list-add-line" />
                  <span>批量加入列表 ({selectedR2Keys.size})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleImportAllR2ToQueue}
                disabled={r2Files.length === 0}
                className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white text-neutral-600 dark:text-neutral-300 text-xs font-bold transition flex items-center gap-1"
                title="将音廊全部曲目导入播放列表"
              >
                <i className="ri-play-list-add-line" />
                <span>全部入库</span>
              </button>
            </div>
          </div>

          {/* Navidrome 画册图格视图 (支持 6列 / 8列 / 10列 动态自由切换，四角+中心交互) */}
          {displayLayout === "grid" ? (
            <div
              className={
                gridColumns === 10
                  ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3"
                  : gridColumns === 8
                  ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3.5"
                  : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5"
              }
            >
              {/* 首格：等高虚线上传卡片 (参考图 4 `/admin/files`) */}
              <div
                onClick={() => audioFilesInputRef.current?.click()}
                className="aspect-square rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 hover:border-theme/60 bg-black/[0.015] hover:bg-theme/5 transition flex flex-col items-center justify-center gap-2 cursor-pointer p-3 text-center group select-none"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-theme/10 text-theme text-lg group-hover:scale-110 transition-transform">
                  <i className="ri-upload-cloud-line" />
                </span>
                <div>
                  <span className="font-bold text-xs t-primary block group-hover:text-theme">上传音频</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">支持 MP3/FLAC/WAV</span>
                </div>
              </div>

              {/* 歌曲画册卡片列表 (极高辨识度 Navidrome 正方形封面) */}
              {filteredR2Files.map((file) => {
                const isQueued = player.playlist.some((t) => t.url === file.url);
                const isCur = player.currentTrack?.url === file.url;
                const isPlayingThis = isCur && player.isPlaying;

                return (
                  <div
                    key={file.key}
                    className="group relative rounded-2xl bg-w border border-black/10 dark:border-white/10 p-2.5 flex flex-col hover:border-theme/40 hover:shadow-lg transition-all"
                  >
                    {/* 正方形封面区域 */}
                    <div className="aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 relative flex items-center justify-center shadow-inner select-none">
                      {file.pic ? (
                        <img
                          src={file.pic}
                          alt={file.displayName}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <VinylDiscArt isPlaying={isPlayingThis} className="h-full w-full" />
                      )}

                      {/* 悬浮半透明控制层 (四角+中心布局：左上换封面 / 右上删除 / 居中播放 / 左下入库 / 右下音质) */}
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                        {/* 顶部行：左上角更换封面，右上角删除 */}
                        <div className="flex items-center justify-between w-full">
                          {/* 左上角：更换封面 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverTargetFile(file);
                              setCoverInputUrl(file.pic || "");
                            }}
                            className="h-7 w-7 rounded-full bg-black/40 hover:bg-theme text-white backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-sm"
                            title="更换封面 (左上角)"
                          >
                            <i className="ri-image-edit-line text-xs" />
                          </button>

                          {/* 右上角：删除 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteR2PhysicalFile(file);
                            }}
                            className="h-7 w-7 rounded-full bg-black/40 hover:bg-rose-500 text-rose-300 hover:text-white backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-sm"
                            title="从音廊永久删除 (右上角)"
                          >
                            <i className="ri-delete-bin-line text-xs" />
                          </button>
                        </div>

                        {/* 居中核心：播放 / 暂停大按键 */}
                        <div className="flex items-center justify-center w-full">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPlayingThis) player.pause();
                              else {
                                handleImportR2ToQueue(file);
                                setTimeout(() => {
                                  const found = player.playlist.find((t) => t.url === file.url);
                                  if (found) player.play(found);
                                }, 60);
                              }
                            }}
                            className="h-10 w-10 rounded-full bg-theme text-white flex items-center justify-center hover:scale-115 active:scale-95 transition shadow-xl"
                            title={isPlayingThis ? "暂停" : "播放 (居中)"}
                          >
                            <i className={isPlayingThis ? "ri-pause-fill text-lg" : "ri-play-fill text-lg translate-x-0.5"} />
                          </button>
                        </div>

                        {/* 底部行：左下角入库状态，右下角音质标注 */}
                        <div className="flex items-center justify-between w-full">
                          {/* 左下角：加入播放列表 / 已入库 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImportR2ToQueue(file);
                            }}
                            className={`h-7 w-7 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-sm ${
                              isQueued ? "bg-emerald-500 text-white font-bold" : "bg-black/40 text-white hover:bg-white/30 backdrop-blur-md"
                            }`}
                            title={isQueued ? "已在播放列表中" : "加入播放列表 (左下角)"}
                          >
                            <i className={isQueued ? "ri-check-line text-xs font-bold" : "ri-add-line text-xs"} />
                          </button>

                          {/* 右下角：音质规格标注 (如 FLAC / 320K / WAV / MP3) */}
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-black uppercase backdrop-blur-md tracking-wider shadow-sm select-none ${
                              file.quality === "FLAC" || file.quality === "WAV" || file.quality === "Hi-Res"
                                ? "bg-amber-500 text-white"
                                : file.quality === "320K"
                                ? "bg-purple-600 text-white"
                                : "bg-black/50 text-white/90"
                            }`}
                            title={`规格: ${file.quality || "MP3"}`}
                          >
                            {file.quality || (file.size > 26 * 1024 * 1024 ? "FLAC" : file.size > 8 * 1024 * 1024 ? "320K" : "MP3")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 卡片下方文字信息 */}
                    <div className="mt-2.5 truncate select-none">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold t-primary block truncate flex-1">{file.displayName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingR2Key(file.key);
                            setEditingR2Name(file.displayName);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-theme transition"
                          title="重命名歌曲"
                        >
                          <i className="ri-edit-line text-xs" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-0.5">
                        <span className="truncate">{file.artist || "随心漫游"}</span>
                        <span className="font-mono">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 紧凑超级表格视图 */
            <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-w max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
                    <th className="py-2.5 px-2.5 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={selectedR2Keys.size === filteredR2Files.length && filteredR2Files.length > 0}
                        onChange={() => {
                          if (selectedR2Keys.size === filteredR2Files.length && filteredR2Files.length > 0) setSelectedR2Keys(new Set());
                          else setSelectedR2Keys(new Set(filteredR2Files.map((f) => f.key)));
                        }}
                        className="accent-theme cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-2 w-8 text-center">#</th>
                    <th className="py-2.5 px-2">曲目名称 / 歌手</th>
                    <th className="py-2.5 px-2 w-24">大小</th>
                    <th className="py-2.5 px-2 w-28">上传时间</th>
                    <th className="py-2.5 px-2 text-right pr-4 w-32">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {filteredR2Files.map((file, idx) => {
                    const isQueued = player.playlist.some((t) => t.url === file.url);
                    const isCur = player.currentTrack?.url === file.url;
                    const isPlayingThis = isCur && player.isPlaying;
                    const isSel = selectedR2Keys.has(file.key);

                    return (
                      <tr key={file.key} className={`transition ${isSel ? "bg-theme/[0.04]" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"}`}>
                        <td className="py-2 px-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={(e) => {
                              const next = new Set(selectedR2Keys);
                              if (e.target.checked) next.add(file.key);
                              else next.delete(file.key);
                              setSelectedR2Keys(next);
                            }}
                            className="accent-theme cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-neutral-400">#{idx + 1}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {file.pic ? (
                              <img src={file.pic} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
                            ) : (
                              <VinylDiscArt isPlaying={isPlayingThis} className="h-7 w-7 rounded-lg shrink-0" />
                            )}
                            {editingR2Key === file.key ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editingR2Name}
                                  onChange={(e) => setEditingR2Name(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleSaveRenameR2(file.key)}
                                  className="px-2 py-0.5 rounded border border-theme text-xs bg-w outline-none font-bold"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRenameR2(file.key)}
                                  className="px-2 py-0.5 rounded bg-theme text-white text-[10px] font-bold"
                                >
                                  保存
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingR2Key(null)}
                                  className="text-[10px] text-neutral-400"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 truncate group/title">
                                <span className="font-bold t-primary truncate max-w-sm">{file.displayName}</span>
                                {file.artist && <span className="text-[10px] text-neutral-400 truncate">- {file.artist}</span>}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingR2Key(file.key);
                                    setEditingR2Name(file.displayName);
                                  }}
                                  className="opacity-0 group-hover/title:opacity-100 text-neutral-400 hover:text-theme transition p-0.5"
                                  title="重命名显示名称"
                                >
                                  <i className="ri-edit-line text-xs" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</td>
                        <td className="py-2 px-2 font-mono text-neutral-400 text-[11px]">{file.uploaded ? new Date(file.uploaded).toLocaleDateString() : "-"}</td>
                        <td className="py-2 px-2 text-right pr-4">
                          <div className="inline-flex items-center gap-2">
                            {/* 试听 */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isPlayingThis) player.pause();
                                else {
                                  handleImportR2ToQueue(file);
                                  setTimeout(() => {
                                    const found = player.playlist.find((t) => t.url === file.url);
                                    if (found) player.play(found);
                                  }, 60);
                                }
                              }}
                              className={`p-1 rounded-md transition ${isPlayingThis ? "text-theme hover:bg-theme/10" : "text-neutral-400 hover:text-theme hover:bg-black/5"}`}
                              title={isPlayingThis ? "暂停" : "试听"}
                            >
                              <i className={isPlayingThis ? "ri-pause-fill text-sm" : "ri-play-fill text-sm"} />
                            </button>

                            {/* 入库 */}
                            <button
                              type="button"
                              onClick={() => handleImportR2ToQueue(file)}
                              className={`p-1 rounded-md transition ${isQueued ? "text-emerald-500 font-bold" : "text-neutral-400 hover:text-theme hover:bg-black/5"}`}
                              title={isQueued ? "已在播放列表中" : "加入播放列表"}
                            >
                              <i className={isQueued ? "ri-check-line text-sm" : "ri-add-line text-sm"} />
                            </button>

                            {/* 更换封面 */}
                            <button
                              type="button"
                              onClick={() => {
                                setCoverTargetFile(file);
                                setCoverInputUrl(file.pic || "");
                              }}
                              className="p-1 rounded-md text-neutral-400 hover:text-theme transition"
                              title="更换封面"
                            >
                              <i className="ri-image-edit-line text-sm" />
                            </button>

                            {/* 删除 */}
                            <button
                              type="button"
                              onClick={() => handleDeleteR2PhysicalFile(file)}
                              className="p-1 rounded-md text-neutral-400 hover:text-red-500 transition"
                              title="从 R2 永久删除"
                            >
                              <i className="ri-delete-bin-line text-sm" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. 视界 B: 播放列表 (全宽单屏超级数据表格，实装输入数字直接调序) */}
      {activeTab === "playlist" && (
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
                全部 ({player.playlist.length})
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
                onClick={handleToggleSelectAll}
                className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 transition"
              >
                全选
              </button>
              <button
                type="button"
                onClick={handleInvertSelect}
                className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 transition"
              >
                反选
              </button>
              <button
                type="button"
                onClick={handleBatchMoveToTop}
                disabled={!selectedTrackIds.size}
                className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 transition disabled:opacity-30"
                title="将已选曲目置顶至第 1 位"
              >
                置顶
              </button>
              <button
                type="button"
                onClick={handleBatchPersistR2}
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
                onClick={handleBatchDelete}
                disabled={!selectedTrackIds.size}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition flex items-center gap-1 text-xs font-semibold"
              >
                <i className="ri-delete-bin-line" />
                <span>删除</span>
              </button>
              <button
                type="button"
                onClick={() => player.clearPlaylist()}
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
                onClick={() => handleAssignGroup(newGroupName)}
                disabled={!selectedTrackIds.size || !newGroupName.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-theme text-white font-bold disabled:opacity-40 shadow-xs"
              >
                将已选项归入此组
              </button>
            </div>
          )}

          {/* 播放列表超级表格 (嵌入数字序号直接输入排序) */}
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-w max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
                  <th className="py-2.5 px-2.5 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0}
                      onChange={handleToggleSelectAll}
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
                    const isCur = player.currentTrack?.id === track.id;
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
                            onChange={(e) => {
                              const s = new Set(selectedTrackIds);
                              if (e.target.checked) s.add(track.id);
                              else s.delete(track.id);
                              setSelectedTrackIds(s);
                            }}
                            className="accent-theme cursor-pointer"
                          />
                        </td>

                        {/* 核心亮点：序号数字直接输入换位 (如将 14 改为 3 敲回车瞬间插入第 3 位，其余自动顺延) */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isCur && player.isPlaying && <span className="text-theme font-bold">▶</span>}
                            <input
                              type="number"
                              min={1}
                              max={player.playlist.length}
                              defaultValue={idx + 1}
                              key={`${track.id}_${idx}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleMoveTrackToIndex(idx, e.currentTarget.value);
                                }
                              }}
                              onBlur={(e) => {
                                handleMoveTrackToIndex(idx, e.currentTarget.value);
                              }}
                              className="w-10 text-center rounded-md bg-black/5 dark:bg-white/5 border border-transparent hover:border-theme/40 focus:border-theme focus:bg-w text-xs font-mono font-bold outline-none transition py-0.5"
                              title="输入数字后敲回车，直接调整到该序号并顺延"
                            />
                          </div>
                        </td>

                        {/* 曲目名与艺术家 */}
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {track.pic ? (
                              <img src={track.pic} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
                            ) : (
                              <VinylDiscArt
                                isPlaying={isCur && player.isPlaying}
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
                              onClick={() => handleSingleTrackPersist(track)}
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

                        {/* 操作 */}
                        <td className="py-2 px-2 text-right pr-4">
                          <div className="inline-flex items-center gap-1.5">
                            {/* 置顶 */}
                            <button
                              type="button"
                              onClick={() => handleMoveToTop(track.id)}
                              className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 transition"
                              title="置顶至第 1 位"
                            >
                              <i className="ri-vertical-align-top text-xs" />
                            </button>

                            {/* 播放/暂停 */}
                            {isCur && player.isPlaying ? (
                              <button
                                type="button"
                                onClick={() => player.pause()}
                                className="p-1 rounded-md text-theme hover:bg-theme/10 transition"
                                title="暂停"
                              >
                                <i className="ri-pause-fill text-xs" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => player.play(track)}
                                className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 transition"
                                title="播放"
                              >
                                <i className="ri-play-fill text-xs" />
                              </button>
                            )}

                            {/* 删除 */}
                            <button
                              type="button"
                              onClick={() => handleDeleteTrack(track)}
                              className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-black/5 transition"
                              title="删除"
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

          {/* 手动录入音频直链 */}
          <div className="p-3.5 rounded-2xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.01] dark:bg-white/[0.01] space-y-2 text-xs">
            <span className="font-bold text-[11px] t-primary block">手动录入音频直链 (OpenList / CDN)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="歌曲名称 (必填)"
                className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 text-xs outline-none focus:border-theme"
              />
              <input
                type="text"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                placeholder="歌手 (选填)"
                className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 text-xs outline-none focus:border-theme"
              />
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="音频直链 URL (必填)"
                className="sm:col-span-2 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 font-mono text-xs outline-none focus:border-theme"
              />
            </div>
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleAddCustomTrack}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  customStatus === "done" ? "bg-emerald-500 text-white" : "bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white"
                }`}
              >
                {customStatus === "done" ? <i className="ri-check-line" /> : <i className="ri-add-line" />}
                <span>{customStatus === "done" ? "已加入 ✓" : "添加至列表"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 视界 C: 曲库探索 (全宽搜索、流派榜单、A-Z 检索、相关度置顶) */}
      {activeTab === "explore" && (
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
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={searchMode === "album" ? "输入专辑/歌单名称快速检索..." : "输入曲名或歌手名称快速检索..."}
                className="flex-1 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3.5 py-2 text-xs t-primary outline-none focus:border-theme transition"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  disabled={isSearching || deepScanning}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-xs font-bold transition flex items-center gap-1.5 select-none"
                >
                  {isSearching ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}
                  <span>{isSearching ? "检索..." : "搜索"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeepScanAndVerify(3)}
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
                    onClick={handleImportAllVerified}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-2xs hover:bg-emerald-600 transition flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
                  >
                    <i className="ri-play-list-add-line" />
                    <span>一键全量入库 ({deepVerifiedTracks.length} 首)</span>
                  </button>
                )}
              </div>
            )}

            {/* 搜索结果列表 (已按相关度精准置顶排序) */}
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-w overflow-hidden text-xs">
              <div className="p-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between text-neutral-400">
                <span className="font-mono text-[11px]">{searchResults.length > 0 ? `${searchResults.length} 条匹配 (按相关度置顶)` : "搜索结果"}</span>
                {searchResults.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBatchCollect}
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
                    <span>点击上方歌手名或输入关键字检索</span>
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const artistStr = Array.isArray(item.artist) ? item.artist.join(" / ") : item.artist;
                    const isResolving = resolvingId === item.id;
                    const isQueued = player.playlist.some((t) => t.id === item.id || (t.name === item.name && t.artist === artistStr));

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
                            onClick={() => handleResolveAndPlay(item, true)}
                            disabled={isResolving}
                            className="px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold transition flex items-center gap-1"
                          >
                            {isResolving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-play-fill" />}
                            <span>试听</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveAndPlay(item, false)}
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
      )}

      {/* 封面修改弹窗 */}
      {coverTargetFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 ani-show">
          <div className="w-full max-w-md rounded-2xl bg-w p-5 border border-black/10 dark:border-white/10 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <h4 className="font-bold text-sm t-primary flex items-center gap-1.5">
                <i className="ri-image-edit-line text-theme" />
                <span>更换专辑封面 · {coverTargetFile.displayName}</span>
              </h4>
              <button onClick={() => setCoverTargetFile(null)} className="text-neutral-400 hover:text-neutral-600">
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-[11px] font-bold text-neutral-500">封面图片直链 URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={coverInputUrl}
                  onChange={(e) => setCoverInputUrl(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="flex-1 rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-xs outline-none focus:border-theme"
                />
                <button
                  type="button"
                  onClick={() => setIsR2MediaPickerOpen(true)}
                  className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 font-bold shrink-0 transition"
                  title="从 R2 媒体库中挑选已有的封面图片"
                >
                  媒体库
                </button>
              </div>
            </div>

            {/* 封面预览 */}
            {coverInputUrl.trim() && (
              <div className="flex items-center justify-center p-2 rounded-xl bg-black/5 dark:bg-white/5">
                <img
                  src={coverInputUrl.trim()}
                  alt="预览"
                  className="h-28 w-28 rounded-xl object-cover shadow-md"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 text-xs">
              <button
                type="button"
                onClick={() => handleAutoFetchSingleCover(coverTargetFile)}
                className="text-theme hover:underline font-bold"
              >
                自动嗅探网络封面
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCoverTargetFile(null)}
                  className="px-3 py-1.5 rounded-xl text-neutral-400 hover:bg-black/5"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCover(coverTargetFile, coverInputUrl)}
                  disabled={!coverInputUrl.trim()}
                  className="px-4 py-1.5 rounded-xl bg-theme text-white font-bold shadow-xs hover:bg-theme-hover disabled:opacity-40"
                >
                  保存并生效
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
