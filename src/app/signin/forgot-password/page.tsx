import type { Metadata } from "next";
import AuthShell from "@/components/admin/AuthShell";
import ForgotPasswordForm from "@/components/admin/ForgotPasswordForm";

export const metadata: Metadata = {
  title: { absolute: "TRIARC GROUP | Forgot password" },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot password" subtitle="Enter your email and we will send a link to set a new password.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
