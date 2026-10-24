"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSafeCallbackUrl } from "@/lib/security";
import { authButtonClass, authErrorClass, authInputClass, authLabelClass } from "@/components/admin/AuthShell";

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

      // Only same-origin paths are accepted; anything else falls back to /admin.
      const destination = getSafeCallbackUrl(
        searchParams.get("callbackUrl"),
        window.location.origin
      );

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
      method="post" // never GET: a submit without JS must not put the password in the URL
      onSubmit={handleSubmit}
      className="mt-6 grid gap-4"
      noValidate
    >
      <label className={authLabelClass}>
        Email

        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className={authInputClass}
        />
      </label>

      <label className={authLabelClass}>
        Password

        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className={authInputClass}
        />
      </label>

      {status === "error" && (
        <p role="alert" className={authErrorClass}>
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className={authButtonClass}
      >
        {status === "loading" ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
