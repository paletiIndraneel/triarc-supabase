"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;
const inputClass =
  "rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10";

// An invite link arrives with the session in the URL fragment (#access_token=…&refresh_token=…).
// It is turned into a signed-in session, removed from the address bar, and then the person sets
// their password with it.
export default function SetPasswordForm() {
  const [state, setState] = useState<"checking" | "ready" | "saving" | "invalid" | "error">("checking");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const linkError = params.get("error_description");
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (linkError) {
        setMessage(linkError.replace(/\+/g, " "));
        setState("invalid");
        return;
      }
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, "", window.location.pathname); // keep tokens out of history
        if (error) {
          setMessage("This invite link has expired or was already used. Ask for a new invite.");
          setState("invalid");
          return;
        }
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setMessage("Open this page from the link in your invite email.");
        setState("invalid");
        return;
      }
      setState("ready");
    })();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_LENGTH) return void (setMessage(`Use at least ${MIN_LENGTH} characters.`), setState("error"));
    if (password !== confirm) return void (setMessage("The two passwords do not match."), setState("error"));
    setState("saving");
    setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setState("error");
      return;
    }
    window.location.href = "/admin";
  }

  if (state === "checking") return <p className="mt-6 text-sm text-white/60">Checking your invite…</p>;
  if (state === "invalid") {
    return (
      <div className="mt-6 grid gap-4">
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{message}</p>
        <a href="/signin" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">Go to sign in</a>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
      <label className="grid gap-2 text-sm font-medium text-white/85">
        New password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={MIN_LENGTH} required className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-white/85">
        Repeat password
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={MIN_LENGTH} required className={inputClass} />
      </label>
      {state === "error" && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{message}</p>}
      <button
        type="submit"
        disabled={state === "saving"}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "saving" ? "Saving…" : "Save password and open admin"}
      </button>
    </form>
  );
}
