import { DEFAULT_TZ } from "./types";

export { DEFAULT_TZ };

export const TIMEZONES = [
  "Africa/Kampala",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Paris",
  "America/New_York",
  "UTC",
] as const;

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function todayYmd(tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function ymdToEspn(ymd: string): string {
  return ymd.replaceAll("-", "");
}

export function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatYmd(date: Date, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatKickoff(iso: string, tz = DEFAULT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function formatLongDate(ymd: string, tz = DEFAULT_TZ): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

export function ymdBounds(tz = DEFAULT_TZ): { min: Date; max: Date; today: Date } {
  const today = ymdToLocalDate(todayYmd(tz));
  const min = ymdToLocalDate(addDaysYmd(todayYmd(tz), -1));
  const max = ymdToLocalDate(addDaysYmd(todayYmd(tz), 14));
  return { min, max, today };
}
