import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scanInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(80),
  fresh: z.boolean().optional(),
  scanId: z.string().min(1).max(80).optional(),
  apiKey: z.string().min(8).max(128).optional(),
});

const progressInput = z.object({
  scanId: z.string().min(1).max(80),
});

const todayInput = z.object({
  timezone: z.string().min(1).max(80).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const runDeskFn = createServerFn({ method: "POST" })
  .validator(scanInput)
  .handler(async ({ data }) => {
    const { runDeskPipeline } = await import("./pipeline.server");
    return runDeskPipeline(data);
  });

export const refreshResultsFn = createServerFn({ method: "POST" })
  .validator(scanInput)
  .handler(async ({ data }) => {
    const { refreshPickResults } = await import("./pipeline.server");
    return refreshPickResults(data);
  });

export const getScanProgressFn = createServerFn({ method: "GET" })
  .validator(progressInput)
  .handler(async ({ data }) => {
    const { getProgress } = await import("./progress.server");
    return getProgress(data.scanId);
  });

export const getTodayPicksFn = createServerFn({ method: "GET" })
  .validator(todayInput)
  .handler(async ({ data }) => {
    const { runDeskPipeline, toTodayPicks } = await import("./pipeline.server");
    const { todayYmd, DEFAULT_TZ } = await import("./time");
    const timezone = data.timezone || DEFAULT_TZ;
    const date = data.date || todayYmd(timezone);
    const result = await runDeskPipeline({ date, timezone, fresh: false });
    return toTodayPicks(result);
  });
