import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getChargingProviders, providerErrorMessage, type ChargingProvider } from "@/lib/cms/provider";
import {
  fromStoredRow,
  MAX_ACTIVE_MS,
  SESSION_COLUMNS,
  SESSIONS_TABLE,
  stationLocationKeys,
  storedRows,
  syncStartDate,
  upsertStoredRows,
} from "@/lib/cms/transactionStore";
import type { CmsTransaction, CmsTransactionRow } from "@/lib/cms/types";

export const dynamic = "force-dynamic";

type Supabase = Awaited<ReturnType<typeof getAdminClient>>["supabase"];

export async function GET(request: Request) {
  const { supabase, user, stationIds } = await getAdminClient();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const providers = await getChargingProviders(supabase);
  if (!providers.length) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const perPage = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("perPage") ?? "25"))
    );
    const endDate = url.searchParams.get("endDate") ?? new Date().toISOString();
    const startDate =
      url.searchParams.get("startDate") ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const searchField = url.searchParams.get("searchField") ?? "";
    const searchKey = url.searchParams.get("searchKey") ?? "";

    // stored=1: only what the sessions table already holds for the window, no platform call,
    // so the dashboard can render at once and then swap in the live response.
    if (url.searchParams.get("stored") === "1") {
      const transactions = await readStoredTransactions(supabase, startDate, endDate);
      const newest = transactions.reduce<string | null>(
        (latest, t) => (t.startedAt && (!latest || t.startedAt > latest) ? t.startedAt : latest),
        null
      );
      return NextResponse.json({
        dashboard: { summary: {}, chart: {}, chargers: {}, locations: {} },
        transactions: {
          transactions,
          count: transactions.length,
          totalCount: transactions.length,
          coverage: { startDate, endDate: newest ?? startDate },
        },
        active: {},
        stored: true,
      });
    }

    // Only run a requested historical backfill when the store is empty. Once at least
    // one session exists, all requests use normal delta sync instead of repeatedly
    // fetching history from the requested start date (including new browsers).
    const backfillRequested = url.searchParams.get("backfill") === "1" && !searchKey;
    // Sessions are saved with the server's secret key (the user is checked above), so a
    // station-limited investor's load still saves every session the platform returns.
    const writer = (await getServiceClient()) ?? supabase;

    // Each platform syncs on its own; one that fails is reported in sourceErrors and the
    // others still load. Only when every platform fails does the request fail.
    const results = await Promise.allSettled(
      providers.map((provider) =>
        syncProvider(supabase, writer, provider, { page, perPage, startDate, endDate, searchField, searchKey, backfillRequested })
      )
    );
    const synced = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failures = results.flatMap((r, i) =>
      r.status === "rejected" ? [`${providers[i].label}: ${providerErrorMessage(r.reason)}`] : []
    );
    if (!synced.length) throw results.find((r) => r.status === "rejected")?.reason;

    // A station-limited investor gets only their stations' sessions (the database read policy
    // already limits the stored ones; this covers what the platform returned live).
    const allowed = stationIds ? await stationLocationKeys(supabase, stationIds) : null;
    const visible = (t: CmsTransaction) => !allowed || allowed.has(`${t.provider}|${t.locationId ?? ""}`);
    const transactions = synced.flatMap((s) => s.transactions).filter(visible);
    const active = synced.flatMap((s) => s.active).filter(visible);
    return NextResponse.json({
      // shortcut: the dashboard's summary/locations come from the first platform that has one
      // (ChargeMOD); merge them when a second platform brings its own.
      dashboard: synced.find((s) => s.dashboard)?.dashboard ?? { summary: {}, chart: {}, chargers: {}, locations: {} },
      transactions: {
        transactions,
        count: transactions.length,
        totalCount: transactions.length,
        page,
        perPage,
        coverage: { startDate, endDate },
        sourceErrors: [...synced.flatMap((s) => s.errors), ...failures],
      },
      active: { transactions: active, count: active.length },
    });
  } catch (error) {
    console.error("[cms/operator]", error);
    return NextResponse.json(
      { error: providerErrorMessage(error) },
      { status: 502 }
    );
  }
}

// One platform: fetch only what is new since its newest stored session (delta sync), save
// it, and add its older sessions of the window from the table.
async function syncProvider(
  supabase: Supabase,
  writer: Supabase,
  provider: ChargingProvider,
  options: {
    page: number;
    perPage: number;
    startDate: string;
    endDate: string;
    searchField: string;
    searchKey: string;
    backfillRequested: boolean;
  }
) {
  const { page, perPage, startDate, endDate, searchField, searchKey, backfillRequested } = options;
  let syncStart = startDate;
  if (!searchKey) {
    // Where to resume is a fact about the whole table, so it is read with the writer (a
    // station-limited investor's own client would only see their stations' newest row).
    const latestStart = (open: boolean) => {
      let query = writer
        .from(SESSIONS_TABLE)
        .select("started_at")
        .eq("provider", provider.id)
        .not("started_at", "is", null);
      // Only open sessions from the last MAX_ACTIVE_MS: an older one is a platform ghost and,
      // as the oldest, would hide the real ones still waiting for their stop time.
      if (open) query = query.is("stopped_at", null).gte("started_at", new Date(Date.now() - MAX_ACTIVE_MS).toISOString());
      return query.order("started_at", { ascending: open }).limit(1).maybeSingle();
    };
    const [newest, oldestOpen] = await Promise.all([latestStart(false), latestStart(true)]);
    const error = newest.error ?? oldestOpen.error;
    if (error) {
      console.error(`[cms/operator] reading stored ${provider.id} sessions failed:`, error.message);
    } else {
      const hasStoredHistory = Boolean(newest.data?.started_at);
      const shouldBackfill = backfillRequested && !hasStoredHistory;
      if (!shouldBackfill) {
        syncStart = syncStartDate(startDate, newest.data?.started_at, oldestOpen.data?.started_at);
      }
    }
    if (syncStart > endDate) syncStart = endDate;
  }

  const data = await provider.fetchSessions({ page, perPage, startDate: syncStart, endDate, searchField, searchKey });

  // Start persisting fetched sessions as soon as they are available, then overlap the upsert
  // with the historical read. Await persistence before responding so serverless runtimes
  // cannot terminate the write after the response has returned. Every active admin's load
  // saves (RLS: insert/update for active admins).
  let persistPromise: Promise<void> = Promise.resolve();
  const rows = storedRows(data.active, data.transactions, new Date().toISOString());
  if (rows.length > 0) {
    persistPromise = upsertStoredRows(writer, rows).then(({ error }) => {
      if (error) console.error(`[cms/operator] saving ${provider.id} sessions failed:`, error);
    });
  }

  const stored: CmsTransaction[] =
    syncStart !== startDate ? await readStoredTransactions(supabase, startDate, syncStart, provider.id) : [];
  await persistPromise;

  return {
    transactions: [...stored, ...data.transactions],
    active: data.active,
    errors: data.errors.map((e) => `${provider.label}: ${e}`),
    dashboard: data.dashboard,
  };
}

// Sessions saved in the sessions table that started in [from, to), oldest first; one
// platform's only when `provider` is given.
async function readStoredTransactions(supabase: Supabase, from: string, to: string, provider?: string) {
  const stored: CmsTransactionRow[] = [];
  // Larger bounded pages reduce sequential Supabase round trips for historical windows.
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from(SESSIONS_TABLE)
      // Avoid loading the potentially large meter-values JSON on every dashboard read.
      .select(SESSION_COLUMNS)
      .gte("started_at", from)
      .lt("started_at", to);
    if (provider) query = query.eq("provider", provider);
    const { data: batch, error } = await query
      .order("started_at")
      .order("transaction_id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Stored sessions could not be read: ${error.message}`);
    stored.push(...(batch as unknown as CmsTransactionRow[]));
    if (batch.length < pageSize) break;
  }
  return stored.map(fromStoredRow);
}
