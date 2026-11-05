import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { client } from "../app/runtime";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { useMusicPlayer, DEFAULT_PRESET_TRACKS } from "../components/music-player/music-player-context";
import {
  gdMusicService,
  GD_MUSIC_SOURCES,
  type GdSearchResultItem,
} from "../services/music-api";
import type { MusicTrack } from "../components/music-player/types";

export function AdminMusicPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const player = useMusicPlayer();

  const [saving, setSaving] = useState(false);

  // 1. 全局基础配置
  const [musicEnabled, setMusicEnabled] = useState(() => siteConfig.musicEnabled);
  const [musicAutoPlay, setMusicAutoPlay] = useState(() => siteConfig.musicAutoPlay);
  const [musicPosition, setMusicPosition] = useState(() => siteConfig.musicPosition || "bottom-right");
  const [musicSourceType, setMusicSourceType] = useState(() => siteConfig.musicSourceType || "gdstudio");

  // 2. GD Studio API 配置
  const [gdApi, setGdApi] = useState(() => siteConfig.musicGdApi || "https://music-api.gdstudio.xyz/api.php");
  const [gdSource, setGdSource] = useState(() => siteConfig.musicGdSource || "netease");

  // 3. OpenList 5T 挂载配置
  const [openlistMusicUrl, setOpenlistMusicUrl] = useState(() => siteConfig.musicOpenlistUrl || "");

  // 4. GD Studio 实时搜索体验器
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GdSearchResultItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string | number | null>(null);

  // 5. 手动添加自定义单曲表单弹窗
  const [customName, setCustomName] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customPic, setCustomPic] = useState("");
  const [customLyric, setCustomLyric] = useState("");

  // 同步基础配置
  useEffect(() => {
    setMusicEnabled(siteConfig.musicEnabled);
    setMusicAutoPlay(siteConfig.musicAutoPlay);
    setMusicPosition(siteConfig.musicPosition || "bottom-right");
    setMusicSourceType(siteConfig.musicSourceType || "gdstudio");
    setGdApi(siteConfig.musicGdApi || "https://music-api.gdstudio.xyz/api.php");
    setGdSource(siteConfig.musicGdSource || "netease");
    setOpenlistMusicUrl(siteConfig.musicOpenlistUrl || "");
  }, [
    siteConfig.musicEnabled,
    siteConfig.musicAutoPlay,
    siteConfig.musicPosition,
    siteConfig.musicSourceType,
    siteConfig.musicGdApi,
    siteConfig.musicGdSource,
    siteConfig.musicOpenlistUrl,
  ]);

  // 保存全部音乐配置
  const handleSave = async () => {
    setSaving(true);
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
      showAlert("✨ 全站音乐电台配置已成功保存！前台所有页面均可无缝跨页沉浸收听。");
    } catch (err: any) {
      showAlert(`保存失败: ${err.message || "网络异常"}`);
    } finally {
      setSaving(false);
    }
  };

  // 触发 GD Studio 搜索
  const handleSearch = async () => {
    const kw = searchKeyword.trim();
    if (!kw) {
      showAlert("请输入搜索关键字（歌曲名、歌手或专辑）");
      return;
    }
    setIsSearching(true);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const items = await gdMusicService.search(kw, gdSource, 1, 15);
      setSearchResults(items);
      if (items.length === 0) {
        showAlert("未找到匹配歌曲，建议切换音乐源重试（如网易云、QQ音乐或哔哩哔哩）");
      }
    } catch (err: any) {
      showAlert(`搜索异常: ${err.message || "网络连接超时"}`);
    } finally {
      setIsSearching(false);
    }
  };

  // 试听或添加单曲
  const handleResolveAndPlay = async (item: GdSearchResultItem, playNow = true) => {
    setResolvingId(item.id);
    gdMusicService.setEndpoint(gdApi.trim());
    try {
      const track = await gdMusicService.resolveTrack(item, 320);
      if (!track || !track.url) {
        showAlert(`无法获取「${item.name}」的播放音频流，可能受地区或版权限制，请尝试切换音乐源。`);
        return;
      }
      player.addTrack(track, playNow);
      showAlert(
        playNow
          ? `🎶 正在播放「${track.name} - ${track.artist}」并已收录至前台播放列表！`
          : `✅ 已将「${track.name}」加入前台电台列表！`
      );
    } catch (err: any) {
      showAlert(`解析失败: ${err.message || "网络超时"}`);
    } finally {
      setResolvingId(null);
    }
  };

  // 添加自定义单曲
  const handleAddCustomTrack = () => {
    if (!customName.trim() || !customUrl.trim()) {
      showAlert("歌曲名称和音频直链 URL 不能为空！");
      return;
    }
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
    showAlert(`已成功添加「${newTrack.name}」并开始播放！记得点击右上角保存配置以持久生效。`);
  };

  // 从已挂载的 OpenList 音频目录一键添加曲目
  const handleAddFromOpenList = () => {
    const base = openlistMusicUrl.trim() || siteConfig.openlistWorkerUrl;
    if (!base) {
      showAlert("请先填写 OpenList 音频直链地址或在网盘页面绑定 OpenList Worker！");
      return;
    }
    setCustomUrl(base.endsWith("/") ? `${base}your_song.mp3` : `${base}/your_song.mp3`);
    setCustomName("5T 云盘精选原声");
    setCustomArtist("Google One 云端音乐库");
    showAlert("已自动回填 OpenList 示例地址，请将文件名修改为您 5T 网盘里的实际音频文件名！");
  };

  return (
    <div className="flex w-full flex-col gap-4 ani-show">
      <Helmet>
        <title>{`全站音乐电台 · 媒体中枢 - ${siteConfig.name}`}</title>
      </Helmet>
      <AlertUI />

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
              原生 SPA 跨页面无缝播放 · 对接 GD Studio 聚合音乐 API 与 OpenList 5T 音频目录直链
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-2xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition"
          >
            {saving ? "保存中..." : "保存全部配置"}
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

      {/* 模块 2: GD Studio 聚合音乐 API 对接中枢 */}
      <div className="p-4 sm:p-5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-black/5 dark:border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500 text-xs">
              <i className="ri-radio-2-line" />
            </span>
            <h3 className="font-bold text-xs t-primary">GD Studio 聚合在线音乐平台对接</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-theme/10 text-theme font-bold">
              API DOCKED
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            遵循 CC BY-NC 4.0 协议 · 敬谢开源原作者
          </span>
        </div>

        {/* API 核心参数 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">
              GD Studio API 端点 URL
            </label>
            <input
              type="url"
              value={gdApi}
              onChange={(e) => setGdApi(e.target.value)}
              placeholder="https://music-api.gdstudio.xyz/api.php"
              className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3.5 py-2 text-xs font-mono t-primary outline-none focus:border-theme transition"
            />
            <span className="text-[10px] text-neutral-400 block">
              GD 音乐台官方在线解析端点，支持多源跨平台无损音频检索
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-theme">
              默认音源平台 (Source)
            </label>
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
                </button>
              ))}
            </div>
            <span className="text-[10px] text-neutral-400 block mt-1">
              推荐使用绿点稳定音源（网易云、QQ音乐、B站视频原声）
            </span>
          </div>
        </div>

        {/* 实时点歌台与试听验证器 */}
        <div className="p-4 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold t-primary flex items-center gap-1.5">
              <i className="ri-search-eye-line text-theme" />
              <span>在线试听与一键收录点歌台</span>
            </span>
            <span className="text-[11px] text-neutral-400">直接搜歌试听并加进博客播放列表</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="输入曲目名、歌手或专辑名（例如：周杰伦、海阔天空、Lofi）..."
              className="flex-1 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3.5 py-2 text-xs t-primary outline-none focus:border-theme transition"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 rounded-xl bg-theme text-white text-xs font-bold shadow-xs hover:bg-theme-hover active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {isSearching ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}
              <span>{isSearching ? "检索中..." : "在线搜索"}</span>
            </button>
          </div>

          {/* 搜索结果列表 */}
          {searchResults.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-black/10 dark:border-white/10 bg-w divide-y divide-black/5 dark:divide-white/5 text-xs">
              {searchResults.map((item) => {
                const isResolving = resolvingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-2.5 flex items-center justify-between gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-theme text-xs font-mono font-bold">
                        ♪
                      </span>
                      <div className="truncate">
                        <span className="font-bold t-primary truncate block">{item.name}</span>
                        <span className="text-[11px] text-neutral-400 truncate block">
                          {Array.isArray(item.artist) ? item.artist.join(" / ") : item.artist}
                          {item.album && ` · 《${item.album}》`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-neutral-400 uppercase">
                        {item.source}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResolveAndPlay(item, true)}
                        disabled={isResolving}
                        className="px-2.5 py-1 rounded-lg bg-theme/10 hover:bg-theme/20 text-theme text-xs font-semibold transition flex items-center gap-1"
                        title="立即试听并加入播放器"
                      >
                        {isResolving ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-play-fill" />}
                        <span>试听</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveAndPlay(item, false)}
                        disabled={isResolving}
                        className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 text-neutral-600 dark:text-neutral-300 text-xs font-semibold transition flex items-center gap-1"
                        title="收录至博客固定歌单"
                      >
                        <i className="ri-add-line" />
                        <span>收录</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 模块 3: OpenList 5T 音频目录直链对接 */}
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

      {/* 模块 4: 当前前台播放队列高密超级表格管理 (Dense DataGrid) */}
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
                showAlert("已恢复系统默认唯美二次元画廊氛围曲目！");
              }}
              className="text-xs text-neutral-400 hover:text-theme transition"
            >
              恢复预设曲目
            </button>
            <button
              type="button"
              onClick={() => {
                player.clearPlaylist();
                showAlert("播放列表已清空！");
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
                            onClick={() => player.removeTrack(track.id)}
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
              className="px-4 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white text-xs font-bold transition flex items-center gap-1"
            >
              <i className="ri-add-line" />
              <span>添加至播放队列并开播</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
