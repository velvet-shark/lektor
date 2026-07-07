import { Pool } from "pg";

let pool: Pool | undefined;

/**
 * Tagged-template query helper (same call shape as neon()):
 *   const rows = await sql()`select * from jobs where id = ${id}`
 * Interpolations become $n parameters — never string-spliced.
 */
export function sql() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    pool = new Pool({ connectionString: url, max: 3 });
  }
  const p = pool;
  return async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]> => {
    const text = strings.reduce(
      (acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""),
      ""
    );
    const res = await p.query(text, values);
    return res.rows;
  };
}
