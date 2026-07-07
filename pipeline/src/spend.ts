import { appendFileSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Every ElevenLabs call gets logged here — acceptance criterion + hard rule.
 * Ceiling ~$40; estimateTotal() lets callers flag when trending past it.
 */
const SPEND_FILE = process.env.SPEND_FILE ?? resolve(process.cwd(), "../SPEND.md");
const HEADER = `# ElevenLabs spend log\n\nCeiling: ~$40 PAYG. Every API call below.\n\n| when (UTC) | api | detail | units | est. cost |\n|---|---|---|---|---|\n`;

export function logSpend(api: string, detail: string, units: string, estCostUsd: number): void {
  if (!existsSync(SPEND_FILE)) writeFileSync(SPEND_FILE, HEADER);
  const row = `| ${new Date().toISOString()} | ${api} | ${detail} | ${units} | $${estCostUsd.toFixed(4)} |\n`;
  appendFileSync(SPEND_FILE, row);
}

export function estimateTotal(): number {
  if (!existsSync(SPEND_FILE)) return 0;
  const text = readFileSync(SPEND_FILE, "utf8");
  let total = 0;
  for (const m of text.matchAll(/\| \$([0-9.]+) \|/g)) total += parseFloat(m[1]);
  return total;
}
