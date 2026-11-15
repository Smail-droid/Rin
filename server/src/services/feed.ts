import {
    feedCreateSchema,
    feedSetTopSchema,
    feedUpdateSchema,
} from "@rin/api";
import type { CreateFeedRequest, UpdateFeedRequest } from "@rin/api";
import { and, asc, count, desc, eq, gt, lt } from "drizzle-orm";
import { Hono } from "hono";
import type { Variables } from "../core/hono-types";
import { adminOnly, userOnly, withJsonBody } from "../core/route-boundaries";
import { profileAsync } from "../core/server-timing";
import { cache as cacheTable, feeds, visits, visitStats } from "../db/schema";
import {
    deleteFeedById,
    findDuplicateFeed,
    findFeedById,
    insertFeed,
    searchFeedPage,
    updateFeedById,
} from "../features/feed/repository";
import { HyperLogLog } from "../utils/hyperloglog";
import { extractImageWithMetadata } from "../utils/image";
import { stripMarkdown } from "../utils/markdown";
import { syncFeedAISummaryQueueState } from "./feed-ai-summary";
import { bindTagToPost } from "./tag";
import { clearFeedCache, clearFeedCollectionCaches } from "./clear-feed-cache";
export { clearFeedCache } from "./clear-feed-cache";

// Lazy-loaded modules for WordPress import
let XMLParser: any;
let html2md: any;

function parseFeedId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }

    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

function parsePositiveInteger(value: string | undefined, fallback: number, maximum?: number) {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }

    return maximum ? Math.min(parsed, maximum) : parsed;
}

async function initWPModules() {
    if (!XMLParser) {
        const fxp = await import("fast-xml-parser");
        XMLParser = fxp.XMLParser;
    }
    if (!html2md) {
        const h2m = await import("html-to-md");
        html2md = h2m.default;
    }
}

export function FeedService(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // GET /feed - List feeds
    app.get('/', async (c) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        const type = c.req.query('type');

        if ((type === 'draft' || type === 'unlisted') && !admin) {
            return c.text('Permission denied', 403);
        }

        const page_num = parsePositiveInteger(page, 1) - 1;
        const limit_num = parsePositiveInteger(limit, 20, 50);
        const cacheKey = `feeds_${type}_${page_num}_${limit_num}`;
        const cached = await profileAsync(c, 'feed_list_cache_get', () => cache.get(cacheKey));

        if (cached) {
            return c.json(cached);
        }

        const where = type === 'draft'
            ? eq(feeds.draft, 1)
            : type === 'unlisted'
                ? and(eq(feeds.draft, 0), eq(feeds.listed, 0))
                : and(eq(feeds.draft, 0), eq(feeds.listed, 1));

        const size = await profileAsync(c, 'feed_list_count', () => db.select({ count: count() }).from(feeds).where(where));

        if (size[0].count === 0) {
            return c.json({ size: 0, data: [], hasNext: false });
        }

        const feed_list = (await profileAsync(c, 'feed_list_db', () => db.query.feeds.findMany({
            where: where,
            columns: admin ? undefined : { draft: false, listed: false },
            with: {
                hashtags: {
                    columns: {},
                    with: {
                        hashtag: { columns: { id: true, name: true } }
                    }
                },
                user: { columns: { id: true, username: true, avatar: true } }
            },
            orderBy: [desc(feeds.top), desc(feeds.createdAt), desc(feeds.updatedAt)],
            offset: page_num * limit_num,
            limit: limit_num + 1,
        }))).map(({ content, hashtags, summary, ...other }: any) => {
            const avatar = extractImageWithMetadata(content);
            const plainText = stripMarkdown(content);
            const contentLength = (content || "").length;
            const readingTime = Math.max(1, Math.ceil(contentLength / 350));
            return {
                summary: summary.length > 0 ? summary : plainText.length > 100 ? plainText.slice(0, 100) : plainText,
                hashtags: hashtags.map(({ hashtag }: any) => hashtag),
                avatar,
                readingTime,
                ...other
            };
        });

        let hasNext = false;
        if (feed_list.length === limit_num + 1) {
            feed_list.pop();
            hasNext = true;
        }

        const data = { size: size[0].count, data: feed_list, hasNext };

        if (type === undefined || type === 'normal' || type === '') {
            await profileAsync(c, 'feed_list_cache_set', () => cache.set(cacheKey, data));
        }

        return c.json(data);
    });

    // GET /feed/timeline
    app.get('/timeline', async (c) => {
        const db = c.get('db');
        const where = and(eq(feeds.draft, 0), eq(feeds.listed, 1));

        const rows = await profileAsync(c, 'feed_timeline_db', () => db.query.feeds.findMany({
            where: where,
            columns: { id: true, title: true, createdAt: true, updatedAt: true },
            orderBy: [desc(feeds.updatedAt), desc(feeds.createdAt)],
        }));

        // 统一输出标准的带 Z 的 UTC ISO 字符串，杜绝前端由于 SQLite 空格字符串导致丢失 8 小时时区
        const formatted = rows.map((r: any) => {
            const cDate = r.createdAt instanceof Date ? r.createdAt : new Date(typeof r.createdAt === 'number' && r.createdAt < 10000000000 ? r.createdAt * 1000 : r.createdAt);
            const uDate = r.updatedAt ? (r.updatedAt instanceof Date ? r.updatedAt : new Date(typeof r.updatedAt === 'number' && r.updatedAt < 10000000000 ? r.updatedAt * 1000 : r.updatedAt)) : undefined;
            return {
                ...r,
                createdAt: !isNaN(cDate.getTime()) ? cDate.toISOString() : r.createdAt,
                updatedAt: uDate && !isNaN(uDate.getTime()) ? uDate.toISOString() : r.updatedAt,
            };
        });

        return c.json(formatted);
    });

    // POST /feed - Create feed
    app.post('/', adminOnly(withJsonBody<CreateFeedRequest>(feedCreateSchema, async (c, body) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const serverConfig = c.get('serverConfig');
        const env = c.get('env');
        const uid = c.get('uid');
        const { title, alias, listed, content, summary, draft, tags, createdAt } = body;

        const exist = await profileAsync(c, 'feed_create_existing', () => findDuplicateFeed(db, title, content));

        if (exist) {
            return c.text('Content already exists', 400);
        }

        const date = createdAt ? new Date(createdAt) : new Date();

        if (!uid) {
            return c.text('User ID is required', 400);
        }

        const result = await profileAsync(c, 'feed_create_insert', () => insertFeed(db, {
            title,
            content,
            summary,
            ai_summary: "",
            ai_summary_status: "idle",
            ai_summary_error: "",
            uid,
            alias,
            listed: listed ? 1 : 0,
            draft: draft ? 1 : 0,
            createdAt: date,
            updatedAt: date
        }));

        if (!result) {
            return c.text('Failed to insert', 500);
        }

        await profileAsync(c, 'feed_create_tags', () => bindTagToPost(db, result.insertedId, tags));
        await profileAsync(c, 'feed_create_ai_queue', () => syncFeedAISummaryQueueState(db, serverConfig, env, result.insertedId, {
            draft: Boolean(draft),
            updatedAt: date,
            resetSummary: true,
        }));
        await profileAsync(c, 'feed_create_cache_invalidate', () => clearFeedCollectionCaches(cache));

        return c.json(result);
    }, {
        errorMessage: (issues) => {
            if (issues.some((issue) => issue.path === 'title' && /required|empty/.test(issue.message))) {
                return 'Title is required';
            }
            if (issues.some((issue) => issue.path === 'content' && /required|empty/.test(issue.message))) {
                return 'Content is required';
            }
            return issues[0]?.message ?? 'Invalid request body';
        },
    }), { message: 'Permission denied', status: 403 }));

    // GET /feed/random - 随机漫游获取一篇文章 (排除当前阅读的文章，可选指定标签)
    app.get('/random', async (c) => {
        const db = c.get('db');
        const admin = c.get('admin');
        const excludeId = parseFeedId(c.req.query('exclude') || "");
        const tag = (c.req.query('tag') || "").trim();

        const candidateFeeds = await db.query.feeds.findMany({
            where: admin ? undefined : and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
            columns: {
                id: true,
                title: true,
                alias: true,
            },
            with: {
                hashtags: {
                    columns: {},
                    with: { hashtag: { columns: { name: true } } },
                },
            },
            limit: 100,
            orderBy: [desc(feeds.createdAt)],
        });

        let pool = candidateFeeds;
        if (excludeId) {
            pool = pool.filter(f => f.id !== excludeId);
        }

        if (tag) {
            const tagPool = pool.filter(f =>
                f.hashtags?.some((h: any) => h.hashtag?.name === tag)
            );
            if (tagPool.length > 0) {
                pool = tagPool;
            }
        }

        if (pool.length === 0) {
            pool = candidateFeeds;
        }

        if (pool.length === 0) {
            return c.json({ feed: null });
        }

        const picked = pool[Math.floor(Math.random() * pool.length)];
        return c.json({
            feed: {
                id: picked.id,
                title: picked.title,
                alias: picked.alias,
                url: `/feed/${picked.alias || picked.id}`,
            },
        });
    });

    // GET /feed/permission/:id - 获取文章权限配置 (admin only, 必须在 /:id 之前注册)
    app.get('/permission/:id', adminOnly(async (c) => {
        const db = c.get('db');
        const id = c.req.param('id');
        const id_num = parseFeedId(id);
        if (id_num === null) return c.json({ error: "Invalid ID" }, 400);

        const lockRow = await db.query.cache.findFirst({
            where: and(eq(cacheTable.type, 'article_lock'), eq(cacheTable.key, String(id_num))),
        });

        if (!lockRow || !lockRow.value) {
            return c.json({ mode: "public", password: "", tip: "" });
        }

        try {
            const parsed = JSON.parse(lockRow.value);
            return c.json({
                mode: parsed.mode || "public",
                password: parsed.password || "",
                tip: parsed.tip || "",
            });
        } catch {
            return c.json({ mode: "public", password: "", tip: "" });
        }
    }, { message: 'Permission denied', status: 403 }));

    // POST /feed/permission/:id - 保存文章访问权限锁定策略 (admin only, 必须在 /:id 之前注册)
    app.post('/permission/:id', adminOnly(async (c) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const id = c.req.param('id');
        const id_num = parseFeedId(id);
        if (id_num === null) return c.json({ error: "Invalid ID" }, 400);

        const feed = await findFeedById(db, id_num);
        if (!feed) return c.json({ error: "Feed not found" }, 404);

        const body: any = await c.req.json().catch(() => ({}));
        const mode = body?.mode || "public";
        const password = (body?.password || "").trim();
        const tip = (body?.tip || "").trim();

        // 公开访问直接物理清理锁记录
        if (mode === "public" || !mode) {
            await db.delete(cacheTable).where(
                and(eq(cacheTable.type, 'article_lock'), eq(cacheTable.key, String(id_num)))
            );
        } else {
            const lockPayload = JSON.stringify({ mode, password, tip });
            const existing = await db.query.cache.findFirst({
                where: and(eq(cacheTable.type, 'article_lock'), eq(cacheTable.key, String(id_num))),
            });
            if (existing) {
                await db.update(cacheTable).set({
                    value: lockPayload,
                    updatedAt: new Date(),
                }).where(eq(cacheTable.id, existing.id));
            } else {
                await db.insert(cacheTable).values({
                    key: String(id_num),
                    value: lockPayload,
                    type: "article_lock",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
        }

        // 清理文章缓存以保证权限策略即时生效
        await clearFeedCache(cache, id_num, feed.alias, feed.alias);

        return c.json({
            success: true,
            mode,
            tip,
            hasPassword: Boolean(password),
        });
    }, { message: 'Permission denied', status: 403 }));

    // POST /feed/unlock/:id - 验证密码并解锁文章内容 (公共可访问, 必须在 /:id 之前注册)
    app.post('/unlock/:id', async (c) => {
        const db = c.get('db');
        const id = c.req.param('id');
        const id_num = parseFeedId(id);
        if (id_num === null) return c.json({ error: "Invalid ID" }, 400);

        const feed = await findFeedById(db, id_num);
        if (!feed) return c.json({ error: "Feed not found" }, 404);

        const lockRow = await db.query.cache.findFirst({
            where: and(eq(cacheTable.type, 'article_lock'), eq(cacheTable.key, String(id_num))),
        });

        // 若文章未加锁直接放行
        if (!lockRow || !lockRow.value) {
            return c.json({ success: true, content: feed.content });
        }

        try {
            const parsed = JSON.parse(lockRow.value);
            if (parsed.mode === "public" || !parsed.mode) {
                return c.json({ success: true, content: feed.content });
            }

            const body: any = await c.req.json().catch(() => ({}));
            const inputPassword = (body?.password || "").trim();

            if (inputPassword && inputPassword === parsed.password) {
                return c.json({
                    success: true,
                    content: feed.content,
                });
            } else {
                return c.json({
                    success: false,
                    error: "密码错误，请核对后重试",
                }, 401);
            }
        } catch {
            return c.json({ success: true, content: feed.content });
        }
    });

    // GET /feed/:id
    app.get('/:id', async (c) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const clientConfig = c.get('clientConfig');
        const admin = c.get('admin');
        const uid = c.get('uid');
        const id = c.req.param('id');
        const id_num = parseFeedId(id);
        const cacheKey = id_num === null ? `feed_alias_${id}` : `feed_id_${id_num}`;
        const where = id_num === null ? eq(feeds.alias, id) : eq(feeds.id, id_num);

        const feed = await profileAsync(c, 'feed_detail_cache_db', () => cache.getOrSet(cacheKey, () => db.query.feeds.findFirst({
            where,
            with: {
                hashtags: {
                    columns: {},
                    with: {
                        hashtag: { columns: { id: true, name: true } }
                    }
                },
                user: { columns: { id: true, username: true, avatar: true } }
            }
        })));

        if (!feed) {
            return c.text('Not found', 404);
        }

        if (feed.draft && feed.uid !== uid && !admin) {
            return c.text('Permission denied', 403);
        }

        const { hashtags, ...other } = feed;
        const hashtags_flatten = hashtags.map((f: any) => f.hashtag);

        // 严格检查文章访问控制锁 (独立密码锁 / 口令通行证，非管理员时严格脱敏正文)
        let isLocked = false;
        let lockMode = "public";
        let lockTip = "";

        const lockRow = await db.query.cache.findFirst({
            where: and(eq(cacheTable.type, 'article_lock'), eq(cacheTable.key, String(feed.id))),
        });

        if (lockRow && lockRow.value) {
            try {
                const parsedLock = JSON.parse(lockRow.value);
                if (parsedLock.mode && parsedLock.mode !== "public") {
                    lockMode = parsedLock.mode;
                    lockTip = parsedLock.tip || "";
                    if (!admin) {
                        const reqPassword = c.req.header('x-article-password') || c.req.query('password') || "";
                        if (!reqPassword || reqPassword !== parsedLock.password) {
                            isLocked = true;
                        }
                    }
                }
            } catch {}
        }

        // update visits using HyperLogLog for efficient UV estimation
        const enableVisit = await profileAsync(c, 'feed_detail_counter_flag', () => clientConfig.getOrDefault('counter.enabled', true));
        let pv = 0;
        let uv = 0;

        if (enableVisit) {
            const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || "UNK";
            const visitorKey = `${ip}`;

            // Fast lookup current visit stats for this feed
            const stats = await profileAsync(c, 'feed_detail_stats_lookup', () => db.query.visitStats.findFirst({
                where: eq(visitStats.feedId, feed.id)
            }));

            let newHllData: string;
            if (!stats) {
                pv = 1;
                uv = 1;
                const hll = new HyperLogLog();
                hll.add(visitorKey);
                newHllData = hll.serialize();
            } else {
                const hll = new HyperLogLog(stats.hllData);
                hll.add(visitorKey);
                newHllData = hll.serialize();
                pv = stats.pv + 1;
                uv = Math.round(hll.count());
            }

            // Perform D1 write operations asynchronously to prevent blocking the response
            const recordTask = async () => {
                try {
                    if (!stats) {
                        await db.insert(visitStats).values({
                            feedId: feed.id,
                            pv: 1,
                            hllData: newHllData
                        });
                    } else {
                        await db.update(visitStats)
                            .set({
                                pv,
                                hllData: newHllData,
                                updatedAt: new Date()
                            })
                            .where(eq(visitStats.feedId, feed.id));
                    }
                    await db.insert(visits).values({ feedId: feed.id, ip });
                } catch (error: any) {
                    console.error('[VisitStats] Background write error:', error?.message);
                }
            };

            let hasExecutionCtx = false;
            try {
                if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
                    c.executionCtx.waitUntil(recordTask());
                    hasExecutionCtx = true;
                }
            } catch {
                hasExecutionCtx = false;
            }

            if (!hasExecutionCtx) {
                await recordTask();
            }
        }

        if (isLocked) {
            return c.json({
                ...other,
                hashtags: hashtags_flatten,
                pv,
                uv,
                content: "", // 严格脱敏正文，杜绝无痕与爬虫获取！
                summary: other.summary || "本文受访问密码保护，请输入密码查阅完整随想。",
                isLocked: true,
                lockMode,
                lockTip: lockTip || "本文已设置访问密码，请输入查看密码解锁阅读。",
            });
        }

        return c.json({
            ...other,
            hashtags: hashtags_flatten,
            pv,
            uv,
            isLocked: false,
            lockConfig: admin && lockMode !== "public" ? { mode: lockMode, tip: lockTip } : undefined,
        });
    });

    // GET /feed/adjacent/:id
    app.get("/adjacent/:id", async (c) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const id = c.req.param('id');
        let id_num = parseFeedId(id);

        if (id_num === null) {
            const aliasRecord = await profileAsync(c, 'feed_adjacent_alias_lookup', () => db.select({ id: feeds.id }).from(feeds).where(eq(feeds.alias, id)));
            if (aliasRecord.length === 0) {
                return c.text("Not found", 404);
            }
            id_num = aliasRecord[0].id;
        }

        const feed = await profileAsync(c, 'feed_adjacent_current', () => db.query.feeds.findFirst({
            where: eq(feeds.id, id_num),
            columns: { createdAt: true },
        }));

        if (!feed) {
            return c.text("Not found", 404);
        }

        const created_at = feed.createdAt;

        function formatAndCacheData(feed: any, feedDirection: "previous_feed" | "next_feed") {
            if (feed) {
                const hashtags_flatten = feed.hashtags.map((f: any) => f.hashtag);
                const plainText = stripMarkdown(feed.content);
                const summary = feed.summary.length > 0
                    ? feed.summary
                    : plainText.length > 50 ? plainText.slice(0, 50) : plainText;
                const cacheKey = `${feed.id}_${feedDirection}_${id_num}`;
                const cacheData = {
                    id: feed.id,
                    title: feed.title,
                    summary: summary,
                    hashtags: hashtags_flatten,
                    createdAt: feed.createdAt,
                    updatedAt: feed.updatedAt,
                };
                cache.set(cacheKey, cacheData);
                return cacheData;
            }
            return null;
        }

        const getPreviousFeed = async () => {
            const previousFeedCached = await profileAsync(c, 'feed_adjacent_prev_cache', () => cache.getBySuffix(`previous_feed_${id_num}`));
            if (previousFeedCached && previousFeedCached.length > 0) {
                return previousFeedCached[0];
            } else {
                const tempPreviousFeed = await profileAsync(c, 'feed_adjacent_prev_db', () => db.query.feeds.findFirst({
                    where: and(and(eq(feeds.draft, 0), eq(feeds.listed, 1)), lt(feeds.createdAt, created_at)),
                    orderBy: [desc(feeds.createdAt)],
                    with: {
                        hashtags: {
                            columns: {},
                            with: { hashtag: { columns: { id: true, name: true } } }
                        },
                        user: { columns: { id: true, username: true, avatar: true } }
                    },
                }));
                return formatAndCacheData(tempPreviousFeed, "previous_feed");
            }
        };

        const getNextFeed = async () => {
            const nextFeedCached = await profileAsync(c, 'feed_adjacent_next_cache', () => cache.getBySuffix(`next_feed_${id_num}`));
            if (nextFeedCached && nextFeedCached.length > 0) {
                return nextFeedCached[0];
            } else {
                const tempNextFeed = await profileAsync(c, 'feed_adjacent_next_db', () => db.query.feeds.findFirst({
                    where: and(and(eq(feeds.draft, 0), eq(feeds.listed, 1)), gt(feeds.createdAt, created_at)),
                    orderBy: [asc(feeds.createdAt)],
                    with: {
                        hashtags: {
                            columns: {},
                            with: { hashtag: { columns: { id: true, name: true } } }
                        },
                        user: { columns: { id: true, username: true, avatar: true } }
                    },
                }));
                return formatAndCacheData(tempNextFeed, "next_feed");
            }
        };

        const [previousFeed, nextFeed] = await Promise.all([getPreviousFeed(), getNextFeed()]);
        return c.json({ previousFeed, nextFeed });
    });

    // POST /feed/:id - Update feed
    app.post('/:id', userOnly(withJsonBody<UpdateFeedRequest>(feedUpdateSchema, async (c, body) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const serverConfig = c.get('serverConfig');
        const env = c.get('env');
        const admin = c.get('admin');
        const uid = c.get('uid')!;
        const id = c.req.param('id');
        const { title, listed, content, summary, alias, draft, top, tags, createdAt } = body;

        const id_num = parseFeedId(id);
        if (id_num === null) {
            return c.text('Not found', 404);
        }
        const feed = await profileAsync(c, 'feed_update_lookup', () => findFeedById(db, id_num));

        if (!feed) {
            return c.text('Not found', 404);
        }

        if (feed.uid !== uid && !admin) {
            return c.text('Permission denied', 403);
        }

        const contentChanged = content && content !== feed.content;
        const isDraft = draft !== undefined ? draft : (feed.draft === 1);
        const shouldQueueAISummary = (contentChanged && !isDraft) || (!isDraft && feed.draft === 1 && !feed.ai_summary);
        const updateTime = new Date();

        await profileAsync(c, 'feed_update_db', () => updateFeedById(db, id_num, {
            title,
            content,
            summary,
            ai_summary: shouldQueueAISummary ? "" : undefined,
            ai_summary_status: isDraft ? "idle" : undefined,
            ai_summary_error: shouldQueueAISummary || isDraft ? "" : undefined,
            alias,
            top,
            listed: listed ? 1 : 0,
            draft: draft === undefined ? undefined : draft ? 1 : 0,
            createdAt: createdAt ? new Date(createdAt) : undefined,
            updatedAt: updateTime
        }));

        if (tags) {
            await profileAsync(c, 'feed_update_tags', () => bindTagToPost(db, id_num, tags));
        }

        if (shouldQueueAISummary || isDraft) {
            await profileAsync(c, 'feed_update_ai_queue', () => syncFeedAISummaryQueueState(db, serverConfig, env, id_num, {
                draft: Boolean(isDraft),
                updatedAt: updateTime,
                resetSummary: shouldQueueAISummary,
            }));
        }

        await profileAsync(c, 'feed_update_cache_invalidate', () => clearFeedCache(cache, id_num, feed.alias, alias || null));
        return c.text('Updated');
    }), { message: 'Permission denied', status: 403 }));

    // POST /feed/top/:id
    app.post('/top/:id', userOnly(withJsonBody<{ top: number }>(feedSetTopSchema, async (c, body) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const uid = c.get('uid')!;
        const id = c.req.param('id');
        const { top } = body;

        const id_num = parseFeedId(id);
        if (id_num === null) {
            return c.text('Not found', 404);
        }
        const feed = await profileAsync(c, 'feed_top_lookup', () => findFeedById(db, id_num));

        if (!feed) {
            return c.text('Not found', 404);
        }

        if (feed.uid !== uid && !admin) {
            return c.text('Permission denied', 403);
        }

        await profileAsync(c, 'feed_top_db', () => updateFeedById(db, feed.id, { top }));
        await profileAsync(c, 'feed_top_cache_invalidate', () => clearFeedCache(cache, feed.id, feed.alias, feed.alias));
        return c.text('Updated');
    }), { message: 'Permission denied', status: 403 }));

    // POST /feed/cover/:id - 快捷修改/替换文章首张封面
    app.post('/cover/:id', adminOnly(async (c) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const id = c.req.param('id');
        const id_num = parseFeedId(id);
        if (id_num === null) {
            return c.text('Not found', 404);
        }
        const feed = await findFeedById(db, id_num);
        if (!feed) {
            return c.text('Not found', 404);
        }

        const body = await c.req.json<{ cover?: string }>().catch(() => ({ cover: "" }));
        const newCover = (body.cover || "").trim();
        if (!newCover) {
            return c.text('Cover URL is required', 400);
        }

        let updatedContent = feed.content;
        const imgRegex = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/;
        if (imgRegex.test(updatedContent)) {
            updatedContent = updatedContent.replace(imgRegex, `![cover](${newCover})`);
        } else {
            updatedContent = `![cover](${newCover})\n\n${updatedContent}`;
        }

        await updateFeedById(db, feed.id, { content: updatedContent });
        await clearFeedCache(cache, feed.id, feed.alias, feed.alias);
        return c.json({ success: true, cover: newCover });
    }));

    // DELETE /feed/:id
    app.delete('/:id', userOnly(async (c, uid) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const id = c.req.param('id');

        const id_num = parseFeedId(id);
        if (id_num === null) {
            return c.text('Not found', 404);
        }
        const feed = await profileAsync(c, 'feed_delete_lookup', () => findFeedById(db, id_num));

        if (!feed) {
            return c.text('Not found', 404);
        }

        if (feed.uid !== uid && !admin) {
            return c.text('Permission denied', 403);
        }

        await profileAsync(c, 'feed_delete_db', () => deleteFeedById(db, id_num));
        await profileAsync(c, 'feed_delete_cache_invalidate', () => clearFeedCache(cache, id_num, feed.alias, null));
        return c.text('Deleted');
    }, { message: 'Permission denied', status: 403 }));

    return app;
}

export function SearchService(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // GET /search (empty search fallback)
    app.get('/', async (c) => {
        return c.json({ size: 0, data: [], hasNext: false });
    });

    // GET /search/:keyword
    app.get('/:keyword', async (c) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        let rawKeyword = c.req.param('keyword') || '';

        let keyword: string;
        try {
            keyword = decodeURIComponent(rawKeyword);
        } catch {
            keyword = rawKeyword;
        }
        const page_num = parsePositiveInteger(page, 1) - 1;
        const limit_num = parsePositiveInteger(limit, 20, 50);

        if (keyword === undefined || keyword.trim().length === 0) {
            return c.json({ size: 0, data: [], hasNext: false });
        }

        const scope = admin ? 'admin' : 'public';
        const cacheKey = `search_${scope}_${page_num}_${limit_num}_${encodeURIComponent(keyword)}`;
        const result = await profileAsync(c, 'feed_search_cache_db', () => cache.getOrSet(cacheKey, async () => {
            const pageResult = await searchFeedPage(db, {
                keyword,
                admin,
                pageIndex: page_num,
                limit: limit_num,
            });
            const data = pageResult.rows.map(({ content, hashtags, summary, ...other }: any) => {
                const plainText = stripMarkdown(content);
                const contentLength = (content || "").length;
                const readingTime = Math.max(1, Math.ceil(contentLength / 350));
                return {
                    summary: summary.length > 0 ? summary : plainText.length > 100 ? plainText.slice(0, 100) : plainText,
                    hashtags: hashtags.map(({ hashtag }: any) => hashtag),
                    readingTime,
                    ...other,
                };
            });

            return { size: pageResult.size, data, hasNext: pageResult.hasNext };
        }));

        return c.json(result);
    });
    return app;
}


export function WordPressService(): Hono<{
    Bindings: Env;
    Variables: Variables;
}> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();

    // POST /wp - WordPress import
    app.post('/', adminOnly(async (c) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const body = await profileAsync(c, 'wp_import_parse', () => c.req.parseBody());
        const data = body.data as File;

        if (!data) {
            return c.text('Data is required', 400);
        }

        // Initialize WordPress import modules lazily
        await profileAsync(c, 'wp_import_modules', () => initWPModules());

        const xml = await profileAsync(c, 'wp_import_read', () => data.text());
        const parser = new XMLParser();
        const result = await profileAsync(c, 'wp_import_xml_parse', () => parser.parse(xml));
        const items = result.rss.channel.item;

        if (!items) {
            return c.text('No items found', 404);
        }

        const feedItems: FeedItem[] = items?.map((item: any) => {
            const createdAt = new Date(item?.['wp:post_date']);
            const updatedAt = new Date(item?.['wp:post_modified']);
            const draft = item?.['wp:status'] !== 'publish';
            const contentHtml = item?.['content:encoded'];
            const content = html2md(contentHtml);
            const summary = content.length > 100 ? content.slice(0, 100) : content;
            let tags = item?.['category'];

            if (tags && Array.isArray(tags)) {
                tags = tags.map((tag: any) => tag + '');
            } else if (tags && typeof tags === 'string') {
                tags = [tags];
            }

            return {
                title: item.title,
                summary,
                content,
                draft,
                createdAt,
                updatedAt,
                tags
            };
        });

        let success = 0;
        let skipped = 0;
        let skippedList: { title: string, reason: string }[] = [];

        for (const item of feedItems) {
            if (!item.content) {
                skippedList.push({ title: item.title, reason: "no content" });
                skipped++;
                continue;
            }

            const exist = await profileAsync(c, 'wp_import_existing', () => db.query.feeds.findFirst({ where: eq(feeds.content, item.content) }));
            if (exist) {
                skippedList.push({ title: item.title, reason: "content exists" });
                skipped++;
                continue;
            }

            const result = await profileAsync(c, 'wp_import_insert', () => db.insert(feeds).values({
                title: item.title,
                content: item.content,
                summary: item.summary,
                uid: 1,
                listed: 1,
                draft: item.draft ? 1 : 0,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }).returning({ insertedId: feeds.id }));

            if (item.tags) {
                const tags = item.tags;
                await profileAsync(c, 'wp_import_tags', () => bindTagToPost(db, result[0].insertedId, tags));
            }
            success++;
        }

        await profileAsync(c, 'wp_import_cache_invalidate', () => clearFeedCollectionCaches(cache));
        return c.json({ success, skipped, skippedList });
    }, { message: 'Permission denied', status: 403 }));

    return app;
}

type FeedItem = {
    title: string;
    summary: string;
    content: string;
    draft: boolean;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}
