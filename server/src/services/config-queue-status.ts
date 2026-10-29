import { eq, desc, ne } from "drizzle-orm";
import { feeds } from "../db/schema";
import { clearFeedCache } from "./feed";
import { syncFeedAISummaryQueueState } from "./feed-ai-summary";

type QueueTaskStatus = "idle" | "pending" | "processing" | "completed" | "failed";

export interface QueueTaskSummary {
  idle: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface QueueTaskItem {
  id: number;
  title: string | null;
  aiSummaryStatus: QueueTaskStatus;
  aiSummaryError: string;
  updatedAt: string;
  createdAt: string;
}

export interface QueueStatusResponse {
  queueConfigured: boolean;
  generatedAt: string;
  summary: QueueTaskSummary;
  items: QueueTaskItem[];
}

export async function retryQueueStatusTask(
  db: any,
  cache: any,
  serverConfig: { get(key: string): Promise<unknown> },
  env: Env,
  feedId: number,
) {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  });

  if (!feed) {
    throw new Error("Feed not found");
  }

  const updatedAtMs = new Date(feed.updatedAt).getTime();
  const isRunning =
    feed.ai_summary_status === "pending" || feed.ai_summary_status === "processing";
  const isStalled =
    isRunning && Date.now() - (isNaN(updatedAtMs) ? 0 : updatedAtMs) > 60 * 1000;

  // 仅对未满 1 分钟且处于运行中的任务进行防抖拦截，completed（已完成）、failed（失败）或卡死超时的任务均放行
  if (isRunning && !isStalled) {
    throw new Error("任务正在处理中，如卡死请在 1 分钟后重试");
  }

  // resetSummary 设为 true：覆盖清空老旧摘要，重新触发队列消费
  await syncFeedAISummaryQueueState(db, serverConfig, env, feedId, {
    draft: feed.draft === 1,
    updatedAt: feed.updatedAt,
    resetSummary: true,
  });
  await clearFeedCache(cache, feed.id, feed.alias, feed.alias);
}

export async function deleteQueueStatusTask(
  db: any,
  cache: any,
  feedId: number,
) {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  });

  if (!feed) {
    throw new Error("Feed not found");
  }

  const updatedAtMs = new Date(feed.updatedAt).getTime();
  const isStalled =
    (feed.ai_summary_status === "pending" || feed.ai_summary_status === "processing") &&
    Date.now() - (isNaN(updatedAtMs) ? 0 : updatedAtMs) > 60 * 1000;

  if (feed.ai_summary_status !== "failed" && feed.ai_summary_status !== "completed" && !isStalled) {
    throw new Error("任务正在处理中，如需删除请在 1 分钟后操作");
  }

  await db
    .update(feeds)
    .set({
      ai_summary_status: "idle",
      ai_summary_error: "",
    })
    .where(eq(feeds.id, feedId));

  await clearFeedCache(cache, feed.id, feed.alias, feed.alias);
}

export async function buildQueueStatusResponse(
  db: any,
  env: Env,
): Promise<QueueStatusResponse> {
  const summary: QueueTaskSummary = {
    idle: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  const allFeeds = await db.query.feeds.findMany({
    columns: {
      id: true,
      ai_summary_status: true,
    },
  });

  for (const feed of allFeeds) {
    const status = feed.ai_summary_status as QueueTaskStatus;
    if (status in summary) {
      summary[status] += 1;
    }
  }

  const items = await db.query.feeds.findMany({
    where: ne(feeds.ai_summary_status, "idle"),
    columns: {
      id: true,
      title: true,
      ai_summary_status: true,
      ai_summary_error: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: [desc(feeds.updatedAt)],
    limit: 50,
  });

  return {
    queueConfigured: Boolean(env.TASK_QUEUE),
    generatedAt: new Date().toISOString(),
    summary,
    items: items.map((item: {
      id: number;
      title: string | null;
      ai_summary_status: string;
      ai_summary_error: string;
      updatedAt: Date;
      createdAt: Date;
    }) => ({
      id: item.id,
      title: item.title,
      aiSummaryStatus: item.ai_summary_status as QueueTaskStatus,
      aiSummaryError: item.ai_summary_error,
      updatedAt: item.updatedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
    })),
  };
}
