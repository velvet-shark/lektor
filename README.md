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
      ─▶ eleven_v3 TTS per segment (previous_text/next_text continuity)
      ─▶ timing scheduler (the craft — see below)
      ─▶ ffmpeg mix: duck original to 30%, 180ms ramps, loudnorm, -c:v copy
```

### The timing algorithm (PRD §3.4)

1. Lektor starts **600–900ms after** the original line — you hear the original first; that's the signature.
2. Too long for its window → **atempo up to 1.12×** → still too long → **overlap next line ≤800ms** (authentic) → still too long → back to the LLM: "shorten by 30%", re-synthesize, re-schedule.
3. Never before the original line; one voice, so lines queue behind each other.
4. Silence = full-volume original. Ducking exists only under actual lektor speech.

Deterministic and unit-tested (15 synthetic cases) before touching real audio:
`pipeline/src/scheduler.ts`. Every rendered clip logs its schedule (`schedule.log`).

## Repo layout

- `pipeline/` — shared core + local CLI: `pnpm cli -i in.mp4 -o out.mp4 -v <voiceId>`
- `web/` — Next.js 15 app (Vercel): gallery with Original/Lektor A-B toggle, upload flow, `/powiedz`, EN/PL
- `worker/` — Node + ffmpeg container (Fly.io): job queue (max 3 concurrent), R2 storage, 24h auto-delete cron
- `voice/` — Voice Design candidate generation + compare page (no real lektor cloned — hard rule)
- `launch/` — prepared launch assets (posting is manual, always)
- `db/schema.sql` — Neon Postgres schema
- `BUILD_LOG.md` — decisions + verified API params; `SPEND.md` — every ElevenLabs call

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

## Hard rules

- **No real lektor's voice is ever cloned** (Knapik, Gudowski, Borowiec, anyone). Voice Design only.
- Public gallery: public-domain / CC / own content only.
- No YouTube-URL ingestion. Uploads + gallery only.
- The ElevenLabs Dubbing API is deliberately NOT used — per-speaker voice
  replacement is the opposite aesthetic; the single-voice overlay is the point.
- Uploads auto-delete after 24h.

Gallery sources: Sintel (CC-BY 3.0), Elephants Dream (CC-BY 2.5), Apollo 11
launch (PD, NASA), Universal Newsreel 1958 (PD). Details in `gallery/sources/SOURCES.md`.

Part of **July of Voice** · by Radek · velvetshark.com
