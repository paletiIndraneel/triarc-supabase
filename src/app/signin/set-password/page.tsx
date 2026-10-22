import type { Metadata } from "next";
import GlassCard from "@/components/ui/GlassCard";
import SetPasswordForm from "@/components/admin/SetPasswordForm";

export const metadata: Metadata = {
  title: { absolute: "TRIARC GROUP | Set password" },
  robots: { index: false, follow: false },
};

// Where an admin invite (Access page) lands: the email's link signs the person in, and here
// they choose a password before opening the admin.
export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#03110d] px-6 py-16">
      <GlassCard className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white">Set your password</h1>
        <p className="mt-2 text-sm text-white/60">You were invited to the Triarc admin. Choose a password to finish.</p>
        <SetPasswordForm />
      </GlassCard>
    </main>
  );
}
