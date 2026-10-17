import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DeskResult } from "./types";

const DIR = join(process.cwd(), "data", "boards");
const VERSION = 1;

function fileFor(date: string, timezone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const tz = timezone.replace(/[^A-Za-z0-9_+-]+/g, "_").slice(0, 80);
  if (!tz) return null;
  return join(DIR, `${date}__${tz}.json`);
}

function hasPicks(result: DeskResult): boolean {
  return (result.fold?.length ?? 0) + (result.candidates?.length ?? 0) > 0;
}

export function readDayBoard(date: string, timezone: string): DeskResult | null {
  const file = fileFor(date, timezone);
  if (!file) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { version?: number; result?: DeskResult };
    if (parsed?.version !== VERSION || !parsed.result?.meta) return null;
    if (parsed.result.meta.date !== date || parsed.result.meta.timezone !== timezone) return null;
    if (!hasPicks(parsed.result)) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

/** Keeps a finished board so the same date does not spend API-Football calls again. */
export function writeDayBoard(result: DeskResult): void {
  const file = fileFor(result.meta?.date, result.meta?.timezone);
  if (!file || !hasPicks(result)) return;
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ version: VERSION, savedAt: new Date().toISOString(), result }));
  } catch {
    /* read-only runtimes skip persistence */
  }
}
