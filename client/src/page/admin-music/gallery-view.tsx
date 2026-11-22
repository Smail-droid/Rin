import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
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
  onRefreshR2?: () => void;
  loadingR2?: boolean;
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
  onRefreshR2,
  loadingR2 = false,
  playlist,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onPauseTrack,
}: GalleryViewProps) {
  const missingCoversCount = r2Files.filter((f) => !f.pic || f.pic.trim() === "").length;

  // 严密整除自适应容量：按当前列数自适应计算 2~3 行，彻底消灭孤儿格子与多出一行
  const pageSize = useMemo(() => {
    if (displayLayout === "list") return 20;
    if (gridColumns === 10) return 20; // 10 列 × 2 行
    if (gridColumns === 8) return 16;  // 8 列 × 2 行，单屏完整呈现
    return 18;                         // 6 列 × 3 行
  }, [displayLayout, gridColumns]);

  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchR2Query, sortR2By, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredR2Files.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedR2Files = filteredR2Files.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const container = document.getElementById("gallery-tracks-container");
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getPageNumbers = (current: number, total: number): (number | string)[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  };

  return (
    <>
      {/* 搜索与工具控制栏 */}
      <div className="p-3.5 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1">
          {onRefreshR2 && (
            <button
              type="button"
              onClick={onRefreshR2}
              disabled={loadingR2}
              className="p-2 rounded-xl border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0"
              title="刷新音廊数据"
            >
              <i className={`ri-refresh-line text-sm ${loadingR2 ? "animate-spin text-theme" : ""}`} />
            </button>
          )}

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
          {/* 上传音频醒目主按钮 (收纳于工具栏，彻底消除多占 1 格的数学冲突，全屏拖拽文件夹依然 100% 支持) */}
          <button
            type="button"
            onClick={onTriggerUploadClick}
            className="px-3 py-1.5 rounded-xl bg-theme text-white text-xs font-bold hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
            title="上传音频文件或文件夹 (支持直接拖放整个文件夹到页面任意处)"
          >
            <i className="ri-upload-cloud-line text-sm" />
            <span>上传音频</span>
          </button>

          {/* 顶部微光极简翻页器 (零下拉翻页，鼠标不离上方) */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-black/5 dark:bg-white/5 text-xs select-none">
              <button
                type="button"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage <= 1}
                className="h-6 w-6 rounded-lg flex items-center justify-center text-neutral-500 hover:text-theme disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="上一页"
              >
                <i className="ri-arrow-left-s-line" />
              </button>
              <span className="font-mono text-[11px] text-neutral-500 px-1">
                <span className="font-bold text-neutral-800 dark:text-neutral-100">{safePage}</span>/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage >= totalPages}
                className="h-6 w-6 rounded-lg flex items-center justify-center text-neutral-500 hover:text-theme disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="下一页"
              >
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          )}

          {/* 自动补全封面功能 (智能跳过已有封面) */}
          <button
            type="button"
            onClick={onAutoFetchAllMissingCovers}
            disabled={autoFetchingAllCovers || missingCoversCount === 0}
            className="px-2.5 py-1.5 rounded-xl border border-theme/20 bg-theme/5 hover:bg-theme/10 text-theme text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
            title={missingCoversCount === 0 ? "所有曲目均已拥有封面，自动跳过" : `仅为缺失封面的 ${missingCoversCount} 首曲目自动补全，已有封面自动跳过`}
          >
            {autoFetchingAllCovers ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-sparkling-line" />}
            <span>
              {autoFetchingAllCovers
                ? "嗅探封面中..."
                : missingCoversCount === 0
                ? "✓ 封面已全量就绪"
                : `补全缺失封面 (${missingCoversCount})`}
            </span>
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
          id="gallery-tracks-container"
          className={
            gridColumns === 10
              ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3"
              : gridColumns === 8
              ? "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3.5"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5"
          }
        >
          {/* 歌曲画册卡片列表 (纯净歌曲网格，完美整除每一行) */}
          {paginatedR2Files.map((file) => {
            const isQueued = playlist.some((t) => t.url === file.url);
            const isCur = currentTrack?.url === file.url;
            const isPlayingThis = isCur && isPlaying;

            return (
              <div
                key={file.key}
                className={`group relative rounded-2xl bg-w border p-2.5 flex flex-col transition-all ${
                  isCur
                    ? "border-theme ring-2 ring-theme/30 shadow-lg"
                    : "border-black/10 dark:border-white/10 hover:border-theme/40 hover:shadow-lg"
                }`}
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

                  {/* 正在播放时的 MHub / Navidrome 风格音频律动跳动条 */}
                  {isPlayingThis && (
                    <div className="absolute top-2 right-2 z-20 px-2 py-1 rounded-full bg-black/70 backdrop-blur-md flex items-center gap-0.5 shadow-sm border border-white/20">
                      <span className="w-0.5 h-2.5 bg-theme rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-0.5 h-3.5 bg-theme rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-0.5 h-2 bg-theme rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
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

                {/* 卡片下方文字信息与行内重命名 */}
                <div className="mt-2.5 select-none">
                  {editingR2Key === file.key ? (
                    <div className="flex items-center gap-1.5 ani-show" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingR2Name}
                        onChange={(e) => setEditingR2Name(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSaveRenameR2(file.key);
                          if (e.key === "Escape") setEditingR2Key(null);
                        }}
                        autoFocus
                        className="flex-1 rounded-lg border border-theme bg-w px-2 py-1 text-xs outline-none shadow-xs dark:bg-neutral-800"
                      />
                      <button
                        type="button"
                        onClick={() => onSaveRenameR2(file.key)}
                        className="p-1 rounded-md bg-theme text-white text-xs hover:bg-theme-hover shrink-0"
                        title="保存重命名"
                      >
                        <i className="ri-check-line" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingR2Key(null)}
                        className="p-1 rounded-md bg-black/5 dark:bg-white/5 text-neutral-400 hover:text-neutral-600 text-xs shrink-0"
                        title="取消"
                      >
                        <i className="ri-close-line" />
                      </button>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
              {paginatedR2Files.map((file, idx) => {
                const globalIndex = startIndex + idx + 1;
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
                    <td className="py-2 px-2 text-center font-mono text-neutral-400">#{globalIndex}</td>
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
                          title="永久删除文件"
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

      {/* 音廊曲库现代微光分页器 (仅当有数据时呈现) */}
      {totalPages > 1 && (
        <div className="mt-8 pt-4 pb-6 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-4 select-none ani-show">
          <div className="text-xs font-mono text-neutral-400 dark:text-neutral-500">
            共 <span className="font-bold text-neutral-700 dark:text-neutral-300">{filteredR2Files.length}</span> 首曲目 · 第 <span className="font-bold text-theme">{safePage}</span> / {totalPages} 页
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage <= 1}
              className="px-2.5 py-1.5 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer flex items-center gap-1 shadow-2xs"
              title="上一页"
            >
              <i className="ri-arrow-left-s-line" />
              <span className="hidden sm:inline">上一页</span>
            </button>

            <div className="flex items-center gap-1">
              {getPageNumbers(safePage, totalPages).map((p, idx) => {
                if (p === "...") {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-neutral-400 font-mono">
                      …
                    </span>
                  );
                }
                const num = p as number;
                const isCur = num === safePage;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePageChange(num)}
                    className={`h-7 min-w-7 px-1.5 rounded-xl font-mono text-xs transition cursor-pointer flex items-center justify-center ${
                      isCur
                        ? "bg-theme text-white font-bold shadow-2xs"
                        : "border border-neutral-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme"
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage >= totalPages}
              className="px-2.5 py-1.5 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 hover:border-theme hover:text-theme disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer flex items-center gap-1 shadow-2xs"
              title="下一页"
            >
              <span className="hidden sm:inline">下一页</span>
              <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
