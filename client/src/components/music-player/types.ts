export interface MusicTrack {
  id: string | number;
  name: string;
  artist: string;
  album?: string;
  url: string;
  pic?: string;
  lyric?: string;
  source?: string; // "gdstudio" | "openlist" | "custom"
  sourceName?: string; // "网易云" | "5T网盘" | "自定义"
}

export type PlayMode = "loop" | "single" | "random";

export interface LyricLine {
  time: number;
  text: string;
}

export interface MusicPlayerContextType {
  currentTrack: MusicTrack | null;
  playlist: MusicTrack[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  isExpanded: boolean;
  showLyrics: boolean;
  showPlaylist: boolean;
  currentLyricText: string;
  parsedLyrics: LyricLine[];

  play: (track?: MusicTrack) => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setPlayMode: (mode: PlayMode) => void;
  setIsExpanded: (expanded: boolean) => void;
  setShowLyrics: (show: boolean) => void;
  setShowPlaylist: (show: boolean) => void;
  addTrack: (track: MusicTrack, playNow?: boolean) => void;
  removeTrack: (id: string | number) => void;
  setPlaylist: (tracks: MusicTrack[]) => void;
  clearPlaylist: () => void;
}
