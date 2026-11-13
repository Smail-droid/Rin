import type { AudioUploadTask } from "./types";
import type { UploadFilterTab } from "./use-audio-upload-queue";

interface AudioUploadCenterProps {
  uploadTasks: AudioUploadTask[];
  filteredUploadTasks: AudioUploadTask[];
  uploadStats: {
    all: number;
    uploading: number;
    queued: number;
    duplicate: number;
    error: number;
    completed: number;
  };
  uploadFilterTab: UploadFilterTab;
  setUploadFilterTab: (tab: UploadFilterTab) => void;
  onStartAll: () => void;
  onPauseAll: () => void;
  onRetryFailed: () => void;
  onClearPanel: () => void;
  onClosePanel: () => void;
  onPauseTask: (id: string) => void;
  onResumeTask: (id: string) => void;
  onCancelTask: (id: string) => void;
}

export function AudioUploadCenter({
  uploadTasks,
  filteredUploadTasks,
  uploadStats,
  uploadFilterTab,
  setUploadFilterTab,
  onStartAll,
  onPauseAll,
  onRetryFailed,
  onClearPanel,
  onClosePanel,
  onPauseTask,
  onResumeTask,
  onCancelTask,
}: AudioUploadCenterProps) {
  if (uploadTasks.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl border border-black/10 bg-w dark:border-white/10 shadow-xs space-y-3.5 ani-show">
      {/* 顶部标题与分区切换 Tab 栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-black/5 dark:border-white/5 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-theme/10 text-theme text-xs font-bold">
              <i className="ri-upload-cloud-2-line" />
            </span>
            <span className="font-bold text-xs t-primary">音频上传中枢</span>
          </div>

          {/* 分区切换选项卡 */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] font-semibold flex-wrap">
            {[
              { id: "all", label: "全部", count: uploadStats.all },
              { id: "uploading", label: "上传中", count: uploadStats.uploading },
              { id: "queued", label: "排队中", count: uploadStats.queued },
              { id: "duplicate", label: "已存在", count: uploadStats.duplicate },
              { id: "error", label: "失败", count: uploadStats.error },
              { id: "completed", label: "已完成", count: uploadStats.completed },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setUploadFilterTab(tab.id as UploadFilterTab)}
                className={`px-2 py-0.5 rounded-lg transition flex items-center gap-1 select-none ${
                  uploadFilterTab === tab.id
                    ? "bg-w text-theme font-bold shadow-2xs"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 顶部动作按钮区 */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs self-end sm:self-auto">
          {uploadStats.error > 0 && (
            <button
              type="button"
              onClick={onRetryFailed}
              className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-semibold transition flex items-center gap-1 text-[11px]"
              title="重试所有失败的项目"
            >
              <i className="ri-restart-line" />
              <span>重试失败 ({uploadStats.error})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onStartAll}
            className="px-2 py-1 rounded-lg bg-theme/10 text-theme font-semibold hover:bg-theme/20 transition flex items-center gap-1 text-[11px]"
          >
            <i className="ri-play-fill" />
            <span>全部开始</span>
          </button>
          <button
            type="button"
            onClick={onPauseAll}
            className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 font-semibold hover:bg-black/10 transition flex items-center gap-1 text-[11px]"
          >
            <i className="ri-pause-fill" />
            <span>全部暂停</span>
          </button>
          <button
            type="button"
            onClick={onClearPanel}
            className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-400 hover:text-neutral-600 font-semibold transition text-[11px]"
            title="仅清空本上传列表记录，绝对不删除云端音乐资产"
          >
            清空面板
          </button>
          <button
            type="button"
            onClick={onClosePanel}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 transition"
            title="收起上传面板"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="divide-y divide-black/5 dark:divide-white/5 max-h-64 overflow-y-auto pr-1">
        {filteredUploadTasks.length === 0 ? (
          <div className="py-8 text-center text-neutral-400 text-xs">
            当前分类下暂无任务
          </div>
        ) : (
          filteredUploadTasks.map((task) => (
            <div
              key={task.id}
              className="py-2 px-1 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] rounded-xl flex items-center justify-between gap-3 text-xs transition select-none"
            >
              {/* 左侧：文件信息与细线进度条 */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <i className="ri-music-2-line text-neutral-400 text-xs shrink-0" />
                  <span className="font-medium t-primary truncate block text-xs" title={task.name}>
                    {task.name}
                  </span>
                  {task.error && (
                    <span className="text-[10px] text-rose-500 shrink-0 truncate max-w-[220px]" title={task.error}>
                      · {task.error}
                    </span>
                  )}
                </div>

                <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      task.status === "completed"
                        ? "bg-emerald-500"
                        : task.status === "error" || task.status === "oversized"
                        ? "bg-rose-500"
                        : task.status === "paused"
                        ? "bg-amber-400"
                        : task.status === "duplicate"
                        ? "bg-purple-400"
                        : "bg-theme"
                    }`}
                    style={{
                      width: `${task.status === "completed" || task.status === "duplicate" ? 100 : task.progress}%`,
                    }}
                  />
                </div>
              </div>

              {/* 右侧：指标与操作按钮 */}
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="font-mono text-[11px] text-neutral-400 w-16 text-right">
                  {(task.size / (1024 * 1024)).toFixed(1)} MB
                </span>

                <div className="w-14 flex justify-center">
                  {task.status === "uploading" && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-theme/10 text-theme animate-pulse">
                      {task.progress}%
                    </span>
                  )}
                  {task.status === "completed" && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      已完成
                    </span>
                  )}
                  {task.status === "paused" && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-500/10 text-amber-600">
                      已暂停
                    </span>
                  )}
                  {task.status === "duplicate" && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-500/10 text-purple-600">
                      已存在
                    </span>
                  )}
                  {task.status === "oversized" && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-500/10 text-rose-600">
                      超限
                    </span>
                  )}
                  {task.status === "error" && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-500/10 text-rose-600">
                      失败
                    </span>
                  )}
                  {task.status === "queued" && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-neutral-500/10 text-neutral-400">
                      等待中
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-[76px] justify-end">
                  {task.status === "uploading" && (
                    <button
                      type="button"
                      onClick={() => onPauseTask(task.id)}
                      className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 text-[10px] font-semibold transition flex items-center gap-0.5"
                      title="暂停当前文件上传"
                    >
                      <i className="ri-pause-line" />
                      <span>暂停</span>
                    </button>
                  )}
                  {(task.status === "paused" || task.status === "queued") && (
                    <button
                      type="button"
                      onClick={() => onResumeTask(task.id)}
                      className="px-2 py-0.5 rounded-lg bg-theme/10 text-theme hover:bg-theme/20 text-[10px] font-semibold transition flex items-center gap-0.5"
                      title="开始/继续上传"
                    >
                      <i className="ri-play-line" />
                      <span>继续</span>
                    </button>
                  )}
                  {task.status === "error" && (
                    <button
                      type="button"
                      onClick={() => onResumeTask(task.id)}
                      className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-[10px] font-semibold transition flex items-center gap-0.5"
                      title="重新尝试上传该文件"
                    >
                      <i className="ri-restart-line" />
                      <span>重试</span>
                    </button>
                  )}
                  {task.status === "duplicate" && (
                    <button
                      type="button"
                      onClick={() => onResumeTask(task.id)}
                      className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 text-[10px] font-semibold transition flex items-center gap-0.5"
                      title="强制覆盖已存在文件"
                    >
                      <i className="ri-upload-2-line" />
                      <span>覆盖</span>
                    </button>
                  )}
                  {task.status === "completed" && (
                    <span className="text-[10px] text-emerald-500 font-semibold px-2">✓ 入库</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onCancelTask(task.id)}
                  className="p-1 rounded text-neutral-400 hover:text-rose-500 transition"
                  title="移出上传列表"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
