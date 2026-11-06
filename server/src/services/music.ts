import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { putStorageObjectAtKey } from "../utils/storage";

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
      const listing = await env.R2_BUCKET.list({
        prefix: "music/",
        limit: 100,
      });

      const origin = new URL(c.req.url).origin;
      const files = listing.objects.map((obj) => {
        const fileName = obj.key.replace(/^music\//, "");
        const rawName = fileName.replace(/\.[a-zA-Z0-9]+$/, "");
        const parts = rawName.split("_");
        const displayName = obj.customMetadata?.name || parts[0] || rawName;
        const artist = obj.customMetadata?.artist || (parts.length > 1 ? parts[1] : "");
        const pic = obj.customMetadata?.pic || "";
        const url = `${origin}/api/blob/${encodeURIComponent(obj.key)}`;

        return {
          key: obj.key,
          fileName,
          displayName,
          artist,
          pic,
          size: obj.size,
          uploaded: obj.uploaded,
          url,
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
      const cleanName = file.name.replace(/[^\w\u4e00-\u9fa5\.\-]/g, "_");
      const storageKey = `music/${Date.now()}_${cleanName}`;
      const origin = new URL(c.req.url).origin;

      await env.R2_BUCKET.put(storageKey, buffer, {
        httpMetadata: { contentType: file.type || "audio/mpeg" },
        customMetadata: {
          name: file.name.replace(/\.[a-zA-Z0-9]+$/, ""),
          artist: "本地上传",
        },
      });

      return c.json({
        success: true,
        key: storageKey,
        url: `${origin}/api/blob/${encodeURIComponent(storageKey)}`,
        name: file.name,
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  // 8. 重命名 R2 中存储的音频元数据
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

      const obj = await env.R2_BUCKET.get(key);
      if (!obj) {
        return c.json({ error: "Object not found" }, 404);
      }

      const buf = await obj.arrayBuffer();
      const meta = obj.customMetadata || {};
      meta.name = newName.trim();

      await env.R2_BUCKET.put(key, buf, {
        httpMetadata: obj.httpMetadata,
        customMetadata: meta,
      });

      return c.json({ success: true, newName });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  });

  return app;
}
