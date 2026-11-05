import type { MusicTrack } from "../components/music-player/types";

export interface GdSearchResultItem {
  id: string | number;
  name: string;
  artist: string[] | string;
  album?: string;
  pic_id?: string | number;
  lyric_id?: string | number;
  source: string;
}

export const GD_MUSIC_SOURCES = [
  { id: "all", name: "全网聚合 (并发检索)", stable: true },
  { id: "netease", name: "网易云音乐", stable: true },
  { id: "bilibili", name: "哔哩哔哩音频", stable: true },
  { id: "joox", name: "JOOX 音乐", stable: true },
  { id: "tencent", name: "QQ 音乐", stable: true },
  { id: "kuwo", name: "酷我音乐", stable: false },
  { id: "apple", name: "Apple Music", stable: false },
  { id: "spotify", name: "Spotify", stable: false },
] as const;

export class GdMusicService {
  private baseEndpoint: string;

  constructor(endpoint = "https://music-api.gdstudio.xyz/api.php") {
    this.baseEndpoint = endpoint || "https://music-api.gdstudio.xyz/api.php";
  }

  setEndpoint(endpoint: string) {
    if (endpoint) {
      this.baseEndpoint = endpoint;
    }
  }

  /**
   * 搜索歌曲列表 (全网聚合模式下并发请求各活跃平台并合并去重)
   */
  async search(keyword: string, source = "all", page = 1, count = 20): Promise<GdSearchResultItem[]> {
    if (source === "all") {
      const activeSources = ["netease", "bilibili", "joox", "tencent"];
      const fetchList = activeSources.map((src) =>
        this.searchSingleSource(keyword, src, page, Math.ceil(count / 2))
      );
      const settled = await Promise.allSettled(fetchList);
      const merged: GdSearchResultItem[] = [];
      const seen = new Set<string>();

      for (const res of settled) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
          for (const item of res.value) {
            const key = `${item.name}-${Array.isArray(item.artist) ? item.artist.join("/") : item.artist}-${item.source}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(item);
            }
          }
        }
      }
      return merged;
    }

    return this.searchSingleSource(keyword, source, page, count);
  }

  private async searchSingleSource(keyword: string, source: string, page: number, count: number): Promise<GdSearchResultItem[]> {
    const q = new URLSearchParams({
      types: "search",
      source,
      name: keyword,
      pages: String(page),
      count: String(count),
    });

    // 优先尝试直连端点
    try {
      const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          return this.normalizeResults(data, source);
        }
      }
    } catch {}

    // 平滑降级至本站 Worker 边缘代理服务
    try {
      const fallbackUrl = `/api/music/search?${q.toString()}`;
      const resp = await fetch(fallbackUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          return this.normalizeResults(data, source);
        }
      }
    } catch (e) {
      console.warn(`[GdMusicService] Search for source ${source} failed:`, e);
    }
    return [];
  }

  private normalizeResults(data: any[], source: string): GdSearchResultItem[] {
    return data.map((item) => ({
      id: item.id,
      name: item.name || "未知曲目",
      artist: Array.isArray(item.artist) ? item.artist.join(" / ") : String(item.artist || "群星"),
      album: item.album || "",
      pic_id: item.pic_id,
      lyric_id: item.lyric_id || item.id,
      source: item.source || source,
    }));
  }

  /**
   * 获取音频真实播放直链 (带边缘 Worker 自动兜底)
   */
  async getSongUrl(id: string | number, source = "netease", br = 320): Promise<string> {
    const q = new URLSearchParams({
      types: "url",
      source,
      id: String(id),
      br: String(br),
    });

    try {
      const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.url) return data.url;
      }
    } catch {}

    try {
      const fallbackUrl = `/api/music/song?${q.toString()}`;
      const resp = await fetch(fallbackUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.url) return data.url;
      }
    } catch {}

    return "";
  }

  /**
   * 获取专辑封面高清大图
   */
  async getSongPic(picId: string | number, source = "netease", size = 300): Promise<string> {
    if (!picId) return "";
    const q = new URLSearchParams({
      types: "pic",
      source,
      id: String(picId),
      size: String(size),
    });

    try {
      const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.url) return data.url;
      }
    } catch {}

    try {
      const resp = await fetch(`/api/music/pic?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.url) return data.url;
      }
    } catch {}

    return "";
  }

  /**
   * 获取歌词 (LRC 格式)
   */
  async getSongLyric(lyricId: string | number, source = "netease"): Promise<string> {
    if (!lyricId) return "";
    const q = new URLSearchParams({
      types: "lyric",
      source,
      id: String(lyricId),
    });

    try {
      const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.lyric) return data.lyric;
      }
    } catch {}

    try {
      const resp = await fetch(`/api/music/lyric?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.lyric) return data.lyric;
      }
    } catch {}

    return "";
  }

  /**
   * 将搜索结果单曲解析为可以直接在播放器中播放的完整 Track 对象
   */
  async resolveTrack(item: GdSearchResultItem, br = 320): Promise<MusicTrack | null> {
    const [urlRes, picRes, lyricRes] = await Promise.allSettled([
      this.getSongUrl(item.id, item.source, br),
      item.pic_id ? this.getSongPic(item.pic_id, item.source, 300) : Promise.resolve(""),
      item.lyric_id ? this.getSongLyric(item.lyric_id, item.source) : Promise.resolve(""),
    ]);

    const url = urlRes.status === "fulfilled" ? urlRes.value : "";
    if (!url) return null;

    const pic = picRes.status === "fulfilled" ? picRes.value : "";
    const lyric = lyricRes.status === "fulfilled" ? lyricRes.value : "";
    const artist = Array.isArray(item.artist) ? item.artist.join(" / ") : String(item.artist || "群星");

    return {
      id: `gd_${item.source}_${item.id}`,
      name: item.name,
      artist,
      album: item.album,
      url,
      pic,
      lyric,
      source: "gdstudio",
      sourceName: item.source.toUpperCase(),
    };
  }

  /**
   * 解析单曲并支持跨音源自动降级检索
   */
  async resolveTrackWithFallback(item: GdSearchResultItem, br = 320): Promise<{ track: MusicTrack | null; fallbackSource?: string }> {
    const directTrack = await this.resolveTrack(item, br);
    if (directTrack && directTrack.url) {
      return { track: directTrack };
    }

    // 若当前音源解析失败/受限，自动搜索其他活跃源 (bilibili, joox, tencent, netease)
    const fallbackSources = ["bilibili", "joox", "tencent", "netease"].filter((s) => s !== item.source);
    const artistStr = Array.isArray(item.artist) ? item.artist[0] : item.artist;
    const query = `${item.name} ${artistStr || ""}`.trim();

    for (const src of fallbackSources) {
      try {
        const candidates = await this.searchSingleSource(query, src, 1, 3);
        if (candidates.length > 0) {
          const matched = candidates.find((c) => c.name.toLowerCase().includes(item.name.toLowerCase())) || candidates[0];
          const fallbackTrack = await this.resolveTrack(matched, br);
          if (fallbackTrack && fallbackTrack.url) {
            return {
              track: {
                ...fallbackTrack,
                name: item.name,
                sourceName: `${src.toUpperCase()} (自动降级)`,
              },
              fallbackSource: src,
            };
          }
        }
      } catch {}
    }

    return { track: null };
  }
}

/**
 * 自动从 OpenList 挂载端点扫描音频文件并转换为播放列表格式
 */
export async function syncOpenListFiles(openlistMusicUrl: string): Promise<MusicTrack[]> {
  if (!openlistMusicUrl || !openlistMusicUrl.startsWith("http")) return [];
  try {
    const parsed = new URL(openlistMusicUrl);
    const origin = parsed.origin;
    let path = parsed.pathname.replace(/\/+$/, "");
    if (!path) path = "/";

    const res = await fetch(`${origin}/api/fs/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        password: "",
        page: 1,
        per_page: 200,
        refresh: true,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.code !== 200 || !json.data?.content || !Array.isArray(json.data.content)) return [];

    const audioExtensions = /\.(mp3|flac|wav|m4a|aac|ogg|opus)$/i;
    const audioFiles = json.data.content.filter((f: any) => !f.is_dir && audioExtensions.test(f.name));

    return audioFiles.map((file: any) => {
      const cleanName = file.name.replace(audioExtensions, "");
      const parts = cleanName.split("-").map((s: string) => s.trim());
      const artist = parts.length > 1 ? parts[0] : "5T云盘原声";
      const songName = parts.length > 1 ? parts.slice(1).join("-") : parts[0];
      const directUrl = `${origin}/d${path}/${encodeURIComponent(file.name)}`;

      return {
        id: `openlist_${file.name}_${file.size || Date.now()}`,
        name: songName,
        artist,
        album: "Google One 5T 音频库",
        url: directUrl,
        pic: file.thumb || "",
        source: "openlist",
        sourceName: "5T云盘",
        group: "5T云盘",
      };
    });
  } catch (e) {
    console.warn("OpenList sync error:", e);
    return [];
  }
}

export const gdMusicService = new GdMusicService();
