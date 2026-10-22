import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { accessChangeError, hasFullAccess, isEmail, toLevels, type AdminRecord } from "@/lib/adminAccess";
import { GRANTABLE_MODULES } from "@/components/admin/adminNavigation";

export const dynamic = "force-dynamic";

// The Access page: list admins, invite one by email, change an admin's role (the admin_access
// picklist), active state, modules (admin_users.modules) or stations (admin_users.station_ids:
// station record ids; empty = all). Full-access admins
// only. Everything runs with the server's secret key after that check, because signed-in admins
// can only update their own cms_operator_columns.

type Service = NonNullable<Awaited<ReturnType<typeof getServiceClient>>>;

async function context() {
  const { user, isPartner } = await getAdminClient();
  if (!user || !isPartner) return { error: new NextResponse("Forbidden", { status: 403 }) } as const;
  const service = await getServiceClient();
  if (!service) {
    return { error: NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set for this deployment." }, { status: 500 }) } as const;
  }
  return { user, service } as const;
}

// The picklist's values, from the database.
async function levelIds(service: Service) {
  const { data, error } = await service.rpc("admin_access_levels");
  if (error) throw new Error(error.message);
  return (data as string[] | null) ?? [];
}

async function adminRecords(service: Service) {
  const { data, error } = await service
    .from("admin_users")
    .select("user_id, access, active, created_at, station_ids, modules")
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<AdminRecord & { created_at: string; station_ids: string[]; modules: string[] }>;
}

// Only modules the Access page may grant; Overview always stays.
function validModules(value: unknown) {
  const ticked = Array.isArray(value) ? value : [];
  return ["overview", ...GRANTABLE_MODULES.map((m) => m.key).filter((key) => ticked.includes(key))];
}

// Only ids of existing stations, each once.
async function validStations(service: Service, ids: unknown) {
  if (!Array.isArray(ids)) return [];
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (!wanted.length) return [];
  const { data, error } = await service.from("billing_invoice_stations").select("id").in("id", wanted);
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => s.id as string);
}

export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  try {
    const [levels, admins, stations, users] = await Promise.all([
      levelIds(ctx.service),
      adminRecords(ctx.service),
      ctx.service.from("billing_invoice_stations").select("id, name, active, provider").order("name"),
      // shortcut: one page of up to 1,000 sign-in users is plenty for the admin team; page further if it ever grows.
      ctx.service.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    const failed = stations.error ?? users.error;
    if (failed) throw new Error(failed.message);
    const email = new Map(users.data.users.map((u) => [u.id, u.email ?? ""]));
    return NextResponse.json({
      me: ctx.user.id,
      levels: toLevels(levels),
      modules: GRANTABLE_MODULES,
      stations: stations.data,
      admins: admins
        .map(({ station_ids, modules, ...a }) => ({ ...a, email: email.get(a.user_id) ?? "", modules: modules ?? [], stationIds: station_ids ?? [] }))
        .sort((a, b) => a.email.localeCompare(b.email)),
    });
  } catch (error) {
    console.error("[admin/access GET]", error);
    return NextResponse.json({ error: "Could not load admins." }, { status: 500 });
  }
}

// Invite: { email, access, modules, stationIds }.
export async function POST(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; access?: unknown; modules?: unknown; stationIds?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const access = typeof body.access === "string" ? body.access : "";
    if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!(await levelIds(ctx.service)).includes(access)) return NextResponse.json({ error: "Unknown access level." }, { status: 400 });

    // The invite email's link signs them in and opens the page where they set a password.
    const redirectTo = `${new URL(request.url).origin}/signin/set-password`;
    const { data, error } = await ctx.service.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "The invite could not be sent." }, { status: 400 });
    }
    const stationIds = hasFullAccess(access) ? [] : await validStations(ctx.service, body.stationIds);
    const { error: adminError } = await ctx.service
      .from("admin_users")
      .upsert({ user_id: data.user.id, role: "admin", active: true, access, modules: validModules(body.modules), station_ids: stationIds }, { onConflict: "user_id" });
    if (adminError) throw new Error(adminError.message);
    return NextResponse.json({ invited: email });
  } catch (error) {
    console.error("[admin/access POST]", error);
    return NextResponse.json({ error: "The invite could not be completed." }, { status: 500 });
  }
}

// Change an admin: { userId, access?, active?, modules?, stationIds? } (stationIds [] = all stations).
export async function PATCH(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  try {
    const body = (await request.json().catch(() => ({}))) as { userId?: unknown; access?: unknown; active?: unknown; modules?: unknown; stationIds?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const change: { access?: string; active?: boolean; modules?: string[]; station_ids?: string[] } = {};
    if (typeof body.access === "string") change.access = body.access;
    if (typeof body.active === "boolean") change.active = body.active;
    if (body.modules !== undefined) change.modules = validModules(body.modules);

    const [levels, admins] = await Promise.all([levelIds(ctx.service), adminRecords(ctx.service)]);
    const refused = accessChangeError(admins, ctx.user.id, userId, change, levels);
    if (refused) return NextResponse.json({ error: refused }, { status: 400 });

    // Station limits apply only to roles without full access, which always see every station.
    const access = change.access ?? admins.find((a) => a.user_id === userId)?.access;
    if (hasFullAccess(access)) change.station_ids = [];
    else if (body.stationIds !== undefined) change.station_ids = await validStations(ctx.service, body.stationIds);

    if (Object.keys(change).length) {
      const { error } = await ctx.service.from("admin_users").update(change).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/access PATCH]", error);
    return NextResponse.json({ error: "The change could not be saved." }, { status: 500 });
  }
}
