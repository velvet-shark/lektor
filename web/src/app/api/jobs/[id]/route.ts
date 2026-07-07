import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return NextResponse.json({ error: "bad id" }, { status: 400 });

  const db = sql();
  const rows = await db`
    select id, status, input_url, result_url, error, meta, created_at from jobs
    where id = ${id}`;
  if (rows.length === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const j = rows[0];

  let position: number | null = null;
  if (j.status === "queued") {
    const pos = await db`
      select count(*)::int as n from jobs
      where status = 'queued' and created_at <= ${j.created_at}`;
    position = Number(pos[0].n);
  }

  return NextResponse.json({
    id: j.id,
    status: j.status,
    input_url: j.input_url,
    result_url: j.result_url,
    download_url: (j.meta as Record<string, unknown>)?.download_url ?? null,
    error: j.error,
    position,
  });
}
