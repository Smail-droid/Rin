import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useMusicPlayer, DEFAULT_PRESET_TRACKS } from "../components/music-player/music-player-context";
import {
  gdMusicService,
  GD_MUSIC_SOURCES,
  type GdSearchResultItem,
} from "../services/music-api";
import type { MusicTrack } from "../components/music-player/types";

// 纯文本音乐流派标签 (严禁 Emoji，极简风格)
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

interface ArtistData { name: string; initial: string; cat: "male" | "female" | "group"; }

// 华语男女歌手 A-Z 索引词库 (Cat 1001 男 & Cat 1002 女)
const ARTIST_DIRECTORY: ArtistData[] = [
  { name: "阿杜", initial: "A", cat: "male" }, { name: "阿云嘎", initial: "A", cat: "male" },
  { name: "陈奕迅", initial: "C", cat: "male" }, { name: "蔡徐坤", initial: "C", cat: "male" }, { name: "陈小春", initial: "C", cat: "male" }, { name: "崔健", initial: "C", cat: "male" },
  { name: "刀郎", initial: "D", cat: "male" }, { name: "大张伟", initial: "D", cat: "male" },
  { name: "费玉清", initial: "F", cat: "male" }, { name: "方大同", initial: "F", cat: "male" },
  { name: "光良", initial: "G", cat: "male" },
  { name: "华晨宇", initial: "H", cat: "male" }, { name: "胡夏", initial: "H", cat: "male" }, { name: "黄家驹", initial: "H", cat: "male" },
  { name: "林俊杰", initial: "L", cat: "male" }, { name: "李荣浩", initial: "L", cat: "male" }, { name: "刘德华", initial: "L", cat: "male" }, { name: "李克勤", initial: "L", cat: "male" }, { name: "鹿晗", initial: "L", cat: "male" }, { name: "罗大佑", initial: "L", cat: "male" },
  { name: "毛不易", initial: "M", cat: "male" },
  { name: "潘玮柏", initial: "P", cat: "male" }, { name: "朴树", initial: "P", cat: "male" },
  { name: "薛之谦", initial: "S", cat: "male" }, { name: "宋冬野", initial: "S", cat: "male" },
  { name: "陶喆", initial: "T", cat: "male" },
  { name: "汪苏泷", initial: "W", cat: "male" }, { name: "王力宏", initial: "W", cat: "male" }, { name: "伍佰", initial: "W", cat: "male" }, { name: "汪峰", initial: "W", cat: "male" },
  { name: "许嵩", initial: "X", cat: "male" }, { name: "许巍", initial: "X", cat: "male" }, { name: "谢霆锋", initial: "X", cat: "male" },
  { name: "杨宗纬", initial: "Y", cat: "male" },
  { name: "周杰伦", initial: "Z", cat: "male" }, { name: "张学友", initial: "Z", cat: "male" }, { name: "张杰", initial: "Z", cat: "male" }, { name: "赵雷", initial: "Z", cat: "male" }, { name: "周深", initial: "Z", cat: "male" },
  { name: "蔡依林", initial: "C", cat: "female" }, { name: "陈绮贞", initial: "C", cat: "female" }, { name: "陈粒", initial: "C", cat: "female" }, { name: "程响", initial: "C", cat: "female" },
  { name: "邓紫棋", initial: "D", cat: "female" },
  { name: "田馥甄", initial: "H", cat: "female" }, { name: "韩红", initial: "H", cat: "female" },
  { name: "梁静茹", initial: "L", cat: "female" }, { name: "李宇春", initial: "L", cat: "female" }, { name: "刘若英", initial: "L", cat: "female" },
  { name: "莫文蔚", initial: "M", cat: "female" },
  { name: "那英", initial: "N", cat: "female" },
  { name: "孙燕姿", initial: "S", cat: "female" }, { name: "单依纯", initial: "S", cat: "female" },
  { name: "王菲", initial: "W", cat: "female" }, { name: "王心凌", initial: "W", cat: "female" },
  { name: "徐佳莹", initial: "X", cat: "female" }, { name: "萧亚轩", initial: "X", cat: "female" },
  { name: "郁可唯", initial: "Y", cat: "female" }, { name: "杨丞琳", initial: "Y", cat: "female" },
  { name: "张韶涵", initial: "Z", cat: "female" }, { name: "张靓颖", initial: "Z", cat: "female" }, { name: "周笔畅", initial: "Z", cat: "female" },
  { name: "五月天", initial: "W", cat: "group" }, { name: "告五人", initial: "G", cat: "group" }, { name: "痛仰乐队", initial: "T", cat: "group" }, { name: "逃跑计划", initial: "T", cat: "group" }, { name: "房东的猫", initial: "F", cat: "group" },
];

const ALPHABET = ["全部", "A", "B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "S", "T", "W", "X", "Y", "Z"];

export function AdminMusicPage() {
  const siteConfig = useSiteConfig();
  const player = useMusicPlayer();

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [batchStatus, setBatchStatus] = useState<"idle" | "batching" | "done">("idle");
  const [customStatus, setCustomStatus] = useState<"idle" | "done">("idle");
  const [unplayableIds, setUnplayableIds] = useState<Set<string | number>>(new Set());
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string | number>>(new Set());
  const [playlistFilterMode, setPlaylistFilterMode] = useState<"all" | "artist" | "album">("all");
  const [selectedGroupTag, setSelectedGroupTag] = useState<string>("");
  const [settingsExpanded, setSettingsExpanded] = useState<boolean>(false);

  const [musicEnabled, setMusicEnabled] = useState(() => siteConfig.musicEnabled);
  const [musicAutoPlay, setMusicAutoPlay] = useState(() => siteConfig.musicAutoPlay);
  const [musicPosition, setMusicPosition] = useState(() => siteConfig.musicPosition || "bottom-right");
  const [musicSourceType] = useState(() => siteConfig.musicSourceType || "gdstudio");
  const [gdApi] = useState(() => siteConfig.musicGdApi || "https://music-api.gdstudio.xyz/api.php");
  const [gdSource, setGdSource] = useState(() => siteConfig.musicGdSource || "all");
  const [openlistMusicUrl, setOpenlistMusicUrl] = useState(() => siteConfig.musicOpenlistUrl || "");

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchMode, setSearchMode] = useState<"song" | "album">("song");
  const [selectedInitial, setSelectedInitial] = useState("全部");
  const [selectedArtistCat, setSelectedArtistCat] = useState<"all" | "male" | "female" | "group">("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GdSearchResultItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string | number | null>(null);

  const [customName, setCustomName] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customPic, setCustomPic] = useState("");
  const [customLyric, setCustomLyric] = useState("");

  const filteredArtists = useMemo(() => ARTIST_DIRECTORY.filter((a) => {
    const matchCat = selectedArtistCat === "all" || a.cat === selectedArtistCat;
    const matchInitial = selectedInitial === "全部" || a.initial === selectedInitial;
    return matchCat && matchInitial;
  }), [selectedArtistCat, selectedInitial]);

  const artistGroups = useMemo(() => {
    const map = new Map<string, number>();
    player.playlist.forEach((t) => map.set(t.artist || "未知", (map.get(t.artist || "未知") || 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [player.playlist]);

  const albumGroups = useMemo(() => {
    const map = new Map<string, number>();
    player.playlist.forEach((t) => map.set(t.album || "单曲", (map.get(t.album || "单曲") || 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [player.playlist]);

  const displayedPlaylist = useMemo(() => {
    if (playlistFilterMode === "all" || !selectedGroupTag) return player.playlist;
    if (playlistFilterMode === "artist") return player.playlist.filter((t) => (t.artist || "未知") === selectedGroupTag);
    if (playlistFilterMode === "album") return player.playlist.filter((t) => (t.album || "单曲") === selectedGroupTag);
    return player.playlist;
  }, [player.playlist, playlistFilterMode, selectedGroupTag]);

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
    } catch { setSaveStatus("error"); setTimeout(() => setSaveStatus("idle"), 3000); }
  };

  const handleSearch = async (kwOverride?: string, srcOverride?: string) => {
    const kw = (kwOverride ?? searchKeyword).trim();
    if (!kw) return;
    setIsSearching(true);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const src = srcOverride ?? gdSource;
      const finalSource = searchMode === "album" && src !== "all" ? `${src}_album` : src;
      setSearchResults(await gdMusicService.search(kw, finalSource, 1, 25));
    } catch (e) { console.warn("Search error:", e); } finally { setIsSearching(false); }
  };

  const handleResolveAndPlay = async (item: GdSearchResultItem, playNow = true) => {
    setResolvingId(item.id);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const track = await gdMusicService.resolveTrack(item, 320);
      if (!track?.url) { setUnplayableIds((p) => new Set(p).add(item.id)); return; }
      player.addTrack(track, playNow);
    } catch { setUnplayableIds((p) => new Set(p).add(item.id)); } finally { setResolvingId(null); }
  };

  const handleBatchCollect = async () => {
    if (!searchResults.length) return;
    setBatchStatus("batching");
    gdMusicService.setEndpoint(gdApi.trim());
    for (const item of searchResults.slice(0, 8)) {
      try { const t = await gdMusicService.resolveTrack(item, 320); if (t?.url) player.addTrack(t, false); } catch {}
    }
    setBatchStatus("done");
    setTimeout(() => setBatchStatus("idle"), 2500);
  };

  const handleToggleSelectAll = () => {
    if (selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0) setSelectedTrackIds(new Set());
    else setSelectedTrackIds(new Set(displayedPlaylist.map((t) => t.id)));
  };
  const handleInvertSelect = () => {
    const s = new Set<string | number>();
    displayedPlaylist.forEach((t) => { if (!selectedTrackIds.has(t.id)) s.add(t.id); });
    setSelectedTrackIds(s);
  };
  const handleBatchDelete = () => {
    if (!selectedTrackIds.size) return;
    player.setPlaylist(player.playlist.filter((t) => !selectedTrackIds.has(t.id)));
    setSelectedTrackIds(new Set());
  };
  const handleBatchMove = (dir: "up" | "down") => {
    if (!selectedTrackIds.size) return;
    const list = [...player.playlist];
    if (dir === "up") { for (let i = 1; i < list.length; i++) { if (selectedTrackIds.has(list[i].id) && !selectedTrackIds.has(list[i - 1].id)) { [list[i], list[i - 1]] = [list[i - 1], list[i]]; } } }
    else { for (let i = list.length - 2; i >= 0; i--) { if (selectedTrackIds.has(list[i].id) && !selectedTrackIds.has(list[i + 1].id)) { [list[i], list[i + 1]] = [list[i + 1], list[i]]; } } }
    player.setPlaylist(list);
  };

  const handleAddCustomTrack = () => {
    if (!customName.trim() || !customUrl.trim()) return;
    const t: MusicTrack = { id: `custom_${Date.now()}`, name: customName.trim(), artist: customArtist.trim() || "未知", url: customUrl.trim(), pic: customPic.trim(), lyric: customLyric.trim(), source: "custom", sourceName: "自定义" };
    player.addTrack(t, true);
    setCustomName(""); setCustomArtist(""); setCustomUrl(""); setCustomPic(""); setCustomLyric("");
    setCustomStatus("done"); setTimeout(() => setCustomStatus("idle"), 2500);
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show">
      <Helmet><title>{`全站音乐电台 - ${siteConfig.name}`}</title></Helmet>

      {/* 顶部状态条 */}
      <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme/10 text-theme text-xl shadow-2xs"><i className="ri-disc-line" /></span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold t-primary">全站音乐电台</h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${musicEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"}`}>{musicEnabled ? "已启用" : "未开启"}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">SPA 跨页面无缝播放 · 左右工作台流式联动</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button type="button" onClick={() => setSettingsExpanded(!settingsExpanded)} className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-1">
            <i className="ri-settings-4-line text-xs" /><span>{settingsExpanded ? "收起设置" : "电台设置"}</span><i className={`text-xs ${settingsExpanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}`} />
          </button>
          <button type="button" onClick={handleSave} disabled={saveStatus === "saving"} className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60 ${saveStatus === "saved" ? "bg-emerald-500 text-white" : saveStatus === "error" ? "bg-rose-500 text-white" : "bg-theme text-white hover:bg-theme-hover"}`}>
            {saveStatus === "saving" && <i className="ri-loader-4-line animate-spin" />}{saveStatus === "saved" && <i className="ri-check-line" />}
            <span>{saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存 ✓" : saveStatus === "error" ? "失败重试" : "保存配置"}</span>
          </button>
        </div>
      </div>

      {/* 折叠设置分区 */}
      {settingsExpanded && (
        <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3 ani-show">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5"><span className="font-bold text-xs t-primary">电台运行参数</span><span className="text-[11px] text-neutral-400">修改后点击保存生效</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
              <div><span className="font-bold block t-primary">启用播放器</span><span className="text-[10px] text-neutral-400">前台悬浮唱片挂件</span></div>
              <button type="button" role="switch" aria-checked={musicEnabled} onClick={() => setMusicEnabled(!musicEnabled)} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${musicEnabled ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"}`}><span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${musicEnabled ? "translate-x-4.5" : "translate-x-1"}`} /></button>
            </div>
            <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
              <div><span className="font-bold block t-primary">自动播放</span><span className="text-[10px] text-neutral-400">受浏览器策略限制</span></div>
              <button type="button" role="switch" aria-checked={musicAutoPlay} onClick={() => setMusicAutoPlay(!musicAutoPlay)} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${musicAutoPlay ? "bg-theme" : "bg-neutral-200 dark:bg-neutral-700"}`}><span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition transform mt-0.5 ${musicAutoPlay ? "translate-x-4.5" : "translate-x-1"}`} /></button>
            </div>
            <div className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
              <div><span className="font-bold block t-primary">挂件方位</span><span className="text-[10px] text-neutral-400">停靠屏幕边缘</span></div>
              <div className="flex items-center gap-1">{[{ id: "bottom-right", label: "右下" }, { id: "bottom-left", label: "左下" }].map((p) => (<button key={p.id} type="button" onClick={() => setMusicPosition(p.id)} className={`px-2 py-1 rounded-lg text-xs font-semibold transition ${musicPosition === p.id ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-500"}`}>{p.label}</button>))}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">OpenList 5T 音频目录直链</label>
              <input type="url" value={openlistMusicUrl} onChange={(e) => setOpenlistMusicUrl(e.target.value)} placeholder="https://openlist.yourdomain.com/5T/Music/" className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3 py-1.5 font-mono text-xs outline-none focus:border-theme transition" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">默认音源平台</label>
              <div className="flex items-center gap-1 flex-wrap">{GD_MUSIC_SOURCES.map((s) => (<button key={s.id} type="button" onClick={() => setGdSource(s.id)} className={`px-2 py-1 rounded-lg text-xs transition ${gdSource === s.id ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400"}`}>{s.name}</button>))}</div>
            </div>
          </div>
        </div>
      )}

      {/* 核心左右双栏工作台 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">

        {/* 左栏: 曲库检索 */}
        <div className="xl:col-span-6 p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2"><i className="ri-search-line text-theme" /><h3 className="font-bold text-xs t-primary">曲库检索</h3></div>
            <div className="flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 p-0.5 text-xs">
              <button type="button" onClick={() => setSearchMode("song")} className={`px-2.5 py-0.5 rounded-md font-semibold transition ${searchMode === "song" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"}`}>单曲</button>
              <button type="button" onClick={() => setSearchMode("album")} className={`px-2.5 py-0.5 rounded-md font-semibold transition ${searchMode === "album" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"}`}>专辑歌单</button>
            </div>
          </div>

          {/* 流派 */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
            <span className="font-semibold text-[11px] text-neutral-400 shrink-0">流派：</span>
            {GENRE_TAGS.map((g, i) => (<span key={g} className="inline-flex items-center gap-1.5"><button type="button" onClick={() => { setSearchKeyword(g); void handleSearch(g); }} className="hover:text-theme transition font-medium">{g}</button>{i < GENRE_TAGS.length - 1 && <span className="opacity-30">|</span>}</span>))}
          </div>

          {/* 榜单 */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap border-t border-black/5 dark:border-white/5 pt-1.5">
            <span className="font-semibold text-[11px] text-neutral-400 shrink-0">榜单：</span>
            {CHART_PRESETS.map((c, i) => (<span key={c.label} className="inline-flex items-center gap-1.5"><button type="button" onClick={() => { setSearchKeyword(c.query); setGdSource(c.source); void handleSearch(c.query, c.source); }} className="hover:text-theme transition font-medium">{c.label}</button>{i < CHART_PRESETS.length - 1 && <span className="opacity-30">|</span>}</span>))}
          </div>

          {/* A-Z 歌手快速检索 */}
          <div className="p-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[11px] t-primary">歌手 A-Z 检索</span>
              <div className="flex items-center gap-1">
                {[{ id: "all", label: "全部" }, { id: "male", label: "男歌手" }, { id: "female", label: "女歌手" }, { id: "group", label: "乐队" }].map((c) => (
                  <button key={c.id} type="button" onClick={() => setSelectedArtistCat(c.id as any)} className={`px-2 py-0.5 rounded-md text-[11px] transition ${selectedArtistCat === c.id ? "bg-theme text-white font-bold" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"}`}>{c.label}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap text-[11px] font-mono">
              {ALPHABET.map((l) => (<button key={l} type="button" onClick={() => setSelectedInitial(l)} className={`px-1.5 py-0.2 rounded transition ${selectedInitial === l ? "bg-theme text-white font-bold scale-105" : "text-neutral-400 hover:text-theme"}`}>{l}</button>))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap pt-1 max-h-24 overflow-y-auto">
              {filteredArtists.map((a) => (<button key={a.name} type="button" onClick={() => { setSearchKeyword(a.name); void handleSearch(a.name); }} className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 text-xs hover:bg-theme hover:text-white transition select-none">{a.name}</button>))}
            </div>
          </div>

          {/* 搜索框 */}
          <div className="flex gap-2 text-xs">
            <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder={searchMode === "album" ? "输入专辑/歌单名称..." : "输入曲名、歌手或点击上方快捷检索..."} className="flex-1 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-2 text-xs t-primary outline-none focus:border-theme transition" />
            <button type="button" onClick={() => handleSearch()} disabled={isSearching} className="px-4 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1">
              {isSearching ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}<span>{isSearching ? "检索..." : "检索"}</span>
            </button>
          </div>

          {/* 搜索结果 */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-w overflow-hidden text-xs">
            <div className="p-2 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between text-neutral-400">
              <span className="font-mono text-[11px]">{searchResults.length > 0 ? `${searchResults.length} 条匹配` : "搜索结果"}</span>
              {searchResults.length > 0 && (
                <button type="button" onClick={handleBatchCollect} disabled={batchStatus === "batching"} className={`px-2 py-0.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${batchStatus === "done" ? "bg-emerald-500 text-white" : "bg-theme/10 hover:bg-theme/20 text-theme"}`}>
                  {batchStatus === "batching" && <i className="ri-loader-4-line animate-spin" />}{batchStatus === "done" && <i className="ri-check-line" />}
                  <span>{batchStatus === "batching" ? "收录中..." : batchStatus === "done" ? "已收录 ✓" : "批量收录前8首"}</span>
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
              {searchResults.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 flex flex-col items-center justify-center gap-1">
                  <i className="ri-music-2-line text-2xl opacity-30" /><p className="text-xs">点击歌手名或输入关键字检索</p>
                </div>
              ) : searchResults.map((item) => {
                const isResolving = resolvingId === item.id;
                const artistStr = Array.isArray(item.artist) ? item.artist.join(" / ") : item.artist;
                const isCollected = player.playlist.some((p) => String(p.id).includes(String(item.id)) || (p.name === item.name && p.artist === artistStr));
                const isPlayingThis = player.isPlaying && player.currentTrack?.name === item.name;
                return (
                  <div key={item.id} className={`p-2 flex items-center justify-between gap-2 transition ${isCollected ? "bg-emerald-500/[0.02]" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs ${isCollected ? "bg-emerald-500/10 text-emerald-600" : "bg-theme/10 text-theme"}`}><i className="ri-music-line text-[11px]" /></span>
                      <div className="truncate">
                        <span className={`font-bold truncate block ${isCollected ? "text-emerald-700 dark:text-emerald-300" : "t-primary"}`}>{item.name}</span>
                        <span className="text-[11px] text-neutral-400 truncate block">{artistStr}{item.album && ` · ${item.album}`}</span>
                        {unplayableIds.has(item.id) && <span className="text-[10px] text-amber-500 block truncate">该版本受源站保护暂无法试听</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/5 text-neutral-400 uppercase">{item.source}</span>
                      {unplayableIds.has(item.id) ? (
                        <span className="px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-400 text-xs flex items-center gap-1 select-none"><i className="ri-forbid-line text-xs" /><span>受限</span></span>
                      ) : (
                        <button type="button" onClick={() => { if (isPlayingThis) player.pause(); else handleResolveAndPlay(item, true); }} disabled={isResolving} className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 select-none ${isPlayingThis ? "bg-theme text-white shadow-2xs font-bold animate-pulse" : "bg-theme/10 hover:bg-theme/20 text-theme"}`}>
                          {isResolving ? <i className="ri-loader-4-line animate-spin" /> : isPlayingThis ? <i className="ri-pause-fill" /> : <i className="ri-play-fill" />}<span>{isPlayingThis ? "播放" : "试听"}</span>
                        </button>
                      )}
                      {isCollected ? (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 text-xs flex items-center gap-1 select-none"><i className="ri-check-line" /><span>已收录</span></span>
                      ) : (
                        <button type="button" onClick={() => handleResolveAndPlay(item, false)} disabled={isResolving} className="px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white text-neutral-600 dark:text-neutral-300 text-xs font-semibold transition flex items-center gap-1 select-none active:scale-95"><i className="ri-add-line" /><span>收录</span></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右栏: 播放队列管理 (选择框、全选、反选、批量删除、移动、歌手/专辑分类) */}
        <div className="xl:col-span-6 p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 gap-2">
            <div className="flex items-center gap-2"><i className="ri-play-list-line text-theme" /><h3 className="font-bold text-xs t-primary">播放队列 ({player.playlist.length} 首)</h3></div>
            <div className="flex items-center gap-1 text-xs">
              {[{ id: "all", label: "全部" }, { id: "artist", label: "按歌手" }, { id: "album", label: "按专辑" }].map((m) => (
                <button key={m.id} type="button" onClick={() => { setPlaylistFilterMode(m.id as any); setSelectedGroupTag(""); }} className={`px-2 py-0.5 rounded-md font-semibold transition ${playlistFilterMode === m.id ? "bg-theme text-white font-bold shadow-2xs" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"}`}>{m.label}</button>
              ))}
            </div>
          </div>

          {/* 歌手/专辑分组过滤 */}
          {playlistFilterMode !== "all" && (
            <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs">
              <span className="font-semibold text-neutral-400 text-[11px]">{playlistFilterMode === "artist" ? "歌手：" : "专辑："}</span>
              <button type="button" onClick={() => setSelectedGroupTag("")} className={`px-2 py-0.5 rounded-md transition ${selectedGroupTag === "" ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-500"}`}>全部</button>
              {(playlistFilterMode === "artist" ? artistGroups : albumGroups).map((g) => (
                <button key={g.name} type="button" onClick={() => setSelectedGroupTag(g.name)} className={`px-2 py-0.5 rounded-md transition ${selectedGroupTag === g.name ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-black/10"}`}>
                  {g.name}<span className="opacity-60 text-[10px] ml-1">({g.count})</span>
                </button>
              ))}
            </div>
          )}

          {/* 批量操作条 */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs">
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleToggleSelectAll} className="px-2 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center gap-1">
                <i className={selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0 ? "ri-checkbox-fill text-theme" : "ri-checkbox-blank-line"} /><span>全选</span>
              </button>
              <button type="button" onClick={handleInvertSelect} className="px-2 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition">反选</button>
              {selectedTrackIds.size > 0 && <span className="text-[11px] text-theme font-semibold">已选 {selectedTrackIds.size} 项</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => handleBatchMove("up")} disabled={!selectedTrackIds.size} className="p-1.5 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition" title="上移"><i className="ri-arrow-up-s-line text-xs" /></button>
              <button type="button" onClick={() => handleBatchMove("down")} disabled={!selectedTrackIds.size} className="p-1.5 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition" title="下移"><i className="ri-arrow-down-s-line text-xs" /></button>
              <button type="button" onClick={handleBatchDelete} disabled={!selectedTrackIds.size} className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition flex items-center gap-1 font-semibold"><i className="ri-delete-bin-line text-xs" /><span>删除</span></button>
              <button type="button" onClick={() => player.setPlaylist(DEFAULT_PRESET_TRACKS)} className="px-2 py-1 rounded-md text-neutral-400 hover:text-theme transition">恢复默认</button>
            </div>
          </div>

          {/* 播放队列表格 */}
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 bg-w max-h-[50vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead><tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
                <th className="py-2 px-2 w-8 text-center"><input type="checkbox" checked={selectedTrackIds.size === displayedPlaylist.length && displayedPlaylist.length > 0} onChange={handleToggleSelectAll} className="accent-theme cursor-pointer" /></th>
                <th className="py-2 px-2 w-10 text-center">#</th>
                <th className="py-2 px-2">曲目 / 歌手</th>
                <th className="py-2 px-2 w-20">音源</th>
                <th className="py-2 px-2 text-right pr-3 w-16">操作</th>
              </tr></thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {displayedPlaylist.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-neutral-400">播放队列为空，请在左侧检索并收录</td></tr>
                ) : displayedPlaylist.map((track, idx) => {
                  const isCur = player.currentTrack?.id === track.id;
                  const isSel = selectedTrackIds.has(track.id);
                  return (
                    <tr key={track.id || idx} className={`transition ${isSel ? "bg-theme/[0.04]" : isCur ? "bg-theme/[0.02]" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"}`}>
                      <td className="py-1.5 px-2 text-center"><input type="checkbox" checked={isSel} onChange={(e) => { const s = new Set(selectedTrackIds); if (e.target.checked) s.add(track.id); else s.delete(track.id); setSelectedTrackIds(s); }} className="accent-theme cursor-pointer" /></td>
                      <td className="py-1.5 px-2 text-center font-mono text-neutral-400">{isCur && player.isPlaying ? <span className="text-theme font-bold">▶</span> : `#${idx + 1}`}</td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-2">
                          {track.pic ? <img src={track.pic} alt="" className="h-6 w-6 rounded-md object-cover shrink-0" /> : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/5 dark:bg-white/5 text-neutral-400 text-xs"><i className="ri-music-line" /></span>}
                          <div className="truncate"><span className={`font-bold block truncate ${isCur ? "text-theme" : "t-primary"}`}>{track.name}</span><span className="text-[10px] text-neutral-400 block truncate">{track.artist}</span></div>
                        </div>
                      </td>
                      <td className="py-1.5 px-2"><span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-neutral-500">{track.sourceName || track.source || "自定义"}</span></td>
                      <td className="py-1.5 px-2 text-right pr-3">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => player.play(track)} className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 transition" title="播放"><i className="ri-play-fill text-xs" /></button>
                          <button type="button" onClick={() => player.removeTrack(track.id)} className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-black/5 transition" title="删除"><i className="ri-delete-bin-line text-xs" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 手动录入自定义直链 */}
          <div className="p-3 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.01] dark:bg-white/[0.01] space-y-2 text-xs">
            <span className="font-bold text-[11px] t-primary block">手动录入音频直链 (OpenList / CDN)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="歌曲名称 (必填)" className="rounded-lg border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-2.5 py-1 text-xs outline-none focus:border-theme" />
              <input type="text" value={customArtist} onChange={(e) => setCustomArtist(e.target.value)} placeholder="歌手 (选填)" className="rounded-lg border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-2.5 py-1 text-xs outline-none focus:border-theme" />
              <input type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="音频直链 URL (必填)" className="sm:col-span-2 rounded-lg border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-2.5 py-1 font-mono text-xs outline-none focus:border-theme" />
            </div>
            <div className="flex items-center justify-end pt-1">
              <button type="button" onClick={handleAddCustomTrack} className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${customStatus === "done" ? "bg-emerald-500 text-white" : "bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white"}`}>
                {customStatus === "done" ? <i className="ri-check-line" /> : <i className="ri-add-line" />}<span>{customStatus === "done" ? "已加入 ✓" : "添加至队列"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
