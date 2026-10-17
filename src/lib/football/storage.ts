import { DEFAULT_TZ } from "./types";

const TZ = "tenfold:tz";
const DATE = "tenfold:date";
const KEY = "tenfold:apiKey";
const BANKROLL = "tenfold:bankroll";
const KELLY_FRAC = "tenfold:kellyFraction";

function canUse(): boolean {
  return typeof window !== "undefined";
}

export function loadTz(): string {
  if (!canUse()) return DEFAULT_TZ;
  return localStorage.getItem(TZ) || DEFAULT_TZ;
}

export function saveTz(tz: string): void {
  if (!canUse()) return;
  localStorage.setItem(TZ, tz);
}

export function loadDate(): string | null {
  if (!canUse()) return null;
  return localStorage.getItem(DATE);
}

export function saveDate(ymd: string): void {
  if (!canUse()) return;
  localStorage.setItem(DATE, ymd);
}

export function loadSessionKey(): string {
  if (!canUse()) return "";
  return sessionStorage.getItem(KEY) ?? "";
}

export function saveSessionKey(key: string): void {
  if (!canUse()) return;
  if (!key) sessionStorage.removeItem(KEY);
  else sessionStorage.setItem(KEY, key);
}

export function loadBankroll(fallback = 100): number {
  if (!canUse()) return fallback;
  const raw = localStorage.getItem(BANKROLL);
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function saveBankroll(n: number): void {
  if (!canUse()) return;
  if (!(n > 0)) localStorage.removeItem(BANKROLL);
  else localStorage.setItem(BANKROLL, String(n));
}

export function loadKellyFraction(fallback = 0.25): number {
  if (!canUse()) return fallback;
  const raw = localStorage.getItem(KELLY_FRAC);
  const n = raw != null ? Number(raw) : NaN;
  return n === 0.125 || n === 0.25 || n === 0.5 || n === 1 ? n : fallback;
}

export function saveKellyFraction(n: number): void {
  if (!canUse()) return;
  localStorage.setItem(KELLY_FRAC, String(n));
}
