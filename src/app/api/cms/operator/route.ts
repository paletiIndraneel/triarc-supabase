import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import {
  getCmsConfig,
  getCmsErrorMessage,
  getOperatorData,
} from "@/lib/cms/operator";
import { fromStoredRow, syncStartDate, toStoredRow } from "@/lib/cms/transactionStore";
import type { CmsTransactionRow } from "@/lib/cms/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, user, isPartner } = await getAdminClient();
  if (!user) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const config = await getCmsConfig();
  if (!config.enabled) {
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

    // stored=1: only what cms_transactions already holds for the window, no ChargeMOD call,
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

    // Historical backfill is explicitly requested once by the dashboard. All later
    // requests use the normal delta sync from the newest stored session (or oldest open one).
    const backfill = url.searchParams.get("backfill") === "1" && !searchKey;
    let syncStart = startDate;
    if (!backfill && !searchKey) {
      const latestStart = (open: boolean) => {
        let query = supabase.from("cms_transactions").select("started_at").not("started_at", "is", null);
        if (open) query = query.is("stopped_at", null);
        return query.order("started_at", { ascending: open }).limit(1).maybeSingle();
      };
      const [newest, oldestOpen] = await Promise.all([
        latestStart(false),
        latestStart(true),
      ]);
      const error = newest.error ?? oldestOpen.error;
      if (error) {
        console.error("[cms/operator] reading stored transactions failed:", error.message);
      } else {
        syncStart = syncStartDate(startDate, newest.data?.started_at, oldestOpen.data?.started_at);
      }
      if (syncStart > endDate) syncStart = endDate;
    }

    const data = await getOperatorData(config, supabase, {
      page,
      perPage,
      startDate: syncStart,
      endDate,
      searchField,
      searchKey,
    });

    // Keep a copy of every fetched session in cms_transactions. RLS only lets partners
    // write; a failed save is logged and never blocks the dashboard.
    if (isPartner) {
      const syncedAt = new Date().toISOString();
      // Sessions still charging are saved too (no stop time), so the next sync starts from
      // them; a finished copy from the session list wins over the active one.
      const byId = new Map(
        [...data.active.transactions, ...data.transactions.transactions].map((t) => {
          const row = toStoredRow(t, syncedAt);
          return [row.transaction_id, row] as const;
        })
      );
      const rows = Array.from(byId.values());
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase
          .from("cms_transactions")
          .upsert(rows.slice(i, i + 500), { onConflict: "transaction_id" });
        if (error) {
          console.error("[cms/operator] saving transactions failed:", error.message);
          break;
        }
      }
    }

    if (syncStart !== startDate) {
      const stored = await readStoredTransactions(supabase, startDate, syncStart);
      const transactions = [
        ...stored,
        ...data.transactions.transactions,
      ];
      data.transactions = {
        ...data.transactions,
        transactions,
        count: transactions.length,
        totalCount: transactions.length,
        coverage: { startDate, endDate },
      };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[cms/operator]", error);
    return NextResponse.json(
      { error: getCmsErrorMessage(error) },
      { status: 502 }
    );
  }
}

// Sessions saved in cms_transactions that started in [from, to), oldest first.
async function readStoredTransactions(
  supabase: Awaited<ReturnType<typeof getAdminClient>>["supabase"],
  from: string,
  to: string
) {
  const stored: CmsTransactionRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: batch, error } = await supabase
      .from("cms_transactions")
      .select("*")
      .gte("started_at", from)
      .lt("started_at", to)
      .order("started_at")
      .order("transaction_id")
      .range(offset, offset + 999);
    if (error) throw new Error(`Stored CMS transactions could not be read: ${error.message}`);
    stored.push(...(batch as CmsTransactionRow[]));
    if (batch.length < 1000) break;
  }
  return stored.map(fromStoredRow);
}
