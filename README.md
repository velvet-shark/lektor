# The Lektor

Drop in any video (≤90s) and get it back with one deadpan Polish voice reading
every line over the ducked original — the single-voice *szeptanka* dubbing
style every Pole grew up with, and the origin story of ElevenLabs itself.

**Tagline:** The voice that started a $22B company. / Głos, od którego wszystko się zaczęło.

## How it works

```
video ─▶ scribe_v2 (word timestamps + diarization)
      ─▶ merge words → utterances (<600ms gaps, same speaker)
      ─▶ Claude translation, lektor register (CONDENSE 20–30%)
      ─▶ eleven_multilingual_v2 TTS per segment (previous_text/next_text continuity)
      ─▶ timing scheduler (the craft — see below)
      ─▶ ffmpeg mix: duck original to 30%, 180ms ramps, loudnorm, -c:v copy
```

### The timing algorithm

1. Lektor starts **600–900ms after** the original line — you hear the original first; that's the signature.
2. Too long for its window → **atempo up to 1.12×** → still too long → **overlap next line ≤800ms** (authentic) → still too long → back to the LLM: "shorten by 30%", re-synthesize, re-schedule.
3. Never before the original line; one voice, so lines queue behind each other.
4. Silence = full-volume original. Ducking exists only under actual lektor speech.

Deterministic and unit-tested (15 synthetic cases) before touching real audio:
`pipeline/src/scheduler.ts`. Every rendered clip logs its schedule (`schedule.log`).

## Repo layout

- `pipeline/` — shared core + local CLI: `pnpm cli -i in.mp4 -o out.mp4 -v <voiceId>`
- `web/` — Next.js 15 app (Vercel): gallery with Original/Lektor A-B toggle, upload flow, `/powiedz`, EN/PL
- `worker/` — Node + ffmpeg container: job queue (max 3 concurrent), R2 storage, 24h auto-delete cron
- `voice/` — Voice Design candidate generation + compare page (no real lektor cloned — hard rule)
- `db/schema.sql` — Neon Postgres schema

## Running locally

```bash
pnpm install
pnpm test                      # scheduler + mix + worker unit tests
cd web && pnpm dev             # gallery works with no env at all
pnpm --dir pipeline cli -i clip.mp4 -o out.mp4   # needs env below
```

Env (see `worker/.env.example`): `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`,
`DATABASE_URL`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE`, `LEKTOR_VOICE_ID`.

## Deploying

Production deployments are manual from a local checkout; pushing to GitHub
alone deploys nothing.

### Web (Vercel)

The `web/` directory is linked to the Vercel project `lektor` (team
`velvetsharks-projects`) via `web/.vercel/project.json`. The CLI uploads the
local files directly, so whatever is on disk is what ships:

```bash
cd web
pnpm typecheck && pnpm build      # catch errors before spending a deploy
npx vercel@latest deploy --prod   # upload, remote build, promote to prod
```

Serves https://thelektor.pl (proxied by Cloudflare; `/gallery/*` is edge-cached
with a 30-day TTL, so replacing a gallery video needs a cache purge in the
Cloudflare dashboard or a new file name). Environment variables live in Vercel,
not in the repo:

```bash
npx vercel@latest env ls production
printf 'VALUE' | npx vercel@latest env add NAME production   # add or change
```

After changing an env var, deploy again; values are baked at build time.

### Production upload prerequisite

Uploads go directly from the browser to R2, so the bucket must have a CORS
policy before the upload UI can work. Apply [`infra/r2-cors.json`](infra/r2-cors.json)
to the `lektor` bucket and keep every deployed web origin in `AllowedOrigins`.
The policy deliberately permits only `PUT` with a `Content-Type` header.

Before a launch, request a fresh `/api/upload` URL and preflight it from the
production origin. A successful preflight returns `204` and an
`Access-Control-Allow-Origin` header for that exact origin. A `403` response
containing `CORS not configured for this bucket` means uploads are broken even
if the rest of the site renders correctly.

## Hard rules

- **No real lektor's voice is ever cloned** (Knapik, Gudowski, Borowiec, anyone). Voice Design only.
- Public gallery: public-domain / CC / own content only.
- No YouTube-URL ingestion. Uploads + gallery only.
- The ElevenLabs Dubbing API is deliberately NOT used — per-speaker voice
  replacement is the opposite aesthetic; the single-voice overlay is the point.
- Uploads auto-delete after 24h.

Gallery sources: Charade (1963), His Girl Friday (1940), McLintock! (1963),
Superman (1941), The Fast and the Furious (1955), and Radek's own clip. The
five films are public domain; title-by-title rationale lives with the local
gallery source assets.

By Radek · velvetshark.com
