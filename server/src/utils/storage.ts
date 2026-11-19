import { path_join } from "./path";
import { buildS3ObjectUrl, createS3Client, putObject as putS3Object } from "./s3";

type StorageTarget =
  | {
      type: "r2";
      bucket: R2Bucket;
      folder: string;
      publicBaseUrl: string;
    }
  | {
      type: "s3";
      env: Env;
      folder: string;
      publicBaseUrl: string;
    };

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function resolveStorageTarget(env: Env): StorageTarget {
  const folder = env.S3_FOLDER || "";
  const publicBaseUrl = trimTrailingSlash(env.S3_ACCESS_HOST || env.S3_ENDPOINT || "");

  if (env.R2_BUCKET) {
    return {
      type: "r2",
      bucket: env.R2_BUCKET,
      folder,
      publicBaseUrl,
    };
  }

  if (!env.S3_ENDPOINT) {
    throw new Error("S3_ENDPOINT is not defined");
  }
  if (!env.S3_ACCESS_KEY_ID) {
    throw new Error("S3_ACCESS_KEY_ID is not defined");
  }
  if (!env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3_SECRET_ACCESS_KEY is not defined");
  }
  if (!env.S3_BUCKET) {
    throw new Error("S3_BUCKET is not defined");
  }

  return {
    type: "s3",
    env,
    folder,
    publicBaseUrl,
  };
}

function encodeStorageKey(key: string) {
  return key
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildBlobUrl(storageKey: string, baseUrl?: string) {
  const encodedKey = encodeStorageKey(storageKey);
  const path = `/api/blob/${encodedKey}`;

  if (!baseUrl) {
    return path;
  }

  return `${trimTrailingSlash(baseUrl)}${path}`;
}

function parseRange(rangeHeader: string | null | undefined, totalSize: number): { offset: number; length: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const parts = rangeHeader.replace("bytes=", "").split("-");
  const startStr = parts[0]?.trim();
  const endStr = parts[1]?.trim();

  let start = startStr ? parseInt(startStr, 10) : NaN;
  let end = endStr ? parseInt(endStr, 10) : NaN;

  if (isNaN(start) && isNaN(end)) return null;

  if (isNaN(start)) {
    const suffix = end;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else if (isNaN(end)) {
    end = totalSize - 1;
  }

  if (start > end || start >= totalSize || start < 0) return null;
  end = Math.min(end, totalSize - 1);
  return { offset: start, length: end - start + 1 };
}

function createStorageResponse(
  object: R2ObjectBody | R2Object,
  body?: BodyInit | null,
  range?: { offset: number; length: number } | null
) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  if (object.httpEtag) {
    headers.set("ETag", object.httpEtag);
  }

  if (!headers.has("Last-Modified")) {
    headers.set("Last-Modified", object.uploaded.toUTCString());
  }

  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  headers.set("Accept-Ranges", "bytes");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization");
  headers.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, ETag");
  headers.set("Access-Control-Allow-Private-Network", "true");
  headers.set("X-Content-Type-Options", "nosniff");

  if (range) {
    const end = range.offset + range.length - 1;
    headers.set("Content-Range", `bytes ${range.offset}-${end}/${object.size}`);
    headers.set("Content-Length", String(range.length));
    return new Response(body ?? null, {
      status: 206,
      headers,
    });
  }

  if (!headers.has("Content-Length")) {
    headers.set("Content-Length", String(object.size));
  }

  return new Response(body ?? null, {
    status: 200,
    headers,
  });
}

export async function getStorageObject(
  env: Env,
  storageKey: string,
  rangeHeader?: string | null
): Promise<Response | null> {
  if (env.R2_BUCKET) {
    if (rangeHeader) {
      const headObj = await env.R2_BUCKET.head(storageKey);
      if (!headObj) return null;

      const parsedRange = parseRange(rangeHeader, headObj.size);
      if (parsedRange) {
        const rangedObj = await env.R2_BUCKET.get(storageKey, {
          range: { offset: parsedRange.offset, length: parsedRange.length },
        });
        if (!rangedObj) return null;
        return createStorageResponse(rangedObj, rangedObj.body, parsedRange);
      }
    }

    const object = await env.R2_BUCKET.get(storageKey);
    if (!object) {
      return null;
    }
    return createStorageResponse(object, object.body);
  }

  const client = createS3Client(env);
  const s3Headers: Record<string, string> = {};
  if (rangeHeader) {
    s3Headers["Range"] = rangeHeader;
  }
  const response = await client.fetch(buildS3ObjectUrl(env, storageKey), {
    method: "GET",
    headers: s3Headers,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to fetch storage object: ${response.status} ${response.statusText}`);
  }

  return response;
}

export async function headStorageObject(env: Env, storageKey: string): Promise<Response | null> {
  if (env.R2_BUCKET) {
    const object = await env.R2_BUCKET.head(storageKey);
    if (!object) {
      return null;
    }
    return createStorageResponse(object);
  }

  const client = createS3Client(env);
  const response = await client.fetch(buildS3ObjectUrl(env, storageKey), {
    method: "HEAD",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to inspect storage object: ${response.status} ${response.statusText}`);
  }

  return response;
}

export function getStoragePublicUrl(env: Env, storageKey: string, baseUrl?: string) {
  if (env.S3_ACCESS_HOST) {
    return `${trimTrailingSlash(env.S3_ACCESS_HOST)}/${storageKey}`;
  }

  return buildBlobUrl(storageKey, baseUrl);
}

export async function putStorageObject(
  env: Env,
  key: string,
  body: Blob | ArrayBuffer | Uint8Array | string,
  contentType?: string,
  baseUrl?: string,
) {
  const target = resolveStorageTarget(env);
  const storageKey = path_join(target.folder, key);

  return putStorageObjectAtKey(env, storageKey, body, contentType, baseUrl);
}

export async function putStorageObjectAtKey(
  env: Env,
  storageKey: string,
  body: Blob | ArrayBuffer | Uint8Array | string,
  contentType?: string,
  baseUrl?: string,
) {
  if (env.R2_BUCKET) {
    await env.R2_BUCKET.put(storageKey, body, {
      httpMetadata: contentType ? { contentType } : undefined,
    });
  } else {
    const client = createS3Client(env);
    await putS3Object(client, env, storageKey, body, contentType);
  }

  return {
    key: storageKey,
    url: getStoragePublicUrl(env, storageKey, baseUrl),
  };
}
