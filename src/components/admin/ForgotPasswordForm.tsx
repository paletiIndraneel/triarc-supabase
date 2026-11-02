"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authButtonClass, authErrorClass, authInputClass, authLabelClass } from "@/components/admin/AuthShell";

// Sends a reset link. The reset page is the set-password page, which signs the person in from the
// link and asks for a new password. Whether the address has an account is never shown.
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    const { error } = await createClient({ flowType: "implicit" }).auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/signin/set-password`,
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <div className="mt-6 grid gap-4">
        <p role="status" className="rounded-lg border border-line bg-soft px-4 py-3 text-sm text-ink">
          If that email belongs to an admin account, a link to set a new password is on its way. The link can be used once.
        </p>
        <a href="/signin" className="text-sm font-semibold text-accent hover:text-accent-hover">Back to sign in</a>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
      <label className={authLabelClass}>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={authInputClass} />
      </label>
      {state === "error" && <p role="alert" className={authErrorClass}>Unable to send the link right now. Try again in a few minutes.</p>}
      <button type="submit" disabled={state === "saving"} className={authButtonClass}>
        {state === "saving" ? "Sending…" : "Send reset link"}
      </button>
      <a href="/signin" className="text-center text-sm font-semibold text-accent hover:text-accent-hover">Back to sign in</a>
    </form>
  );
}
