import { useState } from "react";
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

// 热门榜单与精选风格预设标签
const HOT_CHART_PRESETS = [
  { label: "🔥 全网热歌榜", query: "热歌榜", source: "all" },
  { label: "🌸 二次元/ACG经典", query: "ACG经典", source: "all" },
  { label: "🌙 深夜微光 Lofi", query: "Lofi Chill", source: "all" },
  { label: "🎸 经典华语流行", query: "华语金曲", source: "netease" },
  { label: "⚡ 赛博电子律动", query: "Cyberpunk", source: "all" },
  { label: "🎹 治愈轻音乐", query: "治愈纯音乐", source: "all" },
  { label: "✨ 周杰伦精选", query: "周杰伦", source: "all" },
  { label: "🍃 经典动漫原声", query: "动漫原声", source: "bilibili" },
];

// 画廊随想精选殿堂级试听曲目库（保底稳定、开箱即用）
const GALLERY_HALL_OF_FAME_TRACKS: MusicTrack[] = [
  {
    id: "fame_1",
    name: "春の微光 (Twilight Piano & Synth)",
    artist: "Atelier Soundworks",
    album: "Gallery Memories",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    pic: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80",
    lyric: "[00:00.00]微光拂过相纸的边缘\n[00:05.00]记忆在画廊随想中悄然流淌\n[00:15.00]♪ 唯美原声，静候灵感发生 ♪",
    source: "gallery",
    sourceName: "画廊精选",
  },
  {
    id: "fame_2",
    name: "City of Starlight (Dreamy Lofi)",
    artist: "Lofi Breeze",
    album: "Midnight Chill",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    pic: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80",
    lyric: "[00:00.00]深夜星芒\n[00:06.00]夜幕低垂，屏幕前微光闪烁\n[00:20.00]♪ 随心漫游，灵感常驻 ♪",
    source: "gallery",
    sourceName: "画廊精选",
  },
  {
    id: "fame_3",
    name: "Dreamy Evening Groove",
    artist: "Acoustic Garden",
    album: "Sunset Horizons",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    pic: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80",
    lyric: "[00:00.00]落日余晖\n[00:08.00]轻盈旋律漫过每一个页面\n[00:25.00]♪ 全站跨页面沉浸流转 ♪",
    source: "gallery",
    sourceName: "画廊精选",
  },
];

export function AdminMusicPage() {
  const siteConfig = useSiteConfig();
  const player = useMusicPlayer();

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [batchStatus, setBatchStatus] = useState<"idle" | "batching" | "done">("idle");
  const [curatedStatus, setCuratedStatus] = useState<"idle" | "done">("idle");
  const [customStatus, setCustomStatus] = useState<"idle" | "done">("idle");
  const [unplayableIds, setUnplayableIds] = useState<Set<string | number>>(new Set());

  // 1. 全局基础配置
  const [musicEnabled, setMusicEnabled] = useState(() => siteConfig.musicEnabled);
  const [musicAutoPlay, setMusicAutoPlay] = useState(() => siteConfig.musicAutoPlay);
  const [musicPosition, setMusicPosition] = useState(() => siteConfig.musicPosition || "bottom-right");
  const [musicSourceType] = useState(() => siteConfig.musicSourceType || "gdstudio");

  // 2. GD Studio API 配置 (默认全网聚合)
  const [gdApi] = useState(() => siteConfig.musicGdApi || "https://music-api.gdstudio.xyz/api.php");
  const [gdSource, setGdSource] = useState(() => siteConfig.musicGdSource || "all");

  // 3. OpenList 5T 挂载配置
  const [openlistMusicUrl, setOpenlistMusicUrl] = useState(() => siteConfig.musicOpenlistUrl || "");

  // 4. GD Studio 实时搜索与榜单
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchMode, setSearchMode] = useState<"song" | "album">("song");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GdSearchResultItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string | number | null>(null);

  // 5. 手动添加自定义单曲表单
  const [customName, setCustomName] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customPic, setCustomPic] = useState("");
  const [customLyric, setCustomLyric] = useState("");

  // 保存全部音乐配置 (无弹窗打扰，按钮原生状态流转)
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

  // 触发 GD Studio 搜索 (支持全网聚合 & 专辑模式，无弹窗打扰)
  const handleSearch = async (overrideKw?: string, overrideSource?: string) => {
    const kw = (overrideKw ?? searchKeyword).trim();
    if (!kw) return;
    const targetSource = overrideSource ?? gdSource;
    setIsSearching(true);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const finalSource = searchMode === "album" && targetSource !== "all" ? `${targetSource}_album` : targetSource;
      const items = await gdMusicService.search(kw, finalSource, 1, 20);
      setSearchResults(items);
    } catch (e) {
      console.warn("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  // 试听或添加单曲（绝不弹窗打扰！原地亮色变更为已收录 / 播放中）
  const handleResolveAndPlay = async (item: GdSearchResultItem, playNow = true) => {
    setResolvingId(item.id);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const track = await gdMusicService.resolveTrack(item, 320);
      if (!track || !track.url) {
        setUnplayableIds((prev) => new Set(prev).add(item.id));
        return;
      }
      player.addTrack(track, playNow);
    } catch {
      setUnplayableIds((prev) => new Set(prev).add(item.id));
    } finally {
      setResolvingId(null);
    }
  };

  // 一键全量收录当前搜索结果 (按钮直接状态流转)
  const handleBatchCollect = async () => {
    if (searchResults.length === 0) return;
    setBatchStatus("batching");
    gdMusicService.setEndpoint(gdApi.trim());

    // 批量解析前 8 首
    const candidates = searchResults.slice(0, 8);
    for (const item of candidates) {
      try {
        const track = await gdMusicService.resolveTrack(item, 320);
        if (track && track.url) {
          player.addTrack(track, false);
        }
      } catch {}
    }
    setBatchStatus("done");
    setTimeout(() => setBatchStatus("idle"), 2500);
  };

  // 添加自定义单曲 (无弹窗打扰)
  const handleAddCustomTrack = () => {
    if (!customName.trim() || !customUrl.trim()) return;
    const newTrack: MusicTrack = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      artist: customArtist.trim() || "未知艺术家",
      url: customUrl.trim(),
      pic: customPic.trim(),
      lyric: customLyric.trim(),
      source: "custom",
      sourceName: "自定义直链",
    };
    player.addTrack(newTrack, true);
    setCustomName("");
    setCustomArtist("");
    setCustomUrl("");
    setCustomPic("");
    setCustomLyric("");
    setCustomStatus("done");
    setTimeout(() => setCustomStatus("idle"), 2500);
  };

  // 从已挂载的 OpenList 音频目录一键添加曲目
  const handleAddFromOpenList = () => {
    const base = openlistMusicUrl.trim() || siteConfig.openlistWorkerUrl;
    if (!base) return;
    setCustomUrl(base.endsWith("/") ? `${base}your_song.mp3` : `${base}/your_song.mp3`);
    setCustomName("5T 云盘精选原声");
    setCustomArtist("Google One 云端音乐库");
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show">
      <Helmet>
        <title>{`全站音乐电台 · 媒体中枢 - ${siteConfig.name}`}</title>
      </Helmet>

      {/* 顶部运行状态切片中枢 */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-theme/10 text-theme text-2xl shadow-2xs">
            <i className="ri-disc-line" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold t-primary">全站跨页沉浸式微光音乐电台</h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                musicEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-neutral-500/10 text-neutral-400"
              }`}>
                {musicEnabled ? "电台已启用" : "未开启"}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              原生 SPA 跨页面无缝播放 · 全网聚合搜索 · 对接 GD Studio 与 OpenList 5T 音频目录直链
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60 ${
              saveStatus === "saved"
                ? "bg-emerald-500 text-white shadow-emerald-500/20"
                : saveStatus === "error"
                ? "bg-rose-500 text-white"
                : "bg-theme text-white hover:bg-theme-hover"
            }`}
          >
            {saveStatus === "saving" && <i className="ri-loader-4-line animate-spin" />}
            {saveStatus === "saved" && <i className="ri-check-line" />}
            <span>
              {saveStatus === "saving"
                ? "保存中..."
                : saveStatus === "saved"
                ? "配置已保存 ✓"
                : saveStatus === "error"
                ? "保存失败，点击重试"
                : "保存全部配置"}
            </span>
          </button>
        </div>
      </div>

      {/* 模块 1: 全局播放器基础控制 */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-black/5 dark:border-white/5">
          <i className="ri-settings-3-line text-theme" />
          <h3 className="font-bold text-xs t-primary">播放器全局开关与排布模式</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* 播放器总开关 */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs t-primary block">前台启用音乐播放器</span>
              <span className="text-[11px] text-neutral-400">悬浮呈现旋转唱片胶囊</span>
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

          {/* 自动播放 */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs t-primary block">尝试进入自动播放</span>
              <span className="text-[11px] text-neutral-400">受现代浏览器策略保护限制</span>
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

          {/* 屏幕悬浮位置 */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs t-primary block">悬浮挂件停靠方位</span>
              <span className="text-[11px] text-neutral-400">避免遮挡右下角其他组件</span>
            </div>
            <div className="flex items-center gap-1">
              {[
                { id: "bottom-right", label: "右下角" },
                { id: "bottom-left", label: "左下角" },
              ].map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setMusicPosition(pos.id)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition select-none ${
                    musicPosition === pos.id
                      ? "bg-theme text-white shadow-2xs font-bold"
                      : "bg-black/5 dark:bg-white/5 text-neutral-500"
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 模块 2: GD Studio 聚合在线音乐平台对接中枢 (全网聚合 + 热歌榜单 + 歌单检索) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500 text-xs">
              <i className="ri-radio-2-line" />
            </span>
            <h3 className="font-bold text-xs t-primary">GD Studio 聚合在线音乐平台对接</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-theme/10 text-theme font-bold">
              全网聚合
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            遵循 CC BY-NC 4.0 协议 · 敬谢开源原作者
          </span>
        </div>

        {/* 热门榜单与精选风格快速入口 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <i className="ri-fire-fill text-amber-500" />
              <span>热门榜单与精选风格快速检索</span>
            </span>
            <span className="text-[10px] text-neutral-400">点击任意标签即刻调取聚合搜索</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {HOT_CHART_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setSearchKeyword(preset.query);
                  setGdSource(preset.source);
                  void handleSearch(preset.query, preset.source);
                }}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-black/[0.03] dark:bg-white/[0.04] hover:bg-theme/10 hover:text-theme border border-black/5 dark:border-white/5 transition select-none active:scale-95"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* 音乐源切换与单曲/专辑模式 */}
        <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-xs t-primary">音乐源平台选择</span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                默认推荐【全网聚合搜索】，一次性并发检索网易云、QQ音乐、B站视频音频与JOOX
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setSearchMode("song")}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition ${
                  searchMode === "song" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                }`}
              >
                单曲模式
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("album")}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition ${
                  searchMode === "album" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400"
                }`}
              >
                歌单/专辑模式
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {GD_MUSIC_SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setGdSource(s.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition select-none flex items-center gap-1 ${
                  gdSource === s.id
                    ? "bg-theme text-white shadow-2xs font-bold"
                    : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-black/10"
                }`}
              >
                <span>{s.name}</span>
                {s.stable && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />}
                {!s.stable && <span className="text-[9px] text-neutral-400">(维护中)</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 实时搜索输入框与一键批量收录 */}
        <div className="space-y-3">
          <div className="flex gap-2 text-xs">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={searchMode === "album" ? "输入专辑/歌单名称（如：叶惠美、跨时代）..." : "输入曲目名、歌手或热词（例如：周杰伦、海阔天空、Lofi）..."}
              className="flex-1 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3.5 py-2 text-xs t-primary outline-none focus:border-theme transition"
            />
            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="px-5 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {isSearching ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}
              <span>{isSearching ? "检索中..." : "聚合搜索"}</span>
            </button>
          </div>

          {/* 搜索结果展示与行内状态变换 (无任何弹窗打扰) */}
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-w overflow-hidden text-xs">
              <div className="p-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between text-neutral-400">
                <span className="font-mono text-[11px]">共检索到 {searchResults.length} 条曲目</span>
                <button
                  type="button"
                  onClick={handleBatchCollect}
                  disabled={batchStatus === "batching"}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    batchStatus === "done"
                      ? "bg-emerald-500 text-white shadow-2xs"
                      : "bg-theme/10 hover:bg-theme/20 text-theme"
                  }`}
                  title="一键将前 8 首全量添加到前台播放队列"
                >
                  {batchStatus === "batching" && <i className="ri-loader-4-line animate-spin" />}
                  {batchStatus === "done" && <i className="ri-check-line" />}
                  {batchStatus === "idle" && <i className="ri-play-list-add-line" />}
                  <span>{batchStatus === "batching" ? "收录中..." : batchStatus === "done" ? "已批量收录前 8 首 ✓" : "一键全收录前 8 首"}</span>
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
                {searchResults.map((item) => {
                  const isResolving = resolvingId === item.id;
                  const artistStr = Array.isArray(item.artist) ? item.artist.join(" / ") : item.artist;
                  const isCollected = player.playlist.some(
                    (p) => String(p.id).includes(String(item.id)) || (p.name === item.name && p.artist === artistStr)
                  );
                  const isPlayingThis = player.isPlaying && player.currentTrack?.name === item.name;

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 flex items-center justify-between gap-3 transition ${
                        isCollected ? "bg-emerald-500/[0.02]" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-mono font-bold ${
                          isCollected ? "bg-emerald-500/10 text-emerald-600" : "bg-theme/10 text-theme"
                        }`}>
                          ♪
                        </span>
                        <div className="truncate">
                          <span className={`font-bold truncate block ${isCollected ? "text-emerald-700 dark:text-emerald-300" : "t-primary"}`}>
                            {item.name}
                          </span>
                          <span className="text-[11px] text-neutral-400 truncate block">
                            {artistStr} {item.album && ` · 《${item.album}》`}
                          </span>
                          {unplayableIds.has(item.id) && (
                            <span className="text-[10px] text-amber-500 font-medium block truncate mt-0.5">
                              ⚠️ 该版本受源站保护暂无法试听，建议选择下方其他版本
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-neutral-400 uppercase">
                          {item.source}
                        </span>

                        {/* 试听按钮 (原地播放动效，遇源站受限则直接静默提示) */}
                        {unplayableIds.has(item.id) ? (
                          <span
                            className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-400 text-xs flex items-center gap-1 select-none"
                            title="该版本受源站保护暂无法试听"
                          >
                            <i className="ri-forbid-line text-xs" />
                            <span>源站受限</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (isPlayingThis) {
                                player.pause();
                              } else {
                                handleResolveAndPlay(item, true);
                              }
                            }}
                            disabled={isResolving}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 select-none ${
                              isPlayingThis
                                ? "bg-theme text-white shadow-2xs font-bold animate-pulse"
                                : "bg-theme/10 hover:bg-theme/20 text-theme"
                            }`}
                            title="试听这首"
                          >
                            {isResolving ? (
                              <i className="ri-loader-4-line animate-spin" />
                            ) : isPlayingThis ? (
                              <i className="ri-pause-fill" />
                            ) : (
                              <i className="ri-play-fill" />
                            )}
                            <span>{isPlayingThis ? "播放中" : "试听"}</span>
                          </button>
                        )}

                        {/* 收录按钮 (亮色变更为已收录，绝不弹窗打扰！) */}
                        {isCollected ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 text-xs flex items-center gap-1 select-none">
                            <i className="ri-check-line" />
                            <span>已收录</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleResolveAndPlay(item, false)}
                            disabled={isResolving}
                            className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white text-neutral-600 dark:text-neutral-300 text-xs font-semibold transition flex items-center gap-1 select-none active:scale-95"
                            title="一键收录到前台播放歌单"
                          >
                            <i className="ri-add-line" />
                            <span>收录</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 模块 3: 二次元画廊精选殿堂级推荐歌单 (Gallery Picks) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 text-xs">
              <i className="ri-sparkling-fill" />
            </span>
            <h3 className="font-bold text-xs t-primary">二次元画廊精选殿堂级微光歌单</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
              CURATED
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              GALLERY_HALL_OF_FAME_TRACKS.forEach((t) => player.addTrack(t, false));
              setCuratedStatus("done");
              setTimeout(() => setCuratedStatus("idle"), 2500);
            }}
            className={`text-xs font-bold flex items-center gap-1 transition-all ${
              curatedStatus === "done" ? "text-emerald-500 font-extrabold" : "text-theme hover:underline"
            }`}
          >
            {curatedStatus === "done" ? <i className="ri-check-line" /> : <i className="ri-download-cloud-line" />}
            <span>{curatedStatus === "done" ? "已全部载入歌单 ✓" : "一键全量载入精选曲目"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {GALLERY_HALL_OF_FAME_TRACKS.map((t) => {
            const isPlayingThis = player.isPlaying && player.currentTrack?.name === t.name;
            const isCollected = player.playlist.some((p) => p.name === t.name);
            return (
              <div
                key={t.id}
                className="p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src={t.pic} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-xs t-primary truncate block">{t.name}</span>
                    <span className="text-[10px] text-neutral-400 truncate block">{t.artist}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlayingThis) player.pause();
                      else player.addTrack(t, true);
                    }}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      isPlayingThis ? "bg-theme text-white" : "bg-theme/10 text-theme hover:bg-theme/20"
                    }`}
                    title={isPlayingThis ? "暂停" : "试听"}
                  >
                    <i className={isPlayingThis ? "ri-pause-fill" : "ri-play-fill"} />
                  </button>
                  {isCollected ? (
                    <span className="p-1 rounded-lg text-emerald-500 text-xs" title="已在队列中">
                      <i className="ri-check-line" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        player.addTrack(t, false);
                      }}
                      className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 text-xs text-neutral-500"
                      title="收录此曲"
                    >
                      <i className="ri-add-line" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 模块 4: OpenList 5T 音频目录直链对接 */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 text-xs">
              <i className="ri-hard-drive-2-line" />
            </span>
            <h3 className="font-bold text-xs t-primary">OpenList 5T 音频库直链挂载</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
              EDGE MOUNT
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddFromOpenList}
            className="text-xs text-theme hover:underline font-semibold flex items-center gap-1"
          >
            <i className="ri-magic-line" />
            <span>自动填入已绑定的 OpenList Worker 路径</span>
          </button>
        </div>

        <div className="space-y-1.5 text-xs">
          <label className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            OpenList 音乐文件夹或音频直链路径
          </label>
          <input
            type="url"
            value={openlistMusicUrl}
            onChange={(e) => setOpenlistMusicUrl(e.target.value)}
            placeholder="https://openlist.yourdomain.com/5T/Music/"
            className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3.5 py-2 text-xs font-mono t-primary outline-none focus:border-theme transition"
          />
          <span className="text-[10px] text-neutral-400 block">
            将 Google One 5T 云盘中存放的 FLAC/MP3/AAC 无损音乐目录直链填入此处，OpenList 将提供全球 CDN 边缘直连流媒体播放
          </span>
        </div>
      </div>

      {/* 模块 5: 当前前台播放队列高密超级表格管理 (Dense DataGrid) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 text-xs">
              <i className="ri-play-list-2-line" />
            </span>
            <h3 className="font-bold text-xs t-primary">前台播放队列管理 (共 {player.playlist.length} 首)</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                player.setPlaylist(DEFAULT_PRESET_TRACKS);
              }}
              className="text-xs text-neutral-400 hover:text-theme transition"
            >
              恢复预设曲目
            </button>
            <button
              type="button"
              onClick={() => {
                player.clearPlaylist();
              }}
              className="text-xs text-red-500 hover:underline"
            >
              清空队列
            </button>
          </div>
        </div>

        {/* 高密表格 */}
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 bg-w">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">曲目名与艺术家</th>
                <th className="py-2.5 px-3 w-28">音源平台</th>
                <th className="py-2.5 px-3 w-28 text-right pr-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {player.playlist.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-neutral-400">
                    暂无播放曲目，请使用上方点歌台搜索添加，或手动录入音频直链
                  </td>
                </tr>
              ) : (
                player.playlist.map((track, idx) => {
                  const isCurrent = player.currentTrack?.id === track.id;
                  return (
                    <tr
                      key={track.id || idx}
                      className={`hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition ${
                        isCurrent ? "bg-theme/[0.03]" : ""
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono text-neutral-400">
                        {isCurrent && player.isPlaying ? (
                          <span className="text-theme font-bold">▶</span>
                        ) : (
                          `#${idx + 1}`
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {track.pic ? (
                            <img src={track.pic} alt="" className="h-7 w-7 rounded-lg object-cover" />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 text-neutral-400">
                              ♪
                            </span>
                          )}
                          <div className="truncate">
                            <span className={`font-bold block truncate ${isCurrent ? "text-theme" : "t-primary"}`}>
                              {track.name}
                            </span>
                            <span className="text-[11px] text-neutral-400 block truncate">
                              {track.artist}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-neutral-500">
                          {track.sourceName || track.source || "自定义"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right pr-4">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => player.play(track)}
                            className="p-1 rounded-md text-neutral-400 hover:text-theme hover:bg-black/5 transition"
                            title="播放这首"
                          >
                            <i className="ri-play-fill text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              player.removeTrack(track.id);
                            }}
                            className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-black/5 transition"
                            title="从队列删除"
                          >
                            <i className="ri-delete-bin-line text-sm" />
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

        {/* 手动添加外链单曲快速表单 */}
        <div className="p-3.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.01] dark:bg-white/[0.01] space-y-3">
          <span className="text-xs font-bold t-primary block">手动录入自定义音频直链曲目 (支持 OpenList / 本地 / CDN)</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="歌曲名称 (必填)"
              className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 outline-none focus:border-theme"
            />
            <input
              type="text"
              value={customArtist}
              onChange={(e) => setCustomArtist(e.target.value)}
              placeholder="演唱/艺术家 (选填)"
              className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 outline-none focus:border-theme"
            />
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="音频直链 URL (.mp3/.flac) (必填)"
              className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 font-mono outline-none focus:border-theme"
            />
            <input
              type="url"
              value={customPic}
              onChange={(e) => setCustomPic(e.target.value)}
              placeholder="封面图片 URL (选填)"
              className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 font-mono outline-none focus:border-theme"
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleAddCustomTrack}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                customStatus === "done"
                  ? "bg-emerald-500 text-white"
                  : "bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white"
              }`}
            >
              {customStatus === "done" ? <i className="ri-check-line" /> : <i className="ri-add-line" />}
              <span>{customStatus === "done" ? "已成功添加至队列 ✓" : "添加至播放队列并开播"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
