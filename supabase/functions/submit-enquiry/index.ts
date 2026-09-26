import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed." },
          { status: 405 }
        );
      }

      try {
        const body = await req.json();

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

        // Name, email and message are required.
        // Phone is optional.
        if (!name || !email || !message) {
          return Response.json(
            {
              error: "Name, email, and message are required.",
            },
            { status: 400 }
          );
        }

        if (!EMAIL_REGEX.test(email)) {
          return Response.json(
            { error: "Invalid email address." },
            { status: 400 }
          );
        }

        const { error } = await ctx.supabase
          .from("enquiries")
          .insert({
            name,
            email,
            phone: phone || null,
            message,
          });

        if (error) {
          console.error("[submit-enquiry] Supabase insert error:", error);

          return Response.json(
            {
              error: "Unable to save your enquiry. Please try again.",
            },
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
          {
            error: "Something went wrong. Please try again.",
          },
          { status: 500 }
        );
      }
    }
  ),
};