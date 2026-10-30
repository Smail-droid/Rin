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
