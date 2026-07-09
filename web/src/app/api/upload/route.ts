import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { presignPut } from "@/lib/storage";

const TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const MAX_BYTES = 150 * 1024 * 1024;
const MAX_SECONDS = 90;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const { contentType, size, durationS } = body as Record<string, unknown>;
  if (typeof contentType !== "string")
    return NextResponse.json({ error: "unsupported type" }, { status: 400 });
  const ext = TYPES[contentType];
  if (!ext) return NextResponse.json({ error: "unsupported type" }, { status: 400 });
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0 || size > MAX_BYTES)
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  if (
    typeof durationS !== "number" ||
    !Number.isFinite(durationS) ||
    durationS <= 0 ||
    durationS > MAX_SECONDS
  )
    return NextResponse.json({ error: "clip too long" }, { status: 400 });

  const key = `uploads/${randomUUID()}.${ext}`;
  const putUrl = await presignPut(key, contentType);
  return NextResponse.json({ putUrl, key });
}
