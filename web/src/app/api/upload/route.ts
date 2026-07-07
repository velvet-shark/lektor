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
  const { contentType, size, durationS } = await req.json();
  const ext = TYPES[contentType];
  if (!ext) return NextResponse.json({ error: "unsupported type" }, { status: 400 });
  if (typeof size !== "number" || size > MAX_BYTES)
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  if (typeof durationS !== "number" || durationS > MAX_SECONDS)
    return NextResponse.json({ error: "clip too long" }, { status: 400 });

  const key = `uploads/${randomUUID()}.${ext}`;
  const putUrl = await presignPut(key, contentType);
  return NextResponse.json({ putUrl, key });
}
