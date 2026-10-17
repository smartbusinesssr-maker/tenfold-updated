import {
  BUCKET_CAPACITY,
  BUCKET_REFILL_PER_SEC,
  FETCH_TIMEOUT_MS,
  PAYLOAD_TTL_MS,
  STATUS_TTL_MS,
} from "./config.server";
import { API_FOOTBALL_BASE, resolveApiKey } from "./secrets.server";
import type { QuotaSnapshot } from "./types";

type CacheEntry = { at: number; ttl: number; body: unknown };

const payloadCache = new Map<string, CacheEntry>();
let quota: QuotaSnapshot = {
  dayRemaining: 75000,
  dayLimit: 75000,
  minuteRemaining: null,
  minuteLimit: null,
  usedThisScan: 0,
};
let generation = 0;
let tokens = BUCKET_CAPACITY;
let lastRefill = Date.now();
let cacheHits = 0;

export function currentGeneration(): number {
  return generation;
}

export function resetQueue(): void {
  generation += 1;
  tokens = BUCKET_CAPACITY;
  lastRefill = Date.now();
}

export function resetScanQuotaCounter(): void {
  quota = { ...quota, usedThisScan: 0 };
  cacheHits = 0;
}

export function getQuota(): QuotaSnapshot {
  return { ...quota };
}

export function getCacheHits(): number {
  return cacheHits;
}

function refill(): void {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  tokens = Math.min(BUCKET_CAPACITY, tokens + elapsed * BUCKET_REFILL_PER_SEC);
  lastRefill = now;
}

async function takeToken(gen: number): Promise<void> {
  for (;;) {
    if (gen !== generation) throw new Error("scan-reset");
    refill();
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    await sleep(40);
  }
}

function pastDeadline(deadline?: number): boolean {
  return deadline != null && Date.now() > deadline;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isScanBudget(err: unknown): boolean {
  return err instanceof Error && err.message === "scan-budget";
}

function cacheKey(path: string, query: Record<string, string | number | undefined>): string {
  const q = Object.entries(query)
    .filter(([, v]) => v != null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${path}?${q}`;
}

export function readPayloadCache<T>(key: string): T | undefined {
  const hit = payloadCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > hit.ttl) {
    payloadCache.delete(key);
    return undefined;
  }
  cacheHits += 1;
  return hit.body as T;
}

export function writePayloadCache(key: string, body: unknown, ttl: number): void {
  payloadCache.set(key, { at: Date.now(), ttl, body });
}

function ingestHeaders(headers: Headers): void {
  const minRem = headers.get("x-ratelimit-remaining");
  const minLim = headers.get("x-ratelimit-limit");
  const dayRem = headers.get("x-ratelimit-requests-remaining");
  const dayLim = headers.get("x-ratelimit-requests-limit");
  if (minRem) quota.minuteRemaining = Number(minRem);
  if (minLim) quota.minuteLimit = Number(minLim);
  if (dayRem) quota.dayRemaining = Number(dayRem);
  if (dayLim) quota.dayLimit = Number(dayLim);
}

type ApiEnvelope = {
  errors?: Record<string, string> | string[];
  results?: number;
  paging?: { current: number; total: number };
  response?: unknown;
};

export async function footballGet<T>(
  path: string,
  query: Record<string, string | number | undefined>,
  opts: {
    apiKey: string;
    ttl?: number;
    skipCache?: boolean;
    deadline?: number;
    gen?: number;
  },
): Promise<{ response: T; paging?: { current: number; total: number } }> {
  const gen = opts.gen ?? generation;
  const key = cacheKey(path, query);
  const ttl = opts.ttl ?? PAYLOAD_TTL_MS;
  if (!opts.skipCache) {
    const cached = readPayloadCache<{ response: T; paging?: { current: number; total: number } }>(key);
    if (cached) return cached;
  }

  if (pastDeadline(opts.deadline)) throw new Error("scan-budget");
  if (quota.dayRemaining < 8) throw new Error("Daily API-Football quota nearly exhausted.");
  if (quota.minuteRemaining != null && quota.minuteRemaining < 12) await sleep(2500);
  if (pastDeadline(opts.deadline)) throw new Error("scan-budget");

  await takeToken(gen);
  if (pastDeadline(opts.deadline)) throw new Error("scan-budget");

  const url = new URL(path.startsWith("http") ? path : `${API_FOOTBALL_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const remaining = opts.deadline ? Math.max(250, opts.deadline - Date.now()) : FETCH_TIMEOUT_MS;
  const timeout = Math.min(FETCH_TIMEOUT_MS, remaining);

  const run = async (): Promise<Response> => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    try {
      return await fetch(url.toString(), {
        headers: {
          "x-apisports-key": opts.apiKey,
          Accept: "application/json",
        },
        signal: ac.signal,
      });
    } finally {
      clearTimeout(t);
    }
  };

  let res: Response;
  try {
    res = await run();
  } catch (err) {
    if (isScanBudget(err) || pastDeadline(opts.deadline)) throw new Error("scan-budget");
    await sleep(240);
    if (pastDeadline(opts.deadline)) throw new Error("scan-budget");
    await takeToken(gen);
    res = await run();
  }

  if ((res.status === 429 || res.status >= 500) && !pastDeadline(opts.deadline)) {
    await sleep(res.status === 429 ? 1600 : 220);
    if (pastDeadline(opts.deadline)) throw new Error("scan-budget");
    await takeToken(gen);
    res = await run();
  }

  ingestHeaders(res.headers);
  quota.usedThisScan += 1;

  if (!res.ok) {
    throw new Error(`API-Football ${path} failed (${res.status})`);
  }

  const json = (await res.json()) as ApiEnvelope;
  if (json.errors) {
    if (Array.isArray(json.errors) && json.errors.length) throw new Error(String(json.errors[0]));
    if (!Array.isArray(json.errors)) {
      if (json.errors.token) throw new Error("API-Football key was rejected.");
      if (json.errors.plan) throw new Error("API-Football plan does not allow this endpoint.");
      const first = Object.values(json.errors)[0];
      if (first) throw new Error(String(first));
    }
  }

  const payload = {
    response: (json.response ?? []) as T,
    paging: json.paging,
  };
  writePayloadCache(key, payload, ttl);
  return payload;
}

export async function footballStatus(apiKey: string): Promise<void> {
  try {
    const { response } = await footballGet<
      | { requests?: { current?: number; limit_day?: number } }
      | Array<{ requests?: { current?: number; limit_day?: number } }>
    >("/status", {}, { apiKey, skipCache: true, ttl: STATUS_TTL_MS });
    const row = Array.isArray(response) ? response[0] : response;
    if (row?.requests?.limit_day) {
      quota.dayLimit = row.requests.limit_day;
      if (typeof row.requests.current === "number") {
        quota.dayRemaining = Math.max(0, row.requests.limit_day - row.requests.current);
      }
    }
  } catch {
    /* quota display only */
  }
}

export async function publicGet<T>(url: string, deadline?: number): Promise<T> {
  const key = `espn:${url}`;
  const cached = readPayloadCache<T>(key);
  if (cached) return cached;
  const remaining = deadline ? Math.max(250, deadline - Date.now()) : FETCH_TIMEOUT_MS;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), Math.min(FETCH_TIMEOUT_MS, remaining));
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "TenfoldDesk/1.0" },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`public ${res.status}`);
    const body = (await res.json()) as T;
    writePayloadCache(key, body, PAYLOAD_TTL_MS);
    return body;
  } finally {
    clearTimeout(t);
  }
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function pump() {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        out[idx] = await worker(items[idx]!, idx);
      } catch {
        out[idx] = undefined as R;
      }
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, pump));
  return out;
}

export function envOrSessionKey(session?: string | null): string | undefined {
  return resolveApiKey(session);
}
