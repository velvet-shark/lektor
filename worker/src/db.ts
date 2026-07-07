import pg from "pg";

export interface JobRow {
  id: string;
  input_url: string;
  meta: Record<string, unknown>;
}

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    pool = new pg.Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
