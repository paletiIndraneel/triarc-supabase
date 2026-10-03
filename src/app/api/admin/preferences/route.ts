import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_COLUMNS = [
  "vehicleNumber",
  "startSoc",
  "endSoc",
  "startedAt",
  "user",
  "location",
  "charger",
  "energy",
  "stopReason",
];

async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null };

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();

  return { supabase, user: admin ? user : null };
}

export async function GET() {
  const { supabase, user } = await getAdminUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const { data, error } = await supabase
    .from("admin_preferences")
    .select("cms_operator_columns")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admin/preferences GET]", error);
    return NextResponse.json({ error: "Failed to load preferences." }, { status: 500 });
  }

  const columns = Array.isArray(data?.cms_operator_columns)
    ? data.cms_operator_columns
    : DEFAULT_COLUMNS;

  return NextResponse.json({ columns });
}

export async function PUT(request: Request) {
  const { supabase, user } = await getAdminUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  try {
    const body = (await request.json()) as { columns?: unknown };
    const columns = Array.isArray(body.columns)
      ? body.columns.filter((column): column is string => typeof column === "string")
      : [];

    const { error } = await supabase
      .from("admin_preferences")
      .upsert(
        {
          user_id: user.id,
          cms_operator_columns: columns,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[admin/preferences PUT]", error);
      return NextResponse.json({ error: "Failed to save preferences." }, { status: 500 });
    }

    return NextResponse.json({ columns });
  } catch {
    return NextResponse.json({ error: "Invalid preferences payload." }, { status: 400 });
  }
}