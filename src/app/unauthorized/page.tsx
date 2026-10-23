import type { Metadata } from "next";
import AuthShell, { authButtonClass } from "@/components/admin/AuthShell";
import LogoutButton from "@/components/admin/LogoutButton";

export const metadata: Metadata = {
  title: { absolute: "TRIARC GROUP | No access" },
  robots: { index: false, follow: false },
};

export default function UnauthorizedPage() {
  return (
    <AuthShell title="No admin access" subtitle="This account is signed in but is not an active Triarc admin. Ask a partner to invite you, or sign in with another account.">
      <div className="mt-6 grid">
        <LogoutButton className={authButtonClass}>Sign in with another account</LogoutButton>
      </div>
    </AuthShell>
  );
}
