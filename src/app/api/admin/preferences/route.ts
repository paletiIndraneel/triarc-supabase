import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { CMS_COLUMN_IDS } from "@/app/admin/cms/transactionFilters";

export const dynamic = "force-dynamic";

const DEFAULT_COLUMNS = [
  "vehicleNumber",
  "startSoc",
  "endSoc",
  "startedAt",
  "userName",
  "location",
  "chargerName",
  "energyKwh",
  "stopReason",
];

export async function GET() {
  const { denied, supabase, user } = await requireAdmin("any-admin");
  if (denied) return denied;

  const { data, error } = await supabase
    .from("admin_users")
    .select("cms_operator_columns")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admin/preferences GET]", error);
    return NextResponse.json({ error: "Failed to load preferences." }, { status: 500 });
  }

  // New admin rows default to [], which means "not customised yet".
  const columns = Array.isArray(data?.cms_operator_columns) && data.cms_operator_columns.length
    ? data.cms_operator_columns
    : DEFAULT_COLUMNS;

  return NextResponse.json({ columns });
}

export async function PUT(request: Request) {
  const { denied, supabase, user } = await requireAdmin("any-admin");
  if (denied) return denied;

  try {
    const body = (await request.json()) as { columns?: unknown };
    // Only real table columns, each once, in the order given.
    const allowed = new Set<string>(CMS_COLUMN_IDS);
    const columns = Array.isArray(body.columns)
      ? [...new Set(body.columns.filter((column): column is string => typeof column === "string" && allowed.has(column)))]
      : [];

    const { data, error } = await supabase
      .from("admin_users")
      .update({ cms_operator_columns: columns })
      .eq("user_id", user.id)
      .select("user_id");

    if (error || !data?.length) {
      console.error("[admin/preferences PUT]", error);
      return NextResponse.json({ error: "Failed to save preferences." }, { status: 500 });
    }

    return NextResponse.json({ columns });
  } catch {
    return NextResponse.json({ error: "Invalid preferences payload." }, { status: 400 });
  }
}