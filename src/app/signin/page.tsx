import type { Metadata } from "next";
import GlassCard from "@/components/ui/GlassCard";
import SignInForm from "@/components/Admin/SignInForm";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#03110d] px-6 py-16">
      <GlassCard className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white">Admin Sign In</h1>
        <p className="mt-2 text-sm text-white/60">Restricted access.</p>
        <SignInForm />
      </GlassCard>
    </main>
  );
}
