import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCmsConfig,
  getCmsErrorMessage,
  getTransactions,
  sanitizeTransaction,
} from "@/lib/cms/operator";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: admin } = await supabase
    .from("admin_users")
    .select("role, active")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();

  return Boolean(admin);
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
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

    const raw = await getTransactions(config, {
      page,
      perPage,
      startDate,
      endDate,
      searchField: url.searchParams.get("searchField") ?? "",
      searchKey: url.searchParams.get("searchKey") ?? "",
    });

    const result = Array.isArray(raw.result) ? raw.result : [];

    return NextResponse.json({
      transactions: result
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object"
        )
        .map(sanitizeTransaction),
      count: Number(raw.count ?? 0),
      page,
      perPage,
    });
  } catch (error) {
    console.error("[cms/transactions]", error);
    return NextResponse.json(
      { error: getCmsErrorMessage(error) },
      { status: 502 }
    );
  }
}
