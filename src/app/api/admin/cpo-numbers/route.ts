import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

function normalizeIndianMobile(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0091") && digits.length === 14) digits = digits.slice(4);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  return digits.length === 10 ? digits : null;
}

async function getAdminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const { data: admin, error } = await supabase.from("admin_users").select("user_id")
    .eq("user_id", user.id).eq("role", "admin").eq("active", true).maybeSingle();
  return { supabase, user: !error && admin ? user : null };
}

export async function GET() {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });
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
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });
  try {
    const body = await request.json() as { mobileNumber?: unknown };
    if (typeof body.mobileNumber !== "string" || !body.mobileNumber.trim())
      return NextResponse.json({ error: "Enter a mobile number." }, { status: 400 });
    const mobileNumber = body.mobileNumber.trim();
    const normalizedMobile = normalizeIndianMobile(mobileNumber);
    if (!normalizedMobile) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number, optionally prefixed with +91 or 0091." }, { status: 400 });
    const { data, error } = await supabase.from("cpo_mobile_numbers")
      .insert({ mobile_number: mobileNumber, normalized_mobile: normalizedMobile, created_by: user.id })
      .select("id, mobile_number, normalized_mobile, created_at, updated_at").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "This mobile number is already configured." }, { status: 409 });
      console.error("[admin/cpo-numbers POST]", error);
      return NextResponse.json({ error: "Could not save the CPO mobile number." }, { status: 500 });
    }
    return NextResponse.json({ number: { id: data.id, mobileNumber: data.mobile_number, normalizedMobile: data.normalized_mobile, createdAt: data.created_at, updatedAt: data.updated_at } }, { status: 201 });
  } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });
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
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });
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
