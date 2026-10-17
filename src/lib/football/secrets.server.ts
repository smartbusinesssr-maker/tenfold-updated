const BAKED_KEY = "acb868a0330022db53540db7c15d8e31";

export const API_FOOTBALL_BASE =
  process.env.API_FOOTBALL_BASE?.trim() || "https://v3.football.api-sports.io";

export function resolveApiKey(sessionKey?: string | null): string | undefined {
  const env = (process.env.API_FOOTBALL_KEY || process.env.APISPORTS_KEY || "").trim();
  if (env.length > 8) return env;
  if (BAKED_KEY.length > 8) return BAKED_KEY;
  const session = sessionKey?.trim();
  if (session && session.length > 8) return session;
  return undefined;
}
