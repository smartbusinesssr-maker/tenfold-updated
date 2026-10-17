import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tenfold/progress")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/football/pipeline.server");
        return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
      },
      GET: async ({ request }) => {
        const { corsHeaders } = await import("@/lib/football/pipeline.server");
        const { getProgress } = await import("@/lib/football/progress.server");
        const origin = request.headers.get("origin");
        const url = new URL(request.url);
        const scanId = url.searchParams.get("scanId") ?? "";
        const payload = scanId ? getProgress(scanId) : null;
        return Response.json(payload, { headers: corsHeaders(origin) });
      },
    },
  },
});
