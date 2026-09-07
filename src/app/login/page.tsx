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
            <button className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#ccd8e4] bg-white text-xs font-bold text-[#364a60] hover:border-[#9db4c9] hover:bg-[#fafcfe]">
              <span className="grid size-6 place-items-center rounded-full border border-[#d8e0e8] font-bold text-[#4285f4]">
                G
              </span>
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
