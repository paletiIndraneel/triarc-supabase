import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import {
  getCmsConfig,
  getCmsErrorMessage,
  getOperatorData,
} from "@/lib/cms/operator";

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

    const data = await getOperatorData(config, supabase, {
      page,
      perPage,
      startDate,
      endDate,
      searchField: url.searchParams.get("searchField") ?? "",
      searchKey: url.searchParams.get("searchKey") ?? "",
    });

    // Keep a copy of every session in cms_transactions. RLS only lets partners write;
    // a failed save is logged and never blocks the dashboard.
    if (isPartner) {
      const syncedAt = new Date().toISOString();
      const rows = data.transactions.transactions.map((t) => ({
        transaction_id: t.transactionId || t.id,
        started_at: t.startedAt,
        data: t,
        synced_at: syncedAt,
      }));
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

    return NextResponse.json(data);
  } catch (error) {
    console.error("[cms/operator]", error);
    return NextResponse.json(
      { error: getCmsErrorMessage(error) },
      { status: 502 }
    );
  }
}
