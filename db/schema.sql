-- The Lektor — Neon Postgres schema (PRD §4). No accounts, no auth.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued'
    check (status in ('queued','transcribing','translating','summoning','mixing','done','error')),
  input_url text not null,
  result_url text,
  error text,
  -- schedule log, spend, language, timings, watermark download url…
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists jobs_status_created_idx on jobs (status, created_at);

-- pre-rendered gallery entries
create table if not exists clips (
  id text primary key, -- slug, e.g. 'sintel'
  title_en text not null,
  title_pl text not null,
  blurb_en text not null default '',
  blurb_pl text not null default '',
  original_url text not null,
  lektor_url text not null,
  poster_url text,
  duration_s int not null,
  license text not null, -- 'CC-BY 3.0 Blender Foundation' | 'Public domain (NASA)' …
  sort int not null default 0
);

-- 24h auto-delete bookkeeping: uploads and results for jobs older than 24h
-- are removed from storage by the worker cron; rows get scrubbed URLs.
