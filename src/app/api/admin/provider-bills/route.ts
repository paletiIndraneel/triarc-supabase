import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { PROVIDERS } from "@/lib/cms/providerIds";
import { SESSIONS_TABLE } from "@/lib/cms/transactionStore";
import { normalizeMobile } from "@/app/admin/cms/transactionFilters";
import { commissionPerKwh, cycleLabel, cycleRuleFor, cyclesBack, type Cycle } from "@/lib/billingCycle";
import type { SupabaseClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

// Bills the charging platform sends Triarc, per billing cycle, beside what the stored sessions
// say for the same cycle. Ionage bills every 7 days and auto-generates the document, so the job
// here is checking the quantities before agreeing them.
//
// Every active admin with the module may read. Only full access records or confirms a bill,
// because confirming commits Triarc to paying it. RLS enforces the same.

// How many cycles the page offers, newest first.
const CYCLES = 8;
// PostgREST caps a response, so sessions are read in pages.
const PAGE = 1000;

type SessionRow = { started_at: string | null; energy_kwh: number | null; tariff_amount: number | null; type: string | null; mobile: string | null };

async function readSessions(supabase: SupabaseClient, provider: string, from: number, to: number) {
  const rows: SessionRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select("started_at, energy_kwh, tariff_amount, type, mobile")
      .eq("provider", provider)
      .gte("started_at", new Date(from).toISOString())
      .lt("started_at", new Date(to).toISOString())
      .order("started_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as SessionRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

// Which of these mobiles are CPO Settings numbers. Only the matches come back, so the list
// itself is never exposed (the same cpo_mobile_matches function the dashboard uses).
async function cpoMobiles(supabase: SupabaseClient, rows: SessionRow[]) {
  const wanted = new Set<string>();
  for (const row of rows) {
    if (row.type?.trim()) continue; // a stated type wins; only untyped sessions need matching
    const mobile = normalizeMobile(row.mobile);
    if (mobile) wanted.add(mobile);
  }
  const hits = new Set<string>();
  const all = [...wanted];
  for (let i = 0; i < all.length; i += PAGE) {
    const chunk = all.slice(i, i + PAGE);
    const { data, error } = await supabase.rpc("cpo_mobile_matches", { p_mobiles: chunk });
    if (error) {
      // Without the numbers an untyped session counts as a customer, as elsewhere.
      console.error("[admin/provider-bills] CPO lookup failed:", error.message);
      break;
    }
    for (const mobile of ((data as string[] | null) ?? [])) hits.add(mobile);
  }
  return hits;
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

// What the stored sessions say for one cycle: customer energy and revenue with Triarc's own CPO
// sessions kept apart, and the commission that customer energy earns the platform.
function ourFigures(provider: string, cycle: Cycle, rows: SessionRow[], cpo: Set<string>) {
  let customerEnergy = 0, customerRevenue = 0, cpoEnergy = 0, sessions = 0;
  for (const row of rows) {
    const at = row.started_at ? Date.parse(row.started_at) : NaN;
    if (!(at >= cycle.start && at < cycle.end)) continue;
    const type = row.type?.trim().toUpperCase();
    const mobile = normalizeMobile(row.mobile);
    const isCpo = type ? type === "CPO" : mobile !== null && cpo.has(mobile);
    const kwh = Number(row.energy_kwh);
    const amount = Number(row.tariff_amount);
    sessions += 1;
    if (Number.isFinite(kwh) && kwh > 0) {
      if (isCpo) cpoEnergy += kwh;
      else customerEnergy += kwh;
    }
    if (!isCpo && row.tariff_amount != null && Number.isFinite(amount)) customerRevenue += amount;
  }
  return {
    sessions,
    energyKwh: round(customerEnergy, 4),
    cpoEnergyKwh: round(cpoEnergy, 4),
    amount: round(customerRevenue, 2),
    // Net of CPO for now; gross-vs-net is unconfirmed until the first bill.
    commission: round(customerEnergy * commissionPerKwh(provider), 2),
  };
}

type BillRow = {
  id: string; provider: string; period_start: string; period_end: string; payment_due: string | null;
  their_energy_kwh: number | null; their_amount: number | null; their_commission: number | null;
  status: string; note: string | null; confirmed_by: string | null; confirmed_at: string | null;
};

function platformOr400(value: unknown) {
  return PROVIDERS.find((p) => p.id === value) ?? null;
}

export async function GET(request: Request) {
  const { supabase, user, isPartner, modules } = await getAdminClient();
  if (!user || !(isPartner || modules.includes("provider-bills"))) return new NextResponse("Forbidden", { status: 403 });

  const asked = new URL(request.url).searchParams.get("provider");
  const info = asked ? platformOr400(asked) : PROVIDERS[0];
  if (!info) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });

  const rule = cycleRuleFor(info.id);
  const cycles = cyclesBack(new Date(), CYCLES, rule);
  try {
    const sessions = await readSessions(supabase, info.id, cycles[0].start, cycles[cycles.length - 1].end);
    const cpo = await cpoMobiles(supabase, sessions);

    const { data: stored, error } = await supabase
      .from("provider_bills")
      .select("id, provider, period_start, period_end, payment_due, their_energy_kwh, their_amount, their_commission, status, note, confirmed_by, confirmed_at")
      .eq("provider", info.id)
      .gte("period_start", new Date(cycles[0].start).toISOString());
    if (error) throw new Error(error.message);
    const bills = new Map(((stored ?? []) as BillRow[]).map((row) => [Date.parse(row.period_start), row]));

    const now = Date.now();
    return NextResponse.json({
      provider: { id: info.id, label: info.label, cycle: rule, commissionPerKwh: commissionPerKwh(info.id) },
      canConfirm: isPartner,
      // Newest cycle first.
      cycles: [...cycles].reverse().map((cycle) => {
        const bill = bills.get(cycle.start);
        return {
          periodStart: new Date(cycle.start).toISOString(),
          periodEnd: new Date(cycle.end).toISOString(),
          label: cycleLabel(cycle, rule),
          // A cycle still running cannot be billed yet; its figures are only a running total.
          running: cycle.end > now,
          ours: ourFigures(info.id, cycle, sessions, cpo),
          bill: bill && {
            id: bill.id,
            paymentDue: bill.payment_due,
            theirEnergyKwh: bill.their_energy_kwh,
            theirAmount: bill.their_amount,
            theirCommission: bill.their_commission,
            status: bill.status,
            note: bill.note,
            confirmedAt: bill.confirmed_at,
          },
        };
      }),
    });
  } catch (err) {
    console.error("[admin/provider-bills GET]", err);
    return NextResponse.json({ error: "Could not load platform bills. Ensure the provider_bills migration has been applied." }, { status: 500 });
  }
}

// { provider, periodStart, theirEnergyKwh?, theirAmount?, theirCommission?, status?, note? }
// Our own figures are never taken from the request: they are recomputed here from the sessions.
export async function PUT(request: Request) {
  const { supabase, user, isPartner } = await getAdminClient();
  if (!user || !isPartner) return new NextResponse("Forbidden", { status: 403 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const info = platformOr400(body.provider);
    if (!info) return NextResponse.json({ error: "Unknown platform." }, { status: 400 });

    const periodStart = typeof body.periodStart === "string" ? Date.parse(body.periodStart) : NaN;
    if (!Number.isFinite(periodStart)) return NextResponse.json({ error: "A cycle start is required." }, { status: 400 });

    const rule = cycleRuleFor(info.id);
    const cycle = cyclesBack(new Date(), CYCLES, rule).find((c) => c.start === periodStart);
    if (!cycle) return NextResponse.json({ error: "That cycle is not one of the recent ones." }, { status: 400 });

    const status = body.status === undefined ? "pending" : body.status;
    if (typeof status !== "string" || !["pending", "confirmed", "disputed"].includes(status)) {
      return NextResponse.json({ error: "Status must be pending, confirmed or disputed." }, { status: 400 });
    }
    // A figure may be left out, but anything given has to be a number.
    const figure = (value: unknown, name: string) => {
      if (value === undefined || value === null || value === "") return null;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a number of zero or more.`);
      return n;
    };
    const theirEnergyKwh = figure(body.theirEnergyKwh, "Their energy");
    const theirAmount = figure(body.theirAmount, "Their amount");
    const theirCommission = figure(body.theirCommission, "Their commission");
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;

    const sessions = await readSessions(supabase, info.id, cycle.start, cycle.end);
    const ours = ourFigures(info.id, cycle, sessions, await cpoMobiles(supabase, sessions));
    const confirmed = status === "confirmed";

    const { data, error } = await supabase.from("provider_bills").upsert({
      provider: info.id,
      period_start: new Date(cycle.start).toISOString(),
      period_end: new Date(cycle.end).toISOString(),
      // Ionage settles three days after the cycle closes; harmless for a platform that does not.
      payment_due: new Date(cycle.end + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      their_energy_kwh: theirEnergyKwh,
      their_amount: theirAmount,
      their_commission: theirCommission,
      our_energy_kwh: ours.energyKwh,
      our_amount: ours.amount,
      our_commission: ours.commission,
      status,
      note,
      confirmed_by: confirmed ? user.id : null,
      confirmed_at: confirmed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider,period_start" }).select("id, status").maybeSingle();

    if (error) {
      console.error("[admin/provider-bills PUT]", error);
      return NextResponse.json({ error: "Could not save the bill." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "The change was refused." }, { status: 403 });
    return NextResponse.json({ bill: { id: data.id, status: data.status }, ours });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request body." }, { status: 400 });
  }
}
