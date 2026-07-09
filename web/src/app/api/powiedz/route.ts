import { NextRequest, NextResponse } from "next/server";

/**
 * /powiedz — any text, read instantly by the lektor (eleven_flash_v2_5).
 * Kept deliberately cheap: flash model, 280-char cap, best-effort in-memory
 * rate limit per IP (resets on redeploy — fine for a toy).
 */
const MAX_CHARS = 280;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.LEKTOR_VOICE_ID;
  if (!apiKey || !voiceId)
    return NextResponse.json({ error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const { text } = body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim())
    return NextResponse.json({ error: "no text" }, { status: 400 });
  if (text.length > MAX_CHARS)
    return NextResponse.json({ error: "too long" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "?";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW)
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  hits.set(ip, [...recent, now]);

  let res: Response;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: { stability: 0.9, similarity_boost: 0.75, style: 0 },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );
  } catch {
    return NextResponse.json({ error: "tts unavailable" }, { status: 504 });
  }
  if (!res.ok)
    return NextResponse.json({ error: "tts failed" }, { status: 502 });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
