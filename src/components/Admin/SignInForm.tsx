"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Invalid username or password.");
        setStatus("error");
        return;
      }

      const callbackUrl = searchParams.get("callbackUrl");
      const isSafeCallback = !!callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//");
      const destination = isSafeCallback ? callbackUrl : "/admin";

      // Full navigation so the /admin edge middleware sees the new cookie.
      window.location.href = destination;
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
      <label className="grid gap-2 text-sm font-medium text-white/85">
        Username
        <input
          type="text"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
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
