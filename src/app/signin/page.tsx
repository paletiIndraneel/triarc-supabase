import type { Metadata } from "next";
import { Suspense } from "react";
import AuthShell from "@/components/admin/AuthShell";
import SignInForm from "@/components/admin/SignInForm";

export const metadata: Metadata = {
  title: { absolute: "TRIARC GROUP | Sign in" },
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthShell background title="Sign in" subtitle="For Triarc admins only.">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
