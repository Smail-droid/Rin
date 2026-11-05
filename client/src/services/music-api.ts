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
  { id: "netease", name: "网易云音乐 (Netease)", stable: true },
  { id: "tencent", name: "QQ 音乐 (Tencent)", stable: true },
  { id: "bilibili", name: "哔哩哔哩音频 (Bilibili)", stable: true },
  { id: "joox", name: "JOOX 音乐", stable: true },
  { id: "kuwo", name: "酷我音乐 (Kuwo)", stable: false },
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
   * 搜索歌曲列表 (带边缘 Worker 双通道自动降级兜底)
   */
  async search(keyword: string, source = "netease", page = 1, count = 15): Promise<GdSearchResultItem[]> {
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
    } catch {
      // 直连失败，平滑降级至本站 Worker 边缘代理服务
    }

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
      console.warn("[GdMusicService] Both direct and proxy search failed:", e);
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
      sourceName: `GD Studio · ${item.source}`,
    };
  }
}

export const gdMusicService = new GdMusicService();
