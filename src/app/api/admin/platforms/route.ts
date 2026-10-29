import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getRuntimeEnv } from "@/lib/cms/operator";
import { PROVIDERS } from "@/lib/cms/providerIds";
import { cycleRuleFor } from "@/lib/billingCycle";
export const dynamic = "force-dynamic";

// The Platforms page: which charging platforms are switched on. Full access only (partner or
// IT admin), like the Access page — a platform going off stops the sync for everyone.
//
// Credentials live on the Worker and are never returned. The only thing said about them is
// which required variable names are missing, so a partner can see why a platform cannot start.

type Row = { provider: string; enabled: boolean; updated_by: string | null; updated_at: string };

async function missingEnvByProvider() {
  const env = await getRuntimeEnv();
  const present = (name: string) => {
    const value = env[name];
    if (value == null || String(value).trim() === "") return false;
    // The ChargeMOD switch counts as present only when it is actually on.
    return !name.endsWith("_ENABLED") || String(value).toLowerCase() === "true";
  };
  return new Map(PROVIDERS.map((info) => [info.id, info.credentialEnv.filter((name) => !present(name))]));
}

export async function GET() {
  const { supabase, user, isPartner } = await getAdminClient();
  if (!user || !isPartner) return new NextResponse("Forbidden", { status: 403 });

  const { data, error } = await supabase.from("provider_settings").select("provider, enabled, updated_by, updated_at");
  if (error) {
    console.error("[admin/platforms GET]", error);
    return NextResponse.json({ error: "Could not load platforms. Ensure the provider_settings migration has been applied." }, { status: 500 });
  }
  const rows = new Map((data as Row[]).map((row) => [row.provider, row]));
  const missing = await missingEnvByProvider();

  // Who last changed it, resolved through the secret-key client like the Access page does.
  const service = await getServiceClient();
  const changers = new Set((data as Row[]).map((row) => row.updated_by).filter((id): id is string => !!id));
  const emails = new Map<string, string>();
  if (service && changers.size) {
    const users = await service.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users.data?.users ?? []) if (changers.has(u.id)) emails.set(u.id, u.email ?? "");
  }

  return NextResponse.json({
    platforms: PROVIDERS.map((info) => {
      const row = rows.get(info.id);
      const missingEnv = missing.get(info.id) ?? [];
      return {
        id: info.id,
        label: info.label,
        enabled: row?.enabled ?? false,
        // A platform only syncs when it is enabled here and its credentials are on the Worker.
        configured: missingEnv.length === 0,
        missingEnv,
        cycle: cycleRuleFor(info.id),
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by ? emails.get(row.updated_by) || null : null,
      };
    }),
  });
}

// { provider, enabled }
export async function PUT(request: Request) {
  const { supabase, user, isPartner } = await getAdminClient();
  if (!user || !isPartner) return new NextResponse("Forbidden", { status: 403 });
  try {
    const body = (await request.json()) as { provider?: unknown; enabled?: unknown };
    const info = PROVIDERS.find((p) => p.id === body.provider);
    if (!info) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
    if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "enabled must be true or false." }, { status: 400 });

    // Enabling a platform whose credentials are absent would leave it enabled but unable to
    // sync, which reads as a broken dashboard rather than a missing setting. Refuse and say so.
    if (body.enabled) {
      const missingEnv = (await missingEnvByProvider()).get(info.id) ?? [];
      if (missingEnv.length) {
        return NextResponse.json(
          { error: `${info.label} has no credentials on this deployment. Set ${missingEnv.join(", ")} first.`, missingEnv },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase.from("provider_settings")
      .upsert({ provider: info.id, enabled: body.enabled, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "provider" })
      .select("provider, enabled, updated_at").maybeSingle();
    if (error) {
      console.error("[admin/platforms PUT]", error);
      return NextResponse.json({ error: "Could not change the platform." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "The change was refused." }, { status: 403 });
    return NextResponse.json({ platform: { id: data.provider, enabled: data.enabled, updatedAt: data.updated_at } });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
