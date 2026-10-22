import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Input limits. They are far above anything a real visitor types, and exist so an
// anonymous caller cannot store huge payloads or feed the email regex (which is
// quadratic on long inputs) an arbitrarily long string. The form's inputs use the
// same maxLength values.
const MAX_BODY_CHARS = 32_000;
const MAX_NAME_CHARS = 200;
const MAX_EMAIL_CHARS = 254;
const MAX_PHONE_CHARS = 50;
const MAX_MESSAGE_CHARS = 10_000;

// Spam limits, counted from the enquiries table so they hold across function instances.
// shortcut: no per-IP limit (no IP column); add one if spam comes from many addresses.
const PER_EMAIL_LIMIT = 3; // per email address in PER_EMAIL_WINDOW_MS
const PER_EMAIL_WINDOW_MS = 10 * 60 * 1000;
const SITE_LIMIT = 30; // all enquiries in SITE_WINDOW_MS
const SITE_WINDOW_MS = 60 * 60 * 1000;

export default {
  fetch: withSupabase(
    { auth: "none" },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed." },
          { status: 405 }
        );
      }

      try {
        const rawBody = await req.text();

        if (rawBody.length > MAX_BODY_CHARS) {
          return Response.json(
            { error: "Request is too large." },
            { status: 413 }
          );
        }

        const body = JSON.parse(rawBody);

        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return Response.json(
            { error: "Invalid request." },
            { status: 400 }
          );
        }

        const name =
          typeof body.name === "string" ? body.name.trim() : "";

        const email =
          typeof body.email === "string" ? body.email.trim() : "";

        const phone =
          typeof body.phone === "string" ? body.phone.trim() : "";

        const message =
          typeof body.message === "string"
            ? body.message.trim()
            : "";

        if (!name || !email || !message) {
          return Response.json(
            { error: "Name, email, and message are required." },
            { status: 400 }
          );
        }

        if (
          name.length > MAX_NAME_CHARS ||
          email.length > MAX_EMAIL_CHARS ||
          phone.length > MAX_PHONE_CHARS ||
          message.length > MAX_MESSAGE_CHARS
        ) {
          return Response.json(
            { error: "One or more fields are too long." },
            { status: 400 }
          );
        }

        if (!EMAIL_REGEX.test(email)) {
          return Response.json(
            { error: "Invalid email address." },
            { status: 400 }
          );
        }

        // Honeypot: a field hidden from people (`website`); bots that fill it get a fake success.
        if (typeof body.website === "string" && body.website.trim()) {
          return Response.json({ success: true }, { status: 201 });
        }

        const since = (ms: number) => new Date(Date.now() - ms).toISOString();
        const [byEmail, bySite] = await Promise.all([
          ctx.supabaseAdmin.from("enquiries").select("id", { count: "exact", head: true })
            .ilike("email", email.replace(/[\\%_]/g, "\\$&")) // case-insensitive exact match
            .gte("created_at", since(PER_EMAIL_WINDOW_MS)),
          ctx.supabaseAdmin.from("enquiries").select("id", { count: "exact", head: true })
            .gte("created_at", since(SITE_WINDOW_MS)),
        ]);
        if (byEmail.error || bySite.error) {
          // A failed count must not lose a real enquiry.
          console.error("[submit-enquiry] rate-limit count failed:", byEmail.error ?? bySite.error);
        } else if ((byEmail.count ?? 0) >= PER_EMAIL_LIMIT || (bySite.count ?? 0) >= SITE_LIMIT) {
          return Response.json(
            { error: "Too many enquiries right now. Please try again later or call us." },
            { status: 429 }
          );
        }

        const { error } = await ctx.supabaseAdmin
          .from("enquiries")
          .insert({
            name,
            email,
            phone: phone || null,
            message,
          });

        if (error) {
          console.error(
            "[submit-enquiry] Supabase insert error:",
            error
          );

          return Response.json(
            { error: "Unable to save your enquiry." },
            { status: 500 }
          );
        }

        return Response.json(
          { success: true },
          { status: 201 }
        );
      } catch (error) {
        console.error("[submit-enquiry] Error:", error);

        return Response.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 }
        );
      }
    }
  ),
};