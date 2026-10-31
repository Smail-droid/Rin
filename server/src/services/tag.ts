import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { DB } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { feedHashtags, hashtags } from "../db/schema";
import type { AppContext } from "../core/hono-types";

export function TagService(): Hono {
    const app = new Hono();

    // GET /tag
    app.get('/', async (c: AppContext) => {
        const db = c.get('db');
        
        const tag_list = await profileAsync(c, 'tag_list_db', () => db.query.hashtags.findMany({
            with: {
                feeds: { columns: { feedId: true } }
            }
        }));
        
        const result = tag_list.map((tag: any) => ({
            ...tag,
            feeds: tag.feeds.length
        }));
        
        return c.json(result);
    });

    // GET /tag/:name
    app.get('/:name', async (c: AppContext) => {
        const db = c.get('db');
        const admin = c.get('admin');
        const nameDecoded = decodeURI(c.req.param('name'));
        
        const tag = await profileAsync(c, 'tag_detail_db', () => db.query.hashtags.findFirst({
            where: eq(hashtags.name, nameDecoded),
            with: {
                feeds: {
                    with: {
                        feed: {
                            columns: {
                                id: true, title: true, summary: true, content: true, 
                                createdAt: true, updatedAt: true, draft: false, listed: false
                            },
                            with: {
                                user: { columns: { id: true, username: true, avatar: true } },
                                hashtags: {
                                    columns: {},
                                    with: { hashtag: { columns: { id: true, name: true } } }
                                }
                            },
                            where: (feeds: any) => admin ? undefined : and(eq(feeds.draft, 0), eq(feeds.listed, 1))
                        } as any
                    }
                }
            }
        }));
        
        const tagFeeds = tag?.feeds.map((tagFeed: any) => {
            if (!tagFeed.feed) return null;
            return {
                ...tagFeed.feed,
                hashtags: tagFeed.feed.hashtags.map((hashtag: any) => hashtag.hashtag)
            };
        }).filter((feed: any) => feed !== null);
        
        if (!tag) {
            return c.text('Not found', 404);
        }
        
        return c.json({ ...tag, feeds: tagFeeds });
    });

    // POST /tag - Create a new tag (admin only)
    app.post('/', async (c: AppContext) => {
        const admin = c.get('admin');
        if (!admin) return c.text('Permission denied', 403);
        const db = c.get('db');
        const body = await c.req.json<{ name: string }>().catch(() => ({ name: "" }));
        const name = (body.name || "").trim();
        if (!name) return c.text('Tag name cannot be empty', 400);

        const existing = await db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
        if (existing) return c.json(existing);

        const inserted = await db.insert(hashtags).values({ name }).returning();
        return c.json(inserted[0]);
    });

    // PUT /tag/:id - Rename a tag (admin only)
    app.put('/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        if (!admin) return c.text('Permission denied', 403);
        const db = c.get('db');
        const id_num = parseInt(c.req.param('id'), 10);
        if (Number.isNaN(id_num) || id_num <= 0) return c.text('Invalid tag ID', 400);

        const body = await c.req.json<{ name: string }>().catch(() => ({ name: "" }));
        const newName = (body.name || "").trim();
        if (!newName) return c.text('Tag name cannot be empty', 400);

        const exist = await db.query.hashtags.findFirst({ where: eq(hashtags.id, id_num) });
        if (!exist) return c.text('Tag not found', 404);

        await db.update(hashtags).set({ name: newName, updatedAt: new Date() }).where(eq(hashtags.id, id_num));
        return c.json({ id: id_num, name: newName });
    });

    // DELETE /tag/:id - Delete a tag (admin only)
    app.delete('/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        if (!admin) return c.text('Permission denied', 403);
        const db = c.get('db');
        const id_num = parseInt(c.req.param('id'), 10);
        if (Number.isNaN(id_num) || id_num <= 0) return c.text('Invalid tag ID', 400);

        await db.delete(feedHashtags).where(eq(feedHashtags.hashtagId, id_num));
        await db.delete(hashtags).where(eq(hashtags.id, id_num));
        return c.text('Deleted');
    });

    return app;
}

export async function bindTagToPost(db: DB, feedId: number, tags: string[]) {
    await db.delete(feedHashtags).where(eq(feedHashtags.feedId, feedId));

    const normalizedTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    if (normalizedTags.length === 0) {
        return;
    }

    const existingTags = await db.select({ id: hashtags.id, name: hashtags.name })
        .from(hashtags)
        .where(inArray(hashtags.name, normalizedTags));
    const tagIds = new Map(existingTags.map((tag) => [tag.name, tag.id]));
    const missingTags = normalizedTags.filter((tag) => !tagIds.has(tag));

    if (missingTags.length > 0) {
        const insertedTags = await db.insert(hashtags)
            .values(missingTags.map((name) => ({ name })))
            .returning({ id: hashtags.id, name: hashtags.name });
        for (const tag of insertedTags) {
            tagIds.set(tag.name, tag.id);
        }
    }

    await db.insert(feedHashtags).values(normalizedTags.map((name) => ({
        feedId,
        hashtagId: tagIds.get(name)!,
    })));
}
