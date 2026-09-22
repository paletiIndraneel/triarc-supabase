// Cloudflare Pages Function — handles POST /api/contact via an HTTP email provider (fs/nodemailer are unsupported here).

interface ContactPayload {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

// EMAIL_API_URL/EMAIL_API_KEY must match whichever provider is chosen (e.g. Resend, Postmark, SendGrid).
interface Env {
  EMAIL_API_URL?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  CONTACT_RECIPIENT?: string;
}

interface PagesFunctionContext {
  request: Request;
  env: Env;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async ({ request, env }: PagesFunctionContext): Promise<Response> => {
  try {
    const body = (await request.json()) as ContactPayload;
    const { name, email, phone, message } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return Response.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    const entry = {
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() ?? "",
      message: message.trim(),
      submittedAt: new Date().toISOString(),
    };

    if (!env.EMAIL_API_URL || !env.EMAIL_API_KEY) {
      console.error("[contact] email provider is not configured (EMAIL_API_URL / EMAIL_API_KEY missing)");
      return Response.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const emailResponse = await fetch(env.EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM ?? "TriArc EV Hub Contact",
        to: env.CONTACT_RECIPIENT,
        reply_to: entry.email,
        subject: `New message from ${entry.name} — TriArc EV Hub`,
        text: [
          `Name:    ${entry.name}`,
          `Email:   ${entry.email}`,
          `Phone:   ${entry.phone || "—"}`,
          ``,
          `Message:`,
          entry.message,
          ``,
          `Submitted: ${entry.submittedAt}`,
        ].join("\n"),
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#10b981">New Contact Form Submission</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#6b7280;width:80px">Name</td><td style="padding:8px 0;font-weight:600">${entry.name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0"><a href="mailto:${entry.email}">${entry.email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Phone</td><td style="padding:8px 0">${entry.phone || "—"}</td></tr>
            </table>
            <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;font-size:14px;line-height:1.7;white-space:pre-wrap">${entry.message}</div>
            <p style="margin-top:16px;font-size:12px;color:#9ca3af">Submitted at ${entry.submittedAt}</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      console.error("[contact] email provider error:", emailResponse.status, await emailResponse.text());
      return Response.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[contact] error:", err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
};
