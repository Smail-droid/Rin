import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { AppContext, CacheImpl, DB } from '../core/hono-types';
import { friends } from '../db/schema';
import { notify } from '../utils/webhook';
import { resolveWebhookConfig } from './config-helpers';
import { isValidHttpUrl, isValidSafeMediaUrl, isSafePublicUrl } from '../utils/security';
import { profileAsync } from '../core/server-timing';
import { executeAIChat } from '../utils/ai';

export function FriendService(): Hono {
    const app = new Hono();

    // GET /friend - 获取友链与星标空间列表 (带边缘 CDN 缓存头，释放 Worker 算力)
    app.get('/', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');

        // 只读请求下发边缘 CDN 缓存头：就近边缘节点秒级响应
        if (!admin) {
            c.header('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=120');
        }

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

    // POST /friend/apply - 游客免登录友链/星标空间申请通道 (status = pending)
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

        if (name.length > 100 || desc.length > 3000 || avatar.length > 1000 || url.length > 1000) {
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

    // POST /friend/inspect - 自动嗅探目标站点元数据（title, description, favicon）并由 AI 智能归类
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

            const defaultFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

            let siteTitle = domain;
            let siteDesc = "";
            let siteAvatar = defaultFavicon;
            let rawHtmlText = "";

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒超时熔断

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
                // 网络或超时异常使用保底
            }

            // 智能分类与 AI 提炼
            let suggestedCategory = "友邻博客";
            let aiSummaryDesc = "";

            try {
                const env = c.get('env');
                const serverConfig = c.get('serverConfig');
                if (env && serverConfig) {
                    const cleanText = rawHtmlText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 800);
                    const aiResult = await executeAIChat(env, serverConfig, [
                        {
                            role: "system",
                            content: `你是一个专业的网站信息精炼与分类助手。根据用户提供的网站信息，输出一段【严格不超过10个汉字】的极炼一句话简介（严禁抒情长句，一行说清站点核心定位），并将其归类为以下类别之一：['友邻博客', '主机算力', '探针测速', '极客工具', '技术社区', '漫游灵感']。请直接返回规范的 JSON 格式：{"desc": "极炼简介（10字以内）", "category": "分类名称"}`
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
                                    aiSummaryDesc = parsedAi.desc.replace(/["'“”‘’]/g, "").trim().slice(0, 10);
                                }
                                if (parsedAi.category && typeof parsedAi.category === "string") {
                                    suggestedCategory = parsedAi.category.trim();
                                }
                            }
                        } catch {}
                    }
                }
            } catch {}

            if (aiSummaryDesc) {
                siteDesc = aiSummaryDesc;
            } else if (!siteDesc) {
                siteDesc = siteTitle;
            }

            // 启发式分类引擎
            if (suggestedCategory === "友邻博客" || suggestedCategory === "漫游灵感" || suggestedCategory === "友友们") {
                const combinedContent = `${domain} ${siteTitle} ${siteDesc} ${rawHtmlText}`.toLowerCase();
                if (
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
                    combinedContent.includes("serverstatus")
                ) {
                    suggestedCategory = "探针测速";
                } else if (
                    combinedContent.includes("vps") ||
                    combinedContent.includes("cloud") ||
                    combinedContent.includes("host") ||
                    combinedContent.includes("server") ||
                    combinedContent.includes("idc") ||
                    combinedContent.includes("机房") ||
                    combinedContent.includes("云服务器") ||
                    combinedContent.includes("主机")
                ) {
                    suggestedCategory = "主机算力";
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

    // POST /friend/extract-source-avatar - 提取 NodeSeek 坛友资产 (UID、昵称、Lv等级、鸡腿、发帖、评论) 并持久化头像
    app.post('/extract-source-avatar', async (c: AppContext) => {
        const body: any = await c.req.json().catch(() => ({}));
        const rawUrl = (body?.sourceUrl || "")?.trim();
        if (!rawUrl) {
            return c.json({ error: "Missing source URL or UID" }, 400);
        }

        const env = c.get('env');
        const origin = new URL(c.req.url).origin;

        try {
            let avatarFetchUrl = "";
            let inferredName = body?.name?.trim() || "";
            let fileExt = "png";
            let nsDetail: any = null;

            let nsUid = "";
            const pureDigits = rawUrl.match(/^\d{1,8}$/);
            if (pureDigits) {
                nsUid = pureDigits[0];
            } else {
                const nsMatch = rawUrl.match(/nodeseek\.com\/space\/(\d+)/i) || rawUrl.match(/space\/(\d+)/i);
                if (nsMatch && nsMatch[1]) {
                    nsUid = nsMatch[1];
                }
            }

            let debugLog: any = {};
            if (nsUid) {
                const nsHeaders = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Referer": `https://www.nodeseek.com/space/${nsUid}`,
                    "Accept": "application/json, text/plain, */*",
                };

                // 尝试直接 fetch 并验证响应是有效 JSON 而非 IPv6 错误页面
                const tryParseNsJson = (text: string): any => {
                    if (!text || text.includes("<!DOCTYPE") || text.includes("ipv6") || text.includes("IPv6") || text.includes("DNS")) return null;
                    try { return JSON.parse(text); } catch { return null; }
                };

                const safeFetch = async (url: string, opts: any = {}): Promise<string> => {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => ctrl.abort(), 5000);
                    try {
                        const r = await fetch(url, { ...opts, signal: ctrl.signal });
                        clearTimeout(tid);
                        return r.ok ? await r.text().catch(() => "") : "";
                    } catch {
                        clearTimeout(tid);
                        return "";
                    }
                };

                const apiUrl = `https://www.nodeseek.com/api/account/getInfo/${nsUid}`;
                let infoRes: any = null;

                // 降级链第 1 级：Worker 直连（可能被 IPv6 阻断）
                const directText = await safeFetch(apiUrl, { headers: nsHeaders });
                infoRes = tryParseNsJson(directText);
                debugLog.direct = { len: directText.length, snippet: directText.slice(0, 120), parsed: !!infoRes?.detail };

                // 降级链第 2 级：corsproxy.io 公共 IPv4 代理穿透
                if (!infoRes?.detail) {
                    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`;
                    const proxyText = await safeFetch(proxyUrl, { headers: { "Accept": "application/json" } });
                    infoRes = tryParseNsJson(proxyText);
                    debugLog.corsproxy = { len: proxyText.length, snippet: proxyText.slice(0, 120), parsed: !!infoRes?.detail };
                }

                // 降级链第 3 级：allorigins 公共代理穿透
                if (!infoRes?.detail) {
                    try {
                        const aoUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
                        const aoText = await safeFetch(aoUrl, { headers: { "Accept": "application/json" } });
                        infoRes = tryParseNsJson(aoText);
                        debugLog.allorigins = { len: aoText.length, snippet: aoText.slice(0, 120), parsed: !!infoRes?.detail };
                    } catch (err: any) {
                        debugLog.allorigins = { error: err.message };
                    }
                }

                // 降级链第 4 级：microlink.io HTML 嗅探（最后兜底）
                if (!infoRes?.detail) {
                    try {
                        const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(apiUrl)}&data.body=%7B%22selector%22%3A%22body%22%7D`;
                        const mText = await safeFetch(mUrl, { headers: { "Accept": "application/json" } });
                        debugLog.microlink = { len: mText.length, snippet: mText.slice(0, 200) };
                        if (mText) {
                            const mData: any = JSON.parse(mText);
                            const rawHtml = mData?.data?.body || "";
                            const jsonMatch = rawHtml.match(/\{"success":true,"detail":\{[\s\S]*?\}\}/);
                            if (jsonMatch) {
                                infoRes = JSON.parse(jsonMatch[0]);
                            }
                        }
                    } catch (err: any) {
                        debugLog.microlink = { error: err.message };
                    }
                }

                if (infoRes?.detail) {
                    nsDetail = infoRes.detail;
                } else if (body?.clientNsDetail) {
                    // 接收前端客户端本地网络兜底抓取的真实坛友资料
                    nsDetail = body.clientNsDetail;
                }
                // 标记数据来源：后端已获取 vs 需要客户端兜底
                debugLog.nsDetailResolved = !!nsDetail;
                inferredName = nsDetail?.member_name || body?.name?.trim() || "";
                avatarFetchUrl = `https://www.nodeseek.com/avatar/${nsUid}.png`;
            } else if (rawUrl.includes("github.com/")) {
                const ghMatch = rawUrl.match(/github\.com\/([a-zA-Z0-9_\-]+)/i);
                if (ghMatch && ghMatch[1]) {
                    const ghUser = ghMatch[1];
                    inferredName = inferredName || ghUser;
                    avatarFetchUrl = `https://github.com/${ghUser}.png?size=200`;
                }
            } else {
                const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
                inferredName = inferredName || u.hostname;
                avatarFetchUrl = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
            }

            // 拉取头像并安全持久化至 R2（增加多级 IPv4 代理穿透降级，杜绝将 IPv6 错误页存入 R2）
            let imageBuffer: ArrayBuffer | null = null;
            let contentType = "image/png";

            // 优先检查客户端是否传来了 Base64 图片数据（客户端直连兜底）
            if (body?.clientAvatarBase64 && typeof body.clientAvatarBase64 === "string") {
                try {
                    const base64Data = body.clientAvatarBase64.replace(/^data:image\/\w+;base64,/, "");
                    const binaryString = atob(base64Data);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    if (bytes.length > 100 && bytes[0] !== 0x3c) {
                        imageBuffer = bytes.buffer;
                    }
                } catch {}
            }

            const fetchImageWithFallback = async (primaryUrl: string): Promise<{ buffer: ArrayBuffer | null; ct: string }> => {
                const urls = [
                    // NodeSeek 头像优先走 weserv 全球图像代理（纯净 IPv4 边缘出口，完美绕过 NodeSeek IPv6 封锁与防盗链）
                    ...(nsUid ? [`https://images.weserv.nl/?url=www.nodeseek.com/avatar/${nsUid}.png`] : []),
                    `https://corsproxy.io/?url=${encodeURIComponent(primaryUrl)}`,
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(primaryUrl)}`,
                    primaryUrl,
                ];
                for (const url of urls) {
                    try {
                        const ctrl = new AbortController();
                        const tid = setTimeout(() => ctrl.abort(), 6000);
                        const imgRes = await fetch(url, {
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                            },
                            signal: ctrl.signal,
                        });
                        clearTimeout(tid);
                        if (imgRes.ok) {
                            const ct = imgRes.headers.get("content-type") || "";
                            if (ct.includes("text/html")) continue;
                            const buf = await imgRes.arrayBuffer();
                            if (buf.byteLength < 100) continue;
                            const u8 = new Uint8Array(buf);
                            // 严禁将任何 HTML 文本（首字节为 '<' 或含 <!DOCTYPE/NodeSeek提醒）存入 R2 作为图片
                            if (u8[0] === 0x3c) continue;
                            return { buffer: buf, ct };
                        }
                    } catch {}
                }
                return { buffer: null, ct: "image/png" };
            };

            if (!imageBuffer && avatarFetchUrl) {
                const result = await fetchImageWithFallback(avatarFetchUrl);
                imageBuffer = result.buffer;
                if (result.ct) {
                    const ct = result.ct;
                    if (ct.includes("image/jpeg") || ct.includes("image/jpg")) fileExt = "jpg";
                    else if (ct.includes("image/webp")) fileExt = "webp";
                    else if (ct.includes("image/gif")) fileExt = "gif";
                    else if (ct.includes("image/svg")) fileExt = "svg";
                    else fileExt = "png";
                    contentType = ct || `image/${fileExt}`;
                }
            }

            let finalAvatarUrl = avatarFetchUrl;
            if (imageBuffer && imageBuffer.byteLength > 100 && env?.R2_BUCKET) {
                const safeKey = nsUid ? `avatars/ns_${nsUid}.${fileExt}` : `avatars/site_${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
                try {
                    await env.R2_BUCKET.put(safeKey, imageBuffer, {
                        httpMetadata: { contentType },
                    });
                    finalAvatarUrl = `${origin}/api/blob/${safeKey}`;
                } catch {
                    finalAvatarUrl = avatarFetchUrl;
                }
            }

            return c.json({
                success: true,
                avatarUrl: finalAvatarUrl,
                inferredName,
                nsDetail,
                spaceUrl: nsUid ? (rawUrl.includes("space") ? rawUrl : `https://www.nodeseek.com/space/${nsUid}#/general`) : undefined,
                suggestedDesc: nsDetail?.bio ? nsDetail.bio.slice(0, 40) : (inferredName ? `${inferredName}的空间` : "个人技术生活随想"),
                debug: debugLog,
            });
        } catch (e: any) {
            return c.json({ error: e.message || "Extract failed" }, 500);
        }
    });

    // POST /friend/ai-refine-desc - AI 智能精炼简介 (不超过 10 个汉字，单行说清核心)
    app.post('/ai-refine-desc', async (c: AppContext) => {
        const body: any = await c.req.json().catch(() => ({}));
        const url = (body.url || "").trim();
        const title = (body.title || "").trim();
        const curDesc = (body.currentDesc || "").trim();
        const ns = body.nsData;
        const cat = body.category || "友邻博客";

        const env = c.get('env');
        const serverConfig = c.get('serverConfig');

        let aiRefined = "";
        try {
            if (env && serverConfig) {
                const userPrompt = [
                    `站点网址: ${url || "未提供"}`,
                    `站点名称/标题: ${title || "未提供"}`,
                    `当前描述/摘要: ${curDesc || "未提供"}`,
                    `站点分类: ${cat}`,
                    ns ? `来源 NodeSeek 坛友: ${ns.name || ns.member_name} (Lv.${ns.rank || 1}, 鸡腿:${ns.coin || 0})` : "",
                ].filter(Boolean).join("\n");

                const aiRes = await executeAIChat(env, serverConfig, [
                    {
                        role: "system",
                        content: `你是一个专业的画廊博客鉴赏官。请根据提供的站点与博主信息，为该站点生成一段【严格不超过10个汉字】的极炼一句话定位说明（要求：必须在4到10个字之间，严格禁止超过10个汉字，严禁诗意抒情、排比长句或任何多余标点，一行说清核心业务）。直接输出最终文字，不要带有任何标点前缀或引号。`
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ]);

                if (aiRes.success && aiRes.reply) {
                    aiRefined = aiRes.reply.replace(/["'“”‘’]/g, "").trim().slice(0, 10);
                }
            }
        } catch {}

        if (!aiRefined) {
            if (cat === "主机算力") {
                aiRefined = "极客云基建与算力分享";
            } else if (cat === "极客工具") {
                aiRefined = "实用轻量极客数字工具";
            } else if (cat === "技术社区") {
                aiRefined = "极客技术交流论坛群落";
            } else if (cat === "漫游灵感") {
                aiRefined = "漫游灵感美学艺术画廊";
            } else if (ns?.member_name) {
                aiRefined = `${ns.member_name}的空间`;
            } else if (title && !title.includes("http") && title.length <= 10) {
                aiRefined = `${title.slice(0, 6)}的个人博客`;
            } else {
                aiRefined = "个人技术生活随想";
            }
        }
        aiRefined = aiRefined.slice(0, 40);

        return c.json({ success: true, desc: aiRefined });
    });

    // POST /friend - 管理员直接收录 / 用户已登录申请
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

        if (name.length > 20 || desc.length > 3000 || avatar.length > 500 || url.length > 500) {
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

    // PUT /friend/:id - 更新友链
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

        if (name && name.length > 100) return c.text('Name too long', 400);
        if (desc && desc.length > 3000) return c.text('Desc too long', 400);

        const friend = await profileAsync(c, 'friend_update_lookup', () => db.query.friends.findFirst({ where: eq(friends.id, id_num) }));
        if (!friend) {
            return c.text('Not found', 404);
        }

        if (!admin && friend.uid !== uid) {
            return c.text('Unauthorized', 401);
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (desc !== undefined) updateData.desc = desc;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (url !== undefined) updateData.url = url;
        if (admin && accepted !== undefined) updateData.accepted = accepted;
        if (admin && sort_order !== undefined) updateData.sort_order = sort_order;

        await profileAsync(c, 'friend_update_exec', () => db.update(friends).set(updateData).where(eq(friends.id, id_num)));

        // 若管理员审批通过，触发 Webhook 提醒
        if (admin && accepted === 1 && friend.accepted === 0) {
            const {
                webhookUrl,
                webhookMethod,
                webhookContentType,
                webhookHeaders,
                webhookBodyTemplate,
            } = await profileAsync(c, 'friend_update_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            const content = `${frontendUrl}/friends\n友链已通过审核: ${friend.name}\n${friend.url}`;
            await profileAsync(c, 'friend_update_notify', () => notify(
                webhookUrl || "",
                {
                    event: "friend.accepted",
                    message: content,
                    title: friend.name,
                    url: `${frontendUrl}/friends`,
                    username: username || "系统管理员",
                    content: friend.url,
                    description: friend.desc || "",
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

    // DELETE /friend/:id - 删除友链
    app.delete('/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        const uid = c.get('uid');
        const db = c.get('db');
        const id = c.req.param('id');
        const id_num = parseInt(id);
        if (Number.isNaN(id_num) || id_num <= 0) {
            return c.text('Invalid friend ID', 400);
        }

        const friend = await profileAsync(c, 'friend_delete_lookup', () => db.query.friends.findFirst({ where: eq(friends.id, id_num) }));
        if (!friend) {
            return c.text('Not found', 404);
        }

        if (!admin && friend.uid !== uid) {
            return c.text('Unauthorized', 401);
        }

        await profileAsync(c, 'friend_delete_exec', () => db.delete(friends).where(eq(friends.id, id_num)));
        return c.text('OK');
    });

    return app;
}

// 友链自动健康检测定时任务
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

            if (response.ok) {
                ctx.waitUntil(db.update(friends).set({ health: "" }).where(eq(friends.id, friend.id)));
                health++;
            } else {
                ctx.waitUntil(db.update(friends).set({ health: `${response.status}` }).where(eq(friends.id, friend.id)));
                unhealthy++;
            }
        } catch (e: any) {
            console.error(e.message);
            ctx.waitUntil(db.update(friends).set({ health: e.message }).where(eq(friends.id, friend.id)));
            unhealthy++;
        }
    }

    console.info(`update friends health done. Total: ${health + unhealthy}, Healthy: ${health}, Unhealthy: ${unhealthy}`);
}
