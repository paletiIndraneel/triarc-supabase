import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCmsConfig,
  getCmsErrorMessage,
  getDashboardData,
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

  if (!config.apiUrl || !config.username || !config.password) {
    return NextResponse.json(
      { error: "CMS runtime configuration is incomplete." },
      { status: 503 }
    );
  }

  try {
    const url = new URL(request.url);
    const endDate = url.searchParams.get("endDate") ?? new Date().toISOString();
    const startDate =
      url.searchParams.get("startDate") ?? "2018-12-31T18:30:00.000Z";

    const data = await getDashboardData(config, startDate, endDate);

    return NextResponse.json({
      summary: data.summary,
      chart: data.chart,
      chargers: data.chargers,
      locations: data.locations,
    });
  } catch (error) {
    console.error("[cms/dashboard]", error);
    return NextResponse.json(
      { error: getCmsErrorMessage(error) },
      { status: 502 }
    );
  }
}
