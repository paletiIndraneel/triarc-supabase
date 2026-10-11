import type { Metadata } from "next";
import { Suspense } from "react";
import GlassCard from "@/components/ui/GlassCard";
import SignInForm from "@/components/Admin/SignInForm";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#03110d] px-6 py-12">
      <GlassCard className="w-full max-w-md p-8 sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Admin Sign In
        </h1>
        <p className="mt-2 text-sm text-slate-600">Restricted access.</p>
        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>
      </GlassCard>
    </main>
  );
}
