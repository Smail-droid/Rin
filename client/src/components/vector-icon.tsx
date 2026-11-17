const EMOJI_TO_REMIX_ICON: Record<string, string> = {
  "🐾": "ri-user-smile-line",
  "🐱": "ri-user-smile-line",
  "🐶": "ri-user-smile-line",
  "⏳": "ri-time-line",
  "⌛": "ri-time-line",
  "⏰": "ri-time-line",
  "💭": "ri-chat-heart-line",
  "💬": "ri-chat-smile-2-line",
  "🫧": "ri-bubble-chart-line",
  "🌸": "ri-planet-line",
  "🌺": "ri-planet-line",
  "🌷": "ri-planet-line",
  "🔍": "ri-search-line",
  "🔎": "ri-search-2-line",
  "🎴": "ri-camera-lens-line",
  "📸": "ri-camera-3-line",
  "📷": "ri-camera-lens-line",
  "🖼️": "ri-image-2-line",
  "📝": "ri-book-open-line",
  "💻": "ri-terminal-box-line",
  "☕": "ri-cup-line",
  "🍵": "ri-cup-line",
  "🎨": "ri-palette-line",
  "✨": "ri-sparkling-2-line",
  "💡": "ri-lightbulb-line",
  "🎵": "ri-music-2-line",
  "📖": "ri-book-read-line",
  "📮": "ri-mail-send-line",
  "💌": "ri-heart-line",
  "🎯": "ri-focus-3-line",
  "🚀": "ri-rocket-line",
  "🌟": "ri-star-line",
  "👑": "ri-vip-crown-line",
  "🧭": "ri-compass-3-line",
  "📜": "ri-file-list-3-line",
};

export function VectorIcon({
  name,
  fallback = "ri-sparkling-2-line",
  className = "",
}: {
  name?: string | null;
  fallback?: string;
  className?: string;
}) {
  const iconStr = (name || "").trim();
  if (!iconStr) {
    return <i className={`${fallback} ${className}`} />;
  }

  // If already a remix icon class
  if (iconStr.startsWith("ri-")) {
    return <i className={`${iconStr} ${className}`} />;
  }

  // If mapped from an emoji
  const mapped = EMOJI_TO_REMIX_ICON[iconStr];
  if (mapped) {
    return <i className={`${mapped} ${className}`} />;
  }

  // If contains emoji/unicode characters, sanitize to fallback vector icon
  if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(iconStr)) {
    return <i className={`${fallback} ${className}`} />;
  }

  return <i className={`${fallback} ${className}`} />;
}
