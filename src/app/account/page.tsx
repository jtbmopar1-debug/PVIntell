import { ArrowLeft, KeyRound, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "./actions";
import { PasswordField } from "@/components/password-field";
import { MeasurementUnitsSettings } from "@/components/measurement-units-settings";
import { PwaInstallCard } from "@/components/pwa-install-card";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; setup?: string }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const notice = await searchParams;
  const email = typeof data.claims.email === "string" ? data.claims.email : "";
  return (
    <main className="min-h-screen bg-canvas p-4 md:p-6">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-bold text-muted"
          >
            <ArrowLeft size={15} />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-2 font-display text-sm font-extrabold">
              <span className="grid size-8 place-items-center rounded-lg bg-[#f6c945] text-[#143c63]">
              <Zap size={16} fill="currentColor" />
            </span>
            PVIntell
          </div>
        </div>
        <div className="mt-6">
          <div className="eyebrow">Account settings</div>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">
            Settings
          </h1>
          <p className="mt-1.5 text-xs text-muted">
            Manage your display preferences and how you access PVIntell.
          </p>
        </div>
        {(notice.error || notice.message || notice.setup === "password") && (
          <div
            className={`mt-6 rounded-xl border p-3 text-xs ${notice.error ? "border-[#e7c3b8] bg-[#fff1ed] text-[#8b432f]" : "border-[#b7cce1] bg-[#eaf2fb] text-[#175a96]"}`}
          >
            {notice.error ??
              notice.message ??
              "Google identity confirmed. Set your PVIntell password below; afterward, either sign-in method will work."}
          </div>
        )}
        <section className="card mt-4 p-4 md:p-5">
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand">
              <ShieldCheck size={17} />
            </span>
            <div>
              <div className="text-xs font-bold">Signed-in email</div>
              <div className="mt-1 text-xs text-muted">{email}</div>
            </div>
          </div>
          <div className="my-4 h-px bg-line" />
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand">
              <KeyRound size={17} />
            </span>
            <div className="flex-1">
              <h2 className="text-xs font-bold">
                Set or change your PVIntell password
              </h2>
              <p className="mt-1.5 text-[10px] leading-4 text-muted">
                This adds email-and-password access. You can still continue with
                Google at any time.
              </p>
              <form action={setPassword} className="mt-3 space-y-3">
                <PasswordField
                  label="New password"
                  name="password"
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirm new password"
                  name="passwordConfirm"
                  autoComplete="new-password"
                />
                <button className="h-9 w-full rounded-lg bg-brand text-[11px] font-bold text-white sm:w-auto sm:px-4">
                  Save password
                </button>
              </form>
            </div>
          </div>
        </section>
        <PwaInstallCard />
        <MeasurementUnitsSettings />
      </div>
    </main>
  );
}
