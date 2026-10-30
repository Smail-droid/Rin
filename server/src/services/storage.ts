import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { getStorageObject, putStorageObject } from "../utils/storage";

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
