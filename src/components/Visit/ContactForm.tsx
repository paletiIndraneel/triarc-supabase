"use client";

import { useState } from "react";

interface FormState {
  name: string;
  email: string;
  phone: string;
  message: string;
}

const EMPTY: FormState = { name: "", email: "", phone: "", message: "" };

export default function ContactForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }

      setStatus("success");
      setForm(EMPTY);
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-7 w-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h4 className="text-xl font-bold text-white">Message Sent!</h4>
        <p className="max-w-xs text-sm leading-7 text-white/70">
          Thanks for reaching out. Our team will get back to you shortly.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-2 rounded-xl border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
      <label className="grid gap-2 text-sm font-medium text-white/85">
        Name
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Your name"
          required
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-white/85">
        Email
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@example.com"
          required
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-white/85">
        Phone
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="+91 98765 43210"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-white/85">
        Message
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          rows={4}
          placeholder="Tell us your travel or charging plan..."
          required
          className="resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
        />
      </label>

      {status === "error" && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        )}
        {status === "loading" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
