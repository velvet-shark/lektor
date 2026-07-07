import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { presignGet } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const { key, durationS } = await req.json();
  if (typeof key !== "string" || !key.startsWith("uploads/"))
    return NextResponse.json({ error: "bad key" }, { status: 400 });

  const db = sql();
  // worker downloads via a signed URL; key kept in meta for cleanup
  const inputUrl = await presignGet(key, 3600 * 25);
  const rows = await db`
    insert into jobs (input_url, meta)
    values (${inputUrl}, ${JSON.stringify({ input_key: key, duration_s: durationS })})
    returning id`;
  const id = rows[0].id as string;

  const pos = await db`
    select count(*)::int as n from jobs
    where status = 'queued' and created_at <= (select created_at from jobs where id = ${id})`;

  return NextResponse.json({ id, position: pos[0].n });
}
