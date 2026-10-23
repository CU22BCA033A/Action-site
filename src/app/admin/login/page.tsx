import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { AdminLoginForm } from "@/components/admin/login-form";
import { getAdminSession } from "@/lib/auth/admin";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Admin sign in",
  description: "Sign-in page for the auction administrator. Team owners join with an access code instead, and viewers need no account.",
  path: "/admin/login",
  noIndex: true,
});

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 inline-flex w-fit items-center gap-2" aria-label="Home">
        <LogoMark className="size-10" />
      </Link>
      <h1 className="text-4xl uppercase">Admin sign in</h1>
      <p className="mt-2 text-muted">For the person running the auction. Team owners use the join page with their access code.</p>
      <div className="mt-8 rounded-[var(--radius-md)] border border-line bg-surface p-5 sm:p-6">
        <AdminLoginForm />
      </div>
      <p className="mt-6 text-sm">
        <Link href="/join" className="link text-muted hover:text-text">
          Team owner? Join with your access code
        </Link>
      </p>
    </main>
  );
}
