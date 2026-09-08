"use client";

import { WalletCards } from "lucide-react";
import { usePurchasePromptPreference } from "@/preferences/financials";

export function FinancialPreferencesSettings() {
  const { enabled, setEnabled } = usePurchasePromptPreference();

  return (
    <section className="card mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 md:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-brand">
            <WalletCards size={16}/>
          </span>
          <div>
            <div className="eyebrow">Shopping list</div>
            <h2 className="mt-1 text-sm font-extrabold">Offer to add acquired items to Financials</h2>
            <p className="mt-1 max-w-xl text-[10px] leading-4 text-muted">After you tick Got, ask for the purchase price and supplier. Turning this off does not affect acquired-item tracking.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-[#238653]" : "bg-[#c8d2dc]"}`}
        >
          <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "left-6" : "left-1"}`}/>
          <span className="sr-only">{enabled ? "Disable" : "Enable"} purchase prompts</span>
        </button>
      </div>
    </section>
  );
}
