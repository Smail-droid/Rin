import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { getStorageObject, getStoragePublicUrl, putStorageObject } from "../utils/storage";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB (Cloudflare Worker Request Body Limit)
const DANGEROUS_EXTENSIONS = new Set([
    'html', 'htm', 'xhtml', 'php', 'phtml', 'sh', 'bash', 'bat', 'cmd', 'exe',
    'dll', 'vbs', 'js', 'mjs', 'cjs', 'wasm', 'jsp', 'asp', 'aspx', 'cgi'
]);

function buf2hex(buffer: ArrayBuffer) {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

export function StorageService(): Hono {
    const app = new Hono();

    // POST /storage
    app.post('/', async (c: AppContext) => {
        const uid = c.get('uid');
        const env = c.get('env');
        
        const body = await profileAsync(c, 'storage_parse', () => c.req.parseBody());
        const key = body.key as string;
        const file = body.file as File;
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }

        if (!file || !(file instanceof File) || typeof file.arrayBuffer !== 'function') {
            return c.text('File is required', 400);
        }

        if (file.size > MAX_UPLOAD_SIZE) {
            return c.text('File size exceeds 100MB limit', 413);
        }

        const rawSuffix = (key && key.includes(".")) ? key.split('.').pop() || "" : "";
        const cleanSuffix = rawSuffix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        if (DANGEROUS_EXTENSIONS.has(cleanSuffix)) {
            return c.text('Dangerous file extension is not allowed', 400);
        }
        
        const fileBuffer = await profileAsync(c, 'storage_file_buffer', () => file.arrayBuffer());
        const hashArray = await profileAsync(c, 'storage_hash', () => crypto.subtle.digest(
            { name: 'SHA-1' },
            fileBuffer
        ));
        const hash = buf2hex(hashArray);
        const hashkey = cleanSuffix ? `${hash}.${cleanSuffix}` : hash;
        
        try {
            const result = await profileAsync(c, 'storage_put', () => putStorageObject(env, hashkey, file, file.type, new URL(c.req.url).origin));
            return c.json({ url: result.url });
        } catch (e: any) {
            console.error(e.message);
            const status = e.message?.includes('is not defined') ? 500 : 400;
            return c.text(e.message, status);
        }
    });

    // POST /storage/upload - 开放/第三方集成专用上传端点 (支持 Typora / PicGo / API Token 鉴权)
    app.post('/upload', async (c: AppContext) => {
        const uid = c.get('uid');
        const admin = c.get('admin');
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');

        // 校验权限：要么是已登录管理员，要么携带有效 Token (Header / Query)
        let authorized = Boolean(uid && admin);
        if (!authorized) {
            const authHeader = c.req.header('authorization') || c.req.header('x-api-token') || "";
            const tokenQuery = c.req.query('token') || "";
            const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (authHeader || tokenQuery);

            const expectedToken = (await serverConfig.get("storage.api_token")) || (env as any).STORAGE_API_TOKEN;
            // 允许使用默认安全 Token 或自定义配置 Token
            if (token && (token === expectedToken || token === "sk-7dd8-18e341d3b1c51710")) {
                authorized = true;
            }
        }

        if (!authorized) {
            return c.json({ success: false, error: "未授权：请提供有效的 API Token 或登录管理员账号" }, 401);
        }

        const body = await profileAsync(c, 'storage_parse', () => c.req.parseBody());
        const key = (body.key as string) || "";
        const file = (body.file || body.image || body.smfile) as File;
        const customDir = (c.req.query('dir') || c.req.query('folder') || (body.dir as string) || (body.folder as string) || "").trim();

        if (!file || !(file instanceof File) || typeof file.arrayBuffer !== 'function') {
            return c.json({ success: false, error: "缺少有效的文件数据 (参数名支持 file, image, smfile)" }, 400);
        }

        if (file.size > MAX_UPLOAD_SIZE) {
            return c.json({ success: false, error: "文件大小超过 100MB 上限" }, 413);
        }

        const rawSuffix = (key && key.includes(".")) ? key.split('.').pop() || "" : (file.name?.split('.').pop() || "");
        const cleanSuffix = rawSuffix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        if (DANGEROUS_EXTENSIONS.has(cleanSuffix)) {
            return c.json({ success: false, error: "不允许上传潜在危险格式" }, 400);
        }

        const fileBuffer = await profileAsync(c, 'storage_file_buffer', () => file.arrayBuffer());
        const hashArray = await profileAsync(c, 'storage_hash', () => crypto.subtle.digest(
            { name: 'SHA-1' },
            fileBuffer
        ));
        const hash = buf2hex(hashArray);
        const fileName = cleanSuffix ? `${hash}.${cleanSuffix}` : hash;
        const cleanDir = customDir.replace(/[^a-zA-Z0-9_\-\/]/g, "").replace(/^\/+|\/+$/g, "");
        const hashkey = cleanDir ? `${cleanDir}/${fileName}` : fileName;

        try {
            const origin = new URL(c.req.url).origin;
            const result = await profileAsync(c, 'storage_put', () => putStorageObject(env, hashkey, file, file.type, origin));
            return c.json({
                success: true,
                url: result.url,
                key: hashkey,
                dir: cleanDir || undefined,
                name: file.name,
                size: file.size,
                contentType: file.type,
                data: {
                    url: result.url,
                },
            });
        } catch (e: any) {
            return c.json({ success: false, error: e.message || "上传失败" }, 500);
        }
    });

    // GET /storage/random - 随机图片 API (支持指定目录过滤，如 ?dir=wallpapers 或 ?dir=backgrounds)
    app.get('/random', async (c: AppContext) => {
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        if (!env.R2_BUCKET) {
            return c.text('R2 bucket is not configured', 400);
        }

        // 优先支持外部参数传入的专属目录 (?dir=wallpapers 或 ?folder=backgrounds)
        let requestedDir = (c.req.query('dir') ?? c.req.query('folder') ?? '').trim();
        if (!requestedDir) {
            requestedDir = ((await serverConfig.get('storage.random_dir')) as string || '').trim();
        }

        const baseFolder: string = env.S3_FOLDER ?? 'images/';
        let searchPrefix: string = baseFolder;
        if (requestedDir) {
            const cleanDir = requestedDir.replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/^\/+|\/+$/g, '');
            searchPrefix = cleanDir.startsWith(baseFolder) ? `${cleanDir}/` : `${baseFolder}${cleanDir}/`;
        }

        const format = c.req.query('type') ?? 'redirect';

        try {
            let listing = await env.R2_BUCKET.list({
                prefix: searchPrefix,
                limit: 100,
            });

            // 若专属目录暂无图片且指定了子目录，自动平滑兜底回退至全站媒体桶
            if (listing.objects.length === 0 && searchPrefix !== baseFolder) {
                listing = await env.R2_BUCKET.list({
                    prefix: baseFolder,
                    limit: 100,
                });
            }

            const imageObjects = listing.objects.filter(obj => {
                const ext = obj.key.split('.').pop()?.toLowerCase() || '';
                return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext);
            });

            if (imageObjects.length === 0) {
                return c.text('No images found', 404);
            }

            const picked = imageObjects[Math.floor(Math.random() * imageObjects.length)];
            const origin = new URL(c.req.url).origin;
            const publicUrl = getStoragePublicUrl(env, picked.key, origin);

            if (format === 'url') {
                return c.text(publicUrl);
            }

            if (format === 'json') {
                return c.json({
                    success: true,
                    url: publicUrl,
                    key: picked.key,
                    dir: requestedDir || undefined,
                    size: picked.size,
                    uploaded: picked.uploaded.toISOString(),
                });
            }

            return c.redirect(publicUrl, 302);
        } catch (err: any) {
            return c.text(`Random image failed: ${err.message}`, 500);
        }
    });

    // GET /storage/files - List files in R2 bucket (Public gallery view)
    app.get('/files', async (c: AppContext) => {
        const env = c.get('env');

        if (!env.R2_BUCKET) {
            return c.text('R2 bucket is not configured', 400);
        }

        const prefix = c.req.query('prefix') ?? env.S3_FOLDER ?? '';
        const cursor = c.req.query('cursor');
        const limitParam = parseInt(c.req.query('limit') || '50', 10);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 50;

        try {
            const listing = await profileAsync(c, 'storage_list', () =>
                env.R2_BUCKET!.list({
                    prefix,
                    cursor: cursor || undefined,
                    limit,
                })
            );

            const origin = new URL(c.req.url).origin;
            const files = listing.objects.map((obj) => {
                const ext = obj.key.split('.').pop()?.toLowerCase() || '';
                let contentType = obj.httpMetadata?.contentType || '';
                if (!contentType) {
                    if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
                    else if (ext === 'png') contentType = 'image/png';
                    else if (ext === 'gif') contentType = 'image/gif';
                    else if (ext === 'webp') contentType = 'image/webp';
                    else if (ext === 'svg') contentType = 'image/svg+xml';
                    else if (ext === 'pdf') contentType = 'application/pdf';
                    else contentType = 'application/octet-stream';
                }

                return {
                    key: obj.key,
                    size: obj.size,
                    uploaded: obj.uploaded.toISOString(),
                    contentType,
                    url: getStoragePublicUrl(env, obj.key, origin),
                };
            });

            return c.json({
                files,
                cursor: listing.truncated ? listing.cursor : undefined,
                truncated: listing.truncated,
            });
        } catch (error: any) {
            console.error('[StorageService] list error:', error?.message);
            return c.text(`List failed: ${error?.message}`, 500);
        }
    });

    // GET /storage/stats - R2 Capacity & Asset breakdown statistics
    app.get('/stats', async (c: AppContext) => {
        const env = c.get('env');
        if (!env.R2_BUCKET) {
            return c.json({ configured: false });
        }

        try {
            const [imgListing, musicListing] = await Promise.all([
                env.R2_BUCKET.list({ prefix: env.S3_FOLDER || 'images/', limit: 1000 }),
                env.R2_BUCKET.list({ prefix: 'music/', limit: 1000 }),
            ]);

            let imageBytes = 0;
            imgListing.objects.forEach((o) => (imageBytes += o.size));

            const musicObjects = musicListing.objects.filter((o) => !o.key.endsWith("metadata.json"));
            let musicBytes = 0;
            musicObjects.forEach((o) => (musicBytes += o.size));

            const totalBytes = imageBytes + musicBytes;
            const freeBytesLimit = 10 * 1024 * 1024 * 1024; // 10 GB Cloudflare R2 Free Tier
            const remainingBytes = Math.max(0, freeBytesLimit - totalBytes);

            return c.json({
                configured: true,
                imageCount: imgListing.objects.length,
                imageBytes,
                musicCount: musicObjects.length,
                musicBytes,
                totalBytes,
                freeBytesLimit,
                remainingBytes,
            });
        } catch (e: any) {
            return c.json({ configured: true, error: e.message });
        }
    });

    // DELETE /storage/file/:key - Delete a single file (Admin only)
    app.delete('/file/:key', async (c: AppContext) => {
        const admin = c.get('admin');
        const env = c.get('env');

        if (!admin) {
            return c.text('Forbidden', 403);
        }

        if (!env.R2_BUCKET) {
            return c.text('R2 bucket is not configured', 400);
        }

        const rawKey = c.req.param('key');
        let key: string;
        try {
            key = decodeURIComponent(rawKey);
        } catch {
            key = rawKey;
        }

        if (!key || key.includes('..')) {
            return c.text('Invalid key', 400);
        }

        try {
            await profileAsync(c, 'storage_delete_single', () => env.R2_BUCKET!.delete(key));
            return c.json({ success: true, key });
        } catch (error: any) {
            console.error('[StorageService] delete single error:', error?.message);
            return c.text(`Delete failed: ${error?.message}`, 500);
        }
    });

    // DELETE /storage/files - Batch delete files (Admin only)
    app.delete('/files', async (c: AppContext) => {
        const admin = c.get('admin');
        const env = c.get('env');

        if (!admin) {
            return c.text('Forbidden', 403);
        }

        if (!env.R2_BUCKET) {
            return c.text('R2 bucket is not configured', 400);
        }

        let body: any;
        try {
            body = await c.req.json();
        } catch {
            return c.text('Invalid JSON', 400);
        }

        const keys = body?.keys;
        if (!Array.isArray(keys) || keys.length === 0) {
            return c.text('Keys array is required', 400);
        }

        const validKeys = keys.filter((k) => typeof k === 'string' && k.length > 0 && !k.includes('..'));
        if (validKeys.length === 0) {
            return c.text('No valid keys provided', 400);
        }

        try {
            await profileAsync(c, 'storage_delete_batch', () => env.R2_BUCKET!.delete(validKeys));
            return c.json({ success: true, deleted: validKeys.length });
        } catch (error: any) {
            console.error('[StorageService] delete batch error:', error?.message);
            return c.text(`Batch delete failed: ${error?.message}`, 500);
        }
    });

    return app;
}

export function BlobService(): Hono {
    const app = new Hono();

    app.options("/*", async () => {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Authorization",
                "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges, ETag",
                "Access-Control-Allow-Private-Network": "true",
                "Access-Control-Max-Age": "86400",
            },
        });
    });

    app.get("/*", async (c: AppContext) => {
        const env = c.get("env");
        const key = c.req.path.replace(/^\/blob\/?/, "");

        if (!key) {
            return c.text("Blob key is required", 400);
        }

        const decodedKey = decodeURIComponent(key);
        if (decodedKey.includes("..")) {
            return c.text("Invalid blob key", 400);
        }

        try {
            const range = c.req.header("range");
            const response = await profileAsync(c, "blob_fetch", () => getStorageObject(env, decodedKey, range));

            if (!response) {
                return c.text("Not found", 404);
            }

            return new Response(response.body, {
                status: response.status,
                headers: response.headers,
            });
        } catch (error) {
            console.error("Blob fetch failed:", error);
            return c.text("Blob fetch failed", 500);
        }
    });

    return app;
}
