import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { presignGet, objectSize, deleteObject } from "@/lib/storage";
import { requestFingerprint } from "@/lib/rate-limit";

const UPLOAD_KEY = /^uploads\/[0-9a-f-]{36}\.(mp4|mov|webm)$/;
const MAX_SECONDS = 90;
const MAX_BYTES = 150 * 1024 * 1024;
const configuredLimit = Number(process.env.MAX_JOBS_PER_HOUR ?? 5);
const MAX_JOBS_PER_HOUR =
  Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 5;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const { key, durationS } = body as Record<string, unknown>;
  if (typeof key !== "string" || !UPLOAD_KEY.test(key))
    return NextResponse.json({ error: "bad key" }, { status: 400 });
  if (
    typeof durationS !== "number" ||
    !Number.isFinite(durationS) ||
    durationS <= 0 ||
    durationS > MAX_SECONDS
  )
    return NextResponse.json({ error: "bad duration" }, { status: 400 });

  const db = sql();
  // A retry or double-click must not create a second paid render for one upload.
  const existing = await db`
    select id, status, created_at from jobs
    where meta->>'input_key' = ${key}
    order by created_at desc
    limit 1`;
  if (existing.length > 0) {
    const id = existing[0].id as string;
    const position =
      existing[0].status === "queued"
        ? Number(
            (
              await db`
                select count(*)::int as n from jobs
                where status = 'queued'
                  and created_at <= ${existing[0].created_at}`
            )[0].n
          )
        : 1;
    return NextResponse.json({ id, position, reused: true });
  }

  // presigned PUTs can't cap actual bytes — verify what really landed in the
  // bucket, and evict oversized objects immediately.
  const storedBytes = await objectSize(key);
  if (storedBytes === null)
    return NextResponse.json({ error: "upload not found" }, { status: 400 });
  if (storedBytes > MAX_BYTES) {
    await deleteObject(key).catch(() => {});
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }

  const clientId = requestFingerprint(req.headers);
  if (clientId) {
    const recent = await db`
      select count(*)::int as n from jobs
      where meta->>'client_id' = ${clientId}
        and created_at > now() - interval '1 hour'`;
    if (Number(recent[0].n) >= MAX_JOBS_PER_HOUR)
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // worker downloads via a signed URL; key kept in meta for cleanup
  const inputUrl = await presignGet(key, 3600 * 25);
  const rows = await db`
    insert into jobs (input_url, meta)
    values (${inputUrl}, ${JSON.stringify({
      input_key: key,
      duration_s: durationS,
      ...(clientId ? { client_id: clientId } : {}),
    })})
    returning id`;
  const id = rows[0].id as string;

  const pos = await db`
    select count(*)::int as n from jobs
    where status = 'queued' and created_at <= (select created_at from jobs where id = ${id})`;

  return NextResponse.json({ id, position: pos[0].n });
}
