import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function r2() {
  const account = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!account) throw new Error("R2_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID not set");
  return new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export const bucket = () => process.env.R2_BUCKET ?? "lektor";

export async function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 600 }
  );
}

export async function presignGet(key: string, expiresIn = 3600 * 24): Promise<string> {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn }
  );
}

/** Actual stored size in bytes, or null if the object doesn't exist. */
export async function objectSize(key: string): Promise<number | null> {
  try {
    const head = await r2().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key })
    );
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Public URL for objects when R2_PUBLIC_BASE (custom domain / r2.dev) is configured. */
export function publicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_BASE;
  if (!base) throw new Error("R2_PUBLIC_BASE not set");
  return `${base.replace(/\/$/, "")}/${key}`;
}
