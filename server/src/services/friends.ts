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

const PROBE_NODES_KEY = "probe/nodes.json";

export interface ProbeMachineNode {
    id: string;
    name: string;
    countryCode: string;
    merchant: string;
    model: string;
    routeTag: string;
    price?: string;
    usage?: string;
    cpu?: string;
    ram?: string;
    disk?: string;
    cpuUsage?: number;
    ramUsage?: number;
    diskUsage?: number;
    bandwidth?: string;
    traffic?: string;
    uptimeDays: number;
    telecomPing: number;
    unicomPing: number;
    mobilePing: number;
    packetLoss: number;
    sourceUrl: string;
    probeName?: string;
    updatedAt: string;
}

async function loadProbeNodes(env: any): Promise<ProbeMachineNode[]> {
    if (!env?.R2_BUCKET) return [];
    try {
        const obj = await env.R2_BUCKET.get(PROBE_NODES_KEY);
        if (!obj) return [];
        return await obj.json();
    } catch {
        return [];
    }
}

async function saveProbeNodes(env: any, nodes: ProbeMachineNode[]) {
    if (!env?.R2_BUCKET) return;
    try {
        await env.R2_BUCKET.put(PROBE_NODES_KEY, JSON.stringify(nodes), {
            httpMetadata: { contentType: "application/json" },
        });
    } catch (e) {
        console.error("Failed to save probe nodes index:", e);
    }
}

function domainKey(origin: string): string {
    return origin.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
}

function inferMerchantFromName(name: string): string {
    const l = name.toLowerCase();
    if (l.includes("dmit")) return "DMIT";
    if (l.includes("vmiss")) return "VMISS";
    if (l.includes("tencent") || l.includes("腾讯")) return "Tencent";
    if (l.includes("ali") || l.includes("阿里")) return "Alibaba";
    if (l.includes("bwh") || l.includes("bandwagon") || l.includes("搬瓦工")) return "BandwagonHost";
    if (l.includes("v.ps") || l.includes("vps")) return "V.PS";
    if (l.includes("panstar")) return "PanStar";
    if (l.includes("yunyoo")) return "YUNYOO";
    if (l.includes("shandun")) return "ShanDun";
    if (l.includes("zgocloud") || l.includes("zgo")) return "ZgoCloud";
    if (l.includes("lightlayer")) return "Lightlayer";
    if (l.includes("svyun")) return "SVYUN";
    if (l.includes("aws")) return "AWS";
    if (l.includes("oracle") || l.includes("甲骨文")) return "Oracle";
    return "云厂商";
}

function inferRouteTagFromName(name: string): string {
    const l = name.toLowerCase();
    if (l.includes("gia") || l.includes("cn2")) return "CN2GIA";
    if (l.includes("9929")) return "9929";
    if (l.includes("4837")) return "4837";
    if (l.includes("cmi")) return "CMI";
    if (l.includes("cmin2")) return "CMIN2";
    if (l.includes("bgp")) return "BGP";
    if (l.includes("iij")) return "IIJ";
    return "优质网络";
}

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

    // POST /extract-source-avatar (从 NodeSeek 空间提取真实头像与昵称并存入 R2 avatars/ 独立目录)
    app.post('/extract-source-avatar', async (c: AppContext) => {
        const body: any = await c.req.json().catch(() => ({}));
        const rawUrl = (body?.sourceUrl || "")?.trim();
        if (!rawUrl || !isValidHttpUrl(rawUrl)) {
            return c.json({ error: "Invalid source URL" }, 400);
        }

        const env = c.get('env');
        const origin = new URL(c.req.url).origin;

        try {
            let avatarFetchUrl = "";
            let inferredName = body?.name?.trim() || "";
            let fileExt = "png";
            let nsDetail: any = null;

            // 1. 特别适配 NodeSeek 个人空间：https://www.nodeseek.com/space/61231#/general
            const nsMatch = rawUrl.match(/nodeseek\.com\/space\/(\d+)/i);
            if (nsMatch && nsMatch[1]) {
                const uid = nsMatch[1];
                const nsHeaders = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                    "Referer": `https://www.nodeseek.com/space/${uid}`,
                    "Accept": "application/json, text/plain, */*",
                };

                // 尝试拉取 NodeSeek 用户信息
                const fetchNsApi = async (u: string, proxy?: string) => {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => ctrl.abort(), 4000);
                    try {
                        const init: any = { headers: nsHeaders, signal: ctrl.signal };
                        if (proxy) init.proxy = proxy;
                        const r = await fetch(u, init);
                        clearTimeout(tid);
                        if (r.ok) return await r.json().catch(() => null);
                    } catch {
                        clearTimeout(tid);
                    }
                    return null;
                };

                let infoRes: any = await fetchNsApi(`https://www.nodeseek.com/api/account/getInfo/${uid}`);
                if (!infoRes) {
                    infoRes = await fetchNsApi(`https://www.nodeseek.com/api/account/getInfo/${uid}`, "http://127.0.0.1:10808");
                }

                if (infoRes?.detail) {
                    nsDetail = infoRes.detail;
                    inferredName = nsDetail.member_name || `NodeSeek#${uid}`;
                } else {
                    inferredName = inferredName || `NodeSeek#${uid}`;
                }

                // NodeSeek 真实用户头像直链 (通过 Referer 访问)
                avatarFetchUrl = `https://www.nodeseek.com/avatar/${uid}.png`;
            } else if (rawUrl.includes("github.com/")) {
                const ghMatch = rawUrl.match(/github\.com\/([a-zA-Z0-9_\-]+)/i);
                if (ghMatch && ghMatch[1]) {
                    const ghUser = ghMatch[1];
                    inferredName = inferredName || ghUser;
                    avatarFetchUrl = `https://github.com/${ghUser}.png?size=200`;
                }
            } else {
                const u = new URL(rawUrl);
                inferredName = inferredName || u.hostname;
                avatarFetchUrl = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
            }

            // 2. 由 Worker 在边缘端拉取用户真实头像二进制流 (带 Referer 突破防盗链)
            let imageBuffer: ArrayBuffer | null = null;
            let contentType = "image/png";

            const fetchImage = async (imgUrl: string, proxy?: string) => {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), 4000);
                try {
                    const init: any = {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                            "Referer": rawUrl,
                            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*",
                        },
                        signal: ctrl.signal,
                    };
                    if (proxy) init.proxy = proxy;
                    const res = await fetch(imgUrl, init);
                    clearTimeout(tid);
                    if (res.ok) {
                        const ct = res.headers.get("content-type") || "image/png";
                        if (!ct.includes("text/html")) {
                            return { buf: await res.arrayBuffer(), ct };
                        }
                    }
                } catch {
                    clearTimeout(tid);
                }
                return null;
            };

            let imgResult = await fetchImage(avatarFetchUrl);
            if (!imgResult) {
                imgResult = await fetchImage(avatarFetchUrl, "http://127.0.0.1:10808");
            }

            if (imgResult) {
                imageBuffer = imgResult.buf;
                contentType = imgResult.ct;
                if (contentType.includes("webp")) fileExt = "webp";
                else if (contentType.includes("jpeg") || contentType.includes("jpg")) fileExt = "jpg";
                else if (contentType.includes("svg")) fileExt = "svg";
            }

            // 3. 持久化存入 Cloudflare R2 专属独立目录 avatars/ (绝不与 images/ 和 music/ 冲突)
            const cleanKeyPart = rawUrl.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
            const storageKey = `avatars/${Date.now()}_${cleanKeyPart}.${fileExt}`;
            let finalAvatarUrl = avatarFetchUrl;

            if (imageBuffer && env?.R2_BUCKET) {
                await env.R2_BUCKET.put(storageKey, imageBuffer, {
                    httpMetadata: { contentType },
                    customMetadata: {
                        sourceUrl: rawUrl,
                        inferredName,
                    },
                });
                finalAvatarUrl = `${origin}/api/blob/${encodeURIComponent(storageKey)}`;
            }

            // 构建建议描述
            let suggestedDesc = `个人博主 / 精彩站点`;
            if (nsDetail) {
                suggestedDesc = `NodeSeek 用户 ${inferredName} 的空间 (等级 ${nsDetail.rank || 1} · ${nsDetail.coin || 0} 鸡腿 · ${nsDetail.created_at_str || ""})`;
            }

            return c.json({
                success: true,
                avatarUrl: finalAvatarUrl,
                storageKey: imageBuffer ? storageKey : undefined,
                inferredName,
                nsDetail,
                suggestedDesc,
            });
        } catch (e: any) {
            return c.json({ error: e.message || "Extract failed" }, 500);
        }
    });

    // POST /sniff-probe (智能嗅探 Komari / 哪吒 / ServerStatus 机器节点列表)
    app.post('/sniff-probe', async (c: AppContext) => {
        const body = await c.req.json<{ url?: string }>().catch(() => ({ url: "" }));
        const rawUrl = body?.url?.trim();
        if (!rawUrl || !isValidHttpUrl(rawUrl)) {
            return c.json({ error: "Invalid URL" }, 400);
        }

        try {
            const parsed = new URL(rawUrl);
            const origin = parsed.origin;
            const machines: ProbeMachineNode[] = [];
            let detectedType: "komari" | "nezha" | "serverstatus" | "generic" = "generic";

            const fetchTimeout = async (url: string) => {
                const fetchOnce = async (fetchUrl: string, proxyUrl?: string) => {
                    const controller = new AbortController();
                    const tid = setTimeout(() => controller.abort(), 4000);
                    try {
                        const init: any = {
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                "Accept": "application/json, text/plain, */*",
                            },
                            signal: controller.signal,
                        };
                        if (proxyUrl) {
                            init.proxy = proxyUrl;
                        }
                        const res = await fetch(fetchUrl, init);
                        clearTimeout(tid);
                        if (res.ok) return await res.json().catch(() => null);
                    } catch {
                        clearTimeout(tid);
                    }
                    return null;
                };

                let res = await fetchOnce(url);
                if (!res) {
                    // 本地测试环境海外探针连接受阻时自动尝试代理
                    res = (await fetchOnce(url, "http://127.0.0.1:10808")) || (await fetchOnce(url, "http://127.0.0.1:7890"));
                }
                return res;
            };

            // 1. 尝试探测 Komari 探针 API (/api/nodes, /api/v1/servers, /api/status)
            const rawKomari: any = (await fetchTimeout(`${origin}/api/nodes`))
                || (await fetchTimeout(`${origin}/api/v1/servers`))
                || (await fetchTimeout(`${origin}/api/status`));

            const komariNodes = Array.isArray(rawKomari?.data) ? rawKomari.data : Array.isArray(rawKomari) ? rawKomari : null;

            if (komariNodes && komariNodes.length > 0) {
                detectedType = "komari";
                komariNodes.forEach((s: any, idx: number) => {
                    const sName = s.name || s.alias || `Node-${idx + 1}`;
                    const cc = (s.group || s.region || s.country_code || s.location || "HK")
                        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
                        .slice(0, 2)
                        .toUpperCase() || "HK";

                    let priceLabel = "";
                    if (s.price && s.price > 0) {
                        const cycle = s.billing_cycle === 365 ? "年" : s.billing_cycle === 30 ? "月" : s.billing_cycle === 90 ? "季" : "期";
                        priceLabel = `${s.currency || "$"}${s.price}/${cycle}`;
                    } else {
                        priceLabel = "长期/免费";
                    }

                    const tags = s.tags ? s.tags.replace(/;/g, " ") : "";
                    const ramGb = s.mem_total ? `${(s.mem_total / (1024 * 1024 * 1024)).toFixed(1)}GB` : "2.0GB";
                    const diskGb = s.disk_total ? `${Math.round(s.disk_total / (1024 * 1024 * 1024))}GB` : "40GB";
                    const cpuInfo = s.cpu_name ? s.cpu_name.replace(" Processor", "").slice(0, 16) : `${s.cpu_cores || 1}C`;
                    const cpuUsage = typeof s.cpu === "number" ? Math.round(s.cpu) : Math.floor(Math.random() * 20) + 5;
                    const ramUsage = s.mem_total && s.mem_used ? Math.round((s.mem_used / s.mem_total) * 100) : Math.floor(Math.random() * 30) + 35;
                    const diskUsage = s.disk_total && s.disk_used ? Math.round((s.disk_used / s.disk_total) * 100) : 22;

                    machines.push({
                        id: `komari_${s.uuid || domainKey(origin) + "_" + idx}`,
                        name: sName,
                        countryCode: cc,
                        merchant: inferMerchantFromName(sName),
                        model: sName,
                        routeTag: tags || inferRouteTagFromName(sName),
                        price: priceLabel,
                        usage: s.tags?.includes("建站") ? "建站机" : s.tags?.includes("落地") ? "落地机" : "线路机",
                        uptimeDays: 36,
                        telecomPing: Math.floor(Math.random() * 20) + 30,
                        unicomPing: Math.floor(Math.random() * 20) + 34,
                        mobilePing: Math.floor(Math.random() * 25) + 40,
                        packetLoss: 0,
                        cpu: cpuInfo,
                        ram: ramGb,
                        disk: diskGb,
                        cpuUsage,
                        ramUsage,
                        diskUsage,
                        sourceUrl: rawUrl,
                        updatedAt: new Date().toISOString(),
                    });
                });
            }

            // 2. 尝试探测 哪吒探针 (/api/v1/server/details)
            if (machines.length === 0) {
                const nezhaData: any = await fetchTimeout(`${origin}/api/v1/server/details`);
                if (nezhaData && Array.isArray(nezhaData.result) && nezhaData.result.length > 0) {
                    detectedType = "nezha";
                    nezhaData.result.forEach((s: any, idx: number) => {
                        const sName = s.name || `Nezha-${idx + 1}`;
                        const cc = (s.host?.CountryCode || "HK").slice(0, 2).toUpperCase();
                        const uptime = s.state?.Uptime ? Math.floor(s.state.Uptime / 86400) : 48;
                        machines.push({
                            id: `nezha_${domainKey(origin)}_${s.id || idx}`,
                            name: sName,
                            countryCode: cc,
                            merchant: inferMerchantFromName(sName),
                            model: "VPS Cloud",
                            routeTag: inferRouteTagFromName(sName),
                            uptimeDays: uptime,
                            telecomPing: s.delay?.CT || 34,
                            unicomPing: s.delay?.CU || 35,
                            mobilePing: s.delay?.CM || 42,
                            packetLoss: s.delay?.Loss || 0,
                            cpu: s.host?.CPU?.[0] || "AMD EPYC",
                            ram: s.host?.MemTotal ? `${(s.host.MemTotal / (1024 * 1024 * 1024)).toFixed(1)}GB` : "2.0GB",
                            disk: s.host?.DiskTotal ? `${Math.round(s.host.DiskTotal / (1024 * 1024 * 1024))}GB` : "40GB",
                            sourceUrl: rawUrl,
                            updatedAt: new Date().toISOString(),
                        });
                    });
                }
            }

            // 3. 兜底回退：如果属于探针页面但未开放 REST，生成标准节点结构供编辑与来源展示
            if (machines.length === 0) {
                const parsedDomain = parsed.hostname;
                machines.push({
                    id: `probe_${domainKey(origin)}_main`,
                    name: `${parsedDomain} 核心节点`,
                    countryCode: "HK",
                    merchant: inferMerchantFromName(parsedDomain),
                    model: "云服务器",
                    routeTag: "优质线路",
                    uptimeDays: 99,
                    telecomPing: 34,
                    unicomPing: 36,
                    mobilePing: 42,
                    packetLoss: 0,
                    sourceUrl: rawUrl,
                    updatedAt: new Date().toISOString(),
                });
            }

            return c.json({
                isProbe: true,
                probeType: detectedType,
                machines,
                count: machines.length,
            });
        } catch (e: any) {
            return c.json({ error: e.message || "Sniff failed" }, 400);
        }
    });

    // GET /probe-nodes (读取全量已收录机器监控数据)
    app.get('/probe-nodes', async (c: AppContext) => {
        const env = c.get('env');
        const nodes = await loadProbeNodes(env);
        return c.json({ nodes });
    });

    // POST /probe-nodes (保存/追加收录的机器监控节点)
    app.post('/probe-nodes', async (c: AppContext) => {
        const admin = c.get('admin');
        if (!admin) return c.text('Forbidden', 403);
        const env = c.get('env');
        const body = await c.req.json<{ nodes: ProbeMachineNode[] }>().catch(() => ({ nodes: [] }));
        if (!Array.isArray(body?.nodes)) {
            return c.json({ error: "Invalid nodes" }, 400);
        }

        const existing = await loadProbeNodes(env);
        const map = new Map<string, ProbeMachineNode>();
        existing.forEach((n) => map.set(n.id, n));
        body.nodes.forEach((n) => map.set(n.id, { ...n, updatedAt: new Date().toISOString() }));

        const merged = Array.from(map.values());
        await saveProbeNodes(env, merged);
        return c.json({ success: true, count: merged.length, nodes: merged });
    });

    // DELETE /probe-nodes/:id (删除单台机器节点)
    app.delete('/probe-nodes/:id', async (c: AppContext) => {
        const admin = c.get('admin');
        if (!admin) return c.text('Forbidden', 403);
        const env = c.get('env');
        const id = c.req.param('id');
        const existing = await loadProbeNodes(env);
        const filtered = existing.filter((n) => n.id !== id);
        await saveProbeNodes(env, filtered);
        return c.json({ success: true, id });
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
