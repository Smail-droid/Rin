export function isAllowedOrigin(
  candidateOrigin: string,
  env: { FRONTEND_URL?: string },
  requestOrigin: string,
): boolean {
  try {
    const candidate = new URL(candidateOrigin).origin;

    // 1. 同源请求
    if (candidate === requestOrigin) {
      return true;
    }

    // 2. 匹配环境变量配置的 FRONTEND_URL
    if (env.FRONTEND_URL) {
      const configuredOrigin = new URL(env.FRONTEND_URL).origin;
      if (candidate === configuredOrigin) {
        return true;
      }
    }

    // 3. 允许本地开发测试域名 (localhost, 127.0.0.1, [::1])
    const parsed = new URL(candidate);
    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]";

    if (isLocalhost && (parsed.protocol === "http:" || parsed.protocol === "https:")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function getSafeCallbackUrl(
  referer: string | undefined,
  env: { FRONTEND_URL?: string },
  requestUrl: string,
): URL {
  const requestOrigin = new URL(requestUrl).origin;

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (isAllowedOrigin(refererUrl.origin, env, requestOrigin)) {
        return new URL("/callback", refererUrl.origin);
      }
    } catch {
      // Ignore malformed referer
    }
  }

  if (env.FRONTEND_URL) {
    try {
      const configuredUrl = new URL(env.FRONTEND_URL);
      return new URL("/callback", configuredUrl.origin);
    } catch {
      // Ignore malformed env.FRONTEND_URL
    }
  }

  return new URL("/callback", requestOrigin);
}

export function isValidHttpUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr || typeof urlStr !== "string") {
    return false;
  }

  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidSafeMediaUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr || typeof urlStr !== "string") {
    return false;
  }

  const trimmed = urlStr.trim();
  if (!trimmed) {
    return false;
  }

  // 1. 允许 http/https
  if (isValidHttpUrl(trimmed)) {
    return true;
  }

  // 2. 禁止任何 scheme (例如 javascript:, data:, vbscript:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false;
  }

  // 3. 禁止协议相对路径 //
  if (trimmed.startsWith("//")) {
    return false;
  }

  return true;
}

export function sanitizeHttpUrl(urlStr: string | null | undefined): string {
  if (!urlStr || typeof urlStr !== "string") {
    return "";
  }

  const trimmed = urlStr.trim();
  if (isValidHttpUrl(trimmed)) {
    return trimmed;
  }

  return "";
}

export function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]"
  ) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (ipv4Match) {
    const o1 = Number(ipv4Match[1]);
    const o2 = Number(ipv4Match[2]);
    if (o1 === 0 || o1 === 10 || o1 === 127) return true;
    if (o1 === 169 && o2 === 254) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 192 && o2 === 168) return true;
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const raw = normalized.slice(1, -1);
    if (raw === "::1" || raw.startsWith("fe80:") || raw.startsWith("fc00:") || raw.startsWith("fd")) {
      return true;
    }
  }

  return false;
}

export function isSafePublicUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr || typeof urlStr !== "string") {
    return false;
  }

  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return !isPrivateIp(parsed.hostname);
  } catch {
    return false;
  }
}

