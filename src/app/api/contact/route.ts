import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const SUBMISSIONS_FILE = path.join(process.cwd(), "contact-submissions.json");

interface Submission {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  submittedAt: string;
}

function readSubmissions(): Submission[] {
  try {
    if (!fs.existsSync(SUBMISSIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, message } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const entry: Submission = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() ?? "",
      message: message.trim(),
      submittedAt: new Date().toISOString(),
    };

    const submissions = readSubmissions();
    submissions.push(entry);
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));

    console.log("[contact] new submission:", entry);

    // Send email notification via Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"TriArc EV Hub Contact" <${process.env.GMAIL_USER}>`,
      to: process.env.CONTACT_RECIPIENT,
      replyTo: entry.email,
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
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[contact] error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
