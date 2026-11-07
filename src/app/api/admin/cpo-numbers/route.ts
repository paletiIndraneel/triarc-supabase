import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

function normalizeIndianMobile(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0091") && digits.length === 14) digits = digits.slice(4);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  return digits.length === 10 ? digits : null;
}


// The list, edits and deletes are full access only; an investor with CPO Settings ticked may
// only add a number. The CMS dashboard only asks the cpo_mobile_matches function.
export async function GET() {
  const { denied, supabase } = await requireAdmin("full-access");
  if (denied) return denied;
  const { data, error } = await supabase.from("cpo_mobile_numbers")
    .select("id, mobile_number, normalized_mobile, created_at, updated_at")
    .order("mobile_number", { ascending: true });
  if (error) {
    console.error("[admin/cpo-numbers GET]", error);
    return NextResponse.json({ error: "Could not load CPO mobile numbers. Ensure the CPO migration has been applied." }, { status: 500 });
  }
  return NextResponse.json({ numbers: (data ?? []).map((row) => ({
    id: row.id, mobileNumber: row.mobile_number, normalizedMobile: row.normalized_mobile,
    createdAt: row.created_at, updatedAt: row.updated_at,
  })) });
}

export async function POST(request: Request) {
  const { denied, supabase, user } = await requireAdmin({ module: "cpo-settings" });
  if (denied) return denied;
  try {
    const body = await request.json() as { mobileNumber?: unknown };
    if (typeof body.mobileNumber !== "string" || !body.mobileNumber.trim())
      return NextResponse.json({ error: "Enter a mobile number." }, { status: 400 });
    const mobileNumber = body.mobileNumber.trim();
    const normalizedMobile = normalizeIndianMobile(mobileNumber);
    if (!normalizedMobile) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number, optionally prefixed with +91 or 0091." }, { status: 400 });
    // Not read back: investors may add a number but not read the list.
    const { error } = await supabase.from("cpo_mobile_numbers")
      .insert({ mobile_number: mobileNumber, normalized_mobile: normalizedMobile, created_by: user.id });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "This mobile number is already configured." }, { status: 409 });
      console.error("[admin/cpo-numbers POST]", error);
      return NextResponse.json({ error: "Could not save the CPO mobile number." }, { status: 500 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  const { denied, supabase } = await requireAdmin("full-access");
  if (denied) return denied;
  try {
    const body = await request.json() as { id?: unknown; mobileNumber?: unknown };
    if (typeof body.id !== "string" || !body.id || typeof body.mobileNumber !== "string" || !body.mobileNumber.trim())
      return NextResponse.json({ error: "A number ID and mobile number are required." }, { status: 400 });
    const mobileNumber = body.mobileNumber.trim();
    const normalizedMobile = normalizeIndianMobile(mobileNumber);
    if (!normalizedMobile) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number, optionally prefixed with +91 or 0091." }, { status: 400 });
    const { data, error } = await supabase.from("cpo_mobile_numbers")
      .update({ mobile_number: mobileNumber, normalized_mobile: normalizedMobile, updated_at: new Date().toISOString() })
      .eq("id", body.id).select("id, mobile_number, normalized_mobile, created_at, updated_at").maybeSingle();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "This mobile number is already configured." }, { status: 409 });
      console.error("[admin/cpo-numbers PUT]", error);
      return NextResponse.json({ error: "Could not update the CPO mobile number." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "CPO mobile number not found." }, { status: 404 });
    return NextResponse.json({ number: { id: data.id, mobileNumber: data.mobile_number, normalizedMobile: data.normalized_mobile, createdAt: data.created_at, updatedAt: data.updated_at } });
  } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const { denied, supabase } = await requireAdmin("full-access");
  if (denied) return denied;
  try {
    const body = await request.json() as { id?: unknown };
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "A number ID is required." }, { status: 400 });
    const { error, count } = await supabase.from("cpo_mobile_numbers").delete({ count: "exact" }).eq("id", body.id);
    if (error) {
      console.error("[admin/cpo-numbers DELETE]", error);
      return NextResponse.json({ error: "Could not remove the CPO mobile number." }, { status: 500 });
    }
    if (count === 0) return NextResponse.json({ error: "CPO mobile number not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
}
