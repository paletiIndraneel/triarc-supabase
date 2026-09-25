"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setStatus("loading");
    setErrorMsg("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("[auth] Supabase sign-in error:", error);
        setErrorMsg("Invalid email or password.");
        setStatus("error");
        return;
      }

      const callbackUrl = searchParams.get("callbackUrl");

      const isSafeCallback =
        !!callbackUrl &&
        callbackUrl.startsWith("/") &&
        !callbackUrl.startsWith("//");

      const destination = isSafeCallback
        ? callbackUrl
        : "/admin";

      window.location.href = destination;
    } catch (error) {
      console.error("[auth] sign-in error:", error);
      setErrorMsg(
        "Unable to sign in right now. Please try again."
      );
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 grid gap-4"
      noValidate
    >
      <label className="grid gap-2 text-sm font-medium text-white/85">
        Email

        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-white/85">
        Password

        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
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
        {status === "loading" ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
