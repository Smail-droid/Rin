import { useCallback, useMemo, useRef, useState } from "react";
import {
  uploadR2AudioFileWithProgress,
  computeAudioFingerprint,
  type R2MusicFileItem,
} from "../../services/music-api";
import {
  type AudioUploadTask,
  MAX_AUDIO_FILE_SIZE,
  MAX_CONCURRENT_UPLOADS,
  isAudioFile,
} from "./types";

export type UploadFilterTab = "all" | "uploading" | "queued" | "duplicate" | "error" | "completed";

export function useAudioUploadQueue(r2Files: R2MusicFileItem[], onUploadSuccess: () => Promise<void> | void) {
  const [uploadTasks, setUploadTasks] = useState<AudioUploadTask[]>([]);
  const tasksRef = useRef<AudioUploadTask[]>([]);
  tasksRef.current = uploadTasks;

  const [showUploadPanel, setShowUploadPanel] = useState<boolean>(false);
  const [isDragOverGallery, setIsDragOverGallery] = useState<boolean>(false);
  const dragCounterRef = useRef<number>(0);
  const [uploadFilterTab, setUploadFilterTab] = useState<UploadFilterTab>("all");

  const audioFilesInputRef = useRef<HTMLInputElement>(null);
  const audioFolderInputRef = useRef<HTMLInputElement>(null);

  // 严格限制并发的队列调度泵 (最大并发 MAX_CONCURRENT_UPLOADS = 2)
  const pumpUploadQueue = useCallback(() => {
    setUploadTasks((currentTasks) => {
      const activeCount = currentTasks.filter((t) => t.status === "uploading").length;
      const availableSlots = MAX_CONCURRENT_UPLOADS - activeCount;
      if (availableSlots <= 0) return currentTasks;

      const queuedTasks = currentTasks.filter((t) => t.status === "queued");
      if (queuedTasks.length === 0) return currentTasks;

      const toStart = queuedTasks.slice(0, availableSlots);
      const toStartIds = new Set(toStart.map((t) => t.id));

      const updated = currentTasks.map((t) => {
        if (toStartIds.has(t.id)) {
          const controller = new AbortController();
          return { ...t, status: "uploading" as const, error: undefined, controller };
        }
        return t;
      });

      toStart.forEach((task) => {
        setTimeout(() => {
          runSingleUpload(task.id, task.file);
        }, 0);
      });

      return updated;
    });
  }, []);

  // 执行单曲上传
  const runSingleUpload = (taskId: string, file: File, retryAttempt = 0) => {
    const currentTask = tasksRef.current.find((t) => t.id === taskId);
    const controller = currentTask?.controller || new AbortController();

    uploadR2AudioFileWithProgress(file, {
      signal: controller.signal,
      onProgress: (_loaded, _total, percent) => {
        setUploadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress: percent } : t))
        );
      },
    })
      .then((res) => {
        if (res.success) {
          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: "completed" } : t))
          );
          void onUploadSuccess();
          setTimeout(pumpUploadQueue, 50);
        } else {
          if (res.error === "aborted") {
            setUploadTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, status: "paused" } : t))
            );
            setTimeout(pumpUploadQueue, 50);
          } else {
            if (retryAttempt < 1) {
              setTimeout(() => {
                runSingleUpload(taskId, file, retryAttempt + 1);
              }, 800);
            } else {
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId ? { ...t, status: "error", error: res.error || "上传失败" } : t
                )
              );
              setTimeout(pumpUploadQueue, 50);
            }
          }
        }
      })
      .catch((err) => {
        if (retryAttempt < 1) {
          setTimeout(() => {
            runSingleUpload(taskId, file, retryAttempt + 1);
          }, 800);
        } else {
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: "error", error: err?.message || "上传异常" } : t
            )
          );
          setTimeout(pumpUploadQueue, 50);
        }
      });
  };

  // 批量入队音频文件
  const handleEnqueueFiles = (incomingFiles: File[]) => {
    const audioList = incomingFiles.filter(isAudioFile);
    if (audioList.length === 0) return;

    const currentR2 = r2Files;
    const r2SizeSet = new Set(currentR2.map((f) => f.size));
    const r2HashSet = new Set(currentR2.map((f) => f.hash).filter(Boolean));
    const r2NormalizedNames = new Set(
      currentR2.map((f) =>
        f.displayName
          .replace(/[^\w\u4e00-\u9fa5]/g, "")
          .toLowerCase()
      )
    );

    const newTasks: AudioUploadTask[] = audioList.map((file) => {
      const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const baseName = file.name.replace(/\.[a-zA-Z0-9]+$/, "").trim();
      const normName = baseName.replace(/[^\w\u4e00-\u9fa5]/g, "").toLowerCase();

      const isSizeMatch = r2SizeSet.has(file.size);
      const isNameMatch = normName && r2NormalizedNames.has(normName);
      const isDup = isSizeMatch || isNameMatch;

      let status: AudioUploadTask["status"] = "queued";
      let error: string | undefined;

      if (file.size > MAX_AUDIO_FILE_SIZE) {
        status = "oversized";
        error = "超出单文件 100MB 限制";
      } else if (isDup) {
        status = "duplicate";
        error = isSizeMatch ? "音廊已有相同大小音频" : "音廊已收录同名曲目";
      }

      if (!isDup && status === "queued") {
        computeAudioFingerprint(file)
          .then((fp) => {
            if (r2HashSet.has(fp)) {
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === id ? { ...t, status: "duplicate", error: "哈希指纹完全一致" } : t
                )
              );
            }
          })
          .catch(() => {});
      }

      return {
        id,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status,
        error,
      };
    });

    setUploadTasks((prev) => [...newTasks, ...prev]);
    setShowUploadPanel(true);
    setTimeout(pumpUploadQueue, 50);
  };

  // 递归提取拖拽目录和文件
  const handleExtractDropFiles = async (dataTransfer: DataTransfer) => {
    const items = dataTransfer.items;
    if (!items || items.length === 0) {
      if (dataTransfer.files?.length) {
        handleEnqueueFiles(Array.from(dataTransfer.files));
      }
      return;
    }

    const collectedFiles: File[] = [];
    const entries: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const entry = (item as any).webkitGetAsEntry?.() || (item as any).getAsEntry?.();
        if (entry) {
          entries.push(entry);
        } else {
          const f = item.getAsFile();
          if (f && isAudioFile(f)) collectedFiles.push(f);
        }
      }
    }

    async function traverseEntry(entry: any): Promise<void> {
      if (entry.isFile) {
        await new Promise<void>((resolve) => {
          entry.file(
            (f: File) => {
              if (isAudioFile(f)) collectedFiles.push(f);
              resolve();
            },
            () => resolve()
          );
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntries = async (): Promise<any[]> => {
          return new Promise((resolve) => {
            reader.readEntries((res: any[]) => resolve(res), () => resolve([]));
          });
        };
        let batch: any[];
        do {
          batch = await readEntries();
          for (const child of batch) {
            await traverseEntry(child);
          }
        } while (batch.length > 0);
      }
    }

    for (const entry of entries) {
      await traverseEntry(entry);
    }

    if (collectedFiles.length > 0) {
      handleEnqueueFiles(collectedFiles);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragOverGallery(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOverGallery(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOverGallery(false);
    if (e.dataTransfer) {
      void handleExtractDropFiles(e.dataTransfer);
    }
  };

  const handlePauseTask = (taskId: string) => {
    const target = tasksRef.current.find((t) => t.id === taskId);
    if (target?.controller) {
      target.controller.abort();
    }
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "paused" } : t))
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handleResumeTask = (taskId: string) => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "queued", error: undefined, progress: 0 } : t))
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handleCancelTask = (taskId: string) => {
    const target = tasksRef.current.find((t) => t.id === taskId);
    if (target?.controller) {
      target.controller.abort();
    }
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
    setTimeout(pumpUploadQueue, 50);
  };

  const handleStartAllUploads = () => {
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.status === "paused" || t.status === "error" || t.status === "queued"
          ? { ...t, status: "queued", error: undefined }
          : t
      )
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handlePauseAllUploads = () => {
    tasksRef.current
      .filter((t) => t.status === "uploading")
      .forEach((t) => t.controller?.abort());
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.status === "uploading" || t.status === "queued" ? { ...t, status: "paused" } : t
      )
    );
  };

  const handleRetryAllFailed = () => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.status === "error" || t.status === "oversized" ? { ...t, status: "queued", error: undefined, progress: 0 } : t))
    );
    setTimeout(pumpUploadQueue, 50);
  };

  const handleClearTaskPanel = () => {
    tasksRef.current
      .filter((t) => t.status === "uploading")
      .forEach((t) => t.controller?.abort());
    setUploadTasks([]);
  };

  const uploadStats = useMemo(() => {
    return {
      all: uploadTasks.length,
      uploading: uploadTasks.filter((t) => t.status === "uploading").length,
      queued: uploadTasks.filter((t) => t.status === "queued" || t.status === "paused").length,
      duplicate: uploadTasks.filter((t) => t.status === "duplicate").length,
      error: uploadTasks.filter((t) => t.status === "error" || t.status === "oversized").length,
      completed: uploadTasks.filter((t) => t.status === "completed").length,
    };
  }, [uploadTasks]);

  const filteredUploadTasks = useMemo(() => {
    if (uploadFilterTab === "uploading") return uploadTasks.filter((t) => t.status === "uploading");
    if (uploadFilterTab === "queued") return uploadTasks.filter((t) => t.status === "queued" || t.status === "paused");
    if (uploadFilterTab === "duplicate") return uploadTasks.filter((t) => t.status === "duplicate");
    if (uploadFilterTab === "error") return uploadTasks.filter((t) => t.status === "error" || t.status === "oversized");
    if (uploadFilterTab === "completed") return uploadTasks.filter((t) => t.status === "completed");
    return uploadTasks;
  }, [uploadTasks, uploadFilterTab]);

  return {
    uploadTasks,
    uploadStats,
    filteredUploadTasks,
    showUploadPanel,
    setShowUploadPanel,
    uploadFilterTab,
    setUploadFilterTab,
    isDragOverGallery,
    audioFilesInputRef,
    audioFolderInputRef,
    handleEnqueueFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePauseTask,
    handleResumeTask,
    handleCancelTask,
    handleStartAllUploads,
    handlePauseAllUploads,
    handleRetryAllFailed,
    handleClearTaskPanel,
  };
}
