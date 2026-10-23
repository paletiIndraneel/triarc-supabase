import Link from "next/link";
import AuthShell, { authButtonClass } from "@/components/admin/AuthShell";

export default function NotFound() {
  return (
    <AuthShell title="Page not found" subtitle="That address isn't part of the Triarc admin.">
      <div className="mt-6 grid">
        <Link href="/" className={authButtonClass}>Go to the admin</Link>
      </div>
    </AuthShell>
  );
}
