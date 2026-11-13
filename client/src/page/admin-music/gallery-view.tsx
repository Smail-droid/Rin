import type { Dispatch, SetStateAction } from "react";
import type { R2MusicFileItem } from "../../services/music-api";
import type { MusicTrack } from "../../components/music-player/types";
import { VinylDiscArt } from "../../components/music-player/vinyl-disc-art";
import { cleanDisplayTitle } from "./types";

interface GalleryViewProps {
  displayLayout: "grid" | "list";
  setDisplayLayout: (layout: "grid" | "list") => void;
  gridColumns: 6 | 8 | 10;
  setGridColumns: (cols: 6 | 8 | 10) => void;
  r2Files: R2MusicFileItem[];
  filteredR2Files: R2MusicFileItem[];
  searchR2Query: string;
  setSearchR2Query: (q: string) => void;
  sortR2By: "newest" | "largest" | "name";
  setSortR2By: (sort: "newest" | "largest" | "name") => void;
  selectedR2Keys: Set<string>;
  setSelectedR2Keys: Dispatch<SetStateAction<Set<string>>>;
  editingR2Key: string | null;
  setEditingR2Key: (k: string | null) => void;
  editingR2Name: string;
  setEditingR2Name: (n: string) => void;
  onSaveRenameR2: (key: string) => void;
  autoFetchingAllCovers: boolean;
  onAutoFetchAllMissingCovers: () => void;
  onBatchImportR2Selected: () => void;
  onImportAllR2ToQueue: () => void;
  onImportR2ToQueue: (file: R2MusicFileItem) => void;
  onDeleteR2PhysicalFile: (file: R2MusicFileItem) => void;
  onOpenCoverModal: (file: R2MusicFileItem) => void;
  onTriggerUploadClick: () => void;
  playlist: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  onPlayTrack: (track: MusicTrack) => void;
  onPauseTrack: () => void;
}

export function GalleryView({
  displayLayout,
  setDisplayLayout,
  gridColumns,
  setGridColumns,
  r2Files,
  filteredR2Files,
  searchR2Query,
  setSearchR2Query,
  sortR2By,
  setSortR2By,
  selectedR2Keys,
  setSelectedR2Keys,
  editingR2Key,
  setEditingR2Key,
  editingR2Name,
  setEditingR2Name,
  onSaveRenameR2,
  autoFetchingAllCovers,
  onAutoFetchAllMissingCovers,
  onBatchImportR2Selected,
  onImportAllR2ToQueue,
  onImportR2ToQueue,
  onDeleteR2PhysicalFile,
  onOpenCoverModal,
  onTriggerUploadClick,
  playlist,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onPauseTrack,
}: GalleryViewProps) {
  return (
    <>
      {/* 搜索与工具控制栏 */}
      <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-md">
            <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm" />
            <input
              type="text"
              value={searchR2Query}
              onChange={(e) => setSearchR2Query(e.target.value)}
              placeholder="搜索音廊曲名、歌手..."
              className="w-full rounded-xl border border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02] pl-9 pr-8 py-1.5 text-xs t-primary outline-none focus:border-theme"
            />
            {searchR2Query && (
              <button
                type="button"
                onClick={() => setSearchR2Query("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <i className="ri-close-line text-sm" />
              </button>
            )}
          </div>

          {/* 排序方式下拉 */}
          <select
            value={sortR2By}
            onChange={(e) => setSortR2By(e.target.value as any)}
            className="rounded-xl border border-black/10 bg-w px-2.5 py-1.5 text-xs t-primary outline-none dark:border-white/10 dark:bg-neutral-800 cursor-pointer"
          >
            <option value="newest">最新上传</option>
            <option value="largest">文件大小</option>
            <option value="name">歌名 A-Z</option>
          </select>

          {/* 画册图格 (Navidrome) / 紧凑列表切换按钮 */}
          <div className="flex items-center gap-1 rounded-xl bg-black/5 dark:bg-white/5 p-1 text-xs">
            <button
              type="button"
              onClick={() => setDisplayLayout("grid")}
              className={`p-1.5 rounded-lg transition ${
                displayLayout === "grid" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400 hover:text-neutral-600"
              }`}
              title="Navidrome 画册图格"
            >
              <i className="ri-grid-fill text-sm" />
            </button>
            <button
              type="button"
              onClick={() => setDisplayLayout("list")}
              className={`p-1.5 rounded-lg transition ${
                displayLayout === "list" ? "bg-w text-theme font-bold shadow-2xs" : "text-neutral-400 hover:text-neutral-600"
              }`}
              title="紧凑表格视图"
            >
              <i className="ri-list-check text-sm" />
            </button>
          </div>

          {/* 多列排布密度切换器 (6列 / 8列 / 10列) */}
          {displayLayout === "grid" && (
            <div className="flex items-center gap-0.5 rounded-xl bg-black/5 dark:bg-white/5 p-0.5 text-xs">
              {[6, 8, 10].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    setGridColumns(col as 6 | 8 | 10);
                    try {
                      localStorage.setItem("rin_music_grid_cols", String(col));
                    } catch {}
                  }}
                  className={`px-2 py-0.5 rounded-lg font-mono font-bold transition text-[11px] ${
                    gridColumns === col ? "bg-w text-theme shadow-2xs" : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  }`}
                  title={`${col} 列密集排布`}
                >
                  {col}列
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          {/* 自动补全封面功能 */}
          <button
            type="button"
            onClick={onAutoFetchAllMissingCovers}
            disabled={autoFetchingAllCovers}
            className="px-2.5 py-1.5 rounded-xl border border-theme/20 bg-theme/5 hover:bg-theme/10 text-theme text-xs font-semibold transition flex items-center gap-1"
            title="自动为没有封面的歌曲在网络曲库中查找并保存封面"
          >
            {autoFetchingAllCovers ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-sparkling-line" />}
            <span>{autoFetchingAllCovers ? "嗅探封面中..." : "自动补全封面"}</span>
          </button>

          {selectedR2Keys.size > 0 && (
            <button
              type="button"
              onClick={onBatchImportR2Selected}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition flex items-center gap-1 shadow-2xs"
            >
              <i className="ri-play-list-add-line" />
              <span>批量加入列表 ({selectedR2Keys.size})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onImportAllR2ToQueue}
            disabled={r2Files.length === 0}
            className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-theme hover:text-white text-neutral-600 dark:text-neutral-300 text-xs font-bold transition flex items-center gap-1"
            title="将音廊全部曲目导入播放列表"
          >
            <i className="ri-play-list-add-line" />
            <span>全部入库</span>
          </button>
        </div>
      </div>

      {/* Navidrome 画册图格视图 */}
      {displayLayout === "grid" ? (
        <div
          className={
            gridColumns === 10
              ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3"
              : gridColumns === 8
              ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3.5"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5"
          }
        >
          {/* 首格：等高虚线上传卡片 */}
          <div
            onClick={onTriggerUploadClick}
            className="aspect-square rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 hover:border-theme/60 bg-black/[0.015] hover:bg-theme/5 transition flex flex-col items-center justify-center gap-2 cursor-pointer p-3 text-center group select-none"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-theme/10 text-theme text-lg group-hover:scale-110 transition-transform">
              <i className="ri-upload-cloud-line" />
            </span>
            <div>
              <span className="font-bold text-xs t-primary block group-hover:text-theme">上传音频</span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">支持 MP3/FLAC/WAV</span>
            </div>
          </div>

          {/* 歌曲画册卡片列表 */}
          {filteredR2Files.map((file) => {
            const isQueued = playlist.some((t) => t.url === file.url);
            const isCur = currentTrack?.url === file.url;
            const isPlayingThis = isCur && isPlaying;

            return (
              <div
                key={file.key}
                className="group relative rounded-2xl bg-w border border-black/10 dark:border-white/10 p-2.5 flex flex-col hover:border-theme/40 hover:shadow-lg transition-all"
              >
                {/* 正方形封面区域 */}
                <div className="aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 relative flex items-center justify-center shadow-inner select-none">
                  {file.pic ? (
                    <img
                      src={file.pic}
                      alt={file.displayName}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <VinylDiscArt isPlaying={isPlayingThis} className="h-full w-full" />
                  )}

                  {/* 悬浮半透明控制层 */}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between w-full">
                      {/* 更换封面 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCoverModal(file);
                        }}
                        className="h-7 w-7 rounded-full bg-black/40 hover:bg-theme text-white backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-sm"
                        title="更换封面"
                      >
                        <i className="ri-image-edit-line text-xs" />
                      </button>

                      {/* 删除 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteR2PhysicalFile(file);
                        }}
                        className="h-7 w-7 rounded-full bg-black/40 hover:bg-rose-500 text-rose-300 hover:text-white backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-sm"
                        title="从音廊永久删除"
                      >
                        <i className="ri-delete-bin-line text-xs" />
                      </button>
                    </div>

                    {/* 居中核心：播放 / 暂停 */}
                    <div className="flex items-center justify-center w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPlayingThis) onPauseTrack();
                          else {
                            onImportR2ToQueue(file);
                            setTimeout(() => {
                              const found = playlist.find((t) => t.url === file.url);
                              if (found) onPlayTrack(found);
                            }, 60);
                          }
                        }}
                        className="h-10 w-10 rounded-full bg-theme text-white flex items-center justify-center hover:scale-115 active:scale-95 transition shadow-xl"
                        title={isPlayingThis ? "暂停" : "播放"}
                      >
                        <i className={isPlayingThis ? "ri-pause-fill text-lg" : "ri-play-fill text-lg translate-x-0.5"} />
                      </button>
                    </div>

                    {/* 底部行：入库状态与音质标注 */}
                    <div className="flex items-center justify-between w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onImportR2ToQueue(file);
                        }}
                        className={`h-7 w-7 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-sm ${
                          isQueued ? "bg-emerald-500 text-white font-bold" : "bg-black/40 text-white hover:bg-white/30 backdrop-blur-md"
                        }`}
                        title={isQueued ? "已在播放列表中" : "加入播放列表"}
                      >
                        <i className={isQueued ? "ri-check-line text-xs font-bold" : "ri-add-line text-xs"} />
                      </button>

                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-black uppercase backdrop-blur-md tracking-wider shadow-sm select-none ${
                          file.quality === "FLAC" || file.quality === "WAV" || file.quality === "Hi-Res"
                            ? "bg-amber-500 text-white"
                            : file.quality === "320K"
                            ? "bg-purple-600 text-white"
                            : "bg-black/50 text-white/90"
                        }`}
                        title={`规格: ${file.quality || "MP3"}`}
                      >
                        {file.quality || (file.size > 26 * 1024 * 1024 ? "FLAC" : file.size > 8 * 1024 * 1024 ? "320K" : "MP3")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 卡片下方文字信息 */}
                <div className="mt-2.5 truncate select-none">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold t-primary block truncate flex-1" title={cleanDisplayTitle(file.displayName)}>
                      {cleanDisplayTitle(file.displayName)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingR2Key(file.key);
                        setEditingR2Name(cleanDisplayTitle(file.displayName));
                      }}
                      className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-theme transition"
                      title="重命名歌曲"
                    >
                      <i className="ri-edit-line text-xs" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-0.5">
                    <span className="truncate">{cleanDisplayTitle(file.artist || "随心漫游")}</span>
                    <span className="font-mono">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 紧凑超级表格视图 */
        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-w max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/5 bg-black/[0.02] dark:border-white/5 dark:bg-white/[0.02] text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-2.5 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={selectedR2Keys.size === filteredR2Files.length && filteredR2Files.length > 0}
                    onChange={() => {
                      if (selectedR2Keys.size === filteredR2Files.length && filteredR2Files.length > 0) setSelectedR2Keys(new Set());
                      else setSelectedR2Keys(new Set(filteredR2Files.map((f) => f.key)));
                    }}
                    className="accent-theme cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-2 w-8 text-center">#</th>
                <th className="py-2.5 px-2">曲目名称 / 歌手</th>
                <th className="py-2.5 px-2 w-24">大小</th>
                <th className="py-2.5 px-2 w-28">上传时间</th>
                <th className="py-2.5 px-2 text-right pr-4 w-32">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filteredR2Files.map((file, idx) => {
                const isQueued = playlist.some((t) => t.url === file.url);
                const isCur = currentTrack?.url === file.url;
                const isPlayingThis = isCur && isPlaying;
                const isSel = selectedR2Keys.has(file.key);

                return (
                  <tr key={file.key} className={`transition ${isSel ? "bg-theme/[0.04]" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"}`}>
                    <td className="py-2 px-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={(e) => {
                          const next = new Set(selectedR2Keys);
                          if (e.target.checked) next.add(file.key);
                          else next.delete(file.key);
                          setSelectedR2Keys(next);
                        }}
                        className="accent-theme cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-neutral-400">#{idx + 1}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {file.pic ? (
                          <img src={file.pic} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
                        ) : (
                          <VinylDiscArt isPlaying={isPlayingThis} className="h-7 w-7 rounded-lg shrink-0" />
                        )}
                        {editingR2Key === file.key ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingR2Name}
                              onChange={(e) => setEditingR2Name(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && onSaveRenameR2(file.key)}
                              className="px-2 py-0.5 rounded border border-theme text-xs bg-w outline-none font-bold"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => onSaveRenameR2(file.key)}
                              className="px-2 py-0.5 rounded bg-theme text-white text-[10px] font-bold"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingR2Key(null)}
                              className="text-[10px] text-neutral-400"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 truncate group/title">
                            <span className="font-bold t-primary truncate max-w-sm">{cleanDisplayTitle(file.displayName)}</span>
                            {file.artist && <span className="text-[10px] text-neutral-400 truncate">- {cleanDisplayTitle(file.artist)}</span>}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingR2Key(file.key);
                                setEditingR2Name(cleanDisplayTitle(file.displayName));
                              }}
                              className="opacity-0 group-hover/title:opacity-100 text-neutral-400 hover:text-theme transition p-0.5"
                              title="重命名显示名称"
                            >
                              <i className="ri-edit-line text-xs" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</td>
                    <td className="py-2 px-2 font-mono text-neutral-400 text-[11px]">{file.uploaded ? new Date(file.uploaded).toLocaleDateString() : "-"}</td>
                    <td className="py-2 px-2 text-right pr-4">
                      <div className="inline-flex items-center gap-2">
                        {/* 试听 */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isPlayingThis) onPauseTrack();
                            else {
                              onImportR2ToQueue(file);
                              setTimeout(() => {
                                const found = playlist.find((t) => t.url === file.url);
                                if (found) onPlayTrack(found);
                              }, 60);
                            }
                          }}
                          className={`p-1 rounded-md transition ${isPlayingThis ? "text-theme hover:bg-theme/10" : "text-neutral-400 hover:text-theme hover:bg-black/5"}`}
                          title={isPlayingThis ? "暂停" : "试听"}
                        >
                          <i className={isPlayingThis ? "ri-pause-fill text-sm" : "ri-play-fill text-sm"} />
                        </button>

                        {/* 入库 */}
                        <button
                          type="button"
                          onClick={() => onImportR2ToQueue(file)}
                          className={`p-1 rounded-md transition ${isQueued ? "text-emerald-500 font-bold" : "text-neutral-400 hover:text-theme hover:bg-black/5"}`}
                          title={isQueued ? "已在播放列表中" : "加入播放列表"}
                        >
                          <i className={isQueued ? "ri-check-line text-sm" : "ri-add-line text-sm"} />
                        </button>

                        {/* 更换封面 */}
                        <button
                          type="button"
                          onClick={() => onOpenCoverModal(file)}
                          className="p-1 rounded-md text-neutral-400 hover:text-theme transition"
                          title="更换封面"
                        >
                          <i className="ri-image-edit-line text-sm" />
                        </button>

                        {/* 删除 */}
                        <button
                          type="button"
                          onClick={() => onDeleteR2PhysicalFile(file)}
                          className="p-1 rounded-md text-neutral-400 hover:text-red-500 transition"
                          title="从 R2 永久删除"
                        >
                          <i className="ri-delete-bin-line text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
