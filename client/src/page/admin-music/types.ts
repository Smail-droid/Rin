import type { MusicTrack } from "../../components/music-player/types";
import type { GdSearchResultItem } from "../../services/music-api";

// 支持的音频格式集合
export const AUDIO_EXTS = new Set([
  "mp3", "flac", "wav", "m4a", "ogg", "aac", "opus", "wma", "webm", "ape", "alac", "aiff"
]);

// 单个音频文件上限 (Cloudflare Worker 请求体上限通常为 100MB)
export const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024;

// 上传并发队列上限：严格限制为最多 2 个文件并发，避免上行拥塞与 Cloudflare 边缘 Worker 超时
export const MAX_CONCURRENT_UPLOADS = 2;

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

export function isAudioFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return AUDIO_EXTS.has(ext) || file.type.startsWith("audio/");
}

// 智能清洗歌曲名称与歌手（去除前后下划线、破折号与多余空格，杜绝 _歌名 现象）
export function cleanDisplayTitle(str: string): string {
  if (!str) return "";
  return str
    .replace(/_-_/g, " - ")
    .replace(/^[\s_\-]+|[\s_\-]+$/g, "")
    .trim();
}

// 简短中文音源格式化 (严禁英文和自动降级后缀，保持纯粹简洁)
export function formatCleanSourceName(track: MusicTrack): string {
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

// 搜索结果按关键字相关度排序（精准命中歌名/歌手置顶排布）
export function sortSearchResultsByRelevance(items: GdSearchResultItem[], kw: string): GdSearchResultItem[] {
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
