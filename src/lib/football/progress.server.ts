import type { ScanProgress } from "./types";

const store = new Map<string, ScanProgress>();

export function beginProgress(scanId: string, step = "Pulling API-Football lines…"): void {
  store.set(scanId, { scanId, percent: 2, step, running: true, error: null });
}

export function setProgress(scanId: string, percent: number, step: string): void {
  const cur = store.get(scanId);
  store.set(scanId, {
    scanId,
    percent: Math.max(cur?.percent ?? 0, Math.min(99, percent)),
    step,
    running: true,
    error: null,
  });
}

export function failProgress(scanId: string, error: string): void {
  store.set(scanId, {
    scanId,
    percent: 100,
    step: "Scan failed",
    running: false,
    error,
  });
}

export function endProgress(scanId: string, step = "Board ranked"): void {
  store.set(scanId, { scanId, percent: 100, step, running: false, error: null });
}

export function getProgress(scanId: string): ScanProgress | null {
  return store.get(scanId) ?? null;
}
