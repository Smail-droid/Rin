import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LyricLine, MusicPlayerContextType, MusicTrack, PlayMode } from "./types";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { client } from "../../app/runtime";

export const DEFAULT_PRESET_TRACKS: MusicTrack[] = [];

function sanitizePlaylist(list: MusicTrack[]): MusicTrack[] {
  return list.filter((t) => {
    // 过滤掉已失效的旧版网易云防盗链外链
    if (t.url.includes("music.163.com/song/media/outer/url")) {
      return false;
    }
    return true;
  });
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

function parseLrc(lrcString: string): LyricLine[] {
  if (!lrcString || typeof lrcString !== "string") return [];
  const lines = lrcString.split("\n");
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.?(\d{2,3})?\]/g;

  for (const line of lines) {
    const text = line.replace(timeRegex, "").trim();
    if (!text) continue;

    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = match[3] ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      const totalTime = minutes * 60 + seconds + milliseconds / 1000;
      result.push({ time: totalTime, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export function getPlayableAudioUrl(url: string): string {
  if (!url) return "";
  // R2 音廊自有资产：剥离 origin 使用相对路径直连，杜绝跨域/协议代理中继失败
  if (url.includes("/api/blob/")) {
    return url.substring(url.indexOf("/api/blob/"));
  }
  // 移动端 HTTPS 混合内容 (Mixed Content) 与防盗链中继自愈
  if (url.startsWith("http://")) {
    if (
      url.includes("music.126.net") ||
      url.includes("qq.com") ||
      url.includes("bilibili.com") ||
      url.includes("bilivideo.com")
    ) {
      return url.replace(/^http:\/\//i, "https://");
    }
    // 其它第三方 http 音频源通过本站 Worker 边缘代理中继为安全 https
    return `/api/music/stream?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const siteConfig = useSiteConfig();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const consecutiveErrorsRef = useRef<number>(0);

  // 播放列表状态
  const [playlist, setPlaylistState] = useState<MusicTrack[]>(() => {
    // 优先读取本地缓存歌单 (反映用户最新的增删修改)
    try {
      const saved = localStorage.getItem("rin_music_playlist");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sanitizePlaylist(parsed);
      }
    } catch {}
    // 其次读取后台配置的歌单
    if (siteConfig.musicPlaylist) {
      try {
        const parsed = JSON.parse(siteConfig.musicPlaylist);
        if (Array.isArray(parsed)) return sanitizePlaylist(parsed);
      } catch {}
    }
    return DEFAULT_PRESET_TRACKS;
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("rin_music_volume");
      if (saved !== null) return parseFloat(saved);
    } catch {}
    return 0.75;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playMode, setPlayModeState] = useState<PlayMode>(() => {
    try {
      const saved = localStorage.getItem("rin_music_mode") as PlayMode;
      if (["loop", "single", "random"].includes(saved)) return saved;
    } catch {}
    return "loop";
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 当后台配置的歌单从服务端或配置中心到达时，自动响应并更新播放列表 (兼容空歌单 [])
  useEffect(() => {
    if (siteConfig.musicPlaylist !== undefined && siteConfig.musicPlaylist !== null) {
      try {
        const parsed = JSON.parse(siteConfig.musicPlaylist);
        if (Array.isArray(parsed)) {
          const sanitized = sanitizePlaylist(parsed);
          setPlaylistState(sanitized);
          try {
            localStorage.setItem("rin_music_playlist", JSON.stringify(sanitized));
          } catch {}
        }
      } catch {}
    }
  }, [siteConfig.musicPlaylist]);

  // 监听跨标签页或本地储存歌单变更
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "rin_music_playlist" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setPlaylistState(sanitizePlaylist(parsed));
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const currentTrack = useMemo(() => {
    if (!playlist || playlist.length === 0) return null;
    return playlist[currentTrackIndex] || playlist[0] || null;
  }, [playlist, currentTrackIndex]);

  // 解析歌词
  const parsedLyrics = useMemo(() => {
    if (!currentTrack?.lyric) return [];
    return parseLrc(currentTrack.lyric);
  }, [currentTrack]);

  // 当前实时高亮歌词行
  const currentLyricText = useMemo(() => {
    if (parsedLyrics.length === 0) return "";
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLyrics[i].time) {
        return parsedLyrics[i].text;
      }
    }
    return parsedLyrics[0]?.text || "";
  }, [parsedLyrics, currentTime]);

  // 播放控制
  const play = useCallback((track?: MusicTrack) => {
    if (track) {
      const existingIdx = playlist.findIndex((t) => t.id === track.id || t.url === track.url);
      if (existingIdx !== -1) {
        setCurrentTrackIndex(existingIdx);
      } else {
        setPlaylistState((prev) => [track, ...prev]);
        setCurrentTrackIndex(0);
      }
    }
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("[MusicPlayer] Autoplay prevented by browser:", err);
          setIsPlaying(false);
        });
    }
  }, [playlist]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const next = useCallback(() => {
    if (playlist.length === 0) return;
    if (playMode === "random") {
      const nextIdx = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    }
    setTimeout(() => {
      audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
    }, 50);
  }, [playlist.length, playMode]);

  const prev = useCallback(() => {
    if (playlist.length === 0) return;
    if (playMode === "random") {
      const nextIdx = Math.floor(Math.random() * playlist.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    }
    setTimeout(() => {
      audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
    }, 50);
  }, [playlist.length, playMode]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    try {
      localStorage.setItem("rin_music_volume", String(clamped));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (audioRef.current) {
        audioRef.current.muted = nextMuted;
      }
      return nextMuted;
    });
  }, []);

  const setPlayMode = useCallback((mode: PlayMode) => {
    setPlayModeState(mode);
    try {
      localStorage.setItem("rin_music_mode", mode);
    } catch {}
  }, []);

  const setPlaylist = useCallback((tracks: MusicTrack[]) => {
    setPlaylistState(tracks);
    try {
      localStorage.setItem("rin_music_playlist", JSON.stringify(tracks));
      void client.config.update("client", { "music.playlist": JSON.stringify(tracks) });
    } catch {}
  }, []);

  const addTrack = useCallback((track: MusicTrack, playNow = false) => {
    let targetIdx = 0;
    setPlaylistState((prev) => {
      // 严格去重：根据 ID，或歌名 + 歌手完全匹配判定是否已存在
      const existingIdx = prev.findIndex(
        (t) =>
          String(t.id) === String(track.id) ||
          (t.name.trim().toLowerCase() === track.name.trim().toLowerCase() &&
            t.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
      );

      if (existingIdx !== -1) {
        targetIdx = existingIdx;
        return prev; // 已经存在，保持原样，绝不重复插入覆盖
      }

      const nextList = [track, ...prev];
      targetIdx = 0;
      try {
        localStorage.setItem("rin_music_playlist", JSON.stringify(nextList));
        void client.config.update("client", { "music.playlist": JSON.stringify(nextList) });
      } catch {}
      return nextList;
    });

    if (playNow) {
      setTimeout(() => {
        setCurrentTrackIndex(targetIdx);
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      }, 50);
    }
  }, []);

  const removeTrack = useCallback((id: string | number) => {
    setPlaylistState((prev) => {
      const nextList = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem("rin_music_playlist", JSON.stringify(nextList));
        void client.config.update("client", { "music.playlist": JSON.stringify(nextList) });
      } catch {}
      return nextList;
    });
  }, []);

  const clearPlaylist = useCallback(() => {
    setPlaylistState([]);
    pause();
    try {
      localStorage.setItem("rin_music_playlist", "[]");
      void client.config.update("client", { "music.playlist": "[]" });
    } catch {}
  }, [pause]);

  // 同步音量与设置 no-referrer 避免源站防盗链
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
      try {
        (audioRef.current as any).referrerPolicy = "no-referrer";
      } catch {}
    }
  }, [volume, isMuted]);

  // 歌曲切换时载入音频 (经过 HTTPS 与防盗链自愈转换)
  useEffect(() => {
    if (!audioRef.current || !currentTrack?.url) return;
    const audio = audioRef.current;
    const finalUrl = getPlayableAudioUrl(currentTrack.url);
    audio.src = finalUrl;
    audio.load();
    if (isPlaying) {
      audio.play().catch((err) => {
        if (err.name === "NotAllowedError") {
          setIsPlaying(false);
          return;
        }
        setIsPlaying(false);
      });
    }
  }, [currentTrack]);

  // 绑定原生音频事件
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    if (playMode === "single") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      next();
    }
  };

  const handlePlaying = () => {
    consecutiveErrorsRef.current = 0;
    setLoadError(null);
  };

  const handleError = () => {
    console.warn("[MusicPlayer] Audio play failed for:", currentTrack?.url);
    setIsPlaying(false);

    consecutiveErrorsRef.current += 1;
    const trackName = currentTrack?.name || "未知曲目";

    // 连续失败次数达到歌单长度时立刻熔断，停止无休止的自动切歌循环
    if (consecutiveErrorsRef.current >= Math.max(1, playlist.length)) {
      consecutiveErrorsRef.current = 0;
      setLoadError("歌单曲目受源站防盗链拦截，已暂停自动切歌。请在后台使用全网聚合搜索重新收录有效音源。");
      setTimeout(() => setLoadError(null), 6000);
      return;
    }

    setLoadError(`音频加载受限（${trackName}），正在尝试切至下一首...`);
    setTimeout(() => setLoadError(null), 3500);

    // 仅在未达到熔断阈值且队列有多首时尝试切下一首
    if (playlist.length > 1) {
      setTimeout(() => {
        next();
      }, 1200);
    }
  };

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        playlist,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        playMode,
        isExpanded,
        showLyrics,
        showPlaylist,
        currentLyricText,
        parsedLyrics,
        loadError,
        play,
        pause,
        togglePlay,
        next,
        prev,
        seek,
        setVolume,
        toggleMute,
        setPlayMode,
        setIsExpanded,
        setShowLyrics,
        setShowPlaylist,
        addTrack,
        removeTrack,
        setPlaylist,
        clearPlaylist,
      }}
    >
      {/* 核心：全局唯一常驻原生 Audio DOM 节点，跨所有 SPA 页面不中断 */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlaying={handlePlaying}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
      />
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return ctx;
}
