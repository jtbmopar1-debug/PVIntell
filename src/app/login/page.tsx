import { BatteryCharging, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PasswordField } from "@/components/password-field";
import { login, loginWithGoogle, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    mode?: string;
    setup?: string;
  }>;
}) {
  const notice = await searchParams;
  const creating = notice.mode === "signup";
  return (
    <main className="grid min-h-[100dvh] bg-[#f5f7fa] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0f3b66] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute -right-28 -top-28 size-[420px] rounded-full bg-[#f6c945]/15 blur-2xl" />
        <div className="relative"><BrandLogo inverse /></div>
        <div className="relative my-auto max-w-xl">
          <div className="text-xs font-bold uppercase tracking-[.16em] text-[#f6c945]">
            Meet Wattson
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.08] tracking-[-.05em]">
            Describe the life you want.
            <br />
            We’ll design the power.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/65">
            From first idea to commissioning and daily diagnostics, Wattson
            keeps your system knowledge in one secure place.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Feature
              icon={Sparkles}
              title="Beginner first"
              text="No electrical jargon required."
            />
            <Feature
              icon={BatteryCharging}
              title="One system record"
              text="Design through monitoring."
            />
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-[11px] text-white/45">
          <ShieldCheck size={14} />
          Your projects are private by default.
        </div>
      </section>
      <section className="flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-5 lg:hidden"><BrandLogo /></div>
          <div className="eyebrow">
            {creating ? "Create account" : "Welcome back"}
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-.04em]">
            {creating ? "Start your power system" : "Sign in to PVIntell"}
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            {creating
              ? "Create your account, then tell Wattson what you want to power."
              : "Continue designing, building, and monitoring your system."}
          </p>
          <div className="mt-4 grid grid-cols-2 rounded-lg bg-[#e9eff5] p-1">
            <Link
              href="/login"
              className={`rounded-lg py-2.5 text-center text-xs font-bold ${!creating ? "bg-white text-ink shadow-sm" : "text-muted"}`}
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className={`rounded-lg py-2.5 text-center text-xs font-bold ${creating ? "bg-white text-ink shadow-sm" : "text-muted"}`}
            >
              Create account
            </Link>
          </div>
          {(notice.error || notice.message) && (
            <div
              className={`mt-5 rounded-xl border p-3 text-xs ${notice.error ? "border-[#e7c3b8] bg-[#fff1ed] text-[#8b432f]" : "border-[#b7cce1] bg-[#eaf2fb] text-[#175a96]"}`}
            >
              {notice.error ?? notice.message}
            </div>
          )}
          <form action={loginWithGoogle}>
            <input
              type="hidden"
              name="next"
              value={
                notice.setup === "password"
                  ? "/account?setup=password"
                  : "/dashboard"
              }
            />
            <button className="mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#dadce0] bg-white px-4 text-[13px] font-semibold text-[#3c4043] shadow-sm transition hover:bg-[#f8faff] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285f4]">
              <GoogleMark />
              {notice.setup === "password"
                ? "Continue with Google to add password"
                : "Continue with Google"}
            </button>
          </form>
          <div className="my-4 flex items-center gap-3 text-[9px] uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-line" />
            or use email
            <span className="h-px flex-1 bg-line" />
          </div>
          {creating ? <SignupForm /> : <LoginForm />}
          <p className="mt-4 text-center text-[9px] leading-4 text-muted">
            {creating
              ? <>By creating an account, you agree to the <Link href="/terms" className="font-bold text-brand">Terms</Link> and acknowledge the <Link href="/privacy" className="font-bold text-brand">Privacy Policy</Link>.</>
              : "If you joined with Google, continue with Google. A Google account does not automatically create a PVIntell password."}
          </p>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.32-1.86V7.52H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.48l3.35-2.62Z"/><path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.35 2.62C7.19 7.77 9.4 6.01 12 6.01Z"/></svg>;
}

function LoginForm() {
  return (
    <form action={login} className="space-y-4">
      <EmailField label="Email" name="email" placeholder="you@example.com" />
      <PasswordField
        label="Password"
        name="password"
        placeholder="Your password"
      />
      <button className="h-10 w-full rounded-lg bg-brand text-xs font-bold text-white hover:bg-[#0f4c81]">
        Sign in
      </button>
      <div className="text-center text-xs text-muted">
        New to PVIntell?{" "}
        <Link href="/login?mode=signup" className="font-bold text-brand">
          Create an account
        </Link>
      </div>
    </form>
  );
}
function SignupForm() {
  return (
    <form action={signup} className="space-y-4">
      <div className="rounded-xl border border-[#dce4ec] bg-[#eef4fa] p-3 text-[10px] leading-4 text-muted">
        <strong className="text-ink">Already joined with Google?</strong> Sign
        in with Google instead. You can add a password later from Account
        settings.
      </div>
      <EmailField label="Email" name="email" placeholder="you@example.com" />
      <EmailField
        label="Confirm email"
        name="emailConfirm"
        placeholder="Type your email again"
      />
      <PasswordField
        label="Create password"
        name="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />
      <PasswordField
        label="Confirm password"
        name="passwordConfirm"
        autoComplete="new-password"
        placeholder="Type your password again"
      />
      <button className="h-10 w-full rounded-lg bg-brand text-xs font-bold text-white hover:bg-[#0f4c81]">
        Create account
      </button>
      <div className="text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-brand">
          Sign in
        </Link>
      </div>
    </form>
  );
}
function EmailField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="block text-xs font-bold">
      {label}
      <input
        name={name}
        type="email"
        autoComplete="email"
        required
        className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-[11px] font-normal outline-none focus:border-brand"
        placeholder={placeholder}
      />
    </label>
  );
}
function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Sparkles;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
      <Icon className="text-[#f6c945]" size={18} />
      <div className="mt-3 text-sm font-bold">{title}</div>
      <div className="mt-1 text-[11px] text-white/55">{text}</div>
    </div>
  );
}
