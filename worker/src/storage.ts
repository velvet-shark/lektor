import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 via the S3-compatible API.
 * Endpoint is derived from CLOUDFLARE_ACCOUNT_ID; credentials from
 * R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY, bucket from R2_BUCKET.
 */

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

let client: S3Client | undefined;

export function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID ?? env("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

export function bucket(): string {
  return env("R2_BUCKET");
}

/**
 * URL for a stored object: R2_PUBLIC_BASE when configured, otherwise a
 * presigned GET valid 24h — which matches the upload auto-delete window.
 */
export async function publicUrl(key: string): Promise<string> {
  const base = process.env.R2_PUBLIC_BASE;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: 24 * 3600 }
  );
}

/** Download an object to a local file. */
export async function getObjectToFile(key: string, filePath: string): Promise<void> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`R2 object ${key} has no body`);
  await pipeline(res.Body as Readable, createWriteStream(filePath));
}

/** Upload a local file. */
export async function putObjectFromFile(
  key: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<void> {
  const body = await readFile(filePath);
  await r2().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType })
  );
}

/** Delete a single object. Missing keys are not an error in S3/R2 semantics. */
export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** List object keys under a prefix. */
export async function listObjects(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Presigned PUT URL — for the web app to upload directly to R2. */
export async function presignPut(
  key: string,
  contentType = "video/mp4",
  expiresInS = 900
): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: expiresInS }
  );
}
