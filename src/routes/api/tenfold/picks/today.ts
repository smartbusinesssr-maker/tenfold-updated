import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tenfold/picks/today")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/football/pipeline.server");
        return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
      },
      GET: async ({ request }) => {
        const { corsHeaders, runDeskPipeline, toTodayPicks } = await import("@/lib/football/pipeline.server");
        const { todayYmd } = await import("@/lib/football/time");
        const origin = request.headers.get("origin");
        const url = new URL(request.url);
        const timezone = url.searchParams.get("tz") || url.searchParams.get("timezone") || "Africa/Kampala";
        const date = url.searchParams.get("date") || todayYmd(timezone);
        const result = await runDeskPipeline({ date, timezone, fresh: false });
        return Response.json(toTodayPicks(result), { headers: corsHeaders(origin) });
      },
    },
  },
});
