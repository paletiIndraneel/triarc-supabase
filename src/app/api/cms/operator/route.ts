import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import {
  getCmsConfig,
  getCmsErrorMessage,
  getOperatorData,
} from "@/lib/cms/operator";
import { fromStoredRow, syncStartDate, toStoredRow } from "@/lib/cms/transactionStore";

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

    // Delta sync: ChargeMOD is only asked for sessions from a few days before the newest
    // stored one (see syncStartDate); older sessions in the window come from cms_transactions.
    // Searches and a missing/unreadable table fall back to fetching the whole window.
    let syncStart = startDate;
    if (!searchKey) {
      const { data: newest, error } = await supabase
        .from("cms_transactions")
        .select("started_at")
        .not("started_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error("[cms/operator] reading stored transactions failed:", error.message);
      else syncStart = syncStartDate(startDate, newest?.started_at);
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
      const rows = data.transactions.transactions.map((t) => toStoredRow(t, syncedAt));
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
      const stored: Record<string, unknown>[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: batch, error } = await supabase
          .from("cms_transactions")
          .select("*")
          .gte("started_at", startDate)
          .lt("started_at", syncStart)
          .order("started_at")
          .order("transaction_id")
          .range(from, from + 999);
        if (error) throw new Error(`Stored CMS transactions could not be read: ${error.message}`);
        stored.push(...batch);
        if (batch.length < 1000) break;
      }
      const transactions = [
        ...(stored.map(fromStoredRow) as typeof data.transactions.transactions),
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
