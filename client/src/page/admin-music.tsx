import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useMusicPlayer, DEFAULT_PRESET_TRACKS } from "../components/music-player/music-player-context";
import { VinylDiscArt } from "../components/music-player/vinyl-disc-art";
import {
  gdMusicService,
  GD_MUSIC_SOURCES,
  syncOpenListFiles,
  persistTrackToR2,
  deleteR2Track,
  fetchR2MusicFiles,
  type GdSearchResultItem,
  type R2MusicFileItem,
} from "../services/music-api";
import type { MusicTrack } from "../components/music-player/types";

// 简短中文音源格式化 (严禁英文和自动降级后缀，保持纯粹简洁)
function formatCleanSourceName(track: MusicTrack): string {
  if (track.source === "r2" || (track.url && track.url.includes("/api/blob/"))) {
    return "R2存储";
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

// 纯文本音乐流派标签 (严禁 Emoji，极简纯净风格)
const GENRE_TAGS = ["华语", "流行", "摇滚", "民谣", "电子", "爵士", "说唱", "原声", "轻音乐", "古风"];

// 热门榜单纯文本检索标签
const CHART_PRESETS = [
  { label: "热歌榜", query: "热歌榜", source: "all" },
  { label: "飙升榜", query: "飙升榜", source: "all" },
  { label: "新歌榜", query: "新歌榜", source: "all" },
  { label: "ACG原声", query: "ACG原声", source: "bilibili" },
  { label: "经典流行", query: "华语流行经典", source: "netease" },
  { label: "纯音治愈", query: "治愈纯音", source: "all" },
  { label: "深夜伴奏", query: "深夜伴奏", source: "all" },
];

interface ArtistData {
  name: string;
  initial: string;
  cat: "male" | "female" | "group";
}

// 华语男女歌手 A-Z 丰富词库 (涵盖网易云 Cat 1001 男歌手 & Cat 1002 女歌手 & Cat 1003 组合)
const ARTIST_DIRECTORY: ArtistData[] = [
  // 华语男歌手 (Cat 1001)
  { name: "阿杜", initial: "A", cat: "male" }, { name: "阿云嘎", initial: "A", cat: "male" }, { name: "艾热", initial: "A", cat: "male" }, { name: "安琥", initial: "A", cat: "male" },
  { name: "白敬亭", initial: "B", cat: "male" }, { name: "宝石Gem", initial: "B", cat: "male" }, { name: "白举纲", initial: "B", cat: "male" }, { name: "毕书尽", initial: "B", cat: "male" },
  { name: "陈奕迅", initial: "C", cat: "male" }, { name: "蔡徐坤", initial: "C", cat: "male" }, { name: "陈小春", initial: "C", cat: "male" }, { name: "陈楚生", initial: "C", cat: "male" }, { name: "崔健", initial: "C", cat: "male" }, { name: "常石磊", initial: "C", cat: "male" }, { name: "曹格", initial: "C", cat: "male" }, { name: "陈鸿宇", initial: "C", cat: "male" },
  { name: "刀郎", initial: "D", cat: "male" }, { name: "大张伟", initial: "D", cat: "male" }, { name: "戴荃", initial: "D", cat: "male" }, { name: "董又霖", initial: "D", cat: "male" }, { name: "杜德伟", initial: "D", cat: "male" },
  { name: "贰佰", initial: "E", cat: "male" },
  { name: "费玉清", initial: "F", cat: "male" }, { name: "方大同", initial: "F", cat: "male" }, { name: "范逸臣", initial: "F", cat: "male" }, { name: "付辛博", initial: "F", cat: "male" },
  { name: "光良", initial: "G", cat: "male" }, { name: "古巨基", initial: "G", cat: "male" }, { name: "郭富城", initial: "G", cat: "male" }, { name: "隔壁老樊", initial: "G", cat: "male" }, { name: "郭顶", initial: "G", cat: "male" }, { name: "高进", initial: "G", cat: "male" },
  { name: "华晨宇", initial: "H", cat: "male" }, { name: "胡夏", initial: "H", cat: "male" }, { name: "黄家驹", initial: "H", cat: "male" }, { name: "胡彦斌", initial: "H", cat: "male" }, { name: "海来阿木", initial: "H", cat: "male" }, { name: "黄子韬", initial: "H", cat: "male" }, { name: "黄渤", initial: "H", cat: "male" }, { name: "郝云", initial: "H", cat: "male" },
  { name: "焦迈奇", initial: "J", cat: "male" }, { name: "姜云升", initial: "J", cat: "male" }, { name: "金志文", initial: "J", cat: "male" }, { name: "井柏然", initial: "J", cat: "male" },
  { name: "柯受良", initial: "K", cat: "male" },
  { name: "林俊杰", initial: "L", cat: "male" }, { name: "李荣浩", initial: "L", cat: "male" }, { name: "刘德华", initial: "L", cat: "male" }, { name: "李克勤", initial: "L", cat: "male" }, { name: "梁博", initial: "L", cat: "male" }, { name: "鹿晗", initial: "L", cat: "male" }, { name: "罗大佑", initial: "L", cat: "male" }, { name: "李宗盛", initial: "L", cat: "male" }, { name: "柳爽", initial: "L", cat: "male" }, { name: "林宥嘉", initial: "L", cat: "male" }, { name: "卢广仲", initial: "L", cat: "male" },
  { name: "毛不易", initial: "M", cat: "male" }, { name: "马頔", initial: "M", cat: "male" }, { name: "满舒克", initial: "M", cat: "male" }, { name: "马思唯", initial: "M", cat: "male" },
  { name: "南征北战", initial: "N", cat: "male" },
  { name: "欧豪", initial: "O", cat: "male" },
  { name: "潘玮柏", initial: "P", cat: "male" }, { name: "朴树", initial: "P", cat: "male" }, { name: "庞龙", initial: "P", cat: "male" },
  { name: "齐秦", initial: "Q", cat: "male" }, { name: "七叔", initial: "Q", cat: "male" },
  { name: "任贤齐", initial: "R", cat: "male" },
  { name: "薛之谦", initial: "S", cat: "male" }, { name: "宋冬野", initial: "S", cat: "male" }, { name: "沈以诚", initial: "S", cat: "male" }, { name: "孙楠", initial: "S", cat: "male" }, { name: "沙宝亮", initial: "S", cat: "male" },
  { name: "陶喆", initial: "T", cat: "male" }, { name: "谭咏麟", initial: "T", cat: "male" }, { name: "屠洪刚", initial: "T", cat: "male" },
  { name: "汪苏泷", initial: "W", cat: "male" }, { name: "王力宏", initial: "W", cat: "male" }, { name: "伍佰", initial: "W", cat: "male" }, { name: "吴青峰", initial: "W", cat: "male" }, { name: "汪峰", initial: "W", cat: "male" }, { name: "王嘉尔", initial: "W", cat: "male" }, { name: "魏晨", initial: "W", cat: "male" }, { name: "王以太", initial: "W", cat: "male" },
  { name: "许嵩", initial: "X", cat: "male" }, { name: "萧敬腾", initial: "X", cat: "male" }, { name: "许巍", initial: "X", cat: "male" }, { name: "谢霆锋", initial: "X", cat: "male" }, { name: "小鬼", initial: "X", cat: "male" }, { name: "徐良", initial: "X", cat: "male" },
  { name: "杨宗纬", initial: "Y", cat: "male" }, { name: "尤长靖", initial: "Y", cat: "male" }, { name: "易烊千玺", initial: "Y", cat: "male" }, { name: "严浩翔", initial: "Y", cat: "male" },
  { name: "周杰伦", initial: "Z", cat: "male" }, { name: "张学友", initial: "Z", cat: "male" }, { name: "张杰", initial: "Z", cat: "male" }, { name: "赵雷", initial: "Z", cat: "male" }, { name: "周深", initial: "Z", cat: "male" }, { name: "张震岳", initial: "Z", cat: "male" }, { name: "张信哲", initial: "Z", cat: "male" }, { name: "张国荣", initial: "Z", cat: "male" }, { name: "张敬轩", initial: "Z", cat: "male" }, { name: "郑智化", initial: "Z", cat: "male" }, { name: "郑钧", initial: "Z", cat: "male" }, { name: "张宇", initial: "Z", cat: "male" },

  // 华语女歌手 (Cat 1002)
  { name: "阿桑", initial: "A", cat: "female" }, { name: "阿兰", initial: "A", cat: "female" },
  { name: "白安", initial: "B", cat: "female" }, { name: "本兮", initial: "B", cat: "female" },
  { name: "蔡依林", initial: "C", cat: "female" }, { name: "陈绮贞", initial: "C", cat: "female" }, { name: "蔡健雅", initial: "C", cat: "female" }, { name: "陈粒", initial: "C", cat: "female" }, { name: "程响", initial: "C", cat: "female" }, { name: "崔子格", initial: "C", cat: "female" }, { name: "蔡琴", initial: "C", cat: "female" }, { name: "陈慧娴", initial: "C", cat: "female" },
  { name: "邓紫棋", initial: "D", cat: "female" }, { name: "戴佩妮", initial: "D", cat: "female" }, { name: "丁当", initial: "D", cat: "female" }, { name: "戴爱玲", initial: "D", cat: "female" },
  { name: "冯提莫", initial: "F", cat: "female" }, { name: "傅菁", initial: "F", cat: "female" }, { name: "范玮琪", initial: "F", cat: "female" },
  { name: "郭静", initial: "G", cat: "female" }, { name: "关晓彤", initial: "G", cat: "female" }, { name: "龚琳娜", initial: "G", cat: "female" },
  { name: "田馥甄", initial: "H", cat: "female" }, { name: "黄丽玲", initial: "H", cat: "female" }, { name: "韩红", initial: "H", cat: "female" }, { name: "黄雅莉", initial: "H", cat: "female" }, { name: "黄霄雲", initial: "H", cat: "female" }, { name: "黄龄", initial: "H", cat: "female" },
  { name: "金海心", initial: "J", cat: "female" }, { name: "江语晨", initial: "J", cat: "female" }, { name: "吉克隽逸", initial: "J", cat: "female" }, { name: "鞠婧祎", initial: "J", cat: "female" }, { name: "金莎", initial: "J", cat: "female" },
  { name: "侃侃", initial: "K", cat: "female" },
  { name: "梁静茹", initial: "L", cat: "female" }, { name: "李宇春", initial: "L", cat: "female" }, { name: "刘若英", initial: "L", cat: "female" }, { name: "蓝又时", initial: "L", cat: "female" }, { name: "刘惜君", initial: "L", cat: "female" }, { name: "李玟", initial: "L", cat: "female" }, { name: "林忆莲", initial: "L", cat: "female" }, { name: "李玲玉", initial: "L", cat: "female" },
  { name: "莫文蔚", initial: "M", cat: "female" }, { name: "孟慧圆", initial: "M", cat: "female" }, { name: "毛阿敏", initial: "M", cat: "female" }, { name: "梅艳芳", initial: "M", cat: "female" },
  { name: "那英", initial: "N", cat: "female" },
  { name: "欧阳娜娜", initial: "O", cat: "female" },
  { name: "彭佳慧", initial: "P", cat: "female" },
  { name: "曲婉婷", initial: "Q", cat: "female" }, { name: "齐豫", initial: "Q", cat: "female" }, { name: "戚薇", initial: "Q", cat: "female" },
  { name: "容祖儿", initial: "R", cat: "female" },
  { name: "孙燕姿", initial: "S", cat: "female" }, { name: "单依纯", initial: "S", cat: "female" }, { name: "尚雯婕", initial: "S", cat: "female" }, { name: "萨顶顶", initial: "S", cat: "female" }, { name: "苏运莹", initial: "S", cat: "female" },
  { name: "谭维维", initial: "T", cat: "female" }, { name: "陶晶莹", initial: "T", cat: "female" },
  { name: "王菲", initial: "W", cat: "female" }, { name: "王心凌", initial: "W", cat: "female" }, { name: "万芳", initial: "W", cat: "female" }, { name: "温岚", initial: "W", cat: "female" }, { name: "卫兰", initial: "W", cat: "female" },
  { name: "徐佳莹", initial: "X", cat: "female" }, { name: "萧亚轩", initial: "X", cat: "female" }, { name: "弦子", initial: "X", cat: "female" }, { name: "希林娜依·高", initial: "X", cat: "female" }, { name: "谢安琪", initial: "X", cat: "female" }, { name: "辛晓琪", initial: "X", cat: "female" },
  { name: "郁可唯", initial: "Y", cat: "female" }, { name: "杨丞琳", initial: "Y", cat: "female" }, { name: "袁娅维", initial: "Y", cat: "female" }, { name: "叶炫清", initial: "Y", cat: "female" }, { name: "叶倩文", initial: "Y", cat: "female" },
  { name: "张韶涵", initial: "Z", cat: "female" }, { name: "张靓颖", initial: "Z", cat: "female" }, { name: "周笔畅", initial: "Z", cat: "female" }, { name: "庄心妍", initial: "Z", cat: "female" }, { name: "张碧晨", initial: "Z", cat: "female" },

  // 华语组合 (Cat 1003)
  { name: "五月天", initial: "W", cat: "group" }, { name: "告五人", initial: "G", cat: "group" }, { name: "痛仰乐队", initial: "T", cat: "group" }, { name: "逃跑计划", initial: "T", cat: "group" }, { name: "房东的猫", initial: "F", cat: "group" }, { name: "万能青年旅店", initial: "W", cat: "group" }, { name: "新裤子", initial: "X", cat: "group" }, { name: "草东没有派对", initial: "C", cat: "group" }, { name: "动力火车", initial: "D", cat: "group" }, { name: "羽泉", initial: "Y", cat: "group" }, { name: "S.H.E", initial: "S", cat: "group" }, { name: "F.I.R.飞儿乐团", initial: "F", cat: "group" },
];

const ALPHABET = [
  "全部", "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "W", "X", "Y", "Z",
];

export function AdminMusicPage() {
  const siteConfig = useSiteConfig();
  const player = useMusicPlayer();

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [batchStatus, setBatchStatus] = useState<"idle" | "batching" | "done">("idle");
  const [customStatus, setCustomStatus] = useState<"idle" | "done">("idle");
  const [openListSyncStatus, setOpenListSyncStatus] = useState<"idle" | "syncing" | "done">("idle");
  const [syncCount, setSyncCount] = useState<number>(0);
  const [autoPersistR2, setAutoPersistR2] = useState<boolean>(true);
  const [persistR2Status, setPersistR2Status] = useState<"idle" | "saving" | "done">("idle");

  // 右侧视图模式：播放队列 或 R2 云端存储桶曲库 (Navidrome 风格)
  const [rightViewMode, setRightViewMode] = useState<"queue" | "r2">("queue");
  const [r2Files, setR2Files] = useState<R2MusicFileItem[]>([]);
  const [loadingR2, setLoadingR2] = useState<boolean>(false);

  // 播放队列行拖拽排序状态
  const [draggedTrackId, setDraggedTrackId] = useState<string | number | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | number | null>(null);
  const [persistingTrackId, setPersistingTrackId] = useState<string | number | null>(null);

  const [unplayableIds, setUnplayableIds] = useState<Set<string | number>>(new Set());
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string | number>>(new Set());
  const [playlistFilterMode, setPlaylistFilterMode] = useState<"all" | "group" | "artist" | "album">("all");
  const [selectedGroupTag, setSelectedGroupTag] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [showNewGroupInput, setShowNewGroupInput] = useState<boolean>(false);

  const [settingsExpanded, setSettingsExpanded] = useState<boolean>(false);

  // 1. 全局配置
  const [musicEnabled, setMusicEnabled] = useState(() => siteConfig.musicEnabled);
  const [musicAutoPlay, setMusicAutoPlay] = useState(() => siteConfig.musicAutoPlay);
  const [musicPosition, setMusicPosition] = useState(() => siteConfig.musicPosition || "bottom-right");
  const [musicSourceType] = useState(() => siteConfig.musicSourceType || "gdstudio");
  const [gdApi] = useState(() => siteConfig.musicGdApi || "https://music-api.gdstudio.xyz/api.php");
  const [gdSource, setGdSource] = useState(() => siteConfig.musicGdSource || "all");
  const [openlistMusicUrl, setOpenlistMusicUrl] = useState(() => siteConfig.musicOpenlistUrl || "");

  // 2. 搜索检索
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchMode, setSearchMode] = useState<"song" | "album">("song");
  const [selectedInitial, setSelectedInitial] = useState("全部");
  const [selectedArtistCat, setSelectedArtistCat] = useState<"all" | "male" | "female" | "group">("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GdSearchResultItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string | number | null>(null);

  // 3. 手动录入
  const [customName, setCustomName] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customPic, setCustomPic] = useState("");
  const [customLyric, setCustomLyric] = useState("");

  // 深度扫描与自动排除受限状态
  const [deepScanning, setDeepScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ totalFound: number; verified: number; excluded: number } | null>(null);
  const [deepVerifiedTracks, setDeepVerifiedTracks] = useState<MusicTrack[]>([]);

  // 歌手过滤
  // 自动在加载时读取 R2 存储桶文件列表
  useEffect(() => {
    loadR2Files();
  }, []);

  const filteredArtists = useMemo(() => ARTIST_DIRECTORY.filter((a) => {
    const matchCat = selectedArtistCat === "all" || a.cat === selectedArtistCat;
    const matchInitial = selectedInitial === "全部" || a.initial === selectedInitial;
    return matchCat && matchInitial;
  }), [selectedArtistCat, selectedInitial]);

  // 自定义分组统计
  const customGroups = useMemo(() => {
    const map = new Map<string, number>();
    player.playlist.forEach((t) => {
      const g = t.group || "默认";
      map.set(g, (map.get(g) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [player.playlist]);

  // 歌手统计
  const artistGroups = useMemo(() => {
    const map = new Map<string, number>();
    player.playlist.forEach((t) => map.set(t.artist || "未知", (map.get(t.artist || "未知") || 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [player.playlist]);

  // 专辑统计
  const albumGroups = useMemo(() => {
    const map = new Map<string, number>();
    player.playlist.forEach((t) => map.set(t.album || "单曲", (map.get(t.album || "单曲") || 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [player.playlist]);

  // 当前展示队列
  const displayedPlaylist = useMemo(() => {
    if (playlistFilterMode === "all" || !selectedGroupTag) return player.playlist;
    if (playlistFilterMode === "group") return player.playlist.filter((t) => (t.group || "默认") === selectedGroupTag);
    if (playlistFilterMode === "artist") return player.playlist.filter((t) => (t.artist || "未知") === selectedGroupTag);
    if (playlistFilterMode === "album") return player.playlist.filter((t) => (t.album || "单曲") === selectedGroupTag);
    return player.playlist;
  }, [player.playlist, playlistFilterMode, selectedGroupTag]);

  // 保存全部配置
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

  // 搜索曲目 (支持全网聚合并发)
  const handleSearch = async (kwOverride?: string, srcOverride?: string) => {
    const kw = (kwOverride ?? searchKeyword).trim();
    if (!kw) return;
    setIsSearching(true);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const src = srcOverride ?? gdSource;
      const finalSource = searchMode === "album" && src !== "all" ? `${src}_album` : src;
      setSearchResults(await gdMusicService.search(kw, finalSource, 1, 25));
    } catch (e) {
      console.warn("Search error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // 试听或收录 (带自动跨音源降级兜底与 R2 永久转存)
  const handleResolveAndPlay = async (item: GdSearchResultItem, playNow = true) => {
    setResolvingId(item.id);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const { track } = await gdMusicService.resolveTrackWithFallback(item, 320);
      if (!track || !track.url) {
        setUnplayableIds((prev) => new Set(prev).add(item.id));
        return;
      }

      // 如果开启了自动转存至 R2 对象存储桶，下载并生成永久直链
      if (autoPersistR2 && track.url && !track.url.includes("/api/blob/")) {
        const permanentUrl = await persistTrackToR2({
          url: track.url,
          trackId: track.id,
          name: `${track.artist} - ${track.name}`,
        });
        if (permanentUrl) {
          track.url = permanentUrl;
          track.source = "r2";
          track.sourceName = "R2永久";
        }
      }

      player.addTrack(track, playNow);
    } catch {
      setUnplayableIds((prev) => new Set(prev).add(item.id));
    } finally {
      setResolvingId(null);
    }
  };

  // 一键全收录当前结果 (支持 R2 自动固化)
  const handleBatchCollect = async () => {
    if (!searchResults.length) return;
    setBatchStatus("batching");
    gdMusicService.setEndpoint(gdApi.trim());
    for (const item of searchResults.slice(0, 8)) {
      try {
        const { track } = await gdMusicService.resolveTrackWithFallback(item, 320);
        if (track?.url) {
          if (autoPersistR2 && !track.url.includes("/api/blob/")) {
            const r2Url = await persistTrackToR2({
              url: track.url,
              trackId: track.id,
              name: `${track.artist} - ${track.name}`,
            });
            if (r2Url) {
              track.url = r2Url;
              track.source = "r2";
              track.sourceName = "R2永久";
            }
          }
          player.addTrack(track, false);
        }
      } catch {}
    }
    setBatchStatus("done");
    setTimeout(() => setBatchStatus("idle"), 2500);
  };

  // 一键将播放队列中所有非 R2 的动态外链歌曲全部下载转存至 R2 对象存储桶
  const handleBatchPersistR2 = async () => {
    const list = [...player.playlist];
    const targets = list.filter((t) => t.source !== "r2" && !t.url.includes("/api/blob/"));
    if (targets.length === 0) return;

    setPersistR2Status("saving");
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (t.source !== "r2" && !t.url.includes("/api/blob/")) {
        const r2Url = await persistTrackToR2({
          url: t.url,
          trackId: t.id,
          name: `${t.artist} - ${t.name}`,
        });
        if (r2Url) {
          list[i] = {
            ...t,
            url: r2Url,
            source: "r2",
            sourceName: "R2永久",
          };
        }
      }
    }

    player.setPlaylist(list);
    setPersistR2Status("done");
    setTimeout(() => setPersistR2Status("idle"), 2500);

    // 自动保存配置
    try {
      await client.config.update("client", {
        "music.playlist": JSON.stringify(list),
      });
    } catch {}
  };

  // 深度翻页扫描并自动排除受限曲目 (检索多页并逐一探测音频可用性)
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
    } catch (e) {
      console.warn("Deep scan failed:", e);
    } finally {
      setDeepScanning(false);
    }
  };

  // 一键将所有已验证 100% 可播的曲目全量入库
  const handleImportAllVerified = () => {
    if (deepVerifiedTracks.length === 0) return;
    player.setPlaylist([...player.playlist, ...deepVerifiedTracks]);
    setDeepVerifiedTracks([]);
    setBatchStatus("done");
    setTimeout(() => setBatchStatus("idle"), 2500);
  };

  // 一键同步 OpenList 5T 音频目录文件
  const handleSyncOpenList = async () => {
    const targetUrl = openlistMusicUrl.trim() || siteConfig.openlistWorkerUrl;
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

  // 批量操作 (全选/反选/删除/移动)
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
    const toDelete = player.playlist.filter((t) => selectedTrackIds.has(t.id));
    for (const t of toDelete) {
      if (t.source === "r2" || t.url.includes("/api/blob/")) {
        const parts = t.url.split("/api/blob/");
        const storageKey = parts.length > 1 ? decodeURIComponent(parts[1]) : "";
        if (storageKey) {
          deleteR2Track(storageKey).catch(() => {});
        }
      }
    }
    player.setPlaylist(player.playlist.filter((t) => !selectedTrackIds.has(t.id)));
    setSelectedTrackIds(new Set());
  };

  // 单曲手动转存至 R2
  const handleSingleTrackPersist = async (track: MusicTrack) => {
    if (track.source === "r2" || track.url.includes("/api/blob/music/")) return;
    setPersistingTrackId(track.id);
    try {
      const permanentUrl = await persistTrackToR2({
        url: track.url,
        trackId: track.id,
        name: `${track.artist} - ${track.name}`,
      });
      if (permanentUrl) {
        const updated = player.playlist.map((t) =>
          t.id === track.id ? { ...t, url: permanentUrl, source: "r2", sourceName: "R2已有" } : t
        );
        player.setPlaylist(updated);
        try {
          await client.config.update("client", { "music.playlist": JSON.stringify(updated) });
        } catch {}
      }
    } catch (e) {
      console.warn("Single persist failed:", e);
    } finally {
      setPersistingTrackId(null);
    }
  };

  // 播放队列删除单曲 (同步清理 R2 物理文件)
  const handleDeleteTrack = async (track: MusicTrack) => {
    if (track.source === "r2" || track.url.includes("/api/blob/")) {
      const parts = track.url.split("/api/blob/");
      const storageKey = parts.length > 1 ? decodeURIComponent(parts[1]) : "";
      if (storageKey) {
        deleteR2Track(storageKey).catch(() => {});
      }
    }
    player.removeTrack(track.id);
  };

  // 播放队列行拖拽排序手柄 (=) 换位
  const handlePlaylistRowDrop = (targetId: string | number) => {
    if (!draggedTrackId || draggedTrackId === targetId) {
      setDraggedTrackId(null);
      setDragOverTrackId(null);
      return;
    }
    const list = [...player.playlist];
    const fromIdx = list.findIndex((t) => t.id === draggedTrackId);
    const toIdx = list.findIndex((t) => t.id === targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      player.setPlaylist(list);
    }
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  };

  // 加载 R2 云端存储桶音乐文件列表
  const loadR2Files = async () => {
    setLoadingR2(true);
    try {
      const files = await fetchR2MusicFiles();
      setR2Files(files);
    } catch {
      setR2Files([]);
    } finally {
      setLoadingR2(false);
    }
  };

  // 从 R2 物理删除文件
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

  // 将 R2 文件单首或全部导入播放队列
  const handleImportR2ToQueue = (file: R2MusicFileItem) => {
    const parts = file.displayName.split("-").map((s) => s.trim());
    const artist = parts.length > 1 ? parts[0] : "R2曲库";
    const songName = parts.length > 1 ? parts.slice(1).join("-") : parts[0];
    const track: MusicTrack = {
      id: `r2_${file.key}`,
      name: songName,
      artist,
      album: "R2对象存储",
      url: file.url,
      source: "r2",
      sourceName: "R2已有",
      group: "R2曲库",
    };
    player.addTrack(track, false);
  };

  const handleImportAllR2ToQueue = () => {
    if (r2Files.length === 0) return;
    const newTracks: MusicTrack[] = r2Files.map((file) => {
      const parts = file.displayName.split("-").map((s) => s.trim());
      const artist = parts.length > 1 ? parts[0] : "R2曲库";
      const songName = parts.length > 1 ? parts.slice(1).join("-") : parts[0];
      return {
        id: `r2_${file.key}`,
        name: songName,
        artist,
        album: "R2对象存储",
        url: file.url,
        source: "r2",
        sourceName: "R2已有",
        group: "R2曲库",
      };
    });
    player.setPlaylist([...player.playlist, ...newTracks]);
  };
  const handleBatchMove = (dir: "up" | "down") => {
    if (!selectedTrackIds.size) return;
    const list = [...player.playlist];
    if (dir === "up") {
      for (let i = 1; i < list.length; i++) {
        if (selectedTrackIds.has(list[i].id) && !selectedTrackIds.has(list[i - 1].id)) {
          [list[i], list[i - 1]] = [list[i - 1], list[i]];
        }
      }
    } else {
      for (let i = list.length - 2; i >= 0; i--) {
        if (selectedTrackIds.has(list[i].id) && !selectedTrackIds.has(list[i + 1].id)) {
          [list[i], list[i + 1]] = [list[i + 1], list[i]];
        }
      }
    }
    player.setPlaylist(list);
  };

  // 批量修改选中毒曲的分组
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
      <Helmet><title>{`全站音乐电台 - ${siteConfig.name}`}</title></Helmet>

      {/* 顶部运行状态与保存条 */}
      <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme/10 text-theme text-xl shadow-2xs">
            <i className="ri-disc-line" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold t-primary">全站音乐电台</h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                musicEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
              }`}>
                {musicEnabled ? "已启用" : "未开启"}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">SPA 跨页面无缝播放 · 左右工作台流式联动</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-1"
          >
            <i className="ri-settings-4-line text-xs" />
            <span>{settingsExpanded ? "收起设置" : "电台设置"}</span>
            <i className={`text-xs ${settingsExpanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}`} />
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60 ${
              saveStatus === "saved"
                ? "bg-emerald-500 text-white"
                : saveStatus === "error"
                ? "bg-rose-500 text-white"
                : "bg-theme text-white hover:bg-theme-hover"
            }`}
          >
            {saveStatus === "saving" && <i className="ri-loader-4-line animate-spin" />}
            {saveStatus === "saved" && <i className="ri-check-line" />}
            <span>{saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存 ✓" : saveStatus === "error" ? "失败重试" : "保存配置"}</span>
          </button>
        </div>
      </div>

      {/* 折叠设置分区 (包含 OpenList 自动扫描同步与全局端点) */}
      {settingsExpanded && (
        <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5 ani-show">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <span className="font-bold text-xs t-primary">电台运行参数与 5T 网盘自动同步</span>
            <span className="text-[11px] text-neutral-400">修改后点击右上角保存生效</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="font-bold block t-primary">启用播放器</span>
                <span className="text-[10px] text-neutral-400">前台悬浮唱片挂件</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={musicEnabled}
                onClick={() => setMusicEnabled(!musicEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  musicEnabled ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                  musicEnabled ? "translate-x-4.5" : "translate-x-1"
                }`} />
              </button>
            </div>

            <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="font-bold block t-primary">自动播放</span>
                <span className="text-[10px] text-neutral-400">受浏览器策略限制</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={musicAutoPlay}
                onClick={() => setMusicAutoPlay(!musicAutoPlay)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  musicAutoPlay ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${
                  musicAutoPlay ? "translate-x-4.5" : "translate-x-1"
                }`} />
              </button>
            </div>

            <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="font-bold block t-primary">挂件方位</span>
                <span className="text-[10px] text-neutral-400">停靠屏幕边缘</span>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { id: "bottom-right", label: "右下" },
                  { id: "bottom-left", label: "左下" },
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
                  <span>{openListSyncStatus === "syncing" ? "正在读取云盘..." : openListSyncStatus === "done" ? `已同步 ${syncCount} 首音频 ✓` : "自动扫描并同步 5T 音频"}</span>
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
                默认音源平台
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

      {/* 核心工作台：左右高密双栏布局 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">

        {/* 左栏: 曲库检索与发现 */}
        <div className="xl:col-span-6 p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <i className="ri-search-line text-theme" />
              <h3 className="font-bold text-xs t-primary">曲库检索</h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 cursor-pointer select-none text-[11px] text-neutral-500 hover:text-theme transition">
                <input
                  type="checkbox"
                  checked={autoPersistR2}
                  onChange={(e) => setAutoPersistR2(e.target.checked)}
                  className="accent-theme cursor-pointer"
                />
                <span>自动转存R2</span>
              </label>

              <div className="flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSearchMode("song")}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition ${
                    searchMode === "song" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                  }`}
                >
                  单曲
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("album")}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition ${
                    searchMode === "album" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                  }`}
                >
                  专辑歌单
                </button>
              </div>
            </div>
          </div>

          {/* 纯文本流派 */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
            <span className="font-semibold text-[11px] text-neutral-400 shrink-0">流派：</span>
            {GENRE_TAGS.map((g, i) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword(g);
                    void handleSearch(g);
                  }}
                  className="hover:text-theme transition font-medium"
                >
                  {g}
                </button>
                {i < GENRE_TAGS.length - 1 && <span className="opacity-30">|</span>}
              </span>
            ))}
          </div>

          {/* 纯文本榜单 */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap border-t border-black/5 dark:border-white/5 pt-1.5">
            <span className="font-semibold text-[11px] text-neutral-400 shrink-0">榜单：</span>
            {CHART_PRESETS.map((c, i) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword(c.query);
                    setGdSource(c.source);
                    void handleSearch(c.query, c.source);
                  }}
                  className="hover:text-theme transition font-medium"
                >
                  {c.label}
                </button>
                {i < CHART_PRESETS.length - 1 && <span className="opacity-30">|</span>}
              </span>
            ))}
          </div>

          {/* 华语男女歌手 A-Z 快速检索 (Cat 1001 & Cat 1002 完整词库) */}
          <div className="p-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[11px] t-primary">歌手 A-Z 检索</span>
              <div className="flex items-center gap-1">
                {[
                  { id: "all", label: "全部" },
                  { id: "male", label: "男歌手" },
                  { id: "female", label: "女歌手" },
                  { id: "group", label: "组合" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedArtistCat(c.id as any)}
                    className={`px-2 py-0.5 rounded-md text-[11px] transition ${
                      selectedArtistCat === c.id
                        ? "bg-theme text-white font-bold"
                        : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-wrap text-[11px] font-mono">
              {ALPHABET.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setSelectedInitial(l)}
                  className={`px-1.5 py-0.2 rounded transition ${
                    selectedInitial === l ? "bg-theme text-white font-bold scale-105" : "text-neutral-400 hover:text-theme"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1 max-h-24 overflow-y-auto">
              {filteredArtists.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => {
                    setSearchKeyword(a.name);
                    void handleSearch(a.name);
                  }}
                  className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 text-xs hover:bg-theme hover:text-white transition select-none"
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          {/* 搜索框与深度扫描触发 */}
          <div className="flex flex-col sm:flex-row gap-2 text-xs">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchMode === "album" ? "输入专辑/歌单名称..." : "输入曲名、歌手或点击上方快捷检索..."}
              className="flex-1 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-2 text-xs t-primary outline-none focus:border-theme transition"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={isSearching || deepScanning}
                className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-xs font-bold transition flex items-center gap-1 select-none"
              >
                {isSearching ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}
                <span>{isSearching ? "检索..." : "搜索"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeepScanAndVerify(3)}
                disabled={deepScanning || isSearching}
                className="px-3.5 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1 select-none"
                title="连续翻页检索并逐首探测可用性，自动剔除全部受限/失效曲目"
              >
                {deepScanning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-shield-check-line" />}
                <span>{deepScanning ? "嗅探中..." : "深度嗅探"}</span>
              </button>
            </div>
          </div>

          {/* 深度扫描进度与一键导入栏 */}
          {scanProgress && (
            <div className="p-2.5 rounded-xl bg-theme/5 border border-theme/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ani-show">
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
                  className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-bold text-xs shadow-2xs hover:bg-emerald-600 transition flex items-center gap-1 shrink-0 self-end sm:self-auto"
                >
                  <i className="ri-play-list-add-line" />
                  <span>一键全量入库 ({deepVerifiedTracks.length} 首)</span>
                </button>
              )}
            </div>
          )}

          {/* 搜索结果 */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-w overflow-hidden text-xs">
            <div className="p-2 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between text-neutral-400">
              <span className="font-mono text-[11px]">{searchResults.length > 0 ? `${searchResults.length} 条匹配 (全网聚合)` : "搜索结果"}</span>
              {searchResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchCollect}
                  disabled={batchStatus === "batching"}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    batchStatus === "done" ? "bg-emerald-500 text-white" : "bg-theme/10 hover:bg-theme/20 text-theme"
                  }`}
                >
                  {batchStatus === "batching" && <i className="ri-loader-4-line animate-spin" />}
                  {batchStatus === "done" && <i className="ri-check-line" />}
                  <span>{batchStatus === "batching" ? "收录中..." : batchStatus === "done" ? "已收录 ✓" : "批量收录前8首"}</span>
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
              {searchResults.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 flex flex-col items-center justify-center gap-1">
                  <i className="ri-music-2-line text-2xl opacity-30" />
                  <p className="text-xs">点击歌手名或输入关键字检索</p>
                </div>
              ) : (
                searchResults.map((item) => {
                  const isResolving = resolvingId === item.id;
                  const artistStr = Array.isArray(item.artist) ? item.artist.join(" / ") : item.artist;
                  const isCollected = player.playlist.some(
                    (p) => String(p.id).includes(String(item.id)) || (p.name === item.name && p.artist === artistStr)
                  );
                  const isPlayingThis = player.isPlaying && player.currentTrack?.name === item.name;

                  return (
                    <div
                      key={`${item.source}_${item.id}`}
                      className={`p-2 flex items-center justify-between gap-2 transition ${
                        isCollected ? "bg-emerald-500/[0.02]" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs ${
                          isCollected ? "bg-emerald-500/10 text-emerald-600" : "bg-theme/10 text-theme"
                        }`}>
                          <i className="ri-music-line text-[11px]" />
                        </span>
                        <div className="truncate">
                          <span className={`font-bold truncate block ${isCollected ? "text-emerald-700 dark:text-emerald-300" : "t-primary"}`}>
                            {item.name}
                          </span>
                          <span className="text-[11px] text-neutral-400 truncate block">
                            {artistStr}{item.album && ` · ${item.album}`}
                          </span>
                          {unplayableIds.has(item.id) && (
                            <span className="text-[10px] text-amber-500 block truncate">
                              该版本受源站保护，正在自动尝试其他音源
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/5 text-neutral-400 uppercase">
                          {item.source}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (isPlayingThis) player.pause();
                            else handleResolveAndPlay(item, true);
                          }}
                          disabled={isResolving}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 select-none ${
                            isPlayingThis
                              ? "bg-theme text-white shadow-2xs font-bold animate-pulse"
                              : "bg-theme/10 hover:bg-theme/20 text-theme"
                          }`}
                          title="试听"
                        >
                          {isResolving ? (
                            <i className="ri-loader-4-line animate-spin" />
                          ) : isPlayingThis ? (
                            <i className="ri-pause-fill" />
                          ) : (
                            <i className="ri-play-fill" />
                          )}
                          <span>{isPlayingThis ? "播放" : "试听"}</span>
                        </button>

                        {isCollected ? (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 text-xs flex items-center gap-1 select-none">
                            <i className="ri-check-line" />
                            <span>已收录</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleResolveAndPlay(item, false)}
                            disabled={isResolving}
                            className="px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white text-neutral-600 dark:text-neutral-300 text-xs font-semibold transition flex items-center gap-1 select-none active:scale-95"
                          >
                            <i className="ri-add-line" />
                            <span>收录</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 右栏: 播放队列管理 (支持自定义分组、复选框、批量全选/反选/删除/移动、歌手/专辑分类、手柄拖动与 R2 转存状态) */}
        <div className="xl:col-span-6 p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRightViewMode("queue")}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition ${
                  rightViewMode === "queue" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                }`}
              >
                播放队列 ({player.playlist.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightViewMode("r2");
                  loadR2Files();
                }}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition ${
                  rightViewMode === "r2" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                }`}
              >
                R2曲库 ({r2Files.length})
              </button>
            </div>

            {rightViewMode === "queue" && (
              <div className="flex items-center gap-1 text-xs">
                {[
                  { id: "all", label: "全部" },
                  { id: "group", label: "自定义分组" },
                  { id: "artist", label: "按歌手" },
                  { id: "album", label: "按专辑" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPlaylistFilterMode(m.id as any);
                      setSelectedGroupTag("");
                    }}
                    className={`px-2 py-0.5 rounded-md font-semibold transition ${
                      playlistFilterMode === m.id
                        ? "bg-theme text-white font-bold shadow-2xs"
                        : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 分组 / 歌手 / 专辑 过滤栏 */}
          {playlistFilterMode !== "all" && (
            <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs">
              <span className="font-semibold text-neutral-400 text-[11px]">
                {playlistFilterMode === "group" ? "分组：" : playlistFilterMode === "artist" ? "歌手：" : "专辑："}
              </span>
              <button
                type="button"
                onClick={() => setSelectedGroupTag("")}
                className={`px-2 py-0.5 rounded-md transition ${
                  selectedGroupTag === "" ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-500"
                }`}
              >
                全部
              </button>
              {(playlistFilterMode === "group" ? customGroups : playlistFilterMode === "artist" ? artistGroups : albumGroups).map((g) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => setSelectedGroupTag(g.name)}
                  className={`px-2 py-0.5 rounded-md transition ${
                    selectedGroupTag === g.name
                      ? "bg-theme text-white font-bold"
                      : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"
                  }`}
                >
                  <span>{g.name}</span>
                  <span className="opacity-60 text-[10px] ml-1">({g.count})</span>
                </button>
              ))}

              {playlistFilterMode === "group" && (
                <button
                  type="button"
                  onClick={() => setShowNewGroupInput(!showNewGroupInput)}
                  className="px-2 py-0.5 rounded-md text-theme hover:bg-theme/10 transition font-bold"
                >
                  + 新建分组
                </button>
              )}
            </div>
          )}

          {/* 新建分组快速输入框 */}
          {showNewGroupInput && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-theme/5 border border-theme/20 text-xs ani-show">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="输入新分组名称 (如：车载、深夜、纯音)..."
                className="flex-1 rounded-lg border border-black/10 bg-w px-2.5 py-1 text-xs outline-none focus:border-theme dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => handleAssignGroup(newGroupName)}
                disabled={!selectedTrackIds.size || !newGroupName.trim()}
                className="px-3 py-1 rounded-lg bg-theme text-white font-bold disabled:opacity-40"
              >
                将已选项归入此组
              </button>
            </div>
          )}

          {/* 批量操作控制条 */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-2 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-1"
              >
                <i className={selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0 ? "ri-checkbox-fill text-theme" : "ri-checkbox-blank-line"} />
                <span>全选</span>
              </button>
              <button
                type="button"
                onClick={handleInvertSelect}
                className="px-2 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                反选
              </button>
              {selectedTrackIds.size > 0 && (
                <span className="text-[11px] text-theme font-semibold">
                  已选 {selectedTrackIds.size} 项
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 分组指派快捷下拉 */}
              {selectedTrackIds.size > 0 && customGroups.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-neutral-400">移至:</span>
                  {customGroups.slice(0, 3).map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => handleAssignGroup(g.name)}
                      className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white transition text-[11px]"
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleBatchMove("up")}
                disabled={!selectedTrackIds.size}
                className="p-1.5 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
                title="上移"
              >
                <i className="ri-arrow-up-s-line text-xs" />
              </button>
              <button
                type="button"
                onClick={() => handleBatchMove("down")}
                disabled={!selectedTrackIds.size}
                className="p-1.5 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
                title="下移"
              >
                <i className="ri-arrow-down-s-line text-xs" />
              </button>
              <button
                type="button"
                onClick={handleBatchPersistR2}
                disabled={persistR2Status === "saving"}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                  persistR2Status === "done"
                    ? "bg-emerald-500 text-white font-bold"
                    : "bg-theme/10 hover:bg-theme/20 text-theme"
                }`}
                title="将播放队列中的临时动态外链下载并永久存储在 Cloudflare R2，永不失效"
              >
                {persistR2Status === "saving" && <i className="ri-loader-4-line animate-spin" />}
                {persistR2Status === "done" && <i className="ri-check-line" />}
                {persistR2Status === "idle" && <i className="ri-save-line" />}
                <span>{persistR2Status === "saving" ? "转存中..." : persistR2Status === "done" ? "已转存 ✓" : "全部转存"}</span>
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={!selectedTrackIds.size}
                className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition flex items-center gap-1 font-semibold"
              >
                <i className="ri-delete-bin-line text-xs" />
                <span>删除</span>
              </button>
              <button
                type="button"
                onClick={() => player.setPlaylist(DEFAULT_PRESET_TRACKS)}
                className="px-2 py-1 rounded-md text-neutral-400 hover:text-theme transition"
              >
                重置
              </button>
            </div>
          </div>

          {/* 视图分支：播放队列 (DataGrid) 或 R2 存储桶曲库 (Navidrome 风格) */}
          {rightViewMode === "queue" ? (
            <>
              {/* 播放队列表格 */}
              <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 bg-w max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
                      <th className="py-2 px-1 w-6 text-center"></th>
                      <th className="py-2 px-2 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0}
                          onChange={handleToggleSelectAll}
                          className="accent-theme cursor-pointer"
                        />
                      </th>
                      <th className="py-2 px-1 w-8 text-center">#</th>
                      <th className="py-2 px-2">曲目 / 歌手</th>
                      <th className="py-2 px-2 w-16">分组</th>
                      <th className="py-2 px-2 w-16">音源</th>
                      <th className="py-2 px-2 w-20 text-center">转存状态</th>
                      <th className="py-2 px-2 text-right pr-3 w-16">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {displayedPlaylist.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-neutral-400">
                          播放队列为空，请在左侧检索并收录
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
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", String(track.id));
                              setDraggedTrackId(track.id);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (dragOverTrackId !== track.id) setDragOverTrackId(track.id);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handlePlaylistRowDrop(track.id);
                            }}
                            onDragEnd={() => {
                              setDraggedTrackId(null);
                              setDragOverTrackId(null);
                            }}
                            className={`transition select-none ${
                              draggedTrackId === track.id ? "opacity-30 bg-theme/10" : ""
                            } ${
                              dragOverTrackId === track.id ? "border-t-2 border-theme bg-theme/5" : ""
                            } ${
                              isSel
                                ? "bg-theme/[0.04]"
                                : isCur
                                ? "bg-theme/[0.02]"
                                : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                            }`}
                          >
                            {/* 排序拖拽手柄 (=) */}
                            <td className="py-1.5 px-1 text-center cursor-grab active:cursor-grabbing text-neutral-400 hover:text-theme">
                              <i className="ri-drag-move-2-line text-xs" />
                            </td>
                            {/* 选择框 */}
                            <td className="py-1.5 px-2 text-center">
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
                            {/* 序号 / 播放中指示 */}
                            <td className="py-1.5 px-1 text-center font-mono text-neutral-400">
                              {isCur && player.isPlaying ? (
                                <span className="text-theme font-bold">▶</span>
                              ) : (
                                `#${idx + 1}`
                              )}
                            </td>
                            {/* 曲目名与艺术家 */}
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-2">
                                <VinylDiscArt
                                  isPlaying={isCur && player.isPlaying}
                                  coverUrl={track.pic}
                                  className="h-6 w-6 rounded-md shrink-0"
                                />
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
                            <td className="py-1.5 px-2">
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-theme/5 text-theme font-bold">
                                {track.group || "默认"}
                              </span>
                            </td>
                            {/* 音源 */}
                            <td className="py-1.5 px-2">
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-neutral-500">
                                {formatCleanSourceName(track)}
                              </span>
                            </td>
                            {/* 转存状态与手动转存按钮 (纯图标 + 悬浮提示，不带破坏美感的文字) */}
                            <td className="py-1.5 px-2 text-center">
                              {isR2 ? (
                                <span title="已永久转存至 R2 对象存储" className="inline-flex items-center justify-center text-emerald-500 select-none">
                                  <i className="ri-checkbox-circle-fill text-sm" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSingleTrackPersist(track)}
                                  disabled={persistingTrackId === track.id}
                                  className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5 transition inline-flex items-center justify-center select-none"
                                  title="点击下载并转存至 R2 永久存储"
                                >
                                  {persistingTrackId === track.id ? (
                                    <i className="ri-loader-4-line animate-spin text-xs text-theme" />
                                  ) : (
                                    <i className="ri-download-cloud-line text-sm" />
                                  )}
                                </button>
                              )}
                            </td>
                            {/* 操作 (配套播放/暂停切换，删除时同步清理 R2 存储) */}
                            <td className="py-1.5 px-2 text-right pr-3">
                              <div className="inline-flex items-center gap-1">
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
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTrack(track)}
                                  className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-black/5 transition"
                                  title="删除 (若在R2将同步清理文件)"
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

              {/* 手动录入直链 */}
              <div className="p-3 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.01] dark:bg-white/[0.01] space-y-2 text-xs">
                <span className="font-bold text-[11px] t-primary block">手动录入音频直链 (OpenList / CDN)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="歌曲名称 (必填)"
                    className="rounded-lg border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-2.5 py-1 text-xs outline-none focus:border-theme"
                  />
                  <input
                    type="text"
                    value={customArtist}
                    onChange={(e) => setCustomArtist(e.target.value)}
                    placeholder="歌手 (选填)"
                    className="rounded-lg border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-2.5 py-1 text-xs outline-none focus:border-theme"
                  />
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="音频直链 URL (必填)"
                    className="sm:col-span-2 rounded-lg border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-2.5 py-1 font-mono text-xs outline-none focus:border-theme"
                  />
                </div>
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddCustomTrack}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      customStatus === "done" ? "bg-emerald-500 text-white" : "bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white"
                    }`}
                  >
                    {customStatus === "done" ? <i className="ri-check-line" /> : <i className="ri-add-line" />}
                    <span>{customStatus === "done" ? "已加入 ✓" : "添加至队列"}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Navidrome 风格 R2 云端存储桶曲库视图 */
            <div className="space-y-3 ani-show">
              <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <i className="ri-database-2-line text-theme" />
                  <h4 className="font-bold text-xs t-primary">R2 对象存储桶已存曲库 ({r2Files.length} 首)</h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadR2Files}
                    disabled={loadingR2}
                    className="text-xs text-neutral-400 hover:text-theme flex items-center gap-1"
                  >
                    <i className={`ri-refresh-line ${loadingR2 ? "animate-spin" : ""}`} />
                    <span>刷新</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleImportAllR2ToQueue}
                    disabled={r2Files.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-theme text-white text-xs font-bold hover:bg-theme-hover transition flex items-center gap-1"
                  >
                    <i className="ri-play-list-add-line" />
                    <span>全量导入播放队列</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 bg-w max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
                      <th className="py-2 px-2 w-8 text-center">#</th>
                      <th className="py-2 px-2">曲目名称 / 文件名</th>
                      <th className="py-2 px-2 w-20">大小</th>
                      <th className="py-2 px-2 w-28">上传时间</th>
                      <th className="py-2 px-2 text-right pr-3 w-24">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {r2Files.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-neutral-400">
                          {loadingR2 ? "正在检索 R2 存储桶文件..." : "R2 存储桶中暂无持久化音乐文件"}
                        </td>
                      </tr>
                    ) : (
                      r2Files.map((file, idx) => (
                        <tr key={file.key} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition">
                          <td className="py-2 px-2 text-center font-mono text-neutral-400">#{idx + 1}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <VinylDiscArt className="h-6 w-6 rounded-md shrink-0" />
                              <span className="font-bold t-primary truncate max-w-xs">{file.displayName}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 font-mono text-neutral-500">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </td>
                          <td className="py-2 px-2 font-mono text-neutral-400 text-[11px]">
                            {file.uploaded ? new Date(file.uploaded).toLocaleDateString() : "-"}
                          </td>
                          <td className="py-2 px-2 text-right pr-3">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleImportR2ToQueue(file)}
                                className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white transition text-xs font-semibold"
                                title="导入前台队列"
                              >
                                入库
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteR2PhysicalFile(file)}
                                className="p-1 rounded-md text-neutral-400 hover:text-red-500 transition"
                                title="从 R2 永久物理删除"
                              >
                                <i className="ri-delete-bin-line text-xs" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
