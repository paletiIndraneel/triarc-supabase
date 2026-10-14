import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";

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
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

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
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  try {
    const body = (await request.json()) as { columns?: unknown };
    const columns = Array.isArray(body.columns)
      ? body.columns.filter((column): column is string => typeof column === "string")
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