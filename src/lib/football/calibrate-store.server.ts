import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  mergeObservations,
  snapshotFromObservations,
  walkForwardOptimizePair,
  walkForwardValidate,
  type CalibrateHyper,
  type CalibrationObservation,
  type CalibrationSnapshot,
  type WalkForwardReport,
  type WfoPair,
} from "./calibrate.ts";

const FILE = join(process.cwd(), "data", "calibration.json");
const VERSION = 1;

interface StoreFile {
  version: number;
  updatedAt: string;
  observations: CalibrationObservation[];
}

let mem: CalibrationObservation[] | null = null;
let loaded = false;

function readDisk(): CalibrationObservation[] {
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (parsed?.version !== VERSION || !Array.isArray(parsed.observations)) return [];
    return parsed.observations.filter((o) => o && typeof o.date === "string" && o.p);
  } catch {
    return [];
  }
}

function writeDisk(obs: CalibrationObservation[]): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    const body: StoreFile = {
      version: VERSION,
      updatedAt: new Date().toISOString(),
      observations: obs,
    };
    writeFileSync(FILE, `${JSON.stringify(body)}\n`);
  } catch {
    /* Vercel and other read-only runtimes skip persistence */
  }
}

function ensure(): CalibrationObservation[] {
  if (!loaded) {
    mem = readDisk();
    loaded = true;
  }
  return mem ?? [];
}

export function loadObservations(): CalibrationObservation[] {
  return ensure();
}

export function snapshotCalibration(asOf: string, hyper?: CalibrateHyper): CalibrationSnapshot {
  return snapshotFromObservations(ensure(), asOf, hyper);
}

export function walkForwardFromStore(asOf: string): WalkForwardReport {
  return walkForwardValidate(ensure(), { asOf });
}

export function wfoFromStore(asOf: string): WfoPair {
  return walkForwardOptimizePair(ensure(), { asOf });
}

/** Snapshot + validation + Pardo WFO for one card date. This date is unused on itself. */
export function bundleCalibration(asOf: string): {
  applied: CalibrationSnapshot;
  walkForward: WalkForwardReport;
  wfo: WfoPair;
  corpus: CalibrationObservation[];
} {
  const corpus = ensure();
  const wfo = walkForwardOptimizePair(corpus, { asOf });
  const hyper = wfo.anchored.apply ? wfo.anchored.recommended : undefined;
  const applied = snapshotFromObservations(corpus, asOf, hyper);
  const walkForward = walkForwardValidate(corpus, { asOf, hyper: applied.hyper });
  return { applied, walkForward, wfo, corpus };
}

export function ingestObservations(incoming: CalibrationObservation[]): {
  nAfter: number;
  ingested: number;
} {
  if (!incoming.length) return { nAfter: ensure().length, ingested: 0 };
  const next = mergeObservations(ensure(), incoming);
  mem = next;
  loaded = true;
  writeDisk(next);
  return { nAfter: next.length, ingested: incoming.length };
}

/** Tests / scripts only — replaces the in-memory corpus. */
export function resetCalibrationStore(obs: CalibrationObservation[] = []): void {
  mem = obs;
  loaded = true;
}
