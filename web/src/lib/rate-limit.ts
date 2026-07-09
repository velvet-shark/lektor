import { createHash } from "node:crypto";

export function clientFingerprint(
  forwardedFor: string | null,
  salt: string
): string | null {
  const ip = forwardedFor?.split(",")[0]?.trim();
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function requestFingerprint(headers: Headers): string | null {
  const salt =
    process.env.RATE_LIMIT_SALT ??
    process.env.R2_SECRET_ACCESS_KEY ??
    process.env.LEKTOR_VOICE_ID ??
    "the-lektor";
  return clientFingerprint(
    headers.get("x-forwarded-for") ?? headers.get("x-real-ip"),
    salt
  );
}
