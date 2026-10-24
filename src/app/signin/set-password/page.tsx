import type { Metadata } from "next";
import AuthShell from "@/components/admin/AuthShell";
import SetPasswordForm from "@/components/admin/SetPasswordForm";

export const metadata: Metadata = {
  title: { absolute: "TRIARC GROUP | Set password" },
  robots: { index: false, follow: false },
};

// Where an admin invite (Access page) lands: the email's link signs the person in, and here
// they choose a password before opening the admin.
export default function SetPasswordPage() {
  return (
    <AuthShell title="Set your password" subtitle="You were invited to the Triarc admin. Choose a password to finish.">
      <SetPasswordForm />
    </AuthShell>
  );
}
