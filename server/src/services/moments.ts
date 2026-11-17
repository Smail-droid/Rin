import { count, desc, eq, and } from "drizzle-orm";
import { Hono } from "hono";
import { moments, momentComments, users } from "../db/schema";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";

let momentCommentsTableEnsured = false;
async function ensureMomentCommentsTable(c: AppContext) {
    if (momentCommentsTableEnsured) return;
    const env = c.get('env');
    if (env?.DB?.prepare) {
        try {
            await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS moment_comments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    moment_id INTEGER NOT NULL,
                    user_id INTEGER,
                    content TEXT NOT NULL,
                    guest_name TEXT DEFAULT '',
                    guest_email TEXT DEFAULT '',
                    guest_website TEXT DEFAULT '',
                    approved INTEGER DEFAULT 1 NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            `).run();
            await env.DB.prepare(`
                CREATE INDEX IF NOT EXISTS moment_comments_moment_id_idx ON moment_comments (moment_id, created_at);
            `).run();
            momentCommentsTableEnsured = true;
        } catch (e) {
            console.warn("Ensure moment_comments table warning:", e);
        }
    }
}

export function MomentsService(): Hono {
    const app = new Hono();

    // GET /moments
    app.get('/', async (c: AppContext) => {
        await ensureMomentCommentsTable(c);
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        
        const page_num = (page ? parseInt(page) > 0 ? parseInt(page) : 1 : 1) - 1;
        const limit_num = limit ? parseInt(limit) > 50 ? 50 : parseInt(limit) : 20;
        const cacheKey = `moments_${page_num}_${limit_num}_${admin ? 'admin' : 'pub'}`;
        const cached = await profileAsync(c, 'moments_list_cache_get', () => cache.get(cacheKey));
        
        if (cached) {
            return c.json(cached);
        }
        
        const size = await profileAsync(c, 'moments_list_count', () => db.select({ count: count() }).from(moments));
        
        if (size[0].count === 0) {
            return c.json({ size: 0, data: [], hasNext: false });
        }
        
        const moments_list = await profileAsync(c, 'moments_list_db', () => db.query.moments.findMany({
            with: {
                user: { columns: { id: true, username: true, avatar: true } },
                comments: {
                    columns: { id: true, content: true, guestName: true, approved: true, createdAt: true },
                    with: {
                        user: { columns: { id: true, username: true, avatar: true } }
                    },
                    orderBy: [desc(momentComments.createdAt)],
                }
            },
            orderBy: [desc(moments.createdAt)],
            offset: page_num * limit_num,
            limit: limit_num + 1,
        }));
        
        let hasNext = false;
        if (moments_list.length === limit_num + 1) {
            moments_list.pop();
            hasNext = true;
        }

        // 普通访客仅展示 approved=1 的留言与弹幕，管理员可查看并就地审核
        const formattedList = moments_list.map((m: any) => {
            const rawComments = Array.isArray(m.comments) ? m.comments : [];
            const visibleComments = admin
                ? rawComments
                : rawComments.filter((cm: any) => cm.approved === 1);
            return {
                ...m,
                comments: visibleComments,
                commentsCount: visibleComments.length,
            };
        });
        
        const data = { size: size[0].count, data: formattedList, hasNext };
        await profileAsync(c, 'moments_list_cache_set', () => cache.set(cacheKey, data));
        return c.json(data);
    });

    // POST /moments
    app.post('/', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const body = await profileAsync(c, 'moments_create_parse', () => c.req.json());
        const { content } = body;
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        if (!content) {
            return c.text('Content is required', 400);
        }
        
        const date = new Date();
        const result = await profileAsync(c, 'moments_create_insert', () => db.insert(moments).values({
            content, uid, createdAt: date, updatedAt: date
        }).returning({ insertedId: moments.id }));
        
        await profileAsync(c, 'moments_create_cache_invalidate', () => cache.deletePrefix('moments_'));
        
        if (result.length === 0) {
            return c.text('Failed to insert', 500);
        } else {
            return c.json(result[0]);
        }
    });

    // POST /moments/:id/comments - 发布动态留言/弹幕
    app.post('/:id/comments', async (c: AppContext) => {
        await ensureMomentCommentsTable(c);
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const momentId = parseInt(c.req.param('id'));

        if (Number.isNaN(momentId) || momentId <= 0) {
            return c.text('Invalid moment ID', 400);
        }

        const body = await c.req.json();
        const { content, guestName, guestEmail } = body;

        if (!content || !content.trim()) {
            return c.text('Content is required', 400);
        }

        const moment = await db.query.moments.findFirst({ where: eq(moments.id, momentId) });
        if (!moment) {
            return c.text('Moment not found', 404);
        }

        // 安全风控与智能识别：如果非管理员且含外链 URL 或高危垃圾词，自动转入审批流 (approved=0)
        const hasUrl = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|cn|net|org|top|xyz|cc|me|vip|io|moe|tk|ml|ga|cf|gq))/i.test(content);
        const hasSensitive = /(广告|兼职|博彩|色情|代开发票|刷单|高利贷|加微|VX)/i.test(content);
        const approved = admin ? 1 : (hasUrl || hasSensitive) ? 0 : 1;

        const date = new Date();
        const insertRes = await db.insert(momentComments).values({
            momentId,
            userId: uid || null,
            content: content.trim(),
            guestName: (guestName || "").trim().slice(0, 50),
            guestEmail: (guestEmail || "").trim().slice(0, 100),
            approved,
            createdAt: date,
            updatedAt: date,
        }).returning({ insertedId: momentComments.id });

        await cache.deletePrefix('moments_');

        return c.json({
            id: insertRes[0]?.insertedId,
            approved,
            message: approved === 1 ? '留言发布成功！' : '留言包含链接或需审核，已提交博主审批后公开。',
        });
    });

    // POST /moments/:id/comments/:commentId/approve - 管理员审核通过留言
    app.post('/:id/comments/:commentId/approve', async (c: AppContext) => {
        await ensureMomentCommentsTable(c);
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        if (!admin) return c.text('Forbidden', 403);

        const commentId = parseInt(c.req.param('commentId'));
        if (Number.isNaN(commentId)) return c.text('Invalid comment ID', 400);

        await db.update(momentComments).set({ approved: 1, updatedAt: new Date() }).where(eq(momentComments.id, commentId));
        await cache.deletePrefix('moments_');
        return c.json({ success: true, message: '已审核通过此动态留言！' });
    });

    // DELETE /moments/:id/comments/:commentId - 删除动态留言
    app.delete('/:id/comments/:commentId', async (c: AppContext) => {
        await ensureMomentCommentsTable(c);
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        if (!admin) return c.text('Forbidden', 403);

        const commentId = parseInt(c.req.param('commentId'));
        if (Number.isNaN(commentId)) return c.text('Invalid comment ID', 400);

        await db.delete(momentComments).where(eq(momentComments.id, commentId));
        await cache.deletePrefix('moments_');
        return c.json({ success: true, message: '动态留言已删除' });
    });

    // POST /moments/:id
    app.post('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');
        const body = await profileAsync(c, 'moments_update_parse', () => c.req.json());
        const { content } = body;
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        const id_num = parseInt(id);
        const moment = await profileAsync(c, 'moments_update_lookup', () => db.query.moments.findFirst({ where: eq(moments.id, id_num) }));
        
        if (!moment) {
            return c.text('Not found', 404);
        }
        
        if (!content) {
            return c.text('Content is required', 400);
        }
        
        await profileAsync(c, 'moments_update_db', () => db.update(moments).set({
            content,
            updatedAt: new Date()
        }).where(eq(moments.id, id_num)));
        
        await profileAsync(c, 'moments_update_cache_invalidate', () => cache.deletePrefix('moments_'));
        return c.text('Updated');
    });

    // DELETE /moments/:id
    app.delete('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        const id_num = parseInt(id);
        const moment = await profileAsync(c, 'moments_delete_lookup', () => db.query.moments.findFirst({ where: eq(moments.id, id_num) }));
        
        if (!moment) {
            return c.text('Not found', 404);
        }
        
        await profileAsync(c, 'moments_delete_db', () => db.delete(moments).where(eq(moments.id, id_num)));
        await profileAsync(c, 'moments_delete_cache_invalidate', () => cache.deletePrefix('moments_'));
        return c.text('Deleted');
    });

    return app;
}
