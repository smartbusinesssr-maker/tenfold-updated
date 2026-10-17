import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tenfold/scan")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/football/pipeline.server");
        return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
      },
      POST: async ({ request }) => {
        const { corsHeaders, runDeskPipeline } = await import("@/lib/football/pipeline.server");
        const origin = request.headers.get("origin");
        let body: { date?: string; timezone?: string; fresh?: boolean };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(origin) });
        }
        if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          return Response.json(
            { error: "date must be YYYY-MM-DD" },
            { status: 400, headers: corsHeaders(origin) },
          );
        }
        const result = await runDeskPipeline({
          date: body.date,
          timezone: body.timezone || "Africa/Kampala",
          fresh: Boolean(body.fresh),
        });
        return Response.json(result, { headers: corsHeaders(origin) });
      },
    },
  },
});
