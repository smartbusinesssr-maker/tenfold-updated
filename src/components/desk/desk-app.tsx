import { Activity, CalendarIcon, Download, KeyRound, RefreshCw } from "lucide-react";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AccuracyPanel } from "@/components/desk/accuracy-panel";
import { BaioPanel } from "@/components/desk/baio-panel";
import { BoardTable } from "@/components/desk/board-table";
import { BmaPanel, seedsFromBmaPicks } from "@/components/desk/bma-panel";
import { BttsPanel } from "@/components/desk/btts-panel";
import { CalibratePanel } from "@/components/desk/calibrate-panel";
import { DixonColesPanel, seedsFromPicks } from "@/components/desk/dixon-coles-panel";
import { FoldCard } from "@/components/desk/fold-card";
import { KellyPanel } from "@/components/desk/kelly-panel";
import { MaherPanel } from "@/components/desk/maher-panel";
import { MaPanel } from "@/components/desk/ma-panel";
import { MethodPanel } from "@/components/desk/method-panel";
import { SignificancePanel } from "@/components/desk/significance-panel";
import { SortinoPanel } from "@/components/desk/sortino-panel";
import { WinOuPanel } from "@/components/desk/win-ou-panel";
import { WfoPanel } from "@/components/desk/wfo-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeskStore } from "@/lib/desk-store";
import { getScanProgressFn, refreshResultsFn, runDeskFn } from "@/lib/football/actions";
import { loadDate, loadSessionKey, loadTz, loadBankroll, loadKellyFraction, saveDate, saveSessionKey, saveTz, saveBankroll, saveKellyFraction } from "@/lib/football/storage";
import { DEFAULT_BANKROLL, DEFAULT_KELLY_FRACTION, type KellyFraction } from "@/lib/football/kelly";
import { formatLongDate, TIMEZONES, todayYmd, ymdBounds, ymdToLocalDate } from "@/lib/football/time";
import type { DeskResult, ScanProgress } from "@/lib/football/types";

export function DeskApp({ embed = false }: { embed?: boolean }) {
  const [timezone, setTimezone] = useState(loadTz());
  const [date, setDate] = useState(() => loadDate() || todayYmd(loadTz()));
  const [sessionKey, setSessionKey] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [running, setRunning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<DeskResult | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [tab, setTab] = useState("board");
  const [bankroll, setBankroll] = useState(DEFAULT_BANKROLL);
  const [kellyFraction, setKellyFraction] = useState<KellyFraction>(DEFAULT_KELLY_FRACTION);
  const scanIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const selectedIds = useDeskStore((s) => s.selectedIds);
  const ledger = useDeskStore((s) => s.ledger);
  const toggle = useDeskStore((s) => s.toggle);
  const setFold = useDeskStore((s) => s.setFold);
  const saveSelected = useDeskStore((s) => s.saveSelected);
  const exportLedger = useDeskStore((s) => s.exportLedger);
  const removeLedger = useDeskStore((s) => s.removeLedger);

  useEffect(() => {
    const tz = loadTz();
    const d = loadDate() || todayYmd(tz);
    setTimezone(tz);
    setDate(d);
    setSessionKey(loadSessionKey());
    setBankroll(loadBankroll(DEFAULT_BANKROLL));
    setKellyFraction(loadKellyFraction(DEFAULT_KELLY_FRACTION) as KellyFraction);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void runScan(false);
    return () => stopPoll();
    // first paint only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  function stopPoll() {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function runScan(fresh: boolean, nextDate = date, nextTz = timezone) {
    const scanId = `s-${Date.now()}`;
    scanIdRef.current = scanId;
    setRunning(true);
    setError(null);
    setProgress({
      scanId,
      percent: 4,
      step: fresh ? "Pulling API-Football lines…" : "Checking the saved board…",
      running: true,
      error: null,
    });
    stopPoll();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const p = await getScanProgressFn({ data: { scanId } });
          if (!p || scanIdRef.current !== scanId) return;
          setProgress((prev) => ({
            ...p,
            percent: Math.min(99, Math.max(prev?.percent ?? 0, p.percent)),
          }));
        } catch {
          /* ignore stale polls */
        }
      })();
    }, 380);

    try {
      const data = await runDeskFn({
        data: {
          date: nextDate,
          timezone: nextTz,
          fresh,
          scanId,
          apiKey: (() => {
            const k = loadSessionKey();
            return k.length > 8 ? k : undefined;
          })(),
        },
      });
      if (scanIdRef.current !== scanId) return;
      setResult(data);
      setFold(data.fold);
      setProgress({
        scanId,
        percent: 100,
        step: data.meta?.saved ? "Saved board, no new API calls" : "Board ranked",
        running: false,
        error: null,
      });
      if (data.warnings?.length) toast.message(data.warnings[0]);
    } catch (err) {
      if (scanIdRef.current !== scanId) return;
      const msg = err instanceof Error ? err.message : "Scan did not finish cleanly.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (scanIdRef.current === scanId) {
        setRunning(false);
        stopPoll();
      }
    }
  }

  async function updateResults() {
    if (!result) return;
    const scanId = `r-${Date.now()}`;
    scanIdRef.current = scanId;
    setUpdating(true);
    setError(null);
    setProgress({
      scanId,
      percent: 20,
      step: "Checking live scores…",
      running: true,
      error: null,
    });
    try {
      const data = await refreshResultsFn({
        data: {
          date,
          timezone,
          scanId,
          apiKey: (() => {
            const k = loadSessionKey();
            return k.length > 8 ? k : undefined;
          })(),
        },
      });
      if (scanIdRef.current !== scanId) return;
      setResult(data);
      setFold(data.fold);
      const hits = data.meta?.backtestHits ?? 0;
      const n = data.meta?.backtestN ?? 0;
      setProgress({ scanId, percent: 100, step: "Scores updated", running: false, error: null });
      toast.success(n ? `${hits} hit, ${n - hits} missed, of ${n} finished.` : "No finished scores yet.");
    } catch (err) {
      if (scanIdRef.current !== scanId) return;
      const msg = err instanceof Error ? err.message : "Could not update scores.";
      setError(msg);
      toast.error(msg);
    } finally {
      if (scanIdRef.current === scanId) setUpdating(false);
    }
  }

  function changeDate(next: Date | undefined) {
    if (!next) return;
    const ymd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    setDate(ymd);
    saveDate(ymd);
    void runScan(false, ymd, timezone);
  }

  function changeTz(next: string) {
    setTimezone(next);
    saveTz(next);
    const ymd = todayYmd(next);
    setDate(ymd);
    saveDate(ymd);
    void runScan(false, ymd, next);
  }

  function onSave() {
    if (!result) return;
    const n = saveSelected([...result.fold, ...result.candidates], date);
    toast.success(n ? `Saved ${n} line${n === 1 ? "" : "s"} to CSV.` : "Tick a line first.");
  }

  const bounds = ymdBounds(timezone);
  const selected = new Set(selectedIds);
  const quota = result?.meta.quota;
  const source = result?.meta.source;

  return (
    <DeskBoundary>
    <main id="desk" data-ui className={embed ? "px-3 py-4" : "px-4 py-8 sm:px-6"}>
      {embed ? null : (
        <a href="#board" className="skip-link">
          Skip to the board
        </a>
      )}
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xl leading-none">Tenfold</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {source ? (
                <Badge variant="outline">{source === "api-football" ? "API-Football" : "Public board"}</Badge>
              ) : null}
              {quota ? (
                <Badge variant="muted">
                  {quota.dayRemaining.toLocaleString()} / {quota.dayLimit.toLocaleString()} left today
                </Badge>
              ) : null}
              <Popover open={keyOpen} onOpenChange={setKeyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <KeyRound />
                    API key
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-3">
                  <Label htmlFor="api-key">API-Football key for this tab</Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={keyDraft || sessionKey}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    placeholder="x-apisports-key"
                    autoComplete="off"
                  />
                  <p className="text-sm text-muted-foreground">
                    A server key wins. This one stays in the tab and is never written to localStorage.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      const v = keyDraft.trim();
                      saveSessionKey(v);
                      setSessionKey(v);
                      setKeyOpen(false);
                      void runScan(true);
                    }}
                  >
                    Save and rescan
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <h1 className="font-display text-5xl leading-none sm:text-6xl">
              {formatLongDate(date, timezone).replace(/^\w+,\s*/, "").replace(/\s+\d{4}$/, "")}
            </h1>
            <p className="mt-4 max-w-xl text-base text-foreground">
              {formatLongDate(date, timezone).split(",")[0]}. Five wins, three both-teams-to-score, two totals — only when this date has the data.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="mt-1 w-full justify-start">
                  <CalendarIcon />
                  Change date
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Calendar
                  mode="single"
                  selected={ymdToLocalDate(date)}
                  onSelect={changeDate}
                  disabled={{ before: bounds.min, after: bounds.max }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="tz">Timezone</Label>
            <select
              id="tz"
              className="mt-1 h-11 w-full rounded-sm bg-card px-3 text-sm"
              value={timezone}
              onChange={(e) => changeTz(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => void runScan(false)} disabled={running || updating}>
            {running ? "Running" : "Run desk"}
          </Button>
          <Button variant="outline" onClick={() => void runScan(true)} disabled={running || updating}>
            <RefreshCw className={running ? "animate-spin" : undefined} />
            Rescan
          </Button>
          <Button variant="outline" onClick={() => void updateResults()} disabled={running || updating || !result}>
            <Activity className={updating ? "animate-pulse" : undefined} />
            {updating ? "Updating" : "Update results"}
          </Button>
          <Button variant="secondary" onClick={onSave} disabled={!result || running || updating}>
            <Download />
            Save CSV
          </Button>
        </div>

        {result?.meta?.resultsUpdatedAt ? (
          <p className="text-sm text-muted-foreground">
            Scores checked {new Date(result.meta.resultsUpdatedAt).toLocaleString()}. Finished lines are marked hit or miss and kept for calibration. This used one fixtures call, not a full rescan.
          </p>
        ) : result?.meta?.saved ? (
          <p className="text-sm text-muted-foreground">
            This date is already saved{result.meta.scannedAt ? ` (${new Date(result.meta.scannedAt).toLocaleString()})` : ""}. Opening it again does not call API-Football. Rescan replaces it.
          </p>
        ) : null}

        {(running || updating) ? (
          <Card>
            <p className="text-base">{progress?.step ?? "Pulling API-Football lines"}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">{progress?.percent ?? 4}%</p>
            <Progress className="mt-4" value={progress?.percent ?? 4} />
          </Card>
        ) : null}

        {error ? (
          <Card>
            <h2 className="font-display text-2xl">The scan did not finish</h2>
            <p className="mt-2 max-w-prose text-sm text-foreground">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setKeyOpen(true)}>Set API key</Button>
              <Button variant="outline" onClick={() => void runScan(true)}>
                Retry
              </Button>
            </div>
          </Card>
        ) : null}

        {result?.warnings?.length && result.candidates?.length ? (
          <p className="text-xs text-muted-foreground">{result.warnings[0]}</p>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Desk sections" className="md:flex-wrap">
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="markets">Markets</TabsTrigger>
            <TabsTrigger value="best">Best bet</TabsTrigger>
            <TabsTrigger value="kelly">Kelly</TabsTrigger>
            <TabsTrigger value="sortino">Sortino</TabsTrigger>
            <TabsTrigger value="significance">Significance</TabsTrigger>
            <TabsTrigger value="ma">Moving avg</TabsTrigger>
            <TabsTrigger value="scorelines">Scorelines</TabsTrigger>
            <span className="px-2 text-sm text-muted-foreground" aria-hidden>
              Labs
            </span>
            <TabsTrigger value="dixon">Dixon–Coles</TabsTrigger>
            <TabsTrigger value="maher">Maher</TabsTrigger>
            <TabsTrigger value="btts">BTTS</TabsTrigger>
            <TabsTrigger value="winou">1X2 · O/U</TabsTrigger>
            <TabsTrigger value="baio">Baio</TabsTrigger>
            <TabsTrigger value="bma">BMA</TabsTrigger>
            <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
            <TabsTrigger value="calibrate">Calibrate</TabsTrigger>
            <TabsTrigger value="wfo">Walk-forward</TabsTrigger>
            <TabsTrigger value="method">Method</TabsTrigger>
            <TabsTrigger value="ledger">Ledger ({ledger.length})</TabsTrigger>
          </TabsList>

        {tab !== "dixon" && tab !== "maher" && tab !== "btts" && tab !== "bma" && tab !== "baio" && tab !== "winou" && tab !== "accuracy" && tab !== "calibrate" && tab !== "wfo" && tab !== "best" && tab !== "method" && tab !== "kelly" && tab !== "sortino" && tab !== "ma" && tab !== "significance" ? (
          <>
        <section id="board" className="mt-6 space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="font-display text-3xl">Daily ten</h2>
            <p className="text-sm text-muted-foreground">Five wins, three both-teams-to-score, two totals.</p>
          </div>
          {running && !result ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : result?.fold?.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {result.fold.map((p) => (
                <FoldCard
                  key={p.id}
                  pick={p}
                  checked={selected.has(p.id)}
                  onToggle={() => toggle(p.id)}
                  timezone={timezone}
                />
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-sm text-muted-foreground">
                {running
                  ? "Pulling API-Football Over/Under, 1X2, BTTS and correct-score lines…"
                  : "No modelled line on this date. For a past day the scan grades finished matches; try yesterday or connect a key."}
              </p>
            </Card>
          )}
        </section>

        {result?.meta ? (
          <QuotaStrip meta={result.meta} fold={result.fold?.length ?? 0} />
        ) : null}
          </>
        ) : null}

          <TabsContent value="board">
            <BoardTable
              rows={result?.candidates ?? []}
              selected={selected}
              onToggle={toggle}
              timezone={timezone}
              empty="No modelled in-band markets yet."
            />
          </TabsContent>
          <TabsContent value="markets">
            <p className="mb-3 text-xs text-muted-foreground">
              Extra families from the same λ grid — draw, double chance, Asian/European handicap, team-to-score,
              extra O/U, bookings, corners, player G∪A, multi-goals, odd/even, combos.
              Research markets stay here. Only FULL_DATA draw / DC / AH / team-to-score can fill pass 2 of the ten.
            </p>
            <BoardTable
              rows={(result?.candidates ?? []).filter((p) =>
                ["draw", "dc", "ah", "team", "corners", "cards", "player", "multi", "parity", "combo"].includes(p.family) ||
                p.kind === "over_05" ||
                p.kind === "under_05" ||
                p.kind === "over_35" ||
                p.kind === "under_35" ||
                p.kind === "over_45" ||
                p.kind === "under_45" ||
                p.kind === "ou_asian",
              )}
              selected={selected}
              onToggle={toggle}
              timezone={timezone}
              empty="No extra-family candidate on this date. Headline 5–3–2 still runs from Board."
            />
          </TabsContent>
          <TabsContent value="best">
            <p className="mb-3 text-xs text-muted-foreground">
              Accuracy-adjusted value among FULL_DATA lines. The headline is an over combo — team over 0.5, match over 1.5 or match over 2.5, 2 to 5 legs, combined price 2.00 or longer — when every leg clears last-five, sample, agreement and a positive edge. Same-match legs use the score matrix. Over 2.5 is not stacked on over 1.5. Both teams over 0.5 already includes over 1.5, so that third leg is not added. If no over combo clears, Best falls back to the best single. Mixed combos still never headline.
            </p>
            {result?.bestBet ? (
              <div className="space-y-4">
                <div>
                  <h2 className="mb-3 font-display text-2xl">Best bet</h2>
                  <FoldCard
                    pick={{ ...result.bestBet, rank: result.bestBet.rank ?? 1 }}
                    checked={selected.has(result.bestBet.id)}
                    onToggle={() => toggle(result.bestBet!.id)}
                    timezone={timezone}
                  />
                </div>
                {result.bestBetAlternates?.length ? (
                  <div>
                    <h3 className="mb-3 font-display text-lg">Alternates</h3>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {result.bestBetAlternates.map((p, i) => (
                        <FoldCard
                          key={p.id}
                          pick={{ ...p, rank: p.rank ?? i + 2 }}
                          checked={selected.has(p.id)}
                          onToggle={() => toggle(p.id)}
                          timezone={timezone}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {(result.combos ?? []).length ? (
                  <div>
                    <h3 className="mb-3 font-display text-lg">Match combos</h3>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {(result.combos ?? []).slice(0, 6).map((p, i) => (
                        <FoldCard
                          key={p.id}
                          pick={{ ...p, rank: p.rank ?? i + 1 }}
                          checked={selected.has(p.id)}
                          onToggle={() => toggle(p.id)}
                          timezone={timezone}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <Card>
                <p className="text-sm text-muted-foreground">
                  No best bet on this date — nothing was FULL_DATA with last-five, agreement, edge and the quality bars.
                </p>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="kelly">
            <KellyPanel
              picks={(() => {
                const pool = [...(result?.fold ?? []), ...(result?.candidates ?? [])];
                const seen = new Set<string>();
                const unique: typeof pool = [];
                for (const p of pool) {
                  if (seen.has(p.id)) continue;
                  seen.add(p.id);
                  unique.push(p);
                }
                const chosen = unique.filter((p) => selected.has(p.id));
                return chosen.length ? chosen : (result?.fold ?? []);
              })()}
              bankroll={bankroll}
              fraction={kellyFraction}
              onBankroll={(n) => {
                setBankroll(n);
                saveBankroll(n);
              }}
              onFraction={(f) => {
                setKellyFraction(f);
                saveKellyFraction(f);
              }}
            />
          </TabsContent>
          <TabsContent value="sortino">
            <SortinoPanel
              corpus={result?.calibration?.sharpe}
              byFamily={result?.calibration?.sharpeByFamily}
            />
          </TabsContent>
          <TabsContent value="significance">
            <SignificancePanel
              fold={result?.fold ?? []}
              rest={result?.candidates ?? []}
            />
          </TabsContent>
          <TabsContent value="ma">
            <MaPanel picks={[...(result?.fold ?? []), ...(result?.candidates ?? [])]} />
          </TabsContent>
          <TabsContent value="scorelines">
            <p className="mb-3 text-xs text-muted-foreground">
              Exact-score cells, not 1X2. Accuracy is the calibrated P(H=x, A=y) — usually 8–14% for the modal 1-1 /
              1-0 / 2-1. Posted books are Shin de-vigged across the full CS card.
            </p>
            <BoardTable
              rows={result?.scorelines ?? []}
              selected={selected}
              onToggle={toggle}
              timezone={timezone}
              empty="No playable correct-score cell on this date. Only posted 1-0 / 0-0 / 1-1 / 2-1 style scores in 3.00–21.00, raked to Shin 1X2 + O/U + BTTS. A 1-1 at ~12% is a typical modal — not a 1X2 probability. 3-2 at 25.00 is not a forecast."
            />
          </TabsContent>
          <TabsContent value="dixon">
            <DixonColesPanel seeds={seedsFromPicks([...(result?.fold ?? []), ...(result?.candidates ?? [])])} />
          </TabsContent>
          <TabsContent value="maher">
            <MaherPanel seeds={seedsFromPicks([...(result?.fold ?? []), ...(result?.candidates ?? [])])} />
          </TabsContent>
          <TabsContent value="btts">
            <BttsPanel seeds={seedsFromPicks([...(result?.fold ?? []), ...(result?.candidates ?? [])])} />
          </TabsContent>
          <TabsContent value="winou">
            <WinOuPanel seeds={seedsFromPicks([...(result?.fold ?? []), ...(result?.candidates ?? [])])} />
          </TabsContent>
          <TabsContent value="baio">
            <BaioPanel seeds={seedsFromPicks([...(result?.fold ?? []), ...(result?.candidates ?? [])])} />
          </TabsContent>
          <TabsContent value="bma">
            <BmaPanel seeds={seedsFromBmaPicks([...(result?.fold ?? []), ...(result?.candidates ?? [])])} />
          </TabsContent>
          <TabsContent value="accuracy">
            <AccuracyPanel rows={result?.modelLeaderboard ?? []} calibration={result?.calibration} />
          </TabsContent>
          <TabsContent value="calibrate">
            <CalibratePanel calibration={result?.calibration} />
          </TabsContent>
          <TabsContent value="wfo">
            <WfoPanel wfo={result?.calibration?.wfo} />
          </TabsContent>
          <TabsContent value="method">
            <MethodPanel calibration={result?.calibration} />
          </TabsContent>
          <TabsContent value="ledger">
            {ledger.length ? (
              <div className="space-y-3">
                <Button variant="outline" size="sm" onClick={exportLedger}>
                  Export ledger
                </Button>
                <ul className="space-y-2">
                  {ledger.map((r) => (
                    <li
                      key={`${r.pickId}-${r.savedAt}`}
                      className="flex items-start justify-between gap-3 rounded-lg bg-card p-4 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {r.home} v {r.away} · {r.selection}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.date} · {r.odd.toFixed(2)} · {r.market}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeLedger(r.pickId, r.savedAt)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing saved yet. Tick lines and Save CSV.</p>
            )}
          </TabsContent>
        </Tabs>

        {embed ? null : (
          <footer className="mt-auto pt-16">
            <p className="font-display text-5xl leading-none">Tenfold</p>
            <p className="mt-3 max-w-md text-base text-foreground">A ranking desk. Not a lock list.</p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              The API key never ships in the page. Scan and today’s picks are available to the same desk.
            </p>
          </footer>
        )}
      </div>
    </main>
    </DeskBoundary>
  );
}

class DeskBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : "A row on the board failed to draw." };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="px-4 py-8">
          <Card>
            <h2 className="font-display text-2xl">One row failed to draw</h2>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.error}</p>
            <Button className="mt-4" variant="outline" onClick={() => this.setState({ error: null })}>
              Show the board again
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

function QuotaStrip({
  meta,
  fold,
}: {
  meta: DeskResult["meta"];
  fold: number;
}) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground tabular-nums">
      playable 1.25–3.50 · fold {fold}/10
      {meta.backtestN != null
        ? ` · backtest ${meta.backtestHits ?? 0}/${meta.backtestN}`
        : ""}
      {meta.calibratedN
        ? ` · cal ${meta.calibratedN} lines / ${meta.calibratedDates ?? 0}d`
        : ""}{" "}
      {meta.quota?.usedThisScan ?? 0} used, {meta.quota?.dayRemaining ?? "—"} left · min{" "}
      {meta.quota?.minuteRemaining ?? "—"} · fixtures {meta.upcomingTotal ?? 0} · odds {meta.withOdds ?? 0} · in-band {meta.inBand ?? 0}{" "}
      · modelled {meta.modelled ?? 0} · calls {meta.calls ?? 0} · cache {meta.cacheHits ?? 0} · {meta.elapsedMs ?? 0} ms
      {meta.notes?.[0] ? ` · ${meta.notes[0]}` : ""}
    </p>
  );
}
