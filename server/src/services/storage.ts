import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { getStorageObject, getStoragePublicUrl, putStorageObject } from "../utils/storage";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
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
            return c.text('File size exceeds 10MB limit', 413);
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
            const response = await profileAsync(c, "blob_fetch", () => getStorageObject(env, decodedKey));

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
