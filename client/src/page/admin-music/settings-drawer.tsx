import { GD_MUSIC_SOURCES } from "../../services/music-api";

interface MusicSettingsDrawerProps {
  expanded: boolean;
  onClose: () => void;
  musicEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  musicAutoPlay: boolean;
  setMusicAutoPlay: (v: boolean) => void;
  musicPosition: string;
  setMusicPosition: (v: string) => void;
  openlistMusicUrl: string;
  setOpenlistMusicUrl: (v: string) => void;
  gdSource: string;
  setGdSource: (v: string) => void;
  onSyncOpenList: () => void;
  openListSyncStatus: "idle" | "syncing" | "done";
  syncCount: number;
}

export function MusicSettingsDrawer({
  expanded,
  onClose,
  musicEnabled,
  setMusicEnabled,
  musicAutoPlay,
  setMusicAutoPlay,
  musicPosition,
  setMusicPosition,
  openlistMusicUrl,
  setOpenlistMusicUrl,
  gdSource,
  setGdSource,
  onSyncOpenList,
  openListSyncStatus,
  syncCount,
}: MusicSettingsDrawerProps) {
  if (!expanded) return null;

  return (
    <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-4 ani-show">
      <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
        <span className="font-bold text-xs t-primary">电台运行参数</span>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 text-xs"
        >
          收起设置
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
          <div>
            <span className="font-bold block t-primary">启用前台播放器</span>
            <span className="text-[10px] text-neutral-400">悬浮迷你微光音符</span>
          </div>
          <input
            type="checkbox"
            checked={musicEnabled}
            onChange={(e) => setMusicEnabled(e.target.checked)}
            className="accent-theme cursor-pointer scale-110"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
          <div>
            <span className="font-bold block t-primary">入站自动播放</span>
            <span className="text-[10px] text-neutral-400">进站后开启流媒体</span>
          </div>
          <input
            type="checkbox"
            checked={musicAutoPlay}
            onChange={(e) => setMusicAutoPlay(e.target.checked)}
            className="accent-theme cursor-pointer scale-110"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.015] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
          <div>
            <span className="font-bold block t-primary">挂件停靠方位</span>
            <span className="text-[10px] text-neutral-400">屏幕默认边缘</span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { id: "bottom-left", label: "左下" },
              { id: "bottom-right", label: "右下" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMusicPosition(p.id)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  musicPosition === p.id ? "bg-theme text-white font-bold" : "bg-black/5 dark:bg-white/5 text-neutral-500"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
              OpenList 5T 音频目录直链路径
            </label>
            <button
              type="button"
              onClick={onSyncOpenList}
              disabled={openListSyncStatus === "syncing"}
              className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              {openListSyncStatus === "syncing" && <i className="ri-loader-4-line animate-spin" />}
              {openListSyncStatus === "done" && <i className="ri-check-line" />}
              <span>{openListSyncStatus === "syncing" ? "读取中..." : openListSyncStatus === "done" ? `已同步 ${syncCount} 首 ✓` : "扫描并同步5T音频"}</span>
            </button>
          </div>
          <input
            type="url"
            value={openlistMusicUrl}
            onChange={(e) => setOpenlistMusicUrl(e.target.value)}
            placeholder="https://openlist.yourdomain.com/5T/Music/"
            className="w-full rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-3 py-1.5 font-mono text-xs outline-none focus:border-theme transition"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
            默认在线检索音源
          </label>
          <div className="flex items-center gap-1 flex-wrap">
            {GD_MUSIC_SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setGdSource(s.id)}
                className={`px-2 py-1 rounded-lg text-xs transition select-none ${
                  gdSource === s.id
                    ? "bg-theme text-white font-bold"
                    : "bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
