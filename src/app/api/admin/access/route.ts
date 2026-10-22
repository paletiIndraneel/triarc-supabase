import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { accessChangeError, ACCESS_LEVELS, isEmail, type AdminRecord } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

// The Access page: list admins, invite one by email, change an admin's access level, active
// state or stations. Full-access admins only (partners, IT admins). Everything runs with the
// server's secret key after that check, because admin_users and admin_station_access have no
// write policies for signed-in users.

async function context() {
  const { user, isPartner } = await getAdminClient();
  if (!user || !isPartner) return { error: new NextResponse("Forbidden", { status: 403 }) } as const;
  const service = await getServiceClient();
  if (!service) {
    return { error: NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set for this deployment." }, { status: 500 }) } as const;
  }
  return { user, service } as const;
}

type Service = NonNullable<Awaited<ReturnType<typeof getServiceClient>>>;

async function adminRecords(service: Service) {
  const { data, error } = await service.from("admin_users").select("user_id, access, active, created_at").eq("role", "admin");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<AdminRecord & { created_at: string }>;
}

async function validStations(service: Service, ids: unknown) {
  if (!Array.isArray(ids)) return [];
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (!wanted.length) return [];
  const { data, error } = await service.from("billing_invoice_stations").select("id").in("id", wanted);
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => s.id as string);
}

async function setStations(service: Service, userId: string, stationIds: string[]) {
  const { error: delError } = await service.from("admin_station_access").delete().eq("user_id", userId);
  if (delError) throw new Error(delError.message);
  if (!stationIds.length) return;
  const { error } = await service.from("admin_station_access").insert(stationIds.map((station_id) => ({ user_id: userId, station_id })));
  if (error) throw new Error(error.message);
}

export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  try {
    const [admins, access, stations, users] = await Promise.all([
      adminRecords(ctx.service),
      ctx.service.from("admin_station_access").select("user_id, station_id"),
      ctx.service.from("billing_invoice_stations").select("id, name, active").order("name"),
      // shortcut: one page of up to 1,000 sign-in users is plenty for the admin team; page further if it ever grows.
      ctx.service.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    const failed = [access, stations].find((r) => r.error)?.error ?? users.error;
    if (failed) throw new Error(failed.message);
    const email = new Map(users.data.users.map((u) => [u.id, u.email ?? ""]));
    return NextResponse.json({
      me: ctx.user.id,
      levels: ACCESS_LEVELS,
      stations: stations.data,
      admins: admins
        .map((a) => ({
          ...a,
          email: email.get(a.user_id) ?? "",
          stationIds: (access.data ?? []).filter((r) => r.user_id === a.user_id).map((r) => r.station_id),
        }))
        .sort((a, b) => a.email.localeCompare(b.email)),
    });
  } catch (error) {
    console.error("[admin/access GET]", error);
    return NextResponse.json({ error: "Could not load admins." }, { status: 500 });
  }
}

// Invite: { email, access, stationIds }.
export async function POST(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; access?: unknown; stationIds?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const access = typeof body.access === "string" ? body.access : "investor";
    if (!isEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!ACCESS_LEVELS.some((l) => l.id === access)) return NextResponse.json({ error: "Unknown access level." }, { status: 400 });

    // The invite email's link signs them in and opens the page where they set a password.
    const redirectTo = `${new URL(request.url).origin}/signin/set-password`;
    const { data, error } = await ctx.service.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "The invite could not be sent." }, { status: 400 });
    }
    const { error: adminError } = await ctx.service
      .from("admin_users")
      .upsert({ user_id: data.user.id, role: "admin", active: true, access }, { onConflict: "user_id" });
    if (adminError) throw new Error(adminError.message);
    if (access === "investor") await setStations(ctx.service, data.user.id, await validStations(ctx.service, body.stationIds));
    return NextResponse.json({ invited: email });
  } catch (error) {
    console.error("[admin/access POST]", error);
    return NextResponse.json({ error: "The invite could not be completed." }, { status: 500 });
  }
}

// Change an admin: { userId, access?, active?, stationIds? } (stationIds [] = all stations).
export async function PATCH(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  try {
    const body = (await request.json().catch(() => ({}))) as { userId?: unknown; access?: unknown; active?: unknown; stationIds?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const change: { access?: string; active?: boolean } = {};
    if (typeof body.access === "string") change.access = body.access;
    if (typeof body.active === "boolean") change.active = body.active;

    const admins = await adminRecords(ctx.service);
    const refused = accessChangeError(admins, ctx.user.id, userId, change);
    if (refused) return NextResponse.json({ error: refused }, { status: 400 });

    if (Object.keys(change).length) {
      const { error } = await ctx.service.from("admin_users").update(change).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    const access = change.access ?? admins.find((a) => a.user_id === userId)?.access;
    // Station limits apply to investors only; full-access admins always see every station.
    if (access !== "investor") await setStations(ctx.service, userId, []);
    else if (body.stationIds !== undefined) await setStations(ctx.service, userId, await validStations(ctx.service, body.stationIds));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/access PATCH]", error);
    return NextResponse.json({ error: "The change could not be saved." }, { status: 500 });
  }
}
