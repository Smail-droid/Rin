import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext, CacheImpl, DB } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import * as schema from "../db/schema";
import { friends } from "../db/schema";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";
import { isValidHttpUrl, isValidSafeMediaUrl, sanitizeHttpUrl, isSafePublicUrl } from "../utils/security";
import { executeAIChat } from "../utils/ai";

export function FriendService(): Hono {
    const app = new Hono();

    // GET /friend
    app.get('/', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');
        
        const friend_list = await profileAsync(c, 'friend_list_db', () => (admin
            ? db.query.friends.findMany({
                orderBy: (friends: any, { asc, desc }: { asc: any, desc: any }) => [
                    desc(friends.sort_order), 
                    asc(friends.createdAt)
                ]
            })
            : db.query.friends.findMany({
                where: eq(friends.accepted, 1),
                orderBy: (friends: any, { asc, desc }: { asc: any, desc: any }) => [
                    desc(friends.sort_order), 
                    asc(friends.createdAt)
                ]
            })));
            
        const apply_list = uid ? await profileAsync(c, 'friend_apply_lookup', () => db.query.friends.findFirst({ where: eq(friends.uid, uid) })) : null;
        return c.json({ friend_list, apply_list });
    });

    // POST /friend/apply - 游客免登录友链/收录申请通道 (status = pending)
    app.post('/apply', async (c: AppContext) => {
        const db = c.get('db');
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const body = await profileAsync(c, 'friend_guest_apply_parse', () => c.req.json());
        const { name, desc, avatar, url } = body;

        const enable = await profileAsync(c, 'friend_apply_config', () => clientConfig.getOrDefault('friend_apply_enable', true));
        if (!enable) {
            return c.text('Friend Link Apply Disabled', 403);
        }

        if (!name || !desc || !avatar || !url) {
            return c.text('Invalid input', 400);
        }

        if (name.length > 30 || desc.length > 150 || avatar.length > 250 || url.length > 250) {
            return c.text('Invalid input', 400);
        }

        if (!isValidHttpUrl(url)) {
            return c.text('Invalid URL: must start with http:// or https://', 400);
        }

        if (!isValidSafeMediaUrl(avatar)) {
            return c.text('Invalid avatar URL: unsafe protocol not allowed', 400);
        }

        // 绑定至系统默认主用户（站长）
        const firstUser = await profileAsync(c, 'friend_apply_find_user', () => db.query.users.findFirst());
        const targetUid = firstUser ? firstUser.id : 1;

        await profileAsync(c, 'friend_guest_apply_insert', () => db.insert(friends).values({
            name, desc, avatar, url, uid: targetUid, accepted: 0
        }));

        const {
            webhookUrl,
            webhookMethod,
            webhookContentType,
            webhookHeaders,
            webhookBodyTemplate,
        } = await profileAsync(c, 'friend_guest_apply_webhook', () => resolveWebhookConfig(serverConfig, env));
        const frontendUrl = new URL(c.req.url).origin;
        const content = `${frontendUrl}/friends\n游客申请收录: ${name}\n${desc}\n${url}`;
        await profileAsync(c, 'friend_guest_apply_notify', () => notify(
            webhookUrl || "",
            {
                event: "friend.created",
                message: content,
                title: name,
                url: `${frontendUrl}/friends`,
                username: "游客",
                content: url,
                description: desc,
            },
            {
                method: webhookMethod,
                contentType: webhookContentType,
                headers: webhookHeaders,
                bodyTemplate: webhookBodyTemplate,
            },
        ));

        return c.text('OK');
    });
    app.post('/inspect', async (c: AppContext) => {
        const body = await c.req.json<{ url?: string }>().catch(() => ({ url: "" }));
        const rawUrl = body?.url?.trim();
        if (!rawUrl || !isValidHttpUrl(rawUrl)) {
            return c.json({ error: "Invalid URL" }, 400);
        }

        try {
            const parsed = new URL(rawUrl);
            const domain = parsed.hostname;
            const origin = parsed.origin;

            // 预设高可靠的 Google Favicon 服务与多重 CDN 图标回退
            const defaultFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

            // 尝试抓取目标页面的 HTML <title> 与 <meta name="description">
            let siteTitle = domain;
            let siteDesc = "个人博主 / 精彩站点";
            let siteAvatar = defaultFavicon;
            let rawHtmlText = "";

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒超时保护

                const resp = await fetch(rawUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml",
                    },
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (resp.ok) {
                    const html = await resp.text();
                    rawHtmlText = html.slice(0, 3000);
                    
                    // 1. 匹配 <title>
                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                    if (titleMatch && titleMatch[1]?.trim()) {
                        siteTitle = titleMatch[1].trim().slice(0, 30);
                    }

                    // 2. 匹配 description
                    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
                        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
                        || html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
                    if (descMatch && descMatch[1]?.trim()) {
                        siteDesc = descMatch[1].trim().slice(0, 100);
                    }

                    // 3. 匹配 icon
                    const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
                    if (iconMatch && iconMatch[1]) {
                        const href = iconMatch[1].trim();
                        if (href.startsWith("http")) siteAvatar = href;
                        else if (href.startsWith("//")) siteAvatar = `https:${href}`;
                        else if (href.startsWith("/")) siteAvatar = `${origin}${href}`;
                        else siteAvatar = `${origin}/${href}`;
                    }
                }
            } catch {
                // 网络或超时异常时，自动平滑使用 Google Favicon 与域名作为保底
            }

            // 智能分类与 AI 提炼
            let suggestedCategory = "友邻博客";
            let aiSummaryDesc = "";

            // 尝试通过后台配置的 AI 进行智能提炼与自动归类
            try {
                const env = c.get('env');
                const serverConfig = c.get('serverConfig');
                if (env && serverConfig) {
                    const cleanText = rawHtmlText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 800);
                    const aiResult = await executeAIChat(env, serverConfig, [
                        {
                            role: "system",
                            content: `你是一个专业的网站信息精炼与分类助手。根据用户提供的网站信息，输出一段不超过40字的精炼中文简介，并将其归类为以下类别之一：['友邻博客', '主机算力', '探针测速', '极客工具', '技术社区', '漫游灵感']。请直接返回规范的 JSON 格式：{"desc": "精炼中文简介（40字以内）", "category": "分类名称"}`
                        },
                        {
                            role: "user",
                            content: `网站地址: ${rawUrl}\n网站标题: ${siteTitle}\n初始描述: ${siteDesc}\n网页文本摘要: ${cleanText}`
                        }
                    ]);

                    if (aiResult.success && aiResult.reply) {
                        try {
                            const jsonMatch = aiResult.reply.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const parsedAi = JSON.parse(jsonMatch[0]);
                                if (parsedAi.desc && typeof parsedAi.desc === "string") {
                                    aiSummaryDesc = parsedAi.desc.trim().slice(0, 100);
                                }
                                if (parsedAi.category && typeof parsedAi.category === "string") {
                                    suggestedCategory = parsedAi.category.trim();
                                }
                            }
                        } catch {
                            // JSON 容错
                        }
                    }
                }
            } catch {
                // AI 异常或未开启时无缝降级到启发式规则
            }

            if (aiSummaryDesc) {
                siteDesc = aiSummaryDesc;
            }

            // 启发式分类引擎（兼作保底与规则强化）
            if (suggestedCategory === "友邻博客" || suggestedCategory === "漫游灵感" || suggestedCategory === "友友们" || suggestedCategory === "其他灵感") {
                const combinedContent = `${domain} ${siteTitle} ${siteDesc} ${rawHtmlText}`.toLowerCase();
                if (
                    combinedContent.includes("vps") ||
                    combinedContent.includes("cloud") ||
                    combinedContent.includes("host") ||
                    combinedContent.includes("server") ||
                    combinedContent.includes("idc") ||
                    combinedContent.includes("机房") ||
                    combinedContent.includes("买鸡") ||
                    combinedContent.includes("云服务器") ||
                    combinedContent.includes("主机")
                ) {
                    suggestedCategory = "主机算力";
                } else if (
                    combinedContent.includes("speedtest") ||
                    combinedContent.includes("looking glass") ||
                    combinedContent.includes("probe") ||
                    combinedContent.includes("ping") ||
                    combinedContent.includes("bgp") ||
                    combinedContent.includes("测速") ||
                    combinedContent.includes("路由") ||
                    combinedContent.includes("回程") ||
                    combinedContent.includes("traceroute") ||
                    combinedContent.includes("探针") ||
                    combinedContent.includes("nezha") ||
                    combinedContent.includes("uptime") ||
                    combinedContent.includes("serverstatus") ||
                    combinedContent.includes("监控")
                ) {
                    suggestedCategory = "探针测速";
                } else if (
                    combinedContent.includes("github") ||
                    combinedContent.includes("tool") ||
                    combinedContent.includes("api") ||
                    combinedContent.includes("docker") ||
                    combinedContent.includes("dev") ||
                    combinedContent.includes("toolbox") ||
                    combinedContent.includes("工具") ||
                    combinedContent.includes("转换")
                ) {
                    suggestedCategory = "极客工具";
                } else if (
                    combinedContent.includes("nodeseek") ||
                    combinedContent.includes("v2ex") ||
                    combinedContent.includes("linux.do") ||
                    combinedContent.includes("hostloc") ||
                    combinedContent.includes("community") ||
                    combinedContent.includes("forum") ||
                    combinedContent.includes("论坛") ||
                    combinedContent.includes("社区")
                ) {
                    suggestedCategory = "技术社区";
                } else if (
                    combinedContent.includes("design") ||
                    combinedContent.includes("art") ||
                    combinedContent.includes("灵感") ||
                    combinedContent.includes("画廊") ||
                    combinedContent.includes("美学")
                ) {
                    suggestedCategory = "漫游灵感";
                } else {
                    suggestedCategory = "友邻博客";
                }
            }

            return c.json({
                name: siteTitle,
                desc: siteDesc,
                avatar: siteAvatar,
                url: rawUrl,
                domain,
                category: suggestedCategory,
            });
        } catch (e: any) {
            return c.json({ error: e.message || "Inspect failed" }, 400);
        }
    });

    // POST /friend
    app.post('/', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const username = c.get('username');
        const db = c.get('db');
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const body = await profileAsync(c, 'friend_create_parse', () => c.req.json());
        const { name, desc, avatar, url } = body;
        
        const enable = await profileAsync(c, 'friend_create_config', () => clientConfig.getOrDefault('friend_apply_enable', true));
        if (!enable && !admin) {
            return c.text('Friend Link Apply Disabled', 403);
        }
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }

        if (!name || !desc || !avatar || !url) {
            return c.text('Invalid input', 400);
        }
        
        if (name.length > 20 || desc.length > 100 || avatar.length > 200 || url.length > 200) {
            return c.text('Invalid input', 400);
        }
        
        if (!isValidHttpUrl(url)) {
            return c.text('Invalid URL: must start with http:// or https://', 400);
        }

        if (!isValidSafeMediaUrl(avatar)) {
            return c.text('Invalid avatar URL: unsafe protocol not allowed', 400);
        }
        
        if (!admin) {
            const exist = await profileAsync(c, 'friend_create_existing', () => db.query.friends.findFirst({ where: eq(friends.uid, uid) }));
            if (exist) {
                return c.text('Already sent', 400);
            }
        }
        
        const accepted = admin ? 1 : 0;
        await profileAsync(c, 'friend_create_insert', () => db.insert(friends).values({
            name, desc, avatar, url, uid: uid, accepted
        }));

        if (!admin) {
            const {
                webhookUrl,
                webhookMethod,
                webhookContentType,
                webhookHeaders,
                webhookBodyTemplate,
            } = await profileAsync(c, 'friend_create_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            const authorName = username || "游客";
            const content = `${frontendUrl}/friends\n${authorName} 申请友链: ${name}\n${desc}\n${url}`;
            await profileAsync(c, 'friend_create_notify', () => notify(
                webhookUrl || "",
                {
                    event: "friend.created",
                    message: content,
                    title: name,
                    url: `${frontendUrl}/friends`,
                    username: authorName,
                    content: url,
                    description: desc,
                },
                {
                    method: webhookMethod,
                    contentType: webhookContentType,
                    headers: webhookHeaders,
                    bodyTemplate: webhookBodyTemplate,
                },
            ));
        }
        return c.text('OK');
    });

    // PUT /friend/:id
    app.put('/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const username = c.get('username');
        const db = c.get('db');
        const env = c.get('env');
        const clientConfig = c.get('clientConfig');
        const serverConfig = c.get('serverConfig');
        const id = c.req.param('id');
        const id_num = parseInt(id);
        if (Number.isNaN(id_num) || id_num <= 0) {
            return c.text('Invalid friend ID', 400);
        }
        const body = await profileAsync(c, 'friend_update_parse', () => c.req.json());
        const { name, desc, avatar, url, accepted, sort_order } = body;
        
        const enable = await profileAsync(c, 'friend_update_config', () => clientConfig.getOrDefault('friend_apply_enable', true));
        if (!enable && !admin) {
            return c.text('Friend Link Apply Disabled', 403);
        }
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }

        if (url && !isValidHttpUrl(url)) {
            return c.text('Invalid URL: must start with http:// or https://', 400);
        }

        if (avatar && !isValidSafeMediaUrl(avatar)) {
            return c.text('Invalid avatar URL: unsafe protocol not allowed', 400);
        }
        
        const exist = await profileAsync(c, 'friend_update_lookup', () => db.query.friends.findFirst({ where: eq(friends.id, id_num) }));
        if (!exist) {
            return c.text('Not found', 404);
        }
        
        if (!admin && exist.uid !== uid) {
            return c.text('Permission denied', 403);
        }
        
        let finalAccepted = accepted;
        let finalSortOrder = sort_order;
        
        if (!admin) {
            finalAccepted = 0;
            finalSortOrder = undefined;
        }
        
        function wrap(s: string | undefined) {
            return s ? s.length === 0 ? undefined : s : undefined;
        }
        
        await profileAsync(c, 'friend_update_db', () => db.update(friends).set({
            name: wrap(name),
            desc: wrap(desc),
            avatar: wrap(avatar),
            url: wrap(url),
            accepted: finalAccepted === undefined ? undefined : finalAccepted,
            sort_order: finalSortOrder === undefined ? undefined : finalSortOrder,
        }).where(eq(friends.id, id_num)));
        
        if (!admin) {
            const {
                webhookUrl,
                webhookMethod,
                webhookContentType,
                webhookHeaders,
                webhookBodyTemplate,
            } = await profileAsync(c, 'friend_update_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            const content = `${frontendUrl}/friends\n${username} 更新友链: ${name}\n${desc}\n${url}`;
            await profileAsync(c, 'friend_update_notify', () => notify(
                webhookUrl || "",
                {
                    event: "friend.updated",
                    message: content,
                    title: name,
                    url: `${frontendUrl}/friends`,
                    username: username || "",
                    content: url,
                    description: desc,
                },
                {
                    method: webhookMethod,
                    contentType: webhookContentType,
                    headers: webhookHeaders,
                    bodyTemplate: webhookBodyTemplate,
                },
            ));
        }
        return c.text('OK');
    });

    // DELETE /friend/:id
    app.delete('/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');
        const id = c.req.param('id');
        const id_num = parseInt(id);
        if (Number.isNaN(id_num) || id_num <= 0) {
            return c.text('Invalid friend ID', 400);
        }
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        const exist = await profileAsync(c, 'friend_delete_lookup', () => db.query.friends.findFirst({ where: eq(friends.id, id_num) }));
        if (!exist) {
            return c.text('Not found', 404);
        }
        
        if (!admin && exist.uid !== uid) {
            return c.text('Permission denied', 403);
        }
        
        await profileAsync(c, 'friend_delete_db', () => db.delete(friends).where(eq(friends.id, id_num)));
        return c.text('OK');
    });

    return app;
}

export async function friendCrontab(
    env: Env,
    ctx: ExecutionContext,
    db: DB,
    cache: CacheImpl,
    serverConfig: CacheImpl,
    clientConfig: CacheImpl
) {
    const enable = await serverConfig.getOrDefault('friend_crontab', true);
    const ua = await serverConfig.get('friend_ua') || 'Rin-Check/0.1.0';
    
    if (!enable) {
        console.info('friend crontab disabled');
        return;
    }
    
    const friend_list = await db.query.friends.findMany();
    console.info(`total friends: ${friend_list.length}`);
    
    let health = 0;
    let unhealthy = 0;
    
    for (const friend of friend_list) {
        if (!isSafePublicUrl(friend.url)) {
            console.warn(`[FriendCrontab] Skipping non-public URL for ${friend.name}: ${friend.url}`);
            continue;
        }
        console.info(`checking ${friend.name}: ${friend.url}`);
        try {
            const response = await fetch(new Request(friend.url, { 
                method: 'GET', 
                headers: { 'User-Agent': ua } 
            }));
            console.info(`response status: ${response.status}`);
            console.info(`response statusText: ${response.statusText}`);
            
            if (response.ok) {
                ctx.waitUntil(db.update(schema.friends).set({ health: "" }).where(eq(schema.friends.id, friend.id)));
                health++;
            } else {
                ctx.waitUntil(db.update(schema.friends).set({ health: `${response.status}` }).where(eq(schema.friends.id, friend.id)));
                unhealthy++;
            }
        } catch (e: any) {
            console.error(e.message);
            ctx.waitUntil(db.update(schema.friends).set({ health: e.message }).where(eq(schema.friends.id, friend.id)));
            unhealthy++;
        }
    }
    
    console.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`);
}
