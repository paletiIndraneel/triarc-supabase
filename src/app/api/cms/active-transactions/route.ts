import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveTransactions,
  getCmsConfig,
  getCmsErrorMessage,
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

export async function GET() {
  if (!(await requireAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const config = await getCmsConfig();
  if (!config.enabled) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const raw = await getActiveTransactions(config);
    const result = Array.isArray(raw.result) ? raw.result : [];
    const transactions = result
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object"
      )
      .map(sanitizeTransaction);

    return NextResponse.json({
      transactions,
      count: Number(raw.count ?? transactions.length),
    });
  } catch (error) {
    console.error("[cms/active-transactions]", error);
    return NextResponse.json(
      { error: getCmsErrorMessage(error) },
      { status: 502 }
    );
  }
}
