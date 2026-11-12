import type { MusicTrack } from "../components/music-player/types";
import { getAuthToken } from "../utils/auth";

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

    // 1. 优先走同源 Worker 边缘代理 (彻底消灭浏览器跨域 CORS 拦截与 net::ERR_FAILED 红色报错)
    try {
      const fallbackUrl = `/api/music/search?${q.toString()}`;
      const resp = await fetch(fallbackUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          return this.normalizeResults(data, source);
        }
      }
    } catch {}

    // 2. 独立调试兜底
    if (this.baseEndpoint && !this.baseEndpoint.startsWith("/")) {
      try {
        const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            return this.normalizeResults(data, source);
          }
        }
      } catch (e) {
        console.warn(`[GdMusicService] Direct search for source ${source} failed:`, e);
      }
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
      const fallbackUrl = `/api/music/song?${q.toString()}`;
      const resp = await fetch(fallbackUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.url) return data.url;
      }
    } catch {}

    if (this.baseEndpoint && !this.baseEndpoint.startsWith("/")) {
      try {
        const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data?.url) return data.url;
        }
      } catch {}
    }

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
      const resp = await fetch(`/api/music/pic?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.url) return data.url;
      }
    } catch {}

    if (this.baseEndpoint && !this.baseEndpoint.startsWith("/")) {
      try {
        const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data?.url) return data.url;
        }
      } catch {}
    }

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
      const resp = await fetch(`/api/music/lyric?${q.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.lyric) return data.lyric;
      }
    } catch {}

    if (this.baseEndpoint && !this.baseEndpoint.startsWith("/")) {
      try {
        const resp = await fetch(`${this.baseEndpoint}?${q.toString()}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data?.lyric) return data.lyric;
        }
      } catch {}
    }

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

  /**
   * 深度全盘连续翻页扫描，并发探测并排除受限无效曲目
   */
  async deepScanAndVerify(
    keyword: string,
    source = "all",
    maxPages = 3,
    onProgress?: (totalFound: number, verified: number, excluded: number) => void
  ): Promise<{ validTracks: MusicTrack[]; excludedCount: number }> {
    const candidateItems: GdSearchResultItem[] = [];
    const seen = new Set<string>();

    // 1. 多页并发检索聚合
    const pagePromises = Array.from({ length: maxPages }, (_, i) => i + 1).map((page) =>
      this.search(keyword, source, page, 25)
    );
    const pageSettled = await Promise.allSettled(pagePromises);

    for (const res of pageSettled) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        for (const item of res.value) {
          const key = `${item.name}-${Array.isArray(item.artist) ? item.artist.join("/") : item.artist}`;
          if (!seen.has(key)) {
            seen.add(key);
            candidateItems.push(item);
          }
        }
      }
    }

    // 2. 并发探测并排除受限曲目 (分批并发，兼顾速度与防频控)
    const validTracks: MusicTrack[] = [];
    let excludedCount = 0;
    const batchSize = 4;

    for (let i = 0; i < candidateItems.length; i += batchSize) {
      const batch = candidateItems.slice(i, i + batchSize);
      const probePromises = batch.map((item) => this.resolveTrackWithFallback(item, 128));
      const settled = await Promise.allSettled(probePromises);

      settled.forEach((pRes) => {
        if (pRes.status === "fulfilled" && pRes.value.track && pRes.value.track.url) {
          validTracks.push(pRes.value.track);
        } else {
          excludedCount++;
        }
      });

      if (onProgress) {
        onProgress(candidateItems.length, validTracks.length, excludedCount);
      }
    }

    return { validTracks, excludedCount };
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

/**
 * 将第三方临时音频直链高速转存至本站 Cloudflare R2 存储桶，获取永久 HTTPS 直链
 */
export async function persistTrackToR2(track: {
  url: string;
  trackId: string | number;
  name: string;
  pic?: string;
  artist?: string;
}): Promise<{ url: string | null; pic?: string }> {
  try {
    const token = getAuthToken() || "";
    const resp = await fetch("/api/music/persist-r2", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(track),
    });
    if (!resp.ok) {
      console.warn("Persist to R2 failed with status:", resp.status);
      return { url: null };
    }
    const json = await resp.json();
    return { url: json.permanentUrl || null, pic: json.pic || track.pic || "" };
  } catch (e) {
    console.warn("Persist to R2 failed:", e);
    return { url: null };
  }
}

/**
 * 从 Cloudflare R2 存储桶中删除已转存的音频文件
 */
export async function deleteR2Track(key: string): Promise<boolean> {
  try {
    const token = getAuthToken() || "";
    const resp = await fetch(`/api/music/persist-r2?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 支持上传进度反馈与 AbortSignal 暂停/取消的原生 XMLHttpRequest 上传
 */
export interface UploadR2AudioProgressOptions {
  onProgress?: (loaded: number, total: number, percent: number) => void;
  signal?: AbortSignal;
}

export function uploadR2AudioFileWithProgress(
  file: File,
  options?: UploadR2AudioProgressOptions
): Promise<{ success: boolean; key?: string; url?: string; name?: string; error?: string }> {
  return new Promise((resolve) => {
    const token = getAuthToken() || "";
    const xhr = new XMLHttpRequest();

    if (options?.signal) {
      if (options.signal.aborted) {
        resolve({ success: false, error: "aborted" });
        return;
      }
      options.signal.addEventListener("abort", () => {
        xhr.abort();
        resolve({ success: false, error: "aborted" });
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options?.onProgress) {
        const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
        options.onProgress(e.loaded, e.total, percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch {
          resolve({ success: true });
        }
      } else {
        let err = `HTTP ${xhr.status}`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.error) err = json.error;
        } catch {}
        resolve({ success: false, error: err });
      }
    };

    xhr.onerror = () => {
      resolve({ success: false, error: "网络传输异常" });
    };

    xhr.onabort = () => {
      resolve({ success: false, error: "aborted" });
    };

    const form = new FormData();
    form.append("file", file);

    xhr.open("POST", "/api/music/upload-r2", true);
    xhr.withCredentials = true;
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.send(form);
  });
}

/**
 * 直接上传本地音频文件至 Cloudflare R2
 */
export async function uploadR2AudioFile(file: File): Promise<{ success: boolean; key?: string; url?: string; name?: string }> {
  return uploadR2AudioFileWithProgress(file);
}

/**
 * 重命名 R2 存储桶中的音频显示名称
 */
export async function renameR2Track(key: string, newName: string): Promise<boolean> {
  try {
    const token = getAuthToken() || "";
    const resp = await fetch("/api/music/rename-r2", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ key, newName }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 更新 R2 存储桶中音频的封面图片直链
 */
export async function updateR2TrackCover(key: string, pic: string): Promise<boolean> {
  try {
    const token = getAuthToken() || "";
    const resp = await fetch("/api/music/update-cover-r2", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ key, pic }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export interface R2MusicFileItem {
  key: string;
  fileName: string;
  displayName: string;
  artist?: string;
  pic?: string;
  quality?: string;
  size: number;
  uploaded: string;
  url: string;
}

/**
 * 获取 Cloudflare R2 存储桶中已持久化存储的全部音乐列表 (Navidrome 曲库视图)
 */
export async function fetchR2MusicFiles(): Promise<R2MusicFileItem[]> {
  try {
    const token = getAuthToken() || "";
    const resp = await fetch("/api/music/r2-files", {
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!resp.ok) {
      console.warn("Fetch R2 files failed with status:", resp.status);
      return [];
    }
    const json = await resp.json();
    return json.files || [];
  } catch (e) {
    console.warn("Fetch R2 files exception:", e);
    return [];
  }
}

export interface R2StorageStats {
  configured: boolean;
  imageCount: number;
  imageBytes: number;
  musicCount: number;
  musicBytes: number;
  totalBytes: number;
  freeBytesLimit: number;
  remainingBytes: number;
}

/**
 * 获取 Cloudflare R2 容量与资产统计 (图片 vs 音乐，已用与剩余)
 */
export async function fetchR2StorageStats(): Promise<R2StorageStats | null> {
  try {
    const token = getAuthToken() || "";
    const resp = await fetch("/api/storage/stats", {
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export const gdMusicService = new GdMusicService();
