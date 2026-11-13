interface CustomTrackBarProps {
  customName: string;
  setCustomName: (name: string) => void;
  customArtist: string;
  setCustomArtist: (artist: string) => void;
  customUrl: string;
  setCustomUrl: (url: string) => void;
  onAddTrack: () => void;
  customStatus: "idle" | "done";
}

export function CustomTrackBar({
  customName,
  setCustomName,
  customArtist,
  setCustomArtist,
  customUrl,
  setCustomUrl,
  onAddTrack,
  customStatus,
}: CustomTrackBarProps) {
  return (
    <div className="p-3.5 rounded-2xl border border-dashed border-black/15 dark:border-white/15 bg-black/[0.01] dark:bg-white/[0.01] space-y-2 text-xs">
      <span className="font-bold text-[11px] t-primary block">手动录入音频直链 (OpenList / CDN)</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="歌曲名称 (必填)"
          className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 text-xs outline-none focus:border-theme"
        />
        <input
          type="text"
          value={customArtist}
          onChange={(e) => setCustomArtist(e.target.value)}
          placeholder="歌手 (选填)"
          className="rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 text-xs outline-none focus:border-theme"
        />
        <input
          type="url"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="音频直链 URL (必填)"
          className="sm:col-span-2 rounded-xl border border-black/10 bg-w dark:border-white/10 dark:bg-neutral-800 px-3 py-1.5 font-mono text-xs outline-none focus:border-theme"
        />
      </div>
      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={onAddTrack}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
            customStatus === "done" ? "bg-emerald-500 text-white" : "bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white"
          }`}
        >
          {customStatus === "done" ? <i className="ri-check-line" /> : <i className="ri-add-line" />}
          <span>{customStatus === "done" ? "已加入 ✓" : "添加至列表"}</span>
        </button>
      </div>
    </div>
  );
}
