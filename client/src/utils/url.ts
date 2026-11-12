export function safeHttpUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") {
    return undefined;
  }

  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    // If it's not a full URL or cannot be parsed, reject
  }

  return undefined;
}

/**
 * 规范化媒体与头像直链：
 * 将任何指向 /api/blob/ 的后端绝对路径统一规范化为当前站点的同源相对路径 /api/blob/...
 * 彻底消灭跨域 CORS 拦截、Chrome PNA (Private Network Access) 阻断以及中国大陆环境下 *.workers.dev 被阻断的缺陷
 */
export function normalizeBlobUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") {
    return undefined;
  }
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (trimmed.includes("/api/blob/")) {
    return trimmed.replace(/^https?:\/\/[^\/]+(?=\/api\/blob\/)/i, "");
  }

  return trimmed;
}
