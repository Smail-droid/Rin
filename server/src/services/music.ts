import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { putStorageObjectAtKey } from "../utils/storage";
import { extractAudioCover } from "../utils/audio-cover";

const MUSIC_META_KEY = "music/metadata.json";

interface TrackMeta {
  name?: string;
  artist?: string;
  album?: string;
  pic?: string;
  quality?: string;
  hash?: string;
}

async function loadMusicMetadata(env: any): Promise<Record<string, TrackMeta>> {
  if (!env.R2_BUCKET) return {};
  try {
    const obj = await env.R2_BUCKET.get(MUSIC_META_KEY);
    if (!obj) return {};
    return await obj.json();
  } catch {
    return {};
  }
}

async function saveMusicMetadata(env: any, meta: Record<string, TrackMeta>) {
  if (!env.R2_BUCKET) return;
  try {
    await env.R2_BUCKET.put(MUSIC_META_KEY, JSON.stringify(meta), {
      httpMetadata: { contentType: "application/json" },
    });
  } catch (e) {
    console.error("Failed to save music metadata index:", e);
  }
}

// 智能去除首尾下划线、破折号与多余空格
function cleanAudioMetaString(str: string): string {
  if (!str) return "";
  return str
    .replace(/_-_/g, " - ")
    .replace(/^[\s_\-]+|[\s_\-]+$/g, "")
    .trim();
}

// 智能从文件名中提取歌手与歌名
function parseAudioFileName(rawName: string): { artist: string; title: string } {
  const noExt = rawName.replace(/\.[a-zA-Z0-9]+$/, "").trim();
  let core = noExt;
  const tsMatch = noExt.match(/^\d{10,14}_(?:[a-zA-Z0-9]+_)?(.+)$/);
  if (tsMatch) core = tsMatch[1];

  let artist = "";
  let title = core;

  // 优先按常见分割符分离歌手与歌曲名
  if (core.includes("_-_")) {
    const parts = core.split("_-_");
    artist = parts[0];
    title = parts.slice(1).join(" - ");
  } else if (core.includes(" - ")) {
    const parts = core.split(" - ");
    artist = parts[0];
    title = parts.slice(1).join(" - ");
  } else if (core.includes("-")) {
    const parts = core.split("-");
    artist = parts[0];
    title = parts.slice(1).join("-");
  }

  artist = cleanAudioMetaString(artist);
  title = cleanAudioMetaString(title);

  return { artist, title: title || cleanAudioMetaString(core) };
}

function detectAudioQuality(key: string, size: number, contentType: string = ""): string {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  if (ext === "flac" || contentType.includes("flac")) return "FLAC";
  if (ext === "wav" || contentType.includes("wav")) return "WAV";
  if (size > 26 * 1024 * 1024) return "Hi-Res";
  if (size > 8 * 1024 * 1024) return "320K";
  return "MP3";
}

// 自动将外部网络封面图片拉取并转存至 R2 对象存储，彻底消灭防盗链 403 与图片撕裂
async function persistCoverImageToR2(
  env: any,
  picUrl: string,
  keyPrefix: string,
  origin: string
): Promise<string> {
  if (!picUrl || !picUrl.startsWith("http") || !env.R2_BUCKET) return picUrl;
  if (picUrl.includes("/api/blob/")) return picUrl;

  try {
    const resp = await fetch(picUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!resp.ok) return picUrl;

    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const safeBase = keyPrefix.replace(/^music\//, "").replace(/[^\w\u4e00-\u9fa5\-]/g, "_").slice(0, 36);
    const coverKey = `music/covers/${safeBase}_${crypto.randomUUID().slice(0, 6)}.${ext}`;

    await env.R2_BUCKET.put(coverKey, buffer, {
      httpMetadata: { contentType },
    });

    return `${origin}/api/blob/${encodeURIComponent(coverKey)}`;
  } catch (e) {
    console.warn("Failed to persist cover to R2:", e);
    return picUrl;
  }
}

export function MusicService(): Hono {
  const app = new Hono();

  // 1. 代理搜索 GD Studio 音乐 (支持全网聚合)
  app.get("/search", async (c: AppContext) => {
    const q = c.req.query("keyword") || c.req.query("name") || "";
    const source = c.req.query("source") || "all";
    const page = c.req.query("pages") || c.req.query("page") || "1";
    const count = c.req.query("count") || "15";

    if (!q) {
      return c.json({ error: "Missing keyword" }, 400);
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    // 全网聚合搜索：并发查询活跃稳定的音源
    if (source === "all") {
      const activeSources = ["netease", "bilibili", "joox", "tencent"];
      const fetchPromises = activeSources.map(async (src) => {
        const gdUrl = new URL("https://music-api.gdstudio.xyz/api.php");
        gdUrl.searchParams.set("types", "search");
        gdUrl.searchParams.set("source", src);
        gdUrl.searchParams.set("name", q);
        gdUrl.searchParams.set("pages", page);
        gdUrl.searchParams.set("count", "8");
        const resp = await fetch(gdUrl.toString(), { headers });
        if (!resp.ok) return [];
        const json = await resp.json();
        return Array.isArray(json) ? json.map((item: any) => ({ ...item, source: src })) : [];
      });

      try {
        const settled = await Promise.allSettled(fetchPromises);
        const aggregated: any[] = [];
        const seen = new Set<string>();

        for (const res of settled) {
          if (res.status === "fulfilled" && Array.isArray(res.value)) {
            for (const item of res.value) {
              const key = `${item.name}-${Array.isArray(item.artist) ? item.artist.join("/") : item.artist}`;
              if (!seen.has(key)) {
                seen.add(key);
                aggregated.push(item);
              }
            }
          }
        }
        return c.json(aggregated);
      } catch (e: any) {
        return c.json({ error: e.message || "Failed to search music" }, 500);
      }
    }

    const gdUrl = new URL("https://music-api.gdstudio.xyz/api.php");
    gdUrl.searchParams.set("types", "search");
    gdUrl.searchParams.set("source", source);
    gdUrl.searchParams.set("name", q);
    gdUrl.searchParams.set("pages", page);
    gdUrl.searchParams.set("count", count);

    try {
      const resp = await fetch(gdUrl.toString(), { headers });
      if (!resp.ok) {
        return c.json({ error: "GD API response error", status: resp.status }, 502);
      }
      const data = await resp.json();
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: e.message || "Failed to search music" }, 500);
    }
  });

  // 2. 代理获取歌曲直链、歌词与专辑图
  app.get("/song", async (c: AppContext) => {
    const id = c.req.query("id");
    const source = c.req.query("source") || "netease";
    const br = c.req.query("br") || "320";

    if (!id) return c.json({ error: "Missing id" }, 400);

    const gdUrl = new URL("https://music-api.gdstudio.xyz/api.php");
    gdUrl.searchParams.set("types", "url");
    gdUrl.searchParams.set("source", source);
    gdUrl.searchParams.set("id", id);
    gdUrl.searchParams.set("br", br);

    try {
      const resp = await fetch(gdUrl.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const data = await resp.json();
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  app.get("/lyric", async (c: AppContext) => {
    const id = c.req.query("id");
    const source = c.req.query("source") || "netease";
    if (!id) return c.json({ error: "Missing id" }, 400);

    const gdUrl = new URL("https://music-api.gdstudio.xyz/api.php");
    gdUrl.searchParams.set("types", "lyric");
    gdUrl.searchParams.set("source", source);
    gdUrl.searchParams.set("id", id);

    try {
      const resp = await fetch(gdUrl.toString());
      const data = await resp.json();
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  app.get("/pic", async (c: AppContext) => {
    const id = c.req.query("id");
    const source = c.req.query("source") || "netease";
    const size = c.req.query("size") || "300";
    if (!id) return c.json({ error: "Missing id" }, 400);

    const gdUrl = new URL("https://music-api.gdstudio.xyz/api.php");
    gdUrl.searchParams.set("types", "pic");
    gdUrl.searchParams.set("source", source);
    gdUrl.searchParams.set("id", id);
    gdUrl.searchParams.set("size", size);

    try {
      const resp = await fetch(gdUrl.toString());
      const data = await resp.json();
      return c.json(data);
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // 3. 音频流免防盗链边缘代理 (去除 Referer，支持 Range 断点续播)
  app.get("/stream", async (c: AppContext) => {
    const targetUrl = c.req.query("url");
    if (!targetUrl || !targetUrl.startsWith("http")) {
      return c.text("Invalid stream url", 400);
    }

    try {
      const range = c.req.header("range");
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      };
      if (range) {
        headers["Range"] = range;
      }

      const audioResp = await fetch(targetUrl, { headers });

      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", audioResp.headers.get("content-type") || "audio/mpeg");
      if (audioResp.headers.get("content-length")) {
        responseHeaders.set("Content-Length", audioResp.headers.get("content-length")!);
      }
      if (audioResp.headers.get("content-range")) {
        responseHeaders.set("Content-Range", audioResp.headers.get("content-range")!);
      }
      responseHeaders.set("Accept-Ranges", "bytes");
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Cache-Control", "public, max-age=86400");

      return new Response(audioResp.body, {
        status: audioResp.status,
        headers: responseHeaders,
      });
    } catch (e: any) {
      return c.text(`Stream failed: ${e.message}`, 502);
    }
  });

  // 4. 将音频永久转存至 Cloudflare R2 对象存储桶 (彻底消灭动态链接过期与防盗链 403)
  app.post("/persist-r2", async (c: AppContext) => {
    const admin = c.get("admin");
    const env = c.get("env");

    if (!admin) {
      return c.text("Forbidden", 403);
    }

    if (!env.R2_BUCKET && !env.S3_BUCKET) {
      return c.json({ error: "R2 bucket is not configured" }, 400);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.text("Invalid JSON", 400);
    }

    const { url, trackId, name, pic, artist } = body || {};
    if (!url || typeof url !== "string") {
      return c.json({ error: "Missing audio url" }, 400);
    }

    try {
      const audioResp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!audioResp.ok) {
        return c.json({ error: `Upstream error: ${audioResp.status}` }, 502);
      }

      const audioBuffer = await audioResp.arrayBuffer();
      const contentType = audioResp.headers.get("content-type") || "audio/mpeg";

      const safeName = (name || "track")
        .replace(/[^\w\u4e00-\u9fa5\-]/g, "_")
        .slice(0, 50);
      const safeId = String(trackId || Date.now()).replace(/[^\w\-]/g, "");
      const ext = contentType.includes("flac") ? "flac" : contentType.includes("wav") ? "wav" : "mp3";
      const storageKey = `music/${safeName}_${safeId}.${ext}`;

      const origin = new URL(c.req.url).origin;
      if (env.R2_BUCKET) {
        await env.R2_BUCKET.put(storageKey, audioBuffer, {
          httpMetadata: { contentType },
          customMetadata: {
            name: name || "",
            artist: artist || "",
            pic: pic || "",
          },
        });
      } else {
        await putStorageObjectAtKey(env, storageKey, audioBuffer, contentType, origin);
      }

      // 同步轻量索引
      const metaMap = await loadMusicMetadata(env);
      metaMap[storageKey] = {
        name: name || "",
        artist: artist || "",
        pic: pic || "",
        quality: detectAudioQuality(storageKey, audioBuffer.byteLength, contentType),
      };
      await saveMusicMetadata(env, metaMap);

      return c.json({
        success: true,
        key: storageKey,
        permanentUrl: `${origin}/api/blob/${encodeURIComponent(storageKey)}`,
        pic: pic || "",
      });
    } catch (e: any) {
      return c.json({ error: e.message || "Failed to persist to R2" }, 500);
    }
  });

  // 5. 从 R2 对象存储桶删除已转存的音频文件
  app.delete("/persist-r2", async (c: AppContext) => {
    const admin = c.get("admin");
    const env = c.get("env");

    if (!admin) {
      return c.text("Forbidden", 403);
    }

    if (!env.R2_BUCKET) {
      return c.json({ error: "R2 bucket is not configured" }, 400);
    }

    const key = c.req.query("key");
    if (!key) {
      return c.json({ error: "Missing key" }, 400);
    }

    try {
      await env.R2_BUCKET.delete(key);
      const metaMap = await loadMusicMetadata(env);
      if (metaMap[key]) {
        delete metaMap[key];
        await saveMusicMetadata(env, metaMap);
      }
      return c.json({ success: true, key });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // 6. 检索 R2 对象存储桶中所有已存储的音乐文件 (Navidrome 曲库视图支持)
  app.get("/r2-files", async (c: AppContext) => {
    const admin = c.get("admin");
    const env = c.get("env");

    if (!admin) {
      return c.text("Forbidden", 403);
    }

    if (!env.R2_BUCKET) {
      return c.json({ files: [] });
    }

    try {
      const [listing, metaMap] = await Promise.all([
        env.R2_BUCKET.list({ prefix: "music/", limit: 500 }),
        loadMusicMetadata(env),
      ]);

      const AUDIO_EXTS = new Set([
        "mp3", "flac", "wav", "m4a", "ogg", "aac", "opus", "wma", "webm", "ape", "alac", "aiff"
      ]);

      const origin = new URL(c.req.url).origin;
      const files = listing.objects
        .filter((obj) => {
          if (obj.key === MUSIC_META_KEY) return false;
          // 严格排除 covers 目录以及任何非音频格式文件，杜绝 0MB 黑胶唱片
          if (obj.key.startsWith("music/covers/") || obj.key.includes("/covers/")) return false;
          const ext = obj.key.split(".").pop()?.toLowerCase() || "";
          return AUDIO_EXTS.has(ext);
        })
        .map((obj) => {
          const fileName = obj.key.replace(/^music\//, "");
          const m = metaMap[obj.key] || {};
          const parsed = parseAudioFileName(fileName);

          let displayName = m.name || obj.customMetadata?.name || parsed.title;
          let artist = m.artist || obj.customMetadata?.artist || parsed.artist;

          // 核心清洗：剥离存量和增量中所有的前后下划线与连字符，彻底还原清晰曲名
          displayName = cleanAudioMetaString(displayName) || parsed.title;
          artist = cleanAudioMetaString(artist);
          if (!artist || artist === "本地上传") {
            artist = parsed.artist || "随心漫游";
          }

          const pic = m.pic || obj.customMetadata?.pic || "";
          const quality = m.quality || detectAudioQuality(obj.key, obj.size, obj.httpMetadata?.contentType);
          const url = `${origin}/api/blob/${encodeURIComponent(obj.key)}`;
          const hash = m.hash || obj.customMetadata?.hash || "";
          const etag = (obj as any).httpEtag || (obj as any).etag || "";

          return {
            key: obj.key,
            fileName,
            displayName,
            artist,
            pic,
            quality,
            size: obj.size,
            uploaded: obj.uploaded,
            url,
            hash,
            etag,
          };
        });

      return c.json({ files });
    } catch (e: any) {
      return c.json({ files: [], error: e.message });
    }
  });

  // 7. 直接向 R2 对象存储桶上传音频文件
  app.post("/upload-r2", async (c: AppContext) => {
    const admin = c.get("admin");
    const env = c.get("env");

    if (!admin) {
      return c.text("Forbidden", 403);
    }

    if (!env.R2_BUCKET) {
      return c.json({ error: "R2 bucket is not configured" }, 400);
    }

    try {
      const body = await c.req.parseBody();
      const file = body["file"] as File;
      if (!file) {
        return c.json({ error: "Missing file" }, 400);
      }

      const buffer = await file.arrayBuffer();
      // 计算文件的 SHA-256 内容哈希，用于精准查重与秒传比对
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 提取纯净的歌名与歌手信息，绝不携带下划线
      const parsed = parseAudioFileName(file.name);
      const cleanName = file.name.replace(/[^\w\u4e00-\u9fa5\.\-]/g, "_");
      const storageKey = `music/${Date.now()}_${cleanName}`;
      const origin = new URL(c.req.url).origin;

      // 优先从音频原始二进制中提取内嵌高清封面
      let extractedPicUrl = "";
      try {
        const coverObj = extractAudioCover(buffer);
        if (coverObj) {
          const ext = coverObj.mime.includes("png") ? "png" : "jpg";
          const safePrefix = parsed.title.replace(/[^\w\u4e00-\u9fa5\-]/g, "_").slice(0, 30);
          const coverKey = `music/covers/${safePrefix}_${crypto.randomUUID().slice(0, 6)}.${ext}`;
          await env.R2_BUCKET.put(coverKey, coverObj.data, {
            httpMetadata: { contentType: coverObj.mime },
          });
          extractedPicUrl = `${origin}/api/blob/${encodeURIComponent(coverKey)}`;
        }
      } catch (err) {
        console.warn("Extract embedded cover error:", err);
      }

      await env.R2_BUCKET.put(storageKey, buffer, {
        httpMetadata: { contentType: file.type || "audio/mpeg" },
        customMetadata: {
          name: parsed.title,
          artist: parsed.artist || "随心漫游",
          hash: hashHex,
          pic: extractedPicUrl,
        },
      });

      // 同步轻量索引
      const metaMap = await loadMusicMetadata(env);
      metaMap[storageKey] = {
        name: parsed.title,
        artist: parsed.artist || "随心漫游",
        quality: detectAudioQuality(storageKey, buffer.byteLength, file.type),
        hash: hashHex,
        pic: extractedPicUrl,
      };
      await saveMusicMetadata(env, metaMap);

      return c.json({
        success: true,
        key: storageKey,
        url: `${origin}/api/blob/${encodeURIComponent(storageKey)}`,
        name: parsed.title,
        pic: extractedPicUrl,
        hash: hashHex,
        size: buffer.byteLength,
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // 8. 重命名 R2 中存储的音频元数据 (秒级更新轻量索引，零超时)
  app.post("/rename-r2", async (c: AppContext) => {
    const admin = c.get("admin");
    const env = c.get("env");

    if (!admin) {
      return c.text("Forbidden", 403);
    }

    if (!env.R2_BUCKET) {
      return c.json({ error: "R2 bucket is not configured" }, 400);
    }

    try {
      const { key, newName } = await c.req.json();
      if (!key || !newName) {
        return c.json({ error: "Missing key or newName" }, 400);
      }

      const metaMap = await loadMusicMetadata(env);
      metaMap[key] = {
        ...(metaMap[key] || {}),
        name: newName.trim(),
      };
      await saveMusicMetadata(env, metaMap);

      return c.json({ success: true, newName });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // 9. 更新/置换 R2 音频封面元数据 (秒级更新轻量索引，彻底告别 40MB 重传超时，永不丢失)
  app.post("/update-cover-r2", async (c: AppContext) => {
    const admin = c.get("admin");
    const env = c.get("env");

    if (!admin) {
      return c.text("Forbidden", 403);
    }

    if (!env.R2_BUCKET) {
      return c.json({ error: "R2 bucket is not configured" }, 400);
    }

    try {
      const { key, pic } = await c.req.json();
      if (!key) {
        return c.json({ error: "Missing key" }, 400);
      }

      let finalPic = (pic || "").trim();
      const origin = new URL(c.req.url).origin;

      // 如果是外部网络图片（网易云、QQ音乐等），自动由 Worker 后端拉取转存至 R2，彻底消灭防盗链 403 与图片撕裂
      if (finalPic.startsWith("http://") || finalPic.startsWith("https://")) {
        if (!finalPic.includes("/api/blob/")) {
          finalPic = await persistCoverImageToR2(env, finalPic, key, origin);
        }
      }

      const metaMap = await loadMusicMetadata(env);
      metaMap[key] = {
        ...(metaMap[key] || {}),
        pic: finalPic,
      };
      await saveMusicMetadata(env, metaMap);

      return c.json({ success: true, key, pic: finalPic });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // 10. 音频元数据封面深度嗅探与补全（优先从文件头提取内嵌封面，无内嵌才通知前端联网检索）
  app.post("/auto-cover", async (c: AppContext) => {
    const admin = c.get("admin");
    const env = c.get("env");

    if (!admin) return c.text("Forbidden", 403);
    if (!env.R2_BUCKET) return c.json({ error: "R2 bucket is not configured" }, 400);

    try {
      const { key } = await c.req.json();
      if (!key) return c.json({ error: "Missing key" }, 400);

      // 读取音频文件前 2MB 数据提取 ID3 / FLAC PICTURE 标签
      const obj = await env.R2_BUCKET.get(key, {
        range: { offset: 0, length: 2 * 1024 * 1024 },
      });
      if (!obj) return c.json({ found: false, error: "File not found" });

      const headBuffer = await obj.arrayBuffer();
      const coverObj = extractAudioCover(headBuffer);

      if (coverObj) {
        const origin = new URL(c.req.url).origin;
        const ext = coverObj.mime.includes("png") ? "png" : "jpg";
        const safeBase = key.replace(/^music\//, "").replace(/[^\w\u4e00-\u9fa5\-]/g, "_").slice(0, 32);
        const coverKey = `music/covers/${safeBase}_${crypto.randomUUID().slice(0, 6)}.${ext}`;

        await env.R2_BUCKET.put(coverKey, coverObj.data, {
          httpMetadata: { contentType: coverObj.mime },
        });

        const picUrl = `${origin}/api/blob/${encodeURIComponent(coverKey)}`;

        // 更新索引
        const metaMap = await loadMusicMetadata(env);
        metaMap[key] = {
          ...(metaMap[key] || {}),
          pic: picUrl,
        };
        await saveMusicMetadata(env, metaMap);

        return c.json({ found: true, source: "embedded", pic: picUrl });
      }

      return c.json({ found: false, reason: "no_embedded_cover" });
    } catch (e: any) {
      return c.json({ found: false, error: e.message });
    }
  });

  return app;
}
