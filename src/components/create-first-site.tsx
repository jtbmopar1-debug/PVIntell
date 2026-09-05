"use client";

import { MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export function CreateFirstSite() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function create(formData: FormData) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create site");
      router.push(`/sites/${body.id}`);
      router.refresh();
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Could not create site",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <div className="w-full max-w-xl">
        <BrandLogo />
        <section className="card mt-8 bg-white p-7 md:p-9">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#eaf2fb] text-brand">
            <MapPin size={22} />
          </span>
          <div className="eyebrow mt-6">First step</div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.05em]">
            What should we call this place?
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            This is simply the property or physical location—for example your
            home, farm or cabin. Wattson will help set up each separate power
            system inside it next.
          </p>
          {error && (
            <div className="mt-5 rounded-xl bg-[#fff0eb] p-3 text-xs text-[#913e31]">
              {error}
            </div>
          )}
          <form action={create} className="mt-6">
            <label className="text-xs font-bold">
              Place or property name
              <input
                name="name"
                required
                autoFocus
                className="field"
                placeholder="e.g. River Views"
              />
            </label>
            <button
              disabled={saving}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-xs font-bold text-white disabled:opacity-50"
            >
              <Plus size={15} />
              {saving ? "Creating place…" : "Continue with Wattson"}
            </button>
          </form>
          <p className="mt-4 text-center text-[10px] leading-4 text-muted">
            Your onboarding location and timezone will be used automatically.
          </p>
        </section>
      </div>
    </main>
  );
}
