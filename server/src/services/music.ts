import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";

export function MusicService(): Hono {
  const app = new Hono();

  // 1. 代理搜索 GD Studio 音乐
  app.get("/search", async (c: AppContext) => {
    const q = c.req.query("keyword") || c.req.query("name") || "";
    const source = c.req.query("source") || "netease";
    const page = c.req.query("pages") || c.req.query("page") || "1";
    const count = c.req.query("count") || "15";

    if (!q) {
      return c.json({ error: "Missing keyword" }, 400);
    }

    const gdUrl = new URL("https://music-api.gdstudio.xyz/api.php");
    gdUrl.searchParams.set("types", "search");
    gdUrl.searchParams.set("source", source);
    gdUrl.searchParams.set("name", q);
    gdUrl.searchParams.set("pages", page);
    gdUrl.searchParams.set("count", count);

    try {
      const resp = await fetch(gdUrl.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
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

  return app;
}
